"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { operations } from "@/lib/content";
import { hasPublicSupabaseConfig } from "@/lib/supabase/config";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const configured = hasPublicSupabaseConfig({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  useEffect(() => { setRecovery(new URLSearchParams(window.location.search).get("recovery") === "1"); }, []);
  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const { error } = await createBrowserSupabase().auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.assign("/panel/basvurular");
    } catch { setError("Giriş yapılamadı. Bilgilerinizi kontrol edin."); setBusy(false); }
  }
  async function reset() {
    setError("");
    if (!email) { setError("Önce e-posta adresinizi yazın."); return; }
    const { error } = await createBrowserSupabase().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/giris?recovery=1")}`,
    });
    if (error) setError("Sıfırlama bağlantısı gönderilemedi."); else setSent(true);
  }
  async function updatePassword(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const { error } = await createBrowserSupabase().auth.updateUser({ password });
    if (error) { setError("Şifre güncellenemedi. Bağlantı süresi dolmuş olabilir."); setBusy(false); }
    else window.location.assign("/panel/basvurular");
  }
  return <main className="ops-login">
    <Link href="/" className="ops-brand"><span className="ops-mark">A</span><span>{operations.title}</span></Link>
    <div className="ops-card"><h1>{operations.login.title}</h1><p>{operations.login.description}</p>
      <form className="ops-form" onSubmit={recovery ? updatePassword : login}>
        {!recovery && <>
        <label>{operations.login.email}<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        </>}
        <label>{recovery ? "Yeni şifre" : operations.login.password}<input type="password" autoComplete={recovery ? "new-password" : "current-password"} required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {!configured && <p role="status" className="ops-note">Supabase bağlantısı henüz kurulmadı. Yönetici yapılandırmayı tamamladığında giriş açılacak.</p>}
        {error && <p role="alert" className="ops-error">{error}</p>}
        {sent && <p role="status" className="ops-success">{operations.login.sent}</p>}
        <button className="ops-button--primary" disabled={busy || !configured} type="submit">{recovery ? "Şifreyi kaydet" : operations.login.submit}</button>
        {!recovery && <button type="button" disabled={!configured} onClick={reset}>{operations.login.reset}</button>}
      </form>
    </div>
  </main>;
}
