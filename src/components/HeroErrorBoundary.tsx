"use client";

import { Component, type ReactNode } from "react";

/**
 * HeroErrorBoundary
 * ─────────────────
 * Fängt Laufzeitfehler aus der 3D-Szene ab (z. B. wenn ein Gerät/Browser
 * mit den Eis-Shadern, der HDR-Environment-Berechnung oder dem
 * Font-Loading nicht klarkommt — etwa ein älterer Desktop-Grafikchip).
 *
 * Ohne diese Boundary reißt ein solcher Fehler die komplette Seite leer
 * (React unmountet ohne Error Boundary den gesamten Baum → weißer
 * Bildschirm), obwohl Frost-Overlay und Linktree-Cards unabhängig davon
 * eigentlich weiterlaufen könnten. Mit der Boundary bleibt bei einem
 * Absturz wenigstens ein schwarzer Hintergrund + die restliche Seite
 * nutzbar, statt dass alles verschwindet.
 */
export default class HeroErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Bewusst in der Konsole sichtbar lassen — das ist der Fehler, den
    // wir bräuchten, um die 3D-Szene für das betroffene Gerät gezielt
    // zu fixen, statt nur das Symptom (leere Seite) zu kaschieren.
    // eslint-disable-next-line no-console
    console.error("Hero3D-Szene ist abgestürzt:", error, info);
  }

  render() {
    if (this.state.hasError) {
      // Kein WebGL/3D möglich (z. B. Grafiktreiber-Problem oder
      // Hardwarebeschleunigung deaktiviert) — statt leerer schwarzer
      // Fläche wenigstens ein ruhiger, markentreuer Text-Ersatz an
      // ungefähr der Stelle, an der sonst der Eis-Schriftzug steht.
      return (
        <div className="absolute inset-0 flex items-start justify-center bg-black pt-[24vh] sm:pt-[22vh]">
          <h1
            className="select-none px-6 text-center text-[13vw] font-bold tracking-tight text-white/90 sm:text-6xl md:text-7xl"
            style={{ textShadow: "0 0 46px rgba(140,200,255,0.28)" }}
          >
            Flo&apos;s Websites
          </h1>
        </div>
      );
    }
    return this.props.children;
  }
}
