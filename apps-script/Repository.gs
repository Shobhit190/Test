/**
 * Higher-level domain queries built on top of the generic table helpers.
 */

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

function getRequiredCompetenciesForUser_(userId) {
  var user = requireUser_(userId);
  var competencies = readTable(TABLES.COMPETENCIES.name, TABLES.COMPETENCIES.headers);
  var levels = readTable(TABLES.COMPETENCY_LEVELS.name, TABLES.COMPETENCY_LEVELS.headers);
  var competenciesById = indexBy_(competencies, "id");
  var levelsByCompetency = groupBy_(levels, "competencyId");

  var roleMap = readTable(TABLES.ROLE_COMPETENCY_MAP.name, TABLES.ROLE_COMPETENCY_MAP.headers);
  var roleMapped = roleMap.filter(function (m) {
    return (
      m.designationId === user.designationId &&
      (m.isRequired === true || m.isRequired === "TRUE" || m.isRequired === "true")
    );
  });

  var coreCompetencies = competencies.filter(function (c) {
    return c.isCore === true || c.isCore === "TRUE" || c.isCore === "true";
  });

  var seen = {};
  var options = [];
  roleMapped.forEach(function (m) {
    if (seen[m.competencyId]) return;
    seen[m.competencyId] = true;
    var comp = getCompetencyWithLevels_(m.competencyId, competenciesById, levelsByCompetency);
    if (comp) options.push({ competency: comp, fromRole: true });
  });
  coreCompetencies.forEach(function (c) {
    if (seen[c.id]) return;
    seen[c.id] = true;
    var comp = getCompetencyWithLevels_(c.id, competenciesById, levelsByCompetency);
    if (comp) options.push({ competency: comp, fromRole: false });
  });
  options.sort(function (a, b) {
    return a.competency.name.localeCompare(b.competency.name);
  });

  var designation = null;
  if (user.designationId) {
    designation = findOne_(TABLES.DESIGNATIONS.name, TABLES.DESIGNATIONS.headers, function (d) {
      return d.id === user.designationId;
    });
  }

  return {
    designationName: designation ? designation.name : null,
    options: options,
  };
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

  var competencies = readTable(TABLES.COMPETENCIES.name, TABLES.COMPETENCIES.headers);
  var levels = readTable(TABLES.COMPETENCY_LEVELS.name, TABLES.COMPETENCY_LEVELS.headers);
  var competenciesById = indexBy_(competencies, "id");
  var levelsByCompetency = groupBy_(levels, "competencyId");

  var ratings = readTable(TABLES.COMPETENCY_RATINGS.name, TABLES.COMPETENCY_RATINGS.headers)
    .filter(function (r) {
      return r.goalId === goalId;
    })
    .map(function (r) {
      return {
        id: r.id,
        competencyId: r.competencyId,
        subLevel: Number(r.subLevel),
        selfComment: r.selfComment,
        competency: getCompetencyWithLevels_(r.competencyId, competenciesById, levelsByCompetency),
      };
    });

  var users = readTable(TABLES.USERS.name, TABLES.USERS.headers);
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
  var designations = readTable(TABLES.DESIGNATIONS.name, TABLES.DESIGNATIONS.headers);
  var designationsById = indexBy_(designations, "id");
  var employeeDesignation =
    employee && employee.designationId ? designationsById[employee.designationId] : null;

  return {
    id: goal.id,
    employeeId: goal.employeeId,
    employeeName: employee ? employee.name : "Unknown",
    employeeManagerId: employee ? employee.managerId : null,
    employeeDesignationName: employeeDesignation ? employeeDesignation.name : null,
    cycleId: goal.cycleId,
    status: goal.status,
    submittedAt: goal.submittedAt,
    approvedAt: goal.approvedAt,
    kras: kras,
    competencyRatings: ratings,
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
