import "server-only";

import ExcelJS from "exceljs";

import type { ReportResult } from "@/lib/server/reports";

// Read-only export of a ReportResult to a well-formed .xlsx workbook (SRS §8, ExcelJS).
// Purely serializes the same data the report page shows — no DB writes.

export async function reportToXlsx(title: string, result: ReportResult): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "EggFarm IMS";
  const ws = wb.addWorksheet((title || "Report").slice(0, 31));

  const header = ws.addRow(result.columns.map((c) => c.label));
  header.font = { bold: true };
  for (const row of result.rows) ws.addRow(row);

  ws.columns.forEach((col, i) => {
    const label = result.columns[i]?.label ?? "";
    col.width = Math.min(40, Math.max(12, label.length + 2));
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
