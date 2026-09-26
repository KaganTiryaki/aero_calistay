import { NextRequest } from "next/server";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { brevoEventTime, eventFingerprint } from "@/lib/mail/brevo-events";
import { verifyBearer } from "@/lib/security";
import { json } from "@/lib/http";

const payloadSchema = z.object({
  event: z.string().min(1), email: z.string().email(),
  "message-id": z.string().min(1),
  date: z.union([z.number(), z.string()]).optional(),
  ts_event: z.union([z.number(), z.string()]).optional(),
  tag: z.union([z.string(), z.array(z.string())]).optional(),
  tags: z.array(z.string()).optional(),
});

function jobTag(payload: z.infer<typeof payloadSchema>): string | null {
  let tags = payload.tags ?? [];
  if (typeof payload.tag === "string") {
    try { const parsed: unknown = JSON.parse(payload.tag); tags = Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === "string") : [payload.tag]; }
    catch { tags = [payload.tag]; }
  } else if (payload.tag) tags = payload.tag;
  return tags.find((tag) => /^aero-job-[0-9a-f-]{36}$/.test(tag)) ?? null;
}

export async function POST(request: NextRequest) {
  if (!verifyBearer(request.headers.get("authorization"), process.env.BREVO_WEBHOOK_TOKEN ?? ""))
    return json({ error: "Unauthorized" }, 401);
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 32_768) return json({ error: "Payload too large" }, 413);
  let raw: string;
  try { raw = await request.text(); } catch { return json({ error: "Bad payload" }, 400); }
  if (raw.length > 32_768) return json({ error: "Payload too large" }, 413);
  let parsed: ReturnType<typeof payloadSchema.safeParse>;
  try { parsed = payloadSchema.safeParse(JSON.parse(raw)); } catch { return json({ error: "Bad payload" }, 400); }
  if (!parsed.success) return json({ error: "Bad payload" }, 400);
  const tag = jobTag(parsed.data);
  if (!tag) return json({ accepted: false });
  const providerTime = brevoEventTime({ tsEvent: parsed.data.ts_event, date: parsed.data.date });
  if (!providerTime) return json({ error: "Bad payload" }, 400);
  const fingerprint = eventFingerprint({ messageId: parsed.data["message-id"], email: parsed.data.email,
    event: parsed.data.event, date: providerTime });
  const { data, error } = await createAdminSupabase().rpc("record_mail_event", {
    p_fingerprint: fingerprint, p_tag: tag, p_message_id: parsed.data["message-id"],
    p_email: parsed.data.email, p_event: parsed.data.event, p_provider_time: providerTime,
  });
  if (error) return json({ error: "Temporary storage error" }, 429);
  return json({ accepted: data });
}
