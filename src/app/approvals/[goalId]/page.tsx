import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Nav from "@/components/Nav";
import ApprovalActions from "@/components/ApprovalActions";

export default async function ApprovalDetailPage({
  params,
}: {
  params: Promise<{ goalId: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const { goalId } = await params;

  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    include: {
      employee: { include: { designation: true } },
      kras: { include: { kpis: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } },
      competencyRatings: { include: { competency: { include: { levels: true } } } },
      approvalHistory: { include: { actor: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!goal) return notFound();

  const isDirectManager = goal.employee.managerId === session.user.id;
  const isHrAdmin = session.user.systemRole === "HR_ADMIN";
  if (!isDirectManager && !isHrAdmin) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8">
        <Nav session={session} />
        <p className="mt-6 text-sm text-gray-600">You don&apos;t have access to this goal.</p>
      </div>
    );
  }

  const weightTotal = goal.kras.reduce((sum, k) => sum + k.weight, 0);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <Nav session={session} />

      <div className="mt-6">
        <h1 className="text-2xl font-bold">{goal.employee.name}&apos;s Goal</h1>
        <p className="text-sm text-gray-500">
          {goal.employee.designation?.name ?? "No designation"} &middot; Status: {goal.status}
        </p>
      </div>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">KRAs &amp; KPIs (90%)</h2>
          <span className="text-sm text-gray-500">Total weight: {weightTotal}%</span>
        </div>
        <div className="mt-3 space-y-3">
          {goal.kras.map((kra) => (
            <div key={kra.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">{kra.title}</p>
                <span className="text-sm text-gray-500">{kra.weight}%</span>
              </div>
              {kra.description && <p className="mt-1 text-sm text-gray-500">{kra.description}</p>}
              {kra.kpis.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600">
                  {kra.kpis.map((kpi) => (
                    <li key={kpi.id}>
                      {kpi.title}
                      {kpi.target ? ` — target: ${kpi.target}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Role Competencies (10%)</h2>
        <div className="mt-3 space-y-3">
          {goal.competencyRatings.map((rating) => {
            const level = rating.competency.levels.find(
              (l) => rating.subLevel >= l.subLevelMin && rating.subLevel <= l.subLevelMax
            );
            return (
              <div key={rating.id} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{rating.competency.name}</p>
                  <span className="rounded-md bg-gray-100 px-2 py-1 text-sm font-medium">
                    {level?.level} &middot; {rating.subLevel}/10 &middot; {level?.levelName}
                  </span>
                </div>
                {rating.selfComment && <p className="mt-2 text-sm text-gray-600">{rating.selfComment}</p>}
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">History</h2>
        <ul className="mt-3 space-y-2 text-sm text-gray-600">
          {goal.approvalHistory.map((h) => (
            <li key={h.id} className="rounded-md bg-gray-50 px-3 py-2">
              <span className="font-medium">{h.action}</span> by {h.actor.name} on{" "}
              {new Date(h.createdAt).toLocaleString()}
              {h.comment && <p className="mt-1 text-gray-500">{h.comment}</p>}
            </li>
          ))}
        </ul>
      </section>

      {goal.status === "SUBMITTED" && (
        <div className="mt-8">
          <ApprovalActions goalId={goal.id} />
        </div>
      )}
    </div>
  );
}
