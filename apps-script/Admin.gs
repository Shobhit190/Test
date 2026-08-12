/**
 * Employee-management helpers for HR/Admin. The Apps Script "Run" button
 * can't take arguments, so addEmployeeFromTemplate() below is a
 * fill-in-the-blanks wrapper: edit the values, select it in the function
 * dropdown, and click Run once per employee.
 */

/**
 * Adds a new employee, or updates one if the email already exists (so
 * re-running with the same email is safe -- it won't create a duplicate).
 *
 * - systemRole: "EMPLOYEE", "MANAGER", or "HR_ADMIN"
 * - designationName: must exactly match a name in the Designations tab
 *   (open your Sheet's Designations tab to see the full list of 40), or
 *   "" for none
 * - managerEmail: an existing user's email (add managers before the
 *   employees who report to them), or "" for none
 */
function addEmployee_(email, name, password, systemRole, designationName, managerEmail) {
  email = str_(email).trim().toLowerCase();
  name = str_(name).trim();
  password = str_(password);
  systemRole = str_(systemRole).trim().toUpperCase();
  designationName = str_(designationName).trim();
  managerEmail = str_(managerEmail).trim().toLowerCase();

  if (!email || !name || !password) {
    throw new Error("email, name, and password are all required.");
  }
  if (["EMPLOYEE", "MANAGER", "HR_ADMIN"].indexOf(systemRole) === -1) {
    throw new Error('systemRole must be "EMPLOYEE", "MANAGER", or "HR_ADMIN" (got: "' + systemRole + '").');
  }

  var designationId = "";
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
    designationId = designation.id;
  }

  var managerId = "";
  if (managerEmail) {
    var manager = findOne_(TABLES.USERS.name, TABLES.USERS.headers, function (u) {
      return str_(u.email).trim().toLowerCase() === managerEmail;
    });
    if (!manager) {
      throw new Error('No existing user with email "' + managerEmail + '" found to use as manager.');
    }
    managerId = manager.id;
  }

  var passwordHash = hashPassword_(password);
  var existing = findOne_(TABLES.USERS.name, TABLES.USERS.headers, function (u) {
    return str_(u.email).trim().toLowerCase() === email;
  });

  if (existing) {
    updateRowById(TABLES.USERS.name, TABLES.USERS.headers, existing.id, {
      name: name,
      passwordHash: passwordHash,
      systemRole: systemRole,
      designationId: designationId,
      managerId: managerId,
    });
    Logger.log("Updated existing employee: " + email);
  } else {
    insertRow(TABLES.USERS.name, TABLES.USERS.headers, {
      email: email,
      name: name,
      passwordHash: passwordHash,
      systemRole: systemRole,
      designationId: designationId,
      managerId: managerId,
    });
    Logger.log("Added new employee: " + email);
  }
}

/**
 * Fill in the values below and Run this once per employee. Re-running
 * with the same email updates that person (e.g. to change their
 * designation or reset their password) instead of duplicating them.
 * Add managers before the employees who report to them.
 */
function addEmployeeFromTemplate() {
  addEmployee_(
    "jane.doe@example.com", // email
    "Jane Doe", // name
    "ChangeThisPassword123", // password -- pick something and tell them what it is
    "EMPLOYEE", // "EMPLOYEE", "MANAGER", or "HR_ADMIN"
    "Business Analyst", // designation name, must match the Designations tab exactly, or ""
    "manager@example.com" // their manager's email (must already exist), or ""
  );
}
