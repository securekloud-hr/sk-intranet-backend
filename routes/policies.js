const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const path = require("path");

// Base folder
const POLICIES_DIR = path.join(__dirname, "../public/policies");

// Ensure root folder exists
if (!fs.existsSync(POLICIES_DIR)) {
  fs.mkdirSync(POLICIES_DIR, { recursive: true });
}

/* ----------------------------------------------------------
   MULTER STORAGE
   SAVE FILES HERE:
   /public/policies/<CATEGORY>/<POLICY NAME>/<file>.pdf
----------------------------------------------------------- */
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const category = req.params.category;
    const policyName = req.params.policyName;

    const folderPath = path.join(POLICIES_DIR, category, policyName);

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    cb(null, folderPath);
  },

  filename: function (req, file, cb) {
    // keep original filename but normalize spaces
    const clean = file.originalname.replace(/\s+/g, "_");
    cb(null, clean);
  },
});

const upload = multer({ storage });

/* ----------------------------------------------------------
   GET ALL POLICIES
   RETURNS:
   {
     "Admin Policies": [
       {
         name: "Domestic Travel Policy & Process",
         fileUrl: "/policies/Admin Policies/Domestic Travel Policy & Process/<latest>.pdf",
         updated: "2025-11-20"
       }
     ]
   }
----------------------------------------------------------- */
router.get("/", (req, res) => {
  try {
    const categories = {};

    if (!fs.existsSync(POLICIES_DIR)) {
      return res.json(categories);
    }

    const categoryFolders = fs.readdirSync(POLICIES_DIR);

    categoryFolders.forEach((category) => {
      const categoryPath = path.join(POLICIES_DIR, category);

      if (!fs.statSync(categoryPath).isDirectory()) return;

      const items = fs.readdirSync(categoryPath);

      // only policy folders (directories)
      const policyFolders = items.filter((p) =>
        fs.statSync(path.join(categoryPath, p)).isDirectory()
      );

      const policies = [];

      policyFolders.forEach((policyName) => {
        const policyPath = path.join(categoryPath, policyName);

        const files = fs
          .readdirSync(policyPath)
          .filter((f) =>
            fs.statSync(path.join(policyPath, f)).isFile()
          );

        if (!files.length) return;

        // determine latest file by modified date
        let latest = files[0];
        let latestTime = fs.statSync(
          path.join(policyPath, latest)
        ).mtimeMs;

        files.forEach((file) => {
          const full = path.join(policyPath, file);
          const t = fs.statSync(full).mtimeMs;
          if (t > latestTime) {
            latest = file;
            latestTime = t;
          }
        });

        const stat = fs.statSync(path.join(policyPath, latest));

        policies.push({
          name: policyName,
          fileUrl: `/policies/${category}/${policyName}/${latest}`,
          updated: stat.mtime.toISOString().slice(0, 10),
        });
      });

      categories[category] = policies;
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
    fs.mkdirSync(folderPath, { recursive: true });
  }

  res.json({ category: name });
});

/* ----------------------------------------------------------
   DELETE CATEGORY (entire folder)
----------------------------------------------------------- */
router.delete("/category/:category", (req, res) => {
  const category = req.params.category;
  const folderPath = path.join(POLICIES_DIR, category);

  if (!fs.existsSync(folderPath)) {
    return res.json({
      message: "Category already deleted or not found",
      skipped: true,
    });
  }

  try {
    fs.rmSync(folderPath, { recursive: true, force: true });
    return res.json({ message: "Category deleted" });
  } catch (err) {
    return res.status(500).json({
      message: "Failed to delete category",
      error: err.message,
    });
  }
});

/* ----------------------------------------------------------
   UPLOAD POLICY (stores inside policy folder)
----------------------------------------------------------- */
router.post(
  "/upload/:category/:policyName",
  upload.single("file"),
  (req, res) => {
    const { category, policyName } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    return res.json({
      message: "Uploaded",
      fileUrl: `/policies/${category}/${policyName}/${req.file.filename}`,
      updated: new Date().toISOString().slice(0, 10),
    });
  }
);

/* ----------------------------------------------------------
   DELETE POLICY (delete entire policy folder)
----------------------------------------------------------- */
router.delete("/:category/:policyName", (req, res) => {
  const { category, policyName } = req.params;

  const folder = path.join(POLICIES_DIR, category, policyName);

  if (!fs.existsSync(folder)) {
    return res.json({
      message: "Policy already deleted or not found",
      skipped: true,
    });
  }

  try {
    fs.rmSync(folder, { recursive: true, force: true });
    return res.json({ message: "Policy deleted" });
  } catch (err) {
    return res.status(500).json({
      message: "Failed to delete policy",
      error: err.message,
    });
  }
});

module.exports = router;
