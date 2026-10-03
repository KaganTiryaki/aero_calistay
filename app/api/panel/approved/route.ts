import { NextRequest } from "next/server";
import { requireStaff } from "@/lib/auth/permissions";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { failure, json } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000) return json({ error: "Sayfa geçersiz." }, 400);
    const pageSize = 100;
    const staff = await requireStaff("admin");
    const client = createAdminSupabase();
    const { data: apps, error } = await client.from("applications")
      .select("id,first_name,last_name,email,committee_id,approved_at,status")
      .eq("event_id", staff.eventId).eq("status", "confirmed")
      .order("approved_at", { ascending: false }).order("id")
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (error) throw error;
    const ids = (apps ?? []).map((item) => item.id);
    const [committeeResult, credentialResult, checkInResult, jobResult] = await Promise.all([
      client.from("committees").select("id,name").eq("event_id", staff.eventId),
      ids.length ? client.from("qr_credentials").select("application_id,manual_code,active").in("application_id", ids) : Promise.resolve({ data: [], error: null }),
      ids.length ? client.from("check_ins").select("application_id,checked_in_at").in("application_id", ids) : Promise.resolve({ data: [], error: null }),
      ids.length ? client.from("mail_jobs").select("application_id,delivery_status,status").in("application_id", ids) : Promise.resolve({ data: [], error: null }),
    ]);
    for (const result of [committeeResult, credentialResult, checkInResult, jobResult]) {
      if (result.error) throw result.error;
    }
    const committees = committeeResult.data;
    const credentials = credentialResult.data;
    const checkIns = checkInResult.data;
    const jobs = jobResult.data;
    const names = new Map((committees ?? []).map((item) => [item.id, item.name]));
    const codes = new Map((credentials ?? []).map((item) => [item.application_id, item]));
    const entries = new Map((checkIns ?? []).map((item) => [item.application_id, item.checked_in_at]));
    const mail = new Map((jobs ?? []).map((item) => [item.application_id, item]));
    return json({ hasMore: (apps ?? []).length === pageSize, items: (apps ?? []).map((item) => ({ ...item,
      committee_name: names.get(item.committee_id) ?? "", manual_code: codes.get(item.id)?.manual_code ?? "",
      checked_in_at: entries.get(item.id) ?? null, delivery_status: mail.get(item.id)?.delivery_status ?? "unknown",
    })) });
  } catch (error) { return failure(error); }
}
