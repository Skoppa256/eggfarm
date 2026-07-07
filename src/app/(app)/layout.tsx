import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getSessionUser, type Role } from "@/lib/server/auth";

import { logoutAction } from "./actions";
import { SideNavLinks } from "./side-nav";

function navLinks(role: Role): { href: string; label: string }[] {
  const links = [{ href: "/dashboard", label: "Dashboard" }];
  // Reports: Owner + Superadmin (Admin is daily-ops only; reports are Superadmin-managed).
  if (role === "OWNER" || role === "SUPERADMIN") {
    links.push({ href: "/reports", label: "Reports" });
  }
  // Daily operations: Admin + Superadmin (incl. Warehouse egg-stock ops).
  if (role === "ADMIN" || role === "SUPERADMIN") {
    links.push({ href: "/collections", label: "Collection" });
    links.push({ href: "/grading", label: "Grading" });
    links.push({ href: "/daily", label: "Daily" });
    links.push({ href: "/ingredients", label: "Ingredients" });
    links.push({ href: "/mixing", label: "Mixing" });
    links.push({ href: "/ovk", label: "OVK" });
    links.push({ href: "/vaksin", label: "Vaksin" });
    links.push({ href: "/sales", label: "Sales" });
    links.push({ href: "/buyers", label: "Buyers" });
    links.push({ href: "/warehouse", label: "Warehouse" });
  }
  // Structure & master data: Superadmin only (Warehouses master, Farmhouses, Flocks, catalogs, users).
  if (role === "SUPERADMIN") {
    links.push({ href: "/warehouses", label: "Warehouses" });
    links.push({ href: "/flocks", label: "Flocks" });
    links.push({ href: "/farmhouses", label: "Farmhouses" });
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
    <div className="flex min-h-screen w-full">
      <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50">
        <div className="border-b border-zinc-200 px-4 py-3">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            EggFarm IMS
          </Link>
        </div>
        <SideNavLinks links={navLinks(user.role)} />
        <div className="border-t border-zinc-200 p-3">
          <div className="px-1 text-sm font-medium text-zinc-700">{user.name}</div>
          <div className="px-1 text-xs text-zinc-400">{user.role}</div>
          <form action={logoutAction} className="mt-2">
            <button
              type="submit"
              className="w-full rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100"
            >
              Log out
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
