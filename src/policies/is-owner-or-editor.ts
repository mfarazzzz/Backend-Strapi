/**
 * is-owner-or-editor Policy
 * 
 * Combined ownership/editor check for update operations.
 * Allows access if:
 * - User is the owner of the resource (createdBy.id === user.id), OR
 * - User has the Editor role (can override ownership)
 * 
 * This policy is useful for update operations where Editors need to
 * modify content created by other users.
 * 
 * @strapi v5 compliant
 */

interface PolicyConfig {
  contentType?: string;
}

export default async (
  policyContext: any,
  config: PolicyConfig,
  { strapi }: { strapi: any }
): Promise<boolean> => {
  const { state, params } = policyContext;
  const user = state?.user;

  // API tokens bypass ownership/role check
  if (state?.auth?.strategy?.name === 'api-token') {
    strapi.log.debug('[is-owner-or-editor] API token detected, bypassing check');
    return true;
  }

  // Check for authenticated user
  if (!user?.id) {
    strapi.log.warn('[is-owner-or-editor] Policy failed: No authenticated user');
    throw new Error('You must be logged in to access this resource');
  }

  // Get user's role
  const role = user?.role;
  const roleType = typeof role?.type === 'string' ? role.type.toLowerCase() : '';
  const roleName = typeof role?.name === 'string' ? role.name.toLowerCase() : '';

  // Check if user is an Editor (Editors can modify any content)
  const isEditor = roleType === 'editor' || roleName === 'editor';
  
  if (isEditor) {
    strapi.log.debug(`[is-owner-or-editor] Policy passed: User ${user.id} is an Editor`);
    return true;
  }

  // If not an Editor, check ownership
  const resourceId = params?.id;
  if (!resourceId) {
    strapi.log.warn('[is-owner-or-editor] Policy failed: No resource ID provided in request params');
    throw new Error('Resource ID is required');
  }

  // Get the content type from config or default to article
  const contentType = config?.contentType || 'api::article.article';

  try {
    // Fetch the entity with createdBy relation populated
    const entity = await strapi.entityService.findOne(contentType, resourceId, {
      populate: ['createdBy'],
    });

    // Handle case where entity doesn't exist
    if (!entity) {
      strapi.log.warn(`[is-owner-or-editor] Policy failed: Entity ${resourceId} not found in ${contentType}`);
      throw new Error('Resource not found');
    }

    // Check ownership via createdBy relation
    const createdById = entity.createdBy?.id;
    
    if (!createdById) {
      strapi.log.warn(`[is-owner-or-editor] Policy failed: Entity ${resourceId} has no createdBy relation`);
      throw new Error('Unable to verify ownership - resource has no creator');
    }

    const isOwner = createdById === user.id;

    if (!isOwner) {
      const userRole = roleType || roleName || 'unknown';
      strapi.log.info(
        `[is-owner-or-editor] Policy denied: User ${user.id} (${userRole}) is not owner of ${contentType}:${resourceId} (owner: ${createdById}) and is not an Editor`
      );
      throw new Error(
        'You do not have permission to modify this resource. ' +
        'Only the content owner or an Editor can perform this action.'
      );
    }

    strapi.log.debug(
      `[is-owner-or-editor] Policy passed: User ${user.id} is owner of ${contentType}:${resourceId}`
    );
    return true;
  } catch (error) {
    // Re-throw our custom errors
    if (error instanceof Error) {
      if (
        error.message.includes('permission') ||
        error.message.includes('not found') ||
        error.message.includes('logged in') ||
        error.message.includes('ownership') ||
        error.message.includes('required')
      ) {
        throw error;
      }
    }
    
    // Log unexpected errors
    strapi.log.error('[is-owner-or-editor] Unexpected error:', error);
    throw new Error('An error occurred while verifying access permissions');
  }
};
