"use client";

import { useEffect, useRef, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createBrowserSupabase } from "@/lib/supabase/browser";

export default function AuthCallbackPage() {
  const started = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    async function complete() {
      const url = new URL(window.location.href);
      const fragment = new URLSearchParams(url.hash.slice(1));
      const next = url.searchParams.get("next") === "/giris?recovery=1" ? "/giris?recovery=1" : "/giris";
      const client = createBrowserSupabase();
      let authError: Error | null = null;
      if (url.searchParams.has("code")) {
        const result = await client.auth.exchangeCodeForSession(url.searchParams.get("code")!);
        authError = result.error;
      } else if (url.searchParams.has("token_hash")) {
        const type = url.searchParams.get("type");
        if (!type || !["invite", "recovery", "email", "magiclink"].includes(type)) throw new Error("Invalid link type");
        const result = await client.auth.verifyOtp({
          token_hash: url.searchParams.get("token_hash")!,
          type: type as EmailOtpType,
        });
        authError = result.error;
      } else if (fragment.has("access_token") && fragment.has("refresh_token")) {
        const result = await client.auth.setSession({
          access_token: fragment.get("access_token")!,
          refresh_token: fragment.get("refresh_token")!,
        });
        authError = result.error;
      } else {
        throw new Error("Missing session");
      }
      window.history.replaceState(null, "", "/auth/callback");
      if (authError) throw authError;
      window.location.replace(next);
    }
    void complete().catch(() => {
      window.history.replaceState(null, "", "/auth/callback");
      setError("Bağlantı kullanılamadı veya süresi doldu. Yeni bağlantı isteyin.");
    });
  }, []);

  return <main className="ops-login"><div className="ops-card">
    <h1>Giriş bağlantısı</h1>
    {error ? <p role="alert" className="ops-error">{error}</p> : <p role="status">Oturum açılıyor…</p>}
    <a href="/giris" className="ops-button">Giriş sayfasına dön</a>
  </div></main>;
}
