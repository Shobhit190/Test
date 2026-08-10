"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveGoalDraft, submitGoal } from "@/lib/actions";
import {
  MAX_KPIS_PER_KRA,
  MAX_KRAS,
  MIN_COMPETENCY_RATINGS,
  MIN_KRAS,
  KRA_WEIGHT_TOTAL,
} from "@/lib/goal-constants";

type Kpi = { key: string; title: string; target: string };
type Kra = { key: string; title: string; description: string; weight: number; kpis: Kpi[] };

type LevelInfo = {
  level: string;
  subLevelMin: number;
  subLevelMax: number;
  levelName: string;
  behaviourIndicators: string[];
};

type CompetencyOption = {
  id: string;
  name: string;
  cluster: string | null;
  subCluster: string | null;
  isCore: boolean;
  fromRole: boolean;
  levels: LevelInfo[];
};

type Rating = { competencyId: string; subLevel: number; selfComment: string };

function newKey() {
  return Math.random().toString(36).slice(2);
}

function levelForSubLevel(levels: LevelInfo[], subLevel: number) {
  return levels.find((l) => subLevel >= l.subLevelMin && subLevel <= l.subLevelMax) ?? levels[0];
}

export default function GoalForm({
  goalId,
  editable,
  initialKras,
  initialRatings,
  competencyOptions,
  designationName,
}: {
  goalId: string;
  editable: boolean;
  initialKras: Kra[];
  initialRatings: Rating[];
  competencyOptions: CompetencyOption[];
  designationName: string | null;
}) {
  const router = useRouter();
  const [kras, setKras] = useState<Kra[]>(initialKras);
  const [ratings, setRatings] = useState<Rating[]>(initialRatings);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const weightTotal = useMemo(() => kras.reduce((sum, k) => sum + (Number(k.weight) || 0), 0), [kras]);

  const competencyById = useMemo(() => {
    const m = new Map<string, CompetencyOption>();
    for (const c of competencyOptions) m.set(c.id, c);
    return m;
  }, [competencyOptions]);

  const unratedOptions = competencyOptions.filter(
    (c) => !ratings.some((r) => r.competencyId === c.id)
  );

  function addKra() {
    if (kras.length >= MAX_KRAS) return;
    setKras((prev) => [...prev, { key: newKey(), title: "", description: "", weight: 0, kpis: [] }]);
  }

  function removeKra(key: string) {
    setKras((prev) => prev.filter((k) => k.key !== key));
  }

  function updateKra(key: string, patch: Partial<Kra>) {
    setKras((prev) => prev.map((k) => (k.key === key ? { ...k, ...patch } : k)));
  }

  function addKpi(kraKey: string) {
    setKras((prev) =>
      prev.map((k) =>
        k.key === kraKey && k.kpis.length < MAX_KPIS_PER_KRA
          ? { ...k, kpis: [...k.kpis, { key: newKey(), title: "", target: "" }] }
          : k
      )
    );
  }

  function updateKpi(kraKey: string, kpiKey: string, patch: Partial<Kpi>) {
    setKras((prev) =>
      prev.map((k) =>
        k.key === kraKey
          ? { ...k, kpis: k.kpis.map((kpi) => (kpi.key === kpiKey ? { ...kpi, ...patch } : kpi)) }
          : k
      )
    );
  }

  function removeKpi(kraKey: string, kpiKey: string) {
    setKras((prev) =>
      prev.map((k) => (k.key === kraKey ? { ...k, kpis: k.kpis.filter((kpi) => kpi.key !== kpiKey) } : k))
    );
  }

  function addRating(competencyId: string) {
    setRatings((prev) => [...prev, { competencyId, subLevel: 5, selfComment: "" }]);
  }

  function updateRating(competencyId: string, patch: Partial<Rating>) {
    setRatings((prev) => prev.map((r) => (r.competencyId === competencyId ? { ...r, ...patch } : r)));
  }

  function removeRating(competencyId: string) {
    setRatings((prev) => prev.filter((r) => r.competencyId !== competencyId));
  }

  function toPayload() {
    return {
      kras: kras.map((k) => ({
        title: k.title,
        description: k.description || undefined,
        weight: Number(k.weight) || 0,
        kpis: k.kpis.map((kpi) => ({ title: kpi.title, target: kpi.target || undefined })),
      })),
      ratings: ratings.map((r) => ({
        competencyId: r.competencyId,
        subLevel: r.subLevel,
        selfComment: r.selfComment || undefined,
      })),
    };
  }

  function handleSaveDraft() {
    setMessage(null);
    setErrors([]);
    startTransition(async () => {
      const payload = toPayload();
      const result = await saveGoalDraft(goalId, payload.kras, payload.ratings);
      if (!result.ok) {
        setErrors(result.errors);
      } else {
        setMessage("Draft saved.");
        router.refresh();
      }
    });
  }

  function handleSubmit() {
    setMessage(null);
    setErrors([]);
    startTransition(async () => {
      const payload = toPayload();
      const saveResult = await saveGoalDraft(goalId, payload.kras, payload.ratings);
      if (!saveResult.ok) {
        setErrors(saveResult.errors);
        return;
      }
      const submitResult = await submitGoal(goalId);
      if (!submitResult.ok) {
        setErrors(submitResult.errors);
      } else {
        setMessage("Goal submitted for manager approval.");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-8">
      {!editable && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          This goal is read-only in its current state.
        </p>
      )}

      {errors.length > 0 && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-medium">Please fix the following:</p>
          <ul className="mt-1 list-disc pl-5">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {message && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{message}</p>}

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">KRAs &amp; KPIs (90%)</h2>
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              weightTotal === KRA_WEIGHT_TOTAL ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
            }`}
          >
            Total weight: {weightTotal}% / {KRA_WEIGHT_TOTAL}%
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Between {MIN_KRAS} and {MAX_KRAS} KRAs, weights summing to {KRA_WEIGHT_TOTAL}%. Up to{" "}
          {MAX_KPIS_PER_KRA} KPIs per KRA (optional).
        </p>

        <div className="mt-4 space-y-4">
          {kras.map((kra, index) => (
            <div key={kra.key} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-2">
                  <div className="flex gap-3">
                    <input
                      disabled={!editable}
                      value={kra.title}
                      onChange={(e) => updateKra(kra.key, { title: e.target.value })}
                      placeholder={`KRA #${index + 1} title`}
                      className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                    />
                    <input
                      disabled={!editable}
                      type="number"
                      min={0}
                      max={100}
                      value={kra.weight}
                      onChange={(e) => updateKra(kra.key, { weight: Number(e.target.value) })}
                      className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                    />
                    <span className="flex items-center text-sm text-gray-500">%</span>
                  </div>
                  <textarea
                    disabled={!editable}
                    value={kra.description}
                    onChange={(e) => updateKra(kra.key, { description: e.target.value })}
                    placeholder="Description (optional)"
                    rows={2}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                  />

                  <div className="space-y-2 pl-2">
                    {kra.kpis.map((kpi) => (
                      <div key={kpi.key} className="flex gap-2">
                        <input
                          disabled={!editable}
                          value={kpi.title}
                          onChange={(e) => updateKpi(kra.key, kpi.key, { title: e.target.value })}
                          placeholder="KPI"
                          className="flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-sm disabled:bg-gray-100"
                        />
                        <input
                          disabled={!editable}
                          value={kpi.target}
                          onChange={(e) => updateKpi(kra.key, kpi.key, { target: e.target.value })}
                          placeholder="Target"
                          className="w-40 rounded-md border border-gray-200 px-2 py-1.5 text-sm disabled:bg-gray-100"
                        />
                        {editable && (
                          <button
                            type="button"
                            onClick={() => removeKpi(kra.key, kpi.key)}
                            className="text-sm text-gray-400 hover:text-red-600"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                    {editable && kra.kpis.length < MAX_KPIS_PER_KRA && (
                      <button
                        type="button"
                        onClick={() => addKpi(kra.key)}
                        className="text-sm text-indigo-600 hover:text-indigo-500"
                      >
                        + Add KPI
                      </button>
                    )}
                  </div>
                </div>
                {editable && (
                  <button
                    type="button"
                    onClick={() => removeKra(kra.key)}
                    className="text-sm text-gray-400 hover:text-red-600"
                  >
                    Remove KRA
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {editable && kras.length < MAX_KRAS && (
          <button
            type="button"
            onClick={addKra}
            className="mt-3 rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:border-indigo-400 hover:text-indigo-600"
          >
            + Add KRA
          </button>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Role Competencies (10%)</h2>
        <p className="mt-1 text-sm text-gray-500">
          {designationName ? `Options shown for: ${designationName}. ` : ""}
          Self-rate on at least {MIN_COMPETENCY_RATINGS} of the competencies below (1&ndash;10 scale).
        </p>

        <div className="mt-4 space-y-3">
          {ratings.map((rating) => {
            const comp = competencyById.get(rating.competencyId);
            if (!comp) return null;
            const level = levelForSubLevel(comp.levels, rating.subLevel);
            return (
              <div key={rating.competencyId} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {comp.name}{" "}
                      {comp.isCore && (
                        <span className="ml-1 rounded bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-600">
                          Core
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">
                      {comp.cluster} &middot; {comp.subCluster}
                    </p>
                  </div>
                  {editable && (
                    <button
                      type="button"
                      onClick={() => removeRating(rating.competencyId)}
                      className="text-sm text-gray-400 hover:text-red-600"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <input
                    disabled={!editable}
                    type="range"
                    min={1}
                    max={10}
                    value={rating.subLevel}
                    onChange={(e) =>
                      updateRating(rating.competencyId, { subLevel: Number(e.target.value) })
                    }
                    className="flex-1"
                  />
                  <span className="w-32 shrink-0 rounded-md bg-gray-100 px-2 py-1 text-center text-sm font-medium">
                    {level?.level} &middot; {rating.subLevel}/10
                  </span>
                </div>
                <p className="mt-1 text-xs font-medium text-gray-600">{level?.levelName}</p>

                {level && level.behaviourIndicators.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-gray-500">
                    {level.behaviourIndicators.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                )}

                <textarea
                  disabled={!editable}
                  value={rating.selfComment}
                  onChange={(e) => updateRating(rating.competencyId, { selfComment: e.target.value })}
                  placeholder="Self-assessment comment (optional)"
                  rows={2}
                  className="mt-3 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm disabled:bg-gray-100"
                />
              </div>
            );
          })}
        </div>

        {editable && unratedOptions.length > 0 && (
          <select
            value=""
            onChange={(e) => e.target.value && addRating(e.target.value)}
            className="mt-3 rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">+ Add a competency to self-rate&hellip;</option>
            {unratedOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.isCore ? " (Core)" : ""}
              </option>
            ))}
          </select>
        )}
      </section>

      {editable && (
        <div className="flex gap-3 border-t border-gray-200 pt-6">
          <button
            type="button"
            disabled={isPending}
            onClick={handleSaveDraft}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            Save draft
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={handleSubmit}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            Submit for approval
          </button>
        </div>
      )}
    </div>
  );
}
