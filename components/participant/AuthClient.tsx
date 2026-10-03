"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { operations } from "@/lib/content";

export function ParticipantAuthClient({ mode = "login" }: { mode?: "login" | "activate" | "staff" | "staff-activate" }) {
  const copy = operations.participant;
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [requiresNewPassword, setRequiresNewPassword] = useState(false);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const client = createBrowserSupabase();
      if (mode === "activate" || mode === "staff-activate") {
        const url = new URL(window.location.href); const hash = new URLSearchParams(url.hash.slice(1));
        const tokenHash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type");
        if (!tokenHash || (type !== "invite" && type !== "magiclink" && type !== "recovery")) throw new Error(copy.invalidLink);
        const response = await fetch("/api/participant/auth-link/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tokenHash, type }) });
        const result = await response.json();
        if (!response.ok) throw new Error(copy.invalidLink);
        setRequiresNewPassword(result.setPassword === true);
        if (hash.has("access_token") || hash.has("refresh_token") || url.searchParams.has("code")) throw new Error(copy.invalidLink);
        window.history.replaceState(null, "", mode === "staff-activate" ? "/personel/aktivasyon" : "/katilimci/aktivasyon");
      } else {
        const result = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (result.error) throw new Error(copy.error);
      }
      const staffMode = mode === "staff" || mode === "staff-activate";
      const response = await fetch(staffMode ? "/api/check-in" : "/api/participant/claim", staffMode ? { cache: "no-store" } : {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      if (!response.ok) { await client.auth.signOut(); throw new Error(copy.error); }
      if ((mode === "activate" || mode === "staff-activate") && requiresNewPassword) {
        const result = await client.auth.updateUser({ password });
        if (result.error) throw new Error(copy.error);
      }
      window.location.assign(staffMode ? "/tara" : "/katilimci");
    } catch (error) { setMessage(error instanceof Error ? error.message : copy.error); setBusy(false); }
  }
  async function requestLink() {
    if (!email.trim()) { setMessage(copy.email); return; }
    setBusy(true);
    try {
      if (mode === "staff") {
        await createBrowserSupabase().auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/personel/aktivasyon` } });
        setMessage(copy.linkSent); setBusy(false); return;
      }
      const response = await fetch("/api/participant/auth-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim() }) });
      if (!response.ok && response.status !== 429) throw new Error(copy.error);
      setMessage(copy.linkSent);
    } catch { setMessage(copy.linkSent); }
    setBusy(false);
  }
  return <main className="ops-login"><section className="ops-card"><h1>{mode === "activate" ? copy.activateTitle : mode === "staff" || mode === "staff-activate" ? copy.staffTitle : copy.loginTitle}</h1>
    {mode === "activate" && <p>{copy.activateHelp}</p>}
    <form className="ops-form" onSubmit={login}>
      {mode !== "activate" && mode !== "staff-activate" && <label>{copy.email}<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>}
      {((mode === "activate" || mode === "staff-activate") ? requiresNewPassword : true) && <label>{mode === "activate" || mode === "staff-activate" ? copy.newPassword : copy.password}<input type="password" required minLength={mode === "activate" || mode === "staff-activate" ? 12 : 1} maxLength={256} autoComplete={mode === "activate" || mode === "staff-activate" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} /></label>}
      <button disabled={busy} className="ops-button--primary">{busy ? copy.busy : mode === "activate" || mode === "staff-activate" ? copy.activate : copy.login}</button>
      {(mode === "login" || mode === "staff") && <button type="button" disabled={busy} onClick={requestLink}>{copy.newLink}</button>}
    </form>{message && <p role="status" className="ops-note">{message}</p>}
    {mode === "activate" && <Link href="/katilimci/giris">{copy.login}</Link>}
  </section></main>;
}
