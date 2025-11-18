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
    function normalizeKeys(data) {
  if (!data || typeof data !== "object") return data;
  const normalized = {};
  for (const [key, value] of Object.entries(data)) {
    const newKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    normalized[newKey] =
      typeof value === "object" ? normalizeKeys(value) : value;
  }
  return normalized;
}


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

    // 2) Contract Invoice Template
    else if (type === "Contract Invoice Template") {
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: auto;">
          <h2 style="text-align:center; color:#2E86C1;">Tax Invoice</h2>
          <h3>Pay To:</h3>
          <p><strong>Invoice Number:</strong> ${formData.invoiceNumber}</p>
          <p><strong>Name of the Consultant:</strong> ${formData.consultantName}</p>
          <p><strong>Invoice Date:</strong> ${formData.invoiceDate}</p>
          <p><strong>Address:</strong> ${formData.consultantAddress}</p>
          <p><strong>Mobile Number:</strong> ${formData.consultantMobile}</p>

          <h3>Bill To:</h3>
          <p>SecureKloud Technologies Limited,<br/>
          5th Floor, No. 37 & 38, ASV Ramana Towers,<br/>
          Venkat Narayana Road, T Nagar,<br/>
          Chennai – 600017.</p>

          <table border="1" cellspacing="0" cellpadding="6" style="border-collapse: collapse; width: 100%; margin:20px 0;">
            <tr style="background:#f2f2f2;">
              <th>S No.</th><th>Service Description</th><th>Hours</th><th>Rate - INR</th><th>Amount - INR</th>
            </tr>
            <tr>
              <td>1</td>
              <td>${formData.serviceDescription}</td>
              <td>${formData.hours}</td>
              <td>${formData.rate}</td>
              <td>${formData.amount}</td>
            </tr>
          </table>

          <p><strong>Total Amount:</strong> ${formData.amount}</p>
          <h3>Bank Details</h3>
          <p><strong>Bank Name:</strong> ${formData.bankName}</p>
          <p><strong>Bank Branch:</strong> ${formData.bankBranch}</p>
          <p><strong>IFSC Code:</strong> ${formData.ifscCode}</p>
          <p><strong>Account Number:</strong> ${formData.accountNumber}</p>
          <p><strong>PAN Card Number:</strong> ${formData.panNumber}</p>
        </div>
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
    else if (type === "Expense Reimbursement") {
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: auto;">
          <h2 style="text-align:center; color:#27AE60;">Expense Reimbursement</h2>
          ${buildHtmlTable(formData)}
        </div>
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
    else if (type === "Intern to Onroll") {
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: auto;">
          <h2 style="text-align:center; color:#8E44AD;">Intern to Onroll Conversion</h2>
          ${buildHtmlTable(formData)}
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
      <b>Employee Name & Signature:</b> ${formData.employeeName || "________"}</p>

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
  // Fix naming differences between frontend and backend
normalizedFormData.nominated_by = formData.nominatedBy || "";
normalizedFormData.nominated_by_designation = formData.nominatedByDesignation || "";
normalizedFormData.routed_by = formData.routedBy || "";
normalizedFormData.routed_by_designation = formData.routedByDesignation || "";

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
          .signature-table td {
              border: none;
              padding: 8px;
          }
          .signature-label {
              width: 15%;
              font-weight: bold;
              color: #555;
          }
          .signature-input {
              width: 35%;
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
              <th>Associate Name</th><td>${normalizedFormData.associate_name || ""}</td>
              <th>Date of Joining</th><td>${normalizedFormData.doj || normalizedFormData.date_of_joining || ""}</td>
          </tr>
          <tr>
              <th>Designation</th><td>${normalizedFormData.designation || ""}</td>
              <th>Project / Dept</th><td>${normalizedFormData.project || normalizedFormData.project_dept || ""}</td>
          </tr>
          <tr>
              <th>In this Role Since</th><td>${normalizedFormData.role_since || normalizedFormData.roleSince || ""}</td>
              <th>Nomination Period</th><td>${normalizedFormData.nomination_period || normalizedFormData.nominationPeriod || ""}</td>
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
              <tr><td>01</td><td>Consistently Exceptional Performance</td><td>${normalizedFormData.accomplishments?.exceptional_performance || normalizedFormData.a_performance || ""}</td></tr>
              <tr><td>02</td><td>Process Compliance / Quality of Work Deliverable</td><td>${normalizedFormData.accomplishments?.process_compliance || normalizedFormData.a_compliance || ""}</td></tr>
              <tr><td>03</td><td>Initiatives Rolled out</td><td>${normalizedFormData.accomplishments?.initiatives || normalizedFormData.a_initiatives || ""}</td></tr>
              <tr><td>04</td><td>Learning</td><td>${normalizedFormData.accomplishments?.learning || normalizedFormData.a_learning || ""}</td></tr>
              <tr><td>05</td><td>Knowledge Sharing / Training Imparted</td><td>${normalizedFormData.accomplishments?.knowledge_sharing || normalizedFormData.a_sharing || ""}</td></tr>
              <tr><td>06</td><td>Awareness and Adherence to Policies</td><td>${normalizedFormData.accomplishments?.policy_adherence || normalizedFormData.a_policies || ""}</td></tr>
              <tr><td>07</td><td>Client Appreciation, if any</td><td>${normalizedFormData.accomplishments?.client_appreciation || normalizedFormData.a_client_appreciation || ""}</td></tr>
              <tr><td>08</td><td>Potential Shown for the next role, if any</td><td>${normalizedFormData.accomplishments?.potential || normalizedFormData.a_potential || ""}</td></tr>
              <tr><td>09</td><td>Participation in Team / Organizational activities</td><td>${normalizedFormData.accomplishments?.participation || normalizedFormData.a_participation || ""}</td></tr>
              <tr><td>10</td><td>Others, if any</td><td>${normalizedFormData.accomplishments?.others || normalizedFormData.a_others || ""}</td></tr>
          </tbody>
      </table>
<h3>NOMINATOR DETAILS</h3>
<table class="signature-table">
  <tr>
    <td class="signature-label">Nominated By</td>
    <td class="signature-input">${normalizedFormData.nominated_by || ""}</td>
    <td class="signature-label">Designation</td>
    <td class="signature-input">${normalizedFormData.nominated_by_designation || ""}</td>
  </tr>
  <tr>
    <td class="signature-label">Routed By</td>
    <td class="signature-input">${normalizedFormData.routed_by || ""}</td>
    <td class="signature-label">Designation</td>
    <td class="signature-input">${normalizedFormData.routed_by_designation || ""}</td>
  </tr>
</table>

      

  </body>
  </html>
  `;
}
else if (type === "Team of the Quarter") {
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
  const normalizedFormData = normalizeKeys(formData);

  html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>SECUREKLOUD - Team of the Year Nomination Form</title>
      <style>
          body { font-family: Arial, sans-serif; margin: 20px; background-color: #f4f4f4; }
          .header-box {
              background-color: #e3f2fd;
              border: 1px solid #bbdefb;
              padding: 15px;
              margin-bottom: 20px;
              text-align: center;
          }
          h2 { color: #1a237e; margin: 5px 0; }
          h3 {
              color: #333;
              border-bottom: 2px solid #a8a8a8;
              padding-bottom: 8px;
              margin-top: 30px;
              margin-bottom: 15px;
          }
          table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
              background-color: #fff;
              box-shadow: 0 1px 3px rgba(0,0,0,0.08);
          }
          th, td {
              border: 1px solid #ddd;
              padding: 10px;
              text-align: left;
              vertical-align: middle;
          }
          th { background-color: #e8eaf6; font-weight: bold; color: #333; }
          .criteria-col { width: 30%; font-weight: bold; background-color: #f7f7ff; }
          .accomplishment-col { width: 60%; }
          .version-table { float: right; margin-top: -60px; font-size: 0.85em; }
          .version-table th { background-color: #e8eaf6; padding: 5px 10px; }
      </style>
  </head>
  <body>
      <div class="header-box">
          <img src="http://localhost:8081/SecureKloud_Logo.jpg" 
               alt="SecureKloud Logo" 
               style="width:150px; margin-bottom:10px;">
          <h2>SECUREKLOUD</h2>
          <h2>NOMINATION FORM - TEAM OF THE YEAR</h2>
      </div>

      <table class="version-table">
          <tr><th>Version No</th><th>Version Date</th></tr>
          <tr><td>1.0</td><td>14-Jan-21</td></tr>
      </table>

      <h3>TEAM DETAILS</h3>
      <table>
          <tr><th>Name of the Project</th><td>${normalizedFormData.project_name || ""}</td>
              <th>Date of Commencement</th><td>${normalizedFormData.date_commencement || ""}</td></tr>
          <tr><th>Number of Members</th><td>${normalizedFormData.number_of_members || ""}</td>
              <th>Nomination Period</th><td>${normalizedFormData.nomination_period || ""}</td></tr>
          <tr><th>Names of Members</th><td colspan="3">${normalizedFormData.names_of_members || ""}</td></tr>
          <tr><th>Previous Nomination Details</th><td colspan="3">${normalizedFormData.previous_nomination_details || ""}</td></tr>
      </table>

      <h3>ACCOMPLISHMENTS AGAINST CRITERIA</h3>
      <table>
          <tr><th>01</th><td class="criteria-col">Consistently Exceptional Deliverable</td><td>${normalizedFormData.a_deliverable || ""}</td></tr>
          <tr><th>02</th><td class="criteria-col">Utilization of Resources</td><td>${normalizedFormData.a_utilization || ""}</td></tr>
          <tr><th>03</th><td class="criteria-col">Productivity of Resources</td><td>${normalizedFormData.a_productivity || ""}</td></tr>
          <tr><th>04</th><td class="criteria-col">Knowledge within the team</td><td>${normalizedFormData.a_knowledge || ""}</td></tr>
          <tr><th>05</th><td class="criteria-col">Risk Management</td><td>${normalizedFormData.a_risk || ""}</td></tr>
          <tr><th>06</th><td class="criteria-col">Customer Satisfaction Report / Feedback</td><td>${normalizedFormData.a_customer_sat || ""}</td></tr>
          <tr><th>07</th><td class="criteria-col">Team Bonding / Motivation</td><td>${normalizedFormData.a_team_bonding || ""}</td></tr>
          <tr><th>08</th><td class="criteria-col">Process Compliance / Quality of Work</td><td>${normalizedFormData.a_compliance || ""}</td></tr>
          <tr><th>09</th><td class="criteria-col">Impact on Project / Business / Customer</td><td>${normalizedFormData.a_impact || ""}</td></tr>
          <tr><th>10</th><td class="criteria-col">Cost Effective Initiatives</td><td>${normalizedFormData.a_cost_effective || ""}</td></tr>
          <tr><th>11</th><td class="criteria-col">Contribution to Organizational Targets</td><td>${normalizedFormData.a_contribution || ""}</td></tr>
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
