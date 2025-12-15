const mongoose = require("mongoose");

const testSchema = new mongoose.Schema(
  {
    name: String,
    empid: Number,
  },
  { collection: "test" }
);

module.exports = mongoose.model("Test", testSchema);
