const express = require("express");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
const multer = require("multer");
require("dotenv").config();

const router = express.Router();

// Referral Schema
const referralSchema = new mongoose.Schema({
  candidateName: String,
  email: String,
  phone: String,
  position: String,
  notes: String,
  resume: String,
  createdAt: { type: Date, default: Date.now },
});

const Referral = mongoose.model("Referral", referralSchema);

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/referrals"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// POST /api/referral
router.post("/", upload.single("resume"), async (req, res) => {
  try {
    const { candidateName, email, phone, position, notes } = req.body;

    if (!candidateName || !email || !phone || !position) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    // Save in DB
    const referral = new Referral({
      candidateName,
      email,
      phone,
      position,
      notes,
      resume: req.file ? req.file.path : null,
    });
    await referral.save();

    // Send email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    const html = `
      <h2>New Referral Submission</h2>
      <p><strong>Name:</strong> ${candidateName}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Position:</strong> ${position}</p>
      <p><strong>Notes:</strong> ${notes || "N/A"}</p>
    `;

    await transporter.sendMail({
      from: `"Referral System" <${process.env.EMAIL_USER}>`,
      to: process.env.TA_EMAIL, // add in .env
      subject: `New Referral: ${candidateName}`,
      html,
      attachments: req.file
        ? [{ filename: req.file.originalname, path: req.file.path }]
        : [],
    });

    res.json({ success: true, message: "Referral submitted successfully" });
  } catch (err) {
    console.error("❌ Referral Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
