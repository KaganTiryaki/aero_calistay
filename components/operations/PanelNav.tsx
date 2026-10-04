"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { operations } from "@/lib/content";
export function PanelNav(){
  const pathname=usePathname();
  return <nav className="ops-nav" aria-label="Panel bölümleri">{operations.nav.map(link=><Link key={link.href} href={link.href} aria-current={pathname===link.href?"page":undefined}>{link.label}</Link>)}</nav>;
}
