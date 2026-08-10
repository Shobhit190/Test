"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  KraInput,
  CompetencyRatingInput,
  MAX_KPIS_PER_KRA,
  validateKras,
  validateCompetencyRatings,
  getRequiredCompetenciesForUser,
} from "@/lib/goal-domain";

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error("Not authenticated.");
  return session;
}

function sanitizeKras(kras: KraInput[]): KraInput[] {
  return kras.map((k) => ({
    title: k.title.trim(),
    description: k.description?.trim() || undefined,
    weight: Math.round(Number(k.weight) || 0),
    kpis: k.kpis
      .slice(0, MAX_KPIS_PER_KRA)
      .filter((kpi) => kpi.title.trim().length > 0)
      .map((kpi) => ({ title: kpi.title.trim(), target: kpi.target?.trim() || undefined })),
  }));
}

export async function saveGoalDraft(
  goalId: string,
  kras: KraInput[],
  ratings: CompetencyRatingInput[]
): Promise<{ ok: boolean; errors: string[] }> {
  const session = await requireSession();

  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: goalId } });
  if (goal.employeeId !== session.user.id) {
    return { ok: false, errors: ["You can only edit your own goal."] };
  }
  if (goal.status !== "DRAFT" && goal.status !== "RETURNED") {
    return { ok: false, errors: ["This goal is not editable in its current state."] };
  }

  const cleanKras = sanitizeKras(kras);

  await prisma.$transaction(async (tx) => {
    await tx.kRA.deleteMany({ where: { goalId } });
    for (const [index, kra] of cleanKras.entries()) {
      await tx.kRA.create({
        data: {
          goalId,
          title: kra.title,
          description: kra.description,
          weight: kra.weight,
          order: index,
          kpis: {
            create: kra.kpis.map((kpi, kpiIndex) => ({
              title: kpi.title,
              target: kpi.target,
              order: kpiIndex,
            })),
          },
        },
      });
    }

    await tx.competencyRating.deleteMany({ where: { goalId } });
    for (const r of ratings) {
      await tx.competencyRating.create({
        data: {
          goalId,
          competencyId: r.competencyId,
          subLevel: r.subLevel,
          selfComment: r.selfComment?.trim() || undefined,
        },
      });
    }
  });

  revalidatePath("/goal");
  revalidatePath("/");
  return { ok: true, errors: [] };
}

export async function submitGoal(goalId: string): Promise<{ ok: boolean; errors: string[] }> {
  const session = await requireSession();

  const goal = await prisma.goal.findUniqueOrThrow({
    where: { id: goalId },
    include: { kras: { include: { kpis: true } }, competencyRatings: true },
  });
  if (goal.employeeId !== session.user.id) {
    return { ok: false, errors: ["You can only submit your own goal."] };
  }
  if (goal.status !== "DRAFT" && goal.status !== "RETURNED") {
    return { ok: false, errors: ["This goal has already been submitted."] };
  }

  const kraErrors = validateKras(
    goal.kras.map((k) => ({
      title: k.title,
      weight: k.weight,
      kpis: k.kpis.map((kpi) => ({ title: kpi.title, target: kpi.target ?? undefined })),
    }))
  );

  const { options } = await getRequiredCompetenciesForUser(session.user.id);
  const allowedIds = new Set(options.map((o) => o.competency.id));
  const competencyErrors = validateCompetencyRatings(
    goal.competencyRatings.map((r) => ({ competencyId: r.competencyId, subLevel: r.subLevel })),
    allowedIds
  );

  const errors = [...kraErrors, ...competencyErrors];
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  await prisma.$transaction([
    prisma.goal.update({
      where: { id: goalId },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    }),
    prisma.approvalHistory.create({
      data: { goalId, action: "SUBMIT", actorId: session.user.id },
    }),
  ]);

  revalidatePath("/goal");
  revalidatePath("/");
  revalidatePath("/approvals");
  return { ok: true, errors: [] };
}

async function requireManagerOf(goalId: string) {
  const session = await requireSession();
  const goal = await prisma.goal.findUniqueOrThrow({
    where: { id: goalId },
    include: { employee: true },
  });

  const isDirectManager = goal.employee.managerId === session.user.id;
  const isHrAdmin = session.user.systemRole === "HR_ADMIN";
  if (!isDirectManager && !isHrAdmin) {
    throw new Error("You are not authorized to review this goal.");
  }
  if (goal.status !== "SUBMITTED") {
    throw new Error("This goal is not awaiting approval.");
  }
  return { session, goal };
}

export async function approveGoal(goalId: string, comment?: string) {
  const { session } = await requireManagerOf(goalId);

  await prisma.$transaction([
    prisma.goal.update({
      where: { id: goalId },
      data: { status: "APPROVED", approvedAt: new Date() },
    }),
    prisma.approvalHistory.create({
      data: { goalId, action: "APPROVE", actorId: session.user.id, comment: comment?.trim() || undefined },
    }),
  ]);

  revalidatePath("/approvals");
  revalidatePath("/");
}

export async function returnGoal(goalId: string, comment: string) {
  if (!comment.trim()) {
    throw new Error("A comment is required when returning a goal for revision.");
  }
  const { session } = await requireManagerOf(goalId);

  await prisma.$transaction([
    prisma.goal.update({
      where: { id: goalId },
      data: { status: "RETURNED" },
    }),
    prisma.approvalHistory.create({
      data: { goalId, action: "RETURN", actorId: session.user.id, comment: comment.trim() },
    }),
  ]);

  revalidatePath("/approvals");
  revalidatePath("/");
}
