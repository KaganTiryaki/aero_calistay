"use client";

import { useCallback, useEffect, useRef } from "react";
import { AnimatePresence, m } from "motion/react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useScrollLock } from "@/lib/useScrollLock";

export type LightboxPhoto = { src: string; alt: string };

/**
 * Full-screen photo viewer. Click a gallery tile to open it here: dark backdrop,
 * the image at full size (object-contain), prev/next + keyboard navigation,
 * Escape / backdrop-click to close. Scroll is locked and focus is trapped while
 * open, matching the site's overlay pattern (see StickyNav).
 */
export function Lightbox({
  photos,
  index,
  onClose,
  onNavigate,
}: {
  photos: LightboxPhoto[];
  index: number | null;
  onClose: () => void;
  onNavigate: (i: number) => void;
}) {
  const open = index !== null;
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const many = photos.length > 1;

  useScrollLock(open);

  const go = useCallback(
    (dir: number) => {
      if (index === null) return;
      onNavigate((index + dir + photos.length) % photos.length);
    },
    [index, photos.length, onNavigate],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, go]);

  // move focus into the overlay on open
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const f = panelRef.current?.querySelectorAll<HTMLElement>("button");
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

  const photo = index !== null ? photos[index] : null;
  const btn =
    "absolute z-20 grid place-items-center rounded-full border border-hairline/60 bg-void/60 text-ink backdrop-blur transition-colors duration-200 hover:border-brand-turq/60 hover:text-brand-turq focus-visible:border-brand-turq/60 focus-visible:text-brand-turq";

  return (
    <AnimatePresence>
      {open && photo && (
        <m.div
          key="lightbox"
          ref={panelRef}
          onKeyDown={trapTab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          role="dialog"
          aria-modal="true"
          aria-label={photo.alt}
          className="fixed inset-0 z-[150] flex items-center justify-center p-4 md:p-10"
        >
          <div
            className="overlay-backdrop"
            style={{ background: "rgba(3,6,9,0.92)" }}
            onClick={onClose}
          />

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className={`${btn} right-4 top-4 h-11 w-11 md:right-6 md:top-6`}
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>

          {many && (
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Önceki fotoğraf"
              className={`${btn} left-3 top-1/2 h-11 w-11 -translate-y-1/2 md:left-6`}
            >
              <ChevronLeft className="h-6 w-6" strokeWidth={1.5} />
            </button>
          )}

          <m.figure
            key={photo.src}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ease: [0.16, 1, 0.3, 1], duration: 0.4 }}
            className="relative z-10 m-0 flex flex-col items-center gap-4"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.src}
              alt={photo.alt}
              className="max-h-[82vh] max-w-[92vw] rounded-xl object-contain shadow-[0_30px_90px_-24px_rgba(0,0,0,0.9)]"
            />
            {many && (
              <figcaption className="font-mono text-[11px] uppercase tracking-[0.28em] text-label">
                {index! + 1} / {photos.length}
              </figcaption>
            )}
          </m.figure>

          {many && (
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Sonraki fotoğraf"
              className={`${btn} right-3 top-1/2 h-11 w-11 -translate-y-1/2 md:right-6`}
            >
              <ChevronRight className="h-6 w-6" strokeWidth={1.5} />
            </button>
          )}
        </m.div>
      )}
    </AnimatePresence>
  );
}
