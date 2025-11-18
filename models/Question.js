// models/Question.js
const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema(
  {
    // Each Excel sheet name becomes a "domain" (tab) in the UI
    domain: { type: String, default: "Domain1", index: true },

    // Optional stable ordering per domain
    questionNo: { type: Number, index: true },

    // Question text
    text: { type: String, required: true },

    // Supported types
    type: { type: String, enum: ["mcq", "text", "boolean"], default: "mcq" },

    // For mcq & boolean; ignored for text
    options: [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Question", QuestionSchema);
