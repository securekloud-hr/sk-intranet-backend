const express = require("express");
const router = express.Router();
const Sales = require("../models/Sales");

/* ================= CREATE OR UPDATE SALES ================= */
router.post("/", async (req, res) => {
  try {
    const { empId, date } = req.body;

    if (!empId || !date) {
      return res.status(400).json({ message: "empId and date required" });
    }

    // 🔴 Normalize date (strip time)
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    const sales = await Sales.findOneAndUpdate(
      { empId, date: normalizedDate }, // match
      {
        ...req.body,
        date: normalizedDate, // store normalized date
      },
      {
        new: true,
        upsert: true, // 🔥 create OR update
        runValidators: true,
      }
    );

    return res.json({
      success: true,
      data: sales,
    });
  } catch (err) {
    console.error("❌ Sales Save Error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ================= GET SALES ================= */
router.get("/", async (_req, res) => {
  try {
    const sales = await Sales.find().sort({ date: -1 });
    res.json(sales);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= TOP 5 PERFORMERS (ALL DATA) ================= */
router.get("/top5", async (req, res) => {
  try {
    const top5 = await Sales.aggregate([
      {
        $group: {
          _id: "$empId",
          employeeName: { $first: "$employeeName" },

          calls: { $sum: "$callsMade" },
          emails: { $sum: "$emailsOutgoing" },
          netNew: { $sum: "$netNewMeeting" },
          followUp: { $sum: "$followUpMeeting" },
          qualified: { $sum: "$qualifiedMeeting" },
          proposals: { $sum: "$proposals" },
          deals: { $sum: "$dealWon" }
        }
      },
      {
        $sort: {
          deals: -1,
          qualified: -1,
          calls: -1
        }
      },
      { $limit: 5 }
    ]);

    res.json({
      success: true,
      data: top5
    });
  } catch (err) {
    console.error("❌ Top 5 Error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
