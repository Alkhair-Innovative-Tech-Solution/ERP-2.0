import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for multi-stage Docker build - copies only minimal standalone output
  output: 'standalone',
  // Allow hot module replacement to connect over local network
  // @ts-ignore - Next.js beta feature might be missing from types
  allowedDevOrigins: ['10.0.11.34', 'localhost:3000'],
};

export default nextConfig;
