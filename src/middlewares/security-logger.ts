/**
 * Security Logger Middleware
 * 
 * Provides structured logging for security-related events:
 * - Policy failures
 * - Permission violations
 * - Authentication failures
 * - Request context (user, IP, endpoint, timestamp)
 * 
 * @module middlewares/security-logger
 * @see Backend-Strapi/docs/RBAC-ARCHITECTURE.md
 */

interface SecurityLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  event: string;
  userId?: number | string | null;
  userEmail?: string | null;
  userRole?: string | null;
  ip: string;
  method: string;
  path: string;
  statusCode?: number;
  duration?: number;
  details?: Record<string, unknown>;
}

/**
 * Extract client IP from request headers or socket
 */
function getClientIP(ctx: any): string {
  // Check common proxy headers
  const forwarded = ctx.request.headers['x-forwarded-for'];
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return Array.isArray(forwarded) 
      ? forwarded[0].split(',')[0].trim()
      : forwarded.split(',')[0].trim();
  }
  
  const realIP = ctx.request.headers['x-real-ip'];
  if (realIP) {
    return Array.isArray(realIP) ? realIP[0] : realIP;
  }
  
  // Fallback to socket address
  return ctx.request.ip || ctx.ip || 'unknown';
}

/**
 * Get user information from context state
 */
function getUserInfo(ctx: any): { userId: number | string | null; userEmail: string | null; userRole: string | null } {
  const user = ctx.state?.user;
  
  if (!user) {
    return { userId: null, userEmail: null, userRole: null };
  }
  
  return {
    userId: user.id || null,
    userEmail: user.email || null,
    userRole: user.role?.type || user.role?.name || null,
  };
}

/**
 * Format log entry as structured JSON string
 */
function formatLogEntry(entry: SecurityLogEntry): string {
  return JSON.stringify(entry);
}

/**
 * Security Logger Middleware Factory
 * 
 * @param config - Middleware configuration
 * @param strapi - Strapi instance
 * @returns Koa middleware function
 */
export default (config: Record<string, unknown>, { strapi }: { strapi: any }) => {
  // Configuration with defaults
  const logAllRequests = config?.logAllRequests ?? false;
  const logSlowRequests = config?.logSlowRequests ?? true;
  const slowRequestThreshold = (config?.slowRequestThreshold as number) ?? 3000; // 3 seconds
  const excludePaths = (config?.excludePaths as string[]) ?? [
    '/admin',
    '/_health',
    '/favicon.ico',
  ];

  return async (ctx: any, next: () => Promise<void>) => {
    const startTime = Date.now();
    const requestPath = ctx.request.path;
    
    // Skip excluded paths
    const shouldSkip = excludePaths.some(path => requestPath.startsWith(path));
    
    // Capture request context before processing
    const ip = getClientIP(ctx);
    const method = ctx.request.method;
    const timestamp = new Date().toISOString();
    
    try {
      await next();
      
      // After request processing
      const duration = Date.now() - startTime;
      const statusCode = ctx.response.status;
      const { userId, userEmail, userRole } = getUserInfo(ctx);
      
      // Log authentication failures (401)
      if (statusCode === 401) {
        const entry: SecurityLogEntry = {
          timestamp,
          level: 'warn',
          event: 'AUTHENTICATION_FAILURE',
          userId,
          userEmail,
          userRole,
          ip,
          method,
          path: requestPath,
          statusCode,
          duration,
          details: {
            message: 'Authentication required or token invalid',
          },
        };
        strapi.log.warn(`[SECURITY] ${formatLogEntry(entry)}`);
      }
      
      // Log permission violations (403)
      if (statusCode === 403) {
        const entry: SecurityLogEntry = {
          timestamp,
          level: 'warn',
          event: 'PERMISSION_VIOLATION',
          userId,
          userEmail,
          userRole,
          ip,
          method,
          path: requestPath,
          statusCode,
          duration,
          details: {
            message: 'Access denied - insufficient permissions',
          },
        };
        strapi.log.warn(`[SECURITY] ${formatLogEntry(entry)}`);
      }
      
      // Log policy failures (typically result in 403)
      // Check if there's a policy failure indicator in the response
      if (ctx.state?.policyFailed) {
        const entry: SecurityLogEntry = {
          timestamp,
          level: 'warn',
          event: 'POLICY_FAILURE',
          userId,
          userEmail,
          userRole,
          ip,
          method,
          path: requestPath,
          statusCode,
          duration,
          details: {
            policy: ctx.state.failedPolicy || 'unknown',
            message: ctx.state.policyFailureReason || 'Policy check failed',
          },
        };
        strapi.log.warn(`[SECURITY] ${formatLogEntry(entry)}`);
      }
      
      // Log slow requests
      if (logSlowRequests && duration > slowRequestThreshold && !shouldSkip) {
        const entry: SecurityLogEntry = {
          timestamp,
          level: 'warn',
          event: 'SLOW_REQUEST',
          userId,
          userEmail,
          userRole,
          ip,
          method,
          path: requestPath,
          statusCode,
          duration,
          details: {
            threshold: slowRequestThreshold,
            message: `Request took ${duration}ms (threshold: ${slowRequestThreshold}ms)`,
          },
        };
        strapi.log.warn(`[SECURITY] ${formatLogEntry(entry)}`);
      }
      
      // Log all requests if enabled (useful for audit trails)
      if (logAllRequests && !shouldSkip) {
        const entry: SecurityLogEntry = {
          timestamp,
          level: 'info',
          event: 'REQUEST_COMPLETED',
          userId,
          userEmail,
          userRole,
          ip,
          method,
          path: requestPath,
          statusCode,
          duration,
        };
        strapi.log.info(`[SECURITY] ${formatLogEntry(entry)}`);
      }
      
      // Log successful authentication on login endpoints
      if (requestPath.includes('/auth/local') && method === 'POST' && statusCode === 200) {
        const entry: SecurityLogEntry = {
          timestamp,
          level: 'info',
          event: 'LOGIN_SUCCESS',
          userId,
          userEmail,
          userRole,
          ip,
          method,
          path: requestPath,
          statusCode,
          duration,
        };
        strapi.log.info(`[SECURITY] ${formatLogEntry(entry)}`);
      }
      
      // Log rate limit hits (429)
      if (statusCode === 429) {
        const entry: SecurityLogEntry = {
          timestamp,
          level: 'warn',
          event: 'RATE_LIMIT_EXCEEDED',
          userId,
          userEmail,
          userRole,
          ip,
          method,
          path: requestPath,
          statusCode,
          duration,
          details: {
            message: 'Rate limit exceeded',
          },
        };
        strapi.log.warn(`[SECURITY] ${formatLogEntry(entry)}`);
      }
      
    } catch (error: unknown) {
      // Log errors that occur during request processing
      const duration = Date.now() - startTime;
      const { userId, userEmail, userRole } = getUserInfo(ctx);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorName = error instanceof Error ? error.name : 'Error';
      
      const entry: SecurityLogEntry = {
        timestamp,
        level: 'error',
        event: 'REQUEST_ERROR',
        userId,
        userEmail,
        userRole,
        ip,
        method,
        path: requestPath,
        duration,
        details: {
          errorName,
          errorMessage,
        },
      };
      strapi.log.error(`[SECURITY] ${formatLogEntry(entry)}`);
      
      // Re-throw the error to let Strapi's error handler deal with it
      throw error;
    }
  };
};
