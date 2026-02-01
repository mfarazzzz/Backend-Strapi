/**
 * is-owner Policy
 * 
 * Verifies that the authenticated user owns the resource being accessed.
 * Checks if ctx.state.user.id === entity.createdBy.id
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

  // API tokens bypass ownership check
  if (state?.auth?.strategy?.name === 'api-token') {
    strapi.log.debug('[is-owner] API token detected, bypassing ownership check');
    return true;
  }

  // Check for authenticated user
  if (!user?.id) {
    strapi.log.warn('[is-owner] Policy failed: No authenticated user');
    throw new Error('You must be logged in to access this resource');
  }

  // Get resource ID from params
  const resourceId = params?.id;
  if (!resourceId) {
    strapi.log.warn('[is-owner] Policy failed: No resource ID provided in request params');
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
      strapi.log.warn(`[is-owner] Policy failed: Entity ${resourceId} not found in ${contentType}`);
      throw new Error('Resource not found');
    }

    // Check ownership via createdBy relation
    const createdById = entity.createdBy?.id;
    
    if (!createdById) {
      strapi.log.warn(`[is-owner] Policy failed: Entity ${resourceId} has no createdBy relation`);
      throw new Error('Unable to verify ownership - resource has no creator');
    }

    const isOwner = createdById === user.id;

    if (!isOwner) {
      strapi.log.info(
        `[is-owner] Policy denied: User ${user.id} is not owner of ${contentType}:${resourceId} (owner: ${createdById})`
      );
      throw new Error('You do not have permission to modify this resource. Only the owner can perform this action.');
    }

    strapi.log.debug(`[is-owner] Policy passed: User ${user.id} is owner of ${contentType}:${resourceId}`);
    return true;
  } catch (error) {
    // Re-throw our custom errors
    if (error instanceof Error && error.message.includes('permission')) {
      throw error;
    }
    if (error instanceof Error && error.message.includes('not found')) {
      throw error;
    }
    if (error instanceof Error && error.message.includes('logged in')) {
      throw error;
    }
    if (error instanceof Error && error.message.includes('ownership')) {
      throw error;
    }
    if (error instanceof Error && error.message.includes('required')) {
      throw error;
    }
    
    // Log unexpected errors
    strapi.log.error('[is-owner] Unexpected error checking ownership:', error);
    throw new Error('An error occurred while verifying ownership');
  }
};
