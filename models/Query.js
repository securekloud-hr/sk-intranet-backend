// models/Query.js
const mongoose = require("mongoose");

const querySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    message: { type: String, required: true },
    status: { type: String, default: "pending" },
  },
  {
    timestamps: true,            // gives createdAt + updatedAt
    collection: "queries",       // keep old collection name (important!)
  }
);

module.exports = mongoose.model("Query", querySchema);
