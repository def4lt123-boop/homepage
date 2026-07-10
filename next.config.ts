import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // three.js / drei sauber für den Server-Build transpilieren
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],

  async headers() {
    return [
      {
        // Font-JSON aggressiv cachen (ändert sich nie → immutable)
        source: "/fonts/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
