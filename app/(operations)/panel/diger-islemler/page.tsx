import Link from "next/link";

const tools = [
  { href: "/panel/kartlar", label: "Kartlar", description: "Kesin kabul edilenlerin yaka kartlarını hazırlayın." },
  { href: "/panel/ayarlar", label: "Ayarlar", description: "Komiteleri, personeli ve etkinlik ayarlarını yönetin." },
  { href: "/panel/etkinlik", label: "İşlem geçmişi", description: "Yönetici işlemlerinin kaydını inceleyin." },
  { href: "/panel/ogunler", label: "Öğünler", description: "Yemek geçiş saatlerini yönetin." },
  { href: "/tara", label: "QR giriş", description: "Katılımcı kartını okutarak geçiş kaydedin." },
];

export default function OtherOperationsPage() {
  return <div className="ops-stack"><h1>Diğer işlemler</h1><div className="ops-grid">
    {tools.map((tool) => <Link className="ops-card ops-tool-link" key={tool.href} href={tool.href}>
      <h2>{tool.label}</h2><p>{tool.description}</p>
    </Link>)}
  </div></div>;
}
