"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import UIOverlay, { LINK_COUNT } from "./UIOverlay";
import ProjectsSection from "./ProjectsSection";
import FrostOverlay from "./FrostOverlay";

/**
 * LandingPage
 * ───────────
 * - Hero: exakt ein Viewport (100dvh), overflow-hidden → saubere
 *   Leinwand für das 3D-Intro
 * - Darunter: scrollbare Projekt-Sektion, deren Karten beim Scrollen
 *   langsam größer werden und die Website-Vorschauen enthüllen
 * - Hero3D ohne SSR (WebGL existiert nur im Browser)
 * - Intro spielt pro Browser-Session nur einmal (sessionStorage) —
 *   bei Reload/Zurücknavigieren steht der Schriftzug sofort da
 */

const INTRO_SESSION_KEY = "flo-intro-seen";

const Hero3D = dynamic(() => import("./Hero3D"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-black">
      {/* Eisiger Lade-Ring statt Text — passt zum Rest der Optik und
          wirkt weniger "technisch" als ein pulsierendes Label */}
      <div className="relative flex h-14 w-14 items-center justify-center">
        <span className="absolute inset-0 rounded-full border border-white/10" />
        <span
          aria-hidden
          className="frost-spin absolute inset-0 rounded-full border-t-2 border-[#7ec2ff]/70"
        />
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full bg-[#bfe3ff] shadow-[0_0_14px_3px_rgba(140,200,255,0.55)]"
        />
        <span className="sr-only">Wird geladen …</span>
      </div>
    </div>
  ),
});

export default function LandingPage() {
  const [uiVisible, setUiVisible] = useState(false);
  /* Schon in dieser Session gesehen? Dann Flug-Intro überspringen.
     Lazy-Initializer statt Effect: läuft synchron im ersten
     Client-Render, Hero3D selbst wird eh erst nach der Hydration
     (dynamic import, ssr:false) gemountet — kein Hydration-Mismatch. */
  const [skipIntro] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem(INTRO_SESSION_KEY) === "1";
  });

  const handleIntroComplete = useCallback(() => {
    window.sessionStorage.setItem(INTRO_SESSION_KEY, "1");
    window.setTimeout(() => setUiVisible(true), 350);
  }, []);

  /* Fallback: UI spätestens nach 7s einblenden (falls WebGL blockiert) */
  useEffect(() => {
    const id = window.setTimeout(() => setUiVisible(true), 7000);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <main className="relative w-full bg-black">
      {/* ── Hero: ein voller Viewport, Leinwand fürs 3D-Intro ── */}
      <section className="relative h-[100svh] w-full overflow-hidden supports-[height:100dvh]:h-dvh">
        <Hero3D
          onIntroComplete={handleIntroComplete}
          cardCount={LINK_COUNT}
          skipIntro={skipIntro}
        />

        {/* Frost am Bildschirmrand — blendet mit der UI ein */}
        <FrostOverlay active={uiVisible} />

        {/* Sanfter Übergang unten: statt eines harten Schnitts in das
            Schwarz der Projekte-Sektion blendet der Hero-Hintergrund
            schon vorher darauf zu aus. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[6] h-[24vh] bg-gradient-to-b from-transparent to-black"
        />

        {/* UI-Layer über dem Canvas */}
        <UIOverlay visible={uiVisible} />
      </section>

      {/* ── Scrollbare Projekt-Sektion mit wachsenden Karten ── */}
      <ProjectsSection />
    </main>
  );
}
