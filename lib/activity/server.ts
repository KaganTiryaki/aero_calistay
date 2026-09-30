import "server-only";
import type { NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import type { StaffContext } from "@/lib/auth/permissions";
import { requestMetadata } from "@/lib/activity/metadata";

type Outcome = "succeeded" | "denied";
type FinishData = { actorId?: string; eventId?: string; sessionId?: string; targetId?: string; details?: Record<string, unknown> };

export async function currentSessionId(actorId: string): Promise<string> {
  const { data, error } = await (await createServerSupabase()).auth.getClaims();
  const claims = data?.claims;
  if (error || claims?.sub !== actorId || typeof claims.session_id !== "string") throw new Error("AUDIT_SESSION_MISSING");
  return claims.session_id;
}

export async function startAdminActivity(
  request: NextRequest,
  staff: StaffContext | null,
  action: string,
  targetId?: string,
  details: Record<string, unknown> = {},
) {
  const metadata = requestMetadata(request.headers);
  const deviceCookie = request.cookies.get("aero_device_id")?.value;
  const deviceId = deviceCookie && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceCookie)
    ? deviceCookie : null;
  const sessionId = staff ? await currentSessionId(staff.userId) : null;
  const client = createAdminSupabase();
  const { data, error } = await client.from("admin_activity").insert({
    actor_id: staff?.userId ?? null,
    event_id: staff?.eventId ?? null,
    session_id: sessionId,
    device_id: deviceId,
    action,
    target_id: targetId ?? null,
    outcome: "started",
    ip_address: metadata.ipAddress,
    user_agent: metadata.userAgent,
    platform: metadata.platform,
    device_class: metadata.deviceClass,
    details,
  }).select("id").single();
  if (error || !data) throw new Error("AUDIT_UNAVAILABLE");

  return async function finish(outcome: Outcome, update: FinishData = {}): Promise<boolean> {
    const { error: updateError } = await client.from("admin_activity").update({
      outcome,
      actor_id: update.actorId ?? staff?.userId ?? null,
      event_id: update.eventId ?? staff?.eventId ?? null,
      session_id: update.sessionId ?? sessionId,
      target_id: update.targetId ?? targetId ?? null,
      details: update.details ?? details,
      completed_at: new Date().toISOString(),
    }).eq("id", data.id);
    if (updateError) {
      // The action may already be committed. Keep the initial row as "started"
      // so an operator can investigate without prompting an unsafe retry.
      console.error("Admin activity could not be completed", updateError.code);
      return false;
    }
    return true;
  };
}
