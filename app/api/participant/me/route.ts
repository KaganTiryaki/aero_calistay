import { json } from "@/lib/http";
import { requireParticipant, participantFailure } from "@/lib/participant/server";
export async function GET() {
  try {
    const { applicationId, client } = await requireParticipant();
    const { data: application, error } = await client.from("applications").select("id,first_name,last_name,status,committee_id,payment_amount_minor,payment_currency,payment_iban,payment_deadline,payment_reference")
      .eq("id", applicationId).single();
    if (error) throw error;
    const [{ data: committee }, { data: payments, error: paymentError }, { data: qr, error: qrError }] = await Promise.all([
      client.from("committees").select("name").eq("id", application.committee_id).maybeSingle(),
      client.from("payment_submissions").select("id,version,status,review_reason,created_at").eq("application_id", applicationId).order("version", { ascending: false }).limit(1),
      client.from("qr_credentials").select("active,manual_code").eq("application_id", applicationId).maybeSingle(),
    ]);
    if (paymentError || qrError) throw paymentError ?? qrError;
    return json({ application, committee: committee?.name ?? "", payment: payments?.[0] ?? null,
      qrReady: application.status === "confirmed" && qr?.active === true, manualCode: application.status === "confirmed" && qr?.active ? qr.manual_code : null });
  } catch (error) { return participantFailure(error); }
}
