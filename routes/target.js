const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    const target = await mongoose
      .connection
      .collection("target")
      .findOne({ category: "Target" });

    res.json({
      success: true,
      data: target,
    });
  } catch (err) {
    console.error("❌ Target fetch error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
