/**
 * HR-facing snapshot report: one row per employee showing goal-submission
 * status and promotion-readiness rating progress side by side, so HR can
 * see everyone's state at a glance without opening each person's screen.
 *
 * This writes to a "Report" tab. Unlike the hand-editable reference tabs
 * (Designations, PromotionLevels, etc.), the Report tab is pure output --
 * it's fully cleared and rewritten every time this runs, so don't hand-edit
 * it; your changes would just be overwritten on the next run.
 */
function generateReport() {
  var employees = readEmployeesResolved_();
  var cycle = getActiveCycle_();

  var goals = readTable(TABLES.GOALS.name, TABLES.GOALS.headers).filter(function (g) {
    return g.cycleId === cycle.id;
  });
  var goalsByEmployee = indexBy_(goals, "employeeId");

  var allKras = readTable(TABLES.KRAS.name, TABLES.KRAS.headers);
  var krasByGoal = groupBy_(allKras, "goalId");

  var levels = readTable(TABLES.PROMOTION_LEVELS.name, TABLES.PROMOTION_LEVELS.headers);
  var levelsById = indexBy_(levels, "id");

  var compMapRows = readTable(TABLES.PROMOTION_COMPETENCY_MAP.name, TABLES.PROMOTION_COMPETENCY_MAP.headers);
  var compCountByLevelId = {};
  compMapRows.forEach(function (m) {
    compCountByLevelId[m.levelId] = (compCountByLevelId[m.levelId] || 0) + 1;
  });

  var allRatings = readTable(TABLES.PROMOTION_RATINGS.name, TABLES.PROMOTION_RATINGS.headers);
  var ratingsByEmployee = groupBy_(allRatings, "employeeId");

  var headers = [
    "Employee Code",
    "Name",
    "Brand",
    "Entity",
    "Designation",
    "Business Role",
    "Reporting Manager",
    "Goal Cycle",
    "Assessment Period",
    "Goal Status",
    "KRA Count",
    "Total KRA Weightage",
    "Current Level",
    "Target Level",
    "Competencies Required",
    "Competencies Rated",
    "Avg Self-Rating (1-10)",
    "Ratings Last Updated",
  ];

  var rows = employees
    .slice()
    .sort(function (a, b) {
      return a.name.localeCompare(b.name);
    })
    .map(function (emp) {
      var goal = goalsByEmployee[emp.id];
      var kras = goal ? krasByGoal[goal.id] || [] : [];
      var totalWeight = kras.reduce(function (sum, k) {
        return sum + (Number(k.weight) || 0);
      }, 0);

      var currentLevel = emp.promotionLevelId ? levelsById[emp.promotionLevelId] : null;
      var nextLevel = currentLevel
        ? levels.filter(function (l) {
            return Number(l.order) === Number(currentLevel.order) + 1;
          })[0]
        : null;
      var targetLevel = nextLevel || currentLevel;

      var ratings = ratingsByEmployee[emp.id] || [];
      var avgRating = ratings.length
        ? Math.round(
            (ratings.reduce(function (sum, r) {
              return sum + Number(r.subLevel || 0);
            }, 0) /
              ratings.length) *
              10
          ) / 10
        : "";
      var lastUpdated = ratings.length
        ? ratings
            .map(function (r) {
              return r.updatedAt;
            })
            .sort()
            .slice(-1)[0]
        : "";

      return [
        emp.employeeCode,
        emp.name,
        emp.brand,
        emp.entity,
        emp.designationName,
        emp.businessRole,
        emp.managerName,
        emp.goalCycle,
        emp.assessmentPeriod,
        goal ? goal.status : "NOT STARTED",
        kras.length,
        totalWeight,
        currentLevel ? currentLevel.name : "",
        targetLevel ? targetLevel.name : "",
        targetLevel ? compCountByLevelId[targetLevel.id] || 0 : 0,
        ratings.length,
        avgRating,
        lastUpdated,
      ];
    });

  var sheet = getSheet_("Report");
  sheet.clearContents();
  sheet.getRange(1, 1, rows.length + 1, headers.length).setValues([headers].concat(rows));
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);

  Logger.log("Report generated: %s employee rows.", rows.length);
  return { ok: true, rowCount: rows.length };
}
