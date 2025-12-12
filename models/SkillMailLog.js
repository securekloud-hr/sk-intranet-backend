const mongoose = require("mongoose");

const skillMailLogSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    subject: String,
    message: String,
    type: String, // ld-skill
  },
  {
    collection: "skill_mails",
    timestamps: true,
  }
);

module.exports = mongoose.model("SkillMailLog", skillMailLogSchema);
