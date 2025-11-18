const mongoose = require("mongoose");

const nominationSchema = new mongoose.Schema({
  type: { type: String, required: true }, // Star / Team-Quarter / Associate / Team-Year
  formData: { type: Object, required: true }, // store full form as JSON
  submittedBy: { type: String }, // optional, could capture user email
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Nomination", nominationSchema);
