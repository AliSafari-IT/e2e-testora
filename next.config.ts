import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["testcafe", "testcafe-hammerhead", "@electron/asar"],
  devIndicators: false,
  experimental: {
    devtools: false,
  } as any,
};

export default nextConfig;
