// routes/questions.js
const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const Question = require("../models/Question");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ✅ Upload & import all sheets
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "No file uploaded" });

    const wb = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetNames = wb.SheetNames || [];
    if (!sheetNames.length)
      return res.status(400).json({ success: false, error: "Workbook has no sheets" });

    const docs = [];

    for (const sheetName of sheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: "" });

      rows.forEach((r, idx) => {
        const row = {};
        Object.keys(r).forEach((k) => (row[k.toLowerCase().trim()] = r[k]));

        const questionNoRaw =
          row.questionno ?? row["question no"] ?? row.qno ?? row.no ?? row["q no"];
        const questionNo =
          questionNoRaw === "" || questionNoRaw == null ? undefined : Number(questionNoRaw);
        if (questionNo !== undefined && (Number.isNaN(questionNo) || !Number.isFinite(questionNo))) {
          throw new Error(`Sheet "${sheetName}", row ${idx + 2}: "questionNo" must be a number`);
        }

        const text = String(row.question ?? row.text ?? "").trim();
        if (!text) throw new Error(`Sheet "${sheetName}", row ${idx + 2}: "question" is required`);

        const rawType = String(row.type ?? "mcq").trim().toLowerCase();
        const isBooleanLabel = [
          "boolean","bool","true/false","truefalse","t/f","yes/no","yesno","y/n","yn"
        ].includes(rawType);

        let type = "mcq";
        if (rawType === "text") type = "text";
        else if (isBooleanLabel) type = "boolean";

        const rawOpt = String(row.options ?? "").trim();
        let options = rawOpt
          ? rawOpt.split("|").map((s) => s.trim()).filter(Boolean)
          : [];

        if (type === "mcq") {
          if (options.length < 2)
            throw new Error(`Sheet "${sheetName}", row ${idx + 2}: MCQ needs at least 2 options`);
        } else if (type === "boolean") {
          if (options.length === 0) options = ["True", "False"];
          if (options.length !== 2)
            throw new Error(
              `Sheet "${sheetName}", row ${idx + 2}: boolean must have exactly 2 options`
            );
        } else {
          options = [];
        }

        // auto-upgrade MCQ to boolean if pair matches
        if (type === "mcq" && options.length === 2) {
          const n = options.map((o) => o.toLowerCase());
          const pairs = [["yes","no"],["true","false"],["y","n"],["lock","unlock"]];
          if (pairs.some(([a,b]) => n.includes(a) && n.includes(b))) type = "boolean";
        }

        docs.push({ domain: sheetName, questionNo, text, type, options });
      });
    }

    const ops = docs.map((d) =>
      d.questionNo !== undefined
        ? {
            updateOne: {
              filter: { domain: d.domain, questionNo: d.questionNo },
              update: { $set: d },
              upsert: true,
            },
          }
        : { insertOne: { document: d } }
    );

    const result = await Question.bulkWrite(ops, { ordered: false });
    res.json({ success: true, result });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(400).json({ success: false, error: err.message || "Upload failed" });
  }
});

// ✅ List questions by domain
router.get("/", async (req, res) => {
  const domain = req.query.domain ? String(req.query.domain) : undefined;
  const where = domain ? { domain } : {};
  const all = await Question.find(where).sort({ domain: 1, questionNo: 1, text: 1 });
  res.json(all);
});

// ✅ Distinct domains for tabs (frontend uses this)
router.get("/domains", async (_req, res) => {
  const domains = await Question.distinct("domain");
  domains.sort((a, b) => String(a).localeCompare(String(b)));
  res.json(domains);
});

module.exports = router;
