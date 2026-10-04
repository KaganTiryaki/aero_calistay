"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { operations } from "@/lib/content";

export function ParticipantAuthClient({ mode = "login" }: { mode?: "login" | "activate" | "staff" | "staff-activate" }) {
  const copy = operations.participant;
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [requiresNewPassword, setRequiresNewPassword] = useState(false);
  const [sessionConflict, setSessionConflict] = useState(false);
  const [staffSessionType,setStaffSessionType]=useState<"invite"|"magiclink"|"recovery"|null>(null);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const [messageKind,setMessageKind]=useState<"error"|"success">("error");
  const [showPassword,setShowPassword]=useState(false);
  const [activationCheck,setActivationCheck]=useState<"checking"|"ready"|"invalid"|"error">("checking");
  useEffect(() => {
    if (mode !== "activate" && mode !== "staff-activate") return;
    const url = new URL(window.location.href);
    if (url.searchParams.has("token_hash") || url.searchParams.has("code") || url.hash) {setActivationCheck("ready");return;}
    let active = true;
    setBusy(true);
    void fetch("/api/participant/activate", { cache: "no-store" }).then(async response => {
      if(!active)return;
      if (!response.ok){setActivationCheck(response.status===401||response.status===403?"invalid":"error");return;}
      const result = await response.json();
      if (active && result.setPassword === true && result.audience === (mode === "activate" ? "participant" : "staff")){setRequiresNewPassword(true);setActivationCheck("ready");}else setActivationCheck("invalid");
    }).catch(() => {if(active)setActivationCheck("error");}).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [mode]);
  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");setMessageKind("error");
    try {
      const client = createBrowserSupabase();
      if (mode === "activate" || mode === "staff-activate") {
        if (requiresNewPassword) {
          const response = await fetch("/api/participant/activate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || copy.error);
          window.location.assign(mode === "staff-activate" ? "/tara" : "/katilimci");
          return;
        }
        const url = new URL(window.location.href); const hash = new URLSearchParams(url.hash.slice(1));
        const tokenHash = url.searchParams.get("token_hash");
        let type = url.searchParams.get("type");
        let staffSession=staffSessionType;
        if(mode === "staff-activate" && (staffSession || url.searchParams.has("code") || (hash.has("access_token") && hash.has("refresh_token")))){
          if(!staffSession){
            const current=await client.auth.getUser();if(current.data.user)throw new Error("Bağlantıyı açmadan önce mevcut hesabınızdan çıkış yapın.");
            const result=url.searchParams.has("code") ? await client.auth.exchangeCodeForSession(url.searchParams.get("code")!) : await client.auth.setSession({access_token:hash.get("access_token")!,refresh_token:hash.get("refresh_token")!});
            if(result.error)throw new Error(copy.invalidLink);
            const linkType=hash.get("type") ?? "magiclink";
            staffSession=linkType === "invite" || linkType === "recovery" ? linkType : "magiclink";
            setStaffSessionType(staffSession);window.history.replaceState(null,"","/personel/aktivasyon");
          }
          type=staffSession;
        }else{
          if (!tokenHash || (type !== "invite" && type !== "magiclink" && type !== "recovery")) throw new Error(copy.invalidLink);
          if (hash.has("access_token") || hash.has("refresh_token") || url.searchParams.has("code")) throw new Error(copy.invalidLink);
        }
        const response = await fetch(mode === "staff-activate" ? "/api/auth/staff-activate" : "/api/participant/auth-link/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(staffSession ? {session:true,type:staffSession} : { tokenHash, type, jobId: url.searchParams.get("job") }) });
        const result = await response.json();
        if (!response.ok) { if (response.status === 409) setSessionConflict(true); throw new Error(result.error || copy.invalidLink); }
        setRequiresNewPassword(result.setPassword === true);
        window.history.replaceState(null, "", mode === "staff-activate" ? "/personel/aktivasyon" : "/katilimci/aktivasyon");
        if (result.setPassword === true) { setBusy(false); return; }
        window.location.assign(mode === "staff-activate" ? "/tara" : "/katilimci");
        return;
      } else {
        if (mode === "login") {
          const response = await fetch("/api/participant/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), password }) });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || copy.error);
          window.location.assign("/katilimci"); return;
        }
        const result = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (result.error) throw new Error(copy.error);
      }
      const staffMode = mode === "staff" || mode === "staff-activate";
      const response = await fetch(staffMode ? "/api/check-in" : "/api/participant/claim", staffMode ? { cache: "no-store" } : {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      if (!response.ok) { await client.auth.signOut(); throw new Error(copy.error); }
      window.location.assign(staffMode ? "/tara" : "/katilimci");
    } catch (error) { setMessage(error instanceof Error ? error.message : copy.error); setBusy(false); }
  }
  async function logoutForActivation() {
    setBusy(true); setMessage("");
    try {
      const result = await createBrowserSupabase().auth.signOut({ scope: "local" });
      if (result.error) throw result.error;
      setSessionConflict(false);setMessageKind("success"); setMessage(copy.activationReady);
    } catch (error) { setMessage(error instanceof Error ? error.message : copy.error); }
    setBusy(false);
  }
  async function requestLink(purpose: "activate" | "recovery" = "recovery") {
    if (!email.trim()) { setMessageKind("error");setMessage(copy.email); return; }
    setBusy(true);setMessage("");setMessageKind("error");
    try {
      if (mode === "staff") {
        const result = await createBrowserSupabase().auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/personel/aktivasyon` } });
        if (result.error) throw new Error(copy.error);
        setMessageKind("success");setMessage(copy.linkSent); setBusy(false); return;
      }
      const response = await fetch("/api/participant/auth-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), purpose }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || copy.error);
      setMessageKind("success");setMessage(copy.linkSent);
    } catch (error) { setMessage(error instanceof Error ? error.message : copy.error); }
    setBusy(false);
  }
  return <main className="ops-login"><section className="ops-card"><h1>{mode === "activate" ? copy.activateTitle : mode === "staff" || mode === "staff-activate" ? copy.staffTitle : copy.loginTitle}</h1>
    {mode === "activate" && (requiresNewPassword||activationCheck==="ready") && <p>{requiresNewPassword ? copy.activationPasswordHelp : copy.activateHelp}</p>}
    {(mode==="activate"||mode==="staff-activate")&&activationCheck==="checking"&&<p role="status">Bağlantı kontrol ediliyor…</p>}
    {(mode==="activate"||mode==="staff-activate")&&activationCheck==="invalid"&&<p role="alert" className="ops-error">Geçerli bir aktivasyon bağlantısı gerekli. E-postanızdaki bağlantıyı açın veya giriş ekranından yeni davet bağlantısı isteyin.</p>}
    {(mode==="activate"||mode==="staff-activate")&&activationCheck==="error"&&<p role="alert" className="ops-error">Oturum kontrol edilemedi. Bağlantınızı kontrol edip sayfayı yenileyin.</p>}
    <form className="ops-form" onSubmit={login}>
      {mode !== "activate" && mode !== "staff-activate" && <label>{copy.email}<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>}
      {((mode === "activate" || mode === "staff-activate") ? requiresNewPassword : true) && <label>{mode === "activate" || mode === "staff-activate" ? copy.newPassword : copy.password}<span className="ops-password-row"><input aria-label={mode === "activate" || mode === "staff-activate" ? copy.newPassword : copy.password} type={showPassword?"text":"password"} required minLength={mode === "activate" || mode === "staff-activate" ? 6 : 1} maxLength={256} autoComplete={mode === "activate" || mode === "staff-activate" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" aria-pressed={showPassword} onClick={()=>setShowPassword(!showPassword)}>{showPassword?"Gizle":"Göster"}</button></span></label>}
      {(mode==="login"||mode==="staff"||activationCheck==="ready"||requiresNewPassword)&&<button disabled={busy || sessionConflict} className="ops-button--primary">{busy ? copy.busy : mode === "activate" || mode === "staff-activate" ? requiresNewPassword ? copy.saveActivationPassword : copy.activate : copy.login}</button>}
      {sessionConflict && <button type="button" disabled={busy} onClick={logoutForActivation}>{copy.logoutForActivation}</button>}
      {(mode === "login" || mode === "staff") && <div className="ops-auth-links"><button type="button" disabled={busy} onClick={() => requestLink("recovery")}>Şifremi unuttum</button><p>Yukarıdaki e-posta adresi için yeni giriş bağlantısı isteyin.</p></div>}
      {mode === "login" && <div className="ops-auth-links"><button type="button" disabled={busy} onClick={() => requestLink("activate")}>Yeni davet bağlantısı iste</button><p>Davet bağlantınız yoksa veya süresi dolduysa kullanın.</p></div>}
    </form>{message && <p role={messageKind==="error"?"alert":"status"} className={messageKind==="error"?"ops-error":"ops-success"}>{message}</p>}
    {(mode === "activate"||mode==="staff-activate") && <Link href={mode==="activate"?"/katilimci/giris":"/personel/giris"}>{copy.login}</Link>}
    <p><Link href="/">Ana sayfaya dön</Link></p>
  </section></main>;
}
