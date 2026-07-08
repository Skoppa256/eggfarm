import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { homePathForRole } from "@/lib/nav";
import { getSessionUser, type Role } from "@/lib/server/auth";

import { AppShell, type IconName, type NavGroup } from "./app-nav";

// Grouped, role-filtered navigation. Items carry the roles that may see them so the
// same source respects existing gating (Superadmin-only items never show for Admin).
type GroupDef = {
  title: string;
  items: { href: string; label: string; icon: IconName; roles: Role[] }[];
};

const OPS: Role[] = ["ADMIN", "SUPERADMIN"];
const SA: Role[] = ["SUPERADMIN"];

const GROUPS: GroupDef[] = [
  {
    title: "Tugas Harian",
    items: [
      { href: "/tugas", label: "Tugas Hari Ini", icon: "tasks", roles: OPS },
      { href: "/collections", label: "Koleksi", icon: "egg", roles: OPS },
      { href: "/grading", label: "Grading", icon: "scale", roles: OPS },
      { href: "/daily", label: "Catatan Harian", icon: "clipboard", roles: OPS },
    ],
  },
  {
    title: "Gudang & Penjualan",
    items: [
      { href: "/warehouse", label: "Stok Gudang", icon: "box", roles: OPS },
      { href: "/warehouse/correction", label: "Koreksi Stok", icon: "adjust", roles: SA },
      { href: "/sales", label: "Penjualan", icon: "cart", roles: OPS },
      { href: "/buyers", label: "Pembeli", icon: "people", roles: OPS },
    ],
  },
  {
    title: "Pakan & Kesehatan",
    items: [
      { href: "/mixing", label: "Pakan (Mixing)", icon: "beaker", roles: OPS },
      { href: "/ingredients", label: "Bahan Pakan", icon: "grid", roles: OPS },
      { href: "/ovk", label: "OVK", icon: "pill", roles: OPS },
      { href: "/vaksin", label: "Vaksin", icon: "shield", roles: OPS },
    ],
  },
  {
    title: "Analitik",
    items: [
      // Admin can reach analytics via nav, but their home is the task board.
      { href: "/dashboard", label: "Dashboard", icon: "chart", roles: ["ADMIN", "OWNER", "SUPERADMIN"] },
      { href: "/reports", label: "Laporan", icon: "document", roles: ["OWNER", "SUPERADMIN"] },
    ],
  },
  {
    title: "Data & Pengaturan",
    items: [
      { href: "/warehouses", label: "Data Gudang", icon: "box", roles: SA },
      { href: "/farmhouses", label: "Kandang", icon: "home", roles: SA },
      { href: "/flocks", label: "Flock", icon: "layers", roles: SA },
      { href: "/grade-types", label: "Jenis Grade", icon: "tag", roles: SA },
      { href: "/units", label: "Satuan", icon: "ruler", roles: SA },
      { href: "/users", label: "Pengguna", icon: "people", roles: SA },
    ],
  },
];

function navGroupsFor(role: Role): NavGroup[] {
  return GROUPS.map((g) => ({
    title: g.title,
    items: g.items
      .filter((i) => i.roles.includes(role))
      .map(({ href, label, icon }) => ({ href, label, icon })),
  })).filter((g) => g.items.length > 0);
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
    <AppShell
      user={{ name: user.name, role: user.role }}
      groups={navGroupsFor(user.role)}
      homeHref={homePathForRole(user.role)}
    >
      {children}
    </AppShell>
  );
}
