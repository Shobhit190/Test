import { prisma } from "@/lib/prisma";
import { MIN_KRAS, MAX_KRAS, MAX_KPIS_PER_KRA, MIN_COMPETENCY_RATINGS, KRA_WEIGHT_TOTAL } from "@/lib/goal-constants";

export { MIN_KRAS, MAX_KRAS, MAX_KPIS_PER_KRA, MIN_COMPETENCY_RATINGS, KRA_WEIGHT_TOTAL };

export async function getActiveCycle() {
  const cycle = await prisma.goalCycle.findFirst({
    where: { isActive: true },
    orderBy: { startDate: "desc" },
  });
  if (!cycle) {
    throw new Error("No active goal cycle configured.");
  }
  return cycle;
}

export async function getRequiredCompetenciesForUser(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { designation: true },
  });

  const [roleMapped, core] = await Promise.all([
    user.designationId
      ? prisma.roleCompetencyMap.findMany({
          where: { designationId: user.designationId, isRequired: true },
          include: { competency: { include: { levels: true } } },
        })
      : Promise.resolve([]),
    prisma.competency.findMany({
      where: { isCore: true },
      include: { levels: true },
    }),
  ]);

  const byId = new Map<string, { competency: (typeof core)[number]; fromRole: boolean }>();
  for (const m of roleMapped) {
    byId.set(m.competency.id, { competency: m.competency, fromRole: true });
  }
  for (const c of core) {
    if (!byId.has(c.id)) {
      byId.set(c.id, { competency: c, fromRole: false });
    }
  }

  return {
    designationName: user.designation?.name ?? null,
    options: Array.from(byId.values()).sort((a, b) =>
      a.competency.name.localeCompare(b.competency.name)
    ),
  };
}

export async function getOrCreateDraftGoal(userId: string) {
  const cycle = await getActiveCycle();

  const existing = await prisma.goal.findUnique({
    where: { employeeId_cycleId: { employeeId: userId, cycleId: cycle.id } },
    include: {
      kras: { include: { kpis: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } },
      competencyRatings: { include: { competency: true } },
      approvalHistory: { include: { actor: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (existing) return existing;

  const created = await prisma.goal.create({
    data: { employeeId: userId, cycleId: cycle.id, status: "DRAFT" },
    include: {
      kras: { include: { kpis: true } },
      competencyRatings: { include: { competency: true } },
      approvalHistory: { include: { actor: true } },
    },
  });
  return created;
}

export type KraInput = {
  title: string;
  description?: string;
  weight: number;
  kpis: { title: string; target?: string }[];
};

export type CompetencyRatingInput = {
  competencyId: string;
  subLevel: number;
  selfComment?: string;
};

export function validateKras(kras: KraInput[]): string[] {
  const errors: string[] = [];

  if (kras.length < MIN_KRAS || kras.length > MAX_KRAS) {
    errors.push(`You must have between ${MIN_KRAS} and ${MAX_KRAS} KRAs (currently ${kras.length}).`);
  }

  const weightSum = kras.reduce((sum, k) => sum + (Number.isFinite(k.weight) ? k.weight : 0), 0);
  if (weightSum !== KRA_WEIGHT_TOTAL) {
    errors.push(`KRA weights must sum to ${KRA_WEIGHT_TOTAL}% (currently ${weightSum}%).`);
  }

  for (const [i, kra] of kras.entries()) {
    if (!kra.title.trim()) {
      errors.push(`KRA #${i + 1} needs a title.`);
    }
    if (kra.weight <= 0 || kra.weight > 100) {
      errors.push(`KRA #${i + 1} weight must be between 1 and 100.`);
    }
    if (kra.kpis.length > MAX_KPIS_PER_KRA) {
      errors.push(`KRA #${i + 1} has more than ${MAX_KPIS_PER_KRA} KPIs.`);
    }
  }

  return errors;
}

export function validateCompetencyRatings(
  ratings: CompetencyRatingInput[],
  allowedCompetencyIds: Set<string>
): string[] {
  const errors: string[] = [];

  if (ratings.length < MIN_COMPETENCY_RATINGS) {
    errors.push(
      `You must self-rate on at least ${MIN_COMPETENCY_RATINGS} competencies (currently ${ratings.length}).`
    );
  }

  for (const r of ratings) {
    if (!allowedCompetencyIds.has(r.competencyId)) {
      errors.push("One of the selected competencies is not applicable to your role.");
    }
    if (r.subLevel < 1 || r.subLevel > 10) {
      errors.push("Competency ratings must be between 1 and 10.");
    }
  }

  return errors;
}
