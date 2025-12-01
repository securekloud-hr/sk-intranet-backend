const mongoose = require("mongoose");

const EmployeeSchema = new mongoose.Schema({
  EmpID: String,
  EmployeeName: String,
  Department: String,

  // ===========================
  //  Newly Added Fields (Required)
  // ===========================
  Designation: String,
  OfficialEmail: String,
  PersonalEmailID: String,

  // Legacy email (keep for compatibility)
  Email: String,

  PhoneNumber: String,
  CurrentAddress: String,
  PermanentAddress: String,
  PAN: String,
  Aadhar: String,
  BloodGroup: String,
  EmergencyContact: String,

  Tech1: String,
  Tech2: String,
  SpecialSkill: String,
});

module.exports = mongoose.model("Employee", EmployeeSchema);
