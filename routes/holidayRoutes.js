// backend/routes/holidayRoutes.js
const express = require("express");
const multer = require("multer");
const { ingestFromPdf, listByYear } = require("../controllers/holidayIngestController");
// const { requireAdmin } = require("../middleware/auth"); // <- enable when you want admin-only

const router = express.Router();

// Use memory storage so we can read the PDF buffer directly in the controller
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// Upload a Holiday PDF, extract rows, save to MongoDB
// form-data: file=<pdf>, year=<YYYY> (optional but recommended), region=<IN|...>
router.post("/ingest-pdf", /* requireAdmin, */ upload.single("file"), ingestFromPdf);

// Fetch holidays for UI
// GET /api/holidays?year=2025&region=IN
router.get("/", listByYear);

module.exports = router;
