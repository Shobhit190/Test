/**
 * Table (sheet tab) names and their column headers, mirroring the
 * Prisma schema from the Next.js version of this app.
 */

var TABLES = {
  // "id" here is the Employee Code -- it's the row's unique key, same as
  // every other table's "id" column, just human-assigned instead of a
  // generated UUID. designation/managerName are stored as plain text (so
  // this sheet is safe to hand-edit directly) and resolved dynamically
  // against the Designations tab / other employees' Name column by
  // readEmployeesResolved_() in Repository.gs -- see that function before
  // changing this column order.
  USERS: {
    name: "Employee Details",
    headers: [
      "id",
      "name",
      "brand",
      "designation",
      "businessRole",
      "managerName",
      "role",
      "goalCycle",
      "assessmentPeriod",
      "email",
      "password",
    ],
  },
  DESIGNATIONS: {
    name: "Designations",
    headers: ["id", "name"],
  },
  COMPETENCIES: {
    name: "Competencies",
    headers: ["id", "name", "cluster", "subCluster", "isCore", "definition", "keyBehaviours"],
  },
  COMPETENCY_LEVELS: {
    name: "CompetencyLevels",
    headers: [
      "id",
      "competencyId",
      "level",
      "subLevelMin",
      "subLevelMax",
      "levelName",
      "behaviourIndicatorsJson",
    ],
  },
  // No longer consumed by goal-setting (competencies were dropped from the
  // goal's weighting -- see PROMOTION_COMPETENCY_MAP below for what
  // replaced it). Left in place because seedRoleCompetencyMap_() also seeds
  // the Designations tab itself, which the Designation field still uses.
  ROLE_COMPETENCY_MAP: {
    name: "RoleCompetencyMap",
    headers: ["id", "designationId", "competencyId", "isRequired", "notes"],
  },
  // The Full-Time promotion-level ladder (Associate -> ... -> Senior Vice
  // President) from the Promotion Architecture proposal deck. "order" is
  // what determines each level's "next level" for the promotion-readiness
  // screen. Hand-editable like Designations/RoleCompetencyMap -- edit rows
  // directly if the proposed mapping changes; seedAll() only upserts by name.
  PROMOTION_LEVELS: {
    name: "PromotionLevels",
    headers: ["id", "name", "order", "maturityMin", "maturityMax"],
  },
  // Which competencies (and how many, per the deck: 4-5) are
  // promotion-critical for each PromotionLevels row.
  PROMOTION_COMPETENCY_MAP: {
    name: "PromotionCompetencyMap",
    headers: ["id", "levelId", "competencyId", "notes"],
  },
  // An employee's self-rating against their *next* promotion level's
  // competencies (or their own level's, if already at the top). Not tied
  // to a Goal -- it's a standing development record, not goal-scored.
  PROMOTION_RATINGS: {
    name: "PromotionRatings",
    headers: ["id", "employeeId", "competencyId", "subLevel", "selfComment", "updatedAt"],
  },
  GOAL_CYCLES: {
    name: "GoalCycles",
    headers: ["id", "name", "startDate", "endDate", "isActive"],
  },
  GOALS: {
    name: "Goals",
    headers: ["id", "employeeId", "cycleId", "status", "submittedAt", "approvedAt", "createdAt", "updatedAt"],
  },
  KRAS: {
    name: "KRAs",
    headers: ["id", "goalId", "title", "description", "weight", "order"],
  },
  KPIS: {
    name: "KPIs",
    headers: ["id", "kraId", "title", "target", "order"],
  },
  // No longer written by the goal flow -- competencies were removed from
  // goal-setting entirely (see PROMOTION_RATINGS above for the replacement).
  // Left in place in case any goal saved before that change still has rows.
  COMPETENCY_RATINGS: {
    name: "CompetencyRatings",
    headers: ["id", "goalId", "competencyId", "subLevel", "selfComment"],
  },
  APPROVAL_HISTORY: {
    name: "ApprovalHistory",
    headers: ["id", "goalId", "action", "actorId", "comment", "createdAt"],
  },
};
