"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { operations } from "@/lib/content";
import { ActionFeedback } from "@/components/operations/ActionFeedback";
import { refreshFailureAfterAction, type ActionFeedbackState } from "@/lib/operations/action-feedback";

type Application = { id: string; first_name: string; last_name: string; email: string; status: string; version: number };

export function ApplicationsClient() {
  const [items, setItems] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [status, setStatus] = useState("pending");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [draft,setDraft]=useState({firstName:"",lastName:"",email:""});
  const [saving,setSaving]=useState(false);
  const [feedback,setFeedback]=useState<ActionFeedbackState|null>(null);
  const [hasLoaded,setHasLoaded]=useState(false);
  const request=useRef(0); const savingRef=useRef(false);
  const load = useCallback(async (targetPage=page,q=appliedSearch,targetStatus=status,after:ActionFeedbackState|null=null) => {
    const current=++request.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(targetPage), q, status:targetStatus });
      const response = await fetch(`/api/panel/applications?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const body = await response.json() as { items: Application[]; total: number };
      if(current!==request.current)return;
      setItems(body.items); setTotal(body.total); setMessage("");setHasLoaded(true);
    } catch { if(current===request.current)setMessage(refreshFailureAfterAction(after)); }
    finally { if(current===request.current)setLoading(false); }
  }, [page, appliedSearch, status]);
  useEffect(() => { void load(); }, [load]);
  function searchNow() { setPage(1); setAppliedSearch(search.trim()); if (page===1&&search.trim()===appliedSearch) void load(1,search.trim(),status); }
  async function createApplication(event:FormEvent){
    event.preventDefault();if(savingRef.current)return;savingRef.current=true;setSaving(true);setMessage("");setFeedback(null);
    let rejected=false;
    try{
      const response=await fetch("/api/panel/applications",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(draft)});
      rejected=!response.ok;const body=await response.json();if(!response.ok)throw new Error(body.error || "Başvuru eklenemedi.");
      const result:ActionFeedbackState={kind:"success",title:"Başvuru başarıyla eklendi",description:"Onay bekleyenlere eklendi. Bu işlemde e-posta gönderilmedi.",subject:{name:`${draft.firstName} ${draft.lastName}`,email:draft.email},links:[{label:"Toplu kabul ekranına git",href:"/panel/onay"}]};
      setFeedback(result);setDraft({firstName:"",lastName:"",email:""});setStatus("pending");setPage(1);setSearch("");setAppliedSearch("");await load(1,"","pending",result);
    }catch(error){if(rejected)setMessage(error instanceof Error?error.message:"Başvuru eklenemedi.");else setFeedback({kind:"uncertain",title:"Başvuru sonucu doğrulanamadı",description:"Yeni kayıt oluşturmadan önce e-posta adresini listede arayıp kaydın oluşup oluşmadığını kontrol edin.",subject:{name:`${draft.firstName} ${draft.lastName}`,email:draft.email}});}
    finally{savingRef.current=false;setSaving(false);}
  }
  return <div className="ops-stack">
    <div className="ops-page-head"><div><h1>Başvurular</h1><p>Başvuruları ekleyin, arayın ve durumlarını izleyin.</p></div><Link className="ops-button ops-button--primary" href="/panel/onay">Toplu kabul ekranına git</Link></div>
    {feedback&&<><ActionFeedback id="application-result" feedback={feedback} focus onDismiss={()=>setFeedback(null)}/><button type="button" onClick={()=>setFeedback(null)}>Yeni başvuru ekle</button></>}
    <details className="ops-card"><summary>Başvuru ekle</summary><p>Yönetici olarak manuel başvuru veya kendi test kaydınızı ekleyebilirsiniz. E-posta, onay ekranında gönderilir.</p><form className="ops-form" onSubmit={createApplication}>
      <label>Ad<input required value={draft.firstName} onChange={event=>setDraft({...draft,firstName:event.target.value})}/></label>
      <label>Soyad<input required value={draft.lastName} onChange={event=>setDraft({...draft,lastName:event.target.value})}/></label>
      <label>E-posta<input type="email" required value={draft.email} onChange={event=>setDraft({...draft,email:event.target.value})}/></label>
      <button disabled={saving} className="ops-button--primary">{saving?"Kaydediliyor…":"Başvuruyu kaydet"}</button>
    </form></details>
    <section className="ops-card ops-card--soft"><div className="ops-toolbar"><label>İsim veya e-posta ara<input value={search} placeholder="Ad, soyad veya e-posta" onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") searchNow(); }} /></label><label>Göster<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="pending">Onay bekleyenler</option><option value="accepted_pending_payment">İlk kabul — ödeme bekleniyor</option><option value="confirmed">Kesin kabul edilenler</option><option value="approval_queued">Eski e-posta kuyruğu</option><option value="approved">Eski onay — ödeme doğrulanmadı</option><option value="cancelled">İptal edilenler</option><option value="">Tüm başvurular</option></select></label><div className="ops-actions"><button onClick={searchNow}>Ara</button><button onClick={() => void load()} disabled={loading}>Yenile</button></div></div><p className="ops-note">Başvurular Google Form üzerinden otomatik gelir.</p></section>
    {message && <p role="alert" className="ops-error">{message}</p>}
    <section aria-label="Başvuru listesi" aria-busy={loading}>
      {loading&&hasLoaded&&<p role="status" className="ops-refreshing">Liste güncelleniyor; mevcut sonuçlar gösteriliyor.</p>}
      {loading&&!hasLoaded ? <div className="ops-empty">Başvurular yükleniyor…</div> : items.length ? <div className="ops-person-list">{items.map((item) => {
        return <article className="ops-person" key={item.id}>
      <div className="ops-person-details"><strong>{item.first_name} {item.last_name}</strong><span>{item.email}</span><span className="ops-pill">{(operations.applicationStatus as Record<string, string>)[item.status] ?? item.status}</span></div>
        </article>;
      })}</div> : !message&&<div className="ops-empty">Bu filtrede başvuru yok. Başka bir durum seçin veya aramayı temizleyin.</div>}
      <div className="ops-pagination"><span>{total} başvuru · sayfa {page}</span><div className="ops-actions"><button disabled={page === 1 || loading} onClick={() => setPage(page - 1)}>Önceki</button><button disabled={page * 50 >= total || loading} onClick={() => setPage(page + 1)}>Sonraki</button></div></div>
    </section>
  </div>;
}
