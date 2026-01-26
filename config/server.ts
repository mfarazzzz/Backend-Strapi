export default ({ env }) => {
  const normalizeUrl = (value: unknown) => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim().replace(/\/+$/, '');
    return trimmed ? trimmed : undefined;
  };

  const url = normalizeUrl(env('PUBLIC_URL')) ?? normalizeUrl(env('STRAPI_PUBLIC_URL'));

  return {
    host: env('HOST', '0.0.0.0'),
    port: env.int('PORT', 1337),
    proxy: env.bool('PROXY', env('NODE_ENV') === 'production'),
    url,
    app: {
      keys: env.array('APP_KEYS'),
    },
    admin: {
      url: env('ADMIN_URL', '/admin'),
      serveAdminPanel: env.bool('SERVE_ADMIN_PANEL', true),
    },
  };
};
