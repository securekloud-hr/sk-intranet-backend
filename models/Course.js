const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  title: { type: String, required: true },
  instructor: { type: String, required: true },
  duration: { type: String, required: true },
  category: { type: String, enum: ['technical', 'professional', 'compliance', 'leadership'], required: true },
  description: { type: String, default: "Newly added course" },
  enrolled: { type: Boolean, default: false },
  progress: { type: Number, default: 0 }
});

module.exports = mongoose.model('Course', courseSchema);