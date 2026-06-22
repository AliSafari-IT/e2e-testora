import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["testcafe", "testcafe-hammerhead", "@electron/asar"],
};

export default nextConfig;
