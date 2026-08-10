import { auth } from "@/lib/auth";
import { getOrCreateDraftGoal, getRequiredCompetenciesForUser } from "@/lib/goal-domain";
import GoalForm from "@/components/GoalForm";
import Nav from "@/components/Nav";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted — awaiting manager approval",
  APPROVED: "Approved",
  RETURNED: "Returned for revision",
};

export default async function GoalPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [goal, { options, designationName }] = await Promise.all([
    getOrCreateDraftGoal(session.user.id),
    getRequiredCompetenciesForUser(session.user.id),
  ]);

  const editable = goal.status === "DRAFT" || goal.status === "RETURNED";
  const lastReturn = [...goal.approvalHistory].reverse().find((h) => h.action === "RETURN");

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <Nav session={session} />

      <div className="mt-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Goal</h1>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
          {STATUS_LABELS[goal.status]}
        </span>
      </div>

      {goal.status === "RETURNED" && lastReturn && (
        <div className="mt-4 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">Manager feedback ({lastReturn.actor.name}):</p>
          <p className="mt-1">{lastReturn.comment}</p>
        </div>
      )}

      <div className="mt-6">
        <GoalForm
          goalId={goal.id}
          editable={editable}
          initialKras={goal.kras.map((k) => ({
            key: k.id,
            title: k.title,
            description: k.description ?? "",
            weight: k.weight,
            kpis: k.kpis.map((kpi) => ({ key: kpi.id, title: kpi.title, target: kpi.target ?? "" })),
          }))}
          initialRatings={goal.competencyRatings.map((r) => ({
            competencyId: r.competencyId,
            subLevel: r.subLevel,
            selfComment: r.selfComment ?? "",
          }))}
          competencyOptions={options.map((o) => ({
            id: o.competency.id,
            name: o.competency.name,
            cluster: o.competency.cluster,
            subCluster: o.competency.subCluster,
            isCore: o.competency.isCore,
            fromRole: o.fromRole,
            levels: [...o.competency.levels]
              .sort((a, b) => a.subLevelMin - b.subLevelMin)
              .map((l) => ({
                level: l.level,
                subLevelMin: l.subLevelMin,
                subLevelMax: l.subLevelMax,
                levelName: l.levelName,
                behaviourIndicators: l.behaviourIndicators,
              })),
          }))}
          designationName={designationName}
        />
      </div>
    </div>
  );
}
