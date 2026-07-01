import Link from "next/link";
import { redirect } from "next/navigation";

import { businessToday, formatDateOnly } from "@/lib/dates";
import { getSessionUser } from "@/lib/server/auth";
import { listActiveBuyers } from "@/lib/server/buyers";
import {
  listGradeTypes as listActiveGradeTypes,
  listWarehouses as listActiveWarehouses,
} from "@/lib/server/catalog";

import { SaleForm } from "../sale-form";

export const dynamic = "force-dynamic";

export default async function NewSalePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role === "OWNER") redirect("/warehouse");

  const [warehouses, buyers, gradeTypes] = await Promise.all([
    listActiveWarehouses(),
    listActiveBuyers(),
    listActiveGradeTypes(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-6 sm:p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New sale</h1>
          <p className="text-sm text-zinc-500">Deducts stock atomically on submit.</p>
        </div>
        <Link href="/sales" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200">
          ← All sales
        </Link>
      </header>

      <SaleForm
        warehouses={warehouses.map((w) => ({ id: w.id, name: w.name, code: w.code }))}
        buyers={buyers.map((b) => ({ id: b.id, name: b.name }))}
        gradeTypes={gradeTypes.map((t) => ({ id: t.id, name: t.name }))}
        defaultDate={formatDateOnly(businessToday())}
      />
    </main>
  );
}
