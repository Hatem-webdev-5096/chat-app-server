const User = require("./models/User");

let connectedUsers = [];

exports.sendNotification = (socket) => {
  socket.emit("notification");
};

exports.socketConnection = (io) => {
  io.on("connection", (socket) => {
    socket.on("userId", (userId) => {
      console.log("user connected")
      connectedUsers.push({
        socketId: socket.id,
        userId,
      });
    });

    socket.on("sendFriendRequest", async (requestData) => {
      const senderId = requestData.senderId;
      const recieverId = requestData.recieverId;

      const recieverSocket = connectedUsers.find((u) => {
        return u.userId.toString() === recieverId.toString();
      });
      if (recieverSocket) {
        const recieverSocketId = recieverSocket.socketId;
        socket.broadcast.to(recieverSocketId).emit("sendNotification");
      }
    });

    socket.on("friendRequestAccepted", ({ userId, senderId }) => {
      const userSocket = connectedUsers.find((u) => {
        return u.userId.toString() === userId.toString();
      });
      if (userSocket) {
        socket.broadcast.to(userSocket.socketId).emit("newFriendAdded");
      }
      const senderSocket = connectedUsers.find((u) => {
        return u.userId.toString() === senderId.toString();
      });
      if (senderSocket) {
        socket.broadcast.to(senderSocket.socketId).emit("newFriendAdded");
      }
    });

    socket.on("sendMessage", async (messageObject) => {
      try {
        
        const senderUser = await User.findById(messageObject.senderId);
        const recieverUser = await User.findOne({
          userName: messageObject.recieverUserName,
        });
        const senderUserTargetChat = senderUser.chats.findIndex((c) => {
          return c._id.toString() === messageObject.chatId.toString();
        });
        
        senderUser.chats[senderUserTargetChat].messages.push({
          senderUserName: senderUser.userName,
          messageContent: messageObject.message,
          time: messageObject.time
        });
        await senderUser.save();
        const recieverUserTargetChat = recieverUser.chats.findIndex((c) => {
          return c.friend.userId.toString() === messageObject.senderId.toString();
        });
        
        recieverUser.chats[recieverUserTargetChat].messages.push({
          senderUserName: senderUser.userName,
          messageContent: messageObject.message,
          time: messageObject.time
        });
        await recieverUser.save();
        const recieverSocket = connectedUsers.find((u) => {
          return u.userId.toString() === recieverUser._id.toString();
        });
        
        if (recieverSocket) {
          
          socket.broadcast.to(recieverSocket.socketId).emit("messageRecieved", {
            senderUserName: senderUser.userName,
            messageContent: messageObject.message,
            time: messageObject.time
          });
        }

      } catch (error) {}
    });

    socket.on("updatePP", async(userId) => {
     
      try {
        const user = await User.findById(userId);
        
        const userSocket = connectedUsers.find((u) => {
          return u.userId.toString() === userId.toString();
        });
        console.log(userSocket, connectedUsers);
        socket.broadcast.to(userSocket.socketId).emit("renderUpdatedPP", {
          profilePic: {
            contentType: user.profilePic.contentType,
            data: user.profilePic.data.toString("base64"),
          }
        })
      } catch (error) {
        console.log(error);
      }
    })

    socket.on("disconnect", () => {
      
      const userIndex = connectedUsers.findIndex(
        (u) => u.socketId === socket.id
      );
      connectedUsers.splice(userIndex, 1);
    });
  });
};

exports.connectedUsers = connectedUsers;
