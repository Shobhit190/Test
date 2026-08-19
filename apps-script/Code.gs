/**
 * Web app entry point + RPC functions callable from the client via
 * google.script.run. Every RPC takes the calling user's id as its
 * first argument (the browser holds it in memory after login and
 * passes it back on each call) and re-checks authorization server-side.
 */

function doGet() {
  return HtmlService.createTemplateFromFile("Index")
    .evaluate()
    .setTitle("Goal Setting")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/** RPC: dashboard data for the logged-in user. */
function getDashboard(userId) {
  resetTableCache_();
  var user = requireUser_(userId);
  var cycle = getActiveCycle_();
  var myGoal = getOrCreateGoal_(userId);

  var teamGoals = [];
  if (user.systemRole === "MANAGER" || user.systemRole === "HR_ADMIN") {
    var users = readEmployeesResolved_();
    var relevantUsers =
      user.systemRole === "HR_ADMIN"
        ? users
        : users.filter(function (u) {
            return u.managerId === userId;
          });
    var relevantIds = relevantUsers.map(function (u) {
      return u.id;
    });
    var usersById = indexBy_(users, "id");

    var goals = readTable(TABLES.GOALS.name, TABLES.GOALS.headers).filter(function (g) {
      return g.cycleId === cycle.id && relevantIds.indexOf(g.employeeId) !== -1;
    });
    teamGoals = goals
      .map(function (g) {
        var emp = usersById[g.employeeId];
        return {
          id: g.id,
          status: g.status,
          employeeName: emp ? emp.name : "Unknown",
          designationName: emp ? emp.designationName : null,
        };
      })
      .sort(function (a, b) {
        return a.employeeName.localeCompare(b.employeeName);
      });
  }

  return {
    cycleName: cycle.name,
    myGoal: myGoal,
    teamGoals: teamGoals,
    isManagerOrHr: user.systemRole === "MANAGER" || user.systemRole === "HR_ADMIN",
    isHrAdmin: user.systemRole === "HR_ADMIN",
    profile: {
      employeeCode: user.id,
      name: user.name,
      brand: user.brand,
      designationName: user.designationName,
      businessRole: user.businessRole,
      managerName: user.managerName,
      goalCycle: user.goalCycle,
      assessmentPeriod: user.assessmentPeriod,
    },
  };
}

/** RPC: the employee's own goal-editing screen. */
function getGoalScreen(userId) {
  resetTableCache_();
  requireUser_(userId);
  var goal = getOrCreateGoal_(userId);
  var editable = goal.status === "DRAFT" || goal.status === "RETURNED";
  return {
    goal: goal,
    editable: editable,
  };
}

/** RPC: replace this goal's KRAs/KPIs with the given (unvalidated) draft content. */
function saveGoalDraft(userId, goalId, kras) {
  resetTableCache_();
  requireUser_(userId);
  var goal = findOne_(TABLES.GOALS.name, TABLES.GOALS.headers, function (g) {
    return g.id === goalId;
  });
  if (!goal) return { ok: false, errors: ["Goal not found."] };
  if (goal.employeeId !== userId) return { ok: false, errors: ["You can only edit your own goal."] };
  if (goal.status !== "DRAFT" && goal.status !== "RETURNED") {
    return { ok: false, errors: ["This goal is not editable in its current state."] };
  }

  deleteRowsWhere(TABLES.KPIS.name, TABLES.KPIS.headers, function (kpi) {
    var kraIds = readTable(TABLES.KRAS.name, TABLES.KRAS.headers)
      .filter(function (k) {
        return k.goalId === goalId;
      })
      .map(function (k) {
        return k.id;
      });
    return kraIds.indexOf(kpi.kraId) !== -1;
  });
  deleteRowsWhere(TABLES.KRAS.name, TABLES.KRAS.headers, function (k) {
    return k.goalId === goalId;
  });

  kras.forEach(function (kra, index) {
    var title = str_(kra.title).trim();
    if (!title) return;
    var kraRow = insertRow(TABLES.KRAS.name, TABLES.KRAS.headers, {
      goalId: goalId,
      title: title,
      description: str_(kra.description).trim(),
      weight: Math.round(Number(kra.weight) || 0),
      order: index,
    });
    (kra.kpis || [])
      .slice(0, MAX_KPIS_PER_KRA)
      .filter(function (kpi) {
        return str_(kpi.title).trim();
      })
      .forEach(function (kpi, kpiIndex) {
        insertRow(TABLES.KPIS.name, TABLES.KPIS.headers, {
          kraId: kraRow.id,
          title: str_(kpi.title).trim(),
          target: str_(kpi.target).trim(),
          order: kpiIndex,
        });
      });
  });

  updateRowById(TABLES.GOALS.name, TABLES.GOALS.headers, goalId, {
    updatedAt: new Date().toISOString(),
  });

  return { ok: true, errors: [] };
}

/** RPC: validate and submit a goal for manager approval. */
function submitGoal(userId, goalId) {
  resetTableCache_();
  requireUser_(userId);
  var goal = getFullGoal_(goalId);
  if (!goal) return { ok: false, errors: ["Goal not found."] };
  if (goal.employeeId !== userId) return { ok: false, errors: ["You can only submit your own goal."] };
  if (goal.status !== "DRAFT" && goal.status !== "RETURNED") {
    return { ok: false, errors: ["This goal has already been submitted."] };
  }

  var errors = validateKras_(goal.kras).concat(validatePromotionRatingsComplete_(userId));
  if (errors.length > 0) return { ok: false, errors: errors };

  var now = new Date().toISOString();
  updateRowById(TABLES.GOALS.name, TABLES.GOALS.headers, goalId, {
    status: "SUBMITTED",
    submittedAt: now,
    updatedAt: now,
  });
  insertRow(TABLES.APPROVAL_HISTORY.name, TABLES.APPROVAL_HISTORY.headers, {
    goalId: goalId,
    action: "SUBMIT",
    actorId: userId,
    comment: "",
    createdAt: now,
  });

  return { ok: true, errors: [] };
}

/**
 * RPC: the employee's promotion-readiness self-assessment screen. Not part
 * of goal-setting -- shows the competencies required for their *next*
 * Business Role level (or their own, if already at the top), for them to
 * self-rate against. Always editable, saved independently of any goal.
 */
function getPromotionScreen(userId) {
  resetTableCache_();
  requireUser_(userId);
  var info = getPromotionCompetenciesForUser_(userId);
  var existing = readTable(TABLES.PROMOTION_RATINGS.name, TABLES.PROMOTION_RATINGS.headers).filter(function (r) {
    return r.employeeId === userId;
  });
  return {
    currentLevelName: info.currentLevelName,
    targetLevelName: info.targetLevelName,
    isTopLevel: info.isTopLevel,
    options: info.options,
    ratings: existing.map(function (r) {
      return { competencyId: r.competencyId, subLevel: Number(r.subLevel), selfComment: r.selfComment };
    }),
  };
}

/** RPC: replace the employee's promotion-readiness self-ratings wholesale. */
function savePromotionRatings(userId, ratings) {
  resetTableCache_();
  requireUser_(userId);
  deleteRowsWhere(TABLES.PROMOTION_RATINGS.name, TABLES.PROMOTION_RATINGS.headers, function (r) {
    return r.employeeId === userId;
  });
  var now = new Date().toISOString();
  ratings.forEach(function (r) {
    insertRow(TABLES.PROMOTION_RATINGS.name, TABLES.PROMOTION_RATINGS.headers, {
      employeeId: userId,
      competencyId: r.competencyId,
      subLevel: r.subLevel,
      selfComment: str_(r.selfComment).trim(),
      updatedAt: now,
    });
  });
  return { ok: true };
}

/** RPC: HR-only -- regenerates the "Report" tab in the Sheet. */
function generateReportRpc(userId) {
  resetTableCache_();
  var user = requireUser_(userId);
  if (user.systemRole !== "HR_ADMIN") {
    throw new Error("Only HR Admins can generate the report.");
  }
  return generateReport();
}

/** RPC: the manager/HR approval queue. */
function getApprovalQueue(userId) {
  resetTableCache_();
  var user = requireUser_(userId);
  if (user.systemRole !== "MANAGER" && user.systemRole !== "HR_ADMIN") {
    throw new Error("You don't have access to the approval queue.");
  }
  var cycle = getActiveCycle_();
  var isHrAdmin = user.systemRole === "HR_ADMIN";

  var users = readEmployeesResolved_();
  var usersById = indexBy_(users, "id");

  var goals = readTable(TABLES.GOALS.name, TABLES.GOALS.headers).filter(function (g) {
    if (g.cycleId !== cycle.id) return false;
    var emp = usersById[g.employeeId];
    if (!isHrAdmin && (!emp || emp.managerId !== userId)) return false;
    return true;
  });

  function toSummary(g) {
    var emp = usersById[g.employeeId];
    return {
      id: g.id,
      status: g.status,
      employeeName: emp ? emp.name : "Unknown",
      designationName: emp ? emp.designationName : null,
      submittedAt: g.submittedAt,
    };
  }

  var pending = goals
    .filter(function (g) {
      return g.status === "SUBMITTED";
    })
    .map(toSummary)
    .sort(function (a, b) {
      return new Date(a.submittedAt) - new Date(b.submittedAt);
    });

  var decided = goals
    .filter(function (g) {
      return g.status === "APPROVED" || g.status === "RETURNED";
    })
    .map(toSummary)
    .slice(0, 10);

  return { pending: pending, decided: decided, isHrAdmin: isHrAdmin };
}

/** RPC: full detail view of a single goal, for a manager/HR reviewer. */
function getApprovalDetail(userId, goalId) {
  resetTableCache_();
  var user = requireUser_(userId);
  var goal = getFullGoal_(goalId);
  if (!goal) throw new Error("Goal not found.");
  var isDirectManager = goal.employeeManagerId === userId;
  var isHrAdmin = user.systemRole === "HR_ADMIN";
  if (!isDirectManager && !isHrAdmin) {
    throw new Error("You don't have access to this goal.");
  }
  return goal;
}

/** RPC: approve or return a submitted goal. action is "APPROVE" or "RETURN". */
function decideGoal(userId, goalId, action, comment) {
  resetTableCache_();
  var user = requireUser_(userId);
  var goal = findOne_(TABLES.GOALS.name, TABLES.GOALS.headers, function (g) {
    return g.id === goalId;
  });
  if (!goal) throw new Error("Goal not found.");

  var employee = requireUser_(goal.employeeId);
  var isDirectManager = employee.managerId === userId;
  var isHrAdmin = user.systemRole === "HR_ADMIN";
  if (!isDirectManager && !isHrAdmin) throw new Error("You are not authorized to review this goal.");
  if (goal.status !== "SUBMITTED") throw new Error("This goal is not awaiting approval.");

  if (action === "RETURN" && !str_(comment).trim()) {
    throw new Error("A comment is required when returning a goal for revision.");
  }

  var now = new Date().toISOString();
  if (action === "APPROVE") {
    updateRowById(TABLES.GOALS.name, TABLES.GOALS.headers, goalId, {
      status: "APPROVED",
      approvedAt: now,
      updatedAt: now,
    });
  } else if (action === "RETURN") {
    updateRowById(TABLES.GOALS.name, TABLES.GOALS.headers, goalId, {
      status: "RETURNED",
      updatedAt: now,
    });
  } else {
    throw new Error("Unknown action: " + action);
  }

  insertRow(TABLES.APPROVAL_HISTORY.name, TABLES.APPROVAL_HISTORY.headers, {
    goalId: goalId,
    action: action,
    actorId: userId,
    comment: str_(comment).trim(),
    createdAt: now,
  });

  return { ok: true };
}
