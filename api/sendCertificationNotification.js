const nodemailer = require("nodemailer");
require("dotenv").config();

module.exports = async function (req, res) {
  try {
    const { certification, provider, user } = req.body;

    if (!certification || !provider || !user) {
      return res.status(400).json({ success: false, error: "Missing fields" });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const html = `
      <h2>New Certification Added</h2>
      <p><strong>User:</strong> ${user}</p>
      <p><strong>Certification:</strong> ${certification}</p>
      <p><strong>Provider:</strong> ${provider}</p>
      <hr>
      <small>This notification was sent automatically from SecureKloud Intranet.</small>
    `;

    await transporter.sendMail({
      from: `"SecureKloud Intranet" <${process.env.EMAIL_USER}>`,
      to: process.env.HR_EMAIL,
      subject: `New Certification Added by ${user}`,
      html,
    });

    res.json({ success: true, message: "Certification notification sent" });
  } catch (err) {
    console.error("❌ Certification Notification Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};
