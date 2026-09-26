import { NextRequest } from "next/server";
import { z } from "zod";
import { requireStaff } from "@/lib/auth/permissions";
import { createServerSupabase } from "@/lib/supabase/server";
import { failure, json, protectMutation } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    protectMutation(request);
    await requireStaff();
    const parsed = z.object({ code: z.string().trim().min(8).max(80), requestId: z.string().uuid() })
      .safeParse(await request.json());
    if (!parsed.success) return json({ error: "Geçersiz kart kodu." }, 400);
    const { data, error } = await (await createServerSupabase()).rpc("check_in_code", {
      p_code: parsed.data.code, p_request_id: parsed.data.requestId,
    });
    if (error?.message.includes("RATE_LIMIT")) return json({ error: "Çok fazla deneme. Bir dakika bekleyin." }, 429);
    if (error) throw error;
    return json(data);
  } catch (error) { return failure(error); }
}
