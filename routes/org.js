const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const Employee = require("../models/EmployeeDirectory");

// -------------------- Organization Schema --------------------
const orgSchema = new mongoose.Schema({
  type: { type: String, default: "current" },
  data: Object,
  updatedAt: { type: Date, default: Date.now },
  totalEmployees: Number,
});

const OrgStructure = mongoose.model("employees", orgSchema);

// helper: normalize strings
function normName(s) {
  return (s || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
}
function normalizeKey(str) {
  if (!str) return "";
  str = str.toLowerCase();
  str = str.replace(/\bsr\b/g, "senior");
  str = str.replace(/\bi\.t\b/g, "it");
  str = str.replace(/[^a-z0-9]/g, "");
  return str;
}

function buildMemberTree(directReports, reportingMap) {
  return directReports.map((emp) => ({
    id: emp.id,
    name: emp.name,
    title: emp.title,
    email: emp.email,
    phone: emp.phone,
    children: buildMemberTree(reportingMap.get(emp.name) || [], reportingMap),
  }));
}

function getDepartmentColor(deptName) {
  const colors = {
    admin: "bg-orange-100",
    "i.t": "bg-gray-100",
    finance: "bg-green-100",
    hr: "bg-blue-100",
    "h.r.": "bg-blue-100",
    bda: "bg-purple-100",
    "b.d.a.": "bg-purple-100",
    cms: "bg-teal-100",
    "c.m.s.": "bg-teal-100",
    "cloud ez": "bg-indigo-100",
    marketing: "bg-pink-100",
    sales: "bg-cyan-100",
    "us staffing": "bg-yellow-100",
    infosys: "bg-red-100",
    "i.a.m.": "bg-blue-100",
    "t.a.": "bg-green-100",
    cede: "bg-purple-100",
    "i.t. admin.": "bg-gray-100",
    "inside sales": "bg-cyan-100",
  };
  return colors[(deptName || "").toLowerCase()] || "bg-gray-100";
}

function getSubTeamColor(index) {
  const colors = [
    "bg-purple-600",
    "bg-teal-600",
    "bg-indigo-600",
    "bg-pink-600",
    "bg-cyan-600",
    "bg-violet-600",
    "bg-rose-600",
    "bg-amber-600",
    "bg-lime-600",
  ];
  return colors[index % colors.length];
}

function buildDepartmentsForExecutive(executiveName, reportingMap) {
  const directReports = reportingMap.get(executiveName) || [];
  const departments = [];
  const processedReports = new Set();

  directReports.forEach((directReport) => {
    if (reportingMap.has(directReport.name)) {
      const headReports = reportingMap.get(directReport.name);

      const department = {
        id: normalizeKey(directReport.department),
        name: directReport.department,
        color: getDepartmentColor(directReport.department),
        head: {
          id: directReport.id,
          name: directReport.name,
          title: directReport.title,
          email: directReport.email,
          phone: directReport.phone,
        },
        subTeams: [],
      };

      const subTeamGroups = new Map();
      headReports.forEach((member) => {
        const subTeamName = member.subTeam || "General";
        if (!subTeamGroups.has(subTeamName)) subTeamGroups.set(subTeamName, []);
        subTeamGroups.get(subTeamName).push(member);
      });

      let colorIndex = 0;
      subTeamGroups.forEach((groupMembers, subTeamName) => {
        department.subTeams.push({
          id: normalizeKey(subTeamName),
          name: subTeamName,
          color: getSubTeamColor(colorIndex++),
          members: buildMemberTree(groupMembers, reportingMap),
        });
      });

      departments.push(department);
      processedReports.add(directReport.name);
    }
  });

  // remaining reports
  const remainingReports = directReports.filter((dr) => !processedReports.has(dr.name));
  if (remainingReports.length) {
    const remainingGroups = new Map();
    remainingReports.forEach((emp) => {
      const key = emp.department || "General";
      if (!remainingGroups.has(key)) remainingGroups.set(key, []);
      remainingGroups.get(key).push(emp);
    });

    remainingGroups.forEach((groupMembers, deptName) => {
      departments.push({
        id: normalizeKey(deptName),
        name: deptName,
        color: getDepartmentColor(deptName),
        head: {
          id: `temp-head-${Math.random().toString(36).slice(2)}`,
          name: "TBD",
          title: `Head of ${deptName}`,
          email: "",
          phone: "",
        },
        subTeams: [
          {
            id: "general",
            name: "General",
            color: getSubTeamColor(0),
            members: buildMemberTree(groupMembers, reportingMap),
          },
        ],
      });
    });
  }

  return departments;
}

// ✅ build org structure from Employee DB
async function buildOrgFromEmployees() {
  const employees = await Employee.find({}).lean();
  if (!employees.length) {
    const err = new Error("No employees found. Upload Employee Directory first.");
    err.statusCode = 404;
    throw err;
  }

  const nodesByName = new Map();
  const reportsByManager = new Map(); // managerName -> [node]

  employees.forEach((emp) => {
    const name = (emp.EmployeeName || "").toString().trim();
    if (!name) return;

    const node = {
      id: (emp.EmpID || `temp-${Math.random()}`).toString(),
      name,
      title: (emp.Designation || "").toString().trim(), // ✅ Designation used
      email: (emp.OfficialEmail || emp.Email || "").toString().trim(),
      phone: (emp.PhoneNumber || "").toString().trim(),
      department: (emp.Department || "").toString().trim(),
      subTeam: "General",
      reportingManager: (emp.ReportingManager || "").toString().trim(), // ✅ Manager NAME
    };

    nodesByName.set(normName(name), node);

    const mgr = normName(node.reportingManager);
    if (mgr) {
      if (!reportsByManager.has(mgr)) reportsByManager.set(mgr, []);
      reportsByManager.get(mgr).push(node);
    }
  });

  const attachChildren = (node) => {
    const kids = reportsByManager.get(normName(node.name)) || [];
    node.children = kids.map((k) => attachChildren(k));
    return node;
  };

  // Roots = no manager or manager not found
  const roots = [];
  nodesByName.forEach((node) => {
    const mgr = normName(node.reportingManager);
    if (!mgr || !nodesByName.has(mgr)) roots.push(node);
  });

  let ceo =
    roots.find((r) => normName(r.title).includes("ceo")) ||
    roots[0] ||
    nodesByName.values().next().value;

  ceo = attachChildren(ceo);

  const ceoKids = reportsByManager.get(normName(ceo.name)) || [];

  const seniorEA =
    ceoKids.find((x) => {
      const t = normName(x.title);
      return t.includes("ea") || t.includes("executive assistant");
    }) || null;

  const branches = ceoKids
    .filter((x) => !seniorEA || normName(x.name) !== normName(seniorEA.name))
    .map((exec) => ({
      id: normName(exec.name) || exec.id,
      executive: attachChildren(exec),
      color: "bg-orange-500",
      departments: buildDepartmentsForExecutive(exec.name, new Map(
        [...reportsByManager.entries()].map(([mgrKey, list]) => {
          const mgrNode = nodesByName.get(mgrKey);
          const mgrName = mgrNode?.name || mgrKey;
          return [mgrName, list];
        })
      )),
    }));

  return { ceo, seniorEA, branches, totalEmployees: employees.length };
}

// ✅ GET saved org structure
router.get("/structure", async (req, res) => {
  try {
    const orgData = await OrgStructure.findOne({ type: "current" }).lean();
    if (!orgData?.data) {
      return res.status(404).json({
        error: "No organization data found",
        message: "Click Rebuild (from Employee Directory) first",
      });
    }
    return res.json(orgData.data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ✅ POST rebuild and SAVE from Employee Directory DB
router.post("/rebuild", async (req, res) => {
  try {
    const built = await buildOrgFromEmployees();

    const toSave = {
      type: "current",
      data: {
        ceo: built.ceo,
        seniorEA: built.seniorEA,
        branches: built.branches,
      },
      updatedAt: new Date(),
      totalEmployees: built.totalEmployees,
    };

    await OrgStructure.findOneAndUpdate({ type: "current" }, toSave, {
      upsert: true,
      new: true,
    });

    return res.json(toSave.data);
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// ✅ optional: preview without saving
router.get("/from-employees", async (req, res) => {
  try {
    const built = await buildOrgFromEmployees();
    return res.json({
      ceo: built.ceo,
      seniorEA: built.seniorEA,
      branches: built.branches,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ error: err.message });
  }
});

module.exports = router;
