const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: Date, required: true },
  startTime: String,
  endTime: String,
  type: String, // e.g. Meeting, Webinar, Training
});

module.exports = mongoose.model("Event", eventSchema);
