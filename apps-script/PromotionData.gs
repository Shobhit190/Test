/**
 * The Full-Time promotion-level ladder, hand-transcribed from the
 * "Promotion Architecture" proposal deck (slides 9-10: 11 designations,
 * 4-5 promotion-critical competencies each). That deck marks this mapping
 * as PROPOSED, pending validation with function leaders -- if it changes,
 * edit the PromotionLevels/PromotionCompetencyMap sheet tabs directly
 * rather than this file; seedPromotionLevels_() only upserts by name, so
 * hand edits to rows it doesn't touch are never overwritten.
 *
 * Faculty (a separate, qualification-gated track in the deck, not a
 * competency ladder) is intentionally not included here.
 *
 * Competency names below are the exact names from competency-dictionary.json
 * -- the deck says "Result Orientation", the dictionary's full name is
 * "Result Orientation (Bias for Action)"; every other name matches verbatim.
 */
var PROMOTION_LEVELS_DATA = [
  {
    name: "Associate",
    order: 1,
    maturityMin: 3,
    maturityMax: 4,
    competencies: [
      "Ownership",
      "Result Orientation (Bias for Action)",
      "Student/Education-First Integrity",
      "Attention to Detail",
      "Openness to Learnings",
    ],
  },
  {
    name: "Senior Associate",
    order: 2,
    maturityMin: 4,
    maturityMax: 5,
    competencies: [
      "Ownership",
      "Result Orientation (Bias for Action)",
      "Problem Solving",
      "Bridge-Builder Mindset",
      "Adaptive Agility",
    ],
  },
  {
    name: "Assistant Manager",
    order: 3,
    maturityMin: 5,
    maturityMax: 5,
    competencies: [
      "Ownership",
      "Result Orientation (Bias for Action)",
      "Problem Solving",
      "Process Orientation",
      "Bridge-Builder Mindset",
    ],
  },
  {
    name: "Manager",
    order: 4,
    maturityMin: 5,
    maturityMax: 6,
    competencies: [
      "Ownership",
      "Result Orientation (Bias for Action)",
      "Problem Solving",
      "Influential Communication",
      "Bridge-Builder Mindset",
    ],
  },
  {
    name: "Senior Manager",
    order: 5,
    maturityMin: 6,
    maturityMax: 7,
    competencies: [
      "Ownership",
      "Result Orientation (Bias for Action)",
      "Problem Solving",
      "Influential Communication",
      "Strategic Thinking & Foresight",
    ],
  },
  {
    name: "Asst. Director / DGM",
    order: 6,
    maturityMin: 7,
    maturityMax: 7,
    competencies: [
      "Strategic Thinking & Foresight",
      "Ownership",
      "Problem Solving",
      "Influential Communication",
      "Bridge-Builder Mindset",
    ],
  },
  {
    name: "Director / GM",
    order: 7,
    maturityMin: 7,
    maturityMax: 8,
    competencies: [
      "Strategic Thinking & Foresight",
      "Financial & Commercial Prudence",
      "Ambiguity Navigation",
      "Influential Communication",
      "Mentoring & Coaching",
    ],
  },
  {
    name: "Assistant Vice President",
    order: 8,
    maturityMin: 8,
    maturityMax: 8,
    competencies: [
      "Strategic Thinking & Foresight",
      "Financial & Commercial Prudence",
      "Ambiguity Navigation",
      "Influential Communication",
      "Mentoring & Coaching",
    ],
  },
  {
    name: "Deputy Vice President",
    order: 9,
    maturityMin: 8,
    maturityMax: 9,
    competencies: [
      "Strategic Thinking & Foresight",
      "Financial & Commercial Prudence",
      "Ambiguity Navigation",
      "Influential Communication",
      "Mentoring & Coaching",
    ],
  },
  {
    name: "Vice President",
    order: 10,
    maturityMin: 9,
    maturityMax: 9,
    competencies: [
      "Strategic Thinking & Foresight",
      "Financial & Commercial Prudence",
      "Ambiguity Navigation",
      "Influential Communication",
      "Mentoring & Coaching",
    ],
  },
  {
    name: "Senior Vice President",
    order: 11,
    maturityMin: 9,
    maturityMax: 10,
    competencies: [
      "Strategic Thinking & Foresight",
      "Financial & Commercial Prudence",
      "Ambiguity Navigation",
      "Influential Communication",
      "Mentoring & Coaching",
    ],
  },
];

/**
 * Upserts PROMOTION_LEVELS_DATA into the PromotionLevels/PromotionCompetencyMap
 * tabs, matching by name/level+competency (never wipes the sheet). Must run
 * after seedCompetencyDictionary_() so competency names can resolve to ids.
 */
function seedPromotionLevels_() {
  var idByName = {};
  PROMOTION_LEVELS_DATA.forEach(function (level) {
    var row = upsert_(
      TABLES.PROMOTION_LEVELS.name,
      TABLES.PROMOTION_LEVELS.headers,
      function (existing) {
        return existing.name === level.name;
      },
      { name: level.name, order: level.order, maturityMin: level.maturityMin, maturityMax: level.maturityMax }
    );
    idByName[level.name] = row.id;
  });

  var competencyIdByName = {};
  readTable(TABLES.COMPETENCIES.name, TABLES.COMPETENCIES.headers).forEach(function (c) {
    competencyIdByName[c.name] = c.id;
  });

  PROMOTION_LEVELS_DATA.forEach(function (level) {
    var levelId = idByName[level.name];
    level.competencies.forEach(function (compName) {
      var competencyId = competencyIdByName[compName];
      if (!competencyId) {
        Logger.log("Promotion competency not found: " + compName);
        return;
      }
      upsert_(
        TABLES.PROMOTION_COMPETENCY_MAP.name,
        TABLES.PROMOTION_COMPETENCY_MAP.headers,
        function (existing) {
          return existing.levelId === levelId && existing.competencyId === competencyId;
        },
        { levelId: levelId, competencyId: competencyId, notes: "" }
      );
    });
  });
}
