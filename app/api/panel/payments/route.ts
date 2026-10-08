import { participantGate } from "@/lib/participant/gates";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/permissions";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { json, protectMutation } from "@/lib/http";
import { participantFailure } from "@/lib/participant/server";
import { callMailWorker } from "@/lib/mail/dispatch";
import { canContinueMailJobs, providerCanSend } from "@/lib/mail/status";

export const maxDuration = 60;
export async function GET(request: NextRequest) {
  try {
    const staff = await requireStaff("admin"); const client = createAdminSupabase();
    const id = request.nextUrl.searchParams.get("receipt");
    const download = request.nextUrl.searchParams.get("download");
    if (download !== null && (download !== "1" || !id)) return json({ error: "Geçersiz indirme seçeneği." }, 400);
    if (id) {
      if (!z.string().uuid().safeParse(id).success) return json({ error: "Geçersiz dekont." }, 400);
      const { data: row, error } = await client.from("payment_submissions").select("storage_object_id,application_id,expected_mime,status").eq("id", id).single();
      if (error) throw error;
      if (!row.storage_object_id || !["under_review", "approved", "correction_required"].includes(row.status)) return json({ error: "Dekont incelemeye hazır değil." }, 404);
      const { data: app } = await client.from("applications").select("id").eq("id", row.application_id).eq("event_id", staff.eventId).maybeSingle();
      if (!app) throw new Error("FORBIDDEN");
      const extension = row.expected_mime === "application/pdf" ? "pdf" : row.expected_mime === "image/jpeg" ? "jpg" : row.expected_mime === "image/png" ? "png" : null;
      if (!extension) return json({ error: "Dosya türü desteklenmiyor." }, 415);
      const fileName = `dekont.${extension}`;
      const { data, error: urlError } = await client.storage.from("participant-receipts").createSignedUrl(row.storage_object_id, 60, download === "1" ? { download: fileName } : undefined);
      if (urlError) throw urlError; return json({ url: data.signedUrl, mime: row.expected_mime, fileName, expiresAt: new Date(Date.now() + 60_000).toISOString() });
    }
    const rawPage = request.nextUrl.searchParams.get("page") ?? "0";
    if (!/^(0|[1-9]\d{0,4})$/.test(rawPage) || Number(rawPage) > 10000) return json({ error: "Geçersiz sayfa." }, 400);
    const status=request.nextUrl.searchParams.get("status")??"under_review";
    if(!["under_review","approved","correction_required"].includes(status))return json({error:"Geçersiz dekont durumu."},400);
    const page = Number(rawPage); const pageSize = 50;
    const { data, error } = await (await createServerSupabase()).rpc("list_payment_reviews_by_status", {
      p_event_id: staff.eventId, p_page: page, p_page_size: pageSize,p_status:status,
    });
    if (error) throw error;
    return json({ items: (data ?? []).slice(0, pageSize), page, hasMore: (data ?? []).length > pageSize });
  } catch (error) { return participantFailure(error); }
}
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), id: z.string().uuid(), version: z.number().int().positive(), requestId: z.string().uuid() }),
]);
export async function POST(request: NextRequest) {
  try {
    protectMutation(request); const disabled=participantGate("payment");if(disabled)return disabled; const staff = await requireStaff("admin");
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return json({ error: "Geçersiz dekont onayı." }, 400);
    const input = parsed.data; const client = await createServerSupabase();
    const result = await client.rpc("approve_payment_receipt", { p_submission_id: input.id, p_expected_version: input.version, p_request_id: input.requestId });
    if (result.error) throw result.error;
    if (result.data) try {
      const admin = createAdminSupabase();
      const { data: submission, error: submissionError } = await admin.from("payment_submissions")
        .select("application_id").eq("id", input.id).maybeSingle();
      if (submissionError) throw submissionError;
      if (submission) {
        const { data: application, error: applicationError } = await admin.from("applications")
          .select("version").eq("id", submission.application_id).eq("event_id", staff.eventId).maybeSingle();
        if (applicationError) throw applicationError;
        if (application) {
          const { data: job, error: jobError } = await admin.from("mail_jobs")
            .select("batch_id,status,delivery_status,last_error,next_attempt_at")
            .eq("application_id", submission.application_id).eq("kind", "confirmation")
            .eq("approval_version", application.version).maybeSingle();
          if (jobError) throw jobError;
          if (job && canContinueMailJobs([job])) {
            const [health, capacityResult] = await Promise.all([
              callMailWorker({ action: "health" }),
              admin.from("mail_provider_state").select("send_blocked_until,approval_budget,reserved_today,provider_remaining,auth_reserve,sent_day").eq("id", 1).single(),
            ]);
            if (capacityResult.error) throw capacityResult.error;
            if (health.ready && !health.blocked && providerCanSend(capacityResult.data)) {
              await callMailWorker({ batchId: job.batch_id, limit: 1 });
            }
          }
        }
      }
    } catch { console.error("Receipt approved; confirmation email dispatch could not be completed."); }
    return json({ ok: result.data });
  } catch (error) { return participantFailure(error); }
}
export async function PATCH(request: NextRequest) {
  try {
    protectMutation(request); const disabled=participantGate("payment");if(disabled)return disabled; await requireStaff("admin");
    const parsed=z.object({applicationId:z.string().uuid(),applicationVersion:z.number().int().positive(),expectedAmountMinor:z.number().int().positive().max(2147483647),reason:z.string().trim().min(1).max(500)}).safeParse(await request.json());
    if(!parsed.success)return json({error:"Başvuru sürümü, pozitif tutar ve gerekçe zorunludur."},400);
    const input=parsed.data;
    const result=await (await createServerSupabase()).rpc("set_application_payment_amount",{p_application_id:input.applicationId,p_expected_version:input.applicationVersion,p_amount_minor:input.expectedAmountMinor,p_reason:input.reason});
    if(result.error)throw result.error;return json({ok:result.data});
  }catch(error){return participantFailure(error);}
}
