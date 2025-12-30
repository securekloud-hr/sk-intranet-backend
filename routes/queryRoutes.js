const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

/**
 * GET /api/queries?email=user@company.com
 * Returns ONLY queries created by this user
 */
router.get("/", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const Query = mongoose.models.Query;
    if (!Query) {
      return res
        .status(500)
        .json({ error: "Query model not registered" });
    }

    const queries = await Query.find({
      email: email.toLowerCase(),
    })
      .sort({ timestamp: -1 })
      .select("_id type subject message status timestamp"); // ✅ FIXED

    res.json({
      success: true,
      data: queries,
    });
  } catch (err) {
    console.error("❌ Fetch queries error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
