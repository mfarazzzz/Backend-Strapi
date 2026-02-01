/**
 * workflow-status Policy
 * 
 * Validates status transitions based on user role.
 * Enforces the editorial workflow state machine:
 * - draft → review (Reporter, Reviewer, Editor)
 * - review → published (Editor only)
 * - review → draft (Reviewer, Editor - rejection)
 * - published → draft (Editor only - unpublish)
 * 
 * @strapi v5 compliant
 */

/**
 * Valid status transitions per role
 * Key: role type, Value: object mapping current status to allowed next statuses
 */
const VALID_TRANSITIONS: Record<string, Record<string, string[]>> = {
  reader: {}, // No transitions allowed
  reporter: {
    draft: ['review'],      // Can submit for review
    review: [],             // Cannot change once in review
    published: [],          // Cannot change published
  },
  reviewer: {
    draft: ['review'],      // Can move to review
    review: ['draft'],      // Can reject back to draft
    published: [],          // Cannot unpublish
  },
  editor: {
    draft: ['review', 'published'],   // Can submit for review or directly publish
    review: ['draft', 'published'],   // Can reject or approve
    published: ['draft'],             // Can unpublish
  },
};

/**
 * Human-readable descriptions for invalid transitions
 */
const TRANSITION_ERROR_MESSAGES: Record<string, string> = {
  'reporter:review': 'Reporters cannot modify articles that are in review. Please wait for a Reviewer or Editor to process your submission.',
  'reporter:published': 'Reporters cannot modify published articles. Please contact an Editor if changes are needed.',
  'reviewer:published': 'Reviewers cannot unpublish articles. Only Editors can unpublish content.',
  'reader:any': 'Readers do not have permission to change article status.',
};

export default async (
  policyContext: any,
  config: any,
  { strapi }: { strapi: any }
): Promise<boolean> => {
  const { state, request, params } = policyContext;
  const user = state?.user;

  // API tokens bypass workflow validation
  if (state?.auth?.strategy?.name === 'api-token') {
    strapi.log.debug('[workflow-status] API token detected, bypassing workflow validation');
    return true;
  }

  // Check for authenticated user
  if (!user?.id) {
    strapi.log.warn('[workflow-status] Policy failed: No authenticated user');
    throw new Error('You must be logged in to change article status');
  }

  // Extract new status from request body
  const body = request?.body;
  const newStatus = body?.data?.workflowStatus || body?.workflowStatus;

  // If no status change requested, allow the request
  if (!newStatus) {
    strapi.log.debug('[workflow-status] No status change requested, allowing request');
    return true;
  }

  // Validate the new status value
  const validStatuses = ['draft', 'review', 'published'];
  if (!validStatuses.includes(newStatus)) {
    strapi.log.warn(`[workflow-status] Invalid status value: ${newStatus}`);
    throw new Error(`Invalid status value: "${newStatus}". Valid values are: ${validStatuses.join(', ')}`);
  }

  // Get resource ID from params
  const resourceId = params?.id;
  
  // For new articles (no ID), allow any initial status based on role
  if (!resourceId) {
    const roleType = (user?.role?.type || '').toLowerCase();
    
    // Reporters can only create drafts
    if (roleType === 'reporter' && newStatus !== 'draft') {
      strapi.log.info(`[workflow-status] Reporter ${user.id} attempted to create article with status "${newStatus}"`);
      throw new Error('Reporters can only create articles in draft status. Submit for review after creation.');
    }
    
    // Reviewers cannot create articles
    if (roleType === 'reviewer') {
      strapi.log.info(`[workflow-status] Reviewer ${user.id} attempted to create article`);
      throw new Error('Reviewers cannot create articles. Only Reporters and Editors can create content.');
    }
    
    // Readers cannot create articles
    if (roleType === 'reader') {
      strapi.log.info(`[workflow-status] Reader ${user.id} attempted to create article`);
      throw new Error('Readers cannot create articles.');
    }
    
    strapi.log.debug(`[workflow-status] New article creation with status "${newStatus}" allowed for role "${roleType}"`);
    return true;
  }

  // Get current article status
  let article;
  try {
    article = await strapi.entityService.findOne('api::article.article', resourceId);
  } catch (error) {
    strapi.log.error(`[workflow-status] Error fetching article ${resourceId}:`, error);
    throw new Error('Unable to verify article status');
  }

  if (!article) {
    strapi.log.warn(`[workflow-status] Article ${resourceId} not found`);
    throw new Error('Article not found');
  }

  const currentStatus = article?.workflowStatus || 'draft';

  // If status is not changing, allow
  if (currentStatus === newStatus) {
    strapi.log.debug(`[workflow-status] Status unchanged (${currentStatus}), allowing request`);
    return true;
  }

  // Get user role
  const roleType = (user?.role?.type || '').toLowerCase();
  const roleName = (user?.role?.name || '').toLowerCase();
  const effectiveRole = roleType || roleName;

  // Get allowed transitions for this role
  const transitions = VALID_TRANSITIONS[effectiveRole] || {};
  const allowedNextStatuses = transitions[currentStatus] || [];

  const isValid = allowedNextStatuses.includes(newStatus);

  if (!isValid) {
    // Generate helpful error message
    const errorKey = `${effectiveRole}:${currentStatus}`;
    const specificError = TRANSITION_ERROR_MESSAGES[errorKey];
    
    let errorMessage: string;
    if (specificError) {
      errorMessage = specificError;
    } else if (!effectiveRole || effectiveRole === 'reader') {
      errorMessage = TRANSITION_ERROR_MESSAGES['reader:any'];
    } else {
      errorMessage = `Invalid status transition: "${currentStatus}" → "${newStatus}" is not allowed for ${effectiveRole} role. ` +
        `Allowed transitions from "${currentStatus}": ${allowedNextStatuses.length > 0 ? allowedNextStatuses.join(', ') : 'none'}`;
    }

    strapi.log.warn(
      `[workflow-status] Policy denied: User ${user.id} (${effectiveRole}) attempted invalid transition: ${currentStatus} → ${newStatus}`
    );
    
    throw new Error(errorMessage);
  }

  strapi.log.info(
    `[workflow-status] Policy passed: User ${user.id} (${effectiveRole}) transitioning article ${resourceId}: ${currentStatus} → ${newStatus}`
  );
  
  return true;
};
