/**
 * Table (sheet tab) names and their column headers, mirroring the
 * Prisma schema from the Next.js version of this app.
 */

var TABLES = {
  USERS: {
    name: "Users",
    headers: ["id", "email", "name", "passwordHash", "systemRole", "designationId", "managerId"],
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
  ROLE_COMPETENCY_MAP: {
    name: "RoleCompetencyMap",
    headers: ["id", "designationId", "competencyId", "isRequired", "notes"],
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
  COMPETENCY_RATINGS: {
    name: "CompetencyRatings",
    headers: ["id", "goalId", "competencyId", "subLevel", "selfComment"],
  },
  APPROVAL_HISTORY: {
    name: "ApprovalHistory",
    headers: ["id", "goalId", "action", "actorId", "comment", "createdAt"],
  },
};
