// server.js
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const SkillMailLog = require("./models/SkillMailLog");

// If your Node version < 18, uncomment this to polyfill fetch:
// const fetch = (...args) => import("node-fetch").then(({ default: f }) => f(...args));

// MSAL (for Graph On-Behalf-Of flow)
const { ConfidentialClientApplication } = require("@azure/msal-node");

// Import all routes
const sendCourseNotification = require("./api/sendCourseNotification");
const sendSkillNotification = require("./api/sendSkillNotification");
const sendCertificationNotification = require("./api/sendCertificationNotification");
const learningRoutes = require("./routes/learningRoutes");
const registrationRoutes = require("./routes/registrationRoutes");
//const registerEvent = require("./api/registerEvent");
const orgRoutes = require("./routes/org");
const jobsRoutes = require("./routes/jobs");
const referralRoutes = require("./api/referral");
const nominationRoutes = require("./routes/nominationRoutes");
const pastEventsRoutes = require("./routes/pastEvents");
const employeeDirectoryRoutes = require("./routes/employeeDirectoryRoutes");
const policiesRoutes = require("./routes/policies");
const adminRoutes = require("./routes/adminRoutes");
const authRoutes = require("./routes/authRoutes");
const questionsRoutes = require("./routes/questions");
const aadAuthRoutes = require("./routes/aadAuthRoutes");
const holidayRoutes = require("./routes/holidayRoutes");
const internalJobsRoutes = require("./routes/internalJobs");
const jobApplyRoutes = require("./routes/jobApplyRoutes");
const profileRoutes = require("./routes/profileRoutes");
const birthdayRoutes = require("./routes/birthdayRoutes");
const queryRoutes = require("./routes/queryRoutes");



const app = express();

// ---------- Core middleware ----------
app.use(express.json()); // VERY important – must be before routes

app.use(
  cors({
    origin: [
      "http://192.168.26.103:8081",
      "http://13.203.230.94",
      "http://roshansivakumar.net",
      "https://roshansivakumar.net",
      "http://localhost:8081",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-User-Email",
      "x-user-role",
      "X-User-Role",
    ],
    exposedHeaders: ["X-User-Email"],
  })
);

// ---------- MongoDB ----------
mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

const querySchema = new mongoose.Schema({
  name: String,
  email: String,
  subject: String,   // ✅ ADD THIS
  message: String,
  type: String,
  timestamp: { type: Date, default: Date.now },
  status: { type: String, default: "pending" },
});

const Query = mongoose.model("Query", querySchema);

// ---------- Gmail transporter ----------
const gmailTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ---------- Gmail endpoints (HR / IT / Payroll via type) ----------
app.post("/api/sendEmail", async (req, res) => {
  try {
    const { name, email, subject, message, type } = req.body || {};

    console.log("📥 /api/sendEmail type:", type);

    if (!name || !email || !message) {
      return res
        .status(400)
        .json({ success: false, error: "Missing fields" });
    }

    // ⭐ Decide final subject first
    const finalSubject =
      subject && subject.trim().length > 0
        ? subject
        : `Query from ${name}`;

    // ⭐ Save in correct collection
    if (type === "ld-skill") {
      // 🔹 Learning & Development skills emails → SkillMailLog collection
      console.log("🟣 Saving to SkillMailLog");
      await SkillMailLog.create({
        name,
        email,
        subject: finalSubject,
        message,
        type,
      });
    } else {
      // 🔹 All other queries (HR / IT / Payroll / generic) → Query collection
      console.log("🟢 Saving to Query");
      await Query.create({
        name,
        email,
        message,
        type,
      });
    }

    // Decide which team to send to
    let toAddress = process.env.HR_EMAIL || process.env.DEFAULT_RECIPIENT;

    if (type === "ticket") {
      toAddress = process.env.IT_EMAIL || process.env.DEFAULT_RECIPIENT;
    } else if (type === "payroll") {
      toAddress = process.env.FINANCE_EMAIL || process.env.DEFAULT_RECIPIENT;
    }

    const html = `
      <h2>${finalSubject}</h2>
      <p><strong>From:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Type:</strong> ${type}</p>
      <p><strong>Message:</strong><br>${message}</p>
    `;

    const result = await gmailTransporter.sendMail({
      from: `"SecureKloud Support" <${process.env.EMAIL_USER}>`,
      to: toAddress,
      cc: email,
      subject: finalSubject, // ⭐ uses user-entered subject (or default)
      html,
    });

    res.json({ success: true, messageId: result.messageId });
  } catch (err) {
    console.error("❌ Query Email Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// (Old direct IT ticket endpoint – you can keep if used elsewhere)
app.post("/api/sendTicket", async (req, res) => {
  try {
    const { name, email, message } = req.body || {};
    if (!name || !email || !message) {
      return res
        .status(400)
        .json({ success: false, error: "Missing fields" });
    }

    const html = `
      <h2>Support Ticket from ${name}</h2>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Message:</strong><br>${message}</p>
    `;

    const result = await gmailTransporter.sendMail({
      from: `"SecureKloud Tickets" <${process.env.EMAIL_USER}>`,
      to: process.env.IT_EMAIL || process.env.DEFAULT_RECIPIENT,
      subject: `Support Ticket from ${name}`,
      html,
    });

    res.json({ success: true, messageId: result.messageId });
  } catch (err) {
    console.error("❌ Ticket Email Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --------------------------------------------------------
// Microsoft Graph OBO route — send AS the signed-in user
// --------------------------------------------------------
const cca = new ConfidentialClientApplication({
  auth: {
    clientId: process.env.AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
    clientSecret: process.env.AZURE_CLIENT_SECRET,
  },
});

const GRAPH_RECIPIENTS = {
  hr: process.env.HR_EMAIL || process.env.DEFAULT_RECIPIENT,
  it: process.env.IT_EMAIL || process.env.DEFAULT_RECIPIENT,
  ta: process.env.TA_EMAIL || process.env.DEFAULT_RECIPIENT,
  finance: process.env.FINANCE_EMAIL || process.env.DEFAULT_RECIPIENT,
};

const GRAPH_SUBJECTS = {
  hr: "HR Query from Intranet",
  it: "IT Support Ticket from Intranet",
  ta: "Talent Acquisition Query from Intranet",
  finance: "Payroll/Finance Query from Intranet",
};

console.log("🟣 sendMail route version: v4-no-trim");

// Log the body for debugging for this route
app.use((req, _res, next) => {
  if (req.method === "POST" && req.path === "/api/support/sendMail") {
    console.log("📥 /api/support/sendMail body:", req.body);
  }
  next();
});

/**
 * POST /api/support/sendMail
 * Body: { message: string, type: "hr" | "it" | "ta" | "finance" }
 * Header: Authorization: Bearer <access token for your backend API scope>
 */
app.post("/api/support/sendMail", async (req, res) => {
  try {
    const authz = req.headers.authorization || "";
    const userAssertion = authz.startsWith("Bearer ") ? authz.slice(7) : null;
    if (!userAssertion) {
      return res.status(401).json({ error: "Missing bearer token" });
    }

    const rawBody = req.body && typeof req.body === "object" ? req.body : {};
    const rawMessage = rawBody.message;
    const rawType = rawBody.type;

    if (typeof rawMessage !== "string" || rawMessage.length === 0) {
      return res.status(400).json({ error: "Message is required" });
    }

    const type =
      typeof rawType === "string" && rawType.length > 0
        ? rawType.toLowerCase()
        : "hr";

    const to =
      (type === "hr" && GRAPH_RECIPIENTS.hr) ||
      (type === "it" && GRAPH_RECIPIENTS.it) ||
      (type === "ta" && GRAPH_RECIPIENTS.ta) ||
      (type === "finance" && GRAPH_RECIPIENTS.finance) ||
      null;

    if (!to) {
      return res
        .status(400)
        .json({ error: `Unknown type '${type}' or missing destination email` });
    }

    const obo = await cca.acquireTokenOnBehalfOf({
      oboAssertion: userAssertion,
      scopes: ["Mail.Send"],
    });

    const graphToken = obo.accessToken;

    const payload = {
      message: {
        subject: GRAPH_SUBJECTS[type] || "Support Query",
        body: { contentType: "Text", content: rawMessage },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: true,
    };

    const r = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${graphToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!r.ok) {
      const text = await r.text();
      console.error("❌ Graph sendMail failed:", text);
      return res
        .status(502)
        .json({ error: `Graph sendMail failed: ${text}` });
    }

    console.log(`✅ Mail sent (${type} → ${to})`);
    res.json({ ok: true });
  } catch (err) {
    console.error("❌ sendMail (Graph OBO) error:", err);
    res.status(500).json({ error: err?.message || "Internal server error" });
  }
});

// ---------- Static files ----------
app.use(
  "/policies",
  express.static(path.resolve(__dirname, "../public/policies"))
);
app.use(
  "/past-events",
  express.static(path.join(__dirname, "public/past-events"))
);

console.log(
  "🗂 Serving static PDFs from:",
  path.resolve(__dirname, "../public/policies")
);

// ---------- API Routes ----------
app.use("/api/sendCourseNotification", sendCourseNotification);
app.use("/api/sendSkillNotification", sendSkillNotification);
app.use("/api/sendCertificationNotification", sendCertificationNotification);
app.use("/api", learningRoutes);
// New main path used by frontend
app.use("/api/registerEvent", registrationRoutes);
// (Optional: keep old path if something else uses it)
app.use("/api/registrations", registrationRoutes);

app.use("/api/org", orgRoutes);
app.use("/api/jobs", jobsRoutes);
app.use("/api/referral", referralRoutes);
app.use("/api/nomination", nominationRoutes);
app.use("/api/past-events", pastEventsRoutes);

app.use("/api/employeedirectory", employeeDirectoryRoutes);
app.use("/api/employee-directory", employeeDirectoryRoutes);

app.use("/api/policies", policiesRoutes);
app.use("/api/admin", adminRoutes);
app.use(express.static("public"));
app.use("/api/auth", authRoutes);
app.use("/api/questions", questionsRoutes);
app.use("/api/aad", aadAuthRoutes);
app.use("/api/holidays", holidayRoutes);
app.use("/api/internal-jobs", internalJobsRoutes);
app.use("/api/jobs", jobApplyRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/learning", learningRoutes);
app.use("/api/birthdays", birthdayRoutes);
app.use("/api/queries", queryRoutes);
app.use(
  "/emp-images",
  express.static(
    require("path").join(
      process.env.FRONTEND_PUBLIC_DIR || "/home/ubuntu/sk-intranet-frontend/public",
      "employee-images"
    )
  )
);


app.use(
  "/past-events",
  express.static("/home/ubuntu/sk-intranet-frontend/public/past-events")
);

// ---------- Start server ----------
const PORT = process.env.PORT || 8000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
});
//