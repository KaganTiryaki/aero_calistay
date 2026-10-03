import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { json } from "@/lib/http";

function secret() {
  const value = process.env.PARTICIPANT_AUTH_LINK_HMAC_KEY;
  if (!value || value.length < 32) throw new Error("AUTH_LINK_NOT_CONFIGURED");
  return value;
}
export function identityHash(value: string) { return createHmac("sha256", secret()).update(value).digest("hex"); }
export function tokenFingerprint(value: string) { return createHash("sha256").update(value).digest("hex"); }
export function trustedIp(request: NextRequest) {
  const value = (process.env.VERCEL === "1" ? request.headers.get("x-vercel-forwarded-for")
    : process.env.NODE_ENV !== "production" ? request.headers.get("x-real-ip") : null)?.trim();
  if (!value || !isIP(value)) throw new Error("IP_UNAVAILABLE");
  return value;
}
export async function reserveAuthAttempt(request: NextRequest, purpose: "login" | "activation") {
  const { data, error } = await createAdminSupabase().rpc("check_participant_auth_attempt", { p_ip_hash: identityHash(`attempt:${trustedIp(request)}`), p_purpose: purpose });
  if (error || !data?.[0]) throw new Error("AUTH_LIMIT_UNAVAILABLE");
  if (data[0].allowed === true) return null;
  const response = json({ error: "Çok fazla başarısız deneme. Lütfen bekleyin." }, 429);
  response.headers.set("Retry-After", String(Math.max(1, data[0].wait_seconds))); return response;
}
export async function recordAuthAttempt(request: NextRequest, purpose: "login" | "activation", success: boolean) {
  const { error } = await createAdminSupabase().rpc("record_participant_auth_attempt", { p_ip_hash: identityHash(`attempt:${trustedIp(request)}`), p_purpose: purpose, p_success: success });
  if (error) throw new Error("AUTH_LIMIT_UNAVAILABLE");
}
type Proof = { userId: string; jobId: string | null; fingerprint: string | null; type: "invite" | "recovery"; audience: "participant" | "staff"; expires: number };
const proofCookie = "aero_activation_proof";
export async function writeActivationProof(proof: Omit<Proof,"expires">) {
  const body = Buffer.from(JSON.stringify({ ...proof, expires: Date.now() + 600_000 })).toString("base64url");
  const signature = identityHash(`proof:${body}`);
  (await cookies()).set(proofCookie, `${body}.${signature}`, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/api/participant/activate", maxAge: 600 });
}
export async function readActivationProof(): Promise<Proof> {
  const parts = (await cookies()).get(proofCookie)?.value.split(".") ?? [];
  if (parts.length !== 2 || !/^[0-9a-f]{64}$/.test(parts[1])) throw new Error("FORBIDDEN");
  const signature = identityHash(`proof:${parts[0]}`);
  if (!timingSafeEqual(Buffer.from(signature),Buffer.from(parts[1]))) throw new Error("FORBIDDEN");
  const proof = JSON.parse(Buffer.from(parts[0],"base64url").toString()) as Proof;
  if (!proof.userId || proof.expires <= Date.now() || !["invite","recovery"].includes(proof.type) || !["participant","staff"].includes(proof.audience)) throw new Error("FORBIDDEN");
  return proof;
}
export async function clearActivationProof() { (await cookies()).set(proofCookie,"",{ path:"/api/participant/activate",maxAge:0 }); }
