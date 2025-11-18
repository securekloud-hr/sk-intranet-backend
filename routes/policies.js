const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const path = require("path");

// Base folder
const POLICIES_DIR = path.join(__dirname, "../public/policies");

// Ensure base directory exists
if (!fs.existsSync(POLICIES_DIR)) {
  fs.mkdirSync(POLICIES_DIR, { recursive: true });
}

// Multer storage system
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const category = req.params.category;
    const folderPath = path.join(POLICIES_DIR, category);

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    cb(null, folderPath);
  },
  filename: function (req, file, cb) {
    const policyName = req.params.policyName.replace(/\s+/g, "_");
    // 🔁 Always save as "<policyName>.pdf" – uploading again overwrites old file
    cb(null, `${policyName}.pdf`);
  },
});

const upload = multer({ storage });

/* ----------------------------------------------------------
   GET ALL POLICIES 
----------------------------------------------------------- */
router.get("/", (req, res) => {
  try {
    const categories = {};

    const folders = fs.readdirSync(POLICIES_DIR);

    folders.forEach((category) => {
      const categoryPath = path.join(POLICIES_DIR, category);

      if (!fs.statSync(categoryPath).isDirectory()) return;

      const files = fs.readdirSync(categoryPath);

      categories[category] = files.map((file) => {
        const stat = fs.statSync(path.join(categoryPath, file));
        return {
          name: file.replace(".pdf", ""),
          fileUrl: `/policies/${category}/${file}`,
          updated: stat.mtime.toISOString().slice(0, 10),
        };
      });
    });

    res.json(categories);
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ message: "Failed to load policies" });
  }
});

/* ----------------------------------------------------------
   CREATE CATEGORY
----------------------------------------------------------- */
router.post("/category", (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: "Category name required" });
  }

  const folderPath = path.join(POLICIES_DIR, name);

  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath);
  }

  res.json({ category: name });
});

/* ----------------------------------------------------------
   DELETE CATEGORY (folder + files) — tolerant
----------------------------------------------------------- */
router.delete("/category/:category", (req, res) => {
  const category = req.params.category;
  const folderPath = path.join(POLICIES_DIR, category);

  if (!fs.existsSync(folderPath)) {
    console.warn(
      `⚠️ Delete category: "${category}" not found, treating as success`
    );
    return res.json({
      message: "Category already deleted or not found",
      skipped: true,
    });
  }

  try {
    fs.rmSync(folderPath, { recursive: true, force: true });
    console.log(`🧹 Deleted category "${category}" and all its files`);
    return res.json({ message: "Category deleted" });
  } catch (err) {
    console.error("Error deleting category:", err);
    return res
      .status(500)
      .json({ message: "Failed to delete category", error: err.message });
  }
});

/* ----------------------------------------------------------
   UPLOAD / UPDATE POLICY FILE
   (overwrites existing file for that policy)
----------------------------------------------------------- */
router.post(
  "/upload/:category/:policyName",
  upload.single("file"),
  (req, res) => {
    const { category, policyName } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const safePolicyName = policyName.replace(/\s+/g, "_");

    return res.json({
      message: "Uploaded",
      fileUrl: `/policies/${category}/${safePolicyName}.pdf`,
      updated: new Date().toISOString().slice(0, 10),
    });
  }
);

/* ----------------------------------------------------------
   DELETE SINGLE POLICY (one PDF file) — tolerant
----------------------------------------------------------- */
router.delete("/:category/:policyName", (req, res) => {
  const { category, policyName } = req.params;

  const folderPath = path.join(POLICIES_DIR, category);
  const safeName = policyName.replace(/\s+/g, "_");

  if (!fs.existsSync(folderPath)) {
    console.warn(
      `⚠️ Delete policy: category "${category}" not found for policy "${policyName}", treating as success`
    );
    return res.json({
      message: "Category not found; nothing to delete",
      skipped: true,
    });
  }

  const files = fs.readdirSync(folderPath);

  // find file whose base name matches policyName or safeName
  const targetFile = files.find((file) => {
    const base = file.replace(/\.[^/.]+$/, ""); // strip extension
    return base === policyName || base === safeName;
  });

  if (!targetFile) {
    console.warn(
      `⚠️ Delete policy: "${policyName}" not found in "${category}", treating as success`
    );
    return res.json({
      message: "Policy already deleted or not found",
      skipped: true,
    });
  }

  const fullPath = path.join(folderPath, targetFile);

  try {
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log(`🗑 Deleted policy file: ${fullPath}`);
    }
    return res.json({ message: "Policy deleted" });
  } catch (err) {
    console.error("Error deleting policy:", err);
    return res
      .status(500)
      .json({ message: "Failed to delete policy", error: err.message });
  }
});

module.exports = router;
