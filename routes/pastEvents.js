const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();

const basePath = process.env.PAST_EVENTS_DIR; // Now uses EC2 path from .env

router.get("/", (req, res) => {
  if (!fs.existsSync(basePath)) {
    console.log("❌ Folder not found:", basePath);
    return res.json([]);
  }

  const folders = fs.readdirSync(basePath);

  const events = folders.map(folder => {
    const folderPath = path.join(basePath, folder);
    if (!fs.lstatSync(folderPath).isDirectory()) return null;

    const files = fs.readdirSync(folderPath)
      .filter(f => [".jpg",".jpeg",".png"].includes(path.extname(f).toLowerCase()));

    const images = files.map(f =>
      `/past-events/${encodeURIComponent(folder)}/${encodeURIComponent(f)}`
    );

    return { id: folder, title: folder, images };
  }).filter(Boolean);

  res.json(events);
});

module.exports = router;
