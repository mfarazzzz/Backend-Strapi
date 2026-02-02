import type { Core } from '@strapi/strapi';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    // --- Helper Functions ---
    const getRole = async (type: string) => {
      return strapi.db.query('plugin::users-permissions.role').findOne({
        where: { type },
      });
    };

    const findPermissions = async (roleId: number) => {
      return strapi.db.query('plugin::users-permissions.permission').findMany({
        where: { role: roleId },
      });
    };

    const createPermission = async (roleId: number, action: string) => {
      await strapi.db.query('plugin::users-permissions.permission').create({
        data: {
          action,
          role: roleId,
        },
      });
    };

    // --- Seeding Logic ---
    try {
      console.log('🚀 [Bootstrap] Checking Permissions...');

      // 1. Get Roles
      const publicRole = await getRole('public');
      const authRole = await getRole('authenticated');

      if (!publicRole || !authRole) {
        console.warn('⚠️ [Bootstrap] Roles not found. Skipping seeding.');
        return;
      }

      // 2. Identify All API Content Types
      const apiContentTypes = Object.keys(strapi.contentTypes).filter((uid) =>
        uid.startsWith('api::')
      );

      console.log(`ℹ️ [Bootstrap] Found ${apiContentTypes.length} API Content Types.`);

      // 3. Define Desired Permissions
      // Public: Can Read Only
      const publicActions = ['find', 'findOne'];
      // Authenticated: Can Read + Write (needed for your custom Admin Dashboard)
      const authActions = ['find', 'findOne', 'create', 'update', 'delete', 'publish']; // 'publish' is for v5 Draft/Publish

      // 4. Seed Public Permissions
      const publicPerms = await findPermissions(publicRole.id);
      const publicPermActions = new Set(publicPerms.map((p) => p.action));

      for (const uid of apiContentTypes) {
        for (const action of publicActions) {
          const permissionString = `${uid}.${action}`;
          if (!publicPermActions.has(permissionString)) {
            await createPermission(publicRole.id, permissionString);
            console.log(`✅ [Bootstrap] Granted PUBLIC: ${permissionString}`);
          }
        }
      }

      // 5. Seed Authenticated Permissions
      const authPerms = await findPermissions(authRole.id);
      const authPermActions = new Set(authPerms.map((p) => p.action));

      for (const uid of apiContentTypes) {
        for (const action of authActions) {
          // Note: Not all types support 'publish', so we check
          const contentType = strapi.contentTypes[uid];
          const hasDraftAndPublish = contentType.options?.draftAndPublish === true;
          
          if (action === 'publish' && !hasDraftAndPublish) continue;

          const permissionString = `${uid}.${action}`;
          if (!authPermActions.has(permissionString)) {
            await createPermission(authRole.id, permissionString);
            console.log(`✅ [Bootstrap] Granted AUTHENTICATED: ${permissionString}`);
          }
        }
      }

      console.log('✨ [Bootstrap] Permission Seeding Complete.');

    } catch (error) {
      console.error('❌ [Bootstrap] Error seeding permissions:', error);
    }
  },
};
