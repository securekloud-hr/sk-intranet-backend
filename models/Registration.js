const mongoose = require("mongoose");

const registrationSchema = new mongoose.Schema(
  {
    user: { type: String, required: true },
    email: { type: String, required: true },
    eventId: { type: String, required: true },
    eventName: { type: String, required: true },
    registeredAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// ❗ one registration per event + email
registrationSchema.index({ eventId: 1, email: 1 }, { unique: true });

module.exports =
  mongoose.models.Registration ||
  mongoose.model("Registration", registrationSchema);
