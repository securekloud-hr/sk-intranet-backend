// routes/profileRoutes.js
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const Employee = require("../models/EmployeeDirectory");

const router = express.Router();

/**
 * ✅ Save into FRONTEND public folder
 * Windows:
 * F:\Securekloud Intranet\sk-intranet-frontend\public
 *
 * EC2 example:
 * /home/ubuntu/sk-intranet-frontend/public
 *
 * Set in .env:
 * FRONTEND_PUBLIC_DIR=F:\Securekloud Intranet\sk-intranet-frontend\public
 */
const FRONTEND_PUBLIC_DIR =
  process.env.FRONTEND_PUBLIC_DIR ||
  String.raw`F:\Securekloud Intranet\sk-intranet-frontend\public`;

const uploadDir = path.join(FRONTEND_PUBLIC_DIR, "employee-images");

// ✅ Create folder if missing
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ==============================
// 📦 Multer Storage
// ==============================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const empId = (req.body.empId || "").trim();
    const employeeName = (req.body.employeeName || "").trim();

    if (!empId || !employeeName) {
      return cb(
        new Error("empId and employeeName are required for profile image upload"),
        ""
      );
    }

    // Keep spaces, normalize extra spaces
    const cleanName = employeeName.replace(/\s+/g, " ");

    const ext = path.extname(file.originalname) || ".jpg";
    const finalName = `${empId}-${cleanName}${ext}`;

    console.log("📸 Saving profile image as:", finalName);

    cb(null, finalName);
  },
});

const upload = multer({ storage });

/**
 * ==============================
 * 📤 POST /api/profile/upload
 * FormData:
 * - avatar (file)
 * - empId
 * - employeeName
 * ==============================
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
        return res.status(400).json({
          success: false,
          error: "No file uploaded",
        });
      }

      const empId = (req.body.empId || "").trim();

      const avatarUrl = `/employee-images/${req.file.filename}`;

      console.log("✅ Profile Image Saved:", req.file.filename);
      console.log("📁 Location:", path.join(uploadDir, req.file.filename));

      // ✅ Update EmployeeDirectory using EmpID
      if (empId) {
        const result = await Employee.updateOne(
          { EmpID: empId },
          { $set: { ProfileImage: avatarUrl } }
        );

        console.log(
          "🧩 EmployeeDirectory update:",
          result.matchedCount,
          "matched"
        );
      }

      return res.json({
        success: true,
        avatarUrl,
      });
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
