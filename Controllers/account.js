const User = require("../models/User");
const fs = require("fs");
const path = require("path");

exports.postFindFriends = async (req, res, next) => {
  const searchQuery = req.body.searchQuery;
  const senderId = req.body.senderId;

  try {
    const userQuery = await User.findOne({ userName: searchQuery });
    if (!userQuery) {
      const error = new Error("username is not found");
      error.status = 404;
      error.data = {
        message: "username is not found",
      };
      throw error;
    } else {
      let user = userQuery;

      if (
        userQuery.googleProfilePic
      ) {
        user.imageUrl = userQuery.googleProfilePic;
      } else if (!userQuery.googleProfilePic) {
        user.imageUrl = `data:${
          userQuery.profilePic.contentType
        };base64,${userQuery.profilePic.data.toString("base64")}`;
      }

      const senderUser = await User.findById(senderId);
      const friend = senderUser.friends.find(
        (f) => f.friendUserId.toString() === user._id.toString()
      );
      if (friend) {
        res.status(200).json({
          user: {
            fName: user.fName,
            lName: user.lName,
            userName: user.userName,
            email: user.email,
            imageUrl: user.imageUrl,
            _id: user._id,
            alreadyFriends: true,
          },
        });
      } else if (!friend) {
        
        res.status(200).json({
          user: {
            fName: user.fName,
            lName: user.lName,
            userName: user.userName,
            imageUrl: user.imageUrl,
            email: user.email,
            _id: user._id,
          },
        });
      }
    }
  } catch (error) {
    next(error);
  }
};

exports.getFriendsList = async (req, res, next) => {
  const userId = req.params.userId;
  try {
    const user = await User.findById(userId).populate("friends.friendUserId");
    user.friends.forEach(f => {
      if (!f.friendUserId) {
        user.friends.pull(f);
      } else {
        return
      }
    });
    await user.save();
    let friendsList = [];

    if (user.friends.length > 0) {
      const friends = user.friends.map((f) => {

        let fObject = f.friendUserId;

        if (
          fObject.googleProfilePic
        ) {
          fObject.imageUrl = f.friendUserId.googleProfilePic;
        } else if (!fObject.googleProfilePic) {
          fObject.imageUrl = `data:${
            f.friendUserId.profilePic.contentType
          };base64,${f.friendUserId.profilePic.data.toString("base64")}`;
        }
        return {
          fNam: fObject.fName,
          lName: fObject.lName,
          email: fObject.email,
          userName: fObject.userName,
          imageUrl: fObject.imageUrl,
          _id: fObject._id,
        };
      });
      user.chats.forEach((c) => {
        friends.forEach((f) => {
          if (c.friend.userId.toString() === f._id.toString()) {
            friendsList.push({ ...f, correspondingChat: c });
          }
        });
        return friendsList;
      });
      res.status(200).json({ list: friendsList });
    } else {
      res.status(200).json({ message: "Make some new friends now!" });
    }
  } catch (error) {
    next(error);
  }
};

exports.postSendFriendRequest = async (req, res, next) => {
  const sender = req.body.sender;
  const reciever = req.body.reciever;

  try {
    const recieverUser = await User.findById(reciever);
    console.log(req.body);
    recieverUser.friendRequests.recieved.push({
      sender: sender,
      opened: false,
    });
    await recieverUser.save();

    const senderUser = await User.findById(sender);
    senderUser.friendRequests.sent.push({
      reciever: reciever,
    });
    await senderUser.save();

    res.status(201).json({ message: "friend request sent." });
  } catch (err) {
    next(err);
  }
};

exports.getNotifications = async (req, res, next) => {
  const userId = req.params.userId;

  try {
    const user = await User.findById(userId).populate(
      "friendRequests.recieved.sender"
    );

    const friendRequests = user.friendRequests.recieved.map((r) => {
      let fObject = r.sender;
      if (
        r.sender.googleProfilePic &&
        r.sender.profilePic.isDefault === false
      ) {
        fObject.imageUrl = r.sender.googleProfilePic;
      } else if (!r.sender.googleProfilePic) {
        fObject.imageUrl = `data:${
          r.sender.profilePic.contentType
        };base64,${r.sender.profilePic.data.toString("base64")}`;
      }
      return {
        senderId: fObject._id,
        senderFName: fObject.fName,
        senderLName: fObject.lName,
        senderUserName: fObject.userName,
        senderEmail: fObject.email,
        imageUrl: fObject.imageUrl,
        opened: r.opened,
        notificationId: r._id,
      };
    });
    res.status(200).json({ friendRequests: friendRequests });
  } catch (error) {
    next(error);
  }
};

exports.handleFriendRequest = async (req, res, next) => {
  const recieverId = req.params.userId;
  const notificationId = req.params.notificationId;
  const senderId = req.params.senderId;
  const response = req.params.response;
  try {
    const recieverUser = await User.findById(recieverId);
    const senderUser = await User.findById(senderId);

    const recievedNotificationIndex =
      recieverUser.friendRequests.recieved.findIndex(
        (r) => r._id.toString() === notificationId.toString()
      );

    recieverUser.friendRequests.recieved[
      recievedNotificationIndex
    ].opened = true;

    if (response === "accept") {
      const newChatObject1 = {
        friend: {
          userId: senderId,
        },
        messages: [],
      };
      recieverUser.friends.push({ friendUserId: senderId });
      recieverUser.chats.push(newChatObject1);
      const newChatObject2 = {
        friend: {
          userId: recieverId,
        },
        messages: [],
      };
      senderUser.friends.push({ friendUserId: recieverId });
      senderUser.chats.push(newChatObject2);
      await senderUser.save();
      await recieverUser.save();

      res.status(200).json({ message: "You are now friends" });
    } else if (response === "reject") {
      await recieverUser.save();
      res.status(200).json({ message: "friend request rejected" });
    }
  } catch (error) {
    next(error);
  }
};

exports.postEditUsername = async (req, res, next) => {
  const userId = req.params.userId;
  const newUserName = req.body.newUserName;

  try {
    const alreadyExisted = await User.findOne({ userName: newUserName });

    if (alreadyExisted) {
      const error = new Error("Username is already in use.");
      error.status = 403;
      error.data = {
        message: "Username is already in use.",
      };
      throw error;
    } else {
      const user = await User.findById(userId);
      user.userName = newUserName;
      await user.save();
      res.status(201).json({
        message: "Username updated successfully.",
        updatedUserName: newUserName,
      });
    }
  } catch (error) {
    next(error);
  }
};

exports.getChat = async (req, res, next) => {
  const userId = req.params.userId;
  const chatId = req.params.chatId;
  try {
    const user = await User.findById(userId);
    const chat = user.chats.find((c) => {
      return c._id.toString() === chatId.toString();
    });

    res.status(200).json({ chat: chat });
  } catch (error) {
    next(error);
  }
};

exports.editPP = async (req, res, next) => {
  const userId = req.userId;
  const p = path.join(
    __dirname,
    "../",
    "public",
    "/profilePics/",
    req.file.originalname
  );
  const newProfilePic = fs.readFileSync(p);
  try {
    const user = await User.findById(userId);
    if (user.googleProfilePic) {
      user.googleProfilePic = null;
      await user.save();
    }
    user.profilePic = {
      data: newProfilePic,
      contentType: req.file.mimetype,
      isDefault: false,
    };
    await user.save();
    fs.unlinkSync(p);
    res.status(201).json({ message: "Profile Picture updated successfully." });
  } catch (error) {
    next(error);
  }
};

exports.deleteAccount = async(req,res,next) => {
  const userId = req.params.userId;
  try {
    const user = await User.findById(userId);
    await User.deleteOne({_id:userId});
    res.status(200).json({message:"Account deleted successfully"});
  } catch (error) {
    next(error)
  }
}
