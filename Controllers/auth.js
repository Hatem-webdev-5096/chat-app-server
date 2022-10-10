const User = require("../models/User");
const Bcrypt = require("bcrypt");
const { validationResult } = require("express-validator");
const sgMail = require("@sendgrid/mail");
const crypto = require("crypto");
const JWT = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const { Console } = require("console");
require("dotenv").config();

sgMail.setApiKey(process.env.SGMAIL_API_KEY);

exports.postSignup = async (req, res, next) => {
  const validationErrors = validationResult(req);

  if (!validationErrors.isEmpty()) {
    const error = new Error("Validation error");
    error.status = 422;
    error.data = validationErrors.array();
    return next(error);
  }
  let token;
  const fName = req.body.fName;
  const lName = req.body.lName;
  const userName = req.body.userName;
  const email = req.body.email;
  const pass = req.body.pass;
  const p = path.join(__dirname, "../", "public", "/profilePics/default.png");
  const defaultProfilePic = fs.readFileSync(p);
  try {
    crypto.randomBytes(32, async (err, buffer) => {
      if (err) {
        throw err;
      } else {
        token = buffer.toString("hex");
      }

      let hashedPass = await Bcrypt.hash(pass, 12);
      const newUser = new User({
        fName: fName,
        lName: lName,
        userName: userName,
        email: email,
        password: hashedPass,
        profilePic: {
          data: defaultProfilePic,
          contentType: "image/png",
          isDefault: true,
        },
        confirmationToken: {
          token: token,
          expiration: Date.now() + 3600000,
        },
      });
      await newUser.save();
      token = token + `/${newUser._id.toString()}`;

      const msg = {
        to: email,
        from: process.env.MY_EMAIL, // Change to your verified sender
        subject: "Chat-App register instructions.",
        html: `
                <h1>Chat-App: confirm email address</h1>
                <p>please follow the following <a href="http://localhost:3000/confirm-email/${token}"> link </a>
                 to activate your account.</p>
                 <p> This email is only valid for 1 hour. </p>
            `,
      };
      await sgMail.send(msg);
      res.status(200).json({
        message:
          "User created successfully, please follow the instructions sent to your email!",
      });
    });
  } catch (error) {
    next(error);
  }
};

exports.getConfirmEmail = async (req, res, next) => {
  const userId = req.params.userId;
  const confirmationToken = req.params.confirmationToken;
  try {
    const user = await User.findById(userId);
    if (
      user.confirmationToken.token !== confirmationToken ||
      user.confirmationToken.expiration < Date.now()
    ) {
      const error = new Error(
        "Email verification failed: Confirmation token expired, please sign-up again"
      );
      throw error;
    } else {
      user.userActivated = true;
      await user.save();
      res.status(200).json({ message: "User activated successfully." });
    }
  } catch (error) {
    next(error);
  }
};

exports.postSignin = async (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;

  const validationErrors = validationResult(req);
  if (!validationErrors.isEmpty()) {
    const error = new Error("Validation error");
    error.status = 422;
    error.data = validationErrors.array();
    return next(error);
  }

  try {
    const user = await User.findOne({ email: email });
    if (!user) {
      const error = new Error("This email is not registered.");
      error.status = 404;
      error.data = { message: "This email is not registered.", status: 404 };
      throw error;
    }
    if (user.userActivated) {
      const passwordsMatch = await Bcrypt.compare(password, user.password);
      if (user.password === "Authenticated by Google.") {
        const error = new Error(
          "This email is registered using Google Sign-in"
        );
        error.status = 404;
        error.data = {
          message: "This email is registered using Google.",
          status: 404,
        };
        throw error;
      }

      if (!passwordsMatch) {
        const error = new Error("Email/password combination is incorrect.");
        error.status = 404;
        error.data = {
          message: "Email/password combination is incorrect.",
          status: 404,
        };
        throw error;
      } else if (passwordsMatch) {
        const token = JWT.sign(
          {
            email: email,
            userId: user._id,
          },
          process.env.JWT_SECRET,
          { algorithm: "HS256" }
        );

        res
          .status(200)
          .cookie("authCookie", token, {
            httpOnly: true,
          })
          .json({
            message: "Login successful.",
            userId: user._id.toString(),
            userObject: {
              fName: user.fName,
              lName: user.lName,
              userName: user.userName,
              email: user.email,
              friends: user.friends,
              friendRequests: user.friendRequests,
              profilePic: {
                contentType: user.profilePic.contentType,
                data: user.profilePic.data.toString("base64"),
                isDefault: user.profilePic.isDefault,
              },
              _id: user._id,
              
            },
          });
      }
    } else {
      if (user.confirmationToken.expiration > Date.now()) {
        const error = new Error(
          "This account has not been activated yet, please follow the instructions sent to you via email to activate this account."
        );
        error.status = 401;
        error.data = {
          message:
            "This account has not been activated yet, please follow the instructions sent to you via email to activate this account.",
        };
        throw error;
      } else if (user.confirmationToken.expiration < Date.now()) {
        await User.findByIdAndDelete(user._id);
        const error = new Error("This email is not registered.");
        error.status = 404;
        error.data = { message: "This email is not registered." };
        throw error;
      }
    }
  } catch (err) {
    next(err);
  }
};

exports.postGoogleSignin = async (req, res, next) => {
  const userObject = req.body.userObject;

  try {
    const userExists = await User.findOne({ email: userObject.email });
    if (!userExists) {
      const newUser = new User({
        fName: userObject.given_name,
        lName: userObject.family_name,
        userName: `${userObject.given_name} ${userObject.family_name}`,
        email: userObject.email,
        googleProfilePic: userObject.picture,
        password: "Authenticated by Google.",
        userActivated: true,
      });
      await newUser.save();
      const token = JWT.sign(
        {
          email: newUser.email,
          userId: newUser._id,
        },
        process.env.JWT_SECRET,
        { algorithm: "HS256" }
      );
      res
        .status(200)
        .cookie("authCookie", token, {
          maxAge: 60 * 60 * 1000,
          httpOnly: true,
        })
        .json({
          message: "Login successful.",
          userId: newUser._id.toString(),
          userObject: {
            fName: newUser.fName,
            lName: newUser.lName,
            userName: newUser.userName,
            email: newUser.email,
            friends: newUser.friends,
            friendRequests: newUser.friendRequests,
            googleProfilePic: newUser.googleProfilePic,
            profilePic: {
              contentType: newUser.profilePic?.contentType,
              data: newUser.profilePic?.data?.toString("base64"),
              isDefault: false,
            },
            _id: newUser._id,
            sessionExp: new Date().getTime() + 60 * 60 * 1000,
          },
        });
    } else if (userExists) {
      const token = JWT.sign(
        {
          email: userExists.email,
          userId: userExists._id,
        },
        process.env.JWT_SECRET,
        { algorithm: "HS256" }
      );
      res
        .status(200)
        .cookie("authCookie", token, {
          maxAge: 60 * 60 * 1000,
          httpOnly: true,
        })
        .json({
          message: "Login successful.",
          userId: userExists._id.toString(),
          userObject: {
            fName: userExists.fName,
            lName: userExists.lName,
            userName: userExists.userName,
            email: userExists.email,
            friends: userExists.friends,
            friendRequests: userExists.friendRequests,
            googleProfilePic: userExists.googleProfilePic,
            profilePic: {
              contentType: userExists.profilePic?.contentType,
              data: userExists.profilePic?.data?.toString("base64"),
              isDefault: userExists.profilePic?.isDefault,
            },
            _id: userExists._id,
            sessionExp: new Date().getTime() + 60 * 60 * 1000,
          },
        });
    }
  } catch (error) {
    next(error);
  }
};

exports["forgot-password"] = async (req, res, next) => {
  const email = req.body.email;
  try {
    const user = await User.findOne({ email: email });
    if (!user) {
      const error = new Error(
        "This email is not assiociated with any account."
      );
      error.status = 404;
      error.data = {
        message: "This email is not assiociated with any account.",
      };
      throw error;
    }
    crypto.randomBytes(32, async (error, buffer) => {
      if (error) {
        error.status = 500;
        error.data = {
          message: "Internal server error, please try again later.",
        };
        throw error;
      }
      let token = buffer.toString("hex");

      user.forgotPasswordToken.token = token;
      user.forgotPasswordToken.expiration = Date.now() + 3600000;
      await user.save();
      token = token + `/${user._id.toString()}`;

      const msg = {
        to: email,
        from: process.env.MY_EMAIL,
        subject: "Chat-App reset password.",
        html: `
                <h1>Chat-App: Reset password</h1>
                <p>please follow the following <a href="http://localhost:3000/reset-password/${token}"> link </a>
                 to change your password.</p>
                <p> This email is only valid for 1 hour. </p> 
            `,
      };
      await sgMail.send(msg);
      res.status(200).json({ message: "An email has been sent to you." });
    });
  } catch (error) {
    next(error);
  }
};

exports["post-reset-password"] = async (req, res, next) => {
  const userId = req.body.userId;
  const resetToken = req.body.resetToken;
  const newPassword = req.body.newPassword;
  try {
    const user = await User.findById(userId);
    if (!user || user.forgotPasswordToken.token !== resetToken) {
      const error = new Error("no user found");
      error.status = 404;
      error.data = {
        message: "An error occured, please try again later.",
      };
      throw error;
    }
    if (user.forgotPasswordToken.expiration < Date.now()) {
      const error = new Error(
        "This reset password link is no longer valid, please try again"
      );
      error.status = 401;
      error.data = {
        message:
          "This reset password link is no longer valid, please try again.",
      };
      throw error;
    }
    const newHashedPassword = await Bcrypt.hash(newPassword, 12);
    user.password = newHashedPassword;
    await user.save();
    res.status(201).json({ message: "Password updated successfully." });
  } catch (error) {
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  const userId = req.params.userId;
  const oldPassword = req.body.userInput.oldPassword;
  const newPassword = req.body.userInput.newPassword;
  try {
    const user = await User.findById(userId);
    const oldPasswordValidation = await Bcrypt.compare(
      oldPassword,
      user.password
    );

    if (oldPasswordValidation) {
      let hashedPassword = await Bcrypt.hash(
        newPassword,
        12
      );

      user.password = hashedPassword;
      
      await user.save();

      res.status(201).json({ message: "Password updated!" });
    } else if (!oldPasswordValidation) {
      const error = new Error("Password is incorrect");
      error.status = 403;
      error.data = {
        message: "You entered a wrong password.",
      };
      throw error;
    }
  } catch (error) {
    next(error);
  }
};
