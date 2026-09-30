"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { operations } from "@/lib/content";

export function LoginForm({ configured }: { configured: boolean }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/shared-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const body = await response.json() as { error?: string };
        throw new Error(body.error || "Giriş yapılamadı.");
      }
      window.location.assign("/panel/basvurular");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Giriş yapılamadı.");
      setBusy(false);
      setPassword("");
    }
  }

  return <main className="ops-login">
    <Link href="/" className="ops-brand"><span className="ops-mark">A</span><span>{operations.title}</span></Link>
    <div className="ops-card"><h1>Yönetici girişi</h1><p>Yetkili yöneticiler için ortak şifreyle erişim.</p>
      <form className="ops-form" onSubmit={login}>
        <label>Şifre<input type="password" autoComplete="current-password" required minLength={4} maxLength={256}
          value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {!configured && <p role="status" className="ops-note">Yönetici hesabı henüz kurulmadı. Kurulumdan sonra giriş açılacak.</p>}
        {error && <p role="alert" className="ops-error">{error}</p>}
        <button className="ops-button--primary" disabled={busy || !configured} type="submit">{busy ? "Giriş yapılıyor…" : "Giriş yap"}</button>
      </form>
    </div>
  </main>;
}
