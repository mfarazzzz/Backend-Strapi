# App-Level RBAC Architecture for Rampur News

> **Strapi v5 | Production-Safe | Zero Data Loss**

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Core Issue Fixes](#2-core-issue-fixes)
3. [App-Level RBAC Roles](#3-app-level-rbac-roles)
4. [Policy Architecture](#4-policy-architecture)
5. [Article Content Type Enhancement](#5-article-content-type-enhancement)
6. [Route Configuration](#6-route-configuration)
7. [Authentication & API Security](#7-authentication--api-security)
8. [Role Permission Matrix](#8-role-permission-matrix)
9. [Database Verification Queries](#9-database-verification-queries)
10. [Implementation Checklist](#10-implementation-checklist)

---

## 1. Architecture Overview

### System Architecture Diagram

```
+------------------------------------------------------------------+
|                        FRONTEND - Next.js                         |
|  +--------------------+  +--------------------+  +-------------+  |
|  | Public Pages       |  | Auth Pages         |  | CMS Panel   |  |
|  | - Article List     |  | - Login            |  | - Dashboard |  |
|  | - Article Detail   |  | - Register         |  | - Editor    |  |
|  | - Category Browse  |  | - Forgot Password  |  | - Review    |  |
|  +--------------------+  +--------------------+  +-------------+  |
+------------------------------------------------------------------+
                                    |
                                    | HTTP/HTTPS
                                    | JWT Bearer Token
                                    v
+------------------------------------------------------------------+
|                      API GATEWAY LAYER                            |
|  +------------------------------------------------------------+  |
|  |                    Route Configuration                      |  |
|  |  - Public Routes: auth: false                               |  |
|  |  - Protected Routes: auth: {} + policies                    |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
                                    |
                                    v
+------------------------------------------------------------------+
|                       POLICY LAYER                                |
|  +----------------+  +----------------+  +-------------------+    |
|  | is-owner       |  | can-publish    |  | workflow-status   |    |
|  | createdBy.id   |  | role=Editor    |  | draft/review/pub  |    |
|  | === user.id    |  |                |  |                   |    |
|  +----------------+  +----------------+  +-------------------+    |
|                                                                   |
|  +----------------+  +----------------+  +-------------------+    |
|  | is-reader      |  | is-reporter    |  | is-reviewer       |    |
|  | role=Reader    |  | role=Reporter  |  | role=Reviewer     |    |
|  +----------------+  +----------------+  +-------------------+    |
+------------------------------------------------------------------+
                                    |
                                    v
+------------------------------------------------------------------+
|                    STRAPI v5 BACKEND                              |
|  +------------------------------------------------------------+  |
|  |              Users-Permissions Plugin                       |  |
|  |  +--------+  +----------+  +----------+  +--------+        |  |
|  |  | Reader |  | Reporter |  | Reviewer |  | Editor |        |  |
|  |  +--------+  +----------+  +----------+  +--------+        |  |
|  +------------------------------------------------------------+  |
|                                                                   |
|  +------------------------------------------------------------+  |
|  |                   Content Types                             |  |
|  |  +----------+  +----------+  +------+  +------+  +------+  |  |
|  |  | Article  |  | Category |  | Tag  |  | Author|  | Page |  |  |
|  |  | +status  |  |          |  |      |  |       |  |      |  |  |
|  |  +----------+  +----------+  +------+  +------+  +------+  |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
                                    |
                                    v
+------------------------------------------------------------------+
|                      DATABASE LAYER                               |
|  +------------------------------------------------------------+  |
|  |                    PostgreSQL / SQLite                      |  |
|  |  - up_users                                                 |  |
|  |  - up_roles                                                 |  |
|  |  - up_permissions                                           |  |
|  |  - up_permissions_role_lnk                                  |  |
|  |  - articles                                                 |  |
|  +------------------------------------------------------------+  |
+------------------------------------------------------------------+
```

### Workflow State Machine

```
                    +-------------+
                    |   CREATE    |
                    +------+------+
                           |
                           v
+----------+         +-----+-----+         +----------+
|          |         |           |         |          |
| REJECTED +<--------+   DRAFT   +-------->+ DELETED  |
|          |         |           |         |          |
+----+-----+         +-----+-----+         +----------+
     |                     |
     |                     | Reporter submits
     |                     v
     |               +-----+-----+
     |               |           |
     +-------------->+  REVIEW   |
       Reviewer      |           |
       rejects       +-----+-----+
                           |
                           | Editor approves
                           v
                     +-----+-----+
                     |           |
                     | PUBLISHED |
                     |           |
                     +-----+-----+
                           |
                           | Editor unpublishes
                           v
                     +-----+-----+
                     |           |
                     |   DRAFT   |
                     |           |
                     +-----------+
```

---

## 2. Core Issue Fixes

### 2.1 Problem: Policy Failed Error

**Root Cause:** The `users-permissions` plugin is not properly configured in [`config/plugins.ts`](Backend-Strapi/config/plugins.ts:1).

**Solution:** Add users-permissions plugin configuration:

```typescript
// config/plugins.ts
export default ({ env }) => ({
  // ... existing config ...
  
  'users-permissions': {
    enabled: true,
    config: {
      jwt: {
        expiresIn: '7d',
      },
      register: {
        allowedFields: ['username', 'email', 'password'],
      },
    },
  },
});
```

### 2.2 Problem: No Relations Available in Content Manager

**Root Cause:** The `plugin::users-permissions.role` has `content-manager.visible: false` by default in Strapi v5.

**Solution:** Create a plugin extension to make roles visible:

```typescript
// src/extensions/users-permissions/strapi-server.ts
export default (plugin) => {
  // Make role visible in content manager
  plugin.contentTypes.role.pluginOptions = {
    ...plugin.contentTypes.role.pluginOptions,
    'content-manager': {
      visible: true,
    },
    'content-type-builder': {
      visible: true,
    },
  };
  
  return plugin;
};
```

### 2.3 Role Seeding Strategy (Without Database Reset)

The existing [`src/index.ts`](Backend-Strapi/src/index.ts:101) already has role seeding via [`ensureRole()`](Backend-Strapi/src/index.ts:101). Extend this pattern for new roles:

```typescript
// In src/index.ts bootstrap function - ADD these roles
await ensureRole('reader', 'Reader', 'Can read published articles only.');
await ensureRole('reporter', 'Reporter', 'Can create and edit own articles.');
await ensureRole('reviewer', 'Reviewer', 'Can review and approve articles for publishing.');
await ensureRole('editor', 'Editor', 'Full editorial control - publish, unpublish, edit all.');
```

**Key Principle:** The [`ensureRole()`](Backend-Strapi/src/index.ts:101) function checks for existing roles before creating, ensuring idempotent operations with zero data loss.

---

## 3. App-Level RBAC Roles

### 3.1 Role Definitions

| Role | Type | Description | Primary Use Case |
|------|------|-------------|------------------|
| **Reader** | `reader` | Public/registered user | Read published content |
| **Reporter** | `reporter` | Content creator | Create and edit own articles |
| **Reviewer** | `reviewer` | Content moderator | Review and approve content |
| **Editor** | `editor` | Senior editor | Full editorial control |

### 3.2 Role: Reader

```typescript
{
  type: 'reader',
  name: 'Reader',
  description: 'Can read published articles only.',
  permissions: {
    'api::article.article': {
      find: true,      // List published articles
      findOne: true,   // View single published article
      create: false,
      update: false,
      delete: false,
    },
    'api::category.category': {
      find: true,
      findOne: true,
    },
    'api::tag.tag': {
      find: true,
      findOne: true,
    },
  },
  restrictions: {
    articleStatus: ['published'],  // Can only see published
    drafts: false,
    review: false,
  }
}
```

### 3.3 Role: Reporter

```typescript
{
  type: 'reporter',
  name: 'Reporter',
  description: 'Can create and edit own articles.',
  permissions: {
    'api::article.article': {
      find: true,       // List own articles
      findOne: true,    // View own articles
      create: true,     // Create new articles
      update: true,     // Edit own articles ONLY
      delete: false,    // Cannot delete
    },
  },
  restrictions: {
    ownership: true,           // Can only edit own content
    canPublish: false,         // Cannot publish
    canSetStatus: ['draft'],   // Can only set to draft
    canSubmitForReview: true,  // Can submit to review queue
  }
}
```

### 3.4 Role: Reviewer

```typescript
{
  type: 'reviewer',
  name: 'Reviewer',
  description: 'Can review and approve articles for publishing.',
  permissions: {
    'api::article.article': {
      find: true,       // List all articles including drafts
      findOne: true,    // View any article
      create: false,    // Cannot create
      update: true,     // Can update status field only
      delete: false,    // Cannot delete
    },
  },
  restrictions: {
    canReadDrafts: true,
    canReadReview: true,
    canSetStatus: ['draft', 'review'],  // Can move to review or back to draft
    canPublish: false,                   // Cannot publish
    editableFields: ['workflowStatus', 'reviewNotes'],  // Limited field access
  }
}
```

### 3.5 Role: Editor

```typescript
{
  type: 'editor',
  name: 'Editor',
  description: 'Full editorial control - publish, unpublish, edit all.',
  permissions: {
    'api::article.article': {
      find: true,
      findOne: true,
      create: true,
      update: true,
      delete: true,
    },
    'api::category.category': {
      find: true,
      findOne: true,
      create: true,
      update: true,
      delete: true,
    },
    'api::tag.tag': {
      find: true,
      findOne: true,
      create: true,
      update: true,
      delete: true,
    },
  },
  restrictions: {
    ownership: false,          // Can edit any content
    canPublish: true,          // Can publish
    canUnpublish: true,        // Can unpublish
    canSetStatus: ['draft', 'review', 'published'],
    canOverrideOwnership: true,
  }
}
```

---

## 4. Policy Architecture

### 4.1 Policy File Structure

```
src/policies/
├── is-owner.ts              # Ownership verification
├── can-publish.ts           # Publish permission check
├── workflow-status.ts       # Status transition validation
├── is-authenticated.ts      # Basic auth check
├── role-check.ts            # Generic role verification
├── cms-role.ts              # Existing - keep for backward compat
└── admin-only.ts            # Existing - keep for admin routes
```

### 4.2 Policy: is-owner

**Purpose:** Verify that the authenticated user owns the resource.

```typescript
// src/policies/is-owner.ts
export default async (policyContext: any, config: any, { strapi }: any) => {
  const { state, params } = policyContext;
  const user = state?.user;
  
  // API tokens bypass ownership check
  if (state?.auth?.strategy?.name === 'api-token') {
    return true;
  }
  
  if (!user?.id) {
    strapi.log.warn('[is-owner] No authenticated user');
    return false;
  }
  
  const resourceId = params?.id;
  if (!resourceId) {
    strapi.log.warn('[is-owner] No resource ID provided');
    return false;
  }
  
  // Get the content type from config or infer from route
  const contentType = config?.contentType || 'api::article.article';
  
  try {
    const entity = await strapi.entityService.findOne(contentType, resourceId, {
      populate: ['createdBy'],
    });
    
    if (!entity) {
      strapi.log.warn(`[is-owner] Entity ${resourceId} not found`);
      return false;
    }
    
    // Check ownership via createdBy relation
    const createdById = entity.createdBy?.id;
    const isOwner = createdById === user.id;
    
    if (!isOwner) {
      strapi.log.info(`[is-owner] User ${user.id} is not owner of ${resourceId}`);
    }
    
    return isOwner;
  } catch (error) {
    strapi.log.error('[is-owner] Error checking ownership:', error);
    return false;
  }
};
```

### 4.3 Policy: can-publish

**Purpose:** Verify that the user has permission to publish/unpublish articles.

```typescript
// src/policies/can-publish.ts
export default async (policyContext: any, config: any, { strapi }: any) => {
  const { state } = policyContext;
  const user = state?.user;
  
  // API tokens can publish
  if (state?.auth?.strategy?.name === 'api-token') {
    return true;
  }
  
  if (!user?.id) {
    strapi.log.warn('[can-publish] No authenticated user');
    return false;
  }
  
  // Resolve user role
  const role = user?.role;
  const roleType = typeof role?.type === 'string' ? role.type.toLowerCase() : '';
  const roleName = typeof role?.name === 'string' ? role.name.toLowerCase() : '';
  
  // Only editors can publish
  const canPublish = roleType === 'editor' || roleName === 'editor';
  
  if (!canPublish) {
    strapi.log.info(`[can-publish] User ${user.id} with role ${roleType || roleName} cannot publish`);
  }
  
  return canPublish;
};
```

### 4.4 Policy: workflow-status

**Purpose:** Validate status transitions based on user role.

```typescript
// src/policies/workflow-status.ts
const VALID_TRANSITIONS: Record<string, Record<string, string[]>> = {
  reader: {},  // No transitions allowed
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
    draft: ['review', 'published'],
    review: ['draft', 'published'],
    published: ['draft'],   // Can unpublish
  },
};

export default async (policyContext: any, config: any, { strapi }: any) => {
  const { state, request, params } = policyContext;
  const user = state?.user;
  
  // API tokens bypass
  if (state?.auth?.strategy?.name === 'api-token') {
    return true;
  }
  
  if (!user?.id) {
    return false;
  }
  
  const body = request?.body;
  const newStatus = body?.data?.workflowStatus || body?.workflowStatus;
  
  // If no status change requested, allow
  if (!newStatus) {
    return true;
  }
  
  const resourceId = params?.id;
  if (!resourceId) {
    return true;  // New article, allow any initial status
  }
  
  // Get current article status
  const article = await strapi.entityService.findOne('api::article.article', resourceId);
  const currentStatus = article?.workflowStatus || 'draft';
  
  // Get user role
  const roleType = (user?.role?.type || '').toLowerCase();
  const transitions = VALID_TRANSITIONS[roleType] || {};
  const allowedNextStatuses = transitions[currentStatus] || [];
  
  const isValid = allowedNextStatuses.includes(newStatus);
  
  if (!isValid) {
    strapi.log.warn(
      `[workflow-status] Invalid transition: ${currentStatus} -> ${newStatus} for role ${roleType}`
    );
  }
  
  return isValid;
};
```

### 4.5 Policy: role-check

**Purpose:** Generic role verification policy with configurable allowed roles.

```typescript
// src/policies/role-check.ts
export default async (policyContext: any, config: any, { strapi }: any) => {
  const { state } = policyContext;
  const user = state?.user;
  
  // API tokens bypass
  if (state?.auth?.strategy?.name === 'api-token') {
    return true;
  }
  
  if (!user?.id) {
    strapi.log.warn('[role-check] No authenticated user');
    return false;
  }
  
  // Get allowed roles from config
  const allowedRoles: string[] = config?.roles || [];
  if (allowedRoles.length === 0) {
    strapi.log.warn('[role-check] No roles configured');
    return false;
  }
  
  const roleType = (user?.role?.type || '').toLowerCase();
  const roleName = (user?.role?.name || '').toLowerCase();
  
  const normalizedAllowed = new Set(allowedRoles.map(r => r.toLowerCase()));
  const hasRole = normalizedAllowed.has(roleType) || normalizedAllowed.has(roleName);
  
  if (!hasRole) {
    strapi.log.info(
      `[role-check] User ${user.id} with role ${roleType || roleName} not in allowed: ${allowedRoles.join(', ')}`
    );
  }
  
  return hasRole;
};
```

---

## 5. Article Content Type Enhancement

### 5.1 Current Schema Analysis

The existing [`article/schema.json`](Backend-Strapi/src/api/article/content-types/article/schema.json:1) uses Strapi's built-in `draftAndPublish: true` which provides `publishedAt` for publication state.

### 5.2 Enhanced Schema with Workflow Status

Add a `workflowStatus` field for editorial workflow:

```json
{
  "kind": "collectionType",
  "collectionName": "articles",
  "info": {
    "singularName": "article",
    "pluralName": "articles",
    "displayName": "Article"
  },
  "options": {
    "draftAndPublish": true
  },
  "attributes": {
    "workflowStatus": {
      "type": "enumeration",
      "enum": ["draft", "review", "published"],
      "default": "draft",
      "required": true
    },
    "reviewNotes": {
      "type": "text",
      "maxLength": 1000
    },
    "reviewedBy": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "plugin::users-permissions.user"
    },
    "reviewedAt": {
      "type": "datetime"
    },
    "submittedForReviewAt": {
      "type": "datetime"
    }
  }
}
```

### 5.3 Status Field Semantics

| Status | `workflowStatus` | `publishedAt` | Visibility |
|--------|------------------|---------------|------------|
| Draft | `draft` | `null` | Reporter, Reviewer, Editor |
| In Review | `review` | `null` | Reviewer, Editor |
| Published | `published` | `<timestamp>` | Everyone |
| Unpublished | `draft` | `null` | Reporter (own), Reviewer, Editor |

### 5.4 Migration Strategy

**Non-destructive migration** - add fields without modifying existing data:

```typescript
// database/migrations/add-workflow-status.ts
export async function up(knex) {
  // Check if column exists
  const hasColumn = await knex.schema.hasColumn('articles', 'workflow_status');
  
  if (!hasColumn) {
    await knex.schema.alterTable('articles', (table) => {
      table.enum('workflow_status', ['draft', 'review', 'published']).defaultTo('draft');
      table.text('review_notes');
      table.integer('reviewed_by').unsigned().references('id').inTable('up_users');
      table.datetime('reviewed_at');
      table.datetime('submitted_for_review_at');
    });
    
    // Set existing published articles to 'published' status
    await knex('articles')
      .whereNotNull('published_at')
      .update({ workflow_status: 'published' });
  }
}

export async function down(knex) {
  // Reversible migration
  await knex.schema.alterTable('articles', (table) => {
    table.dropColumn('workflow_status');
    table.dropColumn('review_notes');
    table.dropColumn('reviewed_by');
    table.dropColumn('reviewed_at');
    table.dropColumn('submitted_for_review_at');
  });
}
```

---

## 6. Route Configuration

### 6.1 Current Route Analysis

The existing [`article/routes/article.ts`](Backend-Strapi/src/api/article/routes/article.ts:1) has:
- Public routes with `auth: false`
- Admin routes with `auth: {}` and `policies: ['global::cms-role']`

### 6.2 Enhanced Route Configuration

```typescript
// src/api/article/routes/article.ts
export default {
  routes: [
    // ============================================
    // PUBLIC ROUTES - No authentication required
    // ============================================
    {
      method: 'GET',
      path: '/articles',
      handler: 'article.find',
      config: {
        auth: false,
        description: 'List published articles',
      },
    },
    {
      method: 'GET',
      path: '/articles/featured',
      handler: 'article.featured',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/articles/breaking',
      handler: 'article.breaking',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/articles/trending',
      handler: 'article.trending',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/articles/bycategory/:slug',
      handler: 'article.byCategory',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/articles/search',
      handler: 'article.search',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/articles/slug/:slug',
      handler: 'article.findBySlug',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/articles/:id',
      handler: 'article.findOne',
      config: { auth: false },
    },

    // ============================================
    // AUTHENTICATED ROUTES - Role-based access
    // ============================================
    
    // --- Reporter Routes ---
    {
      method: 'POST',
      path: '/articles',
      handler: 'article.create',
      config: {
        auth: {},
        policies: [
          {
            name: 'global::role-check',
            config: { roles: ['reporter', 'reviewer', 'editor', 'admin'] },
          },
        ],
        description: 'Create new article - Reporter+',
      },
    },
    {
      method: 'PUT',
      path: '/articles/:id',
      handler: 'article.update',
      config: {
        auth: {},
        policies: [
          {
            name: 'global::role-check',
            config: { roles: ['reporter', 'reviewer', 'editor', 'admin'] },
          },
          'global::is-owner-or-editor',  // Reporter can only edit own
          'global::workflow-status',      // Validate status transitions
        ],
        description: 'Update article - ownership enforced for reporters',
      },
    },
    {
      method: 'DELETE',
      path: '/articles/:id',
      handler: 'article.delete',
      config: {
        auth: {},
        policies: [
          {
            name: 'global::role-check',
            config: { roles: ['editor', 'admin'] },
          },
        ],
        description: 'Delete article - Editor only',
      },
    },

    // --- Review Routes ---
    {
      method: 'GET',
      path: '/articles/review-queue',
      handler: 'article.reviewQueue',
      config: {
        auth: {},
        policies: [
          {
            name: 'global::role-check',
            config: { roles: ['reviewer', 'editor', 'admin'] },
          },
        ],
        description: 'List articles pending review',
      },
    },
    {
      method: 'POST',
      path: '/articles/:id/submit-for-review',
      handler: 'article.submitForReview',
      config: {
        auth: {},
        policies: [
          {
            name: 'global::role-check',
            config: { roles: ['reporter', 'editor', 'admin'] },
          },
          'global::is-owner-or-editor',
        ],
        description: 'Submit article for review',
      },
    },
    {
      method: 'POST',
      path: '/articles/:id/approve',
      handler: 'article.approve',
      config: {
        auth: {},
        policies: [
          {
            name: 'global::role-check',
            config: { roles: ['reviewer', 'editor', 'admin'] },
          },
        ],
        description: 'Approve article - move to review status',
      },
    },
    {
      method: 'POST',
      path: '/articles/:id/reject',
      handler: 'article.reject',
      config: {
        auth: {},
        policies: [
          {
            name: 'global::role-check',
            config: { roles: ['reviewer', 'editor', 'admin'] },
          },
        ],
        description: 'Reject article - return to draft',
      },
    },

    // --- Publish Routes ---
    {
      method: 'POST',
      path: '/articles/:id/publish',
      handler: 'article.publish',
      config: {
        auth: {},
        policies: ['global::can-publish'],
        description: 'Publish article - Editor only',
      },
    },
    {
      method: 'POST',
      path: '/articles/:id/unpublish',
      handler: 'article.unpublish',
      config: {
        auth: {},
        policies: ['global::can-publish'],
        description: 'Unpublish article - Editor only',
      },
    },

    // --- Admin/CMS Routes ---
    {
      method: 'GET',
      path: '/articles/admin',
      handler: 'article.adminFind',
      config: {
        auth: {},
        policies: ['global::cms-role'],
        description: 'Admin list - includes drafts',
      },
    },
    {
      method: 'GET',
      path: '/articles/admin/slug/:slug',
      handler: 'article.adminFindBySlug',
      config: {
        auth: {},
        policies: ['global::cms-role'],
      },
    },
    {
      method: 'GET',
      path: '/articles/admin/:id',
      handler: 'article.adminFindOne',
      config: {
        auth: {},
        policies: ['global::cms-role'],
      },
    },

    // --- My Articles (Reporter Dashboard) ---
    {
      method: 'GET',
      path: '/articles/my',
      handler: 'article.myArticles',
      config: {
        auth: {},
        policies: [
          {
            name: 'global::role-check',
            config: { roles: ['reporter', 'reviewer', 'editor', 'admin'] },
          },
        ],
        description: 'List current user articles',
      },
    },
  ],
};
```

### 6.3 Combined Policy: is-owner-or-editor

```typescript
// src/policies/is-owner-or-editor.ts
export default async (policyContext: any, config: any, { strapi }: any) => {
  const { state, params } = policyContext;
  const user = state?.user;
  
  // API tokens bypass
  if (state?.auth?.strategy?.name === 'api-token') {
    return true;
  }
  
  if (!user?.id) {
    return false;
  }
  
  // Editors can edit anything
  const roleType = (user?.role?.type || '').toLowerCase();
  const roleName = (user?.role?.name || '').toLowerCase();
  
  if (roleType === 'editor' || roleName === 'editor' ||
      roleType === 'admin' || roleName === 'admin') {
    return true;
  }
  
  // For reporters/reviewers, check ownership
  const resourceId = params?.id;
  if (!resourceId) {
    return true;  // New resource
  }
  
  const contentType = config?.contentType || 'api::article.article';
  
  try {
    const entity = await strapi.entityService.findOne(contentType, resourceId, {
      populate: ['createdBy'],
    });
    
    if (!entity) {
      return false;
    }
    
    return entity.createdBy?.id === user.id;
  } catch (error) {
    strapi.log.error('[is-owner-or-editor] Error:', error);
    return false;
  }
};
```

---

## 7. Authentication & API Security

### 7.1 JWT Authentication Flow

```
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
|  Next.js Client  +---->+  /api/auth/local +---->+  Strapi Backend  |
|                  |     |                  |     |                  |
+--------+---------+     +--------+---------+     +--------+---------+
         |                        |                        |
         |  1. POST credentials   |                        |
         +----------------------->+                        |
         |                        |  2. Validate user      |
         |                        +----------------------->+
         |                        |                        |
         |                        |  3. Generate JWT       |
         |                        +<-----------------------+
         |  4. Return JWT + user  |                        |
         +<-----------------------+                        |
         |                        |                        |
         |  5. Store JWT          |                        |
         |  (httpOnly cookie or   |                        |
         |   localStorage)        |                        |
         |                        |                        |
         |  6. Subsequent requests|                        |
         |  Authorization: Bearer |                        |
         +----------------------->+----------------------->+
         |                        |                        |
```

### 7.2 Plugin Configuration for JWT

```typescript
// config/plugins.ts
export default ({ env }) => ({
  // ... existing config ...
  
  'users-permissions': {
    enabled: true,
    config: {
      jwt: {
        expiresIn: env('JWT_EXPIRES_IN', '7d'),
        secret: env('JWT_SECRET'),
      },
      register: {
        allowedFields: ['username', 'email', 'password'],
      },
      ratelimit: {
        interval: 60000,  // 1 minute
        max: 10,          // 10 requests per minute for auth endpoints
      },
    },
  },
});
```

### 7.3 Public vs Protected Routes Matrix

| Endpoint Pattern | Auth | Roles | Description |
|------------------|------|-------|-------------|
| `GET /articles` | Public | - | List published |
| `GET /articles/:id` | Public | - | View published |
| `GET /articles/slug/:slug` | Public | - | View by slug |
| `GET /articles/featured` | Public | - | Featured list |
| `GET /articles/breaking` | Public | - | Breaking news |
| `GET /articles/trending` | Public | - | Trending list |
| `GET /articles/bycategory/:slug` | Public | - | By category |
| `GET /articles/search` | Public | - | Search |
| `POST /articles` | JWT | Reporter+ | Create |
| `PUT /articles/:id` | JWT | Reporter+ | Update (ownership) |
| `DELETE /articles/:id` | JWT | Editor | Delete |
| `GET /articles/my` | JWT | Reporter+ | Own articles |
| `GET /articles/review-queue` | JWT | Reviewer+ | Review queue |
| `POST /articles/:id/submit-for-review` | JWT | Reporter+ | Submit |
| `POST /articles/:id/approve` | JWT | Reviewer+ | Approve |
| `POST /articles/:id/reject` | JWT | Reviewer+ | Reject |
| `POST /articles/:id/publish` | JWT | Editor | Publish |
| `POST /articles/:id/unpublish` | JWT | Editor | Unpublish |
| `GET /articles/admin` | JWT | CMS Role | Admin list |
| `GET /articles/admin/:id` | JWT | CMS Role | Admin view |

### 7.4 Token-Based Auth for Next.js Frontend

```typescript
// Frontend: src/services/auth.ts
interface AuthResponse {
  jwt: string;
  user: {
    id: number;
    username: string;
    email: string;
    role: {
      id: number;
      name: string;
      type: string;
    };
  };
}

export async function login(identifier: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${STRAPI_URL}/api/auth/local`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  
  if (!response.ok) {
    throw new Error('Authentication failed');
  }
  
  return response.json();
}

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getStoredToken();  // From cookie or localStorage
  
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': token ? `Bearer ${token}` : '',
    },
  });
}
```

### 7.5 Security Headers & CORS

```typescript
// config/middlewares.ts
export default [
  'strapi::logger',
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:'],
          'img-src': ["'self'", 'data:', 'blob:', 'https:'],
          'media-src': ["'self'", 'data:', 'blob:', 'https:'],
        },
      },
    },
  },
  {
    name: 'strapi::cors',
    config: {
      enabled: true,
      origin: [
        'http://localhost:3000',
        'https://rampurnews.com',
        'https://www.rampurnews.com',
      ],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
      keepHeaderOnError: true,
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
```

---

## 8. Role Permission Matrix

### 8.1 Article Permissions

| Action | Reader | Reporter | Reviewer | Editor |
|--------|--------|----------|----------|--------|
| **Read published** | ✅ | ✅ | ✅ | ✅ |
| **Read drafts** | ❌ | Own only | ✅ | ✅ |
| **Read in review** | ❌ | Own only | ✅ | ✅ |
| **Create** | ❌ | ✅ | ❌ | ✅ |
| **Edit own** | ❌ | ✅ | ❌ | ✅ |
| **Edit others** | ❌ | ❌ | Status only | ✅ |
| **Delete** | ❌ | ❌ | ❌ | ✅ |
| **Submit for review** | ❌ | ✅ | ❌ | ✅ |
| **Approve/Reject** | ❌ | ❌ | ✅ | ✅ |
| **Publish** | ❌ | ❌ | ❌ | ✅ |
| **Unpublish** | ❌ | ❌ | ❌ | ✅ |

### 8.2 Category & Tag Permissions

| Action | Reader | Reporter | Reviewer | Editor |
|--------|--------|----------|----------|--------|
| **Read** | ✅ | ✅ | ✅ | ✅ |
| **Create** | ❌ | ❌ | ❌ | ✅ |
| **Update** | ❌ | ❌ | ❌ | ✅ |
| **Delete** | ❌ | ❌ | ❌ | ✅ |

### 8.3 User Management Permissions

| Action | Reader | Reporter | Reviewer | Editor |
|--------|--------|----------|----------|--------|
| **View own profile** | ✅ | ✅ | ✅ | ✅ |
| **Edit own profile** | ✅ | ✅ | ✅ | ✅ |
| **View other users** | ❌ | ❌ | ❌ | ✅ |
| **Manage users** | ❌ | ❌ | ❌ | ❌* |

*User management is handled via Strapi Admin panel, not app-level RBAC.

### 8.4 Status Transition Matrix

| From \ To | draft | review | published |
|-----------|-------|--------|-----------|
| **draft** | - | Reporter, Reviewer, Editor | Editor |
| **review** | Reviewer, Editor | - | Editor |
| **published** | Editor | ❌ | - |

---

## 9. Database Verification Queries

### 9.1 Verify Roles Exist

```sql
-- List all users-permissions roles
SELECT id, name, type, description, created_at
FROM up_roles
ORDER BY id;

-- Expected output should include:
-- reader, reporter, reviewer, editor
```

### 9.2 Verify Role Permissions

```sql
-- Count permissions per role
SELECT 
  r.name AS role_name,
  r.type AS role_type,
  COUNT(lnk.permission_id) AS permission_count
FROM up_roles r
LEFT JOIN up_permissions_role_lnk lnk ON r.id = lnk.role_id
GROUP BY r.id, r.name, r.type
ORDER BY r.id;
```

### 9.3 Verify User Role Assignments

```sql
-- List users with their roles
SELECT 
  u.id,
  u.username,
  u.email,
  r.name AS role_name,
  r.type AS role_type
FROM up_users u
LEFT JOIN up_roles r ON u.role = r.id
ORDER BY u.id;
```

### 9.4 Verify Article Workflow Status Distribution

```sql
-- Count articles by workflow status
SELECT 
  workflow_status,
  COUNT(*) AS count,
  CASE 
    WHEN published_at IS NOT NULL THEN 'published'
    ELSE 'unpublished'
  END AS publication_state
FROM articles
GROUP BY workflow_status, 
  CASE WHEN published_at IS NOT NULL THEN 'published' ELSE 'unpublished' END
ORDER BY workflow_status;
```

### 9.5 Verify Permission Actions for Article API

```sql
-- List all article-related permissions
SELECT id, action, created_at
FROM up_permissions
WHERE action LIKE 'api::article.article.%'
ORDER BY action;
```

### 9.6 Verify Role-Permission Links for Specific Role

```sql
-- Get all permissions for 'reporter' role
SELECT 
  p.action,
  r.name AS role_name
FROM up_permissions p
JOIN up_permissions_role_lnk lnk ON p.id = lnk.permission_id
JOIN up_roles r ON lnk.role_id = r.id
WHERE r.type = 'reporter'
ORDER BY p.action;
```

---

## 10. Implementation Checklist

### Phase 1: Core Infrastructure

- [ ] **1.1** Update [`config/plugins.ts`](Backend-Strapi/config/plugins.ts:1) with users-permissions configuration
- [ ] **1.2** Create plugin extension at `src/extensions/users-permissions/strapi-server.ts`
- [ ] **1.3** Update [`src/index.ts`](Backend-Strapi/src/index.ts:111) bootstrap to add new roles (reader, reporter, reviewer, editor)
- [ ] **1.4** Verify roles are created via database query

### Phase 2: Schema Enhancement

- [ ] **2.1** Add `workflowStatus` enum field to [`article/schema.json`](Backend-Strapi/src/api/article/content-types/article/schema.json:1)
- [ ] **2.2** Add `reviewNotes`, `reviewedBy`, `reviewedAt`, `submittedForReviewAt` fields
- [ ] **2.3** Create database migration for existing articles
- [ ] **2.4** Run migration and verify data integrity

### Phase 3: Policy Implementation

- [ ] **3.1** Create `src/policies/is-owner.ts`
- [ ] **3.2** Create `src/policies/can-publish.ts`
- [ ] **3.3** Create `src/policies/workflow-status.ts`
- [ ] **3.4** Create `src/policies/role-check.ts`
- [ ] **3.5** Create `src/policies/is-owner-or-editor.ts`
- [ ] **3.6** Update existing [`cms-role.ts`](Backend-Strapi/src/policies/cms-role.ts:1) if needed

### Phase 4: Route Configuration

- [ ] **4.1** Update [`article/routes/article.ts`](Backend-Strapi/src/api/article/routes/article.ts:1) with new routes
- [ ] **4.2** Add review queue routes
- [ ] **4.3** Add publish/unpublish routes
- [ ] **4.4** Add my-articles route
- [ ] **4.5** Configure policy attachments for each route

### Phase 5: Controller Implementation

- [ ] **5.1** Add `reviewQueue` handler to article controller
- [ ] **5.2** Add `submitForReview` handler
- [ ] **5.3** Add `approve` handler
- [ ] **5.4** Add `reject` handler
- [ ] **5.5** Add `publish` handler
- [ ] **5.6** Add `unpublish` handler
- [ ] **5.7** Add `myArticles` handler
- [ ] **5.8** Update existing handlers to respect workflow status

### Phase 6: Permission Seeding

- [ ] **6.1** Create permission seeding script for Reader role
- [ ] **6.2** Create permission seeding script for Reporter role
- [ ] **6.3** Create permission seeding script for Reviewer role
- [ ] **6.4** Create permission seeding script for Editor role
- [ ] **6.5** Verify permissions via database queries

### Phase 7: Security Hardening

- [ ] **7.1** Update CORS configuration for production domains
- [ ] **7.2** Configure rate limiting for auth endpoints
- [ ] **7.3** Add structured logging for policy failures
- [ ] **7.4** Implement JWT refresh token strategy (optional)

### Phase 8: Testing & Validation

- [ ] **8.1** Test Reader role - can only read published
- [ ] **8.2** Test Reporter role - create, edit own, submit for review
- [ ] **8.3** Test Reviewer role - approve/reject, cannot publish
- [ ] **8.4** Test Editor role - full access including publish
- [ ] **8.5** Test API token bypass for all policies
- [ ] **8.6** Test invalid status transitions are blocked
- [ ] **8.7** Test ownership enforcement for reporters

### Phase 9: Documentation & Deployment

- [ ] **9.1** Update API documentation with new endpoints
- [ ] **9.2** Create user guide for each role
- [ ] **9.3** Document environment variables
- [ ] **9.4** Create deployment checklist
- [ ] **9.5** Backup database before production deployment

---

## Appendix A: Environment Variables

```bash
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=7d

# Bootstrap Admin (for initial setup)
BOOTSTRAP_ADMIN_EMAIL=admin@rampurnews.com
BOOTSTRAP_ADMIN_PASSWORD=secure-password-here

# CORS Origins
CORS_ORIGINS=http://localhost:3000,https://rampurnews.com

# Rate Limiting
RATE_LIMIT_INTERVAL=60000
RATE_LIMIT_MAX=10
```

## Appendix B: Error Codes

| Code | Message | HTTP Status | Resolution |
|------|---------|-------------|------------|
| `POLICY_FAILED` | Policy check failed | 403 | Check user role and permissions |
| `OWNERSHIP_REQUIRED` | User does not own this resource | 403 | Only owner or editor can modify |
| `INVALID_STATUS_TRANSITION` | Cannot transition from X to Y | 400 | Check allowed transitions for role |
| `PUBLISH_NOT_ALLOWED` | User cannot publish articles | 403 | Only editors can publish |
| `AUTHENTICATION_REQUIRED` | No valid authentication | 401 | Provide valid JWT token |
| `ROLE_NOT_ALLOWED` | User role not permitted | 403 | Check role requirements for endpoint |

---

*Document Version: 1.0*
*Last Updated: 2026-02-01*
*Strapi Version: v5.x*
