import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Next.js from bundling these native/binary packages.
  // They are loaded at runtime by Node.js on the Vercel serverless function.
  serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium', 'puppeteer'],
};

export default nextConfig;
