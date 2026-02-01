/**
 * User Lifecycle Hooks
 * 
 * Provides validation for user operations:
 * - beforeCreate: Validate role is mandatory, email uniqueness, password strength
 * - beforeUpdate: Prevent null role assignment
 * - Logs validation failures
 * 
 * @module extensions/users-permissions/content-types/user/lifecycles
 * @see Backend-Strapi/docs/RBAC-ARCHITECTURE.md
 */

// Declare strapi as global for Node.js runtime
declare const strapi: any;

/**
 * Password strength validation
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
function validatePasswordStrength(password: string): { valid: boolean; message: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required' };
  }

  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character' };
  }

  return { valid: true, message: 'Password meets strength requirements' };
}

/**
 * Email format validation
 */
function validateEmail(email: string): { valid: boolean; message: string } {
  if (!email || typeof email !== 'string') {
    return { valid: false, message: 'Email is required' };
  }

  // RFC 5322 compliant email regex (simplified)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(email)) {
    return { valid: false, message: 'Invalid email format' };
  }

  // Check for common disposable email domains in production
  const disposableDomains = [
    'tempmail.com',
    'throwaway.com',
    'mailinator.com',
    'guerrillamail.com',
    '10minutemail.com',
  ];

  const domain = email.split('@')[1]?.toLowerCase();
  if (disposableDomains.includes(domain)) {
    return { valid: false, message: 'Disposable email addresses are not allowed' };
  }

  return { valid: true, message: 'Email is valid' };
}

/**
 * Log validation failure with structured format
 */
function logValidationFailure(
  event: string,
  field: string,
  message: string,
  userId?: number | string,
  email?: string
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event: 'USER_VALIDATION_FAILURE',
    lifecycle: event,
    field,
    message,
    userId: userId || null,
    email: email || null,
  };
  
  strapi.log.warn(`[USER_VALIDATION] ${JSON.stringify(logEntry)}`);
}

export default {
  /**
   * Before Create Hook
   * 
   * Validates:
   * - Role is mandatory
   * - Email uniqueness
   * - Password strength
   */
  async beforeCreate(event: any) {
    const { data } = event.params;

    // Validate email format
    if (data.email) {
      const emailValidation = validateEmail(data.email);
      if (!emailValidation.valid) {
        logValidationFailure('beforeCreate', 'email', emailValidation.message, undefined, data.email);
        throw new Error(emailValidation.message);
      }

      // Check email uniqueness
      const existingUser = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { email: data.email.toLowerCase() },
      });

      if (existingUser) {
        logValidationFailure('beforeCreate', 'email', 'Email already exists', undefined, data.email);
        throw new Error('Email already exists');
      }

      // Normalize email to lowercase
      data.email = data.email.toLowerCase();
    }

    // Validate password strength (only if password is provided - might be OAuth)
    if (data.password) {
      const passwordValidation = validatePasswordStrength(data.password);
      if (!passwordValidation.valid) {
        logValidationFailure('beforeCreate', 'password', passwordValidation.message, undefined, data.email);
        throw new Error(passwordValidation.message);
      }
    }

    // Validate role is provided
    // Note: In Strapi v5, role might be set via relation or default
    // We check if role is explicitly set to null (which is invalid)
    if (data.role === null) {
      logValidationFailure('beforeCreate', 'role', 'Role cannot be null', undefined, data.email);
      throw new Error('User must have a role assigned');
    }

    // Log successful validation
    strapi.log.info(`[USER_VALIDATION] User creation validated for email: ${data.email || 'unknown'}`);
  },

  /**
   * Before Update Hook
   * 
   * Validates:
   * - Prevent null role assignment
   * - Email uniqueness if changed
   * - Password strength if changed
   */
  async beforeUpdate(event: any) {
    const { data, where } = event.params;
    const userId = where?.id;

    // Prevent null role assignment
    if (data.role === null) {
      logValidationFailure('beforeUpdate', 'role', 'Cannot set role to null', userId);
      throw new Error('User role cannot be set to null');
    }

    // If email is being updated, validate format and uniqueness
    if (data.email !== undefined) {
      const emailValidation = validateEmail(data.email);
      if (!emailValidation.valid) {
        logValidationFailure('beforeUpdate', 'email', emailValidation.message, userId, data.email);
        throw new Error(emailValidation.message);
      }

      // Check email uniqueness (excluding current user)
      const existingUser = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: {
          email: data.email.toLowerCase(),
          id: { $ne: userId },
        },
      });

      if (existingUser) {
        logValidationFailure('beforeUpdate', 'email', 'Email already exists', userId, data.email);
        throw new Error('Email already exists');
      }

      // Normalize email to lowercase
      data.email = data.email.toLowerCase();
    }

    // If password is being updated, validate strength
    if (data.password) {
      const passwordValidation = validatePasswordStrength(data.password);
      if (!passwordValidation.valid) {
        logValidationFailure('beforeUpdate', 'password', passwordValidation.message, userId);
        throw new Error(passwordValidation.message);
      }
    }

    // Log successful validation
    strapi.log.info(`[USER_VALIDATION] User update validated for ID: ${userId || 'unknown'}`);
  },

  /**
   * After Create Hook
   * 
   * Logs successful user creation for audit trail
   */
  async afterCreate(event: any) {
    const { result } = event;

    const logEntry = {
      timestamp: new Date().toISOString(),
      event: 'USER_CREATED',
      userId: result?.id,
      email: result?.email,
      role: result?.role?.type || result?.role?.name || 'unknown',
    };

    strapi.log.info(`[USER_AUDIT] ${JSON.stringify(logEntry)}`);
  },

  /**
   * After Update Hook
   * 
   * Logs user updates for audit trail
   */
  async afterUpdate(event: any) {
    const { result, params } = event;

    // Detect sensitive field changes
    const sensitiveFields = ['email', 'password', 'role', 'blocked', 'confirmed'];
    const changedSensitiveFields = sensitiveFields.filter(
      field => params.data[field] !== undefined
    );

    if (changedSensitiveFields.length > 0) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        event: 'USER_SENSITIVE_UPDATE',
        userId: result?.id,
        email: result?.email,
        changedFields: changedSensitiveFields,
      };

      strapi.log.info(`[USER_AUDIT] ${JSON.stringify(logEntry)}`);
    }
  },

  /**
   * Before Delete Hook
   * 
   * Logs user deletion attempts for audit trail
   */
  async beforeDelete(event: any) {
    const { where } = event.params;

    const logEntry = {
      timestamp: new Date().toISOString(),
      event: 'USER_DELETE_ATTEMPT',
      userId: where?.id,
    };

    strapi.log.warn(`[USER_AUDIT] ${JSON.stringify(logEntry)}`);
  },

  /**
   * After Delete Hook
   * 
   * Logs successful user deletion for audit trail
   */
  async afterDelete(event: any) {
    const { result } = event;

    const logEntry = {
      timestamp: new Date().toISOString(),
      event: 'USER_DELETED',
      userId: result?.id,
      email: result?.email,
    };

    strapi.log.warn(`[USER_AUDIT] ${JSON.stringify(logEntry)}`);
  },
};
