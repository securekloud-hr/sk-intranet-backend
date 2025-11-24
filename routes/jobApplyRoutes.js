// backend/routes/jobApplyRoutes.js
const express = require("express");
const nodemailer = require("nodemailer");

const router = express.Router();

// ---------------- Gmail Transporter ----------------
const mailTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,  // e.g. mukundchinnam18@gmail.com
    pass: process.env.EMAIL_PASS,  // Gmail app password
  },
});

// ---------------- Apply Job Route ----------------
// POST /api/jobs/apply
router.post("/apply", async (req, res) => {
  try {
    const {
      jobId,
      jobTitle,
      department,
      location,
      userName,
      userEmail,
      message,
    } = req.body || {};

    if (!jobTitle || !userName || !userEmail) {
      return res
        .status(400)
        .json({ success: false, error: "Missing required fields" });
    }

    const html = `
      <h2>Internal Job Application</h2>
      <p><strong>Candidate:</strong> ${userName}</p>
      <p><strong>Email:</strong> ${userEmail}</p>
      <hr/>
      <p><strong>Job Title:</strong> ${jobTitle}</p>
      ${jobId ? `<p><strong>Job ID:</strong> ${jobId}</p>` : ""}
      ${department ? `<p><strong>Department:</strong> ${department}</p>` : ""}
      ${location ? `<p><strong>Location:</strong> ${location}</p>` : ""}
      <hr/>
      ${
        message && message.trim()
          ? `<p><strong>Message:</strong><br>${message}</p>`
          : "<em>No additional comments provided.</em>"
      }
    `;

    const result = await mailTransporter.sendMail({
      from: `"SecureKloud Intranet" <${process.env.EMAIL_USER}>`,
      to: process.env.TA_EMAIL || process.env.DEFAULT_RECIPIENT, // TA mail
      cc: userEmail,                                             // copy to applicant
      subject: `Internal Job Application – ${jobTitle} – ${userName}`,
      html,
    });

    return res.json({ success: true, messageId: result.messageId });
  } catch (err) {
    console.error("❌ Job Application Email Error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
