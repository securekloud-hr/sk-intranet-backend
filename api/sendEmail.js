const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

module.exports = async function (req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { name, email, message, type } = req.body;

  if (!name || !email || !message || !type) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
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
    if (type === "hr" || type === "query") {
      recipient = process.env.HR_EMAIL;
    } else if (type === "it" || type === "ticket") {
      recipient = process.env.IT_EMAIL;
    } else if (type === "payroll") {
      recipient = process.env.FINANCE_EMAIL;
    }

    // ✅ Generate PDF for query
    const pdfPath = path.join(__dirname, `query_${Date.now()}.pdf`);
    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(pdfPath));

    doc.fontSize(18).text(`New ${type.toUpperCase()} Request`, { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Name: ${name}`);
    doc.text(`Email: ${email}`);
    doc.text(`Type: ${type}`);
    doc.moveDown();
    doc.text(`Message: ${message}`, { align: "left" });
    doc.end();

    // Send mail
    await transporter.sendMail({
      from: `"${name}" <${process.env.EMAIL_USER}>`,
      to: recipient,
      subject: `New ${type.toUpperCase()} Request from ${name}`,
      text: `
        Name: ${name}
        Email: ${email}
        Type: ${type}
        Message: ${message}
      `,
      attachments: [
        {
          filename: `query_${Date.now()}.pdf`,
          path: pdfPath,
          contentType: "application/pdf",
        },
      ],
    });

    res.status(200).json({ success: true, message: "Email sent successfully with PDF!" });
  } catch (error) {
    console.error("Email error:", error);
    res.status(500).json({ error: "Failed to send email" });
  }
};
