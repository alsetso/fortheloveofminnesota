# Admin Impersonation for Analytics Tracking

## Overview

Admins can select any account from the account dropdown to track analytics as that account. This allows admins to view analytics from the perspective of any user account.

## Implementation

### Context: `AdminImpersonationContext`

**Location:** `src/contexts/AdminImpersonationContext.tsx`

**Features:**
- Stores selected account ID for impersonation
- Fetches all accounts for admin selection
- Persists selection in localStorage
- Only active for admin users

**Usage:**
```tsx
const { selectedAccountId, setSelectedAccountId, isImpersonating } = useAdminImpersonation();
```

### Account Dropdown Integration

**Location:** `src/features/auth/components/AccountDropdown.tsx`

**Features:**
- Shows "Admin: Track As" section (admin only)
- Lists all accounts (up to 20)
- Highlights selected account
- Shows indicator when impersonating

**UI:**
- Section appears below regular account switching
- Selected account has blue background
- Shows "Tracking analytics as selected account" message when active

### Analytics Tracking Integration

**Location:** `src/hooks/usePageView.ts`

**Changes:**
- Automatically uses `selectedAccountId` from `AdminImpersonationContext` if admin is impersonating
- Passes `account_id` in payload to API

**API Route:** `src/app/api/analytics/view/route.ts`

**Security:**
- Verifies requester is admin before accepting `account_id`
- Verifies target account exists
- Returns 403 if non-admin tries to impersonate
- Returns 404 if target account doesn't exist

## User Experience

### For Admins

1. **Select Account:**
   - Open account dropdown
   - Scroll to "Admin: Track As" section
   - Click any account to select it
   - Selection persists across page reloads

2. **Clear Selection:**
   - Click "Your account" to clear selection
   - Or click selected account again to deselect

3. **Visual Indicators:**
   - Selected account has blue background
   - Blue dot indicator on selected account
   - Message: "Tracking analytics as selected account"

### For Non-Admins

- "Admin: Track As" section is hidden
- No impact on normal analytics tracking

## Security

### Verification

1. **Admin Check:**
   - API verifies requester's account has `role = 'admin'`
   - Returns 403 if not admin

2. **Account Validation:**
   - Verifies target account exists
   - Returns 404 if account not found

3. **Client-Side:**
   - Only admins see the selection UI
   - Selection stored in localStorage (client-side only)
   - Server always verifies admin status

## Data Flow

### Tracking Flow

1. **Page Load:**
   - `PageWrapper` calls `usePageView()`
   - `usePageView` checks `AdminImpersonationContext`
   - If impersonating, includes `account_id` in payload

2. **API Request:**
   - POST `/api/analytics/view`
   - Payload includes `account_id` if provided
   - API verifies admin access
   - Records view with selected account ID

3. **Database:**
   - `url_visits` table stores `account_id`
   - Analytics queries use this account ID
   - View counts attributed to selected account

## Storage

### localStorage

**Key:** `admin_selected_account_id`

**Value:** Account ID (UUID string)

**Persistence:**
- Saved when admin selects account
- Cleared when admin deselects or logs out
- Loaded on page mount

## API Endpoints

### POST `/api/analytics/view`

**Request Body:**
```json
{
  "page_url": "/feed",
  "referrer_url": "https://google.com",
  "user_agent": "Mozilla/5.0...",
  "session_id": "uuid-here",
  "account_id": "uuid-here"  // Optional - admin impersonation
}
```

**Response:**
```json
{
  "success": true,
  "view_id": "uuid-here"
}
```

**Errors:**
- `403`: Admin access required (if non-admin provides account_id)
- `404`: Target account not found

## Future Enhancements

1. **Admin API Endpoint:**
   - Create `/api/admin/accounts` to fetch all accounts
   - Currently falls back to `/api/accounts` (user's accounts only)

2. **Impersonation Scope:**
   - Could extend to other operations (not just analytics)
   - Could add impersonation indicator in UI

3. **Audit Log:**
   - Track when admins impersonate accounts
   - Log impersonation events for security

4. **Time Limits:**
   - Auto-clear impersonation after X minutes
   - Session-based impersonation

## Testing

### Manual Testing

1. **As Admin:**
   - [ ] Open account dropdown
   - [ ] See "Admin: Track As" section
   - [ ] Select an account
   - [ ] Verify selection persists on reload
   - [ ] Visit a page
   - [ ] Check `url_visits` table - verify `account_id` matches selected account

2. **As Non-Admin:**
   - [ ] Open account dropdown
   - [ ] Verify "Admin: Track As" section is hidden
   - [ ] Analytics tracking works normally

3. **Security:**
   - [ ] Try to send `account_id` as non-admin (should fail)
   - [ ] Try invalid `account_id` (should fail)
   - [ ] Verify admin check works correctly
