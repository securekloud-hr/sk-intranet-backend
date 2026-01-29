// backend/models/Job.js
const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema({
  id: String,
  title: String,
  department: String,
  location: String,
  type: String,
  experience: String,
  postedDate: String,
  description: String,
  requirements: [String],
  priority: String,
  bonus: Number,
}, { timestamps: true });

module.exports = mongoose.model("Job", jobSchema);

const mongoose =require()




