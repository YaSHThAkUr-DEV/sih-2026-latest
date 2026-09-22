import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "bin-attorneys-jets-fraction.trycloudflare.com",
    "192.168.0.101",
    "192.168.0.101:3000",
    "localhost:3000",
    "*.loca.lt",
  ],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
