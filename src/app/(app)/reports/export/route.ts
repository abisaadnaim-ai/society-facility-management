import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/queries/get-session-profile";
import { canViewReports } from "@/lib/auth/permissions";
import { resolveFilters, type RawSearchParams } from "@/lib/reports/filters";
import {
  exportFmRequests,
  exportWorkOrders,
  exportContracts,
  exportStockMovements,
  type CsvTable,
} from "@/lib/queries/reports";

export const dynamic = "force-dynamic";

/** Serialises a value for CSV, quoting when needed and escaping quotes. */
function cell(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(table: CsvTable): string {
  const lines = [table.headers.map(cell).join(","), ...table.rows.map((r) => r.map(cell).join(","))];
  // UTF-8 BOM so Excel opens it with correct encoding (spec §29).
  return "\uFEFF" + lines.join("\r\n");
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getSessionProfile(supabase, user.id) : null;

  // Exports follow identical authorization to the reports themselves (§33).
  if (!canViewReports(profile)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const url = new URL(request.url);
  const dataset = url.searchParams.get("dataset") ?? "";
  const raw: RawSearchParams = Object.fromEntries(url.searchParams.entries());
  const filters = resolveFilters(raw);

  let table: CsvTable;
  switch (dataset) {
    case "fm-requests":
      table = await exportFmRequests(supabase, filters);
      break;
    case "work-orders":
      table = await exportWorkOrders(supabase, filters);
      break;
    case "contracts":
      table = await exportContracts(supabase);
      break;
    case "stock-movements":
      table = await exportStockMovements(supabase, filters);
      break;
    default:
      return new NextResponse("Unknown dataset", { status: 400 });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `society-${table.filename}-${stamp}.csv`;

  return new NextResponse(toCsv(table), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
