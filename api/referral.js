// F:\Securekloud Intranet\sk-intranet-backend\api\referral.js

const express = require("express");
const nodemailer = require("nodemailer");
const multer = require("multer");
require("dotenv").config();

console.log("✅ referral.js loaded (NO mongoose, v2)");

const router = express.Router();

// --- Multer: store resume in memory for attachments ---
const upload = multer({ storage: multer.memoryStorage() });

// --- Gmail transporter (same as HR / IT mail setup) ---
const mailTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // your Gmail
    pass: process.env.EMAIL_PASS, // app password
  },
});

// POST /api/referral
router.post("/", upload.single("resume"), async (req, res) => {
  try {
    console.log("📥 /api/referral body:", req.body);
    console.log("📎 /api/referral file:", req.file && req.file.originalname);

    const {
      candidateName,
      candidateEmail,
      email, // in case frontend sends `email` instead of `candidateEmail`
      phone,
      position,
      notes,
      referrerName,
      referrerEmail,
    } = req.body || {};

    // support both candidateEmail and email
    const finalCandidateEmail = candidateEmail || email;

    // 🔒 Basic validation
    if (!candidateName || !finalCandidateEmail || !phone || !position) {
      console.error("❌ Missing candidate details", {
        candidateName,
        finalCandidateEmail,
        phone,
        position,
      });
      return res
        .status(400)
        .json({ success: false, error: "Missing candidate details" });
    }

    if (!referrerName || !referrerEmail) {
      console.error("❌ Missing referrer details", {
        referrerName,
        referrerEmail,
      });
      return res
        .status(400)
        .json({ success: false, error: "Missing referrer details" });
    }

    // 💌 Email HTML
    const html = `
      <h2>New Employee Referral</h2>

      <h3>Referred By</h3>
      <p><strong>Name:</strong> ${referrerName}</p>
      <p><strong>Email:</strong> ${referrerEmail}</p>

      <h3>Candidate Details</h3>
      <p><strong>Name:</strong> ${candidateName}</p>
      <p><strong>Email:</strong> ${finalCandidateEmail}</p>
      <p><strong>Phone:</strong> ${phone}</p>
      <p><strong>Position Referred For:</strong> ${position}</p>

      <h3>Additional Notes</h3>
      <p>${notes && notes.trim ? notes.trim() : notes || "N/A"}</p>

      ${
        req.file
          ? `<p><em>Resume attached: ${req.file.originalname}</em></p>`
          : "<p><em>No resume attached.</em></p>"
      }
    `;

    const mailOptions = {
      from: `"SecureKloud Referrals" <${process.env.EMAIL_USER}>`,
      to: process.env.TA_EMAIL || process.env.DEFAULT_RECIPIENT, // TA team
      cc: referrerEmail, // ✅ copy to the employee
      subject: `Referral – ${candidateName} for ${position}`,
      html,
      attachments: req.file
        ? [
            {
              filename: req.file.originalname,
              content: req.file.buffer,
            },
          ]
        : [],
    };

    console.log("📤 Sending referral mail:", {
      to: mailOptions.to,
      cc: mailOptions.cc,
      subject: mailOptions.subject,
    });

    const result = await mailTransporter.sendMail(mailOptions);

    return res.json({
      success: true,
      messageId: result.messageId,
    });
  } catch (err) {
    console.error("❌ Referral Email Error:", err);
    return res
      .status(500)
      .json({ success: false, error: err.message || "Internal error" });
  }
});

module.exports = router;

