module.exports = {
  apps: [
    {
      name: 'strapi',
      cwd: '/var/www/strapi',
      script: 'npm',
      args: 'run start',
      env: {
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: 1337,
      },
    },
  ],
};
