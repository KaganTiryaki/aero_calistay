import { LoginForm } from "@/components/operations/LoginForm";
import { hasPublicSupabaseConfig } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const configured = hasPublicSupabaseConfig(process.env)
    && Boolean(process.env.SUPABASE_SECRET_KEY && process.env.ADMIN_LOGIN_EMAIL);
  return <LoginForm configured={configured} />;
}
