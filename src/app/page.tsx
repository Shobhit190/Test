import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCycle, getOrCreateDraftGoal } from "@/lib/goal-domain";
import Nav from "@/components/Nav";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  APPROVED: "bg-green-100 text-green-700",
  RETURNED: "bg-amber-100 text-amber-700",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}>{status}</span>
  );
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) return null;

  const cycle = await getActiveCycle();
  const myGoal = await getOrCreateDraftGoal(session.user.id);

  let teamGoals: {
    id: string;
    status: string;
    employee: { name: string; email: string; designation: { name: string } | null };
  }[] = [];

  if (session.user.systemRole === "MANAGER") {
    teamGoals = await prisma.goal.findMany({
      where: { cycleId: cycle.id, employee: { managerId: session.user.id } },
      include: { employee: { include: { designation: true } } },
      orderBy: { employee: { name: "asc" } },
    });
  } else if (session.user.systemRole === "HR_ADMIN") {
    teamGoals = await prisma.goal.findMany({
      where: { cycleId: cycle.id },
      include: { employee: { include: { designation: true } } },
      orderBy: { employee: { name: "asc" } },
    });
  }

  const statusCounts = teamGoals.reduce<Record<string, number>>((acc, g) => {
    acc[g.status] = (acc[g.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <Nav session={session} />

      <h1 className="mt-6 text-2xl font-bold">Dashboard</h1>
      <p className="text-sm text-gray-500">Cycle: {cycle.name}</p>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">My Goal</p>
            <p className="text-sm text-gray-500">
              {myGoal.kras.length} KRA{myGoal.kras.length === 1 ? "" : "s"} &middot;{" "}
              {myGoal.competencyRatings.length} competenc
              {myGoal.competencyRatings.length === 1 ? "y" : "ies"} rated
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={myGoal.status} />
            <Link href="/goal" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
              Open &rarr;
            </Link>
          </div>
        </div>
      </section>

      {(session.user.systemRole === "MANAGER" || session.user.systemRole === "HR_ADMIN") && (
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {session.user.systemRole === "HR_ADMIN" ? "Org-wide rollup" : "My team"}
            </h2>
            <div className="flex gap-2 text-xs">
              {Object.entries(statusCounts).map(([status, count]) => (
                <span key={status} className={`rounded-full px-2 py-1 ${STATUS_STYLES[status]}`}>
                  {status}: {count}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {teamGoals.length === 0 && (
              <p className="rounded-md border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
                No goals yet this cycle.
              </p>
            )}
            {teamGoals.map((g) => (
              <Link
                key={g.id}
                href={g.status === "DRAFT" ? "#" : `/approvals/${g.id}`}
                className={`flex items-center justify-between rounded-md border border-gray-200 bg-white px-4 py-3 ${
                  g.status === "DRAFT" ? "pointer-events-none opacity-70" : "hover:border-indigo-300"
                }`}
              >
                <div>
                  <p className="text-sm font-medium">{g.employee.name}</p>
                  <p className="text-xs text-gray-500">{g.employee.designation?.name ?? "—"}</p>
                </div>
                <StatusBadge status={g.status} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
