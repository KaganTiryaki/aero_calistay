import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/permissions";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { renderApprovalMail } from "@/lib/mail/approval-template";
import { failure, json, protectMutation } from "@/lib/http";
import { startAdminActivity } from "@/lib/activity/server";
import { callMailWorker } from "@/lib/mail/dispatch";
import { summarizeMailJobs } from "@/lib/mail/status";

export const maxDuration = 60;

const bodySchema = z.object({
  batchId: z.string().uuid(),
  selections: z.array(z.object({ applicationId: z.string().uuid(), version: z.number().int().positive(), committeeId: z.string().uuid() })).min(1).max(3),
});

export async function GET(request: NextRequest) {
  try {
    const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000) return json({ error: "Sayfa geçersiz." }, 400);
    const staff = await requireStaff("admin");
    const client = createAdminSupabase();
    const { data: batches, error } = await client.from("mail_batches")
      .select("id,total,created_at").eq("event_id", staff.eventId)
      .order("created_at", { ascending: false }).order("id")
      .range((page - 1) * 10, page * 10);
    if (error) throw error;
    const visibleBatches = (batches ?? []).slice(0, 10);
    const ids = visibleBatches.map((item) => item.id);
    const jobs = [];
    if (ids.length) for (let offset = 0; ; offset += 500) {
      const { data, error: jobsError } = await client.from("mail_jobs")
        .select("id,batch_id,recipient_name,recipient_email,committee_name,status,delivery_status,last_error,reopened_at,created_at")
        .in("batch_id", ids).order("created_at", { ascending: false }).order("id")
        .range(offset, offset + 499);
      if (jobsError) throw jobsError;
      jobs.push(...(data ?? []));
      if (!data || data.length < 500) break;
    }
    return json({ batches: visibleBatches, jobs, hasMore: (batches ?? []).length > 10 });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  try {
    protectMutation(request);
    const staff = await requireStaff("admin");
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return json({ error: "Seçim geçersiz." }, 400);
    const submission = parsed.data;
    const ids = submission.selections.map((item) => item.applicationId);
    if (new Set(ids).size !== ids.length) return json({ error: "Aynı kişi iki kez seçildi." }, 400);
    const client = createAdminSupabase();
    const requestHash = createHash("sha256").update(JSON.stringify(submission.selections)).digest("hex");
    async function dispatchBatch(batchId: string, preflightDone = false) {
      if (!preflightDone) {
        const health = await callMailWorker({ action: "health" });
        if (!health.ready) return json({ batchId, ...health }, 503);
      }
      const result = await callMailWorker({ batchId, limit: 3 });
      const { data: states, error } = await client.from("mail_jobs")
        .select("status,delivery_status,last_error").eq("batch_id", batchId);
      if (error) throw error;
      return json({ batchId, ...result, ...summarizeMailJobs(states ?? []) }, result.ready ? 200 : 202);
    }
    async function existingBatch() {
      const { data, error } = await client.from("mail_batches")
        .select("event_id,created_by,request_hash").eq("id", submission.batchId).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      if (data.event_id !== staff.eventId || data.created_by !== staff.userId || data.request_hash !== requestHash)
        return json({ error: "Grup kimliği başka bir seçim için kullanılmış." }, 409);
      return dispatchBatch(submission.batchId);
    }
    const prior = await existingBatch();
    if (prior) return prior;
    const health = await callMailWorker({ action: "health" });
    if (!health.ready)
      return json({ error: health.error ?? "E-posta servisi hazır değil; başvurular değiştirilmedi.", code: health.code }, 503);
    const [{ data: apps, error: appError }, { data: committees, error: committeeError }] = await Promise.all([
      client.from("applications").select("id,first_name,last_name,email,status,version")
        .eq("event_id", staff.eventId).in("id", ids),
      client.from("committees").select("id,name,active").eq("event_id", staff.eventId)
        .in("id", submission.selections.map((item) => item.committeeId)),
    ]);
    if (appError || committeeError) throw appError ?? committeeError;
    const appMap = new Map((apps ?? []).map((item) => [item.id, item]));
    const committeeMap = new Map((committees ?? []).map((item) => [item.id, item]));
    let stale = false;
    const jobs = submission.selections.map((selection) => {
      const app = appMap.get(selection.applicationId);
      const committee = committeeMap.get(selection.committeeId);
      if (!app || app.status !== "pending" || app.version !== selection.version || !committee?.active) {
        stale = true;
        return null;
      }
      const mail = renderApprovalMail({ firstName: app.first_name, lastName: app.last_name, committeeName: committee.name });
      return { ...selection, email: app.email, subject: mail.subject, html: mail.html, text: mail.text };
    });
    if (stale) return await existingBatch() ?? json({ error: "Seçim değişti; listeyi yenileyin." }, 409);
    const finish = await startAdminActivity(request, staff, "approval_batch_create", submission.batchId,
      { count: submission.selections.length });
    const { data, error } = await client.rpc("queue_approval_batch", {
      p_batch_id: submission.batchId, p_actor: staff.userId, p_jobs: jobs, p_request_hash: requestHash,
    });
    if (error) {
      const repeat = await existingBatch();
      if (repeat) { await finish("succeeded"); return repeat; }
      throw error;
    }
    await finish("succeeded");
    return dispatchBatch(data, true);
  } catch (error) { return failure(error); }
}
