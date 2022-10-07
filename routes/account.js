const express = require("express");
const router = express.Router();
const {body} = require('express-validator');
const authMiddleware = require('../auth');


const User = require('../models/User');
const accountControllers =require('../Controllers/account');

router.post("/findFriends",authMiddleware, accountControllers.postFindFriends);

router.get('/getFriendsList/:userId',authMiddleware, accountControllers.getFriendsList);

router.post('/:senderId/send-request',authMiddleware, accountControllers.postSendFriendRequest);

router.get("/:userId/get-notifications",authMiddleware, accountControllers.getNotifications);

router.get("/:userId/handleFriendRequest/:notificationId/:senderId/:response",authMiddleware, accountControllers.handleFriendRequest);

router.post("/:userId/edit-username",authMiddleware, accountControllers.postEditUsername);


router.get("/getChat/:userId/:chatId",authMiddleware, accountControllers.getChat);

router.post('/:userId/updatePP', authMiddleware, accountControllers.editPP);

router.delete("/:userId/deleteAccount", authMiddleware, accountControllers.deleteAccount);










module.exports = router;