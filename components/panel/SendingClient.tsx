"use client";

import { useEffect, useState } from "react";
import { operations } from "@/lib/content";

type Batch = { id: string; total: number; created_at: string };
type Job = { id: string; batch_id: string; kind: string; recipient_name: string; recipient_email: string; committee_name: string; status: string; delivery_status: string; last_error: string | null; reopened_at: string | null };
const tone: Record<string, string> = { sent: "good", provider_accepted: "wait", failed: "bad", uncertain: "bad", quota_wait: "wait" };
function label(kind: "mailStatus" | "deliveryStatus", status: string) {
  return (operations[kind] as Record<string, string>)[status] ?? status;
}

export function SendingClient() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [reopened, setReopened] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [dispatching,setDispatching]=useState<string|null>(null);
  async function dispatch(batchId:string){
    setDispatching(batchId);setMessage("");
    try{
      const response=await fetch("/api/panel/dispatch-mail",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({batchId})});
      const body=await response.json();if(!response.ok)throw new Error(body.error || "Gönderim şu an başlatılamadı.");
      setMessage(`Sağlayıcının kabul ettiği: ${body.acceptedTotal ?? 0}. Teslim edilen: ${body.deliveredTotal ?? 0}. Kuyrukta kalan: ${body.pending ?? 0}.`);
    }catch(error){setMessage(error instanceof Error?error.message:"Gönderim sonucu doğrulanamadı.");}
    finally{setDispatching(null);}
  }
  async function reopen(job: Job) {
    const invite=job.kind === "acceptance" || job.kind === "participant_auth";
    if (!invite && !window.confirm("Hatalı gönderim için başvuru yeniden açılsın mı? Kişiyi kontrol edip yeniden seçmeniz gerekecek.")) return;
    const jobId = job.id;
    const response = await fetch("/api/panel/retry-failed", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, ...(invite ? { email: emails[job.id] || job.recipient_email } : {}) }) });
    if (!response.ok) { const body = await response.json(); setMessage(body.error || "Gönderim yeniden açılamadı."); return; }
    setReopened((current) => [...current, jobId]);
    setMessage(invite ? "Davet yeniden kuyruğa alındı. İlgili gruptaki kuyruk gönderim düğmesiyle devam edin." : "Başvuru yeniden açıldı. Başvurular bölümünde bilgileri kontrol edip tekrar seçin.");
  }
  useEffect(() => {
    let active = true;
    async function load() {
      const response = await fetch(`/api/panel/batches?page=${page}`, { cache: "no-store" });
      if (!active) return;
      if (!response.ok) { setError("Gönderimler yüklenemedi."); return; }
      const body = await response.json() as { batches: Batch[]; jobs: Job[]; hasMore: boolean };
      setBatches(body.batches); setJobs(body.jobs); setHasMore(body.hasMore); setError("");
    }
    void load(); const interval = window.setInterval(() => { void load(); }, 15_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [page]);
  return <div className="ops-stack"><div className="ops-page-head"><div><h1>{operations.sending.title}</h1><p>{operations.sending.description}</p></div></div>
    {error && <p role="alert" className="ops-error">{error}</p>}
    {message && <p role="status" className="ops-note">{message}</p>}
    {!batches.length ? <div className="ops-empty">{operations.sending.empty}</div> : batches.map((batch) => {
      const rows = jobs.filter((job) => job.batch_id === batch.id);
      const counts = rows.reduce<Record<string, number>>((result, job) => ({ ...result, [job.status]: (result[job.status] ?? 0) + 1 }), {});
      return <section key={batch.id} className="ops-card"><div className="ops-page-head"><div><h2>{new Date(batch.created_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}</h2><p>{batch.total} kişi</p></div><div className="ops-statline">{Object.entries(counts).map(([name, count]) => <span key={name}>{label("mailStatus", name)}: {count}</span>)}</div></div>
        {rows.some(job=>["queued","quota_wait"].includes(job.status)) && <button disabled={dispatching!==null} onClick={()=>dispatch(batch.id)}>{dispatching===batch.id?"Gönderim kontrol ediliyor…":"Kuyruktaki e-postaları gönder"}</button>}
        <div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>Kişi</th><th>Komite</th><th>Gönderim</th><th>Teslimat</th><th>Hata</th><th>İşlem</th></tr></thead><tbody>{rows.map((job) => <tr key={job.id}><td><strong>{job.recipient_name}</strong><small>{job.recipient_email}</small></td><td>{job.committee_name}</td><td><span className="ops-pill" data-tone={tone[job.status]}>{label("mailStatus", job.status)}</span></td><td>{label("deliveryStatus", job.delivery_status)}</td><td>{job.last_error ?? "—"}</td><td>{job.status === "failed" && !job.reopened_at && !reopened.includes(job.id) ? <>{job.kind === "acceptance" && <input type="email" aria-label={`${job.recipient_name} düzeltilecek e-posta`} value={emails[job.id] ?? job.recipient_email} onChange={(event) => setEmails({ ...emails, [job.id]: event.target.value })} />}<button onClick={() => reopen(job)}>{job.kind === "acceptance" ? "Daveti yeniden gönder" : "Başvuruyu yeniden aç"}</button></> : job.reopened_at || reopened.includes(job.id) ? "Yeniden açıldı" : "—"}</td></tr>)}</tbody></table></div>
      </section>;
    })}
    <div className="ops-pagination"><span>Sayfa {page}</span><div className="ops-actions"><button disabled={page === 1} onClick={() => setPage(page - 1)}>Önceki</button><button disabled={!hasMore} onClick={() => setPage(page + 1)}>Sonraki</button></div></div>
  </div>;
}
