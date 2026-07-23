"use client";

/**
 * HeroTitle
 * ─────────
 * "Flo's Websites" als echter, gestochen scharfer DOM-Text statt als
 * extrudierte 3D-Buchstaben. Gründe für den Wechsel:
 *
 * - Die Form (dicke, bevelte 3D-Buchstaben) war der eigentliche
 *   "2010-WordArt"-Auslöser, nicht nur das Material — kein Material-
 *   Tuning entkommt dem vollständig.
 * - Echter Text ist für Screenreader/Suchmaschinen lesbar; die
 *   vorherige Text3D-Variante war reine Canvas-Geometrie und für
 *   beide unsichtbar.
 * - Schriftrendering des Browsers ist bei jeder Auflösung gestochen
 *   scharf, ganz ohne 3D-Font-Konvertierung/-Kerning-Klempnerei.
 *
 * Die Reveal-Animation ist ein klassischer Masken-Wipe (pro Wort ein
 * überflow-hidden-Fenster, der Text schiebt sich von unten rein) —
 * die gleiche Technik, die in prämierten Portfolio-/Agentur-Seiten
 * verwendet wird. Deutlich ruhiger & hochwertiger als physisch durch
 * den Raum fliegende Einzelbuchstaben.
 */

import { motion, useReducedMotion } from "framer-motion";

const WORDS = ["Flo's", "Websites"];

export default function HeroTitle() {
  const reducedMotion = useReducedMotion();

  return (
    <div className="pointer-events-none absolute inset-0 z-[8] flex items-center justify-center px-6">
      <h1 className="flex flex-wrap items-baseline justify-center gap-x-[0.26em] text-center">
        {WORDS.map((word, wi) => (
          <span key={word} className="inline-flex overflow-hidden py-[0.1em]">
            <motion.span
              initial={{
                y: reducedMotion ? 0 : "112%",
                opacity: reducedMotion ? 0 : 0,
              }}
              animate={{ y: "0%", opacity: 1 }}
              transition={{
                duration: reducedMotion ? 0.6 : 1.15,
                delay: reducedMotion ? 0 : 0.2 + wi * 0.14,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="font-display inline-block bg-gradient-to-b from-white via-white to-[#bcdcff]
                         bg-clip-text text-[clamp(3rem,14vw,7.5rem)] font-medium leading-[0.94]
                         tracking-tight text-transparent"
              style={{
                textShadow:
                  "0 0 70px rgba(120,190,255,0.35), 0 0 160px rgba(90,130,255,0.16)",
              }}
            >
              {word}
            </motion.span>
          </span>
        ))}
      </h1>
    </div>
  );
}
