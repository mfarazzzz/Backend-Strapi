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
      config: {
        auth: false,
        description: 'List featured articles',
      },
    },
    {
      method: 'GET',
      path: '/articles/breaking',
      handler: 'article.breaking',
      config: {
        auth: false,
        description: 'List breaking news articles',
      },
    },
    {
      method: 'GET',
      path: '/articles/trending',
      handler: 'article.trending',
      config: {
        auth: false,
        description: 'List trending articles by views',
      },
    },
    {
      method: 'GET',
      path: '/articles/bycategory/:slug',
      handler: 'article.byCategory',
      config: {
        auth: false,
        description: 'List articles by category slug',
      },
    },
    {
      method: 'GET',
      path: '/articles/search',
      handler: 'article.search',
      config: {
        auth: false,
        description: 'Search articles',
      },
    },
    {
      method: 'GET',
      path: '/articles/slug/:slug',
      handler: 'article.findBySlug',
      config: {
        auth: false,
        description: 'Find published article by slug',
      },
    },
    {
      method: 'GET',
      path: '/articles/:id',
      handler: 'article.findOne',
      config: {
        auth: false,
        description: 'Find published article by ID',
      },
    },

    // ============================================
    // AUTHENTICATED ROUTES - Role-based access
    // ============================================

    // --- My Articles (Reporter Dashboard) ---
    // NOTE: Must be before :id routes to avoid conflict
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

    // --- Review Queue ---
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
        description: 'Admin find by slug - includes drafts',
      },
    },
    {
      method: 'GET',
      path: '/articles/admin/:id',
      handler: 'article.adminFindOne',
      config: {
        auth: {},
        policies: ['global::cms-role'],
        description: 'Admin find by ID - includes drafts',
      },
    },

    // --- Create Article ---
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

    // --- Update Article ---
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
          'global::is-owner-or-editor',
          'global::workflow-status',
        ],
        description: 'Update article - ownership enforced for reporters',
      },
    },
    {
      method: 'PATCH',
      path: '/articles/:id',
      handler: 'article.update',
      config: {
        auth: {},
        policies: [
          {
            name: 'global::role-check',
            config: { roles: ['reporter', 'reviewer', 'editor', 'admin'] },
          },
          'global::is-owner-or-editor',
          'global::workflow-status',
        ],
        description: 'Update article (PATCH) - ownership enforced for reporters',
      },
    },

    // --- Delete Article ---
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
          'global::is-owner-or-editor',
        ],
        description: 'Delete article - Editor or owner',
      },
    },

    // ============================================
    // WORKFLOW ROUTES
    // ============================================

    // --- Submit for Review ---
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

    // --- Approve Article ---
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

    // --- Reject Article ---
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

    // --- Publish Article ---
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

    // --- Unpublish Article ---
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
  ],
};
