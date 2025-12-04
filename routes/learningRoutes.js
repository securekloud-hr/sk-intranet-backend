// routes/learningRoutes.js
const express = require("express");
const router = express.Router();
const Employee = require("../models/EmployeeDirectory");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");

// Mail transporter
const skillMailTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// helper: send mail to HR + user
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

// ONE route for primary/secondary/certification
router.post("/add-skill", async (req, res) => {
  try {
    const { empId, kind, value, userName, userEmail } = req.body;

    if (!empId || !kind || !value || !userEmail) {
      return res.status(400).json({ success: false, message: "Missing data" });
    }

    const normalisedKind = kind.toLowerCase();

    let field;
    if (normalisedKind === "primary") field = "primarySkills";
    else if (normalisedKind === "secondary") field = "secondarySkills";
    else if (normalisedKind === "certification") field = "certifications";
    else return res.status(400).json({ success: false, message: "Invalid type" });

    await Employee.findOneAndUpdate(
      { EmpID: empId },
      { $addToSet: { [field]: value } },
      { new: true }
    );

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

// =======================
// MongoDB: skills_definition
// =======================
const SkillDefinition = mongoose.model(
  "SkillDefinition",
  new mongoose.Schema(
    {
      Type: String,     // "Certification" | "Skill"
      Provider: String, // e.g. "AWS", "Java"
      Tech: String,     // e.g. "Cloud Practitioner", "Script"
    },
    { collection: "skills_definition" }
  )
);

// 1️⃣ Certification Providers
router.get("/certification-providers", async (req, res) => {
  try {
    let providers = await SkillDefinition
      .find({ Type: "Certification" })
      .distinct("Provider");

    providers = [...new Set(providers.map((p) => p.trim()))].sort();
    res.json({ success: true, data: providers });
  } catch (err) {
    console.error("Provider Fetch Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 2️⃣ Certificates under provider
router.get("/certificates/:provider", async (req, res) => {
  try {
    const provider = req.params.provider.trim();
    const certificates = await SkillDefinition
      .find({ Type: "Certification", Provider: provider })
      .distinct("Tech");

    res.json({ success: true, data: certificates });
  } catch (err) {
    console.error("Certificate Fetch Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 3️⃣ Skill Providers (for primary + secondary)
router.get("/skill-providers", async (req, res) => {
  try {
    let providers = await SkillDefinition
      .find({ Type: "Skill" })
      .distinct("Provider"); // "Java", "MS", etc.

    providers = [...new Set(providers.map((p) => p.trim()))].sort();

    res.json({ success: true, data: providers });
  } catch (err) {
    console.error("Skill Provider Fetch Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 4️⃣ Skill list (Tech) under a provider
router.get("/skill-list/:provider", async (req, res) => {
  try {
    const provider = req.params.provider.trim();

    let skills = await SkillDefinition
      .find({ Type: "Skill", Provider: provider })
      .distinct("Tech"); // "Script", "Springboot", etc.

    skills = [...new Set(skills.map((s) => s.trim()))].sort();

    res.json({ success: true, data: skills });
  } catch (err) {
    console.error("Skill Fetch Error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
