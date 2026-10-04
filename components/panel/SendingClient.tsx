"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { operations } from "@/lib/content";
import { summarizeMailJobs } from "@/lib/mail/status";
import { presentMailJob } from "@/lib/mail/presentation";
import { ActionFeedback } from "@/components/operations/ActionFeedback";
import type { ActionFeedbackState } from "@/lib/operations/action-feedback";

type Batch = { id: string; total: number; created_at: string };
type Job = { id: string; batch_id: string; kind: string; recipient_name: string; recipient_email: string; committee_name: string; status: string; delivery_status: string; last_error: string | null; reopened_at: string | null };
export function SendingClient() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [canContinueByBatch,setCanContinueByBatch]=useState<Record<string,boolean>>({});
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [reopened, setReopened] = useState<string[]>([]);
  const [feedback,setFeedback]=useState<ActionFeedbackState|null>(null);
  const [loading,setLoading]=useState(true);const [loaded,setLoaded]=useState(false);const request=useRef(0);const lock=useRef(false);const [reopening,setReopening]=useState<string|null>(null);
  const [error, setError] = useState("");
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [dispatching,setDispatching]=useState<string|null>(null);
  const load=useCallback(async()=>{const current=++request.current;setLoading(true);
    try{const response=await fetch(`/api/panel/batches?page=${page}`,{cache:"no-store"});if(!response.ok)throw new Error();const body=await response.json();if(current!==request.current)return;
      setBatches(body.batches);setJobs(body.jobs);setCanContinueByBatch(body.canContinueByBatch??{});setHasMore(body.hasMore);setError("");setLoaded(true);
    }catch{if(current===request.current)setError("Gönderim listesi yenilenemedi. Önceki sonuçlar korunuyor.");}finally{if(current===request.current)setLoading(false);}
  },[page]);
  const invalidate=useCallback(()=>{request.current++;},[]);
  async function dispatch(batchId:string){
    if(lock.current)return;lock.current=true;setDispatching(batchId);setFeedback(null);
    try{
      const response=await fetch("/api/panel/dispatch-mail",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({batchId})});
      const body=await response.json();if(!response.ok)throw new Error(body.error || "Gönderim şu an başlatılamadı.");
      if (![body.acceptedTotal,body.deliveredTotal,body.pending,body.failedTotal,body.uncertainTotal].every((value)=>Number.isSafeInteger(value)&&value>=0)) throw new Error("Gönderim sonucu doğrulanamadı. Listeyi yenileyin.");
      setFeedback({kind:body.failedTotal||body.uncertainTotal||body.pending?"info":"success",title:"Gönderim sonucu alındı",description:`E-posta hizmeti kabul etti: ${body.acceptedTotal}. Teslim edildi: ${body.deliveredTotal}. Bekleyen: ${body.pending}. Gönderilemeyen: ${body.failedTotal}. Sonucu kontrol edilen: ${body.uncertainTotal}.`});await load();
    }catch(error){setFeedback({kind:"uncertain",title:"Gönderim sonucu doğrulanamadı",description:error instanceof Error?error.message:"Yeni gönderim yapmadan önce durumunu kontrol edin."});}
    finally{lock.current=false;setDispatching(null);}
  }
  async function reopen(job: Job) {
    if(lock.current)return;
    const invite=job.kind === "acceptance" || job.kind === "participant_auth";
    if (!invite && !window.confirm("Hatalı gönderim için başvuru yeniden açılsın mı? Kişiyi kontrol edip yeniden seçmeniz gerekecek.")) return;
    const jobId = job.id;lock.current=true;setReopening(jobId);setFeedback(null);
    try{
    const response = await fetch("/api/panel/retry-failed", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, ...(invite ? { email: emails[job.id] || job.recipient_email } : {}) }) });
    if (!response.ok) { const body = await response.json();throw new Error(body.error || "Gönderim yeniden açılamadı."); }
    setReopened((current) => [...current, jobId]);
    setFeedback({kind:"success",title:invite?"Bağlantı yeniden kuyruğa alındı":"Başvuru yeniden açıldı",description:invite?"Henüz gönderilmedi. İlgili gruptaki kalan gönderimleri sürdür düğmesiyle devam edin.":"Başvurular bölümünde bilgileri kontrol edip tekrar seçin.",subject:{name:job.recipient_name,email:job.recipient_email}});await load();
    }catch(error){setFeedback({kind:"uncertain",title:"İşlem sonucu doğrulanamadı",description:error instanceof Error?error.message:"Listeyi yenileyip kontrol edin."});}finally{lock.current=false;setReopening(null);}
  }
  useEffect(() => {
    void load(); const interval = window.setInterval(() => { void load(); }, 15_000);
    return () => { invalidate();window.clearInterval(interval); };
  }, [load,invalidate]);
  return <div className="ops-stack"><div className="ops-page-head"><div><h1>{operations.sending.title}</h1><p>{operations.sending.description}</p></div></div>
    {error && <p role="alert" className="ops-error">{error} <button onClick={load}>Listeyi yenile</button></p>}
    {feedback&&<ActionFeedback id="sending-result" feedback={feedback} focus onDismiss={()=>setFeedback(null)}/>}
    {loading&&!loaded&&<p role="status">Gönderimler yükleniyor…</p>}
    {!batches.length ? !loading&&!error&&<div className="ops-empty">{operations.sending.empty}</div> : batches.map((batch) => {
      const rows = jobs.filter((job) => job.batch_id === batch.id);
      const counts = summarizeMailJobs(rows);
      return <section key={batch.id} className="ops-card"><div className="ops-page-head"><div><h2>{new Date(batch.created_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}</h2><p>{batch.total} kişi</p></div><div className="ops-statline"><span>Gönderildi: {counts.acceptedTotal}</span><span>Teslim edildi: {counts.deliveredTotal}</span><span>Sırada/beklemede: {counts.pending}</span>{counts.failedTotal+counts.uncertainTotal>0&&<span>Sorun: {counts.failedTotal+counts.uncertainTotal}</span>}</div></div>
        {canContinueByBatch[batch.id] && <button disabled={dispatching!==null||reopening!==null} onClick={()=>dispatch(batch.id)}>{dispatching===batch.id?"Gönderim kontrol ediliyor…":"Kalan gönderimleri sürdür"}</button>}
        <div className="ops-table-wrap ops-mobile-cards"><table className="ops-table"><thead><tr><th>Kişi</th><th>Komite</th><th>Durum</th><th>Ayrıntı</th></tr></thead><tbody>{rows.map((job) => {const state=presentMailJob(job);return <tr key={job.id}><td data-label="Kişi"><strong>{job.recipient_name}</strong><small>{job.recipient_email}</small></td><td data-label="Komite">{job.committee_name}</td><td data-label="Durum"><span className="ops-pill" data-tone={state.tone}>{state.label}</span></td><td data-label="Ayrıntı"><details><summary>Göster</summary>{state.detail&&<p>{state.detail}</p>}{job.status === "failed" && !job.reopened_at && !reopened.includes(job.id) ? <>{(job.kind === "acceptance" || job.kind === "participant_auth") && <input type="email" aria-label={`${job.recipient_name} düzeltilecek e-posta`} value={emails[job.id] ?? job.recipient_email} onChange={(event) => setEmails({ ...emails, [job.id]: event.target.value })} />}<button disabled={dispatching!==null||reopening!==null} onClick={() => reopen(job)}>{job.kind === "acceptance" ? "Daveti yeniden kuyruğa al" : job.kind === "participant_auth" ? "Hesap bağlantısını yeniden kuyruğa al" : "Başvuruyu yeniden aç"}</button></> : job.reopened_at || reopened.includes(job.id) ? <p>Yeniden açıldı</p> : <p>Ek işlem gerekmiyor.</p>}</details></td></tr>;})}</tbody></table></div>
      </section>;
    })}
    <div className="ops-pagination"><span>Sayfa {page}</span><div className="ops-actions"><button disabled={page === 1||dispatching!==null||reopening!==null} onClick={() => setPage(page - 1)}>Önceki</button><button disabled={!hasMore||dispatching!==null||reopening!==null} onClick={() => setPage(page + 1)}>Sonraki</button></div></div>
  </div>;
}
