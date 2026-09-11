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
      return <div className="absolute inset-0 bg-black" aria-hidden />;
    }
    return this.props.children;
  }
}
