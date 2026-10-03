"use client";
import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { operations } from "@/lib/content";
type View = { application: { id: string; first_name: string; last_name: string; status: string; payment_amount_minor: number | null; payment_currency: string | null; payment_iban: string | null; payment_deadline: string | null; payment_reference: string | null }; committee: string | null; payment: { id: string; status: string; review_reason: string | null } | null; qrReady: boolean; manualCode: string | null };
export function ParticipantClient() {
  const copy = operations.participant; const [view, setView] = useState<View | null>(null); const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const [pendingFinalize, setPendingFinalize] = useState<{id:string;path:string}|null>(null);
  async function load() {
    try {
      const response = await fetch("/api/participant/me", { cache: "no-store" });
      if (response.status === 403) { window.location.assign("/katilimci/giris"); return; }
      if (!response.ok) throw new Error(copy.error);
      setView(await response.json());
    } catch { setMessage(copy.error); }
  }
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  async function upload(event: FormEvent) {
    event.preventDefault(); if (!file && !pendingFinalize) { setMessage(copy.chooseFile); return; }
    setBusy(true); setMessage("");
    try {
      let uploaded = pendingFinalize;
      if (!uploaded && file) {
      const begin = await fetch("/api/participant/receipts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "begin", mime: file.type, size: file.size }) });
      const body = await begin.json(); if (!begin.ok) throw new Error(body.error || copy.error);
      const result = await createBrowserSupabase().storage.from("participant-receipts").uploadToSignedUrl(body.path, body.token, file, { contentType: file.type });
      if (result.error) throw new Error(copy.error);
      uploaded = {id:body.id,path:body.path}; setPendingFinalize(uploaded);
      }
      if (!uploaded) throw new Error(copy.error);
      const finalize = await fetch("/api/participant/receipts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "finalize", id: uploaded.id }) });
      const finalBody = await finalize.json(); if (!finalize.ok) throw new Error(finalBody.error || copy.error);
      setPendingFinalize(null); setMessage(copy.uploaded); setFile(null); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : copy.error); }
    setBusy(false);
  }
  const status = view?.application.status === "cancelled" ? copy.cancelled : view?.qrReady ? copy.confirmed : view?.payment?.status === "under_review" ? copy.review : view?.payment?.status === "correction_required" ? copy.correction : copy.waiting;
  const canUpload = view?.application.status === "accepted_pending_payment" && view.payment?.status !== "under_review";
  return <main className="ops-main ops-stack"><div className="ops-page-head"><h1>{copy.title}</h1><button onClick={async () => { await createBrowserSupabase().auth.signOut(); window.location.assign("/katilimci/giris"); }}>{copy.logout}</button></div>
    {message && <p role="status" className="ops-note">{message}</p>}
    {!view ? <p>{copy.loading}</p> : <><section className="ops-card"><h2>{view.application.first_name} {view.application.last_name}</h2><p>{status}</p><p>{copy.committee}: {view.committee}</p><button onClick={load}>{copy.refresh}</button></section>
      {view.application.status === "accepted_pending_payment" && <section className="ops-card"><h2>{copy.payment}</h2>{view.application.payment_amount_minor != null && view.application.payment_currency && <p>{copy.amount}: {new Intl.NumberFormat("tr-TR", { style: "currency", currency: view.application.payment_currency }).format(view.application.payment_amount_minor / 100)}</p>}
        {view.application.payment_iban && <p>{copy.iban}: <code>{view.application.payment_iban}</code></p>}{view.application.payment_reference && <p>{copy.reference}: <code>{view.application.payment_reference}</code></p>}{view.application.payment_deadline && <p>{copy.deadline}: {new Date(view.application.payment_deadline).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}</p>}
        {view.payment?.review_reason && <p>{view.payment.review_reason}</p>}
        {canUpload && <form className="ops-form" onSubmit={upload}><label>{copy.receipt}<input key={pendingFinalize?.id ?? "new-receipt"} type="file" accept="application/pdf,image/jpeg,image/png" required={!pendingFinalize} disabled={busy || Boolean(pendingFinalize)} onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label><p>{copy.receiptHelp}</p>{pendingFinalize && <><p>Dosyanız yüklendi. İncelemeye gönderimini tekrar deneyebilirsiniz.</p><button type="button" disabled={busy} onClick={() => { setPendingFinalize(null);setFile(null);setMessage(""); }}>Başka dosya seç</button></>}<button disabled={busy}>{busy ? copy.busy : pendingFinalize ? "İncelemeye göndermeyi tekrar dene" : copy.upload}</button></form>}
      </section>}
      <section className="ops-card">{view.qrReady ? <><h2>{copy.qr}</h2><Image src="/api/participant/qr" alt={copy.qr} width={320} height={320} unoptimized style={{ maxWidth: "100%", height: "auto" }} /><p><code>{view.manualCode}</code></p><a className="ops-button" href="/api/participant/qr?download=1">{copy.download}</a></> : <p>{copy.qrWaiting}</p>}</section>
    </>}
  </main>;
}
