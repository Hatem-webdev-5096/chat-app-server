const mongoose = require("mongoose");
const { required } = require("nodemon/lib/config");

const Schema = mongoose.Schema;
const userSchema = new Schema({
  fName: {
    type: String,
    required: true,
  },
  lName: {
    type: String,
    required: true,
  },
  userName: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  profilePic: {
    data: Buffer,
    contentType: String,
    isDefault: Boolean
  },
  googleProfilePic: {
    type: String
  },
  password: {
    type: String,
    required: true,
  },
  confirmationToken: {
    token: {
      type: String,
    },
    expiration: {
      type: Date,
    },
  },
  forgotPasswordToken: {
    token: {
      type: String,
    },
    expiration: {
      type: Date,
    },
  },
  userActivated: {
    type: Boolean,
    required: true,
    default: false,
  },
  friends: [
    {
      friendUserId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    },
  ],

  chats: [
    {
      friend: {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
      },
      messages: [
        {
          senderUserName: {
            type: String,
            ref: "User",
          },
          messageContent: {
            type: String,
          },
          time: {
            month: Number,
            day: Number,
            hour: Number,
            minutes:Number,
          },
        },
      ],
      hasUnreadMessages: Boolean
    },
  ],
  friendRequests: {
    sent: [
      {
        reciever: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
      },
    ],
    recieved: [
      {
        sender: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        opened: {
          type: Boolean,
          required: true,
          default: false,
        },
      },
    ],
  },
});


module.exports = mongoose.model("User", userSchema);
