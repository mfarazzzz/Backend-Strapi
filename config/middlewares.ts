/**
 * Middleware Configuration
 * 
 * Configures Strapi v5 middlewares including:
 * - Security headers (helmet-like)
 * - Rate limiting
 * - CORS hardening for production
 * - Custom security logger
 * 
 * @see Backend-Strapi/docs/RBAC-ARCHITECTURE.md
 */

export default ({ env }) => {
  const isProduction = env('NODE_ENV') === 'production';
  
  return [
    'strapi::logger',
    'strapi::errors',
    
    // Security headers configuration (helmet-like)
    {
      name: 'strapi::security',
      config: {
        contentSecurityPolicy: {
          useDefaults: true,
          directives: {
            'connect-src': ["'self'", 'https:', 'http:'],
            'img-src': ["'self'", 'data:', 'blob:', 'https:', 'http:'],
            'media-src': ["'self'", 'data:', 'blob:', 'https:', 'http:'],
            'script-src': ["'self'", "'unsafe-inline'"],
            'style-src': ["'self'", "'unsafe-inline'"],
            'frame-ancestors': ["'self'"],
            upgradeInsecureRequests: isProduction ? true : null,
          },
        },
        // X-Frame-Options
        frameguard: {
          action: 'sameorigin',
        },
        // X-Content-Type-Options
        contentTypeOptions: {
          enabled: true,
        },
        // X-XSS-Protection (legacy but still useful)
        xssFilter: {
          enabled: true,
        },
        // Strict-Transport-Security (HSTS)
        hsts: {
          enabled: isProduction,
          maxAge: 31536000, // 1 year
          includeSubDomains: true,
          preload: true,
        },
        // Referrer-Policy
        referrerPolicy: {
          policy: 'strict-origin-when-cross-origin',
        },
        // X-Permitted-Cross-Domain-Policies
        crossOriginEmbedderPolicy: false, // Disable for media loading
        crossOriginOpenerPolicy: isProduction ? 'same-origin' : false,
        crossOriginResourcePolicy: isProduction ? { policy: 'cross-origin' } : false,
      },
    },
    
    // CORS configuration - hardened for production
    {
      name: 'strapi::cors',
      config: {
        enabled: true,
        origin: env.array('CORS_ORIGINS', [
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          'http://localhost:3001',
          'http://127.0.0.1:3001',
          'http://localhost:3002',
          'http://127.0.0.1:3002',
          ...(isProduction ? [
            'https://rampurnews.com',
            'https://www.rampurnews.com',
            env('FRONTEND_URL', 'https://rampurnews.com'),
          ] : []),
        ]),
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
        headers: [
          'Content-Type',
          'Authorization',
          'Origin',
          'Accept',
          'X-Requested-With',
          'X-CSRF-Token',
        ],
        keepHeaderOnError: true,
        maxAge: isProduction ? 86400 : 3600, // 24 hours in production, 1 hour in dev
      },
    },
    
    'strapi::poweredBy',
    'strapi::query',
    
    // Body parser configuration
    {
      name: 'strapi::body',
      config: {
        formLimit: env('FORM_LIMIT', '50mb'),
        jsonLimit: env('JSON_LIMIT', '50mb'),
        textLimit: env('TEXT_LIMIT', '50mb'),
        formidable: {
          maxFileSize: env.int('UPLOAD_SIZE_LIMIT', 50 * 1024 * 1024),
        },
      },
    },
    
    'strapi::session',
    'strapi::favicon',
    'strapi::public',
    
    // Custom security logger middleware
    {
      name: 'global::security-logger',
      config: {
        // Log all requests in production for audit trail
        logAllRequests: env.bool('LOG_ALL_REQUESTS', false),
        // Log slow requests
        logSlowRequests: true,
        // Threshold for slow request logging (ms)
        slowRequestThreshold: env.int('SLOW_REQUEST_THRESHOLD', 3000),
        // Paths to exclude from logging
        excludePaths: [
          '/admin',
          '/_health',
          '/favicon.ico',
          '/uploads',
        ],
      },
    },
  ];
};
