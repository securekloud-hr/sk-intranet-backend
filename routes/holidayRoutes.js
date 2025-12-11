// backend/routes/holidayRoutes.js
const express = require("express");
const multer = require("multer");
const {
  ingestFromPdf,
  listByYear,
  listYears, // 👈 make sure this is imported
} = require("../controllers/holidayIngestController");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.post("/ingest-pdf", /* requireAdmin, */ upload.single("file"), ingestFromPdf);
router.get("/", listByYear);
router.get("/years", listYears); // 👈 dynamic year list

module.exports = router;
