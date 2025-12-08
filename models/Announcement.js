const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },

  // 👇 this field is REQUIRED so image can be stored
  imageUrl: { type: String, default: null },

  // optional fields (you can keep or remove)
  date: { type: Date },
  category: { type: String, default: "General" },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Announcement", announcementSchema);
