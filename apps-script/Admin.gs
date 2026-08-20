/**
 * Employee-management helpers for HR/Admin. The Apps Script "Run" button
 * can't take arguments, so addEmployeeFromTemplate() below is a
 * fill-in-the-blanks wrapper: edit the values, select it in the function
 * dropdown, and click Run once per employee.
 *
 * This does the same thing as typing a row directly into the Employee
 * Details sheet -- use whichever's more convenient. Its main advantage is
 * validating Designation/Manager against what's actually in the sheet
 * before saving, since a typo there silently breaks that person's
 * competency options or approval routing.
 */

/**
 * Adds a new employee, or updates one if the employeeCode already exists
 * (so re-running with the same employeeCode is safe -- it won't create a
 * duplicate row).
 *
 * - employeeCode: becomes this employee's row id. Must be unique.
 * - systemRole: "EMPLOYEE", "MANAGER", or "HR_ADMIN"
 * - designationName: must exactly match a name in the Designations tab, or
 *   "" for none
 * - businessRole: their level on the promotion ladder (e.g. "Associate",
 *   "Manager", "Senior Vice President" -- see the PromotionLevels tab for
 *   the full list). Not validated here since it doesn't apply to everyone
 *   (e.g. Faculty) -- leave "" if it doesn't apply.
 * - managerName: must exactly match an existing employee's Name in the
 *   Employee Details sheet (add managers before the people who report to
 *   them), or "" for none
 * - entity: free text, separate from brand -- optional, defaults to "" if
 *   omitted
 */
function addEmployee_(
  employeeCode,
  email,
  name,
  password,
  systemRole,
  brand,
  designationName,
  businessRole,
  goalCycle,
  assessmentPeriod,
  managerName,
  entity
) {
  employeeCode = str_(employeeCode).trim();
  email = str_(email).trim().toLowerCase();
  name = str_(name).trim();
  password = str_(password);
  systemRole = str_(systemRole).trim().toUpperCase();
  brand = str_(brand).trim();
  designationName = str_(designationName).trim();
  businessRole = str_(businessRole).trim();
  goalCycle = str_(goalCycle).trim();
  assessmentPeriod = str_(assessmentPeriod).trim();
  managerName = str_(managerName).trim();
  entity = str_(entity).trim();

  if (!employeeCode || !email || !name || !password) {
    throw new Error("employeeCode, email, name, and password are all required.");
  }
  if (["EMPLOYEE", "MANAGER", "HR_ADMIN"].indexOf(systemRole) === -1) {
    throw new Error('systemRole must be "EMPLOYEE", "MANAGER", or "HR_ADMIN" (got: "' + systemRole + '").');
  }

  if (designationName) {
    var designation = findOne_(TABLES.DESIGNATIONS.name, TABLES.DESIGNATIONS.headers, function (d) {
      return str_(d.name).trim().toLowerCase() === designationName.toLowerCase();
    });
    if (!designation) {
      throw new Error(
        'No designation named "' +
          designationName +
          '" found. Check the Designations tab for the exact spelling, or leave it blank.'
      );
    }
  }

  if (managerName) {
    var manager = findOne_(TABLES.USERS.name, TABLES.USERS.headers, function (u) {
      return str_(u.name).trim().toLowerCase() === managerName.toLowerCase();
    });
    if (!manager) {
      throw new Error(
        'No existing employee named "' +
          managerName +
          '" found to use as manager. Add managers before the people who report to them.'
      );
    }
  }

  var existingByCode = findOne_(TABLES.USERS.name, TABLES.USERS.headers, function (u) {
    return u.id === employeeCode;
  });
  var existingByEmail = findOne_(TABLES.USERS.name, TABLES.USERS.headers, function (u) {
    return str_(u.email).trim().toLowerCase() === email;
  });
  if (existingByEmail && (!existingByCode || existingByEmail.id !== existingByCode.id)) {
    throw new Error('Email "' + email + '" is already used by employee code "' + existingByEmail.id + '".');
  }

  var data = {
    name: name,
    brand: brand,
    designation: designationName,
    businessRole: businessRole,
    managerName: managerName,
    role: systemRole,
    goalCycle: goalCycle,
    assessmentPeriod: assessmentPeriod,
    email: email,
    password: password,
    entity: entity,
  };

  if (existingByCode) {
    updateRowById(TABLES.USERS.name, TABLES.USERS.headers, employeeCode, data);
    Logger.log("Updated existing employee: " + employeeCode);
  } else {
    data.id = employeeCode;
    insertRow(TABLES.USERS.name, TABLES.USERS.headers, data);
    Logger.log("Added new employee: " + employeeCode);
  }
}

/**
 * Fill in the values below and Run this once per employee. Re-running
 * with the same employeeCode updates that person (e.g. to change their
 * designation or reset their password) instead of duplicating them.
 * Add managers before the employees who report to them.
 */
function addEmployeeFromTemplate() {
  addEmployee_(
    "EMP1024", // employee code -- becomes their row id, must be unique
    "jane.doe@example.com", // email
    "Jane Doe", // name
    "EMP1024", // password -- defaults to the employee code, change if you want something else
    "EMPLOYEE", // "EMPLOYEE", "MANAGER", or "HR_ADMIN"
    "Acme Learning", // brand
    "Business Analyst", // designation name, must match the Designations tab exactly, or ""
    "Associate", // business role / promotion-ladder level, must match the PromotionLevels tab exactly, or ""
    "FY2025-26", // goal cycle
    "FY2025-26", // assessment period
    "Jane Manager", // their manager's Name, must match an existing employee exactly, or ""
    "Elevate" // entity, free text, separate from brand -- or ""
  );
}
