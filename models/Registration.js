const mongoose = require("mongoose");

const registrationSchema = new mongoose.Schema(
  {
    user: { type: String, required: true },       // User name
    email: { type: String, required: true },      // User email
    eventId: { type: String, required: true },    // Event _id or BOM id
    eventName: { type: String, required: true },  // Event title
    registeredAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// ❗ VERY IMPORTANT: one registration per event+email
registrationSchema.index({ eventId: 1, email: 1 }, { unique: true });

module.exports =
  mongoose.models.Registration ||
  mongoose.model("Registration", registrationSchema);
