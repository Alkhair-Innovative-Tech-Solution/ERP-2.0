/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  optimizeFonts: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://api-gateway:8000/api/:path*',
      },
      {
        source: '/media/:path*',
        destination: 'http://api-gateway:8000/media/:path*',
      },
    ];
  },
  output: 'standalone',
};

module.exports = nextConfig;

