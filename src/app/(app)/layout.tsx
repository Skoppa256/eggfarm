import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getSessionUser } from "@/lib/server/auth";

import { logoutAction } from "./actions";

// Protected application shell. Middleware gives a first-pass redirect for
// unauthenticated requests; this re-checks the DB-backed session (the source of
// truth) and redirects if it's missing/expired/deactivated.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-6">
          <span className="font-semibold tracking-tight">EggFarm IMS</span>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/warehouse" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-300">
              Warehouse
            </Link>
            {user.role === "SUPERADMIN" && (
              <Link href="/users" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-300">
                Users
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-zinc-500">
            {user.name} · {user.role}
          </span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded border border-zinc-300 px-3 py-1 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Log out
            </button>
          </form>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
