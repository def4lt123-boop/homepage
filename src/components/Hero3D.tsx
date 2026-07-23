"use client";

/**
 * Hero3D — Ice Edition
 * ────────────────────
 * Die Buchstaben von "Flo's Websites" fliegen einzeln aus der Tiefe ein
 * (GSAP-Stagger) und stehen danach als glasklares Eis da:
 *
 * - Text3D mit "Ice Kingdom"-Font (lokal als typeface.json)
 * - Eis-Material: MeshPhysicalMaterial mit Transmission (echtes,
 *   lichtbrechendes Eis), bläulicher Schimmer, Frost-Rauheit
 * - Frost-Atem: prozeduraler Nebel-Shader hinter den Buchstaben
 *   (endloser Loop, wie kalter Dunst)
 * - Kristall-Schneeflocken: instanzierte 3D-Eiskristalle, die endlos
 *   sanft herabrieseln und dabei glitzern + funkelnder Schneestaub
 * - Kühle Winter-Beleuchtung, frostiger Hintergrund
 */

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Text3D,
  Sparkles,
  useFont,
  Environment,
  Lightformer,
} from "@react-three/drei";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import gsap from "gsap";

/* ────────────────────────────── Konfiguration ───────────────────────────── */

const FONT_URL = "/fonts/IceKingdom.typeface.json";
const TEXT = "Flo's Websites";
const SIZE = 1;
const DEPTH = 0.26;
const LETTER_SPACING = 0.07;
const CAP_HEIGHT = 0.72;

useFont.preload(FONT_URL);

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
 * Nutzer mit "Bewegung reduzieren" (OS-Einstellung): Buchstaben-Flug,
 * Kamera-Dolly und die endlose Schwebe-/Parallax-Bewegung werden
 * übersprungen bzw. eingefroren — nur das ruhige Eis-Glitzern bleibt.
 */
function usePrefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** Deterministischer Pseudo-Zufall → stabile Positionen */
function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

/* ─────────────────── Komplexes Eis-Material (Shader-Patch) ──────────────── */
/**
 * MeshPhysicalMaterial + injiziertes 3D-Frost-Noise (onBeforeCompile):
 * - Farbverlauf im Eis: tiefblaue dichte Zonen → türkis → frostweiße Flecken
 * - Feine Kristalladern (dunkle Linien wie Risse im Eis)
 * - Wanderndes Mikro-Glitzern (winzige aufblitzende Kristallfacetten)
 * - Variierende Rauheit: spiegelglatte und mattgefrorene Bereiche
 * - Dazu Iridescence + Sheen für den perlmuttartigen Eis-Schimmer
 */
function createIceMaterial(): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color("#e8f5ff"),
    metalness: 0.02,
    roughness: 0.16,
    transmission: 0.55,
    thickness: 1.1,
    ior: 1.31,
    clearcoat: 1,
    clearcoatRoughness: 0.22,
    attenuationColor: new THREE.Color("#4da3ff"),
    attenuationDistance: 1.2,
    // Dezent statt regenbogenfarben — starke Iridescence ist der
    // klassische "billiger Glasbutton"-Tell. Ein Hauch reicht für den
    // perlmuttartigen Schimmer, ohne nach CSS3-Badge auszusehen.
    iridescence: 0.15,
    iridescenceIOR: 1.28,
    sheen: 0.22,
    sheenColor: new THREE.Color("#cfeaff"),
    sheenRoughness: 0.7,
    // Kalte, leicht bläuliche Spekularität statt neutralem Weiß —
    // liest sich sofort als "kalte Oberfläche" statt als Kunststoff.
    specularIntensity: 1.1,
    specularColor: new THREE.Color("#dff2ff"),
    emissive: new THREE.Color("#9fd4ff"),
    emissiveIntensity: 0,
    // Reflexionen kommen jetzt von der echten <Environment> in der
    // Szene (siehe Hero3D-Komponente) statt nur von den Lichtquellen —
    // das ist der Hauptgrund, warum PBR-Glas/Eis vorher flach wirkte.
    envMapIntensity: 1.3,
    transparent: true,
    opacity: 0,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    mat.userData.uTime = shader.uniforms.uTime;

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vIcePos;"
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvIcePos = position;"
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `#include <common>
        varying vec3 vIcePos;
        uniform float uTime;
        float iceHash(vec3 p) {
          return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
        }
        float iceNoise(vec3 p) {
          vec3 i = floor(p); vec3 f = fract(p);
          vec3 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(iceHash(i), iceHash(i + vec3(1,0,0)), u.x),
                mix(iceHash(i + vec3(0,1,0)), iceHash(i + vec3(1,1,0)), u.x), u.y),
            mix(mix(iceHash(i + vec3(0,0,1)), iceHash(i + vec3(1,0,1)), u.x),
                mix(iceHash(i + vec3(0,1,1)), iceHash(i + vec3(1,1,1)), u.x), u.y),
            u.z);
        }
        float iceFbm(vec3 p) {
          float v = 0.0; float a = 0.5;
          for (int k = 0; k < 4; k++) {
            v += a * iceNoise(p);
            p = p * 2.1 + vec3(7.3, 3.1, 11.7);
            a *= 0.5;
          }
          return v;
        }`
      )
      .replace(
        "#include <color_fragment>",
        /* glsl */ `#include <color_fragment>
        {
          float nBig  = iceFbm(vIcePos * 2.2);
          float nMid  = iceFbm(vIcePos * 6.5 + 13.0);
          float nFine = iceNoise(vIcePos * 26.0);

          /* Eis-Farbverlauf: tiefblau → eisblau → frostweiß
             (bewusst etwas entsättigt gegenüber "Clip-Art-Blau" —
             echtes Gletschereis wirkt durch Tiefe/Streuung bläulich,
             nicht durch reine Farbsättigung) */
          vec3 deepIce = vec3(0.11, 0.27, 0.52);
          vec3 midIce  = vec3(0.52, 0.78, 0.95);
          vec3 frost   = vec3(0.95, 0.985, 1.0);
          vec3 iceCol = mix(deepIce, midIce, smoothstep(0.22, 0.62, nBig));
          iceCol = mix(iceCol, frost, smoothstep(0.55, 0.92, nMid) * 0.9);

          /* Feine dunkle Kristalladern (wie Risse im Eisblock) */
          float veins = smoothstep(0.035, 0.09, abs(fract(nMid * 3.2) - 0.5) * 0.28 + nFine * 0.03);
          iceCol *= mix(0.62, 1.0, veins);

          /* Mikro-Glitzern: winzige Facetten blitzen zeitversetzt auf */
          float sparkle = step(0.984, iceNoise(vIcePos * 42.0 + floor(uTime * 1.6) * 0.71));
          iceCol += sparkle * vec3(0.75, 0.85, 1.0);

          diffuseColor.rgb = mix(diffuseColor.rgb, iceCol, 0.88);
        }`
      )
      .replace(
        "#include <roughnessmap_fragment>",
        /* glsl */ `#include <roughnessmap_fragment>
        {
          /* Frost-Flecken: matte, angefrorene Zonen neben blankem Eis */
          float frostPatch = iceFbm(vIcePos * 5.0 + 3.7);
          roughnessFactor = mix(0.05, 0.55, smoothstep(0.32, 0.8, frostPatch));
        }`
      );
  };

  return mat;
}

/* ──────────────────────── Frost-Nebel (FBM-Shader) ──────────────────────── */

const mistVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const mistFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uFade;
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
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.03 + vec2(11.3, 5.7);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    /* Kalter Dunst: driftet langsam seitwärts & aufwärts — endlos */
    float t = uTime * 0.12;
    vec2 q = vec2(uv.x * 2.4 + t * 0.7, uv.y * 1.6 - t);
    float n = fbm(q + fbm(q * 1.7 + t * 0.3) * 0.7);

    /* Weiche Wolkenform, zu allen Rändern auslaufend */
    float edge = smoothstep(0.0, 0.3, uv.x) * smoothstep(1.0, 0.7, uv.x)
               * smoothstep(0.0, 0.25, uv.y) * smoothstep(1.0, 0.7, uv.y);
    float intensity = smoothstep(0.45, 0.95, n) * edge;

    /* Eisige Farbrampe: tiefblau → hellblau → weiß */
    vec3 col = mix(vec3(0.35, 0.62, 0.95), vec3(0.85, 0.95, 1.0),
                   smoothstep(0.3, 0.9, intensity));

    float alpha = intensity * 0.32 * uFade;
    if (alpha < 0.008) discard;
    gl_FragColor = vec4(col * alpha, alpha);
  }
`;

/** Frost-Dunst hinter dem gesamten Schriftzug — loopt für immer */
function FrostMist({ fadeRef }: { fadeRef: React.RefObject<{ value: number }> }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uFade: { value: 0 } }),
    []
  );

  useFrame((_, delta) => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value += delta;
    matRef.current.uniforms.uFade.value = fadeRef.current?.value ?? 0;
  });

  return (
    <mesh position={[0, 0.1, -1.4]}>
      <planeGeometry args={[16, 5]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={mistVertexShader}
        fragmentShader={mistFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

/* ─────────────────── Kristall-Schneeflocken (instanziert) ────────────────── */

/**
 * Baut eine echte sechsarmige Schneeflocke als flache 3D-Geometrie:
 * 6 Hauptarme (dünne Prismen) + je 2 Seitenverzweigungen pro Arm
 * + hexagonaler Kern — klassische Dendriten-Form.
 */
function createSnowflakeGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const T = 0.06; // Dicke (z) der Flocke
  const ARM_LEN = 1.0;
  const ARM_W = 0.09;

  /* Hexagonaler Kern */
  const core = new THREE.CylinderGeometry(0.16, 0.16, T, 6);
  core.rotateX(Math.PI / 2);
  parts.push(core);

  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;

    /* Hauptarm */
    const arm = new THREE.BoxGeometry(ARM_LEN, ARM_W, T);
    arm.translate(ARM_LEN / 2, 0, 0);
    arm.rotateZ(angle);
    parts.push(arm);

    /* Spitze des Arms (kleine Raute) */
    const tip = new THREE.CylinderGeometry(0.001, 0.1, 0.22, 4);
    tip.rotateX(Math.PI / 2);
    tip.rotateZ(Math.PI / 2);
    // Ausrichtung: Spitze zeigt nach außen
    const tipG = tip.clone();
    tipG.rotateZ(angle);
    const tx = Math.cos(angle) * (ARM_LEN + 0.1);
    const ty = Math.sin(angle) * (ARM_LEN + 0.1);
    tipG.translate(tx, ty, 0);
    parts.push(tipG);
    tip.dispose();

    /* Zwei Paar Seitenverzweigungen pro Arm (bei 45% und 75% der Länge) */
    for (const frac of [0.45, 0.75]) {
      const branchLen = 0.34 * (1.15 - frac);
      for (const side of [1, -1]) {
        const branch = new THREE.BoxGeometry(branchLen, ARM_W * 0.7, T * 0.85);
        branch.translate(branchLen / 2, 0, 0);
        /* Verzweigung sitzt am Arm und geht in ±60° davon ab */
        branch.rotateZ((side * Math.PI) / 3);
        branch.translate(ARM_LEN * frac, 0, 0);
        branch.rotateZ(angle);
        parts.push(branch);
      }
    }
  }

  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  return merged ?? new THREE.OctahedronGeometry(1, 0);
}

/**
 * Echte sechsarmige Kristall-Schneeflocken, die endlos herabrieseln,
 * dabei taumeln und im Licht aufblitzen — ein einziger Draw-Call.
 */
function CrystalSnow({ count = 200 }: { count?: number }) {
  const COUNT = count;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geometry = useMemo(() => createSnowflakeGeometry(), []);

  const flakes = useMemo(() => {
    const rand = seededRandom(9182);
    return Array.from({ length: COUNT }, () => ({
      x: (rand() - 0.5) * 26,
      y0: rand() * 14,
      z: -10 + rand() * 13,
      fall: 0.22 + rand() * 0.5, // Fallgeschwindigkeit
      sway: 0.3 + rand() * 0.8, // seitliches Pendeln
      swayFreq: 0.3 + rand() * 0.7,
      /* Schneeflocken trudeln flach — sanftes Kippen statt wildem Spin */
      tiltX: 0.35 + rand() * 0.5,
      tiltY: 0.25 + rand() * 0.45,
      spinZ: (rand() - 0.5) * 1.2, // Rotation um die eigene Achse
      scale: 0.05 + rand() * 0.09,
      phase: rand() * Math.PI * 2,
    }));
  }, [COUNT]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;

    flakes.forEach((f, i) => {
      /* Endloser Fall: Modulo über die Höhe, kein Anfang, kein Ende */
      const H = 14;
      const y = ((f.y0 - f.fall * t) % H + H) % H - H / 2;
      const x = f.x + Math.sin(t * f.swayFreq + f.phase) * f.sway;
      dummy.position.set(x, y, f.z);
      /* Flaches Trudeln wie echte Schneeflocken */
      dummy.rotation.set(
        Math.sin(t * f.tiltX + f.phase) * 0.65,
        Math.sin(t * f.tiltY + f.phase * 1.3) * 0.55,
        t * f.spinZ + f.phase
      );
      dummy.scale.setScalar(f.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, undefined, COUNT]}
      frustumCulled={false}
    >
      <meshPhysicalMaterial
        color="#eaf6ff"
        metalness={0.05}
        roughness={0.1}
        transmission={0.5}
        thickness={0.3}
        ior={1.31}
        iridescence={0.18}
        iridescenceIOR={1.3}
        transparent
        opacity={0.9}
        envMapIntensity={1.6}
        emissive="#9fd4ff"
        emissiveIntensity={0.1}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
}

/* ────────────────────────────── Warp-Streaks ────────────────────────────── */
/** Eisige Lichtstreifen, die während des Intros vorbeiziehen */
function WarpStreaks({ skip = false }: { skip?: boolean }) {
  const COUNT = 64;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const startTime = useRef<number | null>(null);
  const done = useRef(skip);

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
    mat.opacity = 0.5 * fadeIn * fadeOut;

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
        color="#a8d8ff"
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

function FlyingLetters({
  onIntroComplete,
  cardCount = 2,
  skipIntro = false,
}: {
  onIntroComplete?: () => void;
  cardCount?: number;
  /** Kein Flug-Intro: Buchstaben stehen sofort an ihrer finalen
   *  Position (Wiederholungsbesuch in derselben Session, oder
   *  "Bewegung reduzieren" aktiv). */
  skipIntro?: boolean;
}) {
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
  const materialRefs = useRef<(THREE.MeshPhysicalMaterial | null)[]>([]);

  /* Ein komplexes Eis-Material pro Buchstabe (eigener Noise-Offset,
     damit Opacity/Emissive individuell animierbar bleiben) */
  const iceMaterials = useMemo(
    () => layout.map(() => createIceMaterial()),
    [layout]
  );
  useEffect(() => {
    materialRefs.current = iceMaterials;
    return () => {
      iceMaterials.forEach((m) => m.dispose());
    };
  }, [iceMaterials]);

  /** Gemeinsamer Fade für Frost-Nebel */
  const mistFade = useRef({ value: 0 });
  const wrapperRef = useRef<THREE.Group>(null);
  const introDone = useRef(false);
  /** Glitzer-Seeds pro Buchstabe */
  const shimmerSeeds = useMemo(() => {
    const rand = seededRandom(777);
    return layout.map(() => 1.5 + rand() * 3);
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

  /* GSAP-Intro: Stagger-Flug in die finale Position
     (übersprungen bei Wiederholungsbesuch oder "Bewegung reduzieren") */
  useEffect(() => {
    const groups = groupRefs.current.filter(Boolean) as THREE.Group[];
    if (groups.length === 0) return;

    if (skipIntro) {
      groups.forEach((group, i) => {
        const mat = materialRefs.current[i];
        group.position.set(0, 0, 0);
        group.rotation.set(0, 0, 0);
        group.scale.setScalar(1);
        if (mat) {
          mat.opacity = 1;
          mat.emissiveIntensity = 0.05;
        }
      });
      mistFade.current.value = 1;
      introDone.current = true;
      onIntroComplete?.();
      return;
    }

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
        const mat = materialRefs.current[i];

        group.position.set(s.x, s.y, s.z);
        group.rotation.set(s.rotX, s.rotY, s.rotZ);
        group.scale.setScalar(0.55);
        if (mat) mat.opacity = 0;

        const at = i * 0.085;
        tl.to(group.position, { x: 0, y: 0, z: 0, duration: 2.1 }, at)
          .to(group.rotation, { x: 0, y: 0, z: 0, duration: 2.3 }, at)
          .to(
            group.scale,
            { x: 1, y: 1, z: 1, duration: 1.9, ease: "power3.out" },
            at
          );

        if (mat) {
          tl.to(
            mat,
            { opacity: 1, duration: 1.4, ease: "power2.out" },
            at + 0.12
          );

          /* "Vereisen" beim Andocken: kurzer frostiger Blitz */
          mat.emissiveIntensity = 0;
          tl.to(
            mat,
            { emissiveIntensity: 1.6, duration: 0.22, ease: "power2.in" },
            at + 1.35
          ).to(
            mat,
            /* Wichtig: fast auf Null abklingen — dauerhaftes Leuchten
               würde die Frost-Struktur überstrahlen ("glattwaschen") */
            { emissiveIntensity: 0.05, duration: 1.4, ease: "power2.out" },
            at + 1.57
          );
        }
      });

      /* Frost-Nebel zieht mit dem Intro auf */
      tl.to(mistFade.current, { value: 1, duration: 2.8, ease: "power2.inOut" }, 0.7);
    });

    return () => ctx.revert();
  }, [scatter, onIntroComplete, skipIntro]);

  const totalWidth = useMemo(() => {
    if (layout.length === 0) return 1;
    const last = layout[layout.length - 1];
    return last.x + last.advance - layout[0].x;
  }, [layout]);

  const reducedMotion = usePrefersReducedMotion();

  /* Endlos-Loop: Schweben + eisiges Glitzern (läuft für immer) */
  useFrame((state) => {
    if (!wrapperRef.current) return;
    const t = state.clock.elapsedTime;
    /* Bei "Bewegung reduzieren": kein Schweben/Wackeln mehr, nur noch
       das ruhige, ortsfeste Glitzern der Eis-Textur bleibt aktiv. */
    const amp = reducedMotion ? 0 : introDone.current ? 1 : 0.25;

    /* Vertikale Zentrierung: Im Portrait-Format (Mobile) sitzt das UI
       (Cards + Tagline) deutlich höher — der Schriftzug wandert daher
       nach oben, damit er optisch mittig im freien Bereich steht.
       Zusätzliche Cards stapeln sich im Hochformat untereinander und
       machen den Block darunter höher → der Schriftzug muss dann noch
       etwas weiter nach oben ausweichen, sonst rutscht er dahinter. */
    const aspect = state.viewport.aspect;
    const portraitStrength =
      THREE.MathUtils.clamp((1.1 - aspect) * 1.6, 0, 1.6) / 1.6; // 0…1
    const basePortraitLift = portraitStrength * 1.6;

    const CARD_BASELINE = 2; // ursprüngliche Kalibrierung (Flos Tools + Flos Rätsel)
    const LIFT_PER_EXTRA_CARD = 0.55; // world units pro zusätzlicher gestapelter Card
    const TAGLINE_CLEARANCE = 0.35; // extra Puffer, damit "Entdecke meine Projekte" frei bleibt
    const extraCards = Math.max(0, cardCount - CARD_BASELINE);
    const extraLift =
      portraitStrength *
      (extraCards * LIFT_PER_EXTRA_CARD +
        (extraCards > 0 ? TAGLINE_CLEARANCE : 0));

    const portraitLift = basePortraitLift + extraLift;

    wrapperRef.current.position.y =
      portraitLift + Math.sin(t * 0.6) * 0.05 * amp;
    wrapperRef.current.rotation.x = Math.sin(t * 0.4) * 0.015 * amp;
    wrapperRef.current.rotation.y = Math.cos(t * 0.5) * 0.02 * amp;

    /* Shader-Zeit fürs wandernde Mikro-Glitzern (endlos) */
    materialRefs.current.forEach((mat) => {
      if (mat?.userData.uTime) mat.userData.uTime.value = t;
    });

    /* Sanftes, endloses Eis-Schimmern — bewusst sehr niedrig gehalten,
       damit das Emissive die Frost-Struktur (Adern, Frost-Flecken,
       Farbverlauf) NICHT überstrahlt. Nur gelegentliches Aufblitzen. */
    if (introDone.current) {
      materialRefs.current.forEach((mat, i) => {
        if (!mat) return;
        const s = shimmerSeeds[i];
        /* Basis fast Null + seltene, kurze Glitzer-Spitzen */
        const wave =
          Math.sin(t * s * 0.8 + i * 1.7) * 0.5 +
          Math.sin(t * s * 2.3 + i * 0.9) * 0.5;
        const spike = Math.max(0, wave - 0.72) * 0.55; // nur Spitzen > Schwelle
        mat.emissiveIntensity = 0.03 + spike;
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
      {/* Frost-Dunst hinter dem gesamten Schriftzug */}
      <FrostMist fadeRef={mistFade} />

      {layout.map((letter, i) =>
        letter.char === " " ? null : (
          <group key={i} position={[letter.x + letter.advance / 2, 0, 0]}>
            <group
              ref={(el) => {
                groupRefs.current[i] = el;
              }}
            >
              <group
                position={[-letter.advance / 2, -CAP_HEIGHT / 2, -DEPTH / 2]}
              >
                {/* Komplexes Eis-Material: Farbverlauf, Kristalladern,
                    Frost-Flecken & Mikro-Glitzern (Shader-Patch) */}
                <Text3D
                  font={FONT_URL}
                  size={SIZE}
                  height={DEPTH}
                  curveSegments={16}
                  bevelEnabled
                  bevelThickness={0.03}
                  bevelSize={0.018}
                  bevelSegments={5}
                  material={iceMaterials[i]}
                >
                  {letter.char}
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

function CameraRig({ skipIntro = false }: { skipIntro?: boolean }) {
  const { camera } = useThree();
  const parallax = useRef({ x: 0, y: 0 });
  const reducedMotion = usePrefersReducedMotion();
  const noAnim = skipIntro || reducedMotion;

  useEffect(() => {
    if (noAnim) {
      // Direkt an der finalen Kamera-Position — kein Dolly-Flug.
      camera.position.set(0, 0, 8.5);
      return;
    }
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
  }, [camera, noAnim]);

  useFrame((state) => {
    // Bei reduzierter Bewegung bleibt die Kamera ruhig stehen, statt
    // der Maus/dem Finger endlos zu folgen.
    if (reducedMotion) return;

    const p = parallax.current;
    p.x += (state.pointer.x * 0.5 - p.x) * 0.035;
    p.y += (state.pointer.y * 0.3 - p.y) * 0.035;

    state.camera.position.x = p.x;
    state.camera.lookAt(0, p.y * -0.3, 0);
  });

  return null;
}

/* ─────────────────────────────── Beleuchtung ────────────────────────────── */

function WinterLighting() {
  const shimmerLight = useRef<THREE.PointLight>(null);

  /* Sanft pulsierendes Nordlicht — endlos */
  useFrame((state) => {
    if (!shimmerLight.current) return;
    const t = state.clock.elapsedTime;
    shimmerLight.current.intensity =
      14 + Math.sin(t * 0.9) * 3 + Math.sin(t * 2.3) * 1.5;
  });

  return (
    <>
      {/* Kaltes Mondlicht von oben */}
      <spotLight
        position={[4, 9, 6]}
        angle={0.5}
        penumbra={1}
        intensity={80}
        color="#eaf6ff"
      />
      {/* Eisblaues Streiflicht von links unten */}
      <spotLight
        position={[-7, -4, 5]}
        angle={0.6}
        penumbra={1}
        intensity={40}
        color="#4da8ff"
      />
      {/* Pulsierendes Nordlicht vor der Szene */}
      <pointLight
        ref={shimmerLight}
        position={[0, 2, 4]}
        color="#bfe3ff"
        distance={22}
        decay={1.8}
      />
      {/* Zartes violettes Gegenlicht (Aurora-Feeling) */}
      <pointLight
        position={[6, -2, -3]}
        intensity={8}
        color="#b8a8ff"
        distance={18}
        decay={1.8}
      />
      <ambientLight intensity={0.12} color="#a8cfff" />
    </>
  );
}

/* ────────────────────────────────── Szene ───────────────────────────────── */

export default function Hero3D({
  onIntroComplete,
  cardCount = 2,
  skipIntro = false,
}: {
  onIntroComplete?: () => void;
  /** Anzahl der Link-Cards im UIOverlay — im Hochformat werden sie
   *  untereinander gestapelt, je mehr es sind, desto höher der Block
   *  und desto weiter muss der Schriftzug nach oben ausweichen. */
  cardCount?: number;
  /** Intro überspringen (Wiederholungsbesuch in derselben Session).
   *  "Bewegung reduzieren" wird zusätzlich intern erkannt. */
  skipIntro?: boolean;
}) {
  /* Mobile: weniger Partikel & begrenzte Pixel-Ratio → flüssig auf
     Android (Chrome/Firefox/Samsung Internet) und iOS Safari */
  const isMobile = useIsMobile();

  return (
    <div className="absolute inset-0 h-full w-full">
      {/* ── Winter-Hintergrund: eisige Nebel hinter dem Canvas ── */}
      <div aria-hidden className="absolute inset-0 overflow-hidden bg-black">
        <div
          className="aurora-blob"
          style={{
            width: "60vw",
            height: "45vw",
            left: "15%",
            top: "-20%",
            background:
              "radial-gradient(circle, rgba(70,150,255,0.15), transparent 65%)",
            animation: "aurora-a 26s ease-in-out infinite",
          }}
        />
        <div
          className="aurora-blob"
          style={{
            width: "50vw",
            height: "50vw",
            right: "-8%",
            bottom: "-18%",
            background:
              "radial-gradient(circle, rgba(120,200,255,0.10), transparent 65%)",
            animation: "aurora-b 32s ease-in-out infinite",
          }}
        />
        <div
          className="aurora-blob"
          style={{
            width: "42vw",
            height: "42vw",
            left: "-10%",
            bottom: "10%",
            background:
              "radial-gradient(circle, rgba(150,130,255,0.10), transparent 60%)",
            animation: "aurora-c 22s ease-in-out infinite",
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
        gl={{
          antialias: !isMobile,
          alpha: true,
          powerPreference: "high-performance",
        }}
        dpr={isMobile ? [1, 1.5] : [1, 2]}
      >
        <fog attach="fog" args={["#010208", 12, 42]} />

        {/* Statische, günstige Environment (einmal gebacken, frames=1)
            nur für Reflexionen/Highlights auf dem Eis-Material — ohne
            das wirkt PBR-Glas/Eis immer flach und "plastikig", egal
            wie die übrigen Material-Parameter stehen. */}
        <Environment resolution={128} frames={1}>
          <group>
            <Lightformer
              form="rect"
              intensity={2.4}
              color="#eaf6ff"
              position={[0, 4, 5]}
              scale={[8, 3, 1]}
            />
            <Lightformer
              form="rect"
              intensity={1.1}
              color="#4da8ff"
              position={[-6, 1, 3]}
              scale={[4, 6, 1]}
              rotation={[0, Math.PI / 3, 0]}
            />
            <Lightformer
              form="rect"
              intensity={1.4}
              color="#ffffff"
              position={[6, -2, 4]}
              scale={[3, 5, 1]}
              rotation={[0, -Math.PI / 3, 0]}
            />
            <Lightformer
              form="rect"
              intensity={0.5}
              color="#b8d8ff"
              position={[0, -6, -2]}
              scale={[10, 4, 1]}
              rotation={[Math.PI / 2, 0, 0]}
            />
          </group>
        </Environment>

        <CameraRig skipIntro={skipIntro} />
        <WinterLighting />
        <FlyingLetters
          onIntroComplete={onIntroComplete}
          cardCount={cardCount}
          skipIntro={skipIntro}
        />
        <WarpStreaks skip={skipIntro} />

        {/* Kristall-Schneeflocken — endloses Herabrieseln */}
        <CrystalSnow count={isMobile ? 90 : 200} />

        {/* Funkelnder Schneestaub in zwei Ebenen */}
        <Sparkles
          count={isMobile ? 60 : 120}
          size={1.8}
          speed={0.18}
          opacity={0.4}
          scale={[24, 12, 16]}
          position={[0, 0, -5]}
          color="#cfe9ff"
        />
        <Sparkles
          count={isMobile ? 25 : 50}
          size={3.2}
          speed={0.28}
          opacity={0.3}
          scale={[16, 9, 8]}
          position={[0, 0, -1]}
          color="#ffffff"
        />
      </Canvas>

      {/* Vignette — cineastischer Fokus zur Mitte */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 65% at 50% 50%, transparent 55%, rgba(0,0,10,0.6) 100%)",
        }}
      />
    </div>
  );
}
