import "server-only";

import { RecordStatus } from "@/generated/prisma/enums";
import { toBusinessDate } from "@/lib/dates";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/server/db";

// Vaksin log (SRS §3.13) — a pure activity log, NO inventory. One row per vaccination
// event (date, type, vials, kandang, vaccinator). The daily record's VAKSIN field derives
// live from these rows (FR-101), so nothing is stored on the DailyRecord.

export interface VaksinLogInput {
  date: Date; // business date
  vaksinTypeId: string;
  farmhouseId: string;
  vials: number;
  vaccinator: string;
}

interface Ctx {
  userId: string;
}

const LOG_INCLUDE = {
  vaksinType: { select: { name: true, status: true } },
  farmhouse: { select: { name: true, code: true } },
};

/**
 * Record a vaccination event. The vaksin type must exist and be ACTIVE (a deactivated
 * type is excluded from new logs, though its past logs are retained); the kandang must
 * exist. Vials ≥ 1; a vaccinator is required.
 */
export async function createVaksinLog(input: VaksinLogInput, ctx: Ctx) {
  const date = toBusinessDate(input.date);
  if (!Number.isInteger(input.vials) || input.vials < 1) {
    throw new ConflictError("Vial harus bilangan bulat minimal 1.");
  }
  const vaccinator = input.vaccinator.trim();
  if (vaccinator.length === 0) throw new ConflictError("Vaksinator wajib diisi.");

  const type = await prisma.vaksinType.findUnique({ where: { id: input.vaksinTypeId } });
  if (!type) throw new NotFoundError("Tipe vaksin tidak ditemukan.");
  if (type.status !== RecordStatus.ACTIVE) {
    throw new ConflictError(`Tipe vaksin "${type.name}" tidak aktif.`);
  }
  const farmhouse = await prisma.farmhouse.findUnique({ where: { id: input.farmhouseId } });
  if (!farmhouse) throw new NotFoundError("Kandang tidak ditemukan.");

  return prisma.vaksinLog.create({
    data: {
      date,
      vaksinTypeId: input.vaksinTypeId,
      farmhouseId: input.farmhouseId,
      vials: input.vials,
      vaccinator,
      enteredById: ctx.userId,
    },
    include: LOG_INCLUDE,
  });
}

export interface VaksinLogFilter {
  from?: Date;
  to?: Date;
  farmhouseId?: string;
  vaksinTypeId?: string;
  vaccinator?: string;
}

/** The vaksin log, filterable by date range / kandang / type / vaccinator (FR-102). */
export function listVaksinLogs(filter: VaksinLogFilter = {}) {
  const { from, to, farmhouseId, vaksinTypeId, vaccinator } = filter;
  return prisma.vaksinLog.findMany({
    where: {
      ...(farmhouseId ? { farmhouseId } : {}),
      ...(vaksinTypeId ? { vaksinTypeId } : {}),
      ...(vaccinator ? { vaccinator: { contains: vaccinator, mode: "insensitive" } } : {}),
      ...(from || to
        ? { date: { ...(from ? { gte: toBusinessDate(from) } : {}), ...(to ? { lte: toBusinessDate(to) } : {}) } }
        : {}),
    },
    include: LOG_INCLUDE,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
}

/**
 * The daily record's derived VAKSIN field (FR-101): every vaccination logged for a
 * kandang on a business date. A live read of the log (single source of truth) — not
 * stored on the DailyRecord.
 */
export function vaksinForDailyRecord(farmhouseId: string, date: Date) {
  return prisma.vaksinLog.findMany({
    where: { farmhouseId, date: toBusinessDate(date) },
    include: { vaksinType: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
}
