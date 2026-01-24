const mongoose = require("mongoose");

const SalesSchema = new mongoose.Schema(
  {
    empId: {
      type: String,
      required: true,
    },

    employeeName: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["admin", "manager", "user", "isr"],
      default: "isr",
    },

    date: {
      type: Date,
      required: true,
    },

    callsMade: { type: Number, default: 0 },
    netNewMeeting: { type: Number, default: 0 },
    followUpMeeting: { type: Number, default: 0 },
    qualifiedMeeting: { type: Number, default: 0 },

    meetingsDone: { type: Number, default: 0 },

    emailsOutgoing: { type: Number, default: 0 },
    whatsappMessage: { type: Number, default: 0 },
    proposals: { type: Number, default: 0 },
    dealWon: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Sales", SalesSchema);
