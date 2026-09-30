import { NextRequest } from "next/server";
import { requireStaff } from "@/lib/auth/permissions";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { failure, json } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    await requireStaff("admin");
    const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000) return json({ error: "Sayfa geçersiz." }, 400);
    const { data, error } = await createAdminSupabase().from("admin_activity")
      .select("id,actor_id,session_id,device_id,action,target_id,outcome,ip_address,user_agent,platform,device_class,details,created_at,completed_at")
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .range((page - 1) * 50, page * 50);
    if (error) throw error;
    return json({ items: (data ?? []).slice(0, 50), hasMore: (data ?? []).length > 50, page });
  } catch (error) { return failure(error); }
}
