const mongoose = require("mongoose");

const EmployeeSchema = new mongoose.Schema({
  EmpID: String,
  EmployeeName: String,
  Department: String,

  Designation: String,

  // ✅ Reporting Manager NAME (from Excel)
  ReportingManager: String,
  ProfileImage: { type: String, default: "" },


  OfficialEmail: String,
  PersonalEmailID: String,
  Email: String,

  Birthday: String,
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

  EarnedLeave: Number,
  CasualLeave: Number,
  SickLeave: Number,
  MarriageLeave: Number,
  PaternityLeave: Number,
  MaternityLeave: Number,

});

module.exports = mongoose.model("Employee", EmployeeSchema);
