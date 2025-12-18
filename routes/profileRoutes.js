// routes/profileRoutes.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const Employee = require("../models/EmployeeDirectory");

const router = express.Router();

/**
 * ✅ Save into FRONTEND public folder (Windows)
 * F:\Securekloud Intranet\sk-intranet-frontend\public\profile-images
 *
 * Best practice: use env var so you can change per machine (Windows/EC2)
 * Set in .env:
 * FRONTEND_PUBLIC_DIR=F:\Securekloud Intranet\sk-intranet-frontend\public
 */
const FRONTEND_PUBLIC_DIR =
  process.env.FRONTEND_PUBLIC_DIR ||
  String.raw`F:\Securekloud Intranet\sk-intranet-frontend\public`;

const uploadDir = path.join(FRONTEND_PUBLIC_DIR, "emp-images");

// Create folder if missing
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ⭐ Multer Storage (each user gets separate file using email)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const email = (req.body.email || "").trim().toLowerCase();

    if (!email) {
      return cb(new Error("Missing email for profile image upload"), "");
    }

    const safeEmail = email.replace(/[^a-zA-Z0-9@._-]/g, "_");
    const ext = path.extname(file.originalname) || ".png";

    console.log("📸 Saving profile image for:", email, "as", `${safeEmail}${ext}`);
    cb(null, `${safeEmail}${ext}`);
  },
});

const upload = multer({ storage });

/**
 * ✅ POST /api/profile/upload
 * FormData:
 * - avatar: file
 * - email: string
 */
router.post("/upload", (req, res) => {
  upload.single("avatar")(req, res, async (err) => {
    if (err) {
      console.error("❌ Multer error:", err);
      return res.status(400).json({
        success: false,
        error: err.message || "Upload error",
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: "No file uploaded" });
      }

      const email = (req.body.email || "").trim().toLowerCase();

      /**
       * ✅ IMPORTANT:
       * Since the file is inside FRONTEND public folder,
       * the URL should be relative and served by the frontend:
       */
      const avatarUrl = `/emp-images/${req.file.filename}`;

      console.log("✅ Profile Image Saved →", req.file.filename, "for email:", email);
      console.log("📁 Saved at:", path.join(uploadDir, req.file.filename));

      // ✅ Update EmployeeDirectory record
      if (email) {
        const result = await Employee.updateOne(
          {
            $or: [
              { Email: { $regex: new RegExp(`^${email}$`, "i") } },
              { OfficialEmail: { $regex: new RegExp(`^${email}$`, "i") } },
            ],
          },
          { $set: { ProfileImage: avatarUrl } }
        );

        console.log("🧩 EmployeeDirectory ProfileImage update:", result?.matchedCount, "matched");
      }

      return res.json({ success: true, avatarUrl });
    } catch (e) {
      console.error("❌ Upload failure:", e);
      return res.status(500).json({
        success: false,
        error: "Upload failed, please try again",
      });
    }
  });
});

module.exports = router;
