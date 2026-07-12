/**
 * A calm, pretty "flowing current" backdrop: smooth teal contour waves that
 * gently drift, over soft nebula glows. Deliberately smooth (no dashes/scatter)
 * so it reads as a current, not glitch. Coordinates are rounded to integers so
 * SSR and the browser emit identical SVG (no hydration mismatch).
 */
const WAVES = [
  { y: 150, amp: 46, len: 420, ph: 0.0, op: 0.2, dur: 26, delay: 0 },
  { y: 300, amp: 58, len: 500, ph: 1.1, op: 0.15, dur: 32, delay: -6 },
  { y: 450, amp: 40, len: 380, ph: 2.2, op: 0.18, dur: 28, delay: -3 },
  { y: 600, amp: 66, len: 560, ph: 0.6, op: 0.13, dur: 34, delay: -9 },
  { y: 760, amp: 48, len: 440, ph: 1.7, op: 0.16, dur: 30, delay: -5 },
  { y: 920, amp: 60, len: 520, ph: 2.7, op: 0.12, dur: 36, delay: -12 },
];

function wavePath(w: (typeof WAVES)[number]) {
  const pts: string[] = [];
  for (let x = -180; x <= 1380; x += 40) {
    const y = Math.round(w.y + w.amp * Math.sin((x / w.len) * Math.PI * 2 + w.ph));
    pts.push(`${x} ${y}`);
  }
  return "M " + pts.join(" L ");
}

export function CurrentField() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      style={{
        maskImage: "radial-gradient(125% 105% at 50% 45%, #000 58%, transparent 92%)",
        WebkitMaskImage: "radial-gradient(125% 105% at 50% 45%, #000 58%, transparent 92%)",
      }}
    >
      {/* nebula glows for depth */}
      <div
        className="absolute -left-[10%] top-[8%] h-[46vw] w-[46vw] rounded-full opacity-40"
        style={{ filter: "blur(90px)", background: "radial-gradient(circle, rgba(6,195,169,0.5), transparent 62%)", mixBlendMode: "screen" }}
      />
      <div
        className="absolute -right-[8%] top-[46%] h-[40vw] w-[40vw] rounded-full opacity-35"
        style={{ filter: "blur(90px)", background: "radial-gradient(circle, rgba(67,203,241,0.5), transparent 62%)", mixBlendMode: "screen" }}
      />

      {/* flowing contour waves */}
      <svg
        viewBox="0 0 1200 1080"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id="cf-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#06c3a9" stopOpacity="0" />
            <stop offset="0.28" stopColor="#2ec5af" />
            <stop offset="0.6" stopColor="#43cbf1" />
            <stop offset="1" stopColor="#54e3e5" stopOpacity="0" />
          </linearGradient>
        </defs>
        {WAVES.map((w, i) => (
          <g
            key={i}
            style={{
              animation: `current-flow ${w.dur}s ease-in-out ${w.delay}s infinite`,
              willChange: "transform",
            }}
          >
            <path d={wavePath(w)} fill="none" stroke="url(#cf-grad)" strokeWidth="1.5" opacity={w.op} />
          </g>
        ))}
      </svg>
    </div>
  );
}
