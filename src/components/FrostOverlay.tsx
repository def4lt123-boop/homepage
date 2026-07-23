"use client";

/**
 * FrostOverlay
 * ────────────
 * Frost am Bildschirmrand, wie eine leicht zugefrorene Fensterscheibe —
 * rein CSS/SVG, läuft neben dem WebGL-Canvas her ohne dessen
 * Frame-Budget zu belasten.
 *
 * - Das Noise-Pattern wird EINMAL von einem statischen SVG-Filter
 *   erzeugt (kein per-Frame-Reseed!) — animiert wird nur `opacity`,
 *   das ist reines Compositing und quasi gratis für die GPU.
 * - Per Masken-Gradient sitzt der Frost an den Rändern/Ecken und lässt
 *   die Bildmitte (wo UI + Buchstaben stehen) frei.
 * - Blendet erst sanft ein, nachdem das Intro fertig ist (`active`).
 */
export default function FrostOverlay({ active }: { active: boolean }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 z-[5] transition-opacity duration-[2200ms] ease-out ${
        active ? "opacity-100" : "opacity-0"
      }`}
      style={{ mixBlendMode: "screen" }}
    >
      {/* Nur der Filter-Definition wegen im DOM — unsichtbar */}
      <svg className="absolute h-0 w-0" aria-hidden focusable="false">
        <filter id="frost-noise" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012 0.02"
            numOctaves={4}
            seed={7}
            result="noise"
          />
          {/* Roh-Noise → eisiges Weiß-Blau, Alpha aus der Turbulenz */}
          <feColorMatrix
            in="noise"
            type="matrix"
            values="0 0 0 0 0.86
                    0 0 0 0 0.93
                    0 0 0 0 1
                    0 0 0 0.85 0"
          />
        </filter>
      </svg>

      {/* Frost-Textur, zu den Rändern hin verdichtet, zur Mitte
          transparent — wie Reif, der von außen hereinwächst */}
      <div
        className="frost-breathe absolute inset-0"
        style={{
          filter: "url(#frost-noise)",
          WebkitMaskImage:
            "radial-gradient(ellipse 60% 56% at 50% 50%, transparent 42%, black 94%)",
          maskImage:
            "radial-gradient(ellipse 60% 56% at 50% 50%, transparent 42%, black 94%)",
        }}
      />

      {/* Zusätzliche weiche Eck-Verdichtung, wie an einer
          Autoscheibe im Winter — sitzt über dem Noise für mehr Tiefe */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 42% 38% at 2% 0%, rgba(195,228,255,0.18), transparent 62%)," +
            "radial-gradient(ellipse 42% 38% at 98% 0%, rgba(195,228,255,0.16), transparent 62%)," +
            "radial-gradient(ellipse 42% 38% at 2% 100%, rgba(195,228,255,0.16), transparent 62%)," +
            "radial-gradient(ellipse 42% 38% at 98% 100%, rgba(195,228,255,0.18), transparent 62%)",
        }}
      />
    </div>
  );
}
