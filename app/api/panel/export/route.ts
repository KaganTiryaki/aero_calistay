import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/permissions";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { csvRow } from "@/lib/security";
import { failure, privateHeaders } from "@/lib/http";
import { startAdminActivity } from "@/lib/activity/server";

export async function GET(request: NextRequest) {
  try {
    const staff = await requireStaff("admin");
    const client = createAdminSupabase();
    const { data: committees } = await client.from("committees").select("id,name").eq("event_id", staff.eventId);
    const names = new Map((committees ?? []).map((item) => [item.id, item.name]));
    const lines = [csvRow(["Ad", "Soyad", "E-posta", "Komite", "Onay zamanı"])];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await client.from("applications")
        .select("first_name,last_name,email,committee_id,approved_at")
        .eq("event_id", staff.eventId).eq("status", "approved")
        .order("created_at").range(offset, offset + 999);
      if (error) throw error;
      (data ?? []).forEach((item) => lines.push(csvRow([item.first_name, item.last_name, item.email,
        names.get(item.committee_id) ?? "", item.approved_at ?? ""])));
      if (!data || data.length < 1000) break;
    }
    const finish = await startAdminActivity(request, staff, "csv_export", undefined,
      { count: Math.max(0, lines.length - 1) });
    await finish("succeeded");
    return new NextResponse(`\ufeff${lines.join("\r\n")}`, { headers: { ...privateHeaders,
      "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=aero-onaylananlar.csv" } });
  } catch (error) { return failure(error); }
}
