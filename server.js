const express = require("express");
const mongoose = require("mongoose");
require('dotenv').config();
const cors = require("cors");
const { Server } = require("socket.io");
const bodyParser = require("body-parser");
const socket = require("./socket");
const cookie = require('cookie-parser');
const multer = require('multer');
const Tokens = require('csrf');

const tokens = new Tokens();
const csrfSecret = tokens.secretSync();

const authRoutes = require("./routes/auth");
const accountRoutes = require("./routes/account");

const app = express();

const storage = multer.diskStorage({
  destination: (req,file,cb) => {
      cb(null,'./public/profilePics/')
  },
  filename: (req,file,callback) => {
    callback(null,file.originalname);
  }
});


app.use(cors({
  origin: 'https://chat-app-362017.web.app',
  methods: 'GET,POST,PUT,PATCH,DELETE',
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(cookie(process.env.COOKIE_PARSER_SECRET));
app.use(bodyParser.json());
app.use(multer({storage}).single('image'));



app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.get("/csrf",(req,res,next) => {
    
    const token = tokens.create(csrfSecret);
    res.status(200).json({csrfToken:token});
    next();
});

app.post( (req, res, next)=> {
  let token = req.body._csrf;
  if(!tokens.verify(csrfSecret,token)) {
    const error = new Error("Invalid csrf Token");
    error.status = 403;
    error.data= {message: "invalid csrf token"};
    throw error;
  } else {
     next();
  }
});

app.use("/auth", authRoutes);
app.use("/account", accountRoutes);


app.use((err, req, res, next) => {
  const status = err.status || 500;
  const errorsArr = err.data;
  console.log(err);
  res.status(status).json({ message: err.message, errors: errorsArr });
  next();
});

mongoose
  .connect(process.env.MONGO_DB_URI)
  .then(() => {
    const server = app.listen(process.env.PORT, () => {
      console.log(`server running on port ${process.env.PORT}.`);
    });
    const io = new Server(server, {
      cors: {
        origin: "https://chat-app-362017.web.app",
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        credentials:true
      },
    });
    socket.socketConnection(io);
  });


  