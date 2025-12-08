const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    date: { type: Date, required: true },

    // 👇 NEW FIELDS
    type: {
      type: String,
      enum: ["Wellness", "Holidays/Festivals", "Sports/Entertainment"],
      required: true,
    },
    description: { type: String, default: "" },
    registrationOpen: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Event", eventSchema);
