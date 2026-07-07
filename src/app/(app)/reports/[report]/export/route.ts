import { getSessionUser } from "@/lib/server/auth";
import { reportToXlsx } from "@/lib/server/reportExport";
import { findReport, toReportFilters } from "@/lib/server/reports";

// Read-only .xlsx export of a report (SRS §8). Same data as the report page; role-gated to
// the report's §8.1 access roles (Owner can't export an Admin/Superadmin-only report).
export async function GET(req: Request, { params }: { params: Promise<{ report: string }> }) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (user.role === "ADMIN") return new Response("Forbidden", { status: 403 }); // reports are Owner/Superadmin only

  const { report: slug } = await params;
  const report = findReport(slug);
  if (!report) return new Response("Report not found", { status: 404 });
  if (!report.roles.includes(user.role)) return new Response("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const filters = toReportFilters((k) => url.searchParams.get(k));
  const result = await report.load(filters);
  const buffer = await reportToXlsx(report.title, result);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${slug}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
