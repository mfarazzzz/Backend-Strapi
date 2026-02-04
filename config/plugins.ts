export default ({ env }) => ({
  upload: {
    config: {
      sizeLimit: env.int('UPLOAD_SIZE_LIMIT', 50 * 1024 * 1024),
    },
  },
  i18n: {
    config: {
      locales: ['hi', 'en'],
      defaultLocale: 'hi',
    },
  },
  'auto-slug-manager': {
    config: {},
  },
  'strapi-advanced-sitemap': {
    config: {},
  },
  'users-permissions': {
    config: {
      jwt: {
        expiresIn: '7d',
      },
      register: {
        allowedFields: ['username', 'email', 'password'],
      },
      advancedSettings: {
        unique_email: true,
        allow_register: true,
        email_confirmation: false,
        default_role: 'authenticated',
      },
    },
  },
});
