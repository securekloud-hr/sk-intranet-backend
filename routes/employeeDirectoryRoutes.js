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
        OfficialEmail:
          keys["e mail"] ||
          keys["e-mail id"] ||
          keys["email id"] ||
          keys["email"] ||
          "",

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
        EarnedLeave: keys["earned leave"] || "",
        CasualLeave: keys["casual leave"] || "",
        SickLeave: keys["sick leave"] || "",
        MarriageLeave: keys["marriage leave"] || "",
        PaternityLeave: keys["paternity leave"] || "", 
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

// =============================
// 📥 Fetch ALL employees (SANITIZED)
// =============================
router.get("/", async (req, res) => {
  try {
    const employees = await Employee.find().sort({ EmployeeName: 1 }).lean();

    // ✅ Hide ReportingManager (needed only for OrgStructure)
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
      EarnedLeave: emp.EarnedLeave || "",
      CasualLeave: emp.CasualLeave || "",
      SickLeave: emp.SickLeave || "",
      MarriageLeave: emp.MarriageLeave || "",
      PaternityLeave: emp.PaternityLeave || "",                 
        }));

    return res.json(sanitized);
  } catch (err) {
    console.error("❌ Fetch error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// =======================================================================
// 🔥 CONNECTS LearningDevelopment ↔ EmployeeDirectory Database
// =======================================================================
const splitList = (val = "") =>
  val
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

const joinList = (arr) => (Array.isArray(arr) ? arr.join(", ") : "");

// --------- BY EMAIL ---------
router.get("/by-email/:email", async (req, res) => {
  try {
    const email = decodeURIComponent(req.params.email || "").toLowerCase();

    const employee = await Employee.findOne({
      Email: { $regex: new RegExp(`^${email}$`, "i") },
    }).lean();

    if (!employee) return res.json({ success: false, message: "User not found" });

    return res.json({
      success: true,
      employee: {
        id: employee._id,
        EmpID: employee.EmpID,
        name: employee.EmployeeName,
        email: employee.Email,
        Birthday: employee.Birthday,
        department: employee.Department,
        primarySkills: splitList(employee.Tech1),
        secondarySkills: splitList(employee.Tech2),
        certifications: splitList(employee.SpecialSkill),
      EarnedLeave: employee.EarnedLeave,
      CasualLeave: employee.CasualLeave ,
      SickLeave: employee.SickLeave ,
      MarriageLeave: employee.MarriageLeave ,
      PaternityLeave: employee.PaternityLeave ,               
      },
    });
  } catch (err) {
    console.error("❌ /by-email error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

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

// --------- BY NAME  **** CODE FOR THE GET AND PUT by NAME NOT USED ANYMORE - Siva 15-12-2025---------
router.get("/by-name/:name", async (req, res) => {
  try {
    let name = decodeURIComponent(req.params.name || "").trim();
    name = name.replace(/\s+/g, " ").toLowerCase();

    if (!name) return res.status(400).json({ success: false, message: "Name is required" });

    const employee = await Employee.findOne({
      EmployeeName: { $regex: new RegExp(`^${name}$`, "i") },
    }).lean();

    if (!employee) return res.json({ success: false, message: "User not found" });

    return res.json({
      success: true,
      employee: {
        id: employee._id,
        EmpID: employee.EmpID,
        name: employee.EmployeeName,
        Birthday: employee.Birthday,
        email: employee.Email,
        department: employee.Department,
        primarySkills: splitList(employee.Tech1),
        secondarySkills: splitList(employee.Tech2),
        certifications: splitList(employee.SpecialSkill),
      },
    });
  } catch (err) {
    console.error("❌ /by-name error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.put("/by-name/:name", async (req, res) => {
  try {
    let name = decodeURIComponent(req.params.name || "").trim();
    name = name.replace(/\s+/g, " ").toLowerCase();

    const { primarySkills, secondarySkills, certifications } = req.body;

    if (!name) return res.status(400).json({ success: false, message: "Name is required" });

    const employee = await Employee.findOne({
      EmployeeName: { $regex: new RegExp(`^${name}$`, "i") },
    });

    if (!employee) return res.json({ success: false, message: "Employee not found" });

    employee.Tech1 = joinList(primarySkills);
    employee.Tech2 = joinList(secondarySkills);
    employee.SpecialSkill = joinList(certifications);

    await employee.save();
    return res.json({ success: true, message: "Updated Successfully" });
  } catch (err) {
    console.error("❌ PUT /by-name error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
