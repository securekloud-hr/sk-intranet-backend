const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

// 👇 On EC2 this will be /home/ubuntu/sk-intranet-frontend/public/past-events
//    On your laptop it will fall back to your F: path (if you keep it).
const basePath =
  process.env.PAST_EVENTS_DIR ||
  "F:\\\\Securekloud Intranet\\\\sk-intranet-frontend\\\\public\\\\past-events";

router.get("/", (req, res) => {
  try {
    if (!fs.existsSync(basePath)) {
      console.error("❌ PAST_EVENTS_DIR not found:", basePath);
      return res.json([]);
    }

    const folders = fs.readdirSync(basePath);

    const events = folders
      .map((folder) => {
        const folderPath = path.join(basePath, folder);
        if (!fs.lstatSync(folderPath).isDirectory()) return null;

        const files = fs
          .readdirSync(folderPath)
          .filter((f) =>
            [".jpg", ".jpeg", ".png"].includes(path.extname(f).toLowerCase())
          );

        const images = files.map((f) => {
          const encodedFolder = encodeURIComponent(folder);
          const encodedFile = encodeURIComponent(f);
          // URL used directly in <img src="...">
          return `/past-events/${encodedFolder}/${encodedFile}`;
        });

        return {
          id: folder,
          title: folder,
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
