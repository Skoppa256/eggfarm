import Link from "next/link";
import { redirect } from "next/navigation";

import { businessToday, formatDateOnly } from "@/lib/dates";
import { getSessionUser } from "@/lib/server/auth";
import { listFreeFarmhouses } from "@/lib/server/flocks";

import { FlockForm } from "../flock-form";

export const dynamic = "force-dynamic";

export default async function NewFlockPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "SUPERADMIN") redirect("/flocks"); // chick-in is Superadmin only

  const farmhouses = await listFreeFarmhouses();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-6 sm:p-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Chick-in Baru</h1>
          <p className="text-sm text-zinc-500">
            Satu flock, satu strain dan umur, ditempatkan ke satu atau lebih kandang kosong.
          </p>
        </div>
        <Link href="/flocks" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200">
          ← Semua flock
        </Link>
      </header>

      <FlockForm
        farmhouses={farmhouses.map((f) => ({ id: f.id, name: f.name, code: f.code }))}
        defaultDate={formatDateOnly(businessToday())}
      />
    </main>
  );
}
