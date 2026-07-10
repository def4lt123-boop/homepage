"use client";

/**
 * Hero3D — Diablo Edition
 * ───────────────────────
 * Die Buchstaben von "Flo's Websites" fliegen einzeln aus der Tiefe ein
 * (GSAP-Stagger) und brennen danach ENDLOS:
 *
 * - Text3D mit Diablo-Font (Exocet-Stil, lokal als typeface.json)
 * - Verkohltes Material: fast schwarz, mit orange glühendem Emissive
 *   und permanentem Glut-Flackern (kein Ende)
 * - Prozeduraler Feuer-Shader (FBM-Noise) als Flammen-Plane pro
 *   Buchstabe — additiv geblendet, loopt unendlich
 * - Aufsteigende Glut-Funken (Sparkles), warme Feuer-Beleuchtung
 * - Warp-Streaks & Hintergrund in Feuertönen
 */

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text3D, Sparkles, useFont } from "@react-three/drei";
import gsap from "gsap";

/* ────────────────────────────── Konfiguration ───────────────────────────── */

const FONT_URL = "/fonts/Diablo.typeface.json";
const TEXT = "Flo's Websites";
const SIZE = 1;
const DEPTH = 0.22;
const LETTER_SPACING = 0.08;
const CAP_HEIGHT = 0.72;

useFont.preload(FONT_URL);

/** Deterministischer Pseudo-Zufall → stabile Streupositionen pro Buchstabe */
function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

/* ─────────────────────────── Feuer-Shader (FBM) ─────────────────────────── */

const fireVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fireFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uFade;
  uniform float uSeed;
  varying vec2 vUv;

  /* Hash & Value-Noise */
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453123);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = p * 2.02 + vec2(13.7, 7.3);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;

    /* Flammen steigen auf: Noise scrollt endlos nach unten (Modulo-frei,
       fbm ist unbegrenzt fortsetzbar → nahtloser Endlos-Loop) */
    float t = uTime * 1.1;
    vec2 q = vec2(uv.x * 3.0, uv.y * 2.2 - t);
    float n = fbm(q + fbm(q * 1.6 - t * 0.35) * 0.9);

    /* Grundform: unten dicht, nach oben ausgefranst */
    float base = 1.0 - uv.y;
    float flame = n * (0.45 + base * 1.15);

    /* Seitliches Auslaufen */
    float sideFade = smoothstep(0.0, 0.22, uv.x) * smoothstep(1.0, 0.78, uv.x);
    float bottomFade = smoothstep(0.0, 0.06, uv.y);
    float intensity = smoothstep(0.42, 1.0, flame) * sideFade * bottomFade;

    /* Feuer-Farbrampe: tiefrot → orange → gelb → weißglühend */
    vec3 col = vec3(0.0);
    col = mix(col, vec3(0.55, 0.06, 0.0), smoothstep(0.0, 0.25, intensity));
    col = mix(col, vec3(1.0, 0.35, 0.02), smoothstep(0.2, 0.55, intensity));
    col = mix(col, vec3(1.0, 0.75, 0.15), smoothstep(0.5, 0.8, intensity));
    col = mix(col, vec3(1.0, 0.98, 0.75), smoothstep(0.8, 1.0, intensity));

    float alpha = intensity * uFade;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(col * alpha * 1.6, alpha);
  }
`;

/** Flammen-Plane für einen Buchstaben — loopt für immer */
function LetterFlame({
  width,
  seed,
  fadeRef,
}: {
  width: number;
  seed: number;
  fadeRef: React.RefObject<{ value: number }>;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: seed * 10.0 },
      uFade: { value: 0 },
      uSeed: { value: seed * 37.7 },
    }),
    [seed]
  );

  useFrame((_, delta) => {
    if (!matRef.current) return;
    /* Endlos: Zeit läuft immer weiter, kein Reset, kein Ende */
    matRef.current.uniforms.uTime.value += delta;
    matRef.current.uniforms.uFade.value = fadeRef.current?.value ?? 0;
  });

  const W = Math.max(width * 2.1, 1.2);
  const H = 2.4;

  return (
    <mesh position={[0, H / 2 - CAP_HEIGHT * 0.55, -DEPTH * 0.7]}>
      <planeGeometry args={[W, H]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={fireVertexShader}
        fragmentShader={fireFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/* ────────────────────────────── Warp-Streaks ────────────────────────────── */
/** Glühende Funken-Streifen, die während des Intros vorbeiziehen */
function WarpStreaks() {
  const COUNT = 64;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const startTime = useRef<number | null>(null);
  const done = useRef(false);

  const seeds = useMemo(() => {
    const rand = seededRandom(4242);
    return Array.from({ length: COUNT }, () => ({
      x: (rand() - 0.5) * 30,
      y: (rand() - 0.5) * 16,
      z: -90 + rand() * 90,
      speed: 30 + rand() * 34,
      len: 2 + rand() * 5,
      thick: 0.008 + rand() * 0.02,
    }));
  }, []);

  useFrame((state) => {
    const mesh = meshRef.current;
    const mat = matRef.current;
    if (!mesh || !mat || done.current) return;

    if (startTime.current === null) startTime.current = state.clock.elapsedTime;
    const t = state.clock.elapsedTime - startTime.current;

    const fadeIn = THREE.MathUtils.clamp(t / 0.6, 0, 1);
    const fadeOut = THREE.MathUtils.clamp(1 - (t - 2.8) / 1.4, 0, 1);
    mat.opacity = 0.55 * fadeIn * fadeOut;

    if (fadeOut <= 0) {
      mesh.visible = false;
      done.current = true;
      return;
    }

    seeds.forEach((s, i) => {
      const z = ((s.z + s.speed * t + 100) % 112) - 100;
      dummy.position.set(s.x, s.y, z);
      dummy.scale.set(s.thick, s.thick, s.len);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, COUNT]}
      frustumCulled={false}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial
        ref={matRef}
        color="#ff7a2a"
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  );
}

/* ─────────────────────────────── Buchstaben ─────────────────────────────── */

type LetterLayout = {
  char: string;
  x: number;
  advance: number;
};

function FlyingLetters({ onIntroComplete }: { onIntroComplete?: () => void }) {
  const font = useFont(FONT_URL);

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
  const materialRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  /** Gemeinsamer Fade-Wert für alle Flammen (folgt dem Buchstaben-Fade) */
  const flameFade = useRef({ value: 0 });
  const wrapperRef = useRef<THREE.Group>(null);
  const introDone = useRef(false);
  /** Flacker-Seeds pro Buchstabe */
  const flickerSeeds = useMemo(() => {
    const rand = seededRandom(777);
    return layout.map(() => 2 + rand() * 4);
  }, [layout]);

  const scatter = useMemo(() => {
    const rand = seededRandom(1337);
    return layout.map((_, i) => {
      const side = i % 2 === 0 ? 1 : -1;
      return {
        x: (rand() - 0.5) * 14,
        y: side * (2.5 + rand() * 5),
        z: -(18 + rand() * 26),
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
    ) as THREE.MeshStandardMaterial[];
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
        group.position.set(s.x, s.y, s.z);
        group.rotation.set(s.rotX, s.rotY, s.rotZ);
        group.scale.setScalar(0.55);
        if (materials[i]) materials[i].opacity = 0;

        const at = i * 0.085;
        tl.to(group.position, { x: 0, y: 0, z: 0, duration: 2.1 }, at)
          .to(group.rotation, { x: 0, y: 0, z: 0, duration: 2.3 }, at)
          .to(
            group.scale,
            { x: 1, y: 1, z: 1, duration: 1.9, ease: "power3.out" },
            at
          )
          .to(
            materials[i],
            { opacity: 1, duration: 1.4, ease: "power2.out" },
            at + 0.12
          );

        /* Entzünden: heftiges Aufglühen beim Andocken */
        if (materials[i]) {
          materials[i].emissiveIntensity = 0;
          tl.to(
            materials[i],
            { emissiveIntensity: 2.2, duration: 0.25, ease: "power2.in" },
            at + 1.35
          ).to(
            materials[i],
            { emissiveIntensity: 0.9, duration: 0.9, ease: "power2.out" },
            at + 1.6
          );
        }
      });

      /* Flammen wachsen mit dem Einflug mit */
      tl.to(flameFade.current, { value: 1, duration: 2.6, ease: "power2.inOut" }, 0.5);
    });

    return () => ctx.revert();
  }, [scatter, onIntroComplete]);

  const totalWidth = useMemo(() => {
    if (layout.length === 0) return 1;
    const last = layout[layout.length - 1];
    return last.x + last.advance - layout[0].x;
  }, [layout]);

  /* Endlos-Loop: Schweben + Glut-Flackern (läuft für immer weiter) */
  useFrame((state) => {
    if (!wrapperRef.current) return;
    const t = state.clock.elapsedTime;
    const amp = introDone.current ? 1 : 0.25;
    wrapperRef.current.position.y = Math.sin(t * 0.6) * 0.05 * amp;
    wrapperRef.current.rotation.x = Math.sin(t * 0.4) * 0.015 * amp;
    wrapperRef.current.rotation.y = Math.cos(t * 0.5) * 0.02 * amp;

    /* Permanentes Feuer-Flackern der Glut-Ränder nach dem Intro */
    if (introDone.current) {
      materialRefs.current.forEach((mat, i) => {
        if (!mat) return;
        const s = flickerSeeds[i];
        const flicker =
          0.9 +
          Math.sin(t * s * 2.1 + i * 1.7) * 0.18 +
          Math.sin(t * s * 5.3 + i * 0.9) * 0.1 +
          Math.sin(t * s * 11.7 + i * 2.3) * 0.05;
        mat.emissiveIntensity = Math.max(0.45, flicker);
      });
    }

    const cam = state.camera as THREE.PerspectiveCamera;
    const dist = 8.5;
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
            <group
              ref={(el) => {
                groupRefs.current[i] = el;
              }}
            >
              {/* Flammen hinter dem Buchstaben — endlos brennend */}
              <LetterFlame
                width={letter.advance}
                seed={i * 0.61 + 0.13}
                fadeRef={flameFade}
              />

              <group
                position={[-letter.advance / 2, -CAP_HEIGHT / 2, -DEPTH / 2]}
              >
                <Text3D
                  font={FONT_URL}
                  size={SIZE}
                  height={DEPTH}
                  curveSegments={20}
                  bevelEnabled
                  bevelThickness={0.03}
                  bevelSize={0.016}
                  bevelSegments={6}
                >
                  {letter.char}
                  {/* Verkohlt-glühendes Material (Diablo-Look) */}
                  <meshStandardMaterial
                    ref={(el) => {
                      materialRefs.current[i] = el;
                    }}
                    color="#160a05"
                    metalness={0.25}
                    roughness={0.55}
                    emissive="#ff5a00"
                    emissiveIntensity={0}
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

function FireLighting() {
  const flickerLight = useRef<THREE.PointLight>(null);

  /* Zentrales Feuerlicht flackert endlos — beleuchtet die Buchstaben von vorn */
  useFrame((state) => {
    if (!flickerLight.current) return;
    const t = state.clock.elapsedTime;
    flickerLight.current.intensity =
      26 + Math.sin(t * 7.3) * 5 + Math.sin(t * 13.7) * 3 + Math.sin(t * 3.1) * 4;
  });

  return (
    <>
      {/* Warmes Glut-Licht von unten (wie ein Lavameer) */}
      <spotLight
        position={[0, -6, 4]}
        angle={0.9}
        penumbra={1}
        intensity={90}
        color="#ff3d00"
      />
      {/* Flackerndes Feuerlicht vor dem Schriftzug */}
      <pointLight
        ref={flickerLight}
        position={[0, 1.5, 3.5]}
        color="#ff8a3c"
        distance={20}
        decay={1.6}
      />
      {/* Kühles Gegenlicht von oben für Kanten-Definition */}
      <spotLight
        position={[5, 8, 6]}
        angle={0.45}
        penumbra={1}
        intensity={30}
        color="#ffd9a0"
      />
      <ambientLight intensity={0.06} color="#ff6a00" />
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
      {/* ── Höllen-Hintergrund: glimmende Glut-Nebel hinter dem Canvas ── */}
      <div aria-hidden className="absolute inset-0 overflow-hidden bg-black">
        <div
          className="aurora-blob"
          style={{
            width: "60vw",
            height: "45vw",
            left: "20%",
            bottom: "-25%",
            background:
              "radial-gradient(circle, rgba(255,60,0,0.20), transparent 65%)",
            animation: "aurora-a 24s ease-in-out infinite",
          }}
        />
        <div
          className="aurora-blob"
          style={{
            width: "48vw",
            height: "48vw",
            right: "-5%",
            bottom: "-20%",
            background:
              "radial-gradient(circle, rgba(255,120,20,0.13), transparent 65%)",
            animation: "aurora-b 30s ease-in-out infinite",
          }}
        />
        <div
          className="aurora-blob"
          style={{
            width: "42vw",
            height: "42vw",
            left: "-8%",
            top: "55%",
            background:
              "radial-gradient(circle, rgba(180,20,0,0.16), transparent 60%)",
            animation: "aurora-c 20s ease-in-out infinite",
          }}
        />
        {/* Feines Grain gegen Banding */}
        <div
          className="absolute inset-0 opacity-[0.05] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")",
          }}
        />
      </div>

      <Canvas
        camera={{ position: [0, 2.2, 17], fov: 40, near: 0.1, far: 100 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        dpr={[1, 2]}
      >
        <fog attach="fog" args={["#050100", 12, 42]} />

        <CameraRig />
        <FireLighting />
        <FlyingLetters onIntroComplete={onIntroComplete} />
        <WarpStreaks />

        {/* Aufsteigende Glut-Funken — endlos */}
        <Sparkles
          count={140}
          size={2.2}
          speed={0.6}
          opacity={0.5}
          scale={[22, 10, 14]}
          position={[0, -1, -4]}
          color="#ff9a3c"
        />
        <Sparkles
          count={60}
          size={4}
          speed={0.9}
          opacity={0.35}
          scale={[16, 8, 10]}
          position={[0, -2, -2]}
          color="#ffcf7a"
        />
      </Canvas>

      {/* Vignette — cineastischer Fokus zur Mitte */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 65% at 50% 50%, transparent 55%, rgba(0,0,0,0.6) 100%)",
        }}
      />
    </div>
  );
}
