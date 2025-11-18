const nodemailer = require("nodemailer");
require("dotenv").config();

module.exports = async function (req, res) {
  try {
    const { title, instructor, duration, category, user } = req.body;

    if (!title || !instructor || !duration || !category || !user) {
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
      <h2>New Course Added</h2>
      <p><strong>User:</strong> ${user}</p>
      <p><strong>Title:</strong> ${title}</p>
      <p><strong>Instructor:</strong> ${instructor}</p>
      <p><strong>Duration:</strong> ${duration}</p>
      <p><strong>Category:</strong> ${category}</p>
      <hr>
      <small>This notification was sent automatically from SecureKloud Intranet.</small>
    `;

    await transporter.sendMail({
      from: `"SecureKloud Intranet" <${process.env.EMAIL_USER}>`,
      to: process.env.HR_EMAIL,
      subject: `📚 New Course Added by ${user}`,
      html,
    });

    res.json({ success: true, message: "Course notification sent" });
  } catch (err) {
    console.error("❌ Course Notification Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};

