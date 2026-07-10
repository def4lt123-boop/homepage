# Flo's Websites — 3D Landing Page

Eine High-End-Landingpage im Apple-Stil: Die Buchstaben von **„Flo's Websites"**
fliegen als 3D-Objekte (Titan/Glas-Finish) aus der Tiefe ein, danach blendet
ein Glasmorphismus-UI mit Links zu den Projekten ein.

## Tech-Stack

- **Next.js** (App Router) + TypeScript + Tailwind CSS v4
- **three.js** / **@react-three/fiber** / **@react-three/drei** — 3D-Szene
- **GSAP** — Buchstaben-Stagger & Kamera-Dolly
- **Framer Motion** — UI-Overlay-Animationen

## Lokal starten

```bash
npm install
npm run dev
```

→ http://localhost:3000

## Deployment auf Vercel

1. Repository auf GitHub pushen:

   ```bash
   git init
   git add .
   git commit -m "Initial commit: Flo's Websites landing page"
   git branch -M main
   git remote add origin https://github.com/<DEIN-USERNAME>/<REPO-NAME>.git
   git push -u origin main
   ```

2. Auf [vercel.com](https://vercel.com) → **Add New Project** → GitHub-Repo importieren.
3. Vercel erkennt Next.js automatisch — keine weitere Konfiguration nötig
   (Build Command `next build`, Node ≥ 20). **Deploy** klicken, fertig.

## Struktur

```
src/
├── app/
│   ├── globals.css        # Apple-Dark-Design-Tokens
│   ├── layout.tsx         # Fonts, Metadata
│   └── page.tsx
└── components/
    ├── LandingPage.tsx    # 100dvh-Leinwand, orchestriert Intro → UI
    ├── Hero3D.tsx         # R3F-Canvas: 3D-Buchstaben, Licht, Kamera
    └── UIOverlay.tsx      # Glasmorphismus-Cards (Flos Tools / Flos Rätsel)
public/fonts/
└── Inter_SemiBold.typeface.json  # Inter als three.js-Font (lokal, 33 KB)
```
