/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '8000',
        pathname: '/uploads/images/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/uploads/images/**',
      },
      {
        protocol: 'https',
        hostname: 'ait.iak.ngo',
        port: '',
        pathname: '/uploads/images/**',
      },
      {
        protocol: 'https',
        hostname: 'www.ait.iak.ngo',
        port: '',
        pathname: '/uploads/images/**',
      },
    ],
    domains: ['images.unsplash.com'],
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    optimizeCss: false,
    optimizePackageImports: ['@radix-ui/react-icons'],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://api-gateway:8000/api/:path*',
      },
    ];
  },
  output: 'standalone',
}

export default nextConfig;