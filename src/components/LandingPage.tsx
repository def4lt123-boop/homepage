"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import UIOverlay, { LINK_COUNT } from "./UIOverlay";
import ProjectsSection from "./ProjectsSection";

/**
 * LandingPage
 * ───────────
 * - Hero: exakt ein Viewport (100dvh), overflow-hidden → saubere
 *   Leinwand für das 3D-Intro
 * - Darunter: scrollbare Projekt-Sektion, deren Karten beim Scrollen
 *   langsam größer werden und die Website-Vorschauen enthüllen
 * - Hero3D ohne SSR (WebGL existiert nur im Browser)
 */

const Hero3D = dynamic(() => import("./Hero3D"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center">
      <p className="animate-pulse text-xs font-medium uppercase tracking-[0.35em] text-white/30">
        Loading Experience
      </p>
    </div>
  ),
});

export default function LandingPage() {
  const [uiVisible, setUiVisible] = useState(false);

  const handleIntroComplete = useCallback(() => {
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
        <Hero3D onIntroComplete={handleIntroComplete} cardCount={LINK_COUNT} />

        {/* UI-Layer über dem Canvas */}
        <UIOverlay visible={uiVisible} />
      </section>

      {/* ── Scrollbare Projekt-Sektion mit wachsenden Karten ── */}
      <ProjectsSection />
    </main>
  );
}
