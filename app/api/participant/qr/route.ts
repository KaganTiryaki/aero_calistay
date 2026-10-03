import QRCode from "qrcode";
import { NextRequest, NextResponse } from "next/server";
import { privateHeaders } from "@/lib/http";
import { requireParticipant, participantFailure } from "@/lib/participant/server";
export async function GET(request: NextRequest) {
  try {
    const { applicationId, client } = await requireParticipant();
    const [{ data: application, error }, { data: qr, error: qrError }] = await Promise.all([
      client.from("applications").select("status").eq("id", applicationId).single(),
      client.from("qr_credentials").select("raw_value,active").eq("application_id", applicationId).maybeSingle(),
    ]);
    if (error || qrError) throw error ?? qrError;
    if (application.status !== "confirmed" || !qr?.active) throw new Error("FORBIDDEN");
    const buffer = await QRCode.toBuffer(qr.raw_value, { width: 512, margin: 4, errorCorrectionLevel: "M" });
    return new NextResponse(new Uint8Array(buffer), { headers: { ...privateHeaders, "Content-Type": "image/png",
      "Content-Disposition": `${request.nextUrl.searchParams.has("download") ? "attachment" : "inline"}; filename="aero-qr.png"` } });
  } catch (error) { return participantFailure(error); }
}
