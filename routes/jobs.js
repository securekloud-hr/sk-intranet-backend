// backend/routes/jobs.js
const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const Job = require("../models/Job");

const router = express.Router();

// Use memory storage (no need for uploads/ folder)
const upload = multer({ storage: multer.memoryStorage() });

// POST /api/jobs/upload
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded (field name must be 'file')" });
    }

    // Parse workbook from buffer
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return res.status(400).json({ success: false, error: "No sheets found in workbook" });

    const sheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // Map rows to match your Excel headers
    const jobs = (sheet || []).map((row, idx) => ({
      id: row["Job ID"]?.toString() || `row-${Date.now()}-${idx}`,
      title: row["Role"] || "",
      department: "", // Not in Excel, keep empty or add manually
      location: row["Work Location"] || "",
      type: row["Hiring Type"] || "",
      experience: row["Experience"] || "",
      postedDate: new Date().toISOString().split("T")[0], // Excel doesn’t have this → default today
      description: row["Responsibilities"] || "",
      requirements: row["Mandatory Skills"]
        ? row["Mandatory Skills"].split(",").map((s) => s.trim())
        : [],
      priority: "standard", // Excel doesn’t have this → default
      bonus: 0, // Excel doesn’t have this → default
    }));

    if (jobs.length === 0) {
      return res.status(400).json({ success: false, error: "No job rows found in sheet" });
    }

    // Optional: clear old jobs first
    // await Job.deleteMany({});

    // Clear all old jobs before saving new ones
await Job.deleteMany({});
await Job.insertMany(jobs);

    console.log(`✅ Uploaded ${jobs.length} jobs`);
    res.json({ success: true, count: jobs.length });
  } catch (err) {
    console.error("Error uploading jobs:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/jobs
router.get("/", async (req, res) => {
  try {
    const jobs = await Job.find().sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) {
    console.error("Error fetching jobs:", err);
    res.status(500).json({ error: "Server error fetching jobs" });
  }
});

module.exports = router;
