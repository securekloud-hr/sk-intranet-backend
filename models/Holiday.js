const mongoose = require("mongoose");

const holidaySchema = new mongoose.Schema(
  {
    date: { type: Date, required: true, index: true },
    year: { type: Number, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    region: { type: String, default: "IN", index: true },
    tags: [{ type: String }],
    isOptional: { type: Boolean, default: false },
    createdBy: { type: String },
    updatedBy: { type: String },
  },
  { timestamps: true, collection: "holidays" }
);

holidaySchema.index({ date: 1, region: 1 }, { unique: true });

module.exports = mongoose.model("Holiday", holidaySchema);
