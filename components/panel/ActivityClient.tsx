"use client";

import { useEffect, useState } from "react";

type Activity = {
  id: number;
  session_id: string | null;
  device_id: string | null;
  action: string;
  target_id: string | null;
  outcome: "started" | "succeeded" | "denied";
  ip_address: string | null;
  user_agent: string | null;
  platform: string | null;
  device_class: "mobile" | "desktop" | "unknown";
  details: Record<string, unknown>;
  created_at: string;
};

const labels: Record<string, string> = {
  login: "Yönetici girişi",
  application_create: "Başvuru eklendi",
  application_update: "Başvuru düzenlendi",
  application_cancel: "Onay iptal edildi",
  qr_rotate: "QR yenilendi",
  approval_batch_create: "Onay grubu oluşturuldu",
  approval_retry: "Gönderim yeniden denendi",
  committee_create: "Komite eklendi",
  committee_update: "Komite güncellendi",
  check_in_setting: "Etkinlik girişi değişti",
  check_in_attempt: "Kart okutuldu",
  account_invite: "Hesap daveti",
  account_access_change: "Hesap erişimi değişti",
  csv_export: "Onaylı liste indirildi",
};

export function ActivityClient() {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Activity[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/panel/activity?page=${page}`, { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Geçmiş yüklenemedi.");
      return response.json() as Promise<{ items: Activity[]; hasMore: boolean }>;
    }).then((data) => {
      if (active) { setItems(data.items); setHasMore(data.hasMore); setError(""); setLoading(false); }
    }).catch(() => { if (active) { setError("Geçmiş yüklenemedi."); setLoading(false); } });
    return () => { active = false; };
  }, [page]);

  return <div className="ops-stack"><div className="ops-page-head"><div><h1>Giriş ve işlem geçmişi</h1>
    <p>Zaman, işlem, IP, cihaz izi ve oturum numarası. Ortak şifre kullanan kişinin kimliği bu bilgilerden kesin olarak doğrulanamaz.</p>
  </div></div>
    {error && <p role="alert" className="ops-error">{error}</p>}
    {loading ? <p role="status">Geçmiş yükleniyor…</p> : <div className="ops-card ops-table-wrap"><table className="ops-table">
      <thead><tr><th>Zaman</th><th>İşlem</th><th>Sonuç</th><th>IP</th><th>Cihaz / tarayıcı</th><th>Oturum</th></tr></thead>
      <tbody>{items.map((item) => <tr key={item.id}>
        <td>{new Date(item.created_at).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })}</td>
        <td><strong>{labels[item.action] ?? item.action}</strong>{item.target_id && <small> #{item.target_id.slice(0, 8)}</small>}
          {item.details?.suspicious === true && <div><span className="ops-pill ops-pill--warning">Şüpheli giriş</span></div>}
          {Object.keys(item.details ?? {}).length > 0 && <div><small>{JSON.stringify(item.details)}</small></div>}</td>
        <td><span className="ops-pill" data-tone={item.outcome === "succeeded" ? "good" : "wait"}>
          {item.outcome === "succeeded" ? "Tamamlandı" : item.outcome === "denied" ? "Reddedildi" : "Sonuç doğrulanmalı"}</span></td>
        <td>{item.ip_address ?? "Bilinmiyor"}</td>
        <td>{item.platform ?? "Platform bilinmiyor"} · {item.device_class === "mobile" ? "Mobil" : item.device_class === "desktop" ? "Masaüstü" : "Tür bilinmiyor"}
          {item.device_id && <div><small>Tarayıcı izi: {item.device_id.slice(0, 8)}</small></div>}
          {item.user_agent && <details><summary>Tarayıcı bilgisi</summary><small>{item.user_agent}</small></details>}</td>
        <td title={item.session_id ?? undefined}>{item.session_id?.slice(0, 8) ?? "—"}</td>
      </tr>)}</tbody></table>{items.length === 0 && <p>Henüz kayıt yok.</p>}</div>}
    <div className="ops-actions"><button disabled={page === 1} onClick={() => { setLoading(true); setPage(page - 1); }}>Önceki</button>
      <span>Sayfa {page}</span><button disabled={!hasMore} onClick={() => { setLoading(true); setPage(page + 1); }}>Sonraki</button></div>
  </div>;
}
