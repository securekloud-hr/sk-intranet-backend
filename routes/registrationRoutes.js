const express = require("express");
const nodemailer = require("nodemailer");
const Registration = require("../models/Registration");
const Employee = require("../models/EmployeeDirectory"); // ✅ NEW: to fetch EmpID

require("dotenv").config();

const router = express.Router();

/**
 * ---------------------------------------------------------------------------
 * POST /api/registerEvent/register
 * Register for an event (one registration per user+event)
 * ---------------------------------------------------------------------------
 */
router.post("/register", async (req, res) => {
  try {
    const { user, email, userName, userEmail, eventId, eventName } = req.body;

    // ✅ Support both key styles (old + new)
    const finalName = userName || user;
    const finalEmail = userEmail || email;

    if (!finalName || !finalEmail || !eventId || !eventName) {
      return res
        .status(400)
        .json({ success: false, error: "Missing fields" });
    }

    // 🔒 Check if this user is already registered for this event
    const existing = await Registration.findOne({
      eventId,
      email: finalEmail,
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Already registered for this event",
      });
    }

    // ✅ Look up EmpID from Employee Directory using email
    let empId = null;
    try {
      const emp = await Employee.findOne({
        $or: [
          { OfficialEmail: finalEmail },
          { Email: finalEmail },
          { PersonalEmailID: finalEmail },
        ],
      });

      if (emp) {
        empId = emp.EmpID || null;
      }
    } catch (lookupErr) {
      console.error("⚠️ Employee lookup failed:", lookupErr.message);
      // continue even if lookup fails
    }

    // ✅ Save registration in DB (with empId)
    const newReg = await Registration.create({
      user: finalName,
      email: finalEmail,
      empId, // 👈 stored here
      eventId,
      eventName,
    });

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
      <p><strong>User:</strong> ${finalName}</p>
      <p><strong>Emp ID:</strong> ${empId || "N/A"}</p>
      <p><strong>Email:</strong> ${finalEmail}</p>
      <p><strong>Event:</strong> ${eventName}</p>
      <p><strong>Event ID:</strong> ${eventId}</p>
      <hr>
      <small>This notification was sent automatically from SecureKloud Intranet.</small>
    `;

    await transporter.sendMail({
      from: `"SecureKloud Intranet" <${process.env.EMAIL_USER}>`,
      to: process.env.HR_EMAIL, // HR / organiser
      cc: finalEmail, // 👈 copy to user
      subject: `Event Registration: ${eventName}`,
      html,
    });

    res.json({
      success: true,
      message:
        "Registration successful. Email sent to HR and copied to user.",
      data: newReg,
    });
  } catch (err) {
    // Catch duplicate key error as extra safety (if unique index is added)
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Already registered for this event",
      });
    }

    console.error("❌ Registration Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * ---------------------------------------------------------------------------
 * GET /api/registerEvent/event/:eventId
 * Get all registrations for a specific event
 * ---------------------------------------------------------------------------
 */
router.get("/event/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;

    const regs = await Registration.find({ eventId }).sort({
      registeredAt: -1,
    });

    res.json({
      success: true,
      count: regs.length,
      data: regs, // 🔙 now includes empId for each registration
    });
  } catch (err) {
    console.error("❌ Fetch registrations error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * ---------------------------------------------------------------------------
 * GET /api/registerEvent/user/:email
 * Get all registrations for a specific user (by email)
 *   – used by frontend to disable Register button
 * ---------------------------------------------------------------------------
 */
router.get("/user/:email", async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email || "");

    const regs = await Registration.find({ email }).sort({
      registeredAt: -1,
    });

    res.json({
      success: true,
      count: regs.length,
      data: regs,
    });
  } catch (err) {
    console.error("❌ Fetch user registrations error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
