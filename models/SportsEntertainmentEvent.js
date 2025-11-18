const mongoose = require('mongoose');

const sportsEntertainmentEventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: String, required: true },
  location: { type: String },
  description: { type: String, required: true },
  registrationOpen: { type: Boolean, default: false },
  images: [String]
});

module.exports = mongoose.model('SportsEntertainmentEvent', sportsEntertainmentEventSchema);