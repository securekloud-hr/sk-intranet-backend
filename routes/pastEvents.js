// F:\Securekloud Intranet\sk-intranet-backend\routes\pastEvents.js

const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

/**
 * Absolute path to your FRONTEND public/past-events folder.
 * ❗ Adjust ONLY this root if you move the project.
 */
const basePath = "F:\\Securekloud Intranet\\sk-intranet-frontend\\public\\past-events";

/**
 * GET /api/past-events
 * Returns all event folders + image URLs usable directly in <img src="...">
 */
router.get("/", (req, res) => {
  try {
    if (!fs.existsSync(basePath)) {
      return res.json([]);
    }

    const folders = fs.readdirSync(basePath);

    const events = folders
      .map((folder) => {
        const folderPath = path.join(basePath, folder);

        // skip non-folders
        if (!fs.lstatSync(folderPath).isDirectory()) return null;

        const files = fs
          .readdirSync(folderPath)
          .filter((f) =>
            [".jpg", ".jpeg", ".png"].includes(path.extname(f).toLowerCase())
          );

        // build URLs like /past-events/2025 mensday/1.jpg
        const images = files.map((f) => {
          const encodedFolder = encodeURIComponent(folder);
          const encodedFile = encodeURIComponent(f);
          return `/past-events/${encodedFolder}/${encodedFile}`;
        });

        return {
          id: folder, // used in <select value>
          title: folder, // show folder name as event title
          folder: `past-events/${folder}`,
          imageCount: files.length,
          images,
        };
      })
      .filter(Boolean);

    res.json(events);
  } catch (err) {
    console.error("❌ Error in /api/past-events:", err);
    res.status(500).json({ error: "Failed to read past events" });
  }
});

module.exports = router;
