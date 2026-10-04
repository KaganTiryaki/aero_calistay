import { participantGate } from "@/lib/participant/gates";
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/permissions";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { json, protectMutation } from "@/lib/http";
import { participantFailure } from "@/lib/participant/server";
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
  z.object({ action: z.literal("approve"), id: z.string().uuid(), version: z.number().int().positive(), bankReference: z.string().trim().min(1).max(200), amountMinor: z.number().int().positive(), transactionAt: z.string().datetime({ offset: true }), requestId: z.string().uuid() }),
  z.object({ action: z.literal("correct"), id: z.string().uuid(), version: z.number().int().positive(), reason: z.string().trim().min(1).max(500) }),
]);
export async function POST(request: NextRequest) {
  try {
    protectMutation(request); const disabled=participantGate("payment");if(disabled)return disabled; await requireStaff("admin");
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return json({ error: "Ödeme bilgilerini eksiksiz girin." }, 400);
    const input = parsed.data; const client = await createServerSupabase();
    const result = input.action === "approve" ? await client.rpc("approve_payment", { p_submission_id: input.id, p_bank_reference: input.bankReference,
      p_amount_minor: input.amountMinor, p_transaction_at: input.transactionAt, p_expected_version: input.version, p_request_id: input.requestId })
      : await client.rpc("request_payment_correction", { p_submission_id: input.id, p_expected_version: input.version, p_reason: input.reason });
    if (result.error) throw result.error; return json({ ok: result.data });
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
