import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { json, protectMutation } from "@/lib/http";
import { requireParticipant, participantFailure } from "@/lib/participant/server";
import { validateReceipt } from "@/lib/participant/receipt";
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("begin"), mime: z.enum(["application/pdf", "image/jpeg", "image/png"]), size: z.number().int().positive().max(5242880) }),
  z.object({ action: z.literal("finalize"), id: z.string().uuid() }),
]);
export async function POST(request: NextRequest) {
  try {
    protectMutation(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return json({ error: "Geçerli bir PDF, JPEG veya PNG seçin; en fazla 5 MiB." }, 400);
    const { applicationId, userId, client } = await requireParticipant();
    const input = parsed.data;
    if (input.action === "begin") {
      const { data: id, error } = await (await createServerSupabase()).rpc("begin_payment_submission", { p_application_id: applicationId, p_mime: input.mime, p_size: input.size });
      if (error) throw error;
      const { data: submission, error: rowError } = await client.from("payment_submissions").select("storage_object_id").eq("id", id).eq("application_id", applicationId).single();
      if (rowError) throw rowError;
      const { data: upload, error: uploadError } = await client.storage.from("participant-receipts").createSignedUploadUrl(submission.storage_object_id);
      if (uploadError) throw uploadError;
      return json({ id, path: upload.path, token: upload.token });
    }
    const { data: submission, error } = await client.from("payment_submissions").select("storage_object_id,expected_mime,expected_size,status")
      .eq("id", input.id).eq("application_id", applicationId).single();
    if (error || !submission) throw new Error("FORBIDDEN");
    if (submission.status === "under_review") return json({ ok: true });
    if (submission.status !== "not_submitted") throw new Error("STALE_PAYMENT");
    const { data: file, error: fileError } = await client.storage.from("participant-receipts").download(submission.storage_object_id);
    if (fileError || !file) throw new Error("UPLOAD_MISSING");
    if (file.size !== submission.expected_size || file.size > 5242880) throw new Error("INVALID_FILE");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!validateReceipt(bytes, submission.expected_mime)) throw new Error("INVALID_FILE");
    const result = await client.rpc("finalize_payment_submission", { p_id: input.id, p_user: userId, p_hash: createHash("sha256").update(bytes).digest("hex") });
    if (result.error) throw result.error;
    return json({ ok: true });
  } catch (error) { return participantFailure(error); }
}
