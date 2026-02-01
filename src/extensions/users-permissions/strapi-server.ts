/**
 * Plugin extension for users-permissions
 * Makes roles visible in Content Manager for relation selection
 * 
 * @see Backend-Strapi/docs/RBAC-ARCHITECTURE.md
 */
export default (plugin: any) => {
  // Make role content type visible in Content Manager
  // By default, Strapi v5 hides plugin::users-permissions.role from Content Manager
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
