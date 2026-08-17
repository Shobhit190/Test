/**
 * Minimal auth for a demo/test tool. Passwords are stored as plain text in
 * the Employee Details sheet by design -- HR types a person's password
 * directly into the same row as the rest of their profile (defaulting it
 * to their Employee Code), so hashing it would add no real protection: the
 * plaintext already sits right there in an adjacent cell. Not
 * production-grade auth. The "session" is just the user's id held in the
 * browser's memory for the page's lifetime (passed back on every RPC call).
 */

/** RPC: called from the client login form. */
function login(email, password) {
  resetTableCache_();
  var user = findEmployeeResolved_(function (u) {
    return u.email === str_(email).trim().toLowerCase();
  });
  if (!user) throw new Error("Invalid email or password.");
  if (user.password !== str_(password)) {
    throw new Error("Invalid email or password.");
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    systemRole: user.systemRole,
    designationId: user.designationId,
    managerId: user.managerId,
  };
}

function requireUser_(userId) {
  var user = findEmployeeResolved_(function (u) {
    return u.id === userId;
  });
  if (!user) throw new Error("Not authenticated.");
  return user;
}
