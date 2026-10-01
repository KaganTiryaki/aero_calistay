import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { startAdminActivity } from "@/lib/activity/server";
import { isSharedAdminAuthorized } from "@/lib/auth/login-policy";
import { checkLoginRateLimit, recordLoginFailure, resetLoginFailures } from "@/lib/auth/login-rate-limit";
import { json, protectMutation } from "@/lib/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

const bodySchema = z.object({ password: z.string().min(4).max(256) });

export async function POST(request: NextRequest) {
  try {
    protectMutation(request);
    const email = process.env.ADMIN_LOGIN_EMAIL?.trim().toLowerCase();
    if (!email || !process.env.SUPABASE_SECRET_KEY) return json({ error: "Yönetici girişi henüz kurulmadı." }, 503);
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return json({ error: "Şifre en az 4 karakter olmalı." }, 400);

    const existingDeviceId = request.cookies.get("aero_device_id")?.value;
    const deviceId = existingDeviceId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existingDeviceId)
      ? existingDeviceId : randomUUID();
    (await cookies()).set("aero_device_id", deviceId, {
      httpOnly: true, sameSite: "lax", secure: request.nextUrl.protocol === "https:", path: "/", maxAge: 60 * 60 * 24 * 180,
    });
    request.cookies.set("aero_device_id", deviceId);
    const finish = await startAdminActivity(request, null, "login");
    const limit = await checkLoginRateLimit(request, deviceId);
    if (!limit.allowed) {
      await finish("denied", { details: { reason: "rate_limit", failureCount: limit.failureCount, suspicious: true, waitSeconds: limit.waitSeconds } });
      return NextResponse.json({ error: "Çok fazla başarısız deneme. Lütfen bekleyin." }, { status: 429, headers: { "Cache-Control": "private, no-store", "Retry-After": String(limit.waitSeconds) } });
    }
    const client = await createServerSupabase();
    const { data, error } = await client.auth.signInWithPassword({ email, password: parsed.data.password });
    if (error || !data.user || !data.session) {
      const failed = await recordLoginFailure(request, deviceId);
      await finish("denied", { details: { reason: "invalid_credentials", failureCount: failed.failureCount, suspicious: failed.suspicious, waitSeconds: failed.waitSeconds } });
      const response = json({ error: "Giriş yapılamadı. Şifreyi kontrol edin." }, 401);
      if (failed.waitSeconds) response.headers.set("Retry-After", String(failed.waitSeconds));
      return response;
    }

    const admin = createAdminSupabase();
    const { data: membership, error: membershipError } = await admin.from("staff_members")
      .select("user_id,event_id,role,active").eq("user_id", data.user.id).eq("role", "admin").eq("active", true)
      .limit(1).maybeSingle();
    if (membershipError || !isSharedAdminAuthorized(data.user.id, membership)) {
      await client.auth.signOut();
      const failed = await recordLoginFailure(request, deviceId);
      await finish("denied", { details: { reason: "not_admin", failureCount: failed.failureCount, suspicious: failed.suspicious, waitSeconds: failed.waitSeconds } });
      return json({ error: "Giriş yapılamadı. Şifreyi kontrol edin." }, 401);
    }

    const { data: claimsData, error: claimsError } = await client.auth.getClaims();
    const sessionId = claimsData?.claims?.session_id;
    if (claimsError || typeof sessionId !== "string") {
      await client.auth.signOut();
      await finish("denied");
      return json({ error: "Oturum açılamadı." }, 503);
    }
    await resetLoginFailures(request, deviceId);
    if (!(await finish("succeeded", { actorId: data.user.id, eventId: membership.event_id, sessionId }))) {
      await client.auth.signOut();
      return json({ error: "Giriş kaydı oluşturulamadı." }, 503);
    }
    return json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") return json({ error: "İzin verilmeyen istek." }, 403);
    if (error instanceof Error && error.message === "BAD_REQUEST") return json({ error: "Geçersiz istek." }, 400);
    console.error("Shared administrator login failed", error instanceof Error ? error.message : "UNKNOWN");
    return json({ error: "Giriş şu anda tamamlanamıyor." }, 503);
  }
}
