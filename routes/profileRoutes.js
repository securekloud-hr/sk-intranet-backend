// routes/profileRoutes.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// Folder: backend/public/profile-images
const uploadDir = path.join(__dirname, "..", "public", "profile-images");

// make sure folder exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // name file using user email
    const rawEmail = req.body.email || "user";
    const safeEmail = rawEmail.replace(/[^a-zA-Z0-9@._-]/g, "_");
    const ext = path.extname(file.originalname);
    cb(null, `${safeEmail}${ext}`);
  },
});

const upload = multer({ storage });

// POST /api/profile/upload
router.post("/upload", upload.single("avatar"), (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "No file uploaded" });
    }

    // Build full URL like http://localhost:8000/profile-images/xxx.jpg
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const avatarUrl = `${baseUrl}/profile-images/${req.file.filename}`;

    return res.json({ success: true, avatarUrl });
  } catch (err) {
    console.error("Profile image upload error:", err);
    return res
      .status(500)
      .json({ success: false, error: "Upload failed, please try again" });
  }
});

module.exports = router;
