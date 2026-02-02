/**
 * cms-role Policy
 *
 * Verifies that the authenticated user has a CMS role that allows
 * access to admin/CMS routes.
 *
 * Allowed roles: admin, editor, reviewer, reporter, author, contributor
 *
 * @strapi v5 compliant
 */
export default async (policyContext: any, config: any, { strapi }: { strapi: any }) => {
  // API tokens bypass role check
  if (policyContext?.state?.auth?.strategy?.name === 'api-token') {
    strapi.log.debug('[cms-role] API token detected, bypassing role check');
    return true;
  }

  const user = policyContext?.state?.user;
  
  // DEBUG: Log user state for diagnosis
  strapi.log.debug('[cms-role] Checking user:', {
    userId: user?.id,
    hasRole: !!user?.role,
    roleType: user?.role?.type,
    roleName: user?.role?.name,
    fullUser: JSON.stringify(user, null, 2)
  });
  
  if (!user) {
    strapi.log.warn('[cms-role] Policy failed: No user in context');
    return false;
  }

  const role = user?.role;
  const type = typeof role?.type === 'string' ? role.type : undefined;
  const name = typeof role?.name === 'string' ? role.name : undefined;

  const normalized = (type || name || '').trim().toLowerCase();
  
  // DEBUG: Log role resolution
  strapi.log.debug('[cms-role] Role resolution:', {
    roleType: type,
    roleName: name,
    normalized: normalized
  });
  
  if (!normalized) {
    strapi.log.warn(`[cms-role] Policy failed: User ${user.id} has no role type or name`);
    return false;
  }

  // Updated allowed roles to include RBAC roles: reporter, reviewer
  // Original roles: admin, editor, author, contributor
  // Added RBAC roles: reporter, reviewer
  const allowed = new Set(['admin', 'editor', 'reviewer', 'reporter', 'author', 'contributor']);
  
  const hasAccess = allowed.has(normalized);
  
  // DEBUG: Log access decision
  strapi.log.info(`[cms-role] Access decision for user ${user.id}: role="${normalized}", allowed=${hasAccess}, allowedRoles=[${Array.from(allowed).join(', ')}]`);
  
  if (!hasAccess) {
    strapi.log.warn(`[cms-role] Policy denied: User ${user.id} with role "${normalized}" not in allowed CMS roles`);
  }
  
  return hasAccess;
};

