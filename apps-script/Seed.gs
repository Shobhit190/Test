/**
 * Run seedAll() once (Apps Script editor: select it from the function
 * dropdown, click Run) to populate every sheet from the embedded
 * reference data plus the demo cycle/users. Safe to re-run: it clears
 * and rewrites the relevant sheets each time rather than duplicating rows.
 */

var NAME_FIX_ = {
  "Strategic Thinking & foresight": "Strategic Thinking & Foresight",
  "Influencial Communication": "Influential Communication",
  "Dealing with ambiguity/ Peace with chaos": "Ambiguity Navigation",
  "Bridge Builder Mindset, (Negotiation SkillsInter-personal, Collaboration)": "Bridge-Builder Mindset",
  "Result Orientation (Bias For Action)": "Result Orientation (Bias for Action)",
  "Problem solving": "Problem Solving",
  "Student first integrity": "Student/Education-First Integrity",
  "Attention to Details": "Attention to Detail",
  " Data Analysis": "Data Analysis",
  "Openness to learnings": "Openness to Learnings",
  "Tech -Ed foresight": "Tech-Ed Foresight",
};

function clearSheet_(name) {
  var sheet = getSheet_(name);
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
}

function seedCompetencyDictionary_() {
  clearSheet_(TABLES.COMPETENCIES.name);
  clearSheet_(TABLES.COMPETENCY_LEVELS.name);

  var nameToId = {};

  COMPETENCY_DICTIONARY.competencies.forEach(function (c) {
    var row = insertRow(TABLES.COMPETENCIES.name, TABLES.COMPETENCIES.headers, {
      name: c.name,
      cluster: c.cluster,
      subCluster: c.subCluster,
      isCore: c.isCore,
      definition: c.definition,
      keyBehaviours: c.keyBehaviours.join("\n"),
    });
    nameToId[c.name] = row.id;

    c.levels.forEach(function (level) {
      insertRow(TABLES.COMPETENCY_LEVELS.name, TABLES.COMPETENCY_LEVELS.headers, {
        competencyId: row.id,
        level: level.level,
        subLevelMin: level.subLevelMin,
        subLevelMax: level.subLevelMax,
        levelName: level.levelName,
        behaviourIndicatorsJson: JSON.stringify(level.behaviourIndicators),
      });
    });
  });

  return nameToId;
}

function seedRoleCompetencyMap_(nameToId) {
  clearSheet_(TABLES.DESIGNATIONS.name);
  clearSheet_(TABLES.ROLE_COMPETENCY_MAP.name);

  var designationNameToId = {};

  ROLE_COMPETENCY_MAP.roles.forEach(function (role) {
    var designationId = designationNameToId[role.designation];
    if (!designationId) {
      var row = insertRow(TABLES.DESIGNATIONS.name, TABLES.DESIGNATIONS.headers, {
        name: role.designation,
      });
      designationId = row.id;
      designationNameToId[role.designation] = designationId;
    }

    role.requiredCompetencies.forEach(function (compName) {
      var canonicalName = NAME_FIX_[compName] || compName;
      var competencyId = nameToId[canonicalName];
      if (!competencyId) {
        Logger.log("Competency not found for role map: " + compName);
        return;
      }
      insertRow(TABLES.ROLE_COMPETENCY_MAP.name, TABLES.ROLE_COMPETENCY_MAP.headers, {
        designationId: designationId,
        competencyId: competencyId,
        isRequired: true,
        notes: role.notes || "",
      });
    });
  });

  return designationNameToId;
}

function seedDemoUsersAndCycle_(designationNameToId) {
  clearSheet_(TABLES.GOAL_CYCLES.name);
  insertRow(TABLES.GOAL_CYCLES.name, TABLES.GOAL_CYCLES.headers, {
    name: "FY2025-26",
    startDate: "2025-04-01",
    endDate: "2026-03-31",
    isActive: true,
  });

  clearSheet_(TABLES.USERS.name);
  var passwordHash = hashPassword_("password123");

  var hrAdmin = insertRow(TABLES.USERS.name, TABLES.USERS.headers, {
    email: "hr.admin@example.com",
    name: "Hina Rao (HR Admin)",
    passwordHash: passwordHash,
    systemRole: "HR_ADMIN",
    designationId: "",
    managerId: "",
  });

  var manager = insertRow(TABLES.USERS.name, TABLES.USERS.headers, {
    email: "manager@example.com",
    name: "Mohan Iyer (Manager)",
    passwordHash: passwordHash,
    systemRole: "MANAGER",
    designationId: designationNameToId["Academic Head"] || "",
    managerId: "",
  });

  insertRow(TABLES.USERS.name, TABLES.USERS.headers, {
    email: "employee@example.com",
    name: "Priya Nair (Employee)",
    passwordHash: passwordHash,
    systemRole: "EMPLOYEE",
    designationId: designationNameToId["Business Analyst"] || "",
    managerId: manager.id,
  });

  Logger.log("Seeded demo cycle + users. hrAdmin=%s manager=%s", hrAdmin.email, manager.email);
}

/** Also clears goal data so re-running seedAll() during testing starts clean. */
function clearGoalData_() {
  [TABLES.GOALS, TABLES.KRAS, TABLES.KPIS, TABLES.COMPETENCY_RATINGS, TABLES.APPROVAL_HISTORY].forEach(
    function (t) {
      clearSheet_(t.name);
    }
  );
}

function seedAll() {
  var nameToId = seedCompetencyDictionary_();
  var designationNameToId = seedRoleCompetencyMap_(nameToId);
  seedDemoUsersAndCycle_(designationNameToId);
  clearGoalData_();
  Logger.log(
    "Seed complete: %s competencies, %s designations.",
    Object.keys(nameToId).length,
    Object.keys(designationNameToId).length
  );
  Logger.log("Demo login password for all seeded users: password123");
}
