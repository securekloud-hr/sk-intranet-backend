const mongoose = require("mongoose");

const registrationSchema = new mongoose.Schema({
  user: String,        // User name or ID
  email: String,       // User email
  eventId: String,     // ID of the event
  eventName: String,   // Event title
  registeredAt: { type: Date, default: Date.now }
});

// ✅ Prevent OverwriteModelError
module.exports =
  mongoose.models.Registration || mongoose.model("Registration", registrationSchema);
