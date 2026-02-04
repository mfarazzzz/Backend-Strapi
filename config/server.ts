/**
 * Server Configuration
 * 
 * Configures Strapi v5 server settings including:
 * - Host and port configuration
 * - CORS settings for Next.js frontend
 * - Security headers
 * - Rate limiting settings
 * - Proxy configuration for production
 * 
 * @see Backend-Strapi/docs/RBAC-ARCHITECTURE.md
 */

export default ({ env }) => {
  const isProduction = env('NODE_ENV') === 'production';
  
  return {
    // Server binding configuration
    host: env('HOST', '0.0.0.0'),
    port: env.int('PORT', 1337),
    
    // Public URL for generating absolute URLs
    // Important for media URLs and email links
    url: env('PUBLIC_URL', env('STRAPI_PUBLIC_URL', undefined)),
    
    // Proxy configuration - enable when behind reverse proxy (nginx, cloudflare, etc.)
    proxy: env.bool('PROXY', true),
    
    // Application keys for session encryption
    app: {
      keys: env.array('APP_KEYS'),
    },
    
    // Admin panel configuration
    admin: {
      // Serve admin panel - can be disabled in production if using separate admin deployment
      serveAdminPanel: env.bool('SERVE_ADMIN', true),
      
      // Admin authentication settings
      auth: {
        // Secret for admin JWT tokens
        secret: env('ADMIN_JWT_SECRET'),
      },
      
      // API token salt for generating secure tokens
      apiToken: {
        salt: env('API_TOKEN_SALT'),
      },
      
      // Transfer token salt for data transfer operations
      transfer: {
        token: {
          salt: env('TRANSFER_TOKEN_SALT'),
        },
      },
      
      // Watchdog settings for admin panel
      watchIgnoreFiles: [
        '**/config/sync/**',
      ],
    },
    
    // Socket configuration for real-time features
    // socket: {
    //   // Enable socket.io for real-time updates
    //   enabled: env.bool('SOCKET_ENABLED', false),
    // },
    
    // Cron jobs configuration
    cron: {
      enabled: env.bool('CRON_ENABLED', true),
      tasks: {},
    },
    
    // Directories configuration
    dirs: {
      // Public directory for static files
      public: './public',
    },
    
    // HTTP server configuration
    http: {
      // Server timeout settings
      serverOptions: {
        // Request timeout (2 minutes)
        requestTimeout: env.int('REQUEST_TIMEOUT', 120000),
        // Headers timeout (must be lower than requestTimeout to avoid Node.js RangeError)
        headersTimeout: env.int('HEADERS_TIMEOUT', 110000),
        // Keep-alive timeout
        keepAliveTimeout: env.int('KEEP_ALIVE_TIMEOUT', 30000),
      },
    },
    
    // Webhooks configuration
    webhooks: {
      // Populate relations in webhook payloads
      populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
      // Default headers for webhook requests
      defaultHeaders: {},
    },
    
    // Rate limiting configuration (applied at application level)
    // Note: For production, consider using a reverse proxy (nginx) or CDN for rate limiting
    rateLimit: {
      // Enable rate limiting
      enabled: env.bool('RATE_LIMIT_ENABLED', isProduction),
      
      // Rate limit settings
      interval: env.int('RATE_LIMIT_INTERVAL', 60000), // 1 minute window
      max: env.int('RATE_LIMIT_MAX', 100), // Max requests per interval
      
      // Paths to exclude from rate limiting
      exclude: [
        '/admin',
        '/_health',
        '/favicon.ico',
      ],
      
      // Custom rate limits for specific endpoints
      endpoints: {
        // Stricter limits for authentication endpoints
        '/api/auth/local': {
          interval: 60000, // 1 minute
          max: 10, // 10 attempts per minute
        },
        '/api/auth/local/register': {
          interval: 3600000, // 1 hour
          max: 5, // 5 registrations per hour per IP
        },
        '/api/auth/forgot-password': {
          interval: 3600000, // 1 hour
          max: 3, // 3 password reset requests per hour
        },
        // Stricter limits for write operations
        '/api/articles': {
          interval: 60000, // 1 minute
          max: 30, // 30 requests per minute for article operations
        },
      },
    },
    
    // Security configuration
    security: {
      // Enable security features
      enabled: true,
      
      // Trust proxy headers (required when behind reverse proxy)
      trustProxy: env.bool('TRUST_PROXY', isProduction),
      
      // IP whitelist for admin access (optional)
      adminIpWhitelist: env.array('ADMIN_IP_WHITELIST', []),
      
      // Block suspicious user agents
      blockSuspiciousUserAgents: env.bool('BLOCK_SUSPICIOUS_UA', isProduction),
      
      // Maximum request body size (additional layer of protection)
      maxBodySize: env('MAX_BODY_SIZE', '50mb'),
    },
    
    // Logging configuration
    logger: {
      // Log level
      level: env('LOG_LEVEL', isProduction ? 'info' : 'debug'),
      
      // Enable request logging
      requests: env.bool('LOG_REQUESTS', !isProduction),
      
      // Log format
      format: isProduction ? 'json' : 'pretty',
    },
  };
};
