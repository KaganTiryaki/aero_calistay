import Link from "next/link";
export default function NotFound(){
  return <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-6 text-ink"><p className="font-mono text-brand-turq">404</p><h1 className="font-display text-4xl">Bu sayfa bulunamadı</h1><p>Bağlantı eski veya adres yanlış olabilir. Katılımcı hesabınıza giriş yapabilir ya da ana sayfaya dönebilirsiniz.</p><div className="flex flex-wrap gap-4"><Link className="rounded-lg bg-brand-turq px-5 py-3 text-black" href="/katilimci/giris">Katılımcı girişi</Link><Link className="rounded-lg border border-hairline px-5 py-3" href="/">Ana sayfaya dön</Link></div></main>;
}
