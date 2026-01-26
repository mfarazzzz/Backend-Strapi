export default {
  routes: [
    {
      method: 'GET',
      path: '/tags',
      handler: 'tag.find',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/tags/slug/:slug',
      handler: 'tag.findBySlug',
      config: { auth: false },
    },
    {
      method: 'GET',
      path: '/tags/:id',
      handler: 'tag.findOne',
      config: { auth: false },
    },
    {
      method: 'POST',
      path: '/tags',
      handler: 'tag.create',
      config: { auth: false, policies: ['global::cms-role'] },
    },
    {
      method: 'PATCH',
      path: '/tags/:id',
      handler: 'tag.update',
      config: { auth: false, policies: ['global::cms-role'] },
    },
    {
      method: 'DELETE',
      path: '/tags/:id',
      handler: 'tag.delete',
      config: { auth: false, policies: ['global::cms-role'] },
    },
  ],
};
