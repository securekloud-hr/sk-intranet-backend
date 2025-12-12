const mongoose = require("mongoose");

const SkillDefinition = mongoose.model(
  "SkillDefinition",
  new mongoose.Schema(
    {
      Type: String,
      Provider: String,
      Tech: String,
    },
    { collection: "skills_definition" }
  )
);

module.exports = SkillDefinition;
