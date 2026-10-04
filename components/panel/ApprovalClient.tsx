"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { operations } from "@/lib/content";
import { renderApprovalMail } from "@/lib/mail/approval-template";
import { ApprovalCandidates } from "./ApprovalCandidates";
import {
  approvalAttemptKey, changeCommittee, emptyApprovalDraft, persistApprovalDraft,
  readApprovalDraft, toSelections, toggleCandidate,
  type ApprovalDraft, type ApprovalPerson,
} from "@/lib/panel/approval-selection";
import type { MailDispatchOutcome } from "@/lib/mail/status";
import { dispatchDecision } from "@/lib/panel/approval-dispatch";

type Committee = {id:string;name:string;active:boolean};
type CandidateRow = {id:string;first_name:string;last_name:string;email:string;version:number;status:string};
type Attempt = {signature:string;batchId:string};

function readAttempt():Attempt|null {
  try {
    const value:unknown=JSON.parse(sessionStorage.getItem(approvalAttemptKey)??"null");
    if(value&&typeof value==="object"&&"signature" in value&&"batchId" in value&&typeof value.signature==="string"&&typeof value.batchId==="string")return value as Attempt;
  }catch{/* The old attempt remains recoverable from E-postalar. */}
  return null;
}

function validOutcome(value:unknown):value is MailDispatchOutcome {
  if(!value||typeof value!=="object")return false;
  const body=value as Partial<MailDispatchOutcome>;
  return typeof body.batchId==="string"&&typeof body.dispatchReady==="boolean"&&typeof body.canContinue==="boolean"
    &&[body.acceptedTotal,body.deliveredTotal,body.pending,body.failedTotal,body.uncertainTotal].every((number)=>Number.isSafeInteger(number)&&Number(number)>=0);
}

export function ApprovalClient() {
  const [draft,setDraft]=useState<ApprovalDraft>(emptyApprovalDraft);
  const [attempt,setAttempt]=useState<Attempt|null>(null);
  const [committees,setCommittees]=useState<Committee[]>([]);
  const [committeeError,setCommitteeError]=useState(false);
  const [candidates,setCandidates]=useState<ApprovalPerson[]>([]);
  const [total,setTotal]=useState(0);
  const [page,setPage]=useState(1);
  const [search,setSearch]=useState("");
  const [appliedSearch,setAppliedSearch]=useState("");
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [legacySelection,setLegacySelection]=useState(false);
  const sendingRef=useRef(false);

  useEffect(()=>{
    setDraft(readApprovalDraft());setAttempt(readAttempt());
    setLegacySelection(Boolean(sessionStorage.getItem("aero-selected-applications")));
    void fetch("/api/panel/committees",{cache:"no-store"}).then(async(response)=>{
      if(!response.ok)throw new Error();
      const body=await response.json() as {items:Committee[]};
      setCommittees(body.items.filter((item)=>item.active));setCommitteeError(false);
    }).catch(()=>setCommitteeError(true));
  },[]);

  useEffect(()=>{
    if(!draft.committeeId){setCandidates([]);setTotal(0);return;}
    let active=true;setLoading(true);
    const params=new URLSearchParams({page:String(page),q:appliedSearch,status:"pending"});
    void fetch(`/api/panel/applications?${params}`,{cache:"no-store"}).then(async(response)=>{
      if(!response.ok)throw new Error();
      const body=await response.json() as {items:CandidateRow[];total:number};
      if(!active)return;
      setCandidates(body.items.filter((item)=>item.status==="pending").map((item)=>({id:item.id,firstName:item.first_name,lastName:item.last_name,email:item.email,version:item.version})));
      setTotal(body.total);setMessage("");
    }).catch(()=>{if(active)setMessage("Adaylar yüklenemedi. Sayfayı veya aramayı yenileyin.");}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[draft.committeeId,page,appliedSearch]);

  function updateDraft(next:ApprovalDraft){setDraft(next);persistApprovalDraft(next);}
  function onCommittee(id:string){
    if(attempt)return;
    const changed=draft.committeeId!==id;
    updateDraft(changeCommittee(draft,id));setPage(1);setSearch("");setAppliedSearch("");
    if(changed&&draft.people.length)setMessage("Komite değişti; önceki aday seçimi temizlendi.");
    else setMessage("");
  }
  function onToggle(person:ApprovalPerson){
    if(attempt||!draft.committeeId)return;
    try{updateDraft(toggleCandidate(draft,person));setMessage("");}
    catch(error){setMessage(error instanceof Error?error.message:"Aday seçilemedi.");}
  }
  function selectPage(){
    try{let next=draft;for(const person of candidates)if(!next.people.some((item)=>item.id===person.id))next=toggleCandidate(next,person);updateDraft(next);}
    catch(error){setMessage(error instanceof Error?error.message:"Seçim sınırına ulaşıldı.");}
  }
  function searchNow(event:FormEvent){event.preventDefault();setPage(1);setAppliedSearch(search.trim());}

  async function requestOutcome(url:string,body:unknown):Promise<MailDispatchOutcome>{
    const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const value:unknown=await response.json();
    if(!response.ok&&response.status!==202)throw new Error(typeof value==="object"&&value&&"error" in value&&typeof value.error==="string"?value.error:"Gönderim başlatılamadı.");
    if(!validOutcome(value))throw new Error("Gönderim sonucu doğrulanamadı. E-postalar bölümünü kontrol edin.");
    return value;
  }
  function describe(outcome:MailDispatchOutcome){
    return `E-posta hizmetinin kabul ettiği: ${outcome.acceptedTotal}. Teslim edildiği doğrulanan: ${outcome.deliveredTotal}. Sırada/beklemede: ${outcome.pending}. Gönderilemeyen: ${outcome.failedTotal}. Sonucu kontrol edilen: ${outcome.uncertainTotal}.`;
  }
  function finish(outcome:MailDispatchOutcome){
    if(outcome.pending===0&&outcome.failedTotal===0&&outcome.uncertainTotal===0&&outcome.acceptedTotal===draft.people.length){
      sessionStorage.removeItem(approvalAttemptKey);setAttempt(null);updateDraft(emptyApprovalDraft);
      setMessage(`${describe(outcome)} Teslimat durumunu E-postalar bölümünden izleyin.`);
    }else setMessage(`${describe(outcome)} ${outcome.issue??"Kalan işleri E-postalar bölümünden kontrol edin."}`);
  }
  async function continueBatch(batchId:string,first:MailDispatchOutcome){
    let outcome=first;
    const maxSteps=Math.ceil(draft.people.length/3)+2;
    for(let step=0;step<maxSteps&&outcome.canContinue;step++){
      const next=await requestOutcome("/api/panel/dispatch-mail",{batchId});
      if(next.batchId!==batchId)throw new Error("Gönderim grubu uyuşmuyor.");
      const decision=dispatchDecision(next,outcome.pending);
      outcome=next;
      setMessage(describe(outcome));
      if(decision!=="continue")break;
    }
    finish(outcome);
  }
  async function run(action:"send"|"check"|"resume"){
    if(sendingRef.current)return;
    sendingRef.current=true;setBusy(true);setMessage("");
    try{
      const selections=toSelections(draft);
      const signature=JSON.stringify(selections);
      let current=attempt;
      if(current&&current.signature!==signature)throw new Error("Kayıtlı gönderim seçimi değişmiş. E-postalar bölümündeki grubu kontrol edin.");
      if(!current){
        if(action!=="send")throw new Error("Önce toplu gönderimi başlatın.");
        current={signature,batchId:crypto.randomUUID()};sessionStorage.setItem(approvalAttemptKey,JSON.stringify(current));setAttempt(current);
      }
      let outcome:MailDispatchOutcome;
      if(action==="check"){
        const response=await fetch(`/api/panel/batches?batchId=${encodeURIComponent(current.batchId)}`,{cache:"no-store"});
        const value:unknown=await response.json();
        if(!response.ok)throw new Error(typeof value==="object"&&value&&"error" in value&&typeof value.error==="string"?value.error:"Gönderim durumu alınamadı.");
        if(!validOutcome(value))throw new Error("Gönderim sonucu doğrulanamadı.");
        outcome=value;
      }else outcome=await requestOutcome("/api/panel/batches",{batchId:current.batchId,selections});
      if(outcome.batchId!==current.batchId)throw new Error("Gönderim grubu uyuşmuyor.");
      if(action==="check"){finish(outcome);return;}
      if(action==="send"&&attempt){setMessage(`${describe(outcome)} Kalan gönderimleri sürdürmek için düğmeye ayrıca basın.`);return;}
      await continueBatch(current.batchId,outcome);
    }catch(error){setMessage(error instanceof Error?error.message:"Gönderim sonucu doğrulanamadı. E-postalar bölümünü kontrol edin.");}
    finally{sendingRef.current=false;setBusy(false);}
  }

  const chosen=committees.find((item)=>item.id===draft.committeeId);
  const selectedIds=new Set(draft.people.map((item)=>item.id));
  const example=draft.people[0];
  const preview=chosen&&example?renderApprovalMail({firstName:example.firstName,lastName:example.lastName,committeeName:chosen.name}):null;
  return <div className="ops-stack"><div className="ops-page-head"><div><h1>Toplu kabul</h1><p>Komiteyi seçin, bu komiteye kabul edilecek adayları işaretleyin ve toplu e-postayı gönderin.</p></div><span className="ops-pill" data-tone="good">{draft.people.length} aday</span></div>
    <div className="ops-step"><strong>1. Komite</strong><span>→</span><strong>2. Adaylar</strong><span>→</span><strong>3. Toplu gönderim</strong></div>
    {legacySelection&&<p className="ops-note">Başvurular ekranındaki eski seçim bu gönderime eklenmedi. <button type="button" onClick={()=>{sessionStorage.removeItem("aero-selected-applications");setLegacySelection(false);}}>Eski seçimi temizle</button></p>}
    {message&&<p role="status" className="ops-note">{message}</p>}
    <section className="ops-card"><h2>1. Komiteyi seçin</h2>
      {committeeError?<p role="alert" className="ops-error">Komiteler yüklenemedi. Sayfayı yenileyin.</p>:!committees.length?<p>Aktif komite yok. <Link href="/panel/ayarlar">Ayarlar bölümünden komite ekleyin.</Link></p>:<label>Komite<select value={draft.committeeId} disabled={busy||Boolean(attempt)} onChange={(event)=>onCommittee(event.target.value)}><option value="">Komite seçin</option>{committees.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    </section>
    {draft.committeeId&&<section className="ops-card"><h2>2. Adayları seçin</h2>
      <form className="ops-toolbar" onSubmit={searchNow}><label>İsim veya e-posta ara<input value={search} onChange={(event)=>setSearch(event.target.value)} disabled={busy||Boolean(attempt)}/></label><button disabled={busy||Boolean(attempt)}>Ara</button><button type="button" disabled={busy||Boolean(attempt)||!candidates.length} onClick={selectPage}>Bu sayfayı seç</button></form>
      {loading?<p>Adaylar yükleniyor…</p>:candidates.length?<ApprovalCandidates items={candidates} selectedIds={selectedIds} disabled={busy||Boolean(attempt)} onToggle={onToggle}/>:<p>Bu aramada onay bekleyen aday yok.</p>}
      <div className="ops-pagination"><span>{total} aday · sayfa {page}</span><div className="ops-actions"><button type="button" disabled={page===1||loading} onClick={()=>setPage(page-1)}>Önceki</button><button type="button" disabled={page*50>=total||loading} onClick={()=>setPage(page+1)}>Sonraki</button></div></div>
      <div className="ops-selection-summary"><strong>{draft.people.length} aday seçildi</strong><div className="ops-actions"><button type="button" disabled={busy||Boolean(attempt)||!draft.people.length} onClick={()=>updateDraft({...draft,people:[]})}>Seçimi temizle</button></div></div>
      {draft.people.length>0&&<details><summary>Seçilenleri göster</summary><div className="ops-person-list">{draft.people.map((person)=><div className="ops-person" key={person.id}><span>{person.firstName} {person.lastName} · {person.email}</span><button type="button" disabled={busy||Boolean(attempt)} onClick={()=>onToggle(person)}>Kaldır</button></div>)}</div></details>}
    </section>}
    {draft.people.length>0&&<section className="ops-card"><h2>3. Kontrol edin ve gönderin</h2><p><strong>{chosen?.name??"Komite seçin"}</strong> · {draft.people.length} aday</p>
      <h3>{operations.approval.preview}</h3>{preview&&<><strong>Örnek alıcı: {example.email}</strong><div className="ops-preview">{preview.text}</div></>}
      <div className="ops-actions ops-actions--end">{attempt?<><button type="button" disabled={busy} onClick={()=>void run("check")}>Gönderim durumunu kontrol et</button><button type="button" className="ops-button--primary" disabled={busy} onClick={()=>void run("resume")}>Kalan gönderimleri sürdür</button></>:<button type="button" className="ops-button--primary" disabled={busy||!chosen} onClick={()=>void run("send")}>{busy?"Gönderiliyor…":`${draft.people.length} kişiye kabul e-postası gönder`}</button>}</div>
    </section>}
  </div>;
}
