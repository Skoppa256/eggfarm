import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getSessionUser, type Role } from "@/lib/server/auth";

import { logoutAction } from "./actions";

function navLinks(role: Role): { href: string; label: string }[] {
  const links = [{ href: "/warehouse", label: "Warehouse" }];
  if (role === "ADMIN" || role === "SUPERADMIN") {
    links.push({ href: "/collections", label: "Collection" });
    links.push({ href: "/grading", label: "Grading" });
    links.push({ href: "/flocks", label: "Flocks" });
    links.push({ href: "/daily", label: "Daily" });
    links.push({ href: "/ingredients", label: "Ingredients" });
    links.push({ href: "/mixing", label: "Mixing" });
    links.push({ href: "/ovk", label: "OVK" });
    links.push({ href: "/vaksin", label: "Vaksin" });
    links.push({ href: "/sales", label: "Sales" });
    links.push({ href: "/buyers", label: "Buyers" });
    links.push({ href: "/farmhouses", label: "Farmhouses" });
    links.push({ href: "/warehouses", label: "Warehouses" });
  }
  if (role === "SUPERADMIN") {
    links.push({ href: "/units", label: "Units" });
    links.push({ href: "/grade-types", label: "Grade Types" });
    links.push({ href: "/users", label: "Users" });
  }
  return links;
}

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
            {navLinks(user.role).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-300"
              >
                {link.label}
              </Link>
            ))}
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
