"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, m } from "motion/react";
import { nav, site } from "@/lib/content";
import { scrollToId } from "@/lib/scroll";
import { useScrollLock } from "@/lib/useScrollLock";
import { Cta } from "@/components/ui/Cta";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { AeroMark } from "@/components/ui/AeroMark";
import { cn } from "@/lib/cn";

export function StickyNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const prevOpen = useRef(false);
  useScrollLock(open);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // focus management: move focus into the menu on open, restore to the
  // hamburger on close (guarded so it doesn't steal focus on first mount).
  useEffect(() => {
    if (open && !prevOpen.current) {
      menuRef.current?.querySelector<HTMLElement>("a[href], button")?.focus();
    } else if (!open && prevOpen.current) {
      btnRef.current?.focus();
    }
    prevOpen.current = open;
  }, [open]);

  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const f = menuRef.current?.querySelectorAll<HTMLElement>("a[href], button");
    if (!f || !f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const go = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    setOpen(false);
    // let the menu begin closing before scrolling
    setTimeout(() => scrollToId(href), 10);
  };

  // Telefon menüsü: en üste "Katılım" (başvuru formu) eklenir, böylece
  // numaralandırma bölüm indeksleriyle hizalanır → 01 Katılım … 07 Aero FRC.
  // Masaüstü nav'ı etkilemez; o hâlâ nav.links'i kullanır.
  const mobileLinks = [
    { label: "Katılım", href: site.applyUrl || "#", external: Boolean(site.applyUrl) },
    ...nav.links.map((l) => ({ label: l.label, href: l.href, external: false })),
  ];

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-[100] transition-all duration-300",
        // NB: avoid backdrop-filter (`glass`) while the menu is open — it makes
        // the header a containing block and clamps the fixed overlay to 64px.
        scrolled && !open ? "glass border-b border-hairline/60" : "border-b border-transparent",
      )}
    >
      <nav className="relative z-[120] mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a
          href="#anasayfa"
          onClick={(e) => go(e, "#anasayfa")}
          className="flex items-center gap-2.5 font-mono text-[12px] font-medium uppercase tracking-[0.28em] text-ink/90 transition-colors hover:text-brand-turq"
        >
          <AeroMark className="h-[22px] w-[22px] shrink-0" title="AERO" />
          <span>{site.navMark}</span>
        </a>

        <div className="hidden items-center gap-9 md:flex">
          {nav.links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={(e) => go(e, l.href)}
              className="text-sm text-muted transition-colors duration-200 hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:block">
            <MagneticButton strength={0.2} radius={120}>
              <Cta label={nav.cta.label} size="sm" />
            </MagneticButton>
          </div>

          {/* hamburger — mobile only */}
          <button
            type="button"
            ref={btnRef}
            aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
            className="relative z-[112] flex h-10 w-10 items-center justify-center text-ink md:hidden"
          >
            <span className="flex flex-col items-center justify-center gap-[5px]">
              <span
                className={cn(
                  "block h-[1.5px] w-[22px] rounded bg-current transition-transform duration-300",
                  open && "translate-y-[6.5px] rotate-45",
                )}
              />
              <span
                className={cn(
                  "block h-[1.5px] w-[22px] rounded bg-current transition-opacity duration-200",
                  open && "opacity-0",
                )}
              />
              <span
                className={cn(
                  "block h-[1.5px] w-[22px] rounded bg-current transition-transform duration-300",
                  open && "-translate-y-[6.5px] -rotate-45",
                )}
              />
            </span>
          </button>
        </div>
      </nav>

      {/* mobile overlay menu */}
      <AnimatePresence>
        {open && (
          <m.div
            key="mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[110] flex flex-col md:hidden"
          >
            <div
              className="overlay-backdrop"
              style={{ background: "rgba(4,8,11,0.97)" }}
              onClick={() => setOpen(false)}
            />
            <div
              id="mobile-menu"
              ref={menuRef}
              onKeyDown={trapTab}
              className="relative z-[111] mt-16 flex flex-1 flex-col justify-between px-8 py-10"
            >
              <nav className="flex flex-col gap-1">
                {mobileLinks.map((l, i) => (
                  <m.a
                    key={l.href}
                    href={l.href}
                    target={l.external ? "_blank" : undefined}
                    rel={l.external ? "noopener noreferrer" : undefined}
                    onClick={(e) => (l.external ? setOpen(false) : go(e, l.href))}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.06 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                    className="flex items-baseline gap-4 border-b border-hairline/40 py-4 font-display text-3xl text-ink/90 transition-colors hover:text-brand-turq"
                  >
                    <span className="font-mono text-[11px] text-brand-turq/60">
                      0{i + 1}
                    </span>
                    {l.label}
                  </m.a>
                ))}
              </nav>

              <m.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 + mobileLinks.length * 0.06 }}
                className="flex flex-col gap-6"
              >
                <Cta label={nav.cta.label} />
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-xs tracking-wide text-label">
                  {site.socials.instagram && (
                    <a
                      href={site.socials.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-colors hover:text-brand-turq"
                    >
                      {site.socials.instagramHandle}
                    </a>
                  )}
                  {site.socials.tiktok && (
                    <a
                      href={site.socials.tiktok}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-colors hover:text-brand-turq"
                    >
                      {site.socials.tiktokHandle}
                    </a>
                  )}
                </div>
              </m.div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </header>
  );
}
