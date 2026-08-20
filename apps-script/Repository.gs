/**
 * Higher-level domain queries built on top of the generic table helpers.
 */

/**
 * Employee Details rows store Designation, Business Role and Manager as
 * free text (typed directly into the sheet, or via Admin.gs) rather than
 * internal ids. This resolves all of them dynamically against the
 * Designations / PromotionLevels tabs and other employees' Name column,
 * and normalizes "role" into the systemRole shape the rest of the app
 * expects. Always read employees through this (or findEmployeeResolved_)
 * rather than raw readTable/findOne_ on TABLES.USERS, so a rename in the
 * sheet takes effect immediately.
 */
function readEmployeesResolved_() {
  var raw = readTable(TABLES.USERS.name, TABLES.USERS.headers);
  var designations = readTable(TABLES.DESIGNATIONS.name, TABLES.DESIGNATIONS.headers);
  var designationIdByName = {};
  designations.forEach(function (d) {
    designationIdByName[str_(d.name).trim().toLowerCase()] = d.id;
  });
  var promotionLevels = readTable(TABLES.PROMOTION_LEVELS.name, TABLES.PROMOTION_LEVELS.headers);
  var promotionLevelIdByName = {};
  promotionLevels.forEach(function (l) {
    promotionLevelIdByName[str_(l.name).trim().toLowerCase()] = l.id;
  });
  var idByName = {};
  raw.forEach(function (u) {
    idByName[str_(u.name).trim().toLowerCase()] = u.id;
  });
  return raw.map(function (u) {
    var designationName = str_(u.designation).trim();
    // Business Role is usually left blank in the sheet: for Full-Time staff,
    // Designation already IS a ladder level name (e.g. "Senior Associate"),
    // so it resolves automatically with no separate manual entry. The
    // Business Role column only needs filling in when Designation doesn't
    // match a ladder level (e.g. it uses a different job title) but the
    // person should still be placed on the ladder somewhere else.
    var businessRole = str_(u.businessRole).trim() || designationName;
    var managerName = str_(u.managerName).trim();
    return {
      id: u.id,
      employeeCode: u.id,
      name: str_(u.name).trim(),
      brand: str_(u.brand).trim(),
      designationName: designationName,
      designationId: designationName ? designationIdByName[designationName.toLowerCase()] || null : null,
      businessRole: businessRole,
      promotionLevelId: businessRole ? promotionLevelIdByName[businessRole.toLowerCase()] || null : null,
      managerName: managerName,
      managerId: managerName ? idByName[managerName.toLowerCase()] || null : null,
      systemRole: str_(u.role).trim().toUpperCase(),
      goalCycle: str_(u.goalCycle).trim(),
      assessmentPeriod: str_(u.assessmentPeriod).trim(),
      email: str_(u.email).trim().toLowerCase(),
      password: str_(u.password),
    };
  });
}

function findEmployeeResolved_(predicate) {
  var all = readEmployeesResolved_();
  for (var i = 0; i < all.length; i++) {
    if (predicate(all[i])) return all[i];
  }
  return null;
}

function getActiveCycle_() {
  var cycles = readTable(TABLES.GOAL_CYCLES.name, TABLES.GOAL_CYCLES.headers);
  var active = cycles.filter(function (c) {
    return c.isActive === true || c.isActive === "TRUE" || c.isActive === "true";
  });
  if (active.length === 0) throw new Error("No active goal cycle configured. Run seedAll() first.");
  active.sort(function (a, b) {
    return new Date(b.startDate) - new Date(a.startDate);
  });
  return active[0];
}

function parseIndicators_(json) {
  if (!json) return [];
  try {
    return JSON.parse(json);
  } catch (e) {
    return [];
  }
}

function getCompetencyWithLevels_(competencyId, competenciesById, levelsByCompetency) {
  var comp = competenciesById[competencyId];
  if (!comp) return null;
  var levels = (levelsByCompetency[competencyId] || [])
    .slice()
    .sort(function (a, b) {
      return a.subLevelMin - b.subLevelMin;
    })
    .map(function (l) {
      return {
        level: l.level,
        subLevelMin: l.subLevelMin,
        subLevelMax: l.subLevelMax,
        levelName: l.levelName,
        behaviourIndicators: parseIndicators_(l.behaviourIndicatorsJson),
      };
    });
  return {
    id: comp.id,
    name: comp.name,
    cluster: comp.cluster,
    subCluster: comp.subCluster,
    isCore: comp.isCore === true || comp.isCore === "TRUE" || comp.isCore === "true",
    definition: comp.definition,
    keyBehaviours: comp.keyBehaviours,
    levels: levels,
  };
}

function indexBy_(rows, key) {
  var out = {};
  rows.forEach(function (r) {
    out[r[key]] = r;
  });
  return out;
}

function groupBy_(rows, key) {
  var out = {};
  rows.forEach(function (r) {
    var k = r[key];
    if (!out[k]) out[k] = [];
    out[k].push(r);
  });
  return out;
}

/**
 * A manager's entire downline: direct reports, their reports, and so on,
 * however many levels deep. Used for the dashboard's team rollup, which is
 * meant to show a manager everyone beneath them -- not just people who
 * report to them directly. This does NOT affect who can approve/return a
 * goal (that's still the person's direct manager only -- see
 * getApprovalQueue's managerId check).
 */
function getDownlineIds_(users, managerId) {
  var byManager = groupBy_(users, "managerId");
  var result = [];
  var queue = (byManager[managerId] || []).slice();
  while (queue.length > 0) {
    var u = queue.shift();
    result.push(u.id);
    (byManager[u.id] || []).forEach(function (report) {
      queue.push(report);
    });
  }
  return result;
}

/**
 * The competencies an employee should self-rate for promotion readiness:
 * their *next* PromotionLevels rung's promotion-critical competencies (or
 * their own level's, if they're already at the top of the ladder). Returns
 * an empty options list if their Business Role doesn't resolve to a known
 * level (blank, a typo, or intentionally out of scope like Faculty).
 */
function getPromotionCompetenciesForUser_(userId) {
  var user = requireUser_(userId);
  var levels = readTable(TABLES.PROMOTION_LEVELS.name, TABLES.PROMOTION_LEVELS.headers);
  var levelsById = indexBy_(levels, "id");
  var currentLevel = user.promotionLevelId ? levelsById[user.promotionLevelId] : null;

  if (!currentLevel) {
    return {
      currentLevelName: user.businessRole || null,
      targetLevelName: null,
      isTopLevel: false,
      options: [],
      targetMaturityMin: null,
      targetMaturityMax: null,
    };
  }

  var nextLevel = levels.filter(function (l) {
    return Number(l.order) === Number(currentLevel.order) + 1;
  })[0];
  var isTopLevel = !nextLevel;
  var targetLevel = nextLevel || currentLevel;

  var competencies = readTable(TABLES.COMPETENCIES.name, TABLES.COMPETENCIES.headers);
  var compLevels = readTable(TABLES.COMPETENCY_LEVELS.name, TABLES.COMPETENCY_LEVELS.headers);
  var competenciesById = indexBy_(competencies, "id");
  var levelsByCompetency = groupBy_(compLevels, "competencyId");

  var options = readTable(TABLES.PROMOTION_COMPETENCY_MAP.name, TABLES.PROMOTION_COMPETENCY_MAP.headers)
    .filter(function (m) {
      return m.levelId === targetLevel.id;
    })
    .map(function (m) {
      var comp = getCompetencyWithLevels_(m.competencyId, competenciesById, levelsByCompetency);
      return comp ? { competency: comp } : null;
    })
    .filter(function (o) {
      return o;
    });

  return {
    currentLevelName: currentLevel.name,
    targetLevelName: targetLevel.name,
    isTopLevel: isTopLevel,
    options: options,
    targetMaturityMin: Number(targetLevel.maturityMin),
    targetMaturityMax: Number(targetLevel.maturityMax),
  };
}

/**
 * A goal can't be submitted until the employee has self-rated every
 * competency on their Development tab -- but only when there's something to
 * rate. Someone with no resolvable Business Role (blank, a typo, or
 * intentionally out of scope like Faculty) has no options at all, so their
 * goal submission isn't blocked by a screen they have nothing to fill in.
 */
function validatePromotionRatingsComplete_(userId) {
  var info = getPromotionCompetenciesForUser_(userId);
  if (info.options.length === 0) return [];

  var existing = readTable(TABLES.PROMOTION_RATINGS.name, TABLES.PROMOTION_RATINGS.headers).filter(function (r) {
    return r.employeeId === userId;
  });
  var ratedCompetencyIds = {};
  existing.forEach(function (r) {
    ratedCompetencyIds[r.competencyId] = true;
  });
  var missing = info.options.filter(function (o) {
    return !ratedCompetencyIds[o.competency.id];
  });
  if (missing.length === 0) return [];

  return [
    "Please self-rate all " +
      info.options.length +
      " competencies on the Development tab before submitting your goal (" +
      missing.length +
      " left to rate).",
  ];
}

/** Assembles the full nested Goal object (kras/kpis/ratings/history) for one goal id. */
function getFullGoal_(goalId) {
  var goal = findOne_(TABLES.GOALS.name, TABLES.GOALS.headers, function (g) {
    return g.id === goalId;
  });
  if (!goal) return null;

  var allKras = readTable(TABLES.KRAS.name, TABLES.KRAS.headers)
    .filter(function (k) {
      return k.goalId === goalId;
    })
    .sort(function (a, b) {
      return a.order - b.order;
    });
  var allKpis = readTable(TABLES.KPIS.name, TABLES.KPIS.headers);
  var kras = allKras.map(function (k) {
    var kpis = allKpis
      .filter(function (kpi) {
        return kpi.kraId === k.id;
      })
      .sort(function (a, b) {
        return a.order - b.order;
      })
      .map(function (kpi) {
        return { id: kpi.id, title: kpi.title, target: kpi.target };
      });
    return {
      id: k.id,
      title: k.title,
      description: k.description,
      weight: Number(k.weight),
      kpis: kpis,
    };
  });

  var users = readEmployeesResolved_();
  var usersById = indexBy_(users, "id");
  var history = readTable(TABLES.APPROVAL_HISTORY.name, TABLES.APPROVAL_HISTORY.headers)
    .filter(function (h) {
      return h.goalId === goalId;
    })
    .sort(function (a, b) {
      return new Date(a.createdAt) - new Date(b.createdAt);
    })
    .map(function (h) {
      var actor = usersById[h.actorId];
      return {
        id: h.id,
        action: h.action,
        actorName: actor ? actor.name : "Unknown",
        comment: h.comment,
        createdAt: h.createdAt,
      };
    });

  var employee = usersById[goal.employeeId];

  return {
    id: goal.id,
    employeeId: goal.employeeId,
    employeeName: employee ? employee.name : "Unknown",
    employeeManagerId: employee ? employee.managerId : null,
    employeeDesignationName: employee ? employee.designationName : null,
    cycleId: goal.cycleId,
    status: goal.status,
    submittedAt: goal.submittedAt,
    approvedAt: goal.approvedAt,
    kras: kras,
    approvalHistory: history,
  };
}

/** Finds (or creates) this user's Goal for the active cycle, and returns it fully assembled. */
function getOrCreateGoal_(userId) {
  var cycle = getActiveCycle_();
  var existing = findOne_(TABLES.GOALS.name, TABLES.GOALS.headers, function (g) {
    return g.employeeId === userId && g.cycleId === cycle.id;
  });
  if (!existing) {
    var now = new Date().toISOString();
    existing = insertRow(TABLES.GOALS.name, TABLES.GOALS.headers, {
      employeeId: userId,
      cycleId: cycle.id,
      status: "DRAFT",
      submittedAt: "",
      approvedAt: "",
      createdAt: now,
      updatedAt: now,
    });
  }
  return getFullGoal_(existing.id);
}
