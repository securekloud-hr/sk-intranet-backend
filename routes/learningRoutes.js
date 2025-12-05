// routes/learningRoutes.js
const express = require("express");
const router = express.Router();
const Employee = require("../models/EmployeeDirectory");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");

// =======================
// Mail transporter
// =======================
const skillMailTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// =======================
// Helper: send mail to HR + user
// =======================
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

// =======================
// POST: Add primary / secondary / certification
// =======================
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
    else
      return res.status(400).json({ success: false, message: "Invalid type" });

    await Employee.findOneAndUpdate(
      { EmpID: empId },
      { $addToSet: { [field]: value } },
      { new: true }
    );

    // fire & forget email (no await, so response is fast)
    sendSkillMail({
      userName: userName || "Unknown User",
      userEmail,
      kind: normalisedKind,
      value,
    }).catch((err) => console.error("Skill mail error:", err));

    return res.json({ success: true });
  } catch (err) {
    console.error("add-skill error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error" });
  }
});

// =======================
// MongoDB: skills_definition
// =======================
const SkillDefinition = mongoose.model(
  "SkillDefinition",
  new mongoose.Schema(
    {
      Type: String, // "Certification" | "Skill"
      Provider: String, // e.g. "AWS", "Java"
      Tech: String, // e.g. "Cloud Practitioner", "Script"
    },
    { collection: "skills_definition" }
  )
);

// =======================
// ONE GET route for all skill metadata
// =======================
// type:
//   - certification-providers
//   - certificates
//   - skill-providers
//   - skill-list
//
// For "certificates" and "skill-list", pass ?provider=AWS or ?provider=Java
//
// Examples:
//   /api/learning/skill-data?type=certification-providers
//   /api/learning/skill-data?type=certificates&provider=AWS
//   /api/learning/skill-data?type=skill-providers
//
router.get("/skill-data", async (req, res) => {
  try {
    const { type, provider } = req.query;

    if (!type) {
      return res.status(400).json({
        success: false,
        message:
          "Missing type. Allowed: certification-providers, certificates, skill-providers, skill-list",
      });
    }

    // helper to safely escape regex special chars
    const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    let result = [];

    switch (type) {
      case "certification-providers": {
        result = await SkillDefinition.find({ Type: "Certification" }).distinct(
          "Provider"
        );
        break;
      }

      case "certificates": {
        if (!provider) {
          return res
            .status(400)
            .json({ success: false, message: "provider is required" });
        }

        const cleanProvider = provider.trim();
        const providerRegex = new RegExp(
          `^\\s*${escapeRegExp(cleanProvider)}\\s*$`,
          "i"
        );

        result = await SkillDefinition.find({
          Type: "Certification",
          Provider: providerRegex,
        }).distinct("Tech");
        break;
      }

      case "skill-providers": {
        result = await SkillDefinition.find({ Type: "Skill" }).distinct(
          "Provider"
        );
        break;
      }

      case "skill-list": {
        if (!provider) {
          return res
            .status(400)
            .json({ success: false, message: "provider is required" });
        }

        const cleanProvider = provider.trim();
        const providerRegex = new RegExp(
          `^\\s*${escapeRegExp(cleanProvider)}\\s*$`,
          "i"
        );

        result = await SkillDefinition.find({
          Type: "Skill",
          Provider: providerRegex,
        }).distinct("Tech");
        break;
      }

      default:
        return res.status(400).json({
          success: false,
          message:
            "Invalid type. Allowed: certification-providers, certificates, skill-providers, skill-list",
        });
    }

    const cleaned = [
      ...new Set(
        (result || [])
          .filter((v) => typeof v === "string")
          .map((v) => v.trim())
          .filter((v) => v.length > 0)
      ),
    ].sort();

    return res.json({ success: true, data: cleaned });
  } catch (err) {
    console.error("SkillData Fetch Error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error" });
  }
});


module.exports = router;
