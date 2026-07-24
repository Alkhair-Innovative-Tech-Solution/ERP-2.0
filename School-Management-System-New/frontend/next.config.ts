import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

// INTERNAL_API_URL must be set (e.g. http://backend:8000 in Docker)
const INTERNAL_API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000';

const nextConfig: NextConfig = {
  // Standalone output for minimal Docker image
  output: "standalone",

  // Skip type checking during build (handled separately)
  typescript: {
    ignoreBuildErrors: true,
  },

  // Production optimizations
  compress: true,

  productionBrowserSourceMaps: false,

  poweredByHeader: false,
  reactStrictMode: true,
  devIndicators: false,

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${INTERNAL_API_URL}/api/:path*`,
      },
    ];
  },
  
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Production-only headers
          ...(isProd ? [
            {
              key: 'Strict-Transport-Security',
              value: 'max-age=31536000; includeSubDomains',
            },
            {
              key: 'Content-Security-Policy',
              value: [
                "default-src 'self'",
                "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                "font-src 'self' https://fonts.gstatic.com",
                "img-src 'self' data: blob:",
                "connect-src 'self' ws: wss: http: https:",
                "frame-ancestors 'none'",
              ].join('; '),
            },
          ] : []),
        ],
      },
    ];
  },
};

export default nextConfig;
