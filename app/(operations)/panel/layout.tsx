import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/auth/permissions";
import { operations } from "@/lib/content";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const staff = await getStaffContext();
  if (!staff) redirect("/giris");
  if (staff.role !== "admin") redirect("/tara");
  return <>
    <header className="ops-header"><div className="ops-header-inner">
      <Link className="ops-brand" href="/panel/basvurular"><span className="ops-mark">A</span><span>{operations.title}</span></Link>
      <nav className="ops-nav" aria-label="Panel bölümleri">
        {operations.nav.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
      </nav>
    </div></header>
    <main className="ops-main">{children}</main>
  </>;
}
