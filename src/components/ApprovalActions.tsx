"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveGoal, returnGoal } from "@/lib/actions";

export default function ApprovalActions({ goalId }: { goalId: string }) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [mode, setMode] = useState<"idle" | "returning">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      try {
        await approveGoal(goalId, comment || undefined);
        router.push("/approvals");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function handleReturn() {
    if (!comment.trim()) {
      setError("Please add a comment explaining what needs revision.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await returnGoal(goalId, comment);
        router.push("/approvals");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="font-medium">Manager decision</h3>
      {error && <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {mode === "returning" && (
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Explain what needs revision..."
          rows={3}
          className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      )}

      <div className="mt-3 flex gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={handleApprove}
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
        >
          Approve
        </button>
        {mode === "idle" ? (
          <button
            type="button"
            onClick={() => setMode("returning")}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Send back with comments
          </button>
        ) : (
          <button
            type="button"
            disabled={isPending}
            onClick={handleReturn}
            className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
          >
            Confirm return
          </button>
        )}
      </div>
    </div>
  );
}
