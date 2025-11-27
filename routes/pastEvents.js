const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

// helper to safely encode folder/file names for URLs
const safe = (part) =>
  encodeURIComponent(part).replace(/%2F/gi, "/"); // don't break any subfolders accidentally

router.get("/", (req, res) => {
  // backend-root/public/past-events
  const basePath = path.join(process.cwd(), "public", "past-events");

  if (!fs.existsSync(basePath)) {
    return res.json([]);
  }

  // read all folders in /public/past-events
  const folders = fs
    .readdirSync(basePath, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const events = folders
    .map((folder) => {
      const folderPath = path.join(basePath, folder);

      const files = fs
        .readdirSync(folderPath, { withFileTypes: true })
        .filter(
          (f) =>
            f.isFile() &&
            /\.(png|jpg|jpeg|gif|webp)$/i.test(f.name) // only images
        )
        .map((f) => f.name);

      if (files.length === 0) return null;

      return {
        id: folder, // used in dropdown
        title: folder.replace(/[-_]/g, " "),
        folder: `past-events/${folder}`,
        imageCount: files.length,
        // 🔥 IMPORTANT: return encoded URL for <img src="...">
        images: files.map(
          (f) => `/past-events/${safe(folder)}/${safe(f)}`
        ),
      };
    })
    .filter(Boolean);

  res.json(events);
});

module.exports = router;
