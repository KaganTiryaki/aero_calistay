import "server-only";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { hasPublicSupabaseConfig } from "@/lib/supabase/config";

export type StaffContext = { userId: string; eventId: string; role: "admin" | "staff" };

export async function getStaffContext(): Promise<StaffContext | null> {
  if (!hasPublicSupabaseConfig(process.env) || !process.env.SUPABASE_SECRET_KEY) return null;
  const authClient = await createServerSupabase();
  const { data: userData, error: authError } = await authClient.auth.getUser();
  if (authError || !userData.user) return null;
  const { data, error } = await createAdminSupabase().from("staff_members")
    .select("event_id,role,active")
    .eq("user_id", userData.user.id).eq("active", true).limit(1).maybeSingle();
  if (error || !data) return null;
  return { userId: userData.user.id, eventId: data.event_id, role: data.role };
}

export async function requireStaff(role?: "admin"): Promise<StaffContext> {
  const context = await getStaffContext();
  if (!context || (role && context.role !== role)) throw new Error("FORBIDDEN");
  return context;
}
