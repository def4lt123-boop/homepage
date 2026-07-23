"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import UIOverlay from "./UIOverlay";
import ProjectsSection from "./ProjectsSection";
import HeroTitle from "./HeroTitle";

/**
 * LandingPage
 * ───────────
 * - Hero: exakt ein Viewport (100dvh), overflow-hidden → saubere
 *   Leinwand für das 3D-Intro
 * - HeroTitle ("Flo's Websites") ist echter DOM-Text und wird sofort
 *   gerendert — unabhängig davon, ob/wann das WebGL-Canvas geladen
 *   ist. Die 3D-Szene ist reine Atmosphäre dahinter, kein Träger des
 *   eigentlichen Inhalts mehr (wichtig für SEO/Screenreader & für
 *   sofort sichtbaren, bedeutungsvollen Content statt Ladezustand)
 * - Darunter: scrollbare Projekt-Sektion, deren Karten beim Scrollen
 *   langsam größer werden und die Website-Vorschauen enthüllen
 * - Hero3D ohne SSR (WebGL existiert nur im Browser)
 * - Intro spielt pro Browser-Session nur einmal (sessionStorage) —
 *   bei Reload/Zurücknavigieren steht die Kamera sofort an Ort & Stelle
 */

const INTRO_SESSION_KEY = "flo-intro-seen";

const Hero3D = dynamic(() => import("./Hero3D"), {
  ssr: false,
  // Bewusst kein Spinner/Ladehinweis: "Flo's Websites" (HeroTitle)
  // steht ja bereits da — ein zusätzliches Lade-Icon wäre nur Unruhe.
  // Der dunkle Verlauf verhindert lediglich ein Aufblitzen von Weiß/
  // Transparenz, bevor das Canvas übernimmt.
  loading: () => (
    <div
      aria-hidden
      className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_20%,#0a1420_0%,#02040a_65%)]"
    />
  ),
});

export default function LandingPage() {
  const [uiVisible, setUiVisible] = useState(false);
  /* Schon in dieser Session gesehen? Dann Kamera-Flug überspringen.
     Lazy-Initializer statt Effect: läuft synchron im ersten
     Client-Render, Hero3D selbst wird eh erst nach der Hydration
     (dynamic import, ssr:false) gemountet — kein Hydration-Mismatch. */
  const [skipIntro] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem(INTRO_SESSION_KEY) === "1";
  });

  const handleIntroComplete = useCallback(() => {
    window.sessionStorage.setItem(INTRO_SESSION_KEY, "1");
    window.setTimeout(() => setUiVisible(true), 300);
  }, []);

  /* Fallback: UI spätestens nach 6s einblenden (falls WebGL blockiert) */
  useEffect(() => {
    const id = window.setTimeout(() => setUiVisible(true), 6000);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <main className="relative w-full bg-black">
      {/* ── Hero: ein voller Viewport, Leinwand fürs 3D-Intro ── */}
      <section className="relative h-[100svh] w-full overflow-hidden supports-[height:100dvh]:h-dvh">
        <Hero3D onIntroComplete={handleIntroComplete} skipIntro={skipIntro} />

        {/* Echter, sofort sichtbarer Titel — unabhängig vom Ladezustand
            des Canvas darunter */}
        <HeroTitle />

        {/* Sanfter Übergang unten: statt eines harten Schnitts in das
            Schwarz der Projekte-Sektion blendet der Hero-Hintergrund
            schon vorher darauf zu aus. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[6] h-[24vh] bg-gradient-to-b from-transparent to-black"
        />

        {/* UI-Layer über dem Canvas (Wortmarke, Tagline, Project-Cards) */}
        <UIOverlay visible={uiVisible} />
      </section>

      {/* ── Scrollbare Projekt-Sektion mit wachsenden Karten ── */}
      <ProjectsSection />
    </main>
  );
}
