/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '8000',
        pathname: '/media/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/media/**',
      },
      {
        protocol: 'https',
        hostname: 'ait.iak.ngo',
        port: '',
        pathname: '/media/**',
      },
      {
        protocol: 'https',
        hostname: 'www.ait.iak.ngo',
        port: '',
        pathname: '/media/**',
      },

    ],
    domains: ['images.unsplash.com']

  },

  async rewrites() {
    return [
      {
        source: '/media/:path*',
        destination: 'http://api-gateway:8000/media/:path*',
      },
    ];
  },
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;
