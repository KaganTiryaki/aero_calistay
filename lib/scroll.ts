/** Smoothly scroll to an in-page anchor, routed through Lenis when active. */
export function scrollToId(hash: string) {
  const el = document.querySelector(hash) as HTMLElement | null;
  if (!el) return;
  const lenis = window.__lenis;
  if (lenis) {
    lenis.scrollTo(el, { offset: -72, duration: 1.2 });
  } else {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
