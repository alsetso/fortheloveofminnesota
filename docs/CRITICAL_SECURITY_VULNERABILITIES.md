# Critical Public-Facing Security Vulnerabilities

**Date:** 2025-01-27  
**Priority:** 🔴 **CRITICAL** - Fix Before Production

## 🔴 Critical Vulnerabilities (Fix Immediately)

### 1. Contact Form - Spam/DoS Attack Vector ⚠️

**Route:** `POST /api/contact`

**Vulnerabilities:**
- ❌ **No rate limiting** - Can be spammed infinitely
- ❌ **No input validation** - Basic regex only, no length limits
- ❌ **No request size limit** - Could send massive payloads
- ❌ **Email injection risk** - User input directly in email HTML (line 75, 79, 83)
- ⚠️ **Exposes Resend API key usage** - Logs show API usage

**Attack Scenarios:**
- Spam emails sent to your inbox
- DoS via massive requests
- Email injection attacks
- Resource exhaustion

**Fix Required:**
```typescript
// Add rate limiting (strict: 10/min)
// Add Zod validation with length limits
// Sanitize HTML input (DOMPurify)
// Add request size limit (1MB)
```

### 2. Address/Geocoding Route - API Key Exposure ⚠️

**Route:** `POST /api/address`

**Vulnerabilities:**
- ❌ **Uses deprecated `getApiHeaders()`** - May expose API key
- ❌ **No rate limiting** - Can exhaust RapidAPI quota
- ❌ **No input validation** - No length/format checks
- ❌ **No authentication** - Public access to paid API

**Attack Scenarios:**
- RapidAPI quota exhaustion (costs money)
- API key exposure if headers leak
- Resource exhaustion

**Fix Required:**
- Use proxy route pattern (like skip-trace)
- Add rate limiting (strict: 10/min)
- Add input validation
- Consider requiring authentication

### 3. File Upload Routes - Missing Security Baseline ⚠️

**Routes:**
- `/api/admin/buildings/upload-image` - Has admin check but no rate limiting
- `/api/admin/mention-icons/upload-icon` - Has admin check but no rate limiting
- `/api/admin/atlas-types/upload-icon` - Has admin check but no rate limiting

**Vulnerabilities:**
- ❌ **No rate limiting** - Could upload many files quickly
- ❌ **File size validation only client-side** - Can be bypassed
- ❌ **No file content validation** - Only checks MIME type (can be spoofed)
- ❌ **No virus scanning** - Malicious files could be uploaded
- ⚠️ **Filename injection risk** - Uses user-provided filename (partially sanitized)

**Attack Scenarios:**
- Storage quota exhaustion
- Malicious file uploads
- Path traversal attacks (if filename not properly sanitized)
- DoS via large files

**Fix Required:**
- Add rate limiting (admin: 500/min, but limit uploads to 10/min)
- Validate file content (magic bytes, not just MIME type)
- Strict filename sanitization
- Add request size limits

### 4. Public Analytics Routes - No Rate Limiting ⚠️

**Routes:**
- `POST /api/analytics/pin-view` - No rate limiting
- `GET /api/analytics/homepage-stats` - No rate limiting
- `GET /api/analytics/atlas-map-stats` - No rate limiting
- `GET /api/analytics/special-map-stats` - No rate limiting
- `GET /api/analytics/feed-stats` - No rate limiting

**Vulnerabilities:**
- ❌ **No rate limiting** - Can be hammered
- ❌ **No input validation** - Query params not validated
- ⚠️ **Database load** - Each request hits database

**Attack Scenarios:**
- Database DoS
- Resource exhaustion
- Cost increase (if using paid database)

### 5. News Routes - Inconsistent Protection ⚠️

**Routes:**
- `GET /api/news` - No rate limiting (only `/api/news/latest` has it)
- `GET /api/news/all` - No rate limiting
- `GET /api/news/[id]` - No rate limiting
- `GET /api/news/by-date` - No rate limiting
- `GET /api/news/dates-with-news` - No rate limiting

**Vulnerabilities:**
- ❌ **No rate limiting** (except `/latest`)
- ❌ **No input validation** - Query params not validated
- ⚠️ **External API calls** - `/api/news` calls RapidAPI (costs money)

**Attack Scenarios:**
- RapidAPI quota exhaustion
- Database DoS
- Cost increase

### 6. GraphQL Endpoint - Completely Unprotected ⚠️

**Route:** `POST /graphql` (port 4000, Express server)

**Vulnerabilities:**
- ❌ **No authentication** - Anyone can access
- ❌ **No rate limiting** - Can be hammered
- ❌ **No input validation** - GraphQL queries not validated
- ❌ **No query depth/complexity limits** - Could cause DoS

**Attack Scenarios:**
- GraphQL DoS (deep nested queries)
- Unauthorized data access
- Resource exhaustion

**Fix Required:**
- Add authentication middleware
- Add rate limiting
- Add query depth/complexity limits
- Validate GraphQL queries

## 🟡 High Priority Vulnerabilities

### 7. Public Read Routes - No Rate Limiting

**Routes:**
- `/api/atlas/*` - All GET routes
- `/api/civic/*` - All GET routes
- `/api/categories/*` - All GET routes
- `/api/points-of-interest` - GET route
- `/api/mention-icons` - GET route

**Risk:** Database DoS, resource exhaustion

### 8. Error Message Exposure

**Routes with exposed errors:**
- `/api/contact` - Exposes Resend API errors
- `/api/address` - Exposes API errors
- Some routes expose database error messages

**Risk:** Information disclosure, reconnaissance

### 9. Missing Input Sanitization

**Routes:**
- `/api/contact` - HTML injection in email
- Routes accepting user-generated content

**Risk:** XSS, injection attacks

## 🟢 Medium Priority

### 10. Inconsistent Security Patterns
- Some routes have manual validation, others don't
- Some routes have rate limiting, others don't
- Error handling inconsistent

## Immediate Action Plan

### Phase 1: Critical Fixes (Do Now)

1. **Contact Form** (`/api/contact`)
   - [ ] Add rate limiting (strict: 10/min)
   - [ ] Add Zod validation
   - [ ] Sanitize HTML input (DOMPurify)
   - [ ] Add request size limit (1MB)

2. **Address Route** (`/api/address`)
   - [ ] Migrate to proxy route pattern
   - [ ] Add rate limiting (strict: 10/min)
   - [ ] Add input validation
   - [ ] Remove direct API key usage

3. **File Upload Routes**
   - [ ] Add rate limiting (10 uploads/min)
   - [ ] Add file content validation (magic bytes)
   - [ ] Strict filename sanitization
   - [ ] Add request size limits

4. **GraphQL Endpoint**
   - [ ] Add authentication
   - [ ] Add rate limiting
   - [ ] Add query complexity limits

### Phase 2: High Priority (This Week)

5. **Public Analytics Routes**
   - [ ] Add rate limiting to all
   - [ ] Add input validation

6. **News Routes**
   - [ ] Add rate limiting to all
   - [ ] Add input validation

7. **Error Handling**
   - [ ] Standardize error responses
   - [ ] Remove internal error exposure

## Testing Checklist

For each vulnerable route:
- [ ] Test rate limiting (send 11+ requests quickly)
- [ ] Test input validation (send invalid data)
- [ ] Test request size limits (send large payloads)
- [ ] Test error handling (verify no internal errors exposed)
- [ ] Test file uploads (malicious files, large files, wrong types)

## Estimated Impact

### If Exploited:
- **Contact Form:** Spam emails, email service costs
- **Address Route:** RapidAPI quota exhaustion ($)
- **File Uploads:** Storage costs, malicious files
- **Analytics Routes:** Database load, costs
- **GraphQL:** Complete system DoS
- **News Routes:** RapidAPI costs, database load

### Cost Impact:
- RapidAPI quota: Could cost hundreds/thousands if abused
- Storage: Could fill up storage quota
- Database: Could cause performance issues
- Email: Could hit email sending limits

## Priority Order

1. 🔴 Contact form (spam risk)
2. 🔴 Address route (API cost risk)
3. 🔴 GraphQL endpoint (DoS risk)
4. 🟡 File upload routes (storage risk)
5. 🟡 Public analytics routes (database load)
6. 🟡 News routes (API cost)
