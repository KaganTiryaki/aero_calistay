import "server-only";
import type { NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requestMetadata } from "@/lib/activity/metadata";

export type LoginRateLimitDecision = { allowed: boolean; waitSeconds: number; failureCount: number; suspicious: boolean };

function readDecision(value: unknown): LoginRateLimitDecision {
  const row = Array.isArray(value) ? value[0] : value;
  const record = (row && typeof row === "object" ? row : {}) as Record<string, unknown>;
  return { allowed: record.allowed !== false, waitSeconds: Number(record.wait_seconds ?? 0), failureCount: Number(record.failure_count ?? 0), suspicious: record.suspicious === true };
}

function identity(request: NextRequest, deviceId: string) {
  return { ip: requestMetadata(request.headers).ipAddress, deviceId };
}

export async function checkLoginRateLimit(request: NextRequest, deviceId: string) {
  const id = identity(request, deviceId);
  const { data, error } = await createAdminSupabase().rpc("check_admin_login_rate_limit", { p_ip: id.ip, p_device_id: id.deviceId, p_now: new Date().toISOString() });
  if (error) throw new Error("LOGIN_RATE_LIMIT_UNAVAILABLE");
  return readDecision(data);
}

export async function recordLoginFailure(request: NextRequest, deviceId: string) {
  const id = identity(request, deviceId);
  const { data, error } = await createAdminSupabase().rpc("record_admin_login_failure", { p_ip: id.ip, p_device_id: id.deviceId, p_now: new Date().toISOString() });
  if (error) throw new Error("LOGIN_RATE_LIMIT_UNAVAILABLE");
  return readDecision(data);
}

export async function resetLoginFailures(request: NextRequest, deviceId: string) {
  const id = identity(request, deviceId);
  const { error } = await createAdminSupabase().rpc("reset_admin_login_failures", { p_ip: id.ip, p_device_id: id.deviceId });
  if (error) throw new Error("LOGIN_RATE_LIMIT_UNAVAILABLE");
}
