
const mongoose = require("mongoose");
// =======================
// MongoDB: skills_definition
// =======================
const SkillDefinition = mongoose.model(
  "SkillDefinition",
  new mongoose.Schema(
    {
      Type: String, // "Certification" | "Skill"
      Provider: String, // e.g. "AWS", "Java"
      Tech: String, // e.g. "Cloud Practitioner", "Script"
    },
    { collection: "skills_definition" }
  )
);