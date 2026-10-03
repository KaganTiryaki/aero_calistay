import { NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { json, protectMutation } from "@/lib/http";
import { participantFailure } from "@/lib/participant/server";

export async function POST(request: NextRequest) {
  try {
    protectMutation(request);
    const { data, error } = await (await createServerSupabase()).auth.getUser();
    if (error || !data.user?.email_confirmed_at) throw new Error("FORBIDDEN");
    const result = await createAdminSupabase().rpc("claim_participant_account", { p_user_id: data.user.id });
    if (result.error) throw result.error;
    return json({ ok: true });
  } catch (error) { return participantFailure(error); }
}
