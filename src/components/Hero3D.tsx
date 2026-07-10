"use client";

/**
 * Hero3D
 * ──────
 * Immersive 3D-Startanimation:
 * Die Buchstaben von "Flo's Websites" fliegen einzeln aus der Tiefe
 * des Raums (Z/Y) ein und formen — mit GSAP-Stagger — den Schriftzug.
 *
 * - Text3D (@react-three/drei) mit lokal gehostetem Inter SemiBold
 *   (echtes Inter, konvertiert zu typeface.json → Apple-cleaner Look)
 * - MeshPhysicalMaterial: Glas-/Titan-Finish (Clearcoat, niedrige
 *   Roughness, mittlere Metalness, leichte Transparenz)
 * - Prozedurale Studio-Beleuchtung via Environment + Lightformer
 *   (keine externen Assets → funktioniert offline & auf Vercel)
 * - Dezente Kamera-Dolly-Fahrt + Maus-Parallax für Tiefe
 */

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Text3D,
  Environment,
  Lightformer,
  Sparkles,
  useFont,
} from "@react-three/drei";
import gsap from "gsap";

/* ────────────────────────────── Konfiguration ───────────────────────────── */

const FONT_URL = "/fonts/Inter_SemiBold.typeface.json";
const TEXT = "Flo's Websites";
const SIZE = 1; // Grundgröße der Glyphen
const DEPTH = 0.22; // Extrusionstiefe
const LETTER_SPACING = 0.06;
const CAP_HEIGHT = 0.72; // optische Höhe der Versalien (für vertikale Zentrierung)

useFont.preload(FONT_URL);

/** Deterministischer Pseudo-Zufall → stabile Streupositionen pro Buchstabe */
function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

/* ─────────────────────────────── Buchstaben ─────────────────────────────── */

type LetterLayout = {
  char: string;
  /** Linke Kante des Glyphs (zentriertes Gesamtlayout) */
  x: number;
  /** Advance-Breite des Glyphs */
  advance: number;
};

function FlyingLetters({ onIntroComplete }: { onIntroComplete?: () => void }) {
  const font = useFont(FONT_URL);

  /* Layout: Glyph-Advances aus dem Font lesen → exakt zentrierter Schriftzug */
  const layout = useMemo<LetterLayout[]>(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = font.data as any;
    const glyphs = data.glyphs;
    const res: number = data.resolution ?? 1000;

    let cursor = 0;
    const items: LetterLayout[] = [];
    for (const char of TEXT) {
      const glyph = glyphs[char] ?? glyphs["?"];
      const advance = (glyph.ha / res) * SIZE;
      items.push({ char, x: cursor, advance });
      cursor += advance + LETTER_SPACING;
    }
    const totalWidth = cursor - LETTER_SPACING;
    return items.map((i) => ({ ...i, x: i.x - totalWidth / 2 }));
  }, [font]);

  const groupRefs = useRef<(THREE.Group | null)[]>([]);
  const materialRefs = useRef<(THREE.MeshPhysicalMaterial | null)[]>([]);
  const wrapperRef = useRef<THREE.Group>(null);
  const introDone = useRef(false);

  /* Streupositionen: aus der Tiefe (−Z) und oben/unten (±Y) */
  const scatter = useMemo(() => {
    const rand = seededRandom(1337);
    return layout.map((_, i) => {
      const side = i % 2 === 0 ? 1 : -1;
      return {
        x: (rand() - 0.5) * 14,
        y: side * (2.5 + rand() * 5),
        z: -(18 + rand() * 26), // tief im Bildschirm
        rotX: (rand() - 0.5) * Math.PI * 1.6,
        rotY: (rand() - 0.5) * Math.PI * 1.8,
        rotZ: (rand() - 0.5) * Math.PI * 0.9,
      };
    });
  }, [layout]);

  /* GSAP-Intro: Stagger-Flug in die finale Position */
  useEffect(() => {
    const groups = groupRefs.current.filter(Boolean) as THREE.Group[];
    const materials = materialRefs.current.filter(
      Boolean
    ) as THREE.MeshPhysicalMaterial[];
    if (groups.length === 0) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: "expo.out" },
        delay: 0.45,
        onComplete: () => {
          introDone.current = true;
          onIntroComplete?.();
        },
      });

      groups.forEach((group, i) => {
        const s = scatter[i];
        // Startzustand
        group.position.set(s.x, s.y, s.z);
        group.rotation.set(s.rotX, s.rotY, s.rotZ);
        group.scale.setScalar(0.55);
        if (materials[i]) materials[i].opacity = 0;

        const at = i * 0.085; // Stagger
        tl.to(group.position, { x: 0, y: 0, z: 0, duration: 2.1 }, at)
          .to(group.rotation, { x: 0, y: 0, z: 0, duration: 2.3 }, at)
          .to(
            group.scale,
            { x: 1, y: 1, z: 1, duration: 1.9, ease: "power3.out" },
            at
          )
          .to(
            materials[i],
            { opacity: 0.96, duration: 1.4, ease: "power2.out" },
            at + 0.12
          );
      });
    });

    return () => ctx.revert();
  }, [scatter, onIntroComplete]);

  /* Gesamtbreite des Schriftzugs (für responsives Skalieren) */
  const totalWidth = useMemo(() => {
    if (layout.length === 0) return 1;
    const last = layout[layout.length - 1];
    return last.x + last.advance - layout[0].x;
  }, [layout]);

  /* Nach dem Intro: organisches, kaum wahrnehmbares Schweben
     + responsive Skalierung, damit der Schriftzug auf Mobile nie
     abgeschnitten wird (bezogen auf die finale Kameradistanz) */
  useFrame((state) => {
    if (!wrapperRef.current) return;
    const t = state.clock.elapsedTime;
    const amp = introDone.current ? 1 : 0.25;
    wrapperRef.current.position.y = Math.sin(t * 0.6) * 0.05 * amp;
    wrapperRef.current.rotation.x = Math.sin(t * 0.4) * 0.015 * amp;
    wrapperRef.current.rotation.y = Math.cos(t * 0.5) * 0.02 * amp;

    const cam = state.camera as THREE.PerspectiveCamera;
    const dist = 8.5; // finale Kameradistanz (CameraRig)
    const visibleH = 2 * dist * Math.tan((cam.fov * Math.PI) / 360);
    const visibleW = visibleH * cam.aspect;
    const target = Math.min(1, (visibleW * 0.88) / totalWidth);
    const s = THREE.MathUtils.lerp(wrapperRef.current.scale.x, target, 0.1);
    wrapperRef.current.scale.setScalar(s);
  });

  return (
    <group ref={wrapperRef} position={[0, 0, 0]}>
      {layout.map((letter, i) =>
        letter.char === " " ? null : (
          <group key={i} position={[letter.x + letter.advance / 2, 0, 0]}>
            {/* Äußere Gruppe = Animationsziel, innere Gruppe zentriert den
                Glyph, damit die Einflug-Rotation um seine Mitte erfolgt */}
            <group
              ref={(el) => {
                groupRefs.current[i] = el;
              }}
            >
              <group
                position={[-letter.advance / 2, -CAP_HEIGHT / 2, -DEPTH / 2]}
              >
                <Text3D
                  font={FONT_URL}
                  size={SIZE}
                  height={DEPTH}
                  curveSegments={24}
                  bevelEnabled
                  bevelThickness={0.025}
                  bevelSize={0.014}
                  bevelSegments={8}
                >
                  {letter.char}
                  {/* Edles Glas-/Titan-Finish (iPhone-Look) */}
                  <meshPhysicalMaterial
                    ref={(el) => {
                      materialRefs.current[i] = el;
                    }}
                    color="#e8e8ed"
                    metalness={0.65}
                    roughness={0.16}
                    clearcoat={1}
                    clearcoatRoughness={0.12}
                    reflectivity={0.9}
                    iridescence={0.18}
                    iridescenceIOR={1.4}
                    envMapIntensity={1.5}
                    transparent
                    opacity={0}
                  />
                </Text3D>
              </group>
            </group>
          </group>
        )
      )}
    </group>
  );
}

/* ─────────────────────────────── Kamera-Rig ─────────────────────────────── */

function CameraRig() {
  const { camera } = useThree();
  const parallax = useRef({ x: 0, y: 0 });

  /* Cineastische Dolly-Fahrt beim Laden */
  useEffect(() => {
    camera.position.set(0, 2.2, 17);
    const tween = gsap.to(camera.position, {
      y: 0,
      z: 8.5,
      duration: 3.4,
      ease: "power2.inOut",
    });
    return () => {
      tween.kill();
    };
  }, [camera]);

  /* Dezente Maus-Parallaxe + permanenter LookAt für Tiefe.
     Hinweis: Imperative Mutation im useFrame-Loop ist das offizielle
     R3F-Pattern (läuft außerhalb des React-Renderings) — die
     React-Compiler-Regel meldet hier einen False-Positive. */
   
  useFrame((state) => {
    const p = parallax.current;
    p.x += (state.pointer.x * 0.5 - p.x) * 0.035;
    p.y += (state.pointer.y * 0.3 - p.y) * 0.035;

    state.camera.position.x = p.x;
    state.camera.lookAt(0, p.y * -0.3, 0);
  });

  return null;
}

/* ─────────────────────────────── Beleuchtung ────────────────────────────── */

function StudioLighting() {
  return (
    <>
      {/* Prozedurale Environment-Map: Studio-Softboxen, keine externen Assets */}
      <Environment resolution={256} frames={1}>
        {/* Key-Softbox oben */}
        <Lightformer
          intensity={4}
          position={[0, 5, -9]}
          rotation-x={Math.PI / 2}
          scale={[12, 12, 1]}
          color="#ffffff"
        />
        {/* Kühle Kante links (Titan-Schimmer) */}
        <Lightformer
          intensity={1.6}
          position={[-6, 1, 2]}
          rotation-y={Math.PI / 2}
          scale={[10, 3, 1]}
          color="#8fb8ff"
        />
        {/* Warme Kante rechts */}
        <Lightformer
          intensity={1.2}
          position={[6, -1, 2]}
          rotation-y={-Math.PI / 2}
          scale={[10, 3, 1]}
          color="#ffd9c2"
        />
        {/* Frontaler Glanzstreifen */}
        <Lightformer
          intensity={0.8}
          position={[0, 0, 10]}
          scale={[14, 1.2, 1]}
          color="#ffffff"
        />
      </Environment>

      {/* Akzent-Spots für definierte Highlights auf den Kanten */}
      <spotLight
        position={[6, 7, 6]}
        angle={0.4}
        penumbra={1}
        intensity={110}
        color="#ffffff"
        castShadow={false}
      />
      <spotLight
        position={[-7, -4, 5]}
        angle={0.5}
        penumbra={1}
        intensity={45}
        color="#2997ff"
      />
      <ambientLight intensity={0.12} />
    </>
  );
}

/* ────────────────────────────────── Szene ───────────────────────────────── */

export default function Hero3D({
  onIntroComplete,
}: {
  onIntroComplete?: () => void;
}) {
  return (
    <div className="absolute inset-0 h-full w-full">
      <Canvas
        camera={{ position: [0, 2.2, 17], fov: 40, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        dpr={[1, 2]}
      >
        {/* Tiefenstaffelung: Buchstaben tauchen aus dem Dunkel auf */}
        <fog attach="fog" args={["#000000", 12, 42]} />
        <color attach="background" args={["#000000"]} />

        <CameraRig />
        <StudioLighting />
        <FlyingLetters onIntroComplete={onIntroComplete} />

        {/* Dezenter Sternenstaub für räumliche Tiefe */}
        <Sparkles
          count={90}
          size={1.6}
          speed={0.25}
          opacity={0.35}
          scale={[24, 12, 18]}
          position={[0, 0, -6]}
          color="#9bb8ff"
        />
      </Canvas>

      {/* Vignette über dem Canvas — cineastischer Fokus zur Mitte */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 65% at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </div>
  );
}
