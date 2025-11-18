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

// ✅ Normalize Excel headers (handles spaces, dots, hidden chars, casing)
const normalizeKey = (key) =>
  key
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\u00A0/g, " ") // remove invisible non-breaking spaces
    .replace(/\./g, "")
    .replace(/\s+/g, " ");

// =============================
// 📤 Upload & process Excel file
// =============================
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "No file uploaded" });
    }

    // Read Excel workbook
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });

    // Find sheet with name "Emp Directory"
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

    if (rows.length > 0) {
      console.log("✅ Excel headers found:", Object.keys(rows[0]));
    }

    // Map Excel rows → MongoDB schema
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
        CurrentAddress: keys["current address"] || "",
        PermanentAddress: keys["permanent address"] || "",
        PAN: keys["pan"] || "",
        Aadhar: keys["aadhar"] || "",
        BloodGroup: keys["blood group"] || "",
        EmergencyContact: keys["emergency contact no"] || "",
        Email: keys["personal email id"] || "",
        Tech1: keys["tech 1"] || keys["tech1"] || keys["tech. 1"] || "",
        Tech2: keys["tech 2"] || keys["tech2"] || keys["tech. 2"] || "",
        SpecialSkill: keys["special skill"] || "",
      };
    });

    // Clear previous collection (optional)
    await Employee.deleteMany({});

    // Insert new employees
    await Employee.insertMany(data);

    res.json({
      success: true,
      message: "✅ Employee data uploaded successfully!",
      count: data.length,
    });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =============================
// 📥 Fetch all employees (with role-based filtering)
// =============================
router.get("/", async (req, res) => {
  try {
    // Get user role from auth or from header; normalize to lowercase
    let role = req.user?.role || req.headers["x-user-role"] || "user";
    if (typeof role === "string") {
      role = role.toLowerCase();
    }
    const isAdmin = role === "admin";

    const employees = await Employee.find().sort({ EmployeeName: 1 }).lean();

    const sanitized = employees.map((emp) => {
      if (isAdmin) {
        // 🔓 Admin: return full document
        return emp;
      }

      // 🔒 Normal user: return ONLY allowed fields
      return {
        EmpID: emp.EmpID || "",
        EmployeeName: emp.EmployeeName || "",
        Department: emp.Department || "",
        Email: emp.Email || "",
        Tech1: emp.Tech1 || "",
        Tech2: emp.Tech2 || "",
        SpecialSkill: emp.SpecialSkill || "",
      };
    });

    res.json(sanitized);
  } catch (err) {
    console.error("❌ Fetch error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});


module.exports = router;
