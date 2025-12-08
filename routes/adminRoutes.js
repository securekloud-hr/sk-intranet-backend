const express = require("express");
const router = express.Router();

const path = require("path");
const fs = require("fs");
const multer = require("multer");

const Announcement = require("../models/Announcement");
const Event = require("../models/Event");

// ========== Multer setup for announcement images ==========

const ANNOUNCEMENTS_DIR = path.join(__dirname, "../public/announcements");

// ensure folder exists
if (!fs.existsSync(ANNOUNCEMENTS_DIR)) {
  fs.mkdirSync(ANNOUNCEMENTS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, ANNOUNCEMENTS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/\s+/g, "-");
    cb(null, `${base}-${Date.now()}${ext}`);
  },
});

const upload = multer({ storage });

// ===================== ANNOUNCEMENTS =====================

// Fetch all
router.get("/announcements", async (req, res) => {
  try {
    const announcements = await Announcement.find().sort({ createdAt: -1 });
    res.json(announcements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create (with optional image)
router.post(
  "/announcements",
  upload.single("image"), // 👈 field name "image"
  async (req, res) => {
    try {
      const { title, content } = req.body;

      const imageUrl = req.file
        ? `/announcements/${req.file.filename}` // served from /public
        : null;

      const newAnnouncement = new Announcement({
        title,
        content,
        imageUrl,
      });

      await newAnnouncement.save();
      res.json(newAnnouncement);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Update (text only for now)
router.put("/announcements/:id", async (req, res) => {
  try {
    const updated = await Announcement.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete
router.delete("/announcements/:id", async (req, res) => {
  try {
    await Announcement.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===================== EVENTS =====================

// Fetch all
router.get("/events", async (req, res) => {
  try {
    const events = await Event.find().sort({ date: 1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create
router.post("/events", async (req, res) => {
  try {
    const { title, date, type, description, registrationOpen } = req.body;

    if (!title || !date || !type) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const newEvent = new Event({
      title,
      date,
      type,
      description: description || "",
      registrationOpen: registrationOpen || false,
    });

    await newEvent.save();
    res.json(newEvent);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// Update
router.put("/events/:id", async (req, res) => {
  try {
    const updated = await Event.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete
router.delete("/events/:id", async (req, res) => {
  try {
    await Event.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
