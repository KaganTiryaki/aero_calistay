"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { operations } from "@/lib/content";
import { useApproved } from "./useApproved";
import { ActionFeedback } from "@/components/operations/ActionFeedback";
import { Lightbox, type LightboxPhoto } from "@/components/ui/Lightbox";
import type { ActionFeedbackState } from "@/lib/operations/action-feedback";

export function ApprovedClient() {
  const { people, error, refresh, loading,hasLoaded } = useApproved();
  const [feedback,setFeedback]=useState<ActionFeedbackState|null>(null);const [pending,setPending]=useState<string|null>(null);const [qrPreview,setQrPreview]=useState<LightboxPhoto|null>(null);const lock=useRef(false);
  async function action(id: string, kind: "cancel" | "rotateQr") {
    if(lock.current)return;
    const person=people.find(p=>p.id===id);if(!person)return;
    const warning = kind === "cancel" ? "Onayı iptal edip kartı geçersizleştirmek istiyor musunuz?" : "Eski baskılar geçersiz olacak. QR yenilensin mi?";
    if (!window.confirm(warning)) return;
    lock.current=true;setPending(id);setFeedback(null);let received=false;
    try{const response = await fetch("/api/panel/application-action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: kind }) });received=true;
      if(!response.ok)throw new Error("İşlem tamamlanamadı.");
      setFeedback({kind:"success",title:kind==="cancel"?"Kesin kabul iptal edildi":"QR kodu yenilendi",description:kind==="cancel"?"Kişi kesin kabul listesinden çıkarıldı; eski kartı geçersizdir.":"Eski baskılar geçersiz. Katılımcı kartını yeniden basın.",subject:{name:`${person.first_name} ${person.last_name}`,email:person.email}});await refresh();
    }catch(error){setFeedback({kind:received?"error":"uncertain",title:received?"İşlem tamamlanamadı":"İşlem sonucu doğrulanamadı",description:received&&error instanceof Error?error.message:"Tekrar işlem yapmadan önce listeyi yenileyerek sonucu kontrol edin."});}finally{lock.current=false;setPending(null);}
  }
  return <div className="ops-stack"><div className="ops-page-head"><div><h1>{operations.approved.title}</h1><p>{operations.approved.description}</p></div><div className="ops-actions"><Link href="/panel/kartlar" className="ops-button">{operations.approved.card}</Link><a href="/api/panel/export" className="ops-button">{operations.approved.csv}</a></div></div>
    {error && <p role="alert" className="ops-error">{error} <button onClick={refresh}>Listeyi yenile</button></p>}{feedback&&<ActionFeedback id="approved-result" feedback={feedback} focus onDismiss={()=>setFeedback(null)}/>}
    {loading&&<p role="status">{hasLoaded?"Liste güncelleniyor…":"Kesin kabuller yükleniyor…"}</p>}
    {!people.length ? !loading&&!error&&<div className="ops-empty">{operations.approved.empty}</div> : <div className="ops-table-wrap ops-mobile-cards"><table className="ops-table"><thead><tr><th>Ad soyad</th><th>Komite</th><th>Onay</th><th>E-posta</th><th>Giriş</th><th>QR</th><th>İşlem</th></tr></thead><tbody>{people.map((person) => {const qrSrc=`/api/panel/qr?id=${person.id}&format=svg`;const qrAlt=`${person.first_name} ${person.last_name} giriş QR kodu`;return <tr key={person.id}>
      <td data-label="Kişi"><div className="ops-approved-person"><button type="button" className="ops-approved-qr" aria-label={`${qrAlt} büyüt`} onClick={() => setQrPreview({src:qrSrc,alt:qrAlt})}><img src={qrSrc} alt="" loading="lazy" /></button><div><strong>{person.first_name} {person.last_name}</strong><small>{person.email}</small></div></div></td><td data-label="Komite">{person.committee_name}</td>
      <td data-label="Onay">{new Date(person.approved_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}</td>
      <td data-label="E-posta"><span className="ops-pill" data-tone={person.delivery_status === "delivered" ? "good" : person.delivery_status === "unknown" ? "wait" : "bad"}>{(operations.deliveryStatus as Record<string, string>)[person.delivery_status] ?? person.delivery_status}</span></td>
      <td data-label="Giriş">{person.checked_in_at ? new Date(person.checked_in_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" }) : "Henüz giriş yapmadı"}</td>
      <td data-label="QR indir"><div className="ops-actions"><a className="ops-button" href={`/api/panel/qr?id=${person.id}&format=svg`} download={`aero-${person.id}.svg`}>QR indir (SVG)</a><a className="ops-button" href={`/api/panel/qr?id=${person.id}&format=png`} download={`aero-${person.id}.png`}>QR indir (PNG)</a></div></td>
      <td data-label="İşlem"><div className="ops-actions"><button disabled={pending!==null||loading} onClick={() => action(person.id, "rotateQr")}>{pending===person.id?"İşleniyor…":operations.approved.rotate}</button><button disabled={pending!==null||loading} className="ops-button--danger" onClick={() => action(person.id, "cancel")}>{operations.approved.cancel}</button></div></td>
    </tr>;})}</tbody></table></div>}
    <Lightbox photos={qrPreview?[qrPreview]:[]} index={qrPreview?0:null} onClose={()=>setQrPreview(null)} onNavigate={()=>{}} />
  </div>;
}
