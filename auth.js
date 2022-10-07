const jwt = require('jsonwebtoken');

const authMiddleware = (req,res,next) => {
    const token = req.cookies.authCookie;
   
    if(token){
         const isAuth = jwt.verify(token,process.env.JWT_SECRET);
         if (isAuth) {
            req.userId=isAuth.userId;
            next();
        }
    } else {
        const error = new Error('Not Authenticated');
        error.status = 403;
        error.data = {message:'session expired, please signin.', status: 403}
        next(error);
    }

}


module.exports = authMiddleware;