"use client";

/**
 * UIOverlay
 * ─────────
 * HTML/Tailwind-Layer über dem 3D-Canvas.
 *
 * - Wird erst sanft eingeblendet, nachdem die 3D-Buchstaben-Animation
 *   abgeschlossen ist (`visible`-Prop, getriggert vom GSAP-onComplete)
 * - Zwei Glasmorphismus-Cards im unteren Drittel:
 *   "Flos Tools" & "Flos Rätsel"
 * - Apple-like Hover: sanfter innerer Glow, minimale Vergrößerung,
 *   dezente Rand-Aufhellung, gleitender Licht-Sheen
 */

import { motion, useReducedMotion } from "framer-motion";

type LinkItem = {
  title: string;
  subtitle: string;
  href: string;
};

const LINKS: LinkItem[] = [
  {
    title: "Flos Tools",
    subtitle: "Nützliche Web-Tools",
    href: "https://flostools.vercel.app/",
  },
  {
    title: "Flos Rätsel",
    subtitle: "Knobeln & Rätseln",
    href: "https://flosraetsel.vercel.app/",
  },
];

function GlassCard({ item, index }: { item: LinkItem; index: number }) {
  return (
    <motion.a
      href={item.href}
      target="_blank"
      rel="noopener noreferrer"
      variants={{
        hidden: { opacity: 0, y: 28, scale: 0.96 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: {
            duration: 0.9,
            delay: index * 0.15,
            ease: [0.22, 1, 0.36, 1],
          },
        },
      }}
      whileHover="hover"
      whileTap={{ scale: 0.985 }}
      className="group pointer-events-auto relative block w-full overflow-hidden rounded-2xl
                 border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl
                 transition-[border-color,background-color,box-shadow] duration-500 ease-out
                 hover:border-white/[0.22] hover:bg-white/[0.07]
                 hover:shadow-[inset_0_0_28px_rgba(255,255,255,0.06),0_18px_50px_-16px_rgba(255,122,42,0.25)]
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7a2a]/60
                 sm:w-64 md:w-72"
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      {/* Innerer Glow, der beim Hover sanft aufblüht */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 ease-out group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 110%, rgba(255,122,42,0.16), transparent 60%)",
        }}
      />
      {/* Gleitender Licht-Sheen */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -left-full w-1/2 -skew-x-12
                   bg-gradient-to-r from-transparent via-white/[0.07] to-transparent
                   transition-transform duration-1000 ease-out group-hover:translate-x-[320%]"
      />

      {/* Inhalt — minimale Vergrößerung des Inhalts beim Hover */}
      <motion.span
        variants={{ hover: { scale: 1.03 } }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="relative z-10 flex items-center justify-between gap-4 px-6 py-5"
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold tracking-tight text-white">
            {item.title}
          </span>
          <span className="text-[12px] font-medium text-white/45 transition-colors duration-500 group-hover:text-white/60">
            {item.subtitle}
          </span>
        </span>

        {/* Pfeil — gleitet beim Hover dezent nach rechts */}
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full
                     border border-white/[0.1] bg-white/[0.05] text-white/60
                     transition-all duration-500 ease-out
                     group-hover:translate-x-0.5 group-hover:border-[#ff7a2a]/40
                     group-hover:bg-[#ff7a2a]/15 group-hover:text-[#ffb066]"
        >
          <svg
            width="13"
            height="13"
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
      </motion.span>
    </motion.a>
  );
}

export default function UIOverlay({ visible }: { visible: boolean }) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={false}
      animate={visible ? "visible" : "hidden"}
      variants={{ hidden: {}, visible: {} }}
      className="pointer-events-none absolute inset-0 z-10 flex flex-col"
      aria-hidden={!visible}
    >
      {/* Kopfbereich: dezente Wortmarke */}
      <motion.header
        variants={{
          hidden: { opacity: 0, y: reducedMotion ? 0 : -14 },
          visible: {
            opacity: 1,
            y: 0,
            transition: { duration: 1, ease: [0.22, 1, 0.36, 1] },
          },
        }}
        className="flex items-center justify-center pt-7 sm:pt-9"
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.42em] text-white/35">
          Flo&apos;s Websites
        </p>
      </motion.header>

      {/* Unteres Drittel: Tagline + Glas-Cards */}
      <div className="mt-auto flex flex-col items-center gap-7 px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:gap-8 sm:pb-16">
        <motion.p
          variants={{
            hidden: { opacity: 0, y: reducedMotion ? 0 : 16 },
            visible: {
              opacity: 1,
              y: 0,
              transition: { duration: 1, ease: [0.22, 1, 0.36, 1] },
            },
          }}
          className="text-center text-[13px] font-medium tracking-wide text-white/40 sm:text-sm"
        >
          Entdecke meine Projekte.
        </motion.p>

        <div className="flex w-full max-w-sm flex-col items-stretch gap-3.5 sm:max-w-none sm:w-auto sm:flex-row sm:gap-5">
          {LINKS.map((item, i) => (
            <GlassCard key={item.href} item={item} index={i} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
