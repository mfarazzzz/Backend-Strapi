/**
 * role-check Policy
 * 
 * Generic role verification policy that accepts role names as config parameter.
 * Checks if the authenticated user has one of the specified roles.
 * 
 * Usage in routes:
 * {
 *   config: {
 *     policies: [
 *       { name: 'global::role-check', config: { roles: ['editor', 'reviewer'] } }
 *     ]
 *   }
 * }
 * 
 * @strapi v5 compliant
 */

interface PolicyConfig {
  roles?: string[];
}

export default async (
  policyContext: any,
  config: PolicyConfig,
  { strapi }: { strapi: any }
): Promise<boolean> => {
  const { state } = policyContext;
  const user = state?.user;

  // API tokens bypass role check
  if (state?.auth?.strategy?.name === 'api-token') {
    strapi.log.debug('[role-check] API token detected, bypassing role check');
    return true;
  }

  // Check for authenticated user
  if (!user?.id) {
    strapi.log.warn('[role-check] Policy failed: No authenticated user');
    throw new Error('You must be logged in to access this resource');
  }

  // Get allowed roles from config
  const allowedRoles: string[] = config?.roles || [];
  
  if (allowedRoles.length === 0) {
    strapi.log.warn('[role-check] Policy misconfigured: No roles specified in config');
    throw new Error('Access denied - policy configuration error');
  }

  // Get user's role
  const role = user?.role;
  const roleType = typeof role?.type === 'string' ? role.type.toLowerCase() : '';
  const roleName = typeof role?.name === 'string' ? role.name.toLowerCase() : '';

  // Handle case where user has no role
  if (!roleType && !roleName) {
    strapi.log.warn(`[role-check] Policy failed: User ${user.id} has no role assigned`);
    throw new Error('Access denied - no role assigned to your account');
  }

  // Normalize allowed roles for comparison
  const normalizedAllowed = new Set(allowedRoles.map(r => r.toLowerCase().trim()));
  
  // Check if user has one of the allowed roles
  const hasRole = normalizedAllowed.has(roleType) || normalizedAllowed.has(roleName);

  if (!hasRole) {
    const userRole = roleType || roleName;
    strapi.log.info(
      `[role-check] Policy denied: User ${user.id} with role "${userRole}" not in allowed roles: [${allowedRoles.join(', ')}]`
    );
    throw new Error(
      `Access denied. Your role "${userRole}" does not have permission for this action. ` +
      `Required roles: ${allowedRoles.join(', ')}`
    );
  }

  strapi.log.debug(
    `[role-check] Policy passed: User ${user.id} with role "${roleType || roleName}" is in allowed roles`
  );
  return true;
};
