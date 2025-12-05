const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const path = require("path");

// Base folder
const POLICIES_DIR = path.join(__dirname, "../public/policies");
const ORDER_FILE = path.join(POLICIES_DIR, "categoryOrder.json");

// Ensure root folder exists
if (!fs.existsSync(POLICIES_DIR)) {
  fs.mkdirSync(POLICIES_DIR, { recursive: true });
}

/* ----------------------------------------------------------
   SAVE CATEGORY ORDER (called from frontend drag & drop)
   POST /api/policies/reorder
----------------------------------------------------------- */
router.post("/reorder", (req, res) => {
  const { order } = req.body; // ["Admin Policies", "HR Policies", ...]

  if (!order || !Array.isArray(order)) {
    return res.status(400).json({ message: "Invalid order format" });
  }

  try {
    fs.writeFileSync(ORDER_FILE, JSON.stringify(order, null, 2));
    return res.json({ success: true, message: "Category order saved" });
  } catch (err) {
    console.error("Error saving category order:", err);
    return res.status(500).json({ message: "Failed to save order" });
  }
});

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
   GET ALL POLICIES  (now respects saved category order)
   RETURNS:
   {
     "Admin Policies": [ ... ],
     "HR Policies": [ ... ],
     ...
   }

   Each policy object now also includes:
   - description: content of Desc.txt if present
----------------------------------------------------------- */
router.get("/", (req, res) => {
  try {
    const categories = {};

    if (!fs.existsSync(POLICIES_DIR)) {
      return res.json(categories);
    }

    // 1) Load saved order if file exists
    let savedOrder = [];
    if (fs.existsSync(ORDER_FILE)) {
      try {
        const raw = fs.readFileSync(ORDER_FILE, "utf8");
        savedOrder = JSON.parse(raw);
      } catch (e) {
        console.error("Error reading categoryOrder.json:", e);
      }
    }

    // 2) Get actual folders from disk
    const categoryFolders = fs
      .readdirSync(POLICIES_DIR)
      .filter((cat) =>
        fs.statSync(path.join(POLICIES_DIR, cat)).isDirectory()
      );

    // 3) Final order = savedOrder + any new categories added later
    const finalOrder = [
      ...savedOrder,
      ...categoryFolders.filter((c) => !savedOrder.includes(c)),
    ];

    finalOrder.forEach((category) => {
      const categoryPath = path.join(POLICIES_DIR, category);

      if (!fs.existsSync(categoryPath)) return;
      if (!fs.statSync(categoryPath).isDirectory()) return;

      const items = fs.readdirSync(categoryPath);

      // only policy folders (directories)
      const policyFolders = items.filter((p) =>
        fs.statSync(path.join(categoryPath, p)).isDirectory()
      );

      const policies = [];

      policyFolders.forEach((policyName) => {
        const policyPath = path.join(categoryPath, policyName);

        const allFiles = fs
          .readdirSync(policyPath)
          .filter((f) => fs.statSync(path.join(policyPath, f)).isFile());

        if (!allFiles.length) return;

        // 🔹 Read Desc.txt as description (if present)
        const descFile = allFiles.find((f) => /^desc\.txt$/i.test(f));
        let description = null;

        if (descFile) {
          try {
            const raw = fs.readFileSync(
              path.join(policyPath, descFile),
              "utf8"
            );
            const trimmed = raw.trim();
            if (trimmed) {
              description = trimmed;
            }
          } catch (e) {
            console.error("Error reading Desc.txt for", policyName, e);
          }
        }

        // 🔹 Only consider real documents for latest file (ignore Desc.txt)
        const docFiles = allFiles.filter((f) => !/^desc\.txt$/i.test(f));
        if (!docFiles.length) return; // nothing except Desc.txt

        // determine latest file by modified date
        let latest = docFiles[0];
        let latestTime = fs.statSync(path.join(policyPath, latest)).mtimeMs;

        docFiles.forEach((file) => {
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
          description, // NEW
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

/* ----------------------------------------------------------
   DOWNLOAD LATEST FILE FOR A POLICY
   GET /api/policies/download/:category/:policyName

   Desc.txt is ignored here – only real documents are considered.
----------------------------------------------------------- */
router.get("/download/:category/:policyName", (req, res) => {
  try {
    const { category, policyName } = req.params;

    const policyFolder = path.join(POLICIES_DIR, category, policyName);

    if (!fs.existsSync(policyFolder)) {
      return res.status(404).json({ message: "Policy folder not found" });
    }

    const allFiles = fs
      .readdirSync(policyFolder)
      .filter((f) => fs.statSync(path.join(policyFolder, f)).isFile());

    if (!allFiles.length) {
      return res.status(404).json({ message: "No files found for this policy" });
    }

    // Ignore Desc.txt – only download document files
    const docFiles = allFiles.filter((f) => !/^desc\.txt$/i.test(f));

    if (!docFiles.length) {
      return res
        .status(404)
        .json({ message: "No document files found for this policy" });
    }

    // Get the latest modified document
    let latest = docFiles[0];
    let latestTime = fs.statSync(path.join(policyFolder, latest)).mtimeMs;

    docFiles.forEach((file) => {
      const full = path.join(policyFolder, file);
      const t = fs.statSync(full).mtimeMs;
      if (t > latestTime) {
        latest = file;
        latestTime = t;
      }
    });

    const fullPath = path.join(policyFolder, latest);

    return res.download(fullPath, latest, (err) => {
      if (err) {
        console.error("Download error:", err);
        if (!res.headersSent) {
          res.status(500).json({ message: "Failed to download file" });
        }
      }
    });
  } catch (err) {
    console.error("Download route error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
