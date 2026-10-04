"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { operations } from "@/lib/content";
import { ActionFeedback } from "@/components/operations/ActionFeedback";
import { type ActionFeedbackState, refreshFailureAfterAction } from "@/lib/operations/action-feedback";
type Committee={id:string;name:string;active:boolean};type Staff={user_id:string;email:string|null;active:boolean;role:string};
type Section="committees"|"settings"|"staff";
export function SettingsClient(){
 const [committees,setCommittees]=useState<Committee[]>([]);const [staff,setStaff]=useState<Staff[]>([]);const [staffEmail,setStaffEmail]=useState("");const [name,setName]=useState("");const [checkInOpen,setCheckInOpen]=useState(false);
 const [ready,setReady]=useState<Record<Section,boolean>>({committees:false,settings:false,staff:false});const [errors,setErrors]=useState<Partial<Record<Section,string>>>({});const [busy,setBusy]=useState<Section|null>(null);const lock=useRef(false);const [feedback,setFeedback]=useState<ActionFeedbackState|null>(null);
 async function load(section:Section,after:ActionFeedbackState|null=null){
  try{const r=await fetch(`/api/panel/${section}`,{cache:"no-store"});if(!r.ok)throw new Error();const data=await r.json();if(section==="committees")setCommittees(data.items);else if(section==="staff")setStaff(data.items);else setCheckInOpen(data.event.check_in_open);
   setReady(old=>({...old,[section]:true}));setErrors(old=>({...old,[section]:""}));
  }catch{setErrors(old=>({...old,[section]:refreshFailureAfterAction(after)}));}
 }
 useEffect(()=>{void load("committees");void load("settings");void load("staff");},[]);
 async function mutate(section:Section,method:string,body:unknown,title:string,subject:string,onSuccess?:()=>void){
  if(lock.current||!ready[section])return;lock.current=true;setBusy(section);setFeedback(null);
  let received=false;
  try{const r=await fetch(`/api/panel/${section}`,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});received=true;const data=await r.json();if(!r.ok)throw new Error(data.error||"İşlem tamamlanamadı.");
   const result:ActionFeedbackState={kind:"success",title,description:section==="staff"&&method==="POST"?(data.invited?"Personel daveti e-posta hizmetine iletildi.":"Mevcut hesap için personel erişimi açıldı. Kişi mevcut şifresiyle giriş yapabilir."):"Değişiklik kaydedildi.",subject:{name:subject}};setFeedback(result);onSuccess?.();await load(section,result);
  }catch(error){setFeedback({kind:received?"error":"uncertain",title:received?"İşlem tamamlanamadı":"İşlem sonucu doğrulanamadı",description:received&&error instanceof Error?error.message:"İşlemi tekrar yapmadan önce ilgili listeyi yenileyip sonucu kontrol edin."});}finally{lock.current=false;setBusy(null);}
 }
 function state(section:Section){return <>{errors[section]&&<p role="alert" className="ops-error">{errors[section]} <button type="button" onClick={()=>load(section,feedback)}>Yenile</button></p>}{!ready[section]&&!errors[section]&&<p role="status">Yükleniyor…</p>}</>;}
 function createCommittee(e:FormEvent){e.preventDefault();return mutate("committees","POST",{name},"Komite başarıyla eklendi",name,()=>setName(""));}
 function inviteStaff(e:FormEvent){e.preventDefault();return mutate("staff","POST",{email:staffEmail},"Personel erişimi hazır",staffEmail,()=>setStaffEmail(""));}
 return <div className="ops-stack"><h1>{operations.settings.title}</h1>{feedback&&<ActionFeedback id="settings-result" feedback={feedback} focus onDismiss={()=>setFeedback(null)}/>}
  <div className="ops-grid"><section className="ops-card"><h2>{operations.settings.committees}</h2>{state("committees")}<fieldset disabled={!ready.committees||busy!==null} className="ops-stack"><form className="ops-actions" onSubmit={createCommittee}><label>Komite adı<input required value={name} onChange={e=>setName(e.target.value)}/></label><button>{busy==="committees"?"Kaydediliyor…":operations.settings.newCommittee}</button></form>{committees.map(c=><div key={c.id} className="ops-actions"><strong>{c.name}</strong><span>{c.active?"Aktif":"Pasif"}</span><button onClick={()=>mutate("committees","PATCH",{id:c.id,active:!c.active},"Komite güncellendi",c.name)}>{c.active?"Pasifleştir":"Etkinleştir"}</button></div>)}</fieldset></section>
  <section className="ops-card"><h2>Etkinlik girişi</h2>{state("settings")}<fieldset disabled={!ready.settings||busy!==null}><p>Giriş kapalıyken hiçbir QR veya manuel kod yeni giriş oluşturmaz.</p>{ready.settings&&<p>{checkInOpen?"Açık":"Kapalı"}</p>}<button onClick={()=>mutate("settings","PATCH",{checkInOpen:!checkInOpen},"Etkinlik giriş durumu güncellendi",checkInOpen?"Giriş kapalı":"Giriş açık")}>{busy==="settings"?"Kaydediliyor…":checkInOpen?operations.settings.checkInClosed:operations.settings.checkInOpen}</button></fieldset></section></div>
  <section className="ops-card"><h2>Personel erişimi</h2><p>Personeller <Link href="/personel/giris">personel girişinden</Link> oturum açar.</p>{state("staff")}<fieldset disabled={!ready.staff||busy!==null} className="ops-stack"><form className="ops-actions" onSubmit={inviteStaff}><label>Personel e-postası<input type="email" required value={staffEmail} onChange={e=>setStaffEmail(e.target.value)}/></label><button>{busy==="staff"?"Kaydediliyor…":"Personel daveti gönder"}</button></form>{staff.map(s=><div className="ops-actions" key={s.user_id}><strong>{s.email??s.user_id}</strong><span>{s.role==="admin"?"Yönetici":s.active?"Aktif personel":"Pasif personel"}</span>{s.role!=="admin"&&<button onClick={()=>mutate("staff","PATCH",{userId:s.user_id,active:!s.active},"Personel erişimi güncellendi",s.email??s.user_id)}>{s.active?"Erişimi kapat":"Erişimi aç"}</button>}</div>)}</fieldset><p><Link href="/panel/etkinlik">İşlem geçmişini görüntüle</Link></p></section>
 </div>;
}
