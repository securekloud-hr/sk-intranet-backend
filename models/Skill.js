const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  skillName: { type: String, required: true },
  addedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Skill', skillSchema);
