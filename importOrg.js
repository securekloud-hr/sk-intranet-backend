const mongoose = require("mongoose");
const xlsx = require("xlsx");
const Employee = require("./models/Employee");
require("dotenv").config();

async function importExcel() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("✅ MongoDB Connected");

    // Read Excel
    const workbook = xlsx.readFile("For Org Structure (2).xlsx");
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = xlsx.utils.sheet_to_json(sheet);

    if (rawData.length === 0) {
      console.error("❌ No data found in Excel.");
      return;
    }

    // Normalize keys: trim + lowercase
    const data = rawData.map(row => {
      const newRow = {};
      for (let key in row) {
        newRow[key.trim().toLowerCase()] = row[key];
      }
      return newRow;
    });

    // Insert employees (skip rows missing empId or name)
    let employees = await Employee.insertMany(
      data
        .filter(row => {
          if (!row["emp id"] || !row["associate name"]) {
            console.warn("Skipping row with missing required fields:", row);
            return false;
          }
          return true;
        })
        .map(row => ({
          empId: row["emp id"].toString().trim(),
          name: row["associate name"].toString().trim(),
          department: row["department"]?.toString().trim() || "",
          role: row["role"]?.toString().trim() || "",
          email: row["email"]?.toString().trim() || "",
          subTeam: row["sub team"]?.toString().trim() || "",
          managerId: null,
        }))
    );

    // Build a map { name -> _id } for manager mapping
    const empMap = {};
    employees.forEach(e => { empMap[e.name] = e._id; });

    // Update managerId for each employee
    for (const row of data) {
      if (row["reporting manager"]) {
        const managerName = row["reporting manager"].toString().trim();
        if (empMap[managerName]) {
          await Employee.updateOne(
            { empId: row["emp id"].toString().trim() },
            { $set: { managerId: empMap[managerName] } }
          );
        }
      }
    }

    console.log(`✅ Inserted ${employees.length} employees & updated managerId`);
  } catch (error) {
    console.error("❌ Error importing Excel:", error);
  } finally {
    mongoose.disconnect();
  }
}

importExcel();
