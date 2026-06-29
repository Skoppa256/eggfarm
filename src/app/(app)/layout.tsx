import type { ReactNode } from "react";

import { requireUser } from "@/lib/server/auth";

// Protected application shell. Real gating (middleware redirecting unauthenticated
// users to /login) lands in Slice 2; for now `requireUser` returns the Slice 1
// stub user, so this establishes the pattern without enforcing it yet.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <span className="font-semibold tracking-tight">EggFarm IMS</span>
        <span className="text-sm text-zinc-500">
          {user.name} · {user.role}
        </span>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
