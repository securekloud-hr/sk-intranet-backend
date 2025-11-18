// backend/routes/aadAuthRoutes.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");

// Health check
router.get("/health", (req, res) => res.json({ ok: true }));

/**
 * POST /api/aad/ensure-user
 * Ensure a user exists (by email). If new, create with role "user".
 * Expects: { name, email, jobTitle }
 */
router.post("/ensure-user", async (req, res) => {
  try {
    const { name, email, jobTitle } = req.body || {};

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // We only want to set defaults IF the user does not exist.
    // Do NOT overwrite existing admin/type accidentally.
    const update = {
      // only set these when inserting:
      $setOnInsert: {
        name: name || "",
        jobTitle: jobTitle || "",
        role: "user",
        createdAt: new Date(),
      },
    };

    const user = await User.findOneAndUpdate(
      { email },
      update,
      { new: true, upsert: true }
    );

    return res.json({ success: true, user });
  } catch (err) {
    console.error("Error in POST /api/aad/ensure-user:", err);
    if (err?.code === 11000) {
      // duplicate email race-condition; treat as success
      return res.status(200).json({ success: true });
    }
    return res.status(500).json({ error: "Server error in ensure-user" });
  }
});

/**
 * GET /api/aad/me
 * Returns the user info + normalized role.
 * Accepts:
 *  - req.user.email (if you add middleware)
 *  - X-User-Email header
 *  - ?email= query (what you're using now)
 */
router.get("/me", async (req, res) => {
  try {
    const email =
      (req.user && req.user.email) ||
      req.headers["x-user-email"] ||
      req.query.email;

    if (!email) {
      return res.status(400).json({ error: "Email required" });
    }

    const user = await User.findOne({ email }).lean();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // 🔑 Normalize role:
    // - If user.role === 'admin'  -> admin
    // - Else if user.type === 'admin' (legacy) -> admin
    // - Otherwise -> user
    const isAdmin = user.role === "admin" || user.type === "admin";
    const role = isAdmin ? "admin" : "user";

    return res.json({
      name: user.name || user.username || "",
      email: user.email,
      jobTitle: user.jobTitle || "Not set",
      role,                 // 👈 this is what frontend reads
      type: user.type || "",// optional: send legacy for debugging
    });
  } catch (err) {
    console.error("Error in GET /api/aad/me:", err);
    return res.status(500).json({ error: "Server error fetching user" });
  }
});

module.exports = router;
