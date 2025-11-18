const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const Registration = require("../models/Registration");  // ✅ use model
require("dotenv").config();

router.post("/register", async (req, res) => {
  try {
    const { eventId, eventName, user, email } = req.body;

    if (!eventId || !eventName || !user || !email) {
      return res.status(400).json({ success: false, error: "Missing fields" });
    }

    // Save in MongoDB
    const newReg = new Registration({ eventId, eventName, user, email });
    await newReg.save();

    // Email setup
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"SecureKloud Intranet" <${process.env.EMAIL_USER}>`,
      to: process.env.HR_EMAIL,
      subject: `New Event Registration: ${eventName}`,
      html: `
        <h2>Event Registration</h2>
        <p><strong>User:</strong> ${user}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Event:</strong> ${eventName}</p>
        <p>Registered on: ${new Date().toLocaleString()}</p>
      `,
    });

    res.json({ success: true, message: "Registered and email sent" });
  } catch (err) {
    console.error("❌ Event Registration Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
