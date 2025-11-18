const express = require("express");
const nodemailer = require("nodemailer");
const Registration = require("../models/Registration");
require("dotenv").config();

const router = express.Router();

// Register for an event
router.post("/register", async (req, res) => {
  try {
    const { user, email, eventId, eventName } = req.body;

    if (!user || !email || !eventId || !eventName) {
      return res.status(400).json({ success: false, error: "Missing fields" });
    }

    // Save registration in DB
    const newReg = new Registration({ user, email, eventId, eventName });
    await newReg.save();

    // Send email notification
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const html = `
      <h2>New Event Registration</h2>
      <p><strong>User:</strong> ${user}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Event:</strong> ${eventName}</p>
      <p><strong>Event ID:</strong> ${eventId}</p>
      <hr>
      <small>This notification was sent automatically from SecureKloud Intranet.</small>
    `;

    await transporter.sendMail({
      from: `"SecureKloud Intranet" <${process.env.EMAIL_USER}>`,
      to: process.env.HR_EMAIL,  // or event organizer
      subject: `Event Registration: ${eventName}`,
      html,
    });

    res.json({ success: true, message: "Registration successful & email sent" });
  } catch (err) {
    console.error("❌ Registration Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
