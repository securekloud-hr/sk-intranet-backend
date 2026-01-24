const express = require("express");
const router = express.Router();
const Sales = require("../models/Sales");

/* ================= SAVE SALES ================= */
router.post("/", async (req, res) => {
  try {
    const {
      empId,
      employeeName,
      date,
    } = req.body;

    if (!empId || !employeeName || !date) {
      return res.status(400).json({
        success: false,
        message: "EmpID, EmployeeName and Date are required",
      });
    }

    const sales = new Sales(req.body);
    await sales.save();

    res.status(201).json({
      success: true,
      message: "Sales data saved successfully",
      data: sales,
    });
  } catch (err) {
    console.error("Sales Save Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ================= GET SALES ================= */
router.get("/", async (req, res) => {
  try {
    const sales = await Sales.find().sort({ date: -1 });
    res.json(sales);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
