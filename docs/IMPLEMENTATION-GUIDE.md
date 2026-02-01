# Strapi v5 RBAC Implementation Guide

> **Rampur News Portal - Complete Setup & Configuration Guide**

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Core Issue Resolution](#2-core-issue-resolution)
3. [Admin UI Configuration](#3-admin-ui-configuration)
4. [Role Permission Matrix](#4-role-permission-matrix)
5. [API Endpoints Reference](#5-api-endpoints-reference)
6. [Workflow Usage Examples](#6-workflow-usage-examples)
7. [Troubleshooting Guide](#7-troubleshooting-guide)

---

## 1. Quick Start

### 1.1 Prerequisites

- **Node.js**: v18.x or v20.x (LTS recommended)
- **npm**: v9.x or higher
- **Database**: SQLite (development) or PostgreSQL/MySQL (production)
- **Git**: For version control

### 1.2 Environment Setup

1. **Clone the repository and navigate to Backend-Strapi:**

```bash
cd Backend-Strapi
```

2. **Copy environment template:**

```bash
cp .env.example .env
```

3. **Configure required environment variables:**

```env
# Server Configuration
HOST=0.0.0.0
PORT=1337
PUBLIC_URL=http://localhost:1337
STRAPI_PUBLIC_URL=http://localhost:1337
SITE_URL=http://localhost:3000

# Security Keys (MUST be changed in production)
APP_KEYS="key1,key2,key3,key4"
API_TOKEN_SALT=your-api-token-salt
ADMIN_JWT_SECRET=your-admin-jwt-secret
TRANSFER_TOKEN_SALT=your-transfer-token-salt
JWT_SECRET=your-jwt-secret

# Database (SQLite for development)
DATABASE_CLIENT=sqlite
DATABASE_FILENAME=.tmp/data.db

# Optional: Bootstrap admin user
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_PASSWORD=SecurePassword123!
```

4. **Install dependencies:**

```bash
npm install
```

5. **Build and start Strapi:**

```bash
# Development mode
npm run develop

# Production mode
npm run build
npm run start
```

### 1.3 First-Time Deployment Steps

1. **Start Strapi** - The bootstrap function in [`src/index.ts`](../src/index.ts:19) automatically:
   - Creates RBAC roles (Reader, Reporter, Reviewer, Editor)
   - Seeds default categories
   - Seeds default authors
   - Creates bootstrap admin user (if env vars set)

2. **Access Admin Panel** at `http://localhost:1337/admin`

3. **Create Super Admin** (first-time only):
   - Email: your-email@example.com
   - Password: Strong password

4. **Configure Role Permissions** (see [Section 3](#3-admin-ui-configuration))

5. **Create API Token** for frontend:
   - Settings → API Tokens → Create new API Token
   - Type: Full access or Custom
   - Copy token for frontend `.env`

---

## 2. Core Issue Resolution

### 2.1 Problem: "Policy Failed" Error

**Symptom:** API requests fail with "Policy Failed" or authentication errors.

**Root Cause:** The `users-permissions` plugin was not properly configured in [`config/plugins.ts`](../config/plugins.ts:20).

**Solution Applied:**

```typescript
// config/plugins.ts
'users-permissions': {
  enabled: true,
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
```

**Verification:**

```bash
# Test authentication endpoint
curl -X POST http://localhost:1337/api/auth/local \
  -H "Content-Type: application/json" \
  -d '{"identifier": "user@example.com", "password": "password"}'
```

Expected: JWT token in response.

### 2.2 Problem: "No Relations Available" in Content Manager

**Symptom:** When creating users, the Role dropdown shows "No relations available" or is empty.

**Root Cause:** Strapi v5 hides `plugin::users-permissions.role` from Content Manager by default.

**Solution Applied:**

Created [`src/extensions/users-permissions/strapi-server.ts`](../src/extensions/users-permissions/strapi-server.ts:1):

```typescript
export default (plugin: any) => {
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

**Verification:**

1. Go to Admin Panel → Content Manager → User
2. Click "Create new entry"
3. The "Role" dropdown should show available roles

### 2.3 Role Seeding Verification

Roles are automatically created on bootstrap. Verify in database:

```sql
-- SQLite
SELECT id, name, type, description FROM up_roles;

-- Expected output:
-- 1 | Authenticated | authenticated | Default role...
-- 2 | Public        | public        | Default role...
-- 3 | Admin         | admin         | Full access...
-- 4 | Editor        | editor        | Can edit and publish...
-- 5 | Reader        | reader        | Can read published...
-- 6 | Reporter      | reporter      | Can create and edit own...
-- 7 | Reviewer      | reviewer      | Can review and approve...
```

---

## 3. Admin UI Configuration

### 3.1 Verifying Roles Exist

1. Navigate to **Settings** → **Users & Permissions** → **Roles**
2. Verify these roles exist:
   - **Authenticated** (default)
   - **Public** (default)
   - **Admin**
   - **Editor**
   - **Reader**
   - **Reporter**
   - **Reviewer**

If any role is missing, restart Strapi - the bootstrap function will create it.

### 3.2 Creating App Users with Roles

1. Navigate to **Content Manager** → **User** (under Users & Permissions Plugin)
2. Click **Create new entry**
3. Fill in required fields:
   - **username**: unique username
   - **email**: valid email
   - **password**: secure password
   - **confirmed**: ✓ (checked)
   - **blocked**: ☐ (unchecked)
   - **role**: Select appropriate role from dropdown

### 3.3 Configuring Role Permissions in Admin UI

For each role, configure permissions:

1. Go to **Settings** → **Users & Permissions** → **Roles**
2. Click on the role to edit
3. Expand **Permissions** section
4. Configure as per the matrix in [Section 4](#4-role-permission-matrix)
5. Click **Save**

### 3.4 Setting Up API Permissions for Each Role

#### Reader Role Configuration

1. Click on **Reader** role
2. Under **Application** → **Article**:
   - ✓ find
   - ✓ findOne
   - ☐ create
   - ☐ update
   - ☐ delete
3. Under **Application** → **Category**:
   - ✓ find
   - ✓ findOne
4. Under **Application** → **Tag**:
   - ✓ find
   - ✓ findOne
5. Save

#### Reporter Role Configuration

1. Click on **Reporter** role
2. Under **Application** → **Article**:
   - ✓ find
   - ✓ findOne
   - ✓ create
   - ✓ update (ownership enforced by policy)
   - ☐ delete
3. Under **Application** → **Category**:
   - ✓ find
   - ✓ findOne
4. Under **Application** → **Tag**:
   - ✓ find
   - ✓ findOne
5. Under **Application** → **Author**:
   - ✓ find
   - ✓ findOne
6. Save

#### Reviewer Role Configuration

1. Click on **Reviewer** role
2. Under **Application** → **Article**:
   - ✓ find
   - ✓ findOne
   - ☐ create
   - ✓ update (limited to workflow fields)
   - ☐ delete
3. Under **Application** → **Category**:
   - ✓ find
   - ✓ findOne
4. Under **Application** → **Tag**:
   - ✓ find
   - ✓ findOne
5. Save

#### Editor Role Configuration

1. Click on **Editor** role
2. Under **Application** → **Article**:
   - ✓ find
   - ✓ findOne
   - ✓ create
   - ✓ update
   - ✓ delete
3. Under **Application** → **Category**:
   - ✓ find
   - ✓ findOne
   - ✓ create
   - ✓ update
   - ✓ delete
4. Under **Application** → **Tag**:
   - ✓ find
   - ✓ findOne
   - ✓ create
   - ✓ update
   - ✓ delete
5. Under **Application** → **Author**:
   - ✓ find
   - ✓ findOne
   - ✓ create
   - ✓ update
6. Save

---

## 4. Role Permission Matrix

### 4.1 Article Permissions

| Permission | Reader | Reporter | Reviewer | Editor |
|------------|--------|----------|----------|--------|
| **find** (list) | ✓ Published only | ✓ Own + Published | ✓ All | ✓ All |
| **findOne** (view) | ✓ Published only | ✓ Own + Published | ✓ All | ✓ All |
| **create** | ✗ | ✓ | ✗ | ✓ |
| **update** | ✗ | ✓ Own only | ✓ Workflow fields | ✓ All |
| **delete** | ✗ | ✗ | ✗ | ✓ |
| **submit-for-review** | ✗ | ✓ Own only | ✗ | ✓ |
| **approve** | ✗ | ✗ | ✓ | ✓ |
| **reject** | ✗ | ✗ | ✓ | ✓ |
| **publish** | ✗ | ✗ | ✗ | ✓ |
| **unpublish** | ✗ | ✗ | ✗ | ✓ |

### 4.2 Workflow Status Transitions

| Current Status | Reader | Reporter | Reviewer | Editor |
|----------------|--------|----------|----------|--------|
| **draft** → review | ✗ | ✓ | ✓ | ✓ |
| **draft** → published | ✗ | ✗ | ✗ | ✓ |
| **review** → draft | ✗ | ✗ | ✓ | ✓ |
| **review** → published | ✗ | ✗ | ✗ | ✓ |
| **published** → draft | ✗ | ✗ | ✗ | ✓ |

### 4.3 Other Content Types

| Content Type | Reader | Reporter | Reviewer | Editor |
|--------------|--------|----------|----------|--------|
| **Category** | Read | Read | Read | Full |
| **Tag** | Read | Read | Read | Full |
| **Author** | Read | Read | Read | Full |
| **Page** | Read | Read | Read | Full |

---

## 5. API Endpoints Reference

### 5.1 Public Endpoints (No Authentication)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/articles` | List published articles |
| GET | `/api/articles/:id` | Get published article by ID |
| GET | `/api/articles/slug/:slug` | Get published article by slug |
| GET | `/api/articles/featured` | List featured articles |
| GET | `/api/articles/breaking` | List breaking news |
| GET | `/api/articles/trending` | List trending articles |
| GET | `/api/articles/bycategory/:slug` | List articles by category |
| GET | `/api/articles/search?q=term` | Search articles |

### 5.2 Authenticated Endpoints

| Method | Path | Required Role | Description |
|--------|------|---------------|-------------|
| GET | `/api/articles/my` | Reporter+ | List current user's articles |
| GET | `/api/articles/review-queue` | Reviewer+ | List articles pending review |
| GET | `/api/articles/admin` | CMS Role | Admin list (includes drafts) |
| GET | `/api/articles/admin/:id` | CMS Role | Admin view by ID |
| GET | `/api/articles/admin/slug/:slug` | CMS Role | Admin view by slug |
| POST | `/api/articles` | Reporter+ | Create new article |
| PUT | `/api/articles/:id` | Reporter+ | Update article |
| DELETE | `/api/articles/:id` | Editor | Delete article |

### 5.3 Workflow Endpoints

| Method | Path | Required Role | Description |
|--------|------|---------------|-------------|
| POST | `/api/articles/:id/submit-for-review` | Reporter+ | Submit article for review |
| POST | `/api/articles/:id/approve` | Reviewer+ | Approve article (mark reviewed) |
| POST | `/api/articles/:id/reject` | Reviewer+ | Reject article (back to draft) |
| POST | `/api/articles/:id/publish` | Editor | Publish article |
| POST | `/api/articles/:id/unpublish` | Editor | Unpublish article |

### 5.4 Authentication Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/local` | Login with email/password |
| POST | `/api/auth/local/register` | Register new user |
| GET | `/api/users/me` | Get current user info |

---

## 6. Workflow Usage Examples

### 6.1 Authentication

**Login and get JWT token:**

```bash
curl -X POST http://localhost:1337/api/auth/local \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "reporter@example.com",
    "password": "ReporterPass123!"
  }'
```

**Response:**

```json
{
  "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "reporter",
    "email": "reporter@example.com",
    "role": {
      "id": 6,
      "name": "Reporter",
      "type": "reporter"
    }
  }
}
```

### 6.2 Creating an Article (Reporter)

```bash
curl -X POST http://localhost:1337/api/articles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "Breaking: Major Event in Rampur",
    "content": "<p>Article content here...</p>",
    "excerpt": "Brief summary of the article",
    "category": "rampur",
    "author": "Rampur News Desk",
    "tags": ["breaking", "rampur", "local"]
  }'
```

**Response:**

```json
{
  "id": "123",
  "title": "Breaking: Major Event in Rampur",
  "slug": "breaking-major-event-in-rampur",
  "workflowStatus": "draft",
  "status": "draft",
  "category": "rampur",
  "author": "Rampur News Desk"
}
```

### 6.3 Submitting for Review (Reporter)

```bash
curl -X POST http://localhost:1337/api/articles/123/submit-for-review \
  -H "Authorization: Bearer REPORTER_JWT_TOKEN"
```

**Response:**

```json
{
  "id": "123",
  "title": "Breaking: Major Event in Rampur",
  "workflowStatus": "review",
  "submittedForReviewAt": "2026-02-01T16:00:00.000Z"
}
```

### 6.4 Viewing Review Queue (Reviewer)

```bash
curl -X GET http://localhost:1337/api/articles/review-queue \
  -H "Authorization: Bearer REVIEWER_JWT_TOKEN"
```

**Response:**

```json
{
  "data": [
    {
      "id": "123",
      "title": "Breaking: Major Event in Rampur",
      "workflowStatus": "review",
      "submittedForReviewAt": "2026-02-01T16:00:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "pageSize": 25,
  "totalPages": 1
}
```

### 6.5 Approving an Article (Reviewer)

```bash
curl -X POST http://localhost:1337/api/articles/123/approve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer REVIEWER_JWT_TOKEN" \
  -d '{
    "reviewNotes": "Content verified. Ready for publication."
  }'
```

**Response:**

```json
{
  "id": "123",
  "title": "Breaking: Major Event in Rampur",
  "workflowStatus": "review",
  "reviewedAt": "2026-02-01T17:00:00.000Z",
  "reviewNotes": "Content verified. Ready for publication."
}
```

### 6.6 Rejecting an Article (Reviewer)

```bash
curl -X POST http://localhost:1337/api/articles/123/reject \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer REVIEWER_JWT_TOKEN" \
  -d '{
    "reviewNotes": "Please add more sources and verify the claims."
  }'
```

**Response:**

```json
{
  "id": "123",
  "title": "Breaking: Major Event in Rampur",
  "workflowStatus": "draft",
  "reviewedAt": "2026-02-01T17:00:00.000Z",
  "reviewNotes": "Please add more sources and verify the claims."
}
```

### 6.7 Publishing an Article (Editor)

```bash
curl -X POST http://localhost:1337/api/articles/123/publish \
  -H "Authorization: Bearer EDITOR_JWT_TOKEN"
```

**Response:**

```json
{
  "id": "123",
  "title": "Breaking: Major Event in Rampur",
  "workflowStatus": "published",
  "status": "published",
  "publishedAt": "2026-02-01T18:00:00.000Z"
}
```

### 6.8 Unpublishing an Article (Editor)

```bash
curl -X POST http://localhost:1337/api/articles/123/unpublish \
  -H "Authorization: Bearer EDITOR_JWT_TOKEN"
```

**Response:**

```json
{
  "id": "123",
  "title": "Breaking: Major Event in Rampur",
  "workflowStatus": "draft",
  "status": "draft",
  "publishedAt": null
}
```

---

## 7. Troubleshooting Guide

### 7.1 Policy Failed Errors

**Error:** `"Policy Failed"` or `"Forbidden"`

**Causes & Solutions:**

1. **User not authenticated:**
   ```bash
   # Verify token is valid
   curl -X GET http://localhost:1337/api/users/me \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

2. **User role not configured:**
   - Check user has a role assigned in Admin Panel
   - Verify role permissions are configured

3. **Policy misconfiguration:**
   - Check route configuration in [`src/api/article/routes/article.ts`](../src/api/article/routes/article.ts:1)
   - Verify policy files exist in [`src/policies/`](../src/policies/)

4. **JWT expired:**
   - Default expiry is 7 days
   - Re-authenticate to get new token

### 7.2 Role Dropdown Empty

**Error:** "No relations available" when selecting role for user

**Solution:**

1. Verify [`src/extensions/users-permissions/strapi-server.ts`](../src/extensions/users-permissions/strapi-server.ts:1) exists
2. Restart Strapi: `npm run develop`
3. Clear browser cache and refresh Admin Panel

### 7.3 Permission Denied Errors

**Error:** `"You do not have permission to modify this resource"`

**Causes & Solutions:**

1. **Ownership check failed (Reporter):**
   - Reporters can only edit their own articles
   - Check `createdBy` field matches current user

2. **Role insufficient:**
   - Verify user has correct role for the action
   - See [Permission Matrix](#4-role-permission-matrix)

3. **Workflow status restriction:**
   - Check current article status
   - See [Workflow Transitions](#42-workflow-status-transitions)

### 7.4 JWT Token Issues

**Error:** `"Invalid token"` or `"Token expired"`

**Solutions:**

1. **Verify token format:**
   ```bash
   # Token should be in format: Bearer <token>
   -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
   ```

2. **Check JWT_SECRET:**
   - Ensure `JWT_SECRET` in `.env` matches what was used to sign token
   - Changing `JWT_SECRET` invalidates all existing tokens

3. **Token expiry:**
   - Default: 7 days (configured in [`config/plugins.ts`](../config/plugins.ts:23))
   - Re-authenticate to get new token

### 7.5 Workflow Transition Errors

**Error:** `"Invalid status transition"`

**Solutions:**

1. **Check current status:**
   ```bash
   curl -X GET http://localhost:1337/api/articles/admin/123 \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

2. **Verify role permissions:**
   - See [Workflow Transitions](#42-workflow-status-transitions)
   - Only Editors can publish

3. **Use correct endpoint:**
   - Don't set `workflowStatus` directly in update
   - Use workflow endpoints (`/submit-for-review`, `/approve`, `/publish`, etc.)

### 7.6 Database Connection Issues

**Error:** `"Database connection failed"`

**Solutions:**

1. **SQLite (development):**
   ```env
   DATABASE_CLIENT=sqlite
   DATABASE_FILENAME=.tmp/data.db
   ```

2. **PostgreSQL (production):**
   ```env
   DATABASE_CLIENT=postgres
   DATABASE_HOST=localhost
   DATABASE_PORT=5432
   DATABASE_NAME=strapi
   DATABASE_USERNAME=strapi
   DATABASE_PASSWORD=your-password
   DATABASE_SSL=false
   ```

3. **Verify database exists:**
   ```bash
   # PostgreSQL
   psql -U strapi -d strapi -c "SELECT 1"
   ```

### 7.7 CORS Errors

**Error:** `"CORS policy blocked"`

**Solution:**

Update `CORS_ORIGINS` in `.env`:

```env
CORS_ORIGINS=http://localhost:3000,https://rampurnews.com,https://www.rampurnews.com
```

### 7.8 Common Log Messages

| Log Message | Meaning | Action |
|-------------|---------|--------|
| `[is-owner] Policy denied` | User not owner of resource | Use Editor role or own content |
| `[can-publish] Policy denied` | Non-editor trying to publish | Only Editors can publish |
| `[workflow-status] Invalid transition` | Invalid status change | Check allowed transitions |
| `[role-check] Policy denied` | User role not in allowed list | Assign correct role |

### 7.9 Getting Help

1. **Check logs:**
   ```bash
   # Development
   npm run develop
   
   # Production logs
   tail -f /var/log/strapi/strapi.log
   ```

2. **Enable debug logging:**
   ```env
   DEBUG=strapi:*
   ```

3. **Verify configuration:**
   - [`config/plugins.ts`](../config/plugins.ts:1)
   - [`config/server.ts`](../config/server.ts:1)
   - [`config/middlewares.ts`](../config/middlewares.ts:1)

---

## Quick Reference Card

### Authentication Header
```
Authorization: Bearer <jwt_token>
```

### Workflow Flow
```
draft → submit-for-review → review → approve → publish → published
                              ↓
                           reject → draft (with notes)
```

### Role Hierarchy
```
Reader < Reporter < Reviewer < Editor < Admin
```

### Key Files
- Routes: [`src/api/article/routes/article.ts`](../src/api/article/routes/article.ts:1)
- Controller: [`src/api/article/controllers/article.ts`](../src/api/article/controllers/article.ts:1)
- Policies: [`src/policies/`](../src/policies/)
- Plugin Config: [`config/plugins.ts`](../config/plugins.ts:1)
- Role Extension: [`src/extensions/users-permissions/strapi-server.ts`](../src/extensions/users-permissions/strapi-server.ts:1)
