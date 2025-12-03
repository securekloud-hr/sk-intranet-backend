// routes/learningRoutes.js
const express = require("express");
const router = express.Router();
const Employee = require("../models/EmployeeDirectory"); // your model
const nodemailer = require("nodemailer");

// ✅ Mail transporter (same as your /api/sendEmail)
const skillMailTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// helper: send mail to HR + user copy
async function sendSkillMail({ userName, userEmail, kind, value }) {
  const hrTo = process.env.HR_EMAIL || process.env.DEFAULT_RECIPIENT;

  const subject = `[L&D] ${userName} added a ${kind} skill/certification`;
  const html = `
    <h2>New ${kind} update from ${userName}</h2>
    <p><strong>User:</strong> ${userName} (${userEmail})</p>
    <p><strong>Type:</strong> ${kind}</p>
    <p><strong>Value:</strong> ${value}</p>
  `;

  return skillMailTransporter.sendMail({
    from: `"SecureKloud Intranet" <${process.env.EMAIL_USER}>`,
    to: hrTo,
    cc: userEmail,
    subject,
    html,
  });
}

// 🔹 ONE route only – supports primary / secondary / certification
router.post("/add-skill", async (req, res) => {
  try {
    const { empId, kind, value, userName, userEmail } = req.body;

    // kind = "primary" | "secondary" | "certification"
    if (!empId || !kind || !value || !userEmail) {
      return res.status(400).json({ success: false, message: "Missing data" });
    }

    const normalisedKind = kind.toLowerCase(); // primary / secondary / certification

    // Map type → Mongo field name
    let field;
    if (normalisedKind === "primary") field = "primarySkills";
    else if (normalisedKind === "secondary") field = "secondarySkills";
    else if (normalisedKind === "certification") field = "certifications";
    else
      return res
        .status(400)
        .json({ success: false, message: "Invalid kind value" });

    // ✅ Update employee doc (avoid duplicates with $addToSet)
    await Employee.findOneAndUpdate(
      { EmpID: empId },
      { $addToSet: { [field]: value } },
      { new: true }
    );

    // ✅ Send email to HR + CC user (do NOT block response on error)
    sendSkillMail({
      userName: userName || "Unknown User",
      userEmail,
      kind: normalisedKind,
      value,
    }).catch((err) => console.error("Skill mail error:", err));

    return res.json({ success: true });
  } catch (err) {
    console.error("add-skill error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
