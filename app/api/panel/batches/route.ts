import { participantGate } from "@/lib/participant/gates";
import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/permissions";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { renderApprovalMail } from "@/lib/mail/approval-template";
import { failure, json, protectMutation } from "@/lib/http";
import { startAdminActivity } from "@/lib/activity/server";
import { callMailWorker } from "@/lib/mail/dispatch";
import { canContinueMailJobs, mailDispatchOutcome, providerCanSend } from "@/lib/mail/status";

export const maxDuration = 60;

const bodySchema = z.object({
  batchId: z.string().uuid(),
  selections: z.array(z.object({ applicationId: z.string().uuid(), version: z.number().int().positive(), committeeId: z.string().uuid() })).min(1).max(500),
});

export async function GET(request: NextRequest) {
  try {
    const exactBatchId=request.nextUrl.searchParams.get("batchId");
    if(exactBatchId){
      if(!z.string().uuid().safeParse(exactBatchId).success)return json({error:"Grup kimliği geçersiz."},400);
      const staff=await requireStaff("admin");const client=createAdminSupabase();
      const {data:batch,error:batchError}=await client.from("mail_batches").select("id,event_id,created_by").eq("id",exactBatchId).maybeSingle();
      if(batchError)throw batchError;
      if(!batch)return json({error:"Gönderim grubu bulunamadı."},404);
      if(batch.event_id!==staff.eventId||batch.created_by!==staff.userId)return json({error:"Gönderim grubu bu oturumla eşleşmiyor."},409);
      const {data:jobs,error:jobsError}=await client.from("mail_jobs").select("status,delivery_status,last_error,next_attempt_at").eq("batch_id",batch.id);
      if(jobsError)throw jobsError;
      const health=await callMailWorker({action:"health"});
      const {data:capacity,error:capacityError}=await client.from("mail_provider_state").select("send_blocked_until,approval_budget,reserved_today,provider_remaining,auth_reserve,sent_day").eq("id",1).single();
      if(capacityError)throw capacityError;
      return json(mailDispatchOutcome(batch.id,{...health,blocked:health.blocked||!providerCanSend(capacity)},jobs??[]));
    }
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
    const jobs: { batch_id: string; status: string; delivery_status: string; last_error: string | null; next_attempt_at:string|null }[] = [];
    if (ids.length) for (let offset = 0; ; offset += 500) {
      const { data, error: jobsError } = await client.from("mail_jobs")
        .select("id,batch_id,kind,recipient_name,recipient_email,committee_name,status,delivery_status,last_error,next_attempt_at,reopened_at,created_at")
        .in("batch_id", ids).order("created_at", { ascending: false }).order("id")
        .range(offset, offset + 499);
      if (jobsError) throw jobsError;
      jobs.push(...(data ?? []));
      if (!data || data.length < 500) break;
    }
    const due=ids.some((id)=>canContinueMailJobs(jobs.filter((job)=>job.batch_id===id)));
    let available=false;
    if(due){const [health,{data:capacity,error:capacityError}]=await Promise.all([callMailWorker({action:"health"}),client.from("mail_provider_state").select("send_blocked_until,approval_budget,reserved_today,provider_remaining,auth_reserve,sent_day").eq("id",1).single()]);if(capacityError)throw capacityError;available=health.ready&&!health.blocked&&providerCanSend(capacity);}
    const canContinueByBatch = Object.fromEntries(ids.map((id) => [id, available&&canContinueMailJobs(jobs.filter((job) => job.batch_id === id))]));
    return json({ batches: visibleBatches, jobs, canContinueByBatch, hasMore: (batches ?? []).length > 10 });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  try {
    protectMutation(request); const disabled=participantGate("acceptance");if(disabled)return disabled;
    const staff = await requireStaff("admin");
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return json({ error: "Seçim geçersiz." }, 400);
    const submission = parsed.data;
    const ids = submission.selections.map((item) => item.applicationId);
    if (new Set(ids).size !== ids.length) return json({ error: "Aynı kişi iki kez seçildi." }, 400);
    const client = createAdminSupabase();
    const requestHash = createHash("sha256").update(JSON.stringify(submission.selections)).digest("hex");
    async function dispatchBatch() {
      const readiness = await callMailWorker({ action: "health" });
      if (!readiness.ready) return json({ error: readiness.error ?? "E-posta gönderimi şu anda hazır değil; gönderim ayarlarını kontrol edin.", code: readiness.code }, 503);
      const dispatch = await callMailWorker({ batchId: submission.batchId, limit: 3 });
      const { data: jobs, error } = await client.from("mail_jobs").select("status,delivery_status,last_error,next_attempt_at")
        .eq("batch_id", submission.batchId);
      if (error) throw error;
      return json(mailDispatchOutcome(submission.batchId, dispatch, jobs ?? []), dispatch.ready ? 200 : 202);
    }
    async function existingBatch() {
      const { data, error } = await client.from("mail_batches")
        .select("event_id,created_by,request_hash").eq("id", submission.batchId).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      if (data.event_id !== staff.eventId || data.created_by !== staff.userId || data.request_hash !== requestHash)
        return json({ error: "Grup kimliği başka bir seçim için kullanılmış." }, 409);
      const health = await callMailWorker({ action: "health" });
      if (!health.ready) return json({ error: health.error ?? "E-posta servisi hazır değil.", code: health.code }, 503);
      const { data: jobs, error: jobsError } = await client.from("mail_jobs").select("status,delivery_status,last_error,next_attempt_at")
        .eq("batch_id", submission.batchId);
      if (jobsError) throw jobsError;
      const {data:capacity,error:capacityError}=await client.from("mail_provider_state").select("send_blocked_until,approval_budget,reserved_today,provider_remaining,auth_reserve,sent_day").eq("id",1).single();
      if(capacityError)throw capacityError;
      return json(mailDispatchOutcome(submission.batchId,{...health,blocked:health.blocked||!providerCanSend(capacity)}, jobs ?? []));
    }
    const prior = await existingBatch();
    if (prior) return prior;
    if (new Set(submission.selections.map((item) => item.committeeId)).size !== 1)
      return json({ error: "Bir toplu gönderimde tek komite seçin." }, 400);
    const readiness = await callMailWorker({ action: "health" });
    if (!readiness.ready) return json({ error: readiness.error ?? "E-posta gönderimi şu anda hazır değil; gönderim ayarlarını kontrol edin.", code: readiness.code }, 503);
    const appPages = await Promise.all(Array.from({length:Math.ceil(ids.length/100)},(_,index)=>
      client.from("applications").select("id,first_name,last_name,email,status,version")
        .eq("event_id", staff.eventId).in("id", ids.slice(index*100,index*100+100))));
    const { data: committees, error: committeeError } = await client.from("committees").select("id,name,active")
      .eq("event_id", staff.eventId).in("id", [submission.selections[0].committeeId]);
    const appError=appPages.find((result)=>result.error)?.error;
    if (appError || committeeError) throw appError ?? committeeError;
    const apps=appPages.flatMap((result)=>result.data??[]);
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
    const { error } = await client.rpc("queue_approval_batch", {
      p_batch_id: submission.batchId, p_actor: staff.userId, p_jobs: jobs, p_request_hash: requestHash,
    });
    if (error) {
      const repeat = await existingBatch();
      if (repeat) { await finish("succeeded"); return repeat; }
      throw error;
    }
    await finish("succeeded");
    return dispatchBatch();
  } catch (error) { return failure(error); }
}
