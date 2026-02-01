# RBAC Implementation Verification Checklist

> **Rampur News Portal - Strapi v5 RBAC Verification**

Use this checklist to verify the RBAC implementation is working correctly.

---

## 1. Database Verification

### 1.1 Role Existence Checks

Run these queries to verify roles exist in the database:

```sql
-- SQLite / PostgreSQL
SELECT id, name, type, description 
FROM up_roles 
ORDER BY id;
```

**Expected Results:**

- [ ] `authenticated` role exists
- [ ] `public` role exists
- [ ] `admin` role exists
- [ ] `editor` role exists
- [ ] `reader` role exists
- [ ] `reporter` role exists
- [ ] `reviewer` role exists

### 1.2 Permission Links Verification

```sql
-- Count permissions per role
SELECT r.name, r.type, COUNT(lnk.permission_id) as permission_count
FROM up_roles r
LEFT JOIN up_permissions_role_lnk lnk ON r.id = lnk.role_id
GROUP BY r.id, r.name, r.type
ORDER BY r.id;
```

**Expected:** Each role should have permissions configured.

### 1.3 User-Role Assignment Verification

```sql
-- List users with their roles
SELECT u.id, u.username, u.email, r.name as role_name, r.type as role_type
FROM up_users u
LEFT JOIN up_roles r ON u.role = r.id
ORDER BY u.id;
```

**Expected:** Each user should have a role assigned.

### 1.4 Article Workflow Fields Verification

```sql
-- Check articles have workflow fields
SELECT id, title, workflow_status, reviewed_by, reviewed_at, submitted_for_review_at
FROM articles
LIMIT 10;
```

**Expected:** `workflow_status` column exists with values: `draft`, `review`, or `published`.

---

## 2. Role Configuration Checks

### 2.1 Admin Panel Verification

- [ ] Navigate to **Settings** → **Users & Permissions** → **Roles**
- [ ] Verify all 7 roles are visible
- [ ] Click each role and verify permissions are configured

### 2.2 Role Permission Verification

#### Reader Role
- [ ] Can access: `find`, `findOne` for articles (published only)
- [ ] Cannot access: `create`, `update`, `delete`

#### Reporter Role
- [ ] Can access: `find`, `findOne`, `create`, `update` (own only)
- [ ] Cannot access: `delete`, `publish`

#### Reviewer Role
- [ ] Can access: `find`, `findOne`, `update` (workflow fields)
- [ ] Can access: `approve`, `reject`
- [ ] Cannot access: `create`, `delete`, `publish`

#### Editor Role
- [ ] Can access: All article operations
- [ ] Can access: `publish`, `unpublish`
- [ ] Can access: Category, Tag, Author management

---

## 3. API Endpoint Tests

### 3.1 Public Endpoints (No Auth Required)

```bash
# Test public article list
curl -X GET http://localhost:1337/api/articles
```
- [ ] Returns 200 OK
- [ ] Returns only published articles

```bash
# Test featured articles
curl -X GET http://localhost:1337/api/articles/featured
```
- [ ] Returns 200 OK

```bash
# Test breaking news
curl -X GET http://localhost:1337/api/articles/breaking
```
- [ ] Returns 200 OK

```bash
# Test article by slug
curl -X GET http://localhost:1337/api/articles/slug/test-article
```
- [ ] Returns 200 OK for published article
- [ ] Returns 404 for draft article

### 3.2 Authentication Test

```bash
# Login and get JWT
curl -X POST http://localhost:1337/api/auth/local \
  -H "Content-Type: application/json" \
  -d '{"identifier": "test@example.com", "password": "password"}'
```
- [ ] Returns JWT token
- [ ] Returns user object with role

```bash
# Verify token
curl -X GET http://localhost:1337/api/users/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```
- [ ] Returns current user info
- [ ] Includes role information

### 3.3 Reporter Endpoint Tests

```bash
# Create article (Reporter)
curl -X POST http://localhost:1337/api/articles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer REPORTER_TOKEN" \
  -d '{"title": "Test Article", "content": "<p>Content</p>", "category": "rampur", "author": "Rampur News Desk"}'
```
- [ ] Returns 200 OK
- [ ] Article created with `workflowStatus: draft`

```bash
# Get my articles (Reporter)
curl -X GET http://localhost:1337/api/articles/my \
  -H "Authorization: Bearer REPORTER_TOKEN"
```
- [ ] Returns only articles created by this user

```bash
# Submit for review (Reporter)
curl -X POST http://localhost:1337/api/articles/123/submit-for-review \
  -H "Authorization: Bearer REPORTER_TOKEN"
```
- [ ] Returns 200 OK
- [ ] Article status changed to `review`

### 3.4 Reviewer Endpoint Tests

```bash
# Get review queue (Reviewer)
curl -X GET http://localhost:1337/api/articles/review-queue \
  -H "Authorization: Bearer REVIEWER_TOKEN"
```
- [ ] Returns articles with `workflowStatus: review`

```bash
# Approve article (Reviewer)
curl -X POST http://localhost:1337/api/articles/123/approve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer REVIEWER_TOKEN" \
  -d '{"reviewNotes": "Approved"}'
```
- [ ] Returns 200 OK
- [ ] `reviewedAt` and `reviewedBy` set

```bash
# Reject article (Reviewer)
curl -X POST http://localhost:1337/api/articles/123/reject \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer REVIEWER_TOKEN" \
  -d '{"reviewNotes": "Needs revision"}'
```
- [ ] Returns 200 OK
- [ ] Article status changed to `draft`
- [ ] `reviewNotes` saved

### 3.5 Editor Endpoint Tests

```bash
# Publish article (Editor)
curl -X POST http://localhost:1337/api/articles/123/publish \
  -H "Authorization: Bearer EDITOR_TOKEN"
```
- [ ] Returns 200 OK
- [ ] Article status changed to `published`
- [ ] `publishedAt` set

```bash
# Unpublish article (Editor)
curl -X POST http://localhost:1337/api/articles/123/unpublish \
  -H "Authorization: Bearer EDITOR_TOKEN"
```
- [ ] Returns 200 OK
- [ ] Article status changed to `draft`
- [ ] `publishedAt` cleared

```bash
# Delete article (Editor)
curl -X DELETE http://localhost:1337/api/articles/123 \
  -H "Authorization: Bearer EDITOR_TOKEN"
```
- [ ] Returns 200 OK
- [ ] Article deleted

---

## 4. Workflow Tests

### 4.1 Complete Workflow Test

1. **Reporter creates article:**
   - [ ] Article created with `workflowStatus: draft`

2. **Reporter submits for review:**
   - [ ] Status changes to `review`
   - [ ] `submittedForReviewAt` set

3. **Reviewer approves:**
   - [ ] `reviewedAt` and `reviewedBy` set
   - [ ] Status remains `review`

4. **Editor publishes:**
   - [ ] Status changes to `published`
   - [ ] `publishedAt` set
   - [ ] Article visible in public API

5. **Editor unpublishes:**
   - [ ] Status changes to `draft`
   - [ ] `publishedAt` cleared
   - [ ] Article hidden from public API

### 4.2 Rejection Workflow Test

1. **Reporter creates and submits:**
   - [ ] Article in `review` status

2. **Reviewer rejects:**
   - [ ] Status changes to `draft`
   - [ ] `reviewNotes` contains rejection reason

3. **Reporter edits and resubmits:**
   - [ ] Status changes back to `review`

---

## 5. Security Tests

### 5.1 Ownership Enforcement

```bash
# Reporter tries to edit another user's article
curl -X PUT http://localhost:1337/api/articles/OTHER_USER_ARTICLE_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer REPORTER_TOKEN" \
  -d '{"title": "Hacked Title"}'
```
- [ ] Returns 403 Forbidden
- [ ] Error message: "You do not have permission to modify this resource"

### 5.2 Role Restriction Enforcement

```bash
# Reporter tries to publish
curl -X POST http://localhost:1337/api/articles/123/publish \
  -H "Authorization: Bearer REPORTER_TOKEN"
```
- [ ] Returns 403 Forbidden
- [ ] Error message: "Only Editors can publish"

```bash
# Reviewer tries to publish
curl -X POST http://localhost:1337/api/articles/123/publish \
  -H "Authorization: Bearer REVIEWER_TOKEN"
```
- [ ] Returns 403 Forbidden

```bash
# Reader tries to create article
curl -X POST http://localhost:1337/api/articles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer READER_TOKEN" \
  -d '{"title": "Test", "content": "<p>Test</p>"}'
```
- [ ] Returns 403 Forbidden

### 5.3 Workflow Status Enforcement

```bash
# Reporter tries to change published article
curl -X PUT http://localhost:1337/api/articles/PUBLISHED_ARTICLE_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer REPORTER_TOKEN" \
  -d '{"title": "New Title"}'
```
- [ ] Returns 403 Forbidden
- [ ] Error message about workflow status

### 5.4 API Token Bypass

```bash
# API token should bypass ownership checks
curl -X PUT http://localhost:1337/api/articles/123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer API_TOKEN" \
  -d '{"title": "Updated via API Token"}'
```
- [ ] Returns 200 OK (API tokens have full access)

### 5.5 Invalid Token Handling

```bash
# Invalid token
curl -X GET http://localhost:1337/api/articles/my \
  -H "Authorization: Bearer invalid_token"
```
- [ ] Returns 401 Unauthorized

```bash
# Expired token
curl -X GET http://localhost:1337/api/articles/my \
  -H "Authorization: Bearer EXPIRED_TOKEN"
```
- [ ] Returns 401 Unauthorized

---

## 6. Content Manager UI Tests

### 6.1 Role Dropdown Test

- [ ] Navigate to Content Manager → User
- [ ] Click "Create new entry"
- [ ] Role dropdown shows all available roles
- [ ] Can select and save role

### 6.2 Article Workflow Fields

- [ ] Navigate to Content Manager → Article
- [ ] `workflowStatus` field visible
- [ ] `reviewNotes` field visible
- [ ] `reviewedBy` relation field visible
- [ ] `reviewedAt` datetime field visible
- [ ] `submittedForReviewAt` datetime field visible

---

## 7. Performance Tests

### 7.1 Response Time Checks

```bash
# Measure response time for public endpoints
time curl -X GET http://localhost:1337/api/articles
```
- [ ] Response time < 500ms

```bash
# Measure response time for authenticated endpoints
time curl -X GET http://localhost:1337/api/articles/my \
  -H "Authorization: Bearer TOKEN"
```
- [ ] Response time < 500ms

### 7.2 Concurrent Request Test

```bash
# Test concurrent requests (requires Apache Bench)
ab -n 100 -c 10 http://localhost:1337/api/articles
```
- [ ] No errors
- [ ] Consistent response times

---

## 8. Logging Verification

### 8.1 Security Logger

- [ ] Check logs for policy decisions:
  ```
  [is-owner] Policy passed/denied
  [can-publish] Policy passed/denied
  [workflow-status] Policy passed/denied
  [role-check] Policy passed/denied
  ```

### 8.2 Workflow Logging

- [ ] Check logs for workflow actions:
  ```
  [workflow] Article X submitted for review by user Y
  [workflow] Article X approved by user Y
  [workflow] Article X rejected by user Y
  [workflow] Article X published by user Y
  [workflow] Article X unpublished by user Y
  ```

---

## 9. Production Readiness Checklist

### 9.1 Environment Configuration

- [ ] All security keys are unique and strong
- [ ] `JWT_SECRET` is set
- [ ] `APP_KEYS` contains 4 unique keys
- [ ] `API_TOKEN_SALT` is set
- [ ] `ADMIN_JWT_SECRET` is set
- [ ] Database credentials are secure
- [ ] CORS origins are correctly configured

### 9.2 Security Hardening

- [ ] Admin panel is protected (or disabled in production)
- [ ] Rate limiting is configured
- [ ] HTTPS is enforced
- [ ] Security headers are set

### 9.3 Backup & Recovery

- [ ] Database backup strategy in place
- [ ] Media backup strategy in place
- [ ] Recovery procedure documented

---

## Quick Verification Script

Save this as `verify-rbac.sh` and run:

```bash
#!/bin/bash

BASE_URL="http://localhost:1337"

echo "=== RBAC Verification Script ==="

# Test public endpoint
echo -n "Public articles endpoint: "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/articles")
[ "$STATUS" = "200" ] && echo "✓ PASS" || echo "✗ FAIL ($STATUS)"

# Test authentication
echo -n "Authentication endpoint: "
RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/local" \
  -H "Content-Type: application/json" \
  -d '{"identifier": "test@example.com", "password": "password"}')
echo "$RESPONSE" | grep -q "jwt" && echo "✓ PASS" || echo "✗ FAIL"

# Test protected endpoint without auth
echo -n "Protected endpoint (no auth): "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/articles/my")
[ "$STATUS" = "401" ] || [ "$STATUS" = "403" ] && echo "✓ PASS" || echo "✗ FAIL ($STATUS)"

echo "=== Verification Complete ==="
```

---

## Sign-Off

| Check | Verified By | Date | Notes |
|-------|-------------|------|-------|
| Database Verification | | | |
| Role Configuration | | | |
| API Endpoints | | | |
| Workflow Tests | | | |
| Security Tests | | | |
| UI Tests | | | |
| Performance Tests | | | |
| Logging | | | |
| Production Readiness | | | |

**Final Approval:**

- [ ] All checks passed
- [ ] Documentation reviewed
- [ ] Ready for production deployment

Approved by: _________________ Date: _________________
