import Link from "next/link";

import type { Role } from "@/lib/server/auth";

type TabKey = "stock" | "ledger" | "correction" | "thresholds" | "audit";

export function WarehouseTabs({
  active,
  warehouseId,
  role,
}: {
  active: TabKey;
  warehouseId?: string;
  role: Role;
}) {
  const q = warehouseId ? `?warehouseId=${warehouseId}` : "";
  const tabs: { key: TabKey; href: string; label: string }[] = [
    { key: "stock", href: `/warehouse${q}`, label: "Stok" },
    { key: "ledger", href: `/warehouse/ledger${q}`, label: "Mutasi" },
  ];
  if (role === "SUPERADMIN") {
    tabs.push({ key: "correction", href: `/warehouse/correction${q}`, label: "Koreksi" });
  }
  if (role === "ADMIN" || role === "SUPERADMIN") {
    tabs.push({ key: "thresholds", href: `/warehouse/thresholds${q}`, label: "Batas Minimum" });
  }
  if (role === "SUPERADMIN") {
    tabs.push({ key: "audit", href: `/warehouse/audit${q}`, label: "Audit Koreksi" });
  }

  return (
    <nav className="flex flex-wrap gap-1 border-b border-zinc-200 dark:border-zinc-800">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          className={`px-3 py-2 text-sm ${
            t.key === active
              ? "border-b-2 border-zinc-900 font-semibold dark:border-zinc-100"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
