const express = require("express");
const nodemailer = require("nodemailer");
const Nomination = require("../models/Nomination");
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const router = express.Router();

router.post("/submitNomination", async (req, res) => {
    // Helper function to convert camelCase keys to snake_case recursively
function normalizeKeys(obj) {
  if (!obj || typeof obj !== "object") return obj;

  const normalized = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
    normalized[newKey] =
      typeof value === "object" && !Array.isArray(value)
        ? normalizeKeys(value)
        : value;
  }
  return normalized;
}

  try {
    const { type, formData, submittedBy } = req.body;

    if (!type || !formData) {
      return res.status(400).json({ success: false, error: "Missing fields" });
    }

    // Save in DB
    const newNomination = new Nomination({ type, formData, submittedBy });
    await newNomination.save();

    // Email transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Fallback HTML table builder
    const buildHtmlTable = (dataObj) => {
      if (!dataObj) return "";
      return `
        <table cellspacing="0" cellpadding="8"
          style="border-collapse: collapse; width: 100%; font-size: 14px; border: 1px solid #ddd; font-family: Arial, sans-serif;">
          ${Object.entries(dataObj)
            .map(([key, value]) => {
              if (!value || (typeof value === "object" && !Object.values(value).some(Boolean))) return "";
              if (typeof value === "object") {
                return `
                  <tr style="background: #e3f2fd;">
                    <td colspan="2" style="font-weight: bold; border: 1px solid #ddd;">${key}</td>
                  </tr>
                  ${Object.entries(value)
                    .map(
                      ([subKey, subValue]) =>
                        subValue
                          ? `<tr>
                              <td style="border: 1px solid #ddd; font-weight: bold; width:40%;">${subKey.replace(/([A-Z])/g, " $1")}</td>
                              <td style="border: 1px solid #ddd;">${subValue}</td>
                            </tr>`
                          : ""
                    )
                    .join("")}
                `;
              }
              return `<tr>
                        <td style="border: 1px solid #ddd; font-weight: bold; width:40%;">${key.replace(/([A-Z])/g, " $1")}</td>
                        <td style="border: 1px solid #ddd;">${value}</td>
                      </tr>`;
            })
            .join("")}
        </table>
      `;
    };
  


    // -------------------------
    // Templates by Form Type
    // -------------------------
    let html;

    // 1) Letter of Authorization
    if (type === "Letter of Authorization - BGV") {
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: auto; line-height:1.6;">
          <p style="text-align:center; font-weight:bold;">TO WHOMSOEVER IT MAY CONCERN</p>
          <p style="text-align:center; font-weight:bold;">Declaration and Authorization</p>
          <p>I hereby authorize <b>M/s Securekloud Technologies Ltd</b> and its authorized representatives
          to verify information provided in my resume and application of employment, and to conduct enquiries as may be necessary.</p>
          <br>
          <p>Signed:</p>
          ${
            formData.signature && formData.signature.startsWith("data:image/")
              ? `<img src="${formData.signature}" style="width:150px; height:auto;" />`
              : "_________________"
          }
          <p>Name: ${formData.name || "_________________"}</p>
          <p>Date: ${formData.date || "_________________"}</p>
        </div>
      `;
    }

 else if (type === "Contract Invoice Template") {
  // Calculate total from services array
  const services = formData.services || [];
  const totalAmount = services.reduce((sum, service) => sum + (Number(service.amount) || 0), 0);
  
  html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Tax Invoice</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 20px;
                background-color: #f9f9f9;
            }
            .invoice-container {
                max-width: 800px;
                margin: 0 auto;
                background-color: white;
                padding: 30px;
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
            }
            h2 {
                text-align: center;
                color: #2E86C1;
                border-bottom: 3px solid #2E86C1;
                padding-bottom: 10px;
            }
            h3 {
                color: #34495E;
                margin-top: 25px;
                border-bottom: 1px solid #BDC3C7;
                padding-bottom: 5px;
            }
            .detail-row {
                display: flex;
                margin: 8px 0;
            }
            .detail-label {
                font-weight: bold;
                width: 180px;
                color: #555;
            }
            .detail-value {
                flex: 1;
                color: #333;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
            }
            th, td {
                border: 1px solid #ddd;
                padding: 12px;
                text-align: left;
            }
            th {
                background-color: #2E86C1;
                color: white;
                font-weight: bold;
            }
            tr:nth-child(even) {
                background-color: #f8f9fa;
            }
            .total-row {
                font-weight: bold;
                font-size: 18px;
                text-align: right;
                margin: 20px 0;
                padding: 15px;
                background-color: #E8F8F5;
                border: 2px solid #2E86C1;
            }
            .signature-section {
                margin-top: 30px;
                padding: 15px;
                border: 1px solid #ddd;
                background-color: #FDFEFE;
            }
            .signature-image {
                max-width: 250px;
                max-height: 100px;
                border: 1px solid #ccc;
                padding: 5px;
                background-color: white;
            }
            .note {
                margin-top: 20px;
                padding: 10px;
                background-color: #FFF9E6;
                border-left: 4px solid #F39C12;
                font-style: italic;
                font-size: 12px;
            }
            .footer {
                margin-top: 40px;
                text-align: center;
                font-size: 11px;
                color: #7F8C8D;
                border-top: 1px solid #ddd;
                padding-top: 15px;
            }
        </style>
    </head>
    <body>
        <div class="invoice-container">
            <h2>TAX INVOICE</h2>
            
            <h3>Invoice Details</h3>
            <div class="detail-row">
                <div class="detail-label">Invoice Number:</div>
                <div class="detail-value">${formData.invoice_number || "N/A"}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Invoice Date:</div>
                <div class="detail-value">${formData.invoice_date || "N/A"}</div>
            </div>
            
            <h3>Pay To:</h3>
            <div class="detail-row">
                <div class="detail-label">Consultant Name:</div>
                <div class="detail-value">${formData.consultant_name || "N/A"}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Address:</div>
                <div class="detail-value">${formData.consultant_address || "N/A"}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Mobile Number:</div>
                <div class="detail-value">${formData.consultant_mobile || "N/A"}</div>
            </div>

            <h3>Bill To:</h3>
            <p style="margin-left: 20px; line-height: 1.6;">
                <strong>SecureKloud Technologies Limited</strong><br/>
                5th Floor, No. 37 & 38, ASV Ramana Towers<br/>
                Venkat Narayana Road, T Nagar<br/>
                Chennai – 600017
            </p>

            <h3>Services Rendered</h3>
            <table>
                <thead>
                    <tr>
                        <th style="width: 8%;">S.No</th>
                        <th style="width: 40%;">Service Description</th>
                        <th style="width: 15%;">Hours</th>
                        <th style="width: 18%;">Rate (₹)</th>
                        <th style="width: 19%;">Amount (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    ${services.map((row, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${row.description || "N/A"}</td>
                            <td>${row.hours || 0}</td>
                            <td>₹${Number(row.rate || 0).toLocaleString('en-IN')}</td>
                            <td>₹${Number(row.amount || 0).toLocaleString('en-IN')}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>

            <div class="total-row">
                Total Amount: ₹${totalAmount.toLocaleString('en-IN')}
            </div>

            <h3>Bank Details</h3>
            <div class="detail-row">
                <div class="detail-label">Bank Name:</div>
                <div class="detail-value">${formData.bank_name || "N/A"}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Bank Branch:</div>
                <div class="detail-value">${formData.bank_branch || "N/A"}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">IFSC Code:</div>
                <div class="detail-value">${formData.ifsc_code || "N/A"}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Account Number:</div>
                <div class="detail-value">${formData.account_number || "N/A"}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">PAN Card Number:</div>
                <div class="detail-value">${formData.pan_number || "N/A"}</div>
            </div>

            ${
              formData.signature && formData.signature.startsWith("data:image/")
                ? `<div class="signature-section">
                     <h3>Signature</h3>
                     <img src="${formData.signature}" class="signature-image" alt="Signature" />
                     <p style="margin-top: 10px; font-size: 12px; color: #555;">
                       Digitally signed by ${formData.consultant_name || "Consultant"}
                     </p>
                   </div>`
                : `<div class="signature-section">
                     <h3>Signature</h3>
                     <div style="border-bottom: 2px solid #333; width: 250px; margin-top: 40px;"></div>
                     <p style="margin-top: 5px; font-size: 12px; color: #555;">
                       Authorized Signatory
                     </p>
                   </div>`
            }

            <div class="note">
                <strong>Note:</strong> I am below the GST threshold of 20 Lakhs per annum.
            </div>

            <div class="footer">
                This invoice was generated automatically from SecureKloud Intranet Portal<br/>
                For any queries, please contact the Finance Department
            </div>
        </div>
    </body>
    </html>
  `;
}
    // 3) Contract Timesheet Template
    else if (type === "Contract Timesheet Template") {
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: auto;">
          <h2 style="text-align:center; color:#2E86C1;">Timesheet</h2>
          <p><b>Consultant Name:</b> ${formData.consultantName}</p>
          <table border="1" cellspacing="0" cellpadding="6" style="border-collapse: collapse; width: 100%; margin:20px 0; font-size:14px;">
            <tr style="background:#f2f2f2;">
              <th>S No.</th><th>Date</th><th>Module</th><th>Hours Worked</th>
            </tr>
            ${
              (formData.entries || [])
                .map(
                  (row, idx) => `
                    <tr>
                      <td>${idx + 1}</td>
                      <td>${row.date || ""}</td>
                      <td>${row.module || ""}</td>
                      <td>${row.hours || ""}</td>
                    </tr>
                  `
                )
                .join("")
            }
          </table>
          <p><b>Total Hours:</b> ${formData.totalHours || 0}</p>
          <p><b>Description:</b> ${formData.description || ""}</p>
        </div>
      `;
    }

    // 4) Expense Reimbursement
  else if (type === "Expense Reimbursement Form") {
  const expenses = formData.expenses || [];
  const subtotal = Number(formData.subtotal) || 0;
  const cashAdvance = Number(formData.cash_advance) || 0;
  const total = Number(formData.total) || 0;

  html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Expense Reimbursement Form</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 20px;
                background-color: #f4f4f4;
            }
            .container {
                max-width: 900px;
                margin: 0 auto;
                background-color: white;
                padding: 30px;
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
            }
            h2 {
                text-align: center;
                color: #2E86C1;
                border-bottom: 3px solid #2E86C1;
                padding-bottom: 10px;
            }
            .detail-section {
                margin: 20px 0;
            }
            .detail-row {
                display: flex;
                margin: 8px 0;
            }
            .detail-label {
                font-weight: bold;
                width: 200px;
                color: #555;
            }
            .detail-value {
                flex: 1;
                color: #333;
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
            }
            th, td {
                border: 1px solid #ddd;
                padding: 10px;
                text-align: left;
            }
            th {
                background-color: #2E86C1;
                color: white;
            }
            tr:nth-child(even) {
                background-color: #f8f9fa;
            }
            .calculation-box {
                margin: 20px 0;
                padding: 15px;
                background-color: #E8F8F5;
                border: 2px solid #2E86C1;
            }
            .calculation-row {
                display: flex;
                justify-content: space-between;
                margin: 8px 0;
                font-size: 16px;
            }
            .total-row {
                font-weight: bold;
                font-size: 18px;
                border-top: 2px solid #2E86C1;
                padding-top: 10px;
                margin-top: 10px;
            }
            .signature-section {
                display: flex;
                justify-content: space-between;
                margin: 30px 0;
            }
            .signature-box {
                width: 45%;
                border: 1px solid #ddd;
                padding: 15px;
                background-color: #FDFEFE;
            }
            .signature-image {
                max-width: 100%;
                max-height: 80px;
                border: 1px solid #ccc;
                padding: 5px;
                margin: 10px 0;
            }
            .note {
                background-color: #FFF9E6;
                border-left: 4px solid #F39C12;
                padding: 10px;
                margin: 20px 0;
                font-style: italic;
            }
            .footer {
                margin-top: 30px;
                text-align: center;
                font-size: 11px;
                color: #7F8C8D;
                border-top: 1px solid #ddd;
                padding-top: 15px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h2>EXPENSE REIMBURSEMENT FORM</h2>
            
            <div class="detail-section">
                <div class="detail-row">
                    <div class="detail-label">Employee Name:</div>
                    <div class="detail-value">${formData.employee_name || "N/A"}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">EMP ID:</div>
                    <div class="detail-value">${formData.emp_id || "N/A"}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Manager Name:</div>
                    <div class="detail-value">${formData.manager_name || "N/A"}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Department:</div>
                    <div class="detail-value">${formData.department || "N/A"}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Expense Period:</div>
                    <div class="detail-value">From ${formData.from_date || "N/A"} To ${formData.to_date || "N/A"}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Business Purpose / Project:</div>
                    <div class="detail-value">${formData.business_purpose || "N/A"}</div>
                </div>
            </div>

            <h3>Itemized Expenses</h3>
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Category</th>
                        <th>Cost (₹)</th>
                    </tr>
                </thead>
                <tbody>
                    ${expenses.map(exp => `
                        <tr>
                            <td>${exp.date || "N/A"}</td>
                            <td>${exp.description || "N/A"}</td>
                            <td>${exp.category || "N/A"}</td>
                            <td>₹${Number(exp.cost || 0).toLocaleString('en-IN')}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>

            <div class="calculation-box">
                <div class="calculation-row">
                    <span>Subtotal:</span>
                    <span>₹${subtotal.toLocaleString('en-IN')}</span>
                </div>
                <div class="calculation-row">
                    <span>Less Cash Advance:</span>
                    <span>-₹${cashAdvance.toLocaleString('en-IN')}</span>
                </div>
                <div class="calculation-row total-row">
                    <span>Total:</span>
                    <span>₹${total.toLocaleString('en-IN')}</span>
                </div>
            </div>

            ${formData.receipts && formData.receipts.length > 0 ? `
                <div class="note">
                    <strong>Receipts Attached:</strong> ${formData.receipts.length} file(s)
                    <ul style="margin: 10px 0 0 20px;">
                        ${formData.receipts.map(r => `<li>${r.filename || 'Receipt'}</li>`).join('')}
                    </ul>
                </div>
            ` : `
                <div class="note">
                    <strong>Important:</strong> Don't Forget to Attach Receipts
                </div>
            `}

            <div class="signature-section">
                <div class="signature-box">
                    <strong>Employee Signature:</strong>
                    ${formData.employee_signature && formData.employee_signature.startsWith('data:image/') ? `
                        <img src="${formData.employee_signature}" class="signature-image" alt="Employee Signature" />
                    ` : `
                        <div style="border-bottom: 2px solid #333; margin: 30px 0 10px 0;"></div>
                    `}
                    <div style="margin-top: 10px;">
                        <strong>Date:</strong> ${formData.employee_date || "___________"}
                    </div>
                </div>
                
                <div class="signature-box">
                    <strong>Approval Signature:</strong>
                    ${formData.approval_signature && formData.approval_signature.startsWith('data:image/') ? `
                        <img src="${formData.approval_signature}" class="signature-image" alt="Approval Signature" />
                    ` : `
                        <div style="border-bottom: 2px solid #333; margin: 30px 0 10px 0;"></div>
                    `}
                    <div style="margin-top: 10px;">
                        <strong>Date:</strong> ${formData.approval_date || "___________"}
                    </div>
                </div>
            </div>

            <div class="footer">
                This notification was sent automatically from SecureKloud Intranet<br/>
                For queries, please contact the Finance Department
            </div>
        </div>
    </body>
    </html>
  `;
}
    // 5) PIP Letter
    else if (type === "PIP Letter") {
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: auto; line-height:1.6;">
          <h2 style="text-align:center; color:#E74C3C;">Performance Improvement Plan</h2>
          <p><b>Employee:</b> ${formData.employeeName}</p>
          <p><b>Manager:</b> ${formData.managerName}</p>
          <p><b>Start Date:</b> ${formData.startDate}</p>
          <p><b>End Date:</b> ${formData.endDate}</p>
          <p><b>Objectives:</b> ${formData.objectives}</p>
          <p><b>Remarks:</b> ${formData.remarks}</p>
        </div>
      `;
    }

    // 6) Intern to Onroll
   // Intern -> Onroll (supports several type names and both nested / flat fields)
else if (
  type === "Intern to Onroll" ||
  type === "Intern to Onroll Movement" ||
  type === "Intern to Onroll Movement Template"
) {
  // normalize keys and fallbacks (frontend may send slightly different names)
  const project = formData.project || formData.projectTitle || formData.project_title || "";
  const internId = formData.internId || formData.intern_id || "";
  const internName = formData.internName || formData.intern_name || "";
  const joiningDate = formData.joiningDate || formData.joining_date || "";
  const completionDate = formData.completionDate || formData.completion_date || "";
  const department = formData.department || "";
  const reportingManager = formData.reportingManager || formData.reporting_manager || "";
  const departmentHead = formData.departmentHead || formData.department_head || "";
  const onrollDate = formData.onrollDate || formData.onroll_date || "";

  // ratings: accept either formData.ratings = { learnability:.. } or flat fields
  const ratings = formData.ratings || {};
  const learnability = formData.learnability || ratings.learnability || "";
  const technical = formData.technical || formData.technicalCompetence || ratings.technical || "";
  const responsibility = formData.responsibility || ratings.responsibility || "";
  const attendance = formData.attendance || ratings.attendance || "";
  const teamwork = formData.teamwork || ratings.teamwork || "";
  const attitude = formData.attitude || ratings.attitude || "";

  const recommendation = formData.recommendation || "";
  const justification = formData.justification || formData.justificationForConversion || "";

  // signature field (frontend sets formData.signature to data:image/... base64)
  const signature = formData.signature || formData.associateSignature || formData.associate_signature || "";

  html = `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: auto; line-height:1.5;">
      <h2 style="text-align:center; color:#2E86C1;">INTERN TO ONROLL MOVEMENT</h2>

      <p><b>Intern ID:</b> ${internId}</p>
      <p><b>Intern Name:</b> ${internName}</p>
      <p><b>Date of Joining (As Intern):</b> ${joiningDate}</p>
      <p><b>Date of Completion (As Intern):</b> ${completionDate}</p>
      <p><b>Internship Title / Project:</b> ${project}</p>
      <p><b>Department:</b> ${department}</p>
      <p><b>Reporting Manager:</b> ${reportingManager}</p>
      <p><b>Department Head:</b> ${departmentHead}</p>
      <p><b>Intern to Onroll Date:</b> ${onrollDate}</p>

      <h3>Areas of Assessment (1-5)</h3>
      <ul>
        <li>Learnability: ${learnability}</li>
        <li>Technical Competence: ${technical}</li>
        <li>Responsibility / Accountability: ${responsibility}</li>
        <li>Attendance: ${attendance}</li>
        <li>Teamwork: ${teamwork}</li>
        <li>Attitude: ${attitude}</li>
      </ul>

      <h3>Recommendation</h3>
      <p>${recommendation}</p>
      <h4>Justification</h4>
      <p>${justification}</p>

      <br/>

      <b>Signature:</b><br/>
      ${
        signature && String(signature).startsWith("data:image/")
          ? `<img src="${signature}" style="width:220px; border:1px solid #ccc; margin-top:10px;" />`
          : `<div style="width:220px; border-bottom:2px solid #333; margin-top:30px;"></div>`
      }

      <p style="font-size:12px; color:#777; margin-top:20px;">This notification was sent automatically from SecureKloud Intranet.</p>
    </div>
  `;
}

    else if (type === "Expense Reimbursement Form") {
  html = `
    <div style="font-family: Arial, sans-serif; max-width: 900px; margin: auto; line-height:1.6;">
      <h2 style="text-align:center; color:#2E86C1;">Expense Reimbursement Form</h2>
      
      <p><b>Employee Name:</b> ${formData.employeeName || ""}</p>
      <p><b>EMP ID:</b> ${formData.empId || ""}</p>
      <p><b>Manager Name:</b> ${formData.managerName || ""}</p>
      <p><b>Department:</b> ${formData.department || ""}</p>
      <p><b>Expense Period:</b> From ${formData.fromDate || ""} To ${formData.toDate || ""}</p>
      <p><b>Business Purpose / Project:</b> ${formData.businessPurpose || ""}</p>

      <h3>Itemized Expenses</h3>
      <table border="1" cellspacing="0" cellpadding="6" 
        style="border-collapse: collapse; width: 100%; margin:20px 0; font-size:14px;">
        <tr style="background:#f2f2f2;">
          <th>Date</th>
          <th>Description</th>
          <th>Category</th>
          <th>Cost</th>
        </tr>
        ${
          (formData.expenses || [])
            .map(
              (row) => `
                <tr>
                  <td>${row.date || ""}</td>
                  <td>${row.description || ""}</td>
                  <td>${row.category || ""}</td>
                  <td>${row.cost || ""}</td>
                </tr>
              `
            )
            .join("")
        }
      </table>

      <p><b>Subtotal:</b> ${formData.subtotal || ""}</p>
      <p><b>Less Cash Advance:</b> ${formData.cashAdvance || ""}</p>
      <p><b>Total:</b> ${formData.total || ""}</p>

      <br/>
      <p><i>Don’t Forget to Attach Receipt</i></p>

      <table style="width:100%; margin-top:30px; font-size:14px;">
        <tr>
          <td>
            <b>Employee Signature:</b> _________________ <br/>
            Date: ${formData.employeeDate || ""}
          </td>
          <td style="text-align:right;">
            <b>Approval Signature:</b> _________________ <br/>
            Date: ${formData.approvalDate || ""}
          </td>
        </tr>
      </table>

      <hr/>
      <p style="font-size:12px; color:#777; text-align:center;">
        This notification was sent automatically from SecureKloud Intranet.
      </p>
    </div>
  `;
}
// Case: Induction Feedback Form
else if (type === "Induction Feedback Form") {
  html = `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: auto;">
      <h2 style="text-align:center; color:#2E86C1;">INDUCTION FEEDBACK FORM</h2>

      <h3>Associate Details</h3>
      <p><b>Associate Name:</b> ${formData.associateName}</p>
      <p><b>Employee Number:</b> ${formData.employeeNumber}</p>
      <p><b>Designation:</b> ${formData.designation}</p>
      <p><b>Department:</b> ${formData.department}</p>
      <p><b>Name of Trainer(s):</b> ${formData.trainers}</p>
      <p><b>Date of Training:</b> ${formData.trainingDate}</p>

      <h3>Please Tick Where Appropriate</h3>
      <ul>
        <li>Onboarding was smooth: ${formData.onboarding}</li>
        <li>Programme duration adequate: ${formData.durationAdequate}</li>
        <li>Programme was well managed: ${formData.wellManaged}</li>
        <li>Policies explained: ${formData.policies}</li>
        <li>Induction improved business understanding: ${formData.businessUnderstanding}</li>
        <li>Introduced to manager in first 3 days: ${formData.managerIntro}</li>
      </ul>

      <h3>Session Ratings</h3>
      <p>Coverage: ${formData.coverage}</p>
      <p>Duration: ${formData.duration}</p>
      <p>Speaker: ${formData.speaker}</p>
      <p>Business Orientation: ${formData.businessOrientation}</p>
      <p>HR Orientation: ${formData.hrOrientation}</p>
      <p>Finance Orientation: ${formData.financeOrientation}</p>
      <p>Marketing Orientation: ${formData.marketingOrientation}</p>
      <p>IT Admin Orientation: ${formData.itOrientation}</p>

      <h3>Suggestions</h3>
      <p>${formData.suggestions}</p>

      <h3>Overall Feedback</h3>
      <p>${formData.overallFeedback}</p>

      <p><b>Additional Comments:</b> ${formData.comments}</p>
      <p><b>Signature:</b> ${formData.signature}</p>
      <p><b>Date:</b> ${formData.date}</p>
    </div>
  `;
}

// Case: PIP Letter Template
else if (type === "PIP Letter Template") {
  html = `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: auto;">
      <h2 style="text-align:center; color:#C0392B;">PERFORMANCE IMPROVEMENT PLAN (PIP)</h2>

      <p><b>Employee Name:</b> ${formData.employeeName}</p>
      <p><b>Employee ID:</b> ${formData.employeeId}</p>
      <p><b>Department:</b> ${formData.department}</p>
      <p><b>Manager:</b> ${formData.manager}</p>

      <h3>Areas of Concern</h3>
      <p>${formData.areasOfConcern}</p>

      <h3>Improvement Plan</h3>
      <p>${formData.planDetails}</p>

      <h3>Timeline</h3>
      <p>${formData.timeline}</p>

      <h3>Consequences of Non-Improvement</h3>
      <p>${formData.consequences}</p>

      <p><b>Employee Signature:</b> ${formData.employeeSignature}</p>
      <p><b>Manager Signature:</b> ${formData.managerSignature}</p>
      <p><b>Date:</b> ${formData.date}</p>
    </div>
  `;
}

// Case: Intern to Onroll Movement Template
else if (type === "Intern to Onroll Movement Template") {
  html = `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: auto;">
      <h2 style="text-align:center; color:#2E86C1;">INTERN TO ONROLL MOVEMENT TEMPLATE</h2>

      <p><b>Intern ID:</b> ${formData.internId}</p>
      <p><b>Intern Name:</b> ${formData.internName}</p>
      <p><b>Date of Joining (As Intern):</b> ${formData.joiningDate}</p>
      <p><b>Date of Completion (As Intern):</b> ${formData.completionDate}</p>
      <p><b>Internship Title / Project:</b> ${formData.project}</p>
      <p><b>Department:</b> ${formData.department}</p>
      <p><b>Reporting Manager:</b> ${formData.reportingManager}</p>
      <p><b>Department Head:</b> ${formData.departmentHead}</p>
      <p><b>Intern to Onroll Date:</b> ${formData.onrollDate}</p>

      <h3>Areas of Assessment (1-5)</h3>
      <ul>
        <li>Learnability: ${formData.learnability}</li>
        <li>Technical Competence: ${formData.technicalCompetence}</li>
        <li>Responsibility / Accountability: ${formData.responsibility}</li>
        <li>Attendance: ${formData.attendance}</li>
        <li>Teamwork: ${formData.teamwork}</li>
        <li>Attitude: ${formData.attitude}</li>
      </ul>

      <h3>Recommendation</h3>
      <p>${formData.recommendation}</p>

      <h3>Recommended to be part of SecureKloud:</h3>
      <p>${formData.recommended}</p>
    </div>
  `;
}
 else if (type === "Leave Encashment Declaration Form") {
  html = `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: auto; line-height:1.6;">
      <p><b>From</b><br/>
      ${formData.employeeName || "_________________"} (${formData.employeeId || "________"})<br/>
      ${formData.address || "_________________"}</p>

      <p><b>To</b><br/>
      Securekloud Technologies Limited<br/>
      5th floor, Bascon Futura Sv IT Park,<br/>
      SV 10/1, Venkatnarayana Road,<br/>
      T-Nagar,<br/>
      Chennai – 600 017.</p>

      <h3 style="text-align:center;">Declaration for claiming Leave Encashment Exemption</h3>

      <p>
        I understand that under the provisions of Income Tax Act, the maximum limit of exemption for 
        Leave Encashment as specified under Section 10(10AA) of the Income Tax Act has to be reduced 
        by the amount of exemption claimed as Leave Encashment by me in any of my previous employment(s) 
        in any financial year(s).
      </p>

      <p>In view of the above, I hereby declare that:</p>
      
      <p>
        ${
          formData.choice === "A"
            ? `✔ (A) I have not taken Leave Encashment exemption from any of my previous employer up till now, during my entire service tenure.`
            : `(A) I have not taken Leave Encashment exemption from any of my previous employer up till now, during my entire service tenure.`
        }
      </p>
      <p>
        ${
          formData.choice === "B"
            ? `✔ (B) I had claimed an aggregate sum of INR <b>${formData.claimedAmount || "_________"}</b> as exempt Income in respect of Leave Encashment from my previous employment(s).`
            : `(B) I had claimed an aggregate sum of INR _________ as exempt Income in respect of Leave Encashment from my previous employment(s).`
        }
      </p>

      <p>
        I confirm that I have reviewed all my prior Form 16(s) and the information provided by me above 
        is accurate. In case of any query, assessment or scrutiny from Income Tax Department, I take 
        responsibility to justify the above information as declared to the company and the company 
        should not be held liable for any interest / penalty arising out of such query.
      </p>

      <br/>
      <p><b>Date:</b> ${formData.date || "________"}<br/>
      <b>Place:</b> ${formData.place || "________"}<br/>
 <p><b>Employee Name:</b> ${formData.employeeName || "________"}</p>

<p><b>Signature:</b></p>
${
  formData.signature && String(formData.signature).startsWith("data:image/")
    ? `<img src="${formData.signature}" style="width:180px;height:auto;border:1px solid #ccc;" />`
    : `<div style="width:180px;border-bottom:2px solid #000;margin-top:20px;"></div>`
}


      ${
        formData.signature && formData.signature.startsWith("data:image/")
          ? `<img src="${formData.signature}" style="width:150px; height:auto;" />`
          : ""
      }
    </div>
  `;
}
// Case: Gratuity Declaration Form
else if (type === "Gratuity Declaration Form") {
  html = `
    <div style="font-family: Arial, sans-serif; max-width: 800px; margin: auto; line-height:1.6;">
      <p><b>From</b><br/>
      ${formData.employeeName || "_________________"} (${formData.employeeId || "________"})<br/>
      ${formData.address || "_________________"}</p>

      <p><b>To</b><br/>
      Securekloud Technologies Limited<br/>
      5th floor, Bascon Futura Sv It Park,<br/>
      SV 10/1, Venkatnarayana Road,<br/>
      T-Nagar,<br/>
      Chennai – 600 017.</p>

      <h3 style="text-align:center;">Declaration for claiming Gratuity Exemption</h3>

      <p>
        I understand that under the provisions of Income Tax Act, the maximum limit of exemption 
        for Gratuity as specified under Section 10(10) of the Income Tax Act has to be reduced by 
        the amount of exemption claimed as Gratuity by me in any of my previous employment(s) in any financial year(s).
      </p>

      <p>In view of the above, I hereby declare that *</p>

      <p>
        ${
          formData.choice === "A"
            ? `✔ (A) I have not taken Gratuity exemption from any of my previous employer up till now, during my entire service tenure.`
            : `(A) I have not taken Gratuity exemption from any of my previous employer up till now, during my entire service tenure.`
        }
      </p>

      <p>
        ${
          formData.choice === "B"
            ? `✔ (B) I had claimed an aggregate sum of INR <b>${formData.claimedAmount || "_________"}</b> as exempt Income in respect of Gratuity from my previous employment(s).`
            : `(B) I had claimed an aggregate sum of INR _________ as exempt Income in respect of Gratuity from my previous employment(s).`
        }
      </p>

      <p>
        I confirm that I have reviewed all my prior Form 16(s) and the information provided by me above 
        is accurate. In case of any query, assessment or scrutiny from Income Tax Department, I take responsibility 
        to justify the above information as declared to the company and the company should not be held liable 
        for any interest / penalty arising out of such query, assessment or scrutiny should the above information be found inaccurate.
      </p>

      <br/>
      <p><b>Date:</b> ${formData.date || "________"}<br/>
      <b>Place:</b> ${formData.place || "________"}<br/>
      <b>Employee Name & Signature:</b> ${formData.employeeName || "________"}</p>

      ${
        formData.signature && formData.signature.startsWith("data:image/")
          ? `<img src="${formData.signature}" style="width:150px; height:auto;" />`
          : ""
      }

      <br/>
      <p style="font-size:12px; color:#777; text-align:center;">*Strike out whichever is not applicable</p>
    </div>
  `;
}
// Add this block inside the big if/else that sets `html` based on `type`
else if (type === "Associate Clearance Form") {
  html = `
    <div style="font-family: Arial, sans-serif; max-width: 900px; margin: auto; line-height:1.6;">
      <h2 style="text-align:center; color:#2E86C1;">ASSOCIATE CLEARANCE FORM</h2>

      <table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:14px;">
        <tr>
          <td><b>Associate Name:</b> ${formData.associateName || ""}</td>
          <td><b>Associate I.D.:</b> ${formData.associateId || ""}</td>
        </tr>
        <tr>
          <td><b>Designation:</b> ${formData.designation || ""}</td>
          <td><b>Department:</b> ${formData.department || ""}</td>
        </tr>
        <tr>
          <td><b>Date of Joining:</b> ${formData.dateOfJoining || ""}</td>
          <td><b>Reporting To:</b> ${formData.reportingTo || ""}</td>
        </tr>
        <tr>
          <td><b>Date of Resignation:</b> ${formData.dateOfResignation || ""}</td>
          <td><b>Date of Relieving:</b> ${formData.dateOfRelieving || ""}</td>
        </tr>
      </table>

      <h3 style="margin-top:20px;">Clearance from Manager / Department Head</h3>
      <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse; width:100%; font-size:14px;">
        <tr style="background:#f2f2f2;"><th>List of Activities</th><th>Status (Returned / Disabled)</th></tr>
        <tr><td>Documentation / Asset Handover</td><td>${formData.docAssetStatus || ""}</td></tr>
        <tr><td>Knowledge Transfer</td><td>${formData.ktStatus || ""}</td></tr>
        <tr><td>Client E-Mail Login</td><td>${formData.clientEmailStatus || ""}</td></tr>
        <tr><td>Client Web Service Access</td><td>${formData.clientWebStatus || ""}</td></tr>
        <tr><td>Other Tools and repository logins</td><td>${formData.otherToolsStatus || ""}</td></tr>
      </table>

      <p><b>Signature of K.T. receiver & Date:</b> ${formData.ktReceiver || ""}</p>
      <p><b>Signature of Department Head & Date:</b> ${formData.deptHeadSignature || ""}</p>

      <h3 style="margin-top:20px;">Clearance from I.T. Admin Department</h3>
      <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse; width:100%; font-size:14px;">
        <tr style="background:#f2f2f2;"><th>List of Activities</th><th>Status (Returned / Disabled)</th></tr>
        <tr><td>Login Credentials</td><td>${formData.loginCredentials || ""}</td></tr>
        <tr><td>Laptop / Desktop</td><td>${formData.laptopStatus || ""}</td></tr>
        <tr><td>Email Access deactivated</td><td>${formData.emailAccess || ""}</td></tr>
        <tr><td>AWS / MS Azure / Google Cloud Login</td><td>${formData.cloudAccess || ""}</td></tr>
        <tr><td>Biometric & Other Access deactivated</td><td>${formData.biometricAccess || ""}</td></tr>
        <tr><td>Active Directory Deactivation</td><td>${formData.adDeactivation || ""}</td></tr>
      </table>

      <p><b>Signature & Date (IT):</b> ${formData.itSignature || ""}</p>

      <h3 style="margin-top:20px;">Clearance from Accounts Department</h3>
      <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse; width:100%; font-size:14px;">
        <tr style="background:#f2f2f2;"><th>Description</th><th>Remarks & Signature</th></tr>
        <tr><td>Loans / Advance / Reimbursement / Others</td><td>${formData.loansRemarks || ""}</td></tr>
        <tr><td>Claims Submitted</td><td>${formData.claimsRemarks || ""}</td></tr>
      </table>
      <p><b>Signature & Date (Accounts):</b> ${formData.accountsSignature || ""}</p>

      <h3 style="margin-top:20px;">Clearance from Admin Department</h3>
      <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse; width:100%; font-size:14px;">
        <tr style="background:#f2f2f2;"><th>List of Activities</th><th>Status (Returned / Disabled)</th></tr>
        <tr><td>Mobile / S.I.M.</td><td>${formData.mobileStatus || ""}</td></tr>
        <tr><td>Drawer Keys</td><td>${formData.keysStatus || ""}</td></tr>
      </table>
      <p><b>Signature & Date (Admin):</b> ${formData.adminSignature || ""}</p>

      <h3 style="margin-top:20px;">Clearance from H.R.</h3>
      <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse; width:100%; font-size:14px;">
        <tr style="background:#f2f2f2;"><th>List of Activities</th><th>Status (Returned / Disabled)</th></tr>
        <tr><td>Identity Card to be Returned</td><td>${formData.idCardStatus || ""}</td></tr>
        <tr><td>Time Sheet Login Disable</td><td>${formData.timesheetStatus || ""}</td></tr>
        <tr><td>Letter of Undertaking</td><td>${formData.louStatus || ""}</td></tr>
        <tr><td>Medical Insurance Deletion Intimation</td><td>${formData.insuranceStatus || ""}</td></tr>
        <tr><td>Documents submitted as per Tax Declaration in ADP portal</td><td>${formData.taxDocsStatus || ""}</td></tr>
      </table>
      <p><b>Signature & Date (HR):</b> ${formData.hrSignature || ""}</p>

      <h3 style="margin-top:20px;">Declaration by the Associate</h3>
      <p>${formData.declaration || ""}</p>

      <p><b>Associate Signature & Date:</b><br/>
        ${
          formData.associateSignature && formData.associateSignature.startsWith("data:image/")
            ? `<img src="${formData.associateSignature}" style="width:200px; height:auto;" />`
            : (formData.associateSignature || "____________________")
        }
      </p>

      <p><b>Associate Address & Phone No:</b> ${formData.associateAddress || ""}</p>

      <p style="margin-top:30px; font-size:13px; color:#555;">
        It is the associate’s responsibility to ensure that this form is completed and returned to H.R. department
        for further processing of service and relieving letter. Your final pay will not be prepared until this form
        is completed and submitted to H.R.
      </p>

      <p style="text-align:right; font-size:12px;">SecureKloud Technologies Limited, Chennai, India — Confidential – H.R. Department</p>
    </div>
  `;
}
else if (type === "Exit Interview Survey") {
  html = `
    <div style="font-family:Arial,sans-serif;max-width:900px;margin:auto;line-height:1.6;">
      <h2 style="text-align:center;color:#2E86C1;">Exit Interview Survey</h2>

      <h3>Associate Details</h3>
      <table style="width:100%;border-collapse:collapse;margin-bottom:15px;">
        <tr><td><b>Name:</b></td><td>${formData.associateName||""}</td><td><b>ID:</b></td><td>${formData.associateId||""}</td></tr>
        <tr><td><b>Designation:</b></td><td>${formData.designation||""}</td><td><b>Department:</b></td><td>${formData.department||""}</td></tr>
        <tr><td><b>Date of Joining:</b></td><td>${formData.dateOfJoining||""}</td><td><b>Date of Resignation:</b></td><td>${formData.dateOfResignation||""}</td></tr>
        <tr><td><b>Date of Relieving:</b></td><td>${formData.dateOfRelieving||""}</td><td><b>Reporting Manager:</b></td><td>${formData.reportingManager||""}</td></tr>
      </table>

      <h3>Reason for Leaving</h3>
      <p>${(formData.reasons||[]).join(", ")}</p>
      <p><b>Other Reason:</b> ${formData.otherReason||""}</p>

      <h3>Ratings (1–5)</h3>
      <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;">
        <tr style="background:#f2f2f2;"><th>Question</th><th>Rating</th></tr>
        ${[
          "My job role was clearly defined",
          "My manager provided necessary support",
          "I received sufficient training for my job",
          "Teamwork and collaboration were encouraged",
          "Communication within the organization was effective",
          "Performance feedback was regular and constructive"
        ].map((q,i)=>`
          <tr><td>${q}</td><td>${formData["rating_"+i]||""}</td></tr>
        `).join("")}
      </table>

      <h3>Feedback</h3>
      <p><b>Liked Most:</b> ${formData.likedMost||""}</p>
      <p><b>Improvement Areas:</b> ${formData.improvementAreas||""}</p>
      <p><b>Suggestions:</b> ${formData.suggestions||""}</p>

      <p><b>Date:</b> ${formData.date||""}<br/>
      <b>Place:</b> ${formData.place||""}</p>

      ${
        formData.signature && formData.signature.startsWith("data:image/")
          ? `<img src="${formData.signature}" style="width:150px;height:auto;"/>`
          : "<p>Signature: __________________</p>"
      }

      <hr/>
      <p style="font-size:12px;color:#777;text-align:center;">
        This notification was sent automatically from SecureKloud Intranet.
      </p>
    </div>
  `;
}
else if (type === "Star of the Quarter") {
  const normalizedFormData = normalizeKeys(formData);
  
  // ✅ Add fallbacks for all possible field names
  normalizedFormData.associate_name = formData.associate_name || formData.associateName || "";
  normalizedFormData.doj = formData.doj || formData.date_of_joining || "";
  normalizedFormData.designation = formData.designation || "";
  normalizedFormData.project = formData.project || formData.project_dept || "";
  normalizedFormData.role_since = formData.role_since || "";
  normalizedFormData.nomination_period = formData.nomination_period || "";
  
  // ✅ Handle accomplishments from both nested and flattened formats
  normalizedFormData.a_performance = formData.a_performance || 
    formData.accomplishments?.exceptional_performance || "";
  normalizedFormData.a_compliance = formData.a_compliance || 
    formData.accomplishments?.process_compliance || "";
  normalizedFormData.a_initiatives = formData.a_initiatives || 
    formData.accomplishments?.initiatives || "";
  normalizedFormData.a_learning = formData.a_learning || 
    formData.accomplishments?.learning || "";
  normalizedFormData.a_sharing = formData.a_sharing || 
    formData.accomplishments?.knowledge_sharing || "";
  normalizedFormData.a_policies = formData.a_policies || 
    formData.accomplishments?.policy_adherence || "";
  normalizedFormData.a_client_appreciation = formData.a_client_appreciation || 
    formData.accomplishments?.client_appreciation || "";
  normalizedFormData.a_potential = formData.a_potential || 
    formData.accomplishments?.potential || "";
  normalizedFormData.a_participation = formData.a_participation || 
    formData.accomplishments?.participation || "";
  normalizedFormData.a_others = formData.a_others || 
    formData.accomplishments?.others || "";
  
  // ✅ Handle nominator details
  normalizedFormData.nominated_by = formData.nominated_by || formData.nominatedBy || "";
  normalizedFormData.nominated_by_designation = formData.nominated_by_designation || 
    formData.nominatedByDesignation || "";
  normalizedFormData.routed_by = formData.routed_by || formData.routedBy || "";
  normalizedFormData.routed_by_designation = formData.routed_by_designation || 
    formData.routedByDesignation || "";

  html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Star of the Quarter Nomination Form</title>
      <style>
          body {
              font-family: Arial, sans-serif;
              margin: 20px;
              background-color: #f4f4f4;
          }
          h2 {
              text-align: center;
              color: #1a237e;
              border-bottom: 2px solid #ccc;
              padding-bottom: 10px;
              margin-bottom: 20px;
          }
          h3 {
              color: #333;
              margin-top: 25px;
          }
          table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
              background-color: #fff;
              box-shadow: 0 2px 5px rgba(0,0,0,0.1);
          }
          th, td {
              border: 1px solid #ddd;
              padding: 10px;
              text-align: left;
              vertical-align: top;
          }
          th {
              background-color: #e8eaf6;
              font-weight: bold;
              width: 25%;
              color: #333;
          }
          .criteria-col {
              width: 30%;
              font-weight: bold;
              background-color: #f7f7ff;
          }
          .accomplishment-col {
              width: 60%;
          }
      </style>
  </head>
  <body>

      <div style="text-align:center;">
        <img src="http://localhost:8081/SecureKloud_Logo.jpg" 
             alt="SecureKloud Logo" 
             style="width:180px; margin-bottom:15px;">
      </div>

      <h2>STAR OF THE QUARTER NOMINATION FORM</h2>

      <h3>ASSOCIATE DETAILS</h3>
      <table>
          <tr>
              <th>Associate Name</th><td>${normalizedFormData.associate_name}</td>
              <th>Date of Joining</th><td>${normalizedFormData.doj}</td>
          </tr>
          <tr>
              <th>Designation</th><td>${normalizedFormData.designation}</td>
              <th>Project / Dept</th><td>${normalizedFormData.project}</td>
          </tr>
          <tr>
              <th>In this Role Since</th><td>${normalizedFormData.role_since}</td>
              <th>Nomination Period</th><td>${normalizedFormData.nomination_period}</td>
          </tr>
      </table>

      <h3>ACCOMPLISHMENTS AGAINST CRITERIA</h3>
      <table>
          <thead>
              <tr>
                  <th>Sl. No.</th>
                  <th class="criteria-col">CRITERIA</th>
                  <th class="accomplishment-col">ACCOMPLISHMENT</th>
              </tr>
          </thead>
          <tbody>
              <tr><td>01</td><td>Consistently Exceptional Performance</td><td>${normalizedFormData.a_performance}</td></tr>
              <tr><td>02</td><td>Process Compliance / Quality of Work Deliverable</td><td>${normalizedFormData.a_compliance}</td></tr>
              <tr><td>03</td><td>Initiatives Rolled out</td><td>${normalizedFormData.a_initiatives}</td></tr>
              <tr><td>04</td><td>Learning</td><td>${normalizedFormData.a_learning}</td></tr>
              <tr><td>05</td><td>Knowledge Sharing / Training Imparted</td><td>${normalizedFormData.a_sharing}</td></tr>
              <tr><td>06</td><td>Awareness and Adherence to Policies</td><td>${normalizedFormData.a_policies}</td></tr>
              <tr><td>07</td><td>Client Appreciation, if any</td><td>${normalizedFormData.a_client_appreciation}</td></tr>
              <tr><td>08</td><td>Potential Shown for the next role, if any</td><td>${normalizedFormData.a_potential}</td></tr>
              <tr><td>09</td><td>Participation in Team / Organizational activities</td><td>${normalizedFormData.a_participation}</td></tr>
              <tr><td>10</td><td>Others, if any</td><td>${normalizedFormData.a_others}</td></tr>
          </tbody>
      </table>

      <h3>NOMINATOR DETAILS</h3>
      <table>
          <tr>
              <th>Nominated By</th><td>${normalizedFormData.nominated_by}</td>
              <th>Designation</th><td>${normalizedFormData.nominated_by_designation}</td>
          </tr>
          <tr>
              <th>Routed By</th><td>${normalizedFormData.routed_by}</td>
              <th>Designation</th><td>${normalizedFormData.routed_by_designation}</td>
          </tr>
      </table>

  </body>
  </html>
  `;
}
else if (
  type === "Team of the Quarter" ||
  type === "Nomination Form - Team of the Quarter"
) {

  const normalizedFormData = normalizeKeys(formData);

  normalizedFormData.nominated_by = formData.nominatedBy || formData.nominated_by || "";
  normalizedFormData.nominator_designation = formData.nominatedByDesignation || formData.nominator_designation || "";
  normalizedFormData.routed_by = formData.routedBy || formData.routed_by || "";
  normalizedFormData.router_designation = formData.routedByDesignation || formData.router_designation || "";
  // accomplishments
  normalizedFormData.a_deliverable = formData.a_deliverable || formData.accomplishments?.deliverable || "";
  normalizedFormData.a_utilization = formData.a_utilization || formData.accomplishments?.utilization || "";
  normalizedFormData.a_productivity = formData.a_productivity || formData.accomplishments?.productivity || "";
  normalizedFormData.a_knowledge = formData.a_knowledge || formData.accomplishments?.knowledge || "";
  normalizedFormData.a_risk = formData.a_risk || formData.accomplishments?.risk || "";
  normalizedFormData.a_customer_sat = formData.a_customer_sat || formData.accomplishments?.customerSat || "";
  normalizedFormData.a_team_bonding = formData.a_team_bonding || formData.accomplishments?.teamBonding || "";
  normalizedFormData.a_compliance = formData.a_compliance || formData.accomplishments?.compliance || "";
  normalizedFormData.a_others = formData.a_others || formData.accomplishments?.others || "";

  // nominator details
  normalizedFormData.nominated_by = formData.nominated_by || formData.nominatedBy || "";
  normalizedFormData.nominator_designation = formData.nominator_designation || formData.nominatedByDesignation || "";
  normalizedFormData.routed_by = formData.routed_by || formData.routedBy || "";
  normalizedFormData.router_designation = formData.router_designation || formData.routedByDesignation || "";
  html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Team of the Quarter Nomination Form</title>
      <style>
          body {
              font-family: Arial, sans-serif;
              margin: 25px;
              background-color: #f9f9f9;
          }
          .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 3px solid #1a237e;
              padding-bottom: 8px;
              margin-bottom: 20px;
          }
          .header img {
              width: 180px;
          }
          .header-right {
              text-align: right;
              font-size: 0.9em;
          }
          .header-right table {
              border-collapse: collapse;
              font-size: 0.9em;
          }
          .header-right th, .header-right td {
              border: 1px solid #999;
              padding: 3px 8px;
          }
          h2 {
              text-align: center;
              color: #1a237e;
              margin: 10px 0;
          }
          h3 {
              color: #333;
              border-bottom: 1px solid #ccc;
              padding-bottom: 5px;
              margin-top: 25px;
          }
          table {
              width: 100%;
              border-collapse: collapse;
              background-color: #fff;
              margin-bottom: 20px;
              box-shadow: 0 2px 5px rgba(0,0,0,0.1);
          }
          th, td {
              border: 1px solid #ddd;
              padding: 10px;
              text-align: left;
              vertical-align: top;
          }
          th {
              background-color: #e8eaf6;
              font-weight: bold;
          }
          .criteria-col {
              width: 35%;
              background-color: #f7f7ff;
          }
          .accomplishment-col {
              width: 55%;
          }
          .signature-table td {
              border: none;
              padding: 8px;
          }
          .signature-label {
              width: 20%;
              font-weight: bold;
              color: #555;
          }
          .signature-input {
              width: 30%;
          }
      </style>
  </head>
  <body>

      <!-- HEADER -->
      <div class="header">
          <img src="http://localhost:8081/SecureKloud_Logo.jpg" alt="SecureKloud Logo">
          <div class="header-right">
              <table>
                  <tr><th>Version No</th><th>Version Date</th></tr>
                  <tr><td>1.0</td><td>14-Jan-21</td></tr>
              </table>
          </div>
      </div>

      <h2>SECUREKLOUD NOMINATION FORM - TEAM OF THE QUARTER</h2>

      <!-- TEAM DETAILS -->
      <h3>TEAM DETAILS</h3>
      <table>
          <tr><th>Name of the Project</th><td colspan="3">${normalizedFormData.project_name || ""}</td></tr>
          <tr>
              <th>Date of Commencement</th><td>${normalizedFormData.date_commencement || ""}</td>
              <th>Nomination Period</th><td>${normalizedFormData.nomination_period || ""}</td>
          </tr>
          <tr>
              <th>Number of Members</th><td>${normalizedFormData.number_of_members || ""}</td>
              <th>Nominated By</th><td>${normalizedFormData.nominated_by || ""}</td>
          </tr>
          <tr>
              <th>Names of Members</th>
              <td colspan="3">${(normalizedFormData.names_of_members || "").replace(/\\n/g, "<br>")}</td>
          </tr>
      </table>

      <!-- ACCOMPLISHMENTS -->
      <h3>ACCOMPLISHMENTS AGAINST CRITERIA</h3>
      <table>
          <thead>
              <tr>
                  <th style="width:5%;">Sl. No.</th>
                  <th class="criteria-col">CRITERIA</th>
                  <th class="accomplishment-col">ACCOMPLISHMENT</th>
              </tr>
          </thead>
          <tbody>
              <tr><td>01</td><td>Consistently Exceptional Deliverable</td><td>${normalizedFormData.a_deliverable || ""}</td></tr>
              <tr><td>02</td><td>Utilization of Resources</td><td>${normalizedFormData.a_utilization || ""}</td></tr>
              <tr><td>03</td><td>Productivity of Resources</td><td>${normalizedFormData.a_productivity || ""}</td></tr>
              <tr><td>04</td><td>Knowledge within the team</td><td>${normalizedFormData.a_knowledge || ""}</td></tr>
              <tr><td>05</td><td>Risk Management</td><td>${normalizedFormData.a_risk || ""}</td></tr>
              <tr><td>06</td><td>Customer Satisfaction Report / Feedback</td><td>${normalizedFormData.a_customer_sat || ""}</td></tr>
              <tr><td>07</td><td>Team Bonding / Motivation</td><td>${normalizedFormData.a_team_bonding || ""}</td></tr>
              <tr><td>08</td><td>Process Compliance / Quality of Work</td><td>${normalizedFormData.a_compliance || ""}</td></tr>
              <tr><td>09</td><td>Others, if any</td><td>${normalizedFormData.a_others || ""}</td></tr>
          </tbody>
      </table>

      <!-- NOMINATOR DETAILS -->
      <h3>NOMINATOR AND ROUTING DETAILS</h3>
      <table class="signature-table">
          <tr>
              <td class="signature-label">Nominated By</td><td class="signature-input">${normalizedFormData.nominated_by || ""}</td>
              <td class="signature-label">Designation</td><td class="signature-input">${normalizedFormData.nominator_designation || ""}</td>
          </tr>
          <tr>
              <td class="signature-label">Routed By</td><td class="signature-input">${normalizedFormData.routed_by || ""}</td>
              <td class="signature-label">Designation</td><td class="signature-input">${normalizedFormData.router_designation || ""}</td>
          </tr>
      </table>

  </body>
  </html>
  `;
}
else if (type === "Associate of the Year") {
  const normalizedFormData = normalizeKeys(formData);

  html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>SECUREKLOUD - Associate of the Year Nomination Form</title>
      <style>
          body { font-family: Arial, sans-serif; margin: 20px; background-color: #f8f9fa; }
          .header-box {
              background-color: #f1f8e9;
              border: 1px solid #dcedc8;
              padding: 15px;
              text-align: center;
          }
          h2 { color: #33691e; margin: 5px 0; }
          h3 { color: #444; border-bottom: 1px solid #c8e6c9; padding-bottom: 5px; margin-top: 25px; }
          table {
              width: 100%; border-collapse: collapse; background-color: #fff;
              box-shadow: 0 2px 5px rgba(0,0,0,0.05); margin-bottom: 20px;
          }
          th, td { border: 1px solid #e0e0e0; padding: 10px; vertical-align: top; }
          th { background-color: #e8f5e9; font-weight: bold; width: 25%; }
          .criteria-col { width: 30%; background-color: #f9fbe7; font-weight: bold; }
          .accomplishment-col { width: 60%; }
      </style>
  </head>
  <body>
      <div class="header-box">
          <img src="http://localhost:8081/SecureKloud_Logo.jpg" alt="Logo" style="width:160px; margin-bottom:10px;">
          <h2>SECUREKLOUD</h2>
          <h2>NOMINATION FORM - ASSOCIATE OF THE YEAR</h2>
      </div>

      <table>
          <tr><th>Associate Name</th><td>${normalizedFormData.associate_name || ""}</td>
              <th>Date of Joining</th><td>${normalizedFormData.date_of_joining || ""}</td></tr>
          <tr><th>Designation</th><td>${normalizedFormData.designation || ""}</td>
              <th>Project / Dept</th><td>${normalizedFormData.project_dept || ""}</td></tr>
          <tr><th>In this Role Since</th><td>${normalizedFormData.role_since || ""}</td>
              <th>Nomination Period</th><td>${normalizedFormData.nomination_period || ""}</td></tr>
      </table>

      <h3>ACCOMPLISHMENTS AGAINST CRITERIA</h3>
      <table>
          <tr><th>01</th><td class="criteria-col">Nominated for Star of the Quarter</td><td>${normalizedFormData.a_star_of_q || ""}</td></tr>
          <tr><th>02</th><td class="criteria-col">Consistently Exceptional Performance</td><td>${normalizedFormData.a_performance || ""}</td></tr>
          <tr><th>03</th><td class="criteria-col">Initiatives Rolled out</td><td>${normalizedFormData.a_initiatives || ""}</td></tr>
          <tr><th>04</th><td class="criteria-col">Learning</td><td>${normalizedFormData.a_learning || ""}</td></tr>
          <tr><th>05</th><td class="criteria-col">Knowledge Sharing / Training Imparted</td><td>${normalizedFormData.a_sharing || ""}</td></tr>
          <tr><th>06</th><td class="criteria-col">Awareness and Adherence to Policies</td><td>${normalizedFormData.a_policies || ""}</td></tr>
          <tr><th>07</th><td class="criteria-col">Process Compliance / Quality of Work</td><td>${normalizedFormData.a_compliance || ""}</td></tr>
          <tr><th>08</th><td class="criteria-col">Client Appreciation, if any</td><td>${normalizedFormData.a_client_appreciation || ""}</td></tr>
          <tr><th>09</th><td class="criteria-col">Potential Shown for the next role</td><td>${normalizedFormData.a_potential || ""}</td></tr>
          <tr><th>10</th><td class="criteria-col">Participation in Team / Org. activities</td><td>${normalizedFormData.a_participation || ""}</td></tr>
          <tr><th>11</th><td class="criteria-col">Impact on Project / Customer/ Organization</td><td>${normalizedFormData.a_impact || ""}</td></tr>
          <tr><th>12</th><td class="criteria-col">Others, if any</td><td>${normalizedFormData.a_others || ""}</td></tr>
      </table>

      <h3>NOMINATOR AND ROUTING DETAILS</h3>
      <table>
          <tr><th>Nominated By</th><td>${normalizedFormData.nominated_by || ""}</td>
              <th>Designation</th><td>${normalizedFormData.nominator_designation || ""}</td></tr>
          <tr><th>Routed By</th><td>${normalizedFormData.routed_by || ""}</td>
              <th>Designation</th><td>${normalizedFormData.router_designation || ""}</td></tr>
      </table>
  </body>
  </html>`;
}
else if (type === "Team of the Year") {

  // 🔹 STEP 1: Normalize frontend data
  const fd = normalizeKeys(formData);

  console.log("📥 Normalized Team of Year Data:", JSON.stringify(fd, null, 2));

  // 🔹 STEP 2: SAFELY MAP ALL POSSIBLE FIELD NAMES
  const data = {
    // ---- TEAM DETAILS ----
    project_name:
      fd.project ||
      fd.name_of_project ||
      "",

    date_commencement:
      fd.commencement_date ||
      fd.date_of_commencement ||
      "",

    number_of_members:
      fd.number_of_members || "",

    nomination_period:
      fd.nomination_period || "",

    names_of_members:
      fd.member_names ||
      fd.names_of_members ||
      "",

    previous_nomination_details:
      fd.previous_nomination_details ||
      fd.previous_nominations ||
      "",

    // ---- ACCOMPLISHMENTS ----
    a_deliverable:
      fd.accomplishments?.consistently_exceptional_deliverable ||
      fd.accomplishments?.exceptional_deliverable ||
      "",

    a_utilization:
      fd.accomplishments?.utilization_of_resources ||
      fd.accomplishments?.resource_utilization ||
      "",

    a_productivity:
      fd.accomplishments?.productivity_of_resources ||
      fd.accomplishments?.resource_productivity ||
      "",

    a_knowledge:
      fd.accomplishments?.knowledge_within_team ||
      fd.accomplishments?.team_knowledge ||
      "",

    a_risk:
      fd.accomplishments?.risk_management ||
      "",

    a_customer_sat:
      fd.accomplishments?.customer_satisfaction ||
      fd.accomplishments?.customer_feedback ||
      "",

    a_team_bonding:
      fd.accomplishments?.team_bonding ||
      "",

    a_compliance:
      fd.accomplishments?.process_compliance ||
      "",

    a_impact:
      fd.accomplishments?.impact_on_project ||
      fd.accomplishments?.impact ||
      "",

    a_cost_effective:
      fd.accomplishments?.cost_effective_initiatives ||
      fd.accomplishments?.cost_effective ||
      "",

    a_contribution:
      fd.accomplishments?.contribution_to_targets ||
      fd.accomplishments?.contribution ||
      "",

    a_others:
      fd.accomplishments?.others ||
      "",

    // ---- NOMINATOR DETAILS ----
    nominated_by:
      fd.nominated_by ||
      "",

    nominator_designation:
      fd.nominated_by_designation ||
      "",

    routed_by:
      fd.routed_by ||
      "",

    router_designation:
      fd.routed_by_designation ||
      "",
  };

  console.log("✅ Final Data for Template:", JSON.stringify(data, null, 2));

  // 🔹 STEP 3: HTML TEMPLATE (UNCHANGED STRUCTURE)
  html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>SECUREKLOUD - Team of the Year</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 20px; background:#f4f4f4; }
      h2 { text-align:center; color:#1a237e; }
      h3 { border-bottom:2px solid #aaa; padding-bottom:6px; }
      table { width:100%; border-collapse:collapse; background:#fff; margin-bottom:20px; }
      th, td { border:1px solid #ccc; padding:8px; }
      th { background:#e8eaf6; width:25%; }
    </style>
  </head>
  <body>

    <h2>SECUREKLOUD</h2>
    <h2>NOMINATION FORM – TEAM OF THE YEAR</h2>

    <h3>TEAM DETAILS</h3>
    <table>
      <tr><th>Project Name</th><td>${data.project_name}</td>
          <th>Date of Commencement</th><td>${data.date_commencement}</td></tr>
      <tr><th>Number of Members</th><td>${data.number_of_members}</td>
          <th>Nomination Period</th><td>${data.nomination_period}</td></tr>
      <tr><th>Names of Members</th><td colspan="3">${data.names_of_members}</td></tr>
      <tr><th>Previous Nomination Details</th><td colspan="3">${data.previous_nomination_details}</td></tr>
    </table>

    <h3>ACCOMPLISHMENTS</h3>
    <table>
      <tr><th>Exceptional Deliverable</th><td>${data.a_deliverable}</td></tr>
      <tr><th>Utilization of Resources</th><td>${data.a_utilization}</td></tr>
      <tr><th>Productivity</th><td>${data.a_productivity}</td></tr>
      <tr><th>Knowledge</th><td>${data.a_knowledge}</td></tr>
      <tr><th>Risk Management</th><td>${data.a_risk}</td></tr>
      <tr><th>Customer Feedback</th><td>${data.a_customer_sat}</td></tr>
      <tr><th>Team Bonding</th><td>${data.a_team_bonding}</td></tr>
      <tr><th>Process Compliance</th><td>${data.a_compliance}</td></tr>
      <tr><th>Impact</th><td>${data.a_impact}</td></tr>
      <tr><th>Cost Effective</th><td>${data.a_cost_effective}</td></tr>
      <tr><th>Contribution</th><td>${data.a_contribution}</td></tr>
      <tr><th>Others</th><td>${data.a_others}</td></tr>
    </table>

    <h3>NOMINATOR DETAILS</h3>
    <table>
      <tr><th>Nominated By</th><td>${data.nominated_by}</td>
          <th>Designation</th><td>${data.nominator_designation}</td></tr>
      <tr><th>Routed By</th><td>${data.routed_by}</td>
          <th>Designation</th><td>${data.router_designation}</td></tr>
    </table>

  </body>
  </html>
  `;
}

else if (
  type === "Letter of Undertaking Separation" ||
  type === "Letter of Undertaking"
) {
  const signature =
  formData.signature ||
  formData.associateSignature ||
  formData.employeeSignature ||
  "";

  html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <style>
      body {
        font-family: Arial, sans-serif;
        margin: 40px;
        line-height: 1.7;
        color: #000;
      }
      h2 {
        text-align: center;
        text-decoration: underline;
      }
      .signature {
        margin-top: 40px;
      }
      .signature img {
        width: 200px;
        border-bottom: 1px solid #000;
      }
    </style>
  </head>
  <body>

    <p><b>Date:</b> ${formData.date || "________"}</p>

    <p>
      SecureKloud Technologies Limited<br/>
      5th Floor, Bascon Futura SV IT Park,<br/>
      SV 10/1, Venkatnarayana Road,<br/>
      T-Nagar, Chennai – 600017
    </p>

    <p><b>Sub:</b> Letter of Undertaking & Confirmation</p>

    <p>
      I, <b>${formData.associateName || "________"}</b>,
      son/daughter/wife of <b>${formData.relativeName || "________"}</b>,
      residing at <b>${formData.address || "________"}</b>,
      employed with SecureKloud Technologies Limited, do hereby confirm as under:
    </p>

    <ol>
      <li>
        I was employed as <b>${formData.designation || "________"}</b>
        with the Company since <b>${formData.joiningDate || "________"}</b>.
      </li>
      <li>
        I have voluntarily resigned from the services of the Company
        on <b>${formData.resignationDate || "________"}</b>.
      </li>
      <li>
        I confirm that I shall not disclose any confidential information
        obtained during my employment.
      </li>
      <li>
        I undertake not to solicit employees/customers or compete with the
        Company for a period of 24 months.
      </li>
      <li>
        Any violation of this undertaking may result in legal action.
      </li>
    </ol>

    ${
      formData.isDirector
        ? `<p><b>Director Clause:</b> I confirm that I have not acted against the interests of the Company.</p>`
        : ""
    }

    <p>
      This Letter of Undertaking shall be governed by the laws of India and
      subject to the jurisdiction of Chennai courts.
    </p>

   <div class="signature">
  <p><b>Signature of the Associate:</b></p>
  ${
    signature && signature.startsWith("data:image/")
      ? `<img src="${signature}" style="width:200px;" />`
      : `<div style="width:200px;border-bottom:1px solid #000;"></div>`
  }
  <p><b>Name:</b> ${formData.associateName || "________"}</p>
  <p><b>Date:</b> ${formData.date || "________"}</p>
  <p><b>Place:</b> ${formData.place || "Chennai"}</p>
</div>


  </body>
  </html>
  `;
}


    // 7) Fallback for all others
    else {
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: auto;">
          <div style="background: #1976d2; color: white; padding: 14px 20px;">
            <h2 style="margin: 0;">Nomination Form Submitted: ${type}</h2>
          </div>
          <div style="padding: 20px;">
            <p><strong>Submitted By:</strong> ${submittedBy || "N/A"}</p>
            ${buildHtmlTable(formData)}
          </div>
        </div>
      `;
    }
   


    // -------------------------
    // Generate PDF
    // -------------------------
    const tmpDir = path.join(__dirname, "../tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfPath = path.join(tmpDir, `nomination_${Date.now()}.pdf`);
    await page.pdf({ path: pdfPath, format: "A4" });
    await browser.close();

    // -------------------------
    // Send Email
    // -------------------------
    await transporter.sendMail({
      from: `"SecureKloud Intranet" <${process.env.EMAIL_USER}>`,
      to: process.env.HR_EMAIL || process.env.DEFAULT_RECIPIENT,
      subject: `Nomination Form Submitted: ${type}`,
      html,
      attachments: [{ filename: "nomination.pdf", path: pdfPath }],
    });

    fs.unlinkSync(pdfPath);

    res.json({ success: true, message: "Nomination saved & email sent with PDF" });
  } catch (err) {
    console.error("❌ Nomination Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;