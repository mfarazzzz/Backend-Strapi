export default ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  url: env('PUBLIC_URL', env('STRAPI_PUBLIC_URL', undefined)),
  proxy: env.bool('PROXY', true),
  app: {
    keys: env.array('APP_KEYS'),
  },
  admin: {
    serveAdminPanel: env.bool('SERVE_ADMIN', true),
  },
});
