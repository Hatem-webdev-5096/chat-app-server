const express = require("express");
const router = express.Router();
const {body} = require('express-validator');

const User = require('../models/User');
const authControllers = require('../Controllers/auth');
const authMiddleware = require('../auth');

router.post('/sign-up',
body('fName').trim().isLength({min:3}).withMessage("Name length must be at least 3 characters long."),
body('lName').trim().isLength({min:3}).withMessage("Name length must be at least 3 characters long."),
body('email').isEmail().normalizeEmail()
.withMessage('Please provide a valid email address.')
.custom((value,{req}) => {
   return User.findOne({email:value})
    .then(userDoc => {
        if (userDoc) {
            return Promise.reject("Email us already in use, sign-in or use another email.");
        } else {
            return Promise.resolve();
        }
    })
})
,
body('pass').trim().isLength({min:6}).withMessage('Passwords must be alphanumeric and at least 6 characters long.'),
body('cPass').trim().custom((value,{req}) =>{
    if (value !== req.body.pass) {
        return Promise.reject("Passwords don't match");
    } else {
        return Promise.resolve();
    }
}),
body('userName').trim().isLength({min:6}).custom((value,req)=>{
    return User.findOne({userName: value})
    .then(userDoc => {
        if (userDoc) {
               return Promise.reject("username is already used, use aother one");
        } else {
            return Promise.resolve();
        }
     
    })
} ),
authControllers.postSignup);

router.get('/confirm-email/:confirmationToken/:userId', authControllers.getConfirmEmail);

router.post('/sign-in',
body('email').isEmail().trim().normalizeEmail().withMessage('please enter a valid email'),
authControllers.postSignin);

router.post('/forgot-password', authControllers['forgot-password']);

router.post('/post-reset-password', authControllers['post-reset-password']);

router.post("/google/sign-in", authControllers.postGoogleSignin);

router.post("/:userId/changePassword", authMiddleware, authControllers.changePassword);

module.exports = router;
