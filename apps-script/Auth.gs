/**
 * Minimal auth for a demo/test tool. Not production-grade: SHA-256, no
 * salt, and the "session" is just the user's id held in the browser's
 * memory for the page's lifetime (passed back on every RPC call).
 */

function hashPassword_(password) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password);
  return digest
    .map(function (b) {
      var v = b < 0 ? b + 256 : b;
      var hex = v.toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    })
    .join("");
}

/** RPC: called from the client login form. */
function login(email, password) {
  var user = findOne_(TABLES.USERS.name, TABLES.USERS.headers, function (u) {
    return String(u.email).toLowerCase() === String(email).toLowerCase();
  });
  if (!user) throw new Error("Invalid email or password.");
  if (user.passwordHash !== hashPassword_(password)) {
    throw new Error("Invalid email or password.");
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    systemRole: user.systemRole,
    designationId: user.designationId || null,
    managerId: user.managerId || null,
  };
}

function requireUser_(userId) {
  var user = findOne_(TABLES.USERS.name, TABLES.USERS.headers, function (u) {
    return u.id === userId;
  });
  if (!user) throw new Error("Not authenticated.");
  return user;
}
