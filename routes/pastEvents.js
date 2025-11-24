const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

// API endpoint to list past event folders + images
router.get("/", (req, res) => {

  // 🔥 Correct location: backend-root/public/past-events
  const basePath = path.join(process.cwd(), "public", "past-events");

  if (!fs.existsSync(basePath)) {
    return res.json([]);
  }

  const events = fs.readdirSync(basePath).map(folder => {
    const folderPath = path.join(basePath, folder);

    if (!fs.lstatSync(folderPath).isDirectory()) return null;

    const files = fs.readdirSync(folderPath).filter(f =>
      [".jpg", ".jpeg", ".png"].includes(path.extname(f).toLowerCase())
    );

    return {
      id: folder,
      title: folder.replace(/[-_]/g, " "),
      folder: `past-events/${folder}`,
      imageCount: files.length,
      images: files.map(f => `/past-events/${folder}/${f}`)
    };
  }).filter(Boolean);

  res.json(events);
});

module.exports = router;
