const express = require("express");
const multer = require("multer");
const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");
const Referral = require("../models/Referral");

const router = express.Router();

// Ensure uploads/referrals folder exists
const uploadDir = path.join(__dirname, "../uploads/referrals");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config for resume upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// Nodemailer transporter (using Gmail in .env)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// POST /api/referral
router.post("/", upload.single("resume"), async (req, res) => {
  try {
    const { candidateName, email, phone, position, notes } = req.body;

    // Save to DB
    const referral = new Referral({
      candidateName,
      email,
      phone,
      position,
      notes,
      resumePath: req.file ? `uploads/referrals/${req.file.filename}` : null,
    });

    await referral.save();

    // Email details
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.TA_EMAIL || process.env.DEFAULT_RECIPIENT,
      subject: `New Referral: ${candidateName}`,
      text: `
A new referral has been submitted.

Candidate Name: ${candidateName}
Email: ${email}
Phone: ${phone}
Position: ${position}
Notes: ${notes || "N/A"}
      `,
      attachments: req.file
        ? [
            {
              filename: req.file.originalname,
              path: path.join(uploadDir, req.file.filename),
            },
          ]
        : [],
    };

    // Send email
    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: "Referral submitted successfully" });
  } catch (error) {
    console.error("❌ Error submitting referral:", error);
    res.status(500).json({ error: "Failed to submit referral" });
  }
});

module.exports = router;
