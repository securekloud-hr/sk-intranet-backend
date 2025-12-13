const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const SkillMailLog = require("../models/SkillMailLog");

module.exports = async function (req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { name, email, message, type } = req.body;

  if (!name || !email || !message || !type) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const safeType = (type || "").toString().trim().toLowerCase();

    // ✅ L&D types that should go into SkillMailLog (same schema)
    const isLearningMail = ["ld-skill", "ld-certification"].includes(safeType);

    // Gmail SMTP transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Decide recipient
    let recipient = process.env.DEFAULT_RECIPIENT;

    if (safeType === "hr" || safeType === "query") {
      recipient = process.env.HR_EMAIL;
    } else if (safeType === "it" || safeType === "ticket") {
      recipient = process.env.IT_EMAIL;
    } else if (safeType === "payroll") {
      recipient = process.env.FINANCE_EMAIL;
    } else if (isLearningMail) {
      recipient = process.env.HR_EMAIL;
      // OR recipient = process.env.LD_EMAIL if you have a separate email
    }

    // ✅ Generate PDF
    const timestamp = Date.now();
    const pdfFileName = `query_${timestamp}.pdf`;
    const pdfPath = path.join(__dirname, pdfFileName);

    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(pdfPath));

    doc.fontSize(18).text(`New ${safeType.toUpperCase()} Request`, {
      align: "center",
    });
    doc.moveDown();
    doc.fontSize(12).text(`Name: ${name}`);
    doc.text(`Email: ${email}`);
    doc.text(`Type: ${safeType}`);
    doc.moveDown();
    doc.text(`Message: ${message}`, { align: "left" });
    doc.end();

    const subject = `New ${safeType.toUpperCase()} Request from ${name}`;

    // ✅ Save BOTH skills + certifications into same SkillMailLog schema
    if (isLearningMail) {
      await SkillMailLog.create({
        name,
        email,
        subject,
        message,
        type: safeType,
      });
    }

    // Send mail
    await transporter.sendMail({
      from: `"${name}" <${process.env.EMAIL_USER}>`,
      to: recipient,
      subject,
      text: `
Name: ${name}
Email: ${email}
Type: ${safeType}
Message: ${message}
      `,
      attachments: [
        {
          filename: pdfFileName,
          path: pdfPath,
          contentType: "application/pdf",
        },
      ],
    });

    return res
      .status(200)
      .json({ success: true, message: "Email sent successfully with PDF!" });
  } catch (error) {
    console.error("Email error:", error);
    return res.status(500).json({ error: "Failed to send email" });
  }
};
