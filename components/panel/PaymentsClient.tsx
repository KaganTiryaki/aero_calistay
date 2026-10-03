"use client";
import { useEffect, useState, type FormEvent } from "react";
import { operations } from "@/lib/content";
type Receipt = { id: string; version: number; status: string; application: { id:string;version:number;first_name: string; last_name: string; email: string; payment_amount_minor: number|null; payment_currency: string } };
export function PaymentsClient() {
  const copy = operations.payments; const common = operations.participant;
  const [items, setItems] = useState<Receipt[]>([]); const [selected, setSelected] = useState<Receipt | null>(null);
  const [page, setPage] = useState(0); const [hasMore, setHasMore] = useState(false);
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const [iban, setIban] = useState(""); const [amount, setAmount] = useState(""); const [deadline, setDeadline] = useState(""); const [portal, setPortal] = useState("");
  const [reference, setReference] = useState(""); const [paid, setPaid] = useState(""); const [date, setDate] = useState(""); const [reason, setReason] = useState("");
  const [expected, setExpected] = useState(""); const [amountReason, setAmountReason] = useState("");
  async function load(targetPage = page) {
    try {
      const responses = await Promise.all([fetch(`/api/panel/payments?page=${targetPage}`, { cache: "no-store" }), fetch("/api/panel/payment-settings", { cache: "no-store" })]);
      if (responses.some((response) => !response.ok)) throw new Error(common.error);
      const [receipts, settings] = await Promise.all(responses.map((response) => response.json()));
      setItems(receipts.items); setHasMore(receipts.hasMore); setIban(settings.payment_iban ?? ""); setAmount(settings.payment_amount_minor ? String(settings.payment_amount_minor / 100) : "");
      setPortal(settings.participant_portal_url ?? `${window.location.origin}/katilimci`);
      if (settings.payment_deadline) { const value = new Date(settings.payment_deadline); setDeadline(new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16)); }
      else setDeadline("");
      if (!receipts.items.length && targetPage > 0) setPage(targetPage - 1);
    } catch { setMessage(common.error); }
  }
  useEffect(() => { void load(page); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps
  async function post(url: string, body: unknown, method = "POST") {
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || common.error);
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try { await post("/api/panel/payment-settings", { iban:iban.trim()||null, amountMinor:amount.trim()?Math.round(Number(amount)*100):null, deadline:deadline?new Date(deadline).toISOString():null, portalUrl: portal }, "PATCH"); setMessage(copy.saved); }
    catch (error) { setMessage(error instanceof Error ? error.message : common.error); } setBusy(false);
  }
  async function decide(event: FormEvent, action: "approve" | "correct") {
    event.preventDefault(); if (!selected) return; setBusy(true); setMessage("");
    try {
      if(action === "approve" && !selected.application.payment_amount_minor)throw new Error("Önce başvurunun beklenen tutarını tanımlayın.");
      const body = action === "approve" ? { action, id: selected.id, version: selected.version, bankReference: reference.trim(), amountMinor: Math.round(Number(paid) * 100), transactionAt: new Date(date).toISOString() } : { action, id: selected.id, version: selected.version, reason };
      // Preserve the exact attempt across response loss and page reload.
      const key = `aero-payment:${selected.id}`; let requestId = crypto.randomUUID();
      if (action === "approve") {
        const signature = JSON.stringify(body); const prior = sessionStorage.getItem(key);
        if (prior) { const parsed = JSON.parse(prior); if (parsed.signature === signature) requestId = parsed.requestId; }
        sessionStorage.setItem(key, JSON.stringify({ signature, requestId }));
      }
      await post("/api/panel/payments", { ...body, requestId });
      sessionStorage.removeItem(key); setSelected(null); setMessage(copy.success); await load(page);
    } catch (error) { setMessage(error instanceof Error ? error.message : common.error); }
    setBusy(false);
  }
  async function setExpectedAmount(event:FormEvent){
    event.preventDefault();if(!selected)return;setBusy(true);
    try{await post("/api/panel/payments",{applicationId:selected.application.id,applicationVersion:selected.application.version,expectedAmountMinor:Math.round(Number(expected)*100),reason:amountReason},"PATCH");setSelected(null);setMessage(copy.saved);await load(page);}
    catch(error){setMessage(error instanceof Error?error.message:common.error);}setBusy(false);
  }
  async function view(id: string) {
    try { const response = await fetch(`/api/panel/payments?receipt=${id}`, { cache: "no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.error); window.location.assign(result.url); }
    catch { setMessage(common.error); }
  }
  return <div className="ops-stack"><h1>{copy.title}</h1>{message && <p role="status" className="ops-note">{message}</p>}
    <section className="ops-card"><h2>{copy.settings}</h2><p>{copy.settingsHelp}</p><form className="ops-form" onSubmit={save}>
      <label>{common.iban} (isteğe bağlı)<input value={iban} onChange={(event) => setIban(event.target.value)} /></label>
      <label>{common.amount} (isteğe bağlı)<input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
      <label>{common.deadline} (isteğe bağlı)<input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label>
      <label>{copy.portal}<input required type="url" value={portal} onChange={(event) => setPortal(event.target.value)} /></label><button disabled={busy}>{copy.save}</button>
    </form></section>
    <section className="ops-card"><h2>{copy.list}</h2><p>{copy.warning}</p><button onClick={() => void load(page)} disabled={busy}>{copy.refresh}</button>
      {!items.length && <p>{copy.empty}</p>}
      {items.map((item) => <div className="ops-person" key={item.id}><div><strong>{item.application.first_name} {item.application.last_name}</strong><p>{item.application.email}</p><p>{item.status === "approved" ? common.confirmed : item.status === "under_review" ? common.review : common.correction}</p></div>
        <button onClick={() => view(item.id)}>{copy.view}</button>{item.status === "under_review" && <button disabled={busy} onClick={() => { setSelected(item); setReference(""); setPaid(item.application.payment_amount_minor==null?"":String(item.application.payment_amount_minor/100));setExpected(item.application.payment_amount_minor==null?"":String(item.application.payment_amount_minor/100));setAmountReason(""); setDate(""); setReason(""); }}>{copy.title}</button>}
      </div>)}
      <div className="ops-actions"><button type="button" disabled={busy || page === 0} onClick={() => { setSelected(null); setPage(page - 1); }}>{copy.previous}</button><span>{copy.page} {page + 1}</span><button type="button" disabled={busy || !hasMore} onClick={() => { setSelected(null); setPage(page + 1); }}>{copy.next}</button></div>
    </section>
    {selected && <section className="ops-card"><h2>{selected.application.first_name} {selected.application.last_name}</h2>
    <p>Beklenen tutar: {selected.application.payment_amount_minor==null?"Henüz tanımlanmadı":`${selected.application.payment_amount_minor/100} TL`}</p>
    <form className="ops-form" onSubmit={setExpectedAmount}><label>Beklenen tutar (TL)<input type="number" min="0.01" step="0.01" required value={expected} onChange={event=>setExpected(event.target.value)}/></label><label>Değişiklik gerekçesi<input required maxLength={500} value={amountReason} onChange={event=>setAmountReason(event.target.value)}/></label><button disabled={busy}>Beklenen tutarı kaydet</button></form>
    <form className="ops-form" onSubmit={(event) => decide(event, "approve")}>
      <label>{copy.bankReference}<input required maxLength={200} value={reference} onChange={(event) => setReference(event.target.value)} /></label>
      <label>{common.amount}<input type="number" required min="0.01" step="0.01" value={paid} onChange={(event) => setPaid(event.target.value)} /></label>
      <label>{copy.transactionAt}<input type="datetime-local" required value={date} onChange={(event) => setDate(event.target.value)} /></label><button disabled={busy || !selected.application.payment_amount_minor}>{copy.approve}</button>
    </form><form className="ops-form" onSubmit={(event) => decide(event, "correct")}><label>{copy.reason}<textarea required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label><button disabled={busy}>{copy.correct}</button></form></section>}
  </div>;
}
