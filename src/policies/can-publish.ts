/**
 * can-publish Policy
 * 
 * Verifies that the user has permission to publish/unpublish articles.
 * Only users with the Editor role can publish content.
 * 
 * @strapi v5 compliant
 */

export default async (
  policyContext: any,
  config: any,
  { strapi }: { strapi: any }
): Promise<boolean> => {
  const { state } = policyContext;
  const user = state?.user;

  // API tokens can publish
  if (state?.auth?.strategy?.name === 'api-token') {
    strapi.log.debug('[can-publish] API token detected, allowing publish action');
    return true;
  }

  // Check for authenticated user
  if (!user?.id) {
    strapi.log.warn('[can-publish] Policy failed: No authenticated user');
    throw new Error('You must be logged in to publish content');
  }

  // Resolve user role
  const role = user?.role;
  const roleType = typeof role?.type === 'string' ? role.type.toLowerCase() : '';
  const roleName = typeof role?.name === 'string' ? role.name.toLowerCase() : '';

  // Only editors can publish
  const canPublish = roleType === 'editor' || roleName === 'editor';

  if (!canPublish) {
    strapi.log.info(
      `[can-publish] Policy denied: User ${user.id} with role "${roleType || roleName}" cannot publish. Only Editors can publish content.`
    );
    throw new Error('You do not have permission to publish content. Only Editors can publish or unpublish articles.');
  }

  strapi.log.debug(`[can-publish] Policy passed: User ${user.id} with Editor role can publish`);
  return true;
};
