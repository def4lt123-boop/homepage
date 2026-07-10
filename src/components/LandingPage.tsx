"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import UIOverlay from "./UIOverlay";

/**
 * LandingPage
 * ───────────
 * - Füllt exakt den gesamten Viewport (100vh / 100dvh)
 * - overflow-hidden → saubere, scrollfreie Leinwand für das 3D-Intro
 * - Hero3D wird ohne SSR geladen (WebGL existiert nur im Browser)
 * - UIOverlay blendet sanft ein, sobald die Buchstaben-Animation
 *   abgeschlossen ist (Callback aus der GSAP-Timeline)
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
    // Kurze Atempause nach dem letzten Buchstaben, dann UI einblenden
    window.setTimeout(() => setUiVisible(true), 350);
  }, []);

  /* Fallback: Falls WebGL blockiert ist oder das Intro nicht feuert,
     wird die UI spätestens nach 7s eingeblendet — niemand bleibt
     ohne Navigation zurück. */
  useEffect(() => {
    const id = window.setTimeout(() => setUiVisible(true), 7000);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-black supports-[height:100dvh]:h-dvh">
      {/* 3D-Layer (füllt den gesamten Bildschirm) */}
      <Hero3D onIntroComplete={handleIntroComplete} />

      {/* UI-Layer über dem Canvas */}
      <UIOverlay visible={uiVisible} />
    </main>
  );
}
