"use client";
import { useState, useEffect, useRef, type FormEvent } from "react";
import { operations } from "@/lib/content";
import { ActionFeedback } from "@/components/operations/ActionFeedback";
import { refreshFailureAfterAction, type ActionFeedbackState } from "@/lib/operations/action-feedback";
type Meal = { id: string; name: string; opens_at: string; closes_at: string; active: boolean };
export function MealsClient() {
  const copy=operations.meals;
  const [items,setItems]=useState<Meal[]>([]);const [name,setName]=useState("");const [opens,setOpens]=useState("");const [closes,setCloses]=useState("");
  const [feedback,setFeedback]=useState<ActionFeedbackState|null>(null);const [loadError,setLoadError]=useState("");const [loading,setLoading]=useState(true);const [loaded,setLoaded]=useState(false);const [busy,setBusy]=useState(false);const lock=useRef(false);
  async function load(after:ActionFeedbackState|null=null){setLoading(true);try{const r=await fetch("/api/panel/meals",{cache:"no-store"});if(!r.ok)throw new Error();setItems((await r.json()).items);setLoaded(true);setLoadError("");}catch{setLoadError(refreshFailureAfterAction(after));}finally{setLoading(false);}}
  useEffect(()=>{void load();},[]);
  async function change(body:unknown,method:string,mealName:string){
    if(lock.current)return false;lock.current=true;setBusy(true);setFeedback(null);
    try{const r=await fetch("/api/panel/meals",{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw new Error(data.error||"Öğün kaydedilemedi.");
      const result:ActionFeedbackState={kind:"success",title:method==="POST"?"Öğün başarıyla eklendi":"Öğün güncellendi",description:"Öğün bilgileri kaydedildi.",subject:{name:mealName}};
      setFeedback(result);if(method==="POST"){setName("");setOpens("");setCloses("");}await load(result);return true;
    }catch(error){setFeedback({kind:"error",title:"Öğün kaydedilemedi",description:error instanceof Error?error.message:"İşlem tamamlanamadı."});return false;}finally{lock.current=false;setBusy(false);}
  }
  async function add(event:FormEvent){event.preventDefault();try{const start=new Date(opens),end=new Date(closes);if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start)throw new Error("Geçerli bir başlangıç ve daha sonraki bitiş tarihi seçin.");await change({name,opensAt:start.toISOString(),closesAt:end.toISOString()},"POST",name);}catch(error){setFeedback({kind:"error",title:"Tarihleri kontrol edin",description:error instanceof Error?error.message:"Tarih geçersiz."});}}
  return <div className="ops-stack"><h1>{copy.title}</h1><p>{copy.help}</p>{feedback&&<ActionFeedback id="meal-result" feedback={feedback} focus onDismiss={()=>setFeedback(null)}/>}
    {loadError&&<p role="alert" className="ops-error">{loadError}<button onClick={()=>load(feedback)}>Listeyi yenile</button></p>}
    <section className="ops-card"><form className="ops-form" onSubmit={add}><label>{copy.name}<input required value={name} onChange={e=>setName(e.target.value)}/></label><label>{copy.opens}<input required type="datetime-local" value={opens} onChange={e=>setOpens(e.target.value)}/></label><label>{copy.closes}<input required type="datetime-local" value={closes} onChange={e=>setCloses(e.target.value)}/></label><button disabled={busy}>{busy?"Kaydediliyor…":copy.add}</button></form></section>
    {loading&&<p role="status">{loaded?"Öğünler güncelleniyor…":"Öğünler yükleniyor…"}</p>}{!loading&&!loadError&&!items.length&&<p>Henüz öğün eklenmedi.</p>}
    {items.map(meal=><section className="ops-card" key={meal.id}><h2>{meal.name}</h2><p>{new Date(meal.opens_at).toLocaleString("tr-TR")} — {new Date(meal.closes_at).toLocaleString("tr-TR")}</p><p>{meal.active?copy.active:copy.inactive}</p><button disabled={busy} onClick={()=>change({id:meal.id,active:!meal.active},"PATCH",meal.name)}>{busy?"Kaydediliyor…":meal.active?copy.close:copy.open}</button></section>)}
  </div>;
}
