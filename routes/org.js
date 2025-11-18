const express = require('express');

const router = express.Router();

const mongoose = require('mongoose');

const fs = require('fs');

const path = require('path');



// Organization Schema

const orgSchema = new mongoose.Schema({

 type: { type: String, default: 'current' },

 data: Object,

 updatedAt: { type: Date, default: Date.now },

 totalEmployees: Number

});



const OrgStructure = mongoose.model('OrgStructure', orgSchema);



// File path for storing org data temporarily

const ORG_DATA_FILE = path.join(__dirname, '..', 'data', 'orgStructure.json');



// Ensure data directory exists

const dataDir = path.dirname(ORG_DATA_FILE);

if (!fs.existsSync(dataDir)) {

 fs.mkdirSync(dataDir, { recursive: true });

}



// Helper function to normalize keys for matching

function normalizeKey(str) {

 if (!str) return '';

 str = str.toLowerCase();

 str = str.replace(/\bsr\b/g, 'senior');

 str = str.replace(/\bi\.t\b/g, 'it');

 str = str.replace(/[^a-z0-9]/g, '');

 return str;

}



// Recursive function to build member tree with children

function buildMemberTree(directReports, reportingMap) {

 return directReports.map(emp => ({

  id: emp.id,

  name: emp.name,

  title: emp.title,

  email: emp.email,

  phone: emp.phone,

  children: buildMemberTree(reportingMap.get(emp.name) || [], reportingMap)

 }));

}



// -------------------- GET org structure --------------------

router.get('/structure', async (req, res) => {

 try {

  res.setHeader('Content-Type', 'application/json');

   

  if (mongoose.connection.readyState === 1) {

   const orgData = await OrgStructure.findOne({ type: 'current' });

   if (orgData && orgData.data) {

    console.log('✅ Returning org data from MongoDB');

    return res.status(200).json(orgData.data);

   }

  }



  if (fs.existsSync(ORG_DATA_FILE)) {

   try {

    const fileData = fs.readFileSync(ORG_DATA_FILE, 'utf8');

    const orgData = JSON.parse(fileData);

    if (orgData && orgData.data) {

     console.log('✅ Returning org data from file');

     return res.status(200).json(orgData.data);

    }

   } catch (parseError) {

    console.error('Error parsing file data:', parseError);

   }

  }



  console.log('❌ No organization data found');

  return res.status(404).json({

   error: 'No organization data found',

   message: 'Please upload an Excel file to create the organization structure'

  });

 } catch (error) {

  console.error('Error fetching org data:', error);

  res.status(500).json({ 

   error: 'Failed to fetch organization data', 

   details: error.message 

  });

 }

});



// -------------------- POST org structure --------------------

router.post('/structure', async (req, res) => {

 try {

  res.setHeader('Content-Type', 'application/json');

   

  const { employeeData } = req.body;

   

  if (!employeeData || !Array.isArray(employeeData)) {

   return res.status(400).json({ 

    error: 'Invalid employee data format',

    message: 'Expected an array of employee objects'

   });

  }



  if (employeeData.length === 0) {

   return res.status(400).json({ 

    error: 'Empty employee data',

    message: 'Employee data array cannot be empty'

   });

  }



  console.log(`📊 Processing ${employeeData.length} employees...`);



  const transformedData = transformExcelToOrgStructure(employeeData);



  if (!transformedData) {

   throw new Error('Failed to transform employee data');

  }



  const orgRecord = {

   type: 'current',

   data: transformedData,

   updatedAt: new Date(),

   totalEmployees: employeeData.length

  };



  if (mongoose.connection.readyState === 1) {

   try {

    await OrgStructure.findOneAndUpdate(

     { type: 'current' },

     orgRecord,

     { upsert: true, new: true }

    );

    console.log(`✅ Org structure saved in MongoDB (${employeeData.length} employees)`);

   } catch (dbError) {

    console.error('MongoDB save failed, falling back to file:', dbError);

    fs.writeFileSync(ORG_DATA_FILE, JSON.stringify(orgRecord, null, 2));

    console.log(`✅ Org structure saved to file (${employeeData.length} employees)`);

   }

  } else {

   fs.writeFileSync(ORG_DATA_FILE, JSON.stringify(orgRecord, null, 2));

   console.log(`✅ Org structure saved to file (${employeeData.length} employees)`);

  }



  res.status(200).json(transformedData);

 } catch (error) {

  console.error('Error updating org structure:', error);

  res.status(500).json({ 

   error: 'Failed to update organization structure', 

   details: error.message 

  });

 }

});



// -------------------- Enhanced Transform function --------------------

function transformExcelToOrgStructure(employees) {

 try {

  console.log(`🔄 Processing ${employees.length} employee records...`);



  // Step 1: Find key executives

  let ceo = null;

  let seniorEA = null;

  const executives = {

   operations: null, // Director&operations - should be first

   cfo: null,

   cdo: null,

   cro: null

  };



  // Step 2: Create employee lookup map

  const employeeMap = new Map();

  const reportingMap = new Map(); // manager -> [employees]



  employees.forEach((emp, index) => {

   if (!emp || typeof emp !== 'object') return;



   const employee = {

    id: (emp['Emp ID'] || emp['id'] || '').toString().trim(),

    name: (emp['Associate Name'] || emp['name'] || '').toString().trim(),

    title: (emp['title'] || emp['role'] || '').toString().trim(),


    email: (emp['email'] || '').toString().trim(),

    phone: (emp['phone no'] || emp['phone'] || '').toString().trim(),

    department: (emp['Department'] || emp['department'] || '').toString().trim(),

    subTeam: (emp['sub team'] || emp['subTeam'] || 'General').toString().trim(),

    reportingManager: (emp['Reporting Manager'] || emp['reportingManager'] || '').toString().trim()

   };



   if (!employee.id || !employee.name) return;



   employeeMap.set(employee.name, employee);



   // Build reporting structure

   if (employee.reportingManager) {

    if (!reportingMap.has(employee.reportingManager)) {

     reportingMap.set(employee.reportingManager, []);

    }

    reportingMap.get(employee.reportingManager).push(employee);

   }



   // Identify key roles with improved logic

   const roleText = employee.title.toLowerCase().trim();

   const deptText = employee.department.toLowerCase().trim();



   if (roleText === 'ceo office' || roleText === 'ceo' || roleText.includes('ceo')) {

    ceo = employee;

    console.log(`👑 Found CEO: ${employee.name}`);

   }

   else if (employee.department === "CEO's Office" && employee.reportingManager === 'Suresh V' && 

        !employee.title.toLowerCase().includes('cdo') && 

        !employee.title.toLowerCase().includes('cro') &&

        !employee.title.toLowerCase().includes('director')) {

    seniorEA = employee;

    console.log(`🎯 Found Senior EA: ${employee.name}`);

   }

   // FIXED: Better detection for Director&operations

   else if (roleText.includes('director&operations') || 

        roleText.includes('director operations') ||

        (roleText.includes('director') && deptText.includes('admin') && employee.reportingManager === 'Suresh V')) {

    executives.operations = employee;

    console.log(`👔 Found Director&operations: ${employee.name} - ${employee.title}`);

   }

   else if (roleText.includes('cdo') || roleText.includes('people & culture')) {

    executives.cdo = employee;

    console.log(`👔 Found CDO: ${employee.name}`);

   }

   else if (roleText === 'cfo') {

    executives.cfo = employee;

    console.log(`👔 Found CFO: ${employee.name}`);

   }

   else if (roleText.includes('cro') || roleText.includes('wtd')) {

    executives.cro = employee;

    console.log(`👔 Found CRO: ${employee.name}`);

   }

  });



  // Step 3: Build executive branches in the correct order: Operations FIRST, then CFO, CDO, CRO

  const branches = [];



  // 1. OPERATIONS BRANCH FIRST (Director&operations)

  if (executives.operations) {

   branches.push({

    id: 'operations',

    executive: executives.operations,

    color: 'bg-orange-500',

    departments: buildDepartmentsForExecutive(executives.operations.name, reportingMap)

   });

   console.log(`✅ Added Operations branch: ${executives.operations.name}`);

  } else {

   console.log(`❌ Operations executive not found`);

  }



  // 2. CFO BRANCH SECOND

  if (executives.cfo) {

   branches.push({

    id: 'cfo',

    executive: executives.cfo,

    color: 'bg-orange-500',

    departments: buildDepartmentsForExecutive(executives.cfo.name, reportingMap)

   });

   console.log(`✅ Added CFO branch: ${executives.cfo.name}`);

  }



  // 3. CDO BRANCH THIRD

  if (executives.cdo) {

   branches.push({

    id: 'cdo',

    executive: executives.cdo,

    color: 'bg-orange-500',

    departments: buildDepartmentsForExecutive(executives.cdo.name, reportingMap)

   });

   console.log(`✅ Added CDO branch: ${executives.cdo.name}`);

  }



  // 4. CRO BRANCH FOURTH

  if (executives.cro) {

   branches.push({

    id: 'cro',

    executive: executives.cro,

    color: 'bg-orange-500',

    departments: buildDepartmentsForExecutive(executives.cro.name, reportingMap)

   });

   console.log(`✅ Added CRO branch: ${executives.cro.name}`);

  }



  // Provide defaults if executives not found

  const result = {

   ceo: ceo || {

    id: 'default-ceo',

    name: 'Suresh V',

    title: 'CEO',

    email: '',

    phone: ''

   },

   seniorEA: seniorEA || {

    id: 'default-senior-ea',

    name: 'Hemamalini K',

    title: 'Senior EA',

    email: '',

    phone: ''

   },

   branches: branches

  };



  console.log(`✅ Transformation complete:`, {

   ceo: result.ceo.name,

   seniorEA: result.seniorEA.name,

   branches: branches.length,

   totalDepartments: branches.reduce((acc, branch) => acc + branch.departments.length, 0),

   branchOrder: branches.map(b => `${b.id}: ${b.executive.name}`)

  });



  return result;



 } catch (error) {

  console.error('Error in transformExcelToOrgStructure:', error);

  throw error;

 }

}



// Helper function to build departments for an executive

function buildDepartmentsForExecutive(executiveName, reportingMap) {

 const directReports = reportingMap.get(executiveName) || [];

 const departments = [];

 const processedReports = new Set();

  

 console.log(`Building departments for ${executiveName}, direct reports: ${directReports.length}`);



 // Step 1: Find department heads (managers with their own reports)

 directReports.forEach(directReport => {

  if (reportingMap.has(directReport.name)) {

   const headReports = reportingMap.get(directReport.name);

    

   // Found a department head

   const department = {

    id: normalizeKey(directReport.department),

    name: directReport.department,

    color: getDepartmentColor(directReport.department),

    head: {

     id: directReport.id,

     name: directReport.name,

     title: directReport.title,

     email: directReport.email,

     phone: directReport.phone

    },

    subTeams: []

   };



   // Group reports by sub-team

   const subTeamGroups = new Map();

   headReports.forEach(member => {

    const subTeamName = member.subTeam || 'General';

    if (!subTeamGroups.has(subTeamName)) {

     subTeamGroups.set(subTeamName, []);

    }

    subTeamGroups.get(subTeamName).push(member);

   });



   // Add each sub-team to the department

   let colorIndex = 0;

   subTeamGroups.forEach((groupMembers, subTeamName) => {

    department.subTeams.push({

     id: normalizeKey(subTeamName),

     name: subTeamName,

     color: getSubTeamColor(colorIndex++),

     members: buildMemberTree(groupMembers, reportingMap)

    });

   });

    

   departments.push(department);

   processedReports.add(directReport.name);

  }

 });



 // Step 2: Handle remaining direct reports (not department heads)

 const remainingReports = directReports.filter(dr => !processedReports.has(dr.name));

  

 if (remainingReports.length > 0) {

  const remainingGroups = new Map();

  remainingReports.forEach(emp => {

   const key = emp.department || 'General';

   if (!remainingGroups.has(key)) {

    remainingGroups.set(key, []);

   }

   remainingGroups.get(key).push(emp);

  });



  remainingGroups.forEach((groupMembers, deptName) => {

   // Create a department with a TBD head

   const department = {

    id: normalizeKey(deptName),

    name: deptName,

    color: getDepartmentColor(deptName),

    head: {

     id: `temp-head-${Math.random().toString(36).substr(2, 9)}`,

     name: 'TBD',

     title: `Head of ${deptName}`,

     email: '',

     phone: ''

    },

    subTeams: [{

     id: 'general',

     name: 'General',

     color: getSubTeamColor(0),

     members: buildMemberTree(groupMembers, reportingMap)

    }]

   };

    

   departments.push(department);

  });

 }



 console.log(`Created ${departments.length} departments for ${executiveName}`);

 return departments;

}



// Helper functions

function getDepartmentColor(deptName) {

 const colors = {

  'admin': 'bg-orange-100',

  'i.t': 'bg-gray-100',

  'finance': 'bg-green-100',

  'hr': 'bg-blue-100',

  'h.r.': 'bg-blue-100',

  'bda': 'bg-purple-100',

  'b.d.a.': 'bg-purple-100',

  'cms': 'bg-teal-100',

  'c.m.s.': 'bg-teal-100',

  'cloud ez': 'bg-indigo-100',

  'marketing': 'bg-pink-100',

  'sales': 'bg-cyan-100',

  'us staffing': 'bg-yellow-100',

  'infosys': 'bg-red-100',

  'i.a.m.': 'bg-blue-100',

  't.a.': 'bg-green-100',

  'cede': 'bg-purple-100',

  'i.t. admin.': 'bg-gray-100',

  'inside sales': 'bg-cyan-100'

 };

 return colors[deptName.toLowerCase()] || 'bg-gray-100';

}



function getSubTeamColor(index) {

 const colors = [

  'bg-purple-600', 'bg-teal-600', 'bg-indigo-600',

  'bg-pink-600', 'bg-cyan-600', 'bg-violet-600',

  'bg-rose-600', 'bg-amber-600', 'bg-lime-600'

 ];

 return colors[index % colors.length];

}

module.exports = router;

