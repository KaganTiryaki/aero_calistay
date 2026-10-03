import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { requireStaff } from "@/lib/auth/permissions";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { failure, json, privateHeaders } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    const staff = await requireStaff("admin");
    const id = request.nextUrl.searchParams.get("id");
    if (!id || !/^[0-9a-f-]{36}$/.test(id)) return json({ error: "Geçersiz kart." }, 400);
    const client = createAdminSupabase();
    const { data: application } = await client.from("applications")
      .select("id,status").eq("id", id).eq("event_id", staff.eventId).maybeSingle();
    if (application?.status !== "confirmed") return json({ error: "Kart bulunamadı." }, 404);
    const { data, error } = await client.from("qr_credentials")
      .select("raw_value,active").eq("application_id", id).maybeSingle();
    if (error) throw error;
    if (!data?.active) return json({ error: "Kart iptal edilmiş." }, 404);
    const format = request.nextUrl.searchParams.get("format") === "png" ? "png" : "svg";
    const options = { errorCorrectionLevel: "M" as const, margin: 4, color: { dark: "#102128", light: "#FFFFFF" }, width: 512 };
    if (format === "png") {
      const buffer = await QRCode.toBuffer(data.raw_value, options);
      return new NextResponse(new Uint8Array(buffer), { headers: { ...privateHeaders,
        "Content-Type": "image/png", "Content-Disposition": `inline; filename="aero-${id}.png"` } });
    }
    const svg = await QRCode.toString(data.raw_value, { ...options, type: "svg" });
    return new NextResponse(svg, { headers: { ...privateHeaders,
      "Content-Type": "image/svg+xml", "Content-Disposition": `inline; filename="aero-${id}.svg"` } });
  } catch (error) { return failure(error); }
}
