"use client";

/**
 * ProjectsSection
 * ───────────────
 * Scrollbare Sektion unter dem Hero:
 * Die Projekt-Karten (Flos Tools / Flos Rätsel) wachsen beim
 * Herunterscrollen langsam von klein auf volle Größe (scroll-linked
 * mit Framer Motion) und enthüllen dabei ein Vorschaubild der Website.
 */

import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from "framer-motion";

type Project = {
  title: string;
  subtitle: string;
  description: string;
  href: string;
  image: string;
  accent: string;
  locked?: boolean;
};

const PROJECTS: Project[] = [
  {
    title: "Flos Tools",
    subtitle: "Premium Tools & Tutorials",
    description:
      "Meine Sammlung für Programme, Tutorials, Downloads, Apps und Tools.",
    href: "https://flostools.vercel.app/",
    image: "/previews/flos-tools.jpg",
    accent: "#7ec2ff",
  },
  {
    title: "Flos Rätsel",
    subtitle: "Knobeln & Rätseln",
    description:
      "Logikrätsel, Wortsalat, Sudoku, Black Stories und viele weitere Rätsel-Kategorien.",
    href: "https://flosraetsel.vercel.app/",
    image: "/previews/flos-raetsel.jpg",
    accent: "#b8a8ff",
  },
  {
    title: "Eskalero",
    subtitle: "Würfelpoker",
    description: "Spielblock für Eskalero - Digital und Analog.",
    href: "https://eskalero.vercel.app/",
    image: "/previews/eskalero.jpg",
    accent: "#ff9f7e",
  },
  {
    title: "Springerplan",
    subtitle: "Schicht- & Springer-Planung",
    description:
      "PWA für Schichtbuchung und Springer-Verwaltung – geschützter Zugang für's Team.",
    href: "https://springerplan.vercel.app/",
    image: "/previews/springerplan.jpg",
    accent: "#7effb0",
    locked: true,
  },
];

function ProjectCard({ project, index }: { project: Project; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  /* Scroll-Progress der Karte: 0 = betritt den Viewport unten,
     1 = Kartenmitte erreicht die Viewportmitte */
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "center center"],
  });

  /* Langsames Wachsen + Aufklaren beim Scrollen */
  const scale = useTransform(scrollYProgress, [0, 1], reducedMotion ? [1, 1] : [0.82, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.35, 1], [0, 0.55, 1]);
  const y = useTransform(scrollYProgress, [0, 1], reducedMotion ? [0, 0] : [70, 0]);
  /* Das Vorschaubild klart mit leichtem Versatz auf (Reveal-Effekt) */
  const imgScale = useTransform(scrollYProgress, [0, 1], reducedMotion ? [1, 1] : [1.18, 1]);
  const imgOpacity = useTransform(scrollYProgress, [0.15, 0.75], [0, 1]);

  return (
    <motion.div ref={ref} style={{ scale, opacity, y }} className="w-full">
      <a
        href={project.href}
        target="_blank"
        rel="noopener noreferrer"
        className="group block w-full overflow-hidden rounded-3xl border border-white/[0.08]
                   bg-white/[0.03] backdrop-blur-xl
                   transition-[border-color,box-shadow] duration-500 ease-out
                   hover:border-white/[0.22]
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ec2ff]/60"
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        {/* Vorschaubild */}
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-black/40">
          {project.locked && (
            <div
              aria-hidden
              className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full
                         border border-white/15 bg-black/50 px-3 py-1.5 backdrop-blur-md"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-white/70"
              >
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              <span className="text-[10px] font-medium uppercase tracking-wide text-white/70">
                Geschützt
              </span>
            </div>
          )}
          <motion.img
            src={project.image}
            alt={`Vorschau von ${project.title}`}
            loading="lazy"
            decoding="async"
            style={{ scale: imgScale, opacity: imgOpacity }}
            className="h-full w-full object-cover object-top
                       transition-transform duration-700 ease-out
                       group-hover:scale-[1.04]"
          />
          {/* Verlauf am unteren Bildrand für sanften Übergang */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24"
            style={{
              background:
                "linear-gradient(to top, rgba(5,8,16,0.95), transparent)",
            }}
          />
          {/* Frost-Glow beim Hover */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 group-hover:opacity-100"
            style={{
              background: `radial-gradient(120% 80% at 50% 110%, ${project.accent}26, transparent 60%)`,
            }}
          />
        </div>

        {/* Textbereich */}
        <div className="flex items-center justify-between gap-4 px-6 py-5 sm:px-8 sm:py-6">
          <div className="min-w-0">
            <p
              className="text-[11px] font-medium uppercase tracking-[0.25em]"
              style={{ color: `${project.accent}b3` }}
            >
              {project.subtitle}
            </p>
            <h3 className="font-display mt-1 text-xl font-medium tracking-tight text-white sm:text-2xl">
              {project.title}
            </h3>
            <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-white/45 sm:text-sm">
              {project.description}
            </p>
          </div>

          {/* Pfeil */}
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full
                       border border-white/[0.1] bg-white/[0.05] text-white/60
                       transition-all duration-500 ease-out
                       group-hover:translate-x-0.5 group-hover:border-[#7ec2ff]/40
                       group-hover:bg-[#7ec2ff]/15 group-hover:text-[#bfe3ff]"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M5 12h14" />
              <path d="m13 6 6 6-6 6" />
            </svg>
          </span>
        </div>
      </a>
      <p className="sr-only">{`Öffnet ${project.title} in einem neuen Tab (Index ${index + 1})`}</p>
    </motion.div>
  );
}

export default function ProjectsSection() {
  return (
    <section
      id="projekte"
      className="relative bg-black px-5 pb-[max(6rem,env(safe-area-inset-bottom))] pt-20 sm:px-8 sm:pt-28"
    >
      {/* Frost-Glow im Hintergrund der Sektion */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="aurora-blob"
          style={{
            width: "70vw",
            height: "50vw",
            left: "15%",
            top: "5%",
            background:
              "radial-gradient(circle, rgba(70,150,255,0.08), transparent 65%)",
            animation: "aurora-b 34s ease-in-out infinite",
          }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-2xl">
        <motion.header
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="mb-14 text-center sm:mb-20"
        >
          <p className="text-[11px] font-medium uppercase tracking-[0.42em] text-white/35">
            Projekte
          </p>
          <h2 className="font-display mt-3 text-3xl font-medium tracking-tight text-white sm:text-4xl">
            Entdecke meine Websites
          </h2>
        </motion.header>

        <div className="flex flex-col gap-16 sm:gap-24">
          {PROJECTS.map((p, i) => (
            <ProjectCard key={p.href} project={p} index={i} />
          ))}
        </div>

        <footer className="mt-24 pb-4 text-center text-[11px] tracking-wide text-white/25 sm:mt-32">
          © {new Date().getFullYear()} Flo&apos;s Websites
        </footer>
      </div>
    </section>
  );
}
