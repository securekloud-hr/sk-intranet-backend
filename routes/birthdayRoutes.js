// routes/birthdayRoutes.js
const express = require("express");
const router = express.Router();
const Employee = require("../models/EmployeeDirectory");

// GET /api/birthdays/bom?month=6
router.get("/bom", async (req, res) => {
  try {
    const month = parseInt(req.query.month, 10); // 1–12

    if (!month || month < 1 || month > 12) {
      return res.status(400).json({ message: "Invalid month" });
    }

    const monthStr = month.toString().padStart(2, "0"); // "06"

    // "21/06" → match people whose Birthday ends with `/06`
    const employees = await Employee.find({
      Birthday: { $regex: new RegExp(`/${monthStr}$`) },
    }).select("EmpID EmployeeName Birthday");

    // sort by day
    const sorted = employees.sort((a, b) => {
      const dayA = parseInt((a.Birthday || "01/01").split("/")[0], 10);
      const dayB = parseInt((b.Birthday || "01/01").split("/")[0], 10);
      return dayA - dayB;
    });

    // Simple array for frontend
    const result = sorted.map((emp) => ({
      empId: emp.EmpID,
      name: emp.EmployeeName,
      birthday: emp.Birthday, // "21/06"
    }));

    res.json(result);
  } catch (err) {
    console.error("Error fetching birthdays by month:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
