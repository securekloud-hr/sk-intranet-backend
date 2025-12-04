// routes/profileRoutes.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// Folder: backend/public/profile-images
const uploadDir = path.join(__dirname, "..", "public", "profile-images");

// Create folder if missing
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ⭐ Multer Storage (each user gets separate file using email)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const email = (req.body.email || "").trim().toLowerCase();

    // ❌ Prevent same-name file like "user.png"
    if (!email) {
      return cb(new Error("Missing email for profile image upload"), "");
    }

    // Make email safe for filename
    const safeEmail = email.replace(/[^a-zA-Z0-9@._-]/g, "_");
    const ext = path.extname(file.originalname) || ".png";

    console.log("📸 Saving profile image for:", email, "as", `${safeEmail}${ext}`);

    // Final filename → each user gets their own file
    cb(null, `${safeEmail}${ext}`);
  },
});

const upload = multer({ storage });

// ⭐ POST /api/profile/upload
router.post("/upload", (req, res) => {
  upload.single("avatar")(req, res, (err) => {
    if (err) {
      console.error("❌ Multer error:", err);
      return res.status(400).json({
        success: false,
        error: err.message || "Upload error",
      });
    }

    try {
      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, error: "No file uploaded" });
      }

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const avatarUrl = `${baseUrl}/profile-images/${req.file.filename}`;

      console.log(
        "✅ Profile Image Saved →",
        req.file.filename,
        "for email:",
        req.body.email
      );

      return res.json({
        success: true,
        avatarUrl,
      });
    } catch (err) {
      console.error("❌ Upload failure:", err);
      return res.status(500).json({
        success: false,
        error: "Upload failed, please try again",
      });
    }
  });
});

module.exports = router;
