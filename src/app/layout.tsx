import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display-Schrift für die große Hero-Headline & Section-Überschriften —
// bewusst kein generischer Standard-Sans: markantere Formen (v.a. beim
// "opsz"-Achsen-Detail), fühlt sich hochwertiger/moderner an als
// Helvetiker & Co. und ist gleichzeitig echter, scharfer Web-Font statt
// 3D-Geometrie.
const displayFont = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "variable",
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: "Flo's Websites",
  description:
    "Flo's Websites — Tools, Rätsel und mehr. Eine immersive 3D-Landingpage.",
  openGraph: {
    title: "Flo's Websites",
    description: "Tools, Rätsel und mehr — entdecke meine Projekte.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  // iOS Safari: Canvas & Inhalte hinter die Notch/Home-Indicator ziehen
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} ${displayFont.variable} h-full antialiased`}
    >
      <body className="h-full bg-black text-[--foreground]">{children}</body>
    </html>
  );
}
