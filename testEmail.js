require('dotenv').config();
const nodemailer = require('nodemailer');

async function main() {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.office365.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.OUTLOOK_USER,
        pass: process.env.OUTLOOK_PASS
      }
    });

    const info = await transporter.sendMail({
      from: `"Test" <${process.env.OUTLOOK_USER}>`,
      to: process.env.DEFAULT_RECIPIENT || process.env.OUTLOOK_USER,
      subject: "Outlook SMTP Test",
      text: "If you get this, SMTP is working!"
    });

    console.log("✅ Email sent:", info.messageId);
  } catch (err) {
    console.error("❌ Error sending email:", err);
  }
}

main();
