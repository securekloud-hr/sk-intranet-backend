// backend/routes/internalJobs.js
const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const InternalJob = require("../models/InternalJob");

const router = express.Router();

// Use memory storage
const upload = multer({ storage: multer.memoryStorage() });

// helper: Excel rows -> InternalJob docs
function buildJobsFromSheet(rows) {
  return rows.map((row, idx) => ({
    id: row["Job ID"]?.toString() || `row-${Date.now()}-${idx}`,
    title: row["Role"] || "",
    department: row["Department"] || "",
    location: row["Work Location"] || "",
    type: row["Hiring Type"] || "",
    experience: row["Experience"] || "",
    postedDate: row["Posted Date"]
      ? row["Posted Date"].toString()
      : new Date().toISOString().split("T")[0],
    description: row["Responsibilities"] || "",
    requirements: row["Mandatory Skills"]
      ? row["Mandatory Skills"].split(",").map((s) => s.trim())
      : [],
    priority: row["Priority"] || "standard",
    bonus: row["Bonus"] ? Number(row["Bonus"]) : 0,
  }));
}

// 🔹 Upload Internal Jobs Excel
// POST /api/internal-jobs/upload
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "No file uploaded (field name must be 'file')" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return res
        .status(400)
        .json({ success: false, error: "No sheets found in workbook" });
    }

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (!rows.length) {
      return res
        .status(400)
        .json({ success: false, error: "No rows found in sheet" });
    }

    const jobs = buildJobsFromSheet(rows);

    // Replace existing internal jobs
    await InternalJob.deleteMany({});
    await InternalJob.insertMany(jobs);

    console.log(`✅ Uploaded ${jobs.length} internal jobs`);
    res.json({ success: true, count: jobs.length });
  } catch (err) {
    console.error("Error uploading internal jobs:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🔹 Get Internal Jobs list
// GET /api/internal-jobs
router.get("/", async (req, res) => {
  try {
    const jobs = await InternalJob.find().sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) {
    console.error("Error fetching internal jobs:", err);
    res.status(500).json({ error: "Server error fetching internal jobs" });
  }
});

module.exports = router;
