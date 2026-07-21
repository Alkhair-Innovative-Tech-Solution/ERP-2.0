/**
 * Environment configuration
 * Centralized environment variable handling
 */

export const ENV = {
  // API Configuration — use relative URLs so browser calls same origin.
  // Next.js server-side rewrites (next.config.ts) proxy to the correct service containers.
  API_URL: '',
  AUTH_SERVICE_URL: '',
  TICKET_SERVICE_URL: '',
  COMMUNICATION_SERVICE_URL: '',
  FILE_SERVICE_URL: '',
  WS_URL: process.env.NEXT_PUBLIC_WS_URL || `ws://${typeof window !== 'undefined' ? window.location.host : 'localhost'}/ws`,

  // App Configuration
  APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'Help Desk System',
  APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',

  // Feature Flags
  ENABLE_ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
  ENABLE_CHAT: process.env.NEXT_PUBLIC_ENABLE_CHAT !== 'false',
  ENABLE_NOTIFICATIONS: process.env.NEXT_PUBLIC_ENABLE_NOTIFICATIONS !== 'false',

  // Development
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
} as const;

// Validate required environment variables
export const validateEnv = (): void => {
  const required: string[] = []; // No longer required as we use relative URLs
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0 && ENV.IS_PRODUCTION) {
    console.warn(`Missing environment variables: ${missing.join(', ')}`);
  }
};

// Initialize validation
if (typeof window !== 'undefined') {
  validateEnv();
}
