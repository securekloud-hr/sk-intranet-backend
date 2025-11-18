const mongoose = require("mongoose");

const EmployeeSchema = new mongoose.Schema(
  {
    EmpID: String,
    EmployeeName: String,
    Department: String,

    PhoneNumber: String,
    CurrentAddress: String,
    PermanentAddress: String,
    PAN: String,
    Aadhar: String,
    BloodGroup: String,
    EmergencyContact: String,
    Email: String,
    Tech1: String,
    Tech2: String,
    SpecialSkill: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("Employee", EmployeeSchema);
