const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema({
  empId: { type: String, required: true },     // employee ID
  name: { type: String, required: true },      // employee name
  department: { type: String },                // department name
  role: { type: String },                      // role/title
  email: { type: String },                     // email address
  subTeam: { type: String },                   // renamed (no space in key)
  managerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Employee", 
    default: null 
  }
});

module.exports = mongoose.model("Employee", employeeSchema);
