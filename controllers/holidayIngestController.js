// backend/controllers/holidayIngestController.js

// ✅ Simple, reliable import for pdf-parse (works with pdf-parse@1.1.1)
let _mod = require("pdf-parse");
const pdfParse =
  (typeof _mod === "function" && _mod) ||
  (_mod && typeof _mod.default === "function" && _mod.default) ||
  (_mod && typeof _mod.pdfParse === "function" && _mod.pdfParse);

if (!pdfParse) {
  throw new Error("pdf-parse loaded but no function export found.");
}

const Holiday = require("../models/Holiday");

// ---------- Helpers ----------
const MONTHS = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

const toUTCDate = (y, m, d) => new Date(Date.UTC(y, m, d));

function parseDateToken(token, fallbackYear) {
  let m, d, y;

  // YYYY-MM-DD or YYYY/MM/DD
  let m1 = token.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (m1) { y = +m1[1]; m = +m1[2] - 1; d = +m1[3]; return toUTCDate(y, m, d); }

  // DD-MM-YYYY or DD/MM/YYYY
  let m2 = token.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (m2) { d = +m2[1]; m = +m2[2] - 1; y = +m2[3]; return toUTCDate(y, m, d); }

  // 26 Jan 2025 / 26 January 2025
  let m3 = token.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (m3) { d = +m3[1]; const mm = m3[2].toLowerCase(); y = +m3[3];
    if (Object.prototype.hasOwnProperty.call(MONTHS, mm)) return toUTCDate(y, MONTHS[mm], d); }

  // Jan 26, 2025 / January 26, 2025
  let m4 = token.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
  if (m4) { const mm = m4[1].toLowerCase(); d = +m4[2]; y = +m4[3];
    if (Object.prototype.hasOwnProperty.call(MONTHS, mm)) return toUTCDate(y, MONTHS[mm], d); }

  // Jan 26  (infer year)
  let m5 = token.match(/^([A-Za-z]+)\s+(\d{1,2})$/);
  if (m5 && fallbackYear) {
    const mm = m5[1].toLowerCase(); d = +m5[2];
    if (Object.prototype.hasOwnProperty.call(MONTHS, mm)) return toUTCDate(fallbackYear, MONTHS[mm], d);
  }
  return null;
}

function extractRows(text, defaultYear) {
  // Normalize/clean lines; join tiny artifact lines
  const raw = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+–\s+/g, " - ").trim())
    .filter(Boolean);

  const lines = [];
  for (let i = 0; i < raw.length; i++) {
    const cur = raw[i];
    if (cur.length < 4 && raw[i + 1]) { lines.push(`${cur} ${raw[i + 1]}`); i++; }
    else lines.push(cur);
  }

  // Find a date ANYWHERE in the line (PDF style: "Name - Weekday - DD Month YYYY")
  const dateTokenRegex =
    /(\d{4}[-/]\d{1,2}[-/]\d{1,2})|(\d{1,2}[-/]\d{1,2}[-/]\d{4})|(\d{1,2}\s+[A-Za-z]+\s+\d{4})|([A-Za-z]+\s+\d{1,2},\s*\d{4})/;

  const rows = [];
  for (const line of lines) {
    const m = line.match(dateTokenRegex);
    if (!m) continue;

    const token = m[0];
    const dt = parseDateToken(token, defaultYear);
    if (!dt) continue;

    // Derive holiday name from the rest of the line
    const name = line
      .replace(token, "")
      .replace(/^\s*\d+\s+/, "") // leading numbering e.g. "1 "
      .replace(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/gi, "")
      .replace(/[–—-]\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (name) rows.push({ date: dt, name });
  }
  return rows;
}

// ---------- Controllers ----------
exports.ingestFromPdf = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file" });

    const region = (req.body.region || "IN").toUpperCase();
    const declaredYear = req.body.year ? Number(req.body.year) : undefined;

    // ✅ use pdf-parse directly
    const parsed = await pdfParse(req.file.buffer);
    const text = parsed.text || "";

    // Infer year if not provided
    let defaultYear = declaredYear;
    if (!defaultYear) {
      const ym = text.match(/\b(20\d{2})\b/);
      if (ym) defaultYear = Number(ym[1]);
    }
    if (!defaultYear) {
      return res.status(400).json({ message: "Could not infer year; include 'year' in form data." });
    }

    const rows = extractRows(text, defaultYear);
    if (!rows.length) {
      return res.status(422).json({ message: "No holiday rows recognized in PDF." });
    }

    const ops = rows.map((r) => {
      const year = r.date.getUTCFullYear();
      const payload = {
        date: r.date,
        year,
        region,
        name: r.name,
        description: "",
        isOptional: /optional/i.test(r.name),
        tags: ["Holiday"],
        updatedBy: req.user?.email || "PDF Ingest",
        createdBy: req.user?.email || "PDF Ingest",
      };
      return {
        updateOne: {
          filter: { date: payload.date, region: payload.region },
          update: { $set: payload },
          upsert: true,
        },
      };
    });

    const result = await Holiday.bulkWrite(ops, { ordered: false });

    res.json({
      ok: true,
      detectedRows: rows.length,
      upserts: result.upsertedCount || 0,
      modified: result.modifiedCount || 0,
      matched: result.matchedCount || 0,
      sample: rows.slice(0, 5).map((r) => ({
        date: r.date.toISOString().slice(0, 10),
        name: r.name,
      })),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "PDF ingest failed", error: e.message });
  }
};

exports.listByYear = async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getUTCFullYear();
    const region = (req.query.region || "IN").toUpperCase();
    const q = { year, region };
    const items = await Holiday.find(q).sort({ date: 1 }).lean();
    res.json({ year, items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Failed to fetch holidays" });
  }
};
