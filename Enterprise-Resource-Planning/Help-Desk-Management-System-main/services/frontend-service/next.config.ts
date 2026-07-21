import type { NextConfig } from 'next';

// When running outside Docker (local dev), use localhost ports.
// When running inside Docker, use container hostnames on erp_network.
const IS_DOCKER = process.env.DOCKER_ENV === 'true';

const AUTH_URL      = process.env.AUTH_SERVICE_INTERNAL_URL || (IS_DOCKER ? 'http://auth_service:8000' : 'http://localhost:8000');
const TICKET_URL    = IS_DOCKER ? 'http://hdms-ticket-service:8002'         : 'http://localhost:8002';
const COMM_URL      = IS_DOCKER ? 'http://hdms-communication-service:8003'  : 'http://localhost:8003';
const FILE_URL      = IS_DOCKER ? 'http://hdms-file-service:8005'           : 'http://localhost:8005';

const nextConfig: NextConfig = {
  output: 'standalone',
  skipTrailingSlashRedirect: true,
  env: {
    NEXT_PUBLIC_API_GATEWAY_URL: process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost/api/v1',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost/ws',
  },
  async rewrites() {
    return [
      // Communication Service
      {
        source: '/api/v1/notifications/:path*',
        destination: `${COMM_URL}/api/v1/notifications/:path*`,
      },
      {
        source: '/api/notifications/:path*',
        destination: `${COMM_URL}/api/v1/notifications/:path*`,
      },
      // Ticket Service — exact match before wildcard
      {
        source: '/api/v1/tickets',
        destination: `${TICKET_URL}/api/v1/tickets/`,
      },
      {
        source: '/api/v1/tickets/:path*',
        destination: `${TICKET_URL}/api/v1/tickets/:path*`,
      },
      // Auth Service
      {
        source: '/api/auth/:path*',
        destination: `${AUTH_URL}/api/auth/:path*`,
      },
      {
        source: '/api/permissions/:path*',
        destination: `${AUTH_URL}/api/permissions/:path*`,
      },
      {
        source: '/api/employees/:path*',
        destination: `${AUTH_URL}/api/employees/:path*`,
      },
      // File Service
      {
        source: '/api/v1/files/:path*',
        destination: `${FILE_URL}/api/v1/files/:path*`,
      },
      // Communication Service Chat API
      {
        source: '/api/v1/chat/:path*',
        destination: `${COMM_URL}/api/v1/chat/:path*`,
      },
      // Fallback to Auth Service
      {
        source: '/api/:path*',
        destination: `${AUTH_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;


