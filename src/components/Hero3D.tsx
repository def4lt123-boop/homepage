"use client";

/**
 * Hero3D — Aurora Edition
 * ────────────────────────
 * Kompletter Neuentwurf, weg vom 3D-Buchstaben-Ansatz: die wuchtigen,
 * bevelten Extrusions-Buchstaben waren der eigentliche Grund für den
 * "2010-WordArt"-Look — unabhängig davon, wie das Material eingestellt
 * war. "Flo's Websites" ist jetzt echter, gestochen scharfer DOM-Text
 * (siehe HeroTitle.tsx) — diese Szene liefert nur noch die Atmosphäre
 * dahinter:
 *
 * - AuroraCurtain: prozeduraler Nordlicht-Shader, weich & organisch
 *   (domain-warped FBM statt starrer Streifen)
 * - FocalCrystal: ein einzelnes transmissives Kristallobjekt über
 *   drei's produktionsreifes MeshTransmissionMaterial — spiegelt/
 *   bricht Environment & Aurora-Farben, schwebt sanft via <Float>
 * - Stars + Sparkles: gestaffelte Partikeltiefe
 * - ShootingStars: vereinzelte Lichtstreifen beim Eintritt
 * - Echtes Postprocessing: Bloom, Vignette, feines Filmkorn
 * - Kamera: kurzer Dolly-Flug + Maus-Parallax (Desktop) /
 *   Neige-Parallax (Handy, Gyroskop)
 *
 * Respektiert durchgängig "Bewegung reduzieren" und überspringt den
 * Intro-Flug bei Wiederholungsbesuchen (skipIntro, siehe LandingPage).
 */

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  Sparkles,
  Stars,
  Float,
  MeshTransmissionMaterial,
} from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, Noise } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import gsap from "gsap";

/* ────────────────────────────── Hilfs-Hooks ─────────────────────────────── */

/**
 * Mobile-Erkennung (einmalig beim Mount) — steuert Partikelmengen,
 * Pixel-Ratio und Effektdichte für Android (Chrome/Firefox/Samsung
 * Internet) und iOS Safari.
 */
function useIsMobile(): boolean {
  // SSR-sicher: Hero3D wird nur clientseitig geladen (dynamic, ssr:false)
  if (typeof window === "undefined") return false;
  const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const small = window.innerWidth < 768;
  return coarse || small;
}

/**
 * Nutzer mit "Bewegung reduzieren" (OS-Einstellung): Kamera-Dolly,
 * Parallax, Schweben und Drift werden eingefroren bzw. übersprungen.
 */
function usePrefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * Neige-Parallax fürs Handy (DeviceOrientation statt Maus).
 * iOS 13+ verlangt eine explizite Permission-Anfrage aus einer
 * User-Geste heraus — wir hängen die deshalb an die erste Berührung
 * irgendwo auf der Seite (kein extra Button/Prompt nötig). Android
 * & Desktop brauchen keine Freigabe und starten sofort.
 */
function useDeviceTilt(enabled: boolean) {
  const tilt = useRef({ x: 0, y: 0 });
  const baseline = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      if (baseline.current === null) baseline.current = e.beta;

      const gamma = THREE.MathUtils.clamp(e.gamma, -28, 28) / 28;
      const betaDelta =
        THREE.MathUtils.clamp(e.beta - baseline.current, -22, 22) / 22;

      tilt.current.x = gamma;
      tilt.current.y = betaDelta;
    };

    let cancelled = false;
    const attach = () =>
      window.addEventListener("deviceorientation", handleOrientation);

    type DOEWithPermission = typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    const DOE = window.DeviceOrientationEvent as DOEWithPermission | undefined;

    if (typeof DOE?.requestPermission === "function") {
      const onFirstTouch = () => {
        DOE.requestPermission!()
          .then((result) => {
            if (result === "granted" && !cancelled) attach();
          })
          .catch(() => {
            /* Nutzer hat abgelehnt — Kamera bleibt einfach ruhig */
          });
      };
      window.addEventListener("touchend", onFirstTouch, { once: true });
      return () => {
        cancelled = true;
        window.removeEventListener("touchend", onFirstTouch);
        window.removeEventListener("deviceorientation", handleOrientation);
      };
    }

    attach();
    return () => {
      cancelled = true;
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, [enabled]);

  return tilt;
}

/** Deterministischer Pseudo-Zufall → stabile Positionen zwischen Renders */
function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

/* ─────────────────────────── Nordlicht-Shader ─────────────────────────────
   Eine große Ebene weit im Hintergrund, domain-warped FBM-Noise für
   organische, driftende Bänder statt starrer Streifen. Additive
   Blendung, kein Tiefentest-Schreiben — kostet kaum mehr als eine
   Textur, da nur ein einziges großes Quad gezeichnet wird. */

const auroraVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const auroraFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
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
      p = p * 2.02 + vec2(4.7, 9.1);
      a *= 0.55;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    float t = uTime * 0.05;

    /* Domain-Warp: die Bänder verziehen sich organisch statt starr
       zu driften — das macht den Unterschied zu simplen Streifen */
    vec2 warp = vec2(
      fbm(uv * vec2(1.6, 0.9) + vec2(t * 1.3, 0.0)),
      fbm(uv * vec2(1.6, 0.9) + vec2(5.2, t * 0.9))
    );
    vec2 q = uv * vec2(2.2, 1.3) + warp * 0.6 + vec2(t * 0.4, -t * 0.15);

    float band = fbm(q);
    band = smoothstep(0.3, 0.86, band);

    /* Vertikale Maske: Aurora sitzt im oberen Bilddrittel, verblasst
       nach ganz oben und zur Bildmitte hin aus */
    float vertical = smoothstep(0.0, 0.34, uv.y) * (1.0 - smoothstep(0.5, 0.98, uv.y));

    float intensity = band * vertical;

    vec3 teal   = vec3(0.10, 0.85, 0.62);
    vec3 green  = vec3(0.38, 0.95, 0.55);
    vec3 violet = vec3(0.44, 0.36, 0.95);

    vec3 col = mix(teal, green, smoothstep(0.2, 0.7, fbm(q * 1.4 + 3.0)));
    col = mix(col, violet, smoothstep(0.6, 0.95, band) * 0.5);

    vec3 outCol = col * intensity * 1.5;
    float alpha = intensity * uOpacity;

    gl_FragColor = vec4(outCol, alpha);
  }
`;

function AuroraCurtain({ skipIntro = false }: { skipIntro?: boolean }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const reducedMotion = usePrefersReducedMotion();
  const fade = useRef({ value: skipIntro ? 1 : 0 });

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: skipIntro ? 1 : 0 },
    }),
    [skipIntro]
  );

  useEffect(() => {
    if (skipIntro) return;
    const tween = gsap.to(fade.current, {
      value: 1,
      duration: 3,
      delay: 0.3,
      ease: "power1.out",
    });
    return () => {
      tween.kill();
    };
  }, [skipIntro]);

  useFrame((state) => {
    const mat = matRef.current;
    if (!mat) return;
    // Bei reduzierter Bewegung friert das Bänder-Muster ein, statt
    // endlos weiterzudriften — nur die (einmalige) Einblendung bleibt.
    if (!reducedMotion) {
      mat.uniforms.uTime.value = state.clock.elapsedTime;
    }
    mat.uniforms.uOpacity.value = reducedMotion ? 1 : fade.current.value;
  });

  return (
    <mesh position={[0, 4.5, -18]} frustumCulled={false}>
      <planeGeometry args={[52, 30]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={auroraVertexShader}
        fragmentShader={auroraFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

/* ──────────────────────────── Fokus-Kristall ──────────────────────────────
   Ein einzelnes, sanft schwebendes Kristallobjekt statt 14 einzelner
   Buchstaben-Materialien — spiegelt/bricht Environment & Aurora über
   drei's produktionsreifes MeshTransmissionMaterial. Sitzt zentral
   hinter dem DOM-Textblock und schimmert an dessen Rändern hervor. */

function FocalCrystal({ skipIntro = false }: { skipIntro?: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;

    if (skipIntro || reducedMotion) {
      g.scale.setScalar(1);
      return;
    }

    g.scale.setScalar(0.001);
    const tween = gsap.to(g.scale, {
      x: 1,
      y: 1,
      z: 1,
      duration: 1.7,
      delay: 0.4,
      ease: "elastic.out(1, 0.7)",
    });
    return () => {
      tween.kill();
    };
  }, [skipIntro, reducedMotion]);

  return (
    <Float
      speed={reducedMotion ? 0 : 1.1}
      rotationIntensity={reducedMotion ? 0 : 0.45}
      floatIntensity={reducedMotion ? 0 : 0.6}
      floatingRange={[-0.12, 0.12]}
    >
      <group ref={groupRef} position={[0, 0.1, -3.2]}>
        <mesh rotation={[0.5, 0.7, 0.1]}>
          <icosahedronGeometry args={[1.5, 1]} />
          <MeshTransmissionMaterial
            transmission={1}
            thickness={0.85}
            roughness={0.05}
            ior={1.22}
            chromaticAberration={0.035}
            anisotropy={0.15}
            distortion={0.12}
            distortionScale={0.35}
            temporalDistortion={0.04}
            clearcoat={1}
            clearcoatRoughness={0.12}
            envMapIntensity={1.5}
            color="#e6f4ff"
            samples={6}
            resolution={512}
          />
        </mesh>
      </group>
    </Float>
  );
}

/* ────────────────────────────── Sternschnuppen ────────────────────────────
   Vereinzelte Lichtstreifen beim Eintritt — sparsam statt Gewitter,
   das wirkt hochwertiger als viele. Läuft unabhängig vom Textblock. */

function ShootingStars({ skip = false }: { skip?: boolean }) {
  const COUNT = 26;
  const reducedMotion = usePrefersReducedMotion();
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const startTime = useRef<number | null>(null);
  const done = useRef(skip || reducedMotion);

  const seeds = useMemo(() => {
    const rand = seededRandom(4242);
    return Array.from({ length: COUNT }, () => ({
      x: (rand() - 0.5) * 30,
      y: (rand() - 0.5) * 16,
      z: -90 + rand() * 90,
      speed: 26 + rand() * 30,
      len: 2.4 + rand() * 5,
      thick: 0.007 + rand() * 0.016,
    }));
  }, []);

  useFrame((state) => {
    const mesh = meshRef.current;
    const mat = matRef.current;
    if (!mesh || !mat || done.current) return;

    if (startTime.current === null) startTime.current = state.clock.elapsedTime;
    const t = state.clock.elapsedTime - startTime.current;

    const fadeIn = THREE.MathUtils.clamp(t / 0.6, 0, 1);
    const fadeOut = THREE.MathUtils.clamp(1 - (t - 2.2) / 1.2, 0, 1);
    mat.opacity = 0.45 * fadeIn * fadeOut;

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
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]} frustumCulled={false}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial
        ref={matRef}
        color="#cfe4ff"
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  );
}

/* ─────────────────────────────── Kamera-Rig ────────────────────────────────
   Kurzer Dolly-Flug beim Eintritt, danach Maus-Parallax (Desktop) bzw.
   Neige-Parallax (Handy). `onSettled` feuert, sobald die Kamera ihre
   finale Position erreicht hat — das ist jetzt der Trigger dafür, dass
   die UI (Cards etc.) eingeblendet wird. */

function CameraRig({
  skipIntro = false,
  onSettled,
}: {
  skipIntro?: boolean;
  onSettled?: () => void;
}) {
  const { camera } = useThree();
  const parallax = useRef({ x: 0, y: 0 });
  const reducedMotion = usePrefersReducedMotion();
  const isMobile = useIsMobile();
  const noAnim = skipIntro || reducedMotion;
  const tilt = useDeviceTilt(isMobile && !reducedMotion);
  const settledRef = useRef(false);

  useEffect(() => {
    const settle = () => {
      if (settledRef.current) return;
      settledRef.current = true;
      onSettled?.();
    };

    if (noAnim) {
      camera.position.set(0, 0, 7.8);
      settle();
      return;
    }

    camera.position.set(0, 1.3, 14);
    const tween = gsap.to(camera.position, {
      y: 0,
      z: 7.8,
      duration: 2.2,
      ease: "power3.out",
      onComplete: settle,
    });
    return () => {
      tween.kill();
    };
  }, [camera, noAnim, onSettled]);

  useFrame((state) => {
    // Bei reduzierter Bewegung bleibt die Kamera ruhig stehen, statt
    // der Maus/dem Finger/der Neigung endlos zu folgen.
    if (reducedMotion) return;

    const p = parallax.current;
    const targetX = isMobile ? tilt.current.x * 0.45 : state.pointer.x * 0.55;
    const targetY = isMobile ? tilt.current.y * 0.28 : state.pointer.y * 0.32;
    p.x += (targetX - p.x) * 0.035;
    p.y += (targetY - p.y) * 0.035;

    state.camera.position.x = p.x;
    state.camera.lookAt(0, p.y * -0.3, 0);
  });

  return null;
}

/* ─────────────────────────────── Beleuchtung ──────────────────────────────── */

function NightLighting() {
  const shimmerLight = useRef<THREE.PointLight>(null);

  /* Sanft pulsierendes Nordlicht — endlos (reine Helligkeitsänderung,
     kein Ortswechsel — bewusst nicht an "Bewegung reduzieren" gekoppelt) */
  useFrame((state) => {
    if (!shimmerLight.current) return;
    const t = state.clock.elapsedTime;
    shimmerLight.current.intensity =
      10 + Math.sin(t * 0.8) * 2.5 + Math.sin(t * 2.1) * 1.2;
  });

  return (
    <>
      {/* Kaltes Mondlicht von oben */}
      <spotLight position={[4, 8, 6]} angle={0.5} penumbra={1} intensity={60} color="#eaf6ff" />
      {/* Eisblaues Streiflicht von links unten */}
      <spotLight position={[-7, -3, 5]} angle={0.6} penumbra={1} intensity={26} color="#4da8ff" />
      {/* Pulsierendes Aurora-Türkis vor der Szene */}
      <pointLight ref={shimmerLight} position={[0, 2, 2]} color="#7ee6c0" distance={20} decay={1.8} />
      {/* Violettes Gegenlicht (Aurora-Feeling) */}
      <pointLight position={[5, -1, -4]} intensity={10} color="#8a6fff" distance={16} decay={1.8} />
      <ambientLight intensity={0.1} color="#a8cfff" />
    </>
  );
}

/* ────────────────────────────────── Szene ───────────────────────────────── */

export default function Hero3D({
  onIntroComplete,
  skipIntro = false,
}: {
  onIntroComplete?: () => void;
  /** Intro überspringen (Wiederholungsbesuch in derselben Session).
   *  "Bewegung reduzieren" wird zusätzlich intern erkannt. */
  skipIntro?: boolean;
}) {
  const isMobile = useIsMobile();
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className="absolute inset-0 h-full w-full bg-black">
      <Canvas
        camera={{ position: [0, 1.3, 14], fov: 40, near: 0.1, far: 120 }}
        gl={{
          antialias: !isMobile,
          alpha: true,
          powerPreference: "high-performance",
        }}
        dpr={isMobile ? [1, 1.5] : [1, 2]}
      >
        <color attach="background" args={["#02040a"]} />
        <fog attach="fog" args={["#02040a", 14, 46]} />

        {/* Statische, günstige Environment (einmal gebacken, frames=1)
            für Reflexionen/Highlights auf dem Kristall — ohne echte
            Reflexionen wirkt jedes Glas-/Transmissions-Material flach. */}
        <Environment resolution={128} frames={1}>
          <group>
            <Lightformer form="rect" intensity={2.2} color="#eaf6ff" position={[0, 4, 5]} scale={[8, 3, 1]} />
            <Lightformer form="rect" intensity={1.3} color="#4de6b0" position={[-6, 1, 3]} scale={[4, 6, 1]} rotation={[0, Math.PI / 3, 0]} />
            <Lightformer form="rect" intensity={1.2} color="#8a6fff" position={[6, -2, 4]} scale={[3, 5, 1]} rotation={[0, -Math.PI / 3, 0]} />
            <Lightformer form="rect" intensity={0.5} color="#5fa8ff" position={[0, -6, -2]} scale={[10, 4, 1]} rotation={[Math.PI / 2, 0, 0]} />
          </group>
        </Environment>

        <CameraRig skipIntro={skipIntro} onSettled={onIntroComplete} />
        <NightLighting />

        <Stars
          radius={60}
          depth={30}
          count={isMobile ? 1400 : 2600}
          factor={2.4}
          saturation={0}
          fade
          speed={reducedMotion ? 0 : 0.3}
        />

        <AuroraCurtain skipIntro={skipIntro} />
        <FocalCrystal skipIntro={skipIntro} />
        <ShootingStars skip={skipIntro} />

        {/* Funkelnder Sternstaub in zwei Ebenen */}
        <Sparkles
          count={isMobile ? 50 : 100}
          size={1.6}
          speed={reducedMotion ? 0 : 0.15}
          opacity={0.35}
          scale={[22, 12, 14]}
          position={[0, 0, -4]}
          color="#bfe9ff"
        />
        <Sparkles
          count={isMobile ? 18 : 36}
          size={2.8}
          speed={reducedMotion ? 0 : 0.22}
          opacity={0.28}
          scale={[14, 8, 8]}
          position={[0, 0, -1]}
          color="#ffffff"
        />

        {/* Echtes Postprocessing statt CSS-Vignette/Grain-Attrappe —
            reagiert auf die tatsächliche Szenen-Helligkeit statt
            statisch übergelegt zu sein. */}
        <EffectComposer multisampling={0}>
          <Bloom
            intensity={isMobile ? 0.5 : 0.65}
            luminanceThreshold={0.35}
            luminanceSmoothing={0.3}
            mipmapBlur
            levels={isMobile ? 5 : 8}
            radius={0.6}
          />
          <Vignette eskil={false} offset={0.28} darkness={0.62} blendFunction={BlendFunction.NORMAL} />
          <Noise premultiply blendFunction={BlendFunction.OVERLAY} opacity={isMobile ? 0.035 : 0.05} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
