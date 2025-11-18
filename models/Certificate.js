const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  title: { type: String, required: true },
  provider: { type: String, required: true },
  dateEarned: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Certificate', certificateSchema);