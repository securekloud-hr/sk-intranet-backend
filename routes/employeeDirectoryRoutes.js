const express = require("express");
const router = express.Router();
const multer = require("multer");
const XLSX = require("xlsx");
const Employee = require("../models/EmployeeDirectory");

// =============================
// ⚙️ Multer Config (upload in memory)
// =============================
const storage = multer.memoryStorage();
const upload = multer({ storage });
const leavebal = multer({ storage });


// =============================
// Normalize Excel keys
// =============================
const normalizeKey = (key) =>
  key
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\u00A0/g, " ")
    .replace(/\./g, "")
    .replace(/\s+/g, " ");

// =============================
// Helpers
// =============================

// Excel numeric cleanup: keep number, otherwise null
const toNullableNumber = (v) => {
  if (v === undefined || v === null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;

  // handle strings like "35", "35.5", " 35 "
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  return null;
};

// Mongo Decimal128 / { $numberDecimal: "35" } cleanup
const toPlainNumberOrNull = (v) => {
  if (v === undefined || v === null) return null;

  // When API returns extended json like { $numberDecimal: "35" }
  if (typeof v === "object" && v.$numberDecimal != null) {
    const n = Number(v.$numberDecimal);
    return Number.isFinite(n) ? n : null;
  }

  // Mongoose Decimal128 has toString()
  if (typeof v === "object" && typeof v.toString === "function") {
    const n = Number(v.toString());
    return Number.isFinite(n) ? n : null;
  }

  // normal number/string
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// =======================================================================
// 🔥 CONNECTS LearningDevelopment ↔ EmployeeDirectory Database
// =======================================================================
const splitList = (val = "") =>
  val
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

const joinList = (arr) => (Array.isArray(arr) ? arr.join(", ") : "");

// =============================
// 📤 Excel Upload → MongoDB
// =============================
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames.find((name) =>
      name.toLowerCase().includes("emp directory")
    );

    if (!sheetName) {
      return res.status(400).json({
        success: false,
        error: "Employee Directory sheet not found in Excel file",
      });
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const data = rows.map((row) => {
      const keys = Object.keys(row).reduce((acc, k) => {
        acc[normalizeKey(k)] = row[k];
        return acc;
      }, {});

      return {
        EmpID: keys["emp id"] || "",
        EmployeeName: keys["associate name"] || "",
        Department: keys["department"] || keys["dept"] || "",
        PhoneNumber: keys["contact no"] || "",
        Birthday: keys["birthday"] || "",

        CurrentAddress: keys["current address"] || "",
        PermanentAddress: keys["permanent address"] || "",
        PAN: keys["pan"] || "",
        Aadhar: keys["aadhar"] || "",
        BloodGroup: keys["blood group"] || "",
        EmergencyContact: keys["emergency contact no"] || "",

        // ✅ Excel column "Designation"
        Designation: keys["designation"] || "",

        // ✅ Official / Work email
       

        // ✅ Personal email
        PersonalEmailID: keys["personal email id"] || "",

        // ✅ Legacy combined Email
        Email: keys["e mail"] || keys["email id"] || keys["email"] || "",

        // ✅ Stored in DB for OrgStructure (DO NOT SHOW IN UI)
        ReportingManager: (
          keys["reporting manager"] ||
          keys["reporting manager name"] ||
          keys["reporting to"] ||
          ""
        )
          .toString()
          .trim(),

        Tech1: keys["tech 1"] || keys["tech1"] || keys["tech. 1"] || "",
        Tech2: keys["tech 2"] || keys["tech2"] || keys["tech. 2"] || "",
        SpecialSkill: keys["special skill"] || "",

        // ✅ Leaves (NO empty string; store number or null)
        EarnedLeave: toNullableNumber(keys["earnedleave"] ?? keys["earned leave"]),
        CasualLeave: toNullableNumber(keys["casualleave"] ?? keys["casual leave"]),
        SickLeave: toNullableNumber(keys["sickleave"] ?? keys["sick leave"]),
        MarriageLeave: toNullableNumber(keys["marriageleave"] ?? keys["marriage leave"]),
        PaternityLeave: toNullableNumber(keys["paternityleave"] ?? keys["paternity leave"]),
      };
    });

    await Employee.deleteMany({});
    await Employee.insertMany(data);

    return res.json({
      success: true,
      message: "✅ Employee data uploaded successfully!",
      count: data.length,
    });
  } catch (err) {
    console.error("❌ Upload error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// =======================================================================================
// 📤 Excel Leave Balance Upload  - Siva - Added 17/12/2025
// =======================================================================================
router.post("/leavebal", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames.find((name) =>
      name.toLowerCase().includes("leave balance")
    );

    if (!sheetName) {
      return res.status(400).json({
        success: false,
        error: "'leave balance' sheet not found in Excel file",
      });
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const data = rows.map((row) => {
      const keys = Object.keys(row).reduce((acc, k) => {
        acc[normalizeKey(k)] = row[k];
        return acc;
      }, {});

      return {
        EmpID: keys["emp id"] || "",
        EmployeeName: keys["associate name"] || "",
        // ✅ Leaves (NO empty string; store number or null)
        EarnedLeave: toNullableNumber(keys["earnedleave"] ?? keys["earned leave"]),
        CasualLeave: toNullableNumber(keys["casualleave"] ?? keys["casual leave"]),
        SickLeave: toNullableNumber(keys["sickleave"] ?? keys["sick leave"]),
        MarriageLeave: toNullableNumber(keys["marriageleave"] ?? keys["marriage leave"]),
        PaternityLeave: toNullableNumber(keys["paternityleave"] ?? keys["paternity leave"]),
      };
    });

    // **** make changes to thse two lines to update the record - NOT DELETE & INSERT THE RECORD
    await Employee.deleteMany({}); //do not wipe out the table.....
    await Employee.insertMany(data); // only update the leave columns....do not insert a row

    return res.json({
      success: true,
      message: "✅ Leave Balance uploaded successfully!",
      count: data.length,
    });
  } catch (err) {
    console.error("❌ Upload error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});
// ======================================END OF CODE - SIVA =================================================

// =============================
// 📥 Fetch ALL employees (SANITIZED)
// =============================
router.get("/", async (req, res) => {
  try {
    const employees = await Employee.find().sort({ EmployeeName: 1 }).lean();

    const sanitized = employees.map((emp) => ({
      EmpID: emp.EmpID || "",
      EmployeeName: emp.EmployeeName || "",
      Department: emp.Department || "",
      Designation: emp.Designation || "",
      OfficialEmail: emp.OfficialEmail || "",
      PersonalEmailID: emp.PersonalEmailID || "",
      Email: emp.Email || "",
      Birthday: emp.Birthday || "",
      Tech1: emp.Tech1 || "",
      Tech2: emp.Tech2 || "",
      SpecialSkill: emp.SpecialSkill || "",

      // ✅ keep as number/null (no "")
      EarnedLeave: emp.EarnedLeave ?? null,
      CasualLeave: emp.CasualLeave ?? null,
      SickLeave: emp.SickLeave ?? null,
      MarriageLeave: emp.MarriageLeave ?? null,
      PaternityLeave: emp.PaternityLeave ?? null,
    }));

    return res.json(sanitized);
  } catch (err) {
    console.error("❌ Fetch error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// --------- BY EMAIL ---------
router.get("/by-email/:email", async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email || "").trim().toLowerCase();

    const employee = await Employee.findOne({
      $or: [
        { Email: { $regex: new RegExp(`^${email}$`, "i") } },
        { OfficialEmail: { $regex: new RegExp(`^${email}$`, "i") } },
      ],
    }).lean();

    if (!employee) return res.json({ success: false, message: "User not found" });

    return res.json({
      success: true,
      employee: {
        id: employee._id,
        EmpID: employee.EmpID,
        name: employee.EmployeeName,
        email: employee.Email || employee.OfficialEmail,
        Birthday: employee.Birthday,
        department: employee.Department,

        primarySkills: splitList(employee.Tech1),
        secondarySkills: splitList(employee.Tech2),
        certifications: splitList(employee.SpecialSkill),

        // ✅ Leaves as plain numbers (Decimal128 safe)
        EarnedLeave: toPlainNumberOrNull(employee.EarnedLeave),
        CasualLeave: toPlainNumberOrNull(employee.CasualLeave),
        SickLeave: toPlainNumberOrNull(employee.SickLeave),
        MarriageLeave: toPlainNumberOrNull(employee.MarriageLeave),
        PaternityLeave: toPlainNumberOrNull(employee.PaternityLeave),
      },
    });
  } catch (err) {
    console.error("❌ /by-email error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// (Your PUT /by-email and by-name routes can remain as-is)
router.put("/by-email/:email", async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email || "").toLowerCase();
    const { primarySkills, secondarySkills, certifications } = req.body;

    const employee = await Employee.findOne({
      Email: { $regex: new RegExp(`^${email}$`, "i") },
    });

    if (!employee) return res.json({ success: false, message: "Employee not found" });

    employee.Tech1 = joinList(primarySkills);
    employee.Tech2 = joinList(secondarySkills);
    employee.SpecialSkill = joinList(certifications);

    await employee.save();
    return res.json({ success: true, message: "Updated Successfully" });
  } catch (err) {
    console.error("❌ PUT /by-email error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
