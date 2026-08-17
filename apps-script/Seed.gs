/**
 * Run seedAll() to populate every sheet from the embedded reference data
 * plus the demo cycle/users. Safe to re-run at any time, including after
 * you've added real employees: it upserts reference data (Competencies,
 * CompetencyLevels, Designations, RoleCompetencyMap, PromotionLevels,
 * PromotionCompetencyMap, the FY2025-26 cycle) by matching on
 * name/natural-key rather than wiping the sheet, and it never touches an
 * existing user or any Goal data. The demo accounts are only created if
 * missing -- if you've since edited or removed one, this won't recreate
 * or overwrite it.
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

function upsert_(tableName, headers, matchFn, data) {
  var existing = findOne_(tableName, headers, matchFn);
  if (existing) {
    return updateRowById(tableName, headers, existing.id, data);
  }
  return insertRow(tableName, headers, data);
}

function seedCompetencyDictionary_() {
  var nameToId = {};

  COMPETENCY_DICTIONARY.competencies.forEach(function (c) {
    var row = upsert_(
      TABLES.COMPETENCIES.name,
      TABLES.COMPETENCIES.headers,
      function (existing) {
        return existing.name === c.name && existing.subCluster === c.subCluster;
      },
      {
        name: c.name,
        cluster: c.cluster,
        subCluster: c.subCluster,
        isCore: c.isCore,
        definition: c.definition,
        keyBehaviours: c.keyBehaviours.join("\n"),
      }
    );
    nameToId[c.name] = row.id;

    c.levels.forEach(function (level) {
      upsert_(
        TABLES.COMPETENCY_LEVELS.name,
        TABLES.COMPETENCY_LEVELS.headers,
        function (existing) {
          return existing.competencyId === row.id && existing.level === level.level;
        },
        {
          competencyId: row.id,
          level: level.level,
          subLevelMin: level.subLevelMin,
          subLevelMax: level.subLevelMax,
          levelName: level.levelName,
          behaviourIndicatorsJson: JSON.stringify(level.behaviourIndicators),
        }
      );
    });
  });

  return nameToId;
}

function seedRoleCompetencyMap_(nameToId) {
  var designationNameToId = {};

  ROLE_COMPETENCY_MAP.roles.forEach(function (role) {
    var designationId = designationNameToId[role.designation];
    if (!designationId) {
      var row = upsert_(
        TABLES.DESIGNATIONS.name,
        TABLES.DESIGNATIONS.headers,
        function (existing) {
          return existing.name === role.designation;
        },
        { name: role.designation }
      );
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
      upsert_(
        TABLES.ROLE_COMPETENCY_MAP.name,
        TABLES.ROLE_COMPETENCY_MAP.headers,
        function (existing) {
          return existing.designationId === designationId && existing.competencyId === competencyId;
        },
        { designationId: designationId, competencyId: competencyId, isRequired: true, notes: role.notes || "" }
      );
    });
  });

  return designationNameToId;
}

function seedDemoUsersAndCycle_() {
  upsert_(
    TABLES.GOAL_CYCLES.name,
    TABLES.GOAL_CYCLES.headers,
    function (existing) {
      return existing.name === "FY2025-26";
    },
    { name: "FY2025-26", startDate: "2025-04-01", endDate: "2026-03-31", isActive: true }
  );

  function ensureDemoUser(employeeCode, data) {
    var existing = findOne_(TABLES.USERS.name, TABLES.USERS.headers, function (u) {
      return u.id === employeeCode;
    });
    if (existing) return existing; // never touch a user that already exists
    data.id = employeeCode;
    return insertRow(TABLES.USERS.name, TABLES.USERS.headers, data);
  }

  var hrAdmin = ensureDemoUser("HR001", {
    name: "Hina Rao (HR Admin)",
    brand: "",
    designation: "",
    businessRole: "",
    managerName: "",
    role: "HR_ADMIN",
    goalCycle: "FY2025-26",
    assessmentPeriod: "FY2025-26",
    email: "hr.admin@example.com",
    password: "password123",
  });

  var manager = ensureDemoUser("MGR001", {
    name: "Mohan Iyer (Manager)",
    brand: "",
    designation: "Academic Head",
    businessRole: "Manager",
    managerName: "",
    role: "MANAGER",
    goalCycle: "FY2025-26",
    assessmentPeriod: "FY2025-26",
    email: "manager@example.com",
    password: "password123",
  });

  ensureDemoUser("EMP001", {
    name: "Priya Nair (Employee)",
    brand: "",
    designation: "Business Analyst",
    businessRole: "Associate",
    managerName: manager.name,
    role: "EMPLOYEE",
    goalCycle: "FY2025-26",
    assessmentPeriod: "FY2025-26",
    email: "employee@example.com",
    password: "password123",
  });

  Logger.log("Demo cycle/users ready. hrAdmin=%s manager=%s", hrAdmin.email, manager.email);
}

/**
 * Deletes ALL goal-related data (Goals, KRAs, KPIs, CompetencyRatings,
 * ApprovalHistory) for every employee. NOT called automatically by
 * seedAll() -- run this yourself only if you deliberately want to wipe
 * everyone's in-progress goals and start a cycle over.
 */
function clearGoalData_() {
  [TABLES.GOALS, TABLES.KRAS, TABLES.KPIS, TABLES.COMPETENCY_RATINGS, TABLES.APPROVAL_HISTORY].forEach(
    function (t) {
      clearSheet_(t.name);
    }
  );
  Logger.log("Cleared all goal data.");
}

function seedAll() {
  var nameToId = seedCompetencyDictionary_();
  var designationNameToId = seedRoleCompetencyMap_(nameToId);
  seedPromotionLevels_();
  seedDemoUsersAndCycle_();
  Logger.log(
    "Seed complete: %s competencies, %s designations, %s promotion levels.",
    Object.keys(nameToId).length,
    Object.keys(designationNameToId).length,
    PROMOTION_LEVELS_DATA.length
  );
  Logger.log("Demo login password for all seeded users: password123");
}
