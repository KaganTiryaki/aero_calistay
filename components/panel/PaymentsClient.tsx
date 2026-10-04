"use client";
import { useEffect, useState, type FormEvent } from "react";
import { operations } from "@/lib/content";
type Receipt = { id: string; version: number; status: "under_review" | "approved" | "correction_required"; created_at: string; application: { id:string;version:number;first_name: string; last_name: string; email: string; committee_name: string|null; payment_amount_minor: number|null; payment_currency: string } };
type Preview = {url:string;mime:string;fileName:string;expiresAt:string};
export function PaymentsClient() {
  const copy = operations.payments; const common = operations.participant;
  const [items, setItems] = useState<Receipt[]>([]); const [selected, setSelected] = useState<Receipt | null>(null);
  const [filter, setFilter] = useState<Receipt["status"]>("under_review");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
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
      setItems(receipts.items); setSelected((current) => current ? receipts.items.find((item:Receipt) => item.id === current.id) ?? null : null);
      setHasMore(receipts.hasMore); setIban(settings.payment_iban ?? ""); setAmount(settings.payment_amount_minor ? String(settings.payment_amount_minor / 100) : "");
      setPortal(settings.participant_portal_url ?? `${window.location.origin}/katilimci`);
      if (settings.payment_deadline) { const value = new Date(settings.payment_deadline); setDeadline(new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16)); }
      else setDeadline("");
      if (!receipts.items.length && targetPage > 0) setPage(targetPage - 1);
    } catch { setMessage(common.error); } finally { setLoading(false); }
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
    try{await post("/api/panel/payments",{applicationId:selected.application.id,applicationVersion:selected.application.version,expectedAmountMinor:Math.round(Number(expected)*100),reason:amountReason},"PATCH");setMessage(copy.saved);await load(page);}
    catch(error){setMessage(error instanceof Error?error.message:common.error);}setBusy(false);
  }
  async function signedReceipt(id: string, download = false): Promise<Preview> {
    const response = await fetch(`/api/panel/payments?receipt=${id}${download ? "&download=1" : ""}`, { cache: "no-store" });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || common.error);
    return result as Preview;
  }
  async function view(item:Receipt) {
    setSelected(item);setPreview(null);setMessage("");
    try { setPreview(await signedReceipt(item.id)); } catch(error) { setMessage(error instanceof Error ? error.message : common.error); }
  }
  async function openFile(download=false) {
    if(!selected)return;
    try {const file=await signedReceipt(selected.id,download);const link=document.createElement("a");link.href=file.url;link.target="_blank";link.rel="noopener noreferrer";document.body.append(link);link.click();link.remove();}
    catch(error){setMessage(error instanceof Error?error.message:common.error);}
  }
  const visible = items.filter((item) => item.status === filter);
  return <div className="ops-stack"><h1>{copy.title}</h1>{message && <p role="status" className="ops-note">{message}</p>}
    <section className="ops-card"><h2>İnceleme bekleyen dekontlar</h2><p>{copy.warning}</p>
      <div className="ops-actions"><label>Göster
        <select value={filter} onChange={(event) => {setFilter(event.target.value as Receipt["status"]);setSelected(null);setPreview(null);setPage(0);}}>
          <option value="under_review">İnceleme bekleyenler</option><option value="approved">Onaylananlar</option><option value="correction_required">Düzeltme istenenler</option>
        </select></label><button onClick={() => void load(page)} disabled={busy}>{copy.refresh}</button></div>
      {loading ? <p>Yükleniyor…</p> : !visible.length && <p>{message ? "Liste alınamadı; tekrar deneyin." : "Bu sayfada bu durumda dekont yok."}</p>}
      {visible.map((item) => <div className="ops-person" key={item.id}><div><strong>{item.application.first_name} {item.application.last_name}</strong><p>{item.application.email} · {item.application.committee_name ?? "Komite belirtilmedi"}</p><p>{new Date(item.created_at).toLocaleString("tr-TR")} · {item.status === "approved" ? common.confirmed : item.status === "under_review" ? common.review : common.correction}</p></div>
        <button type="button" onClick={() => {setReference("");setPaid(item.application.payment_amount_minor==null?"":String(item.application.payment_amount_minor/100));setExpected(item.application.payment_amount_minor==null?"":String(item.application.payment_amount_minor/100));setAmountReason("");setDate("");setReason("");void view(item);}}>{copy.view}</button>
      </div>)}
      <div className="ops-actions"><button type="button" disabled={busy || page === 0} onClick={() => { setSelected(null); setPreview(null); setPage(page - 1); }}>{copy.previous}</button><span>{copy.page} {page + 1}</span><button type="button" disabled={busy || !hasMore} onClick={() => { setSelected(null); setPreview(null); setPage(page + 1); }}>{copy.next}</button></div>
    </section>
    {selected && <section className="ops-card"><h2>{selected.application.first_name} {selected.application.last_name}</h2>
    <div className="ops-actions"><button type="button" onClick={()=>void view(selected)}>Önizlemeyi yenile</button><button type="button" onClick={()=>void openFile()}>Yeni sekmede aç</button><button type="button" onClick={()=>void openFile(true)}>İndir</button></div>
    {preview && <div className="ops-receipt-preview">{preview.mime === "application/pdf" ? <iframe title="Dekont PDF önizlemesi" src={preview.url}/> : <object aria-label="Yüklenen dekont" data={preview.url} type={preview.mime}>Görsel açılamadı. Yeni sekmede açın veya indirin.</object>}</div>}
    {selected.status === "under_review" && <><p>{copy.warning}</p>
    <p>Beklenen tutar: {selected.application.payment_amount_minor==null?"Henüz tanımlanmadı":`${selected.application.payment_amount_minor/100} TL`}</p>
    <form className="ops-form" onSubmit={setExpectedAmount}><label>Beklenen tutar (TL)<input type="number" min="0.01" step="0.01" required value={expected} onChange={event=>setExpected(event.target.value)}/></label><label>Değişiklik gerekçesi<input required maxLength={500} value={amountReason} onChange={event=>setAmountReason(event.target.value)}/></label><button disabled={busy}>Beklenen tutarı kaydet</button></form>
    <form className="ops-form" onSubmit={(event) => decide(event, "approve")}>
      <label>{copy.bankReference}<input required maxLength={200} value={reference} onChange={(event) => setReference(event.target.value)} /></label>
      <label>{common.amount}<input type="number" required min="0.01" step="0.01" value={paid} onChange={(event) => setPaid(event.target.value)} /></label>
      <label>{copy.transactionAt}<input type="datetime-local" required value={date} onChange={(event) => setDate(event.target.value)} /></label><button disabled={busy || !selected.application.payment_amount_minor}>{copy.approve}</button>
    </form><form className="ops-form" onSubmit={(event) => decide(event, "correct")}><label>{copy.reason}<textarea required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label><button disabled={busy}>{copy.correct}</button></form></>}
    </section>}
    <details className="ops-card"><summary>{copy.settings}</summary><p>{copy.settingsHelp}</p><form className="ops-form" onSubmit={save}>
      <label>{common.iban} (isteğe bağlı)<input value={iban} onChange={(event) => setIban(event.target.value)} /></label>
      <label>{common.amount} (isteğe bağlı)<input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
      <label>{common.deadline} (isteğe bağlı)<input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label>
      <label>{copy.portal}<input required type="url" value={portal} onChange={(event) => setPortal(event.target.value)} /></label><button disabled={busy}>{copy.save}</button>
    </form></details>
  </div>;
}
