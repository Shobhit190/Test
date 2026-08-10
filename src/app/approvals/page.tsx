import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCycle } from "@/lib/goal-domain";
import Nav from "@/components/Nav";

export default async function ApprovalsPage() {
  const session = await auth();
  if (!session?.user) return null;
  if (session.user.systemRole !== "MANAGER" && session.user.systemRole !== "HR_ADMIN") {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8">
        <Nav session={session} />
        <p className="mt-6 text-sm text-gray-600">You don&apos;t have access to the approval queue.</p>
      </div>
    );
  }

  const cycle = await getActiveCycle();
  const isHrAdmin = session.user.systemRole === "HR_ADMIN";

  const goals = await prisma.goal.findMany({
    where: {
      cycleId: cycle.id,
      status: "SUBMITTED",
      employee: isHrAdmin ? {} : { managerId: session.user.id },
    },
    include: { employee: { include: { designation: true } } },
    orderBy: { submittedAt: "asc" },
  });

  const recentlyDecided = await prisma.goal.findMany({
    where: {
      cycleId: cycle.id,
      status: { in: ["APPROVED", "RETURNED"] },
      employee: isHrAdmin ? {} : { managerId: session.user.id },
    },
    include: { employee: true },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <Nav session={session} />

      <h1 className="mt-6 text-2xl font-bold">Approval Queue</h1>
      <p className="mt-1 text-sm text-gray-500">
        {isHrAdmin ? "All submitted goals org-wide." : "Goals submitted by your direct reports."}
      </p>

      <div className="mt-6 space-y-3">
        {goals.length === 0 && (
          <p className="rounded-md border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500">
            Nothing waiting on your review.
          </p>
        )}
        {goals.map((g) => (
          <Link
            key={g.id}
            href={`/approvals/${g.id}`}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 hover:border-indigo-300"
          >
            <div>
              <p className="font-medium">{g.employee.name}</p>
              <p className="text-sm text-gray-500">{g.employee.designation?.name ?? "No designation"}</p>
            </div>
            <span className="text-xs text-gray-400">
              Submitted {g.submittedAt ? new Date(g.submittedAt).toLocaleDateString() : ""}
            </span>
          </Link>
        ))}
      </div>

      {recentlyDecided.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-gray-700">Recently decided</h2>
          <div className="mt-2 space-y-2">
            {recentlyDecided.map((g) => (
              <Link
                key={g.id}
                href={`/approvals/${g.id}`}
                className="flex items-center justify-between rounded-md border border-gray-100 bg-white px-4 py-2 text-sm hover:border-gray-300"
              >
                <span>{g.employee.name}</span>
                <span
                  className={
                    g.status === "APPROVED" ? "text-green-600" : "text-amber-600"
                  }
                >
                  {g.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
