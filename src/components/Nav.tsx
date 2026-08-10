import Link from "next/link";
import type { Session } from "next-auth";
import { signOut } from "@/lib/auth";

export default function Nav({ session }: { session: Session }) {
  return (
    <nav className="flex items-center justify-between border-b border-gray-200 pb-4">
      <div className="flex items-center gap-6">
        <Link href="/" className="font-semibold text-gray-900">
          Goal Setting
        </Link>
        <Link href="/goal" className="text-sm text-gray-600 hover:text-gray-900">
          My Goal
        </Link>
        {(session.user.systemRole === "MANAGER" || session.user.systemRole === "HR_ADMIN") && (
          <Link href="/approvals" className="text-sm text-gray-600 hover:text-gray-900">
            Approvals
          </Link>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">
          {session.user.name} &middot; {session.user.systemRole}
        </span>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button type="submit" className="text-sm text-gray-500 hover:text-red-600">
            Sign out
          </button>
        </form>
      </div>
    </nav>
  );
}
