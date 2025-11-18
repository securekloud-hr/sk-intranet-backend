const mongoose = require("mongoose");

const referralSchema = new mongoose.Schema(
  {
    candidateName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    position: { type: String, required: true },
    notes: { type: String },
    resumePath: { type: String }, // saved file path
  },
  { timestamps: true } // adds createdAt & updatedAt
);

module.exports = mongoose.model("Referral", referralSchema);
