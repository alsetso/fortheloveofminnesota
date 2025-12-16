# Guest Accounts UX Flow

## Overview

The platform supports both **Guest** and **Authenticated User** accounts. A user can have both simultaneously:
- **Guest Account**: Stored in local storage, identified by `guest_id`, has `user_id = NULL`
- **Authenticated Account**: Linked to email/auth, identified by `user_id`, has `guest_id = NULL`

## User Experience Flow

### 1. Guest User Journey

#### First Visit (No Auth)
1. User visits site → No authentication
2. System checks `localStorage` for `mnuda_guest_id`
3. If not found → Generate new `guest_id` (e.g., `guest_550e8400-e29b-41d4-a716-446655440000`)
4. Store `guest_id` in `localStorage.mnuda_guest_id`
5. User can:
   - View public pins and accounts
   - Post pins (creates/uses guest account automatically)
   - Set guest name (stored in `localStorage.mnuda_guest_name`)

#### Guest Account Creation
- **Lazy Creation**: Guest account is created in database only when user posts their first pin
- **Function**: `get_or_create_guest_account(guest_id, first_name)`
- **Account Structure**:
  ```sql
  {
    id: UUID (database generated),
    guest_id: TEXT (from localStorage),
    user_id: NULL,
    first_name: TEXT (from localStorage or "Guest"),
    role: 'general'
  }
  ```

#### Guest Pin Posting
1. User clicks "Create Pin"
2. `PublicMapPinService.createPin()` detects no authenticated user
3. Calls `GuestAccountService.getOrCreateGuestAccount()`
4. Uses guest account `id` to create pin
5. Pin is linked to guest account: `pin.account_id = guest_account.id`

### 2. Authenticated User Journey

#### Sign In Flow
1. User signs in with email/password or OTP
2. `AuthContext` detects authentication state change
3. `useGuestAccountMerge` hook detects if guest data exists
4. If guest data found → Show merge modal

#### Guest Account Merge
When user signs in and has guest data:

**Detection:**
- `GuestAccountService.hasGuestData()` checks `localStorage.mnuda_guest_id`
- If exists → Fetch guest account from database
- Check if guest account has pins

**Merge Options:**
1. **Merge Pins** (Recommended)
   - Transfers all pins from guest account to authenticated account
   - Deletes guest account (optional)
   - Clears guest data from localStorage
   - User sees all their pins in one place

2. **Dismiss**
   - Keeps guest account separate
   - Clears guest data from localStorage
   - Guest pins remain on guest account (visible to public)

**Merge Process:**
```typescript
// Database function: merge_guest_account_into_user()
// 1. Verify guest account (user_id IS NULL)
// 2. Verify user account (user_id = auth.uid())
// 3. UPDATE pins SET account_id = user_account_id WHERE account_id = guest_account_id
// 4. Optionally DELETE guest account
// 5. Return: { pins_transferred: number, guest_account_deleted: boolean }
```

### 3. Account States

#### State 1: Pure Guest
```
localStorage:
  - mnuda_guest_id: "guest_xxx"
  - mnuda_guest_name: "John"

Database:
  - accounts: { id: uuid, guest_id: "guest_xxx", user_id: NULL }
  - pins: [{ account_id: uuid, ... }]
```

#### State 2: Authenticated (No Guest Data)
```
localStorage:
  - (no guest data)

Database:
  - accounts: { id: uuid, user_id: auth_user_id, guest_id: NULL }
  - pins: [{ account_id: uuid, ... }]
```

#### State 3: Both (During Transition)
```
localStorage:
  - mnuda_guest_id: "guest_xxx" (still exists)
  - mnuda_guest_name: "John"

Database:
  - accounts: [
      { id: uuid1, guest_id: "guest_xxx", user_id: NULL },  // Guest
      { id: uuid2, user_id: auth_user_id, guest_id: NULL }   // User
    ]
  - pins: [
      { account_id: uuid1, ... },  // Guest pins
      { id: uuid2, ... }            // User pins (if any)
    ]
```

#### State 4: Merged
```
localStorage:
  - (guest data cleared)

Database:
  - accounts: { id: uuid, user_id: auth_user_id, guest_id: NULL }
  - pins: [{ account_id: uuid, ... }]  // All pins merged
```

## Technical Details

### Local Storage Keys
- `mnuda_guest_id`: Unique guest identifier (persists across sessions)
- `mnuda_guest_name`: Guest's display name (optional)

### Database Schema
```sql
accounts:
  - id: UUID (primary key)
  - user_id: UUID | NULL (FK to auth.users, NULL for guests)
  - guest_id: TEXT | NULL (unique, NULL for authenticated users)
  - first_name: TEXT
  - CONSTRAINT: user_id IS NOT NULL OR guest_id IS NOT NULL

pins:
  - id: UUID
  - account_id: UUID (FK to accounts)
  - visibility: 'public' | 'only_me'
```

### RLS Policies

**Accounts:**
- Anonymous users can view accounts with public pins
- Anonymous users can view their own guest account
- Anonymous users can insert guest accounts (user_id IS NULL, guest_id IS NOT NULL)

**Pins:**
- Anyone can view public pins
- Authenticated users can view their own private pins
- Authenticated users can insert pins (must own account)
- Anonymous users can insert pins (must use guest account)

### Key Functions

1. **`get_or_create_guest_account(guest_id, first_name)`**
   - Gets existing guest account or creates new one
   - Returns account UUID
   - Called automatically when guest posts pin

2. **`merge_guest_account_into_user(guest_account_id, user_account_id, delete_guest)`**
   - Transfers all pins from guest to user account
   - Optionally deletes guest account
   - Only callable by authenticated user
   - Verifies ownership before merging

## UX Considerations

### When to Show Merge Modal
- User just signed in
- Guest data exists in localStorage
- Guest account has pins (pin_count > 0)
- User account is fully loaded

### Merge Modal Content
- Show number of pins to be merged
- Show guest account name
- Options: "Merge Pins" or "Dismiss"
- Loading state during merge
- Error handling if merge fails

### Edge Cases

1. **Guest signs in, no pins**
   - Don't show merge modal (nothing to merge)
   - Optionally clear guest data silently

2. **User signs out**
   - Guest data can be recreated
   - Previous guest account still exists (if not merged)
   - User can continue as guest with new guest_id

3. **Multiple devices**
   - Each device has its own `guest_id` in localStorage
   - Each device creates separate guest account
   - Merging only affects one device's guest account
   - User can merge from any device

4. **Guest account already merged**
   - `getGuestAccountByGuestId()` returns null
   - No merge modal shown
   - Guest data can be cleared

## Implementation Files

- **Migration**: `218_enable_guest_accounts_and_pins.sql`
- **Merge Function**: `219_merge_guest_account_function.sql`
- **Service**: `src/features/auth/services/guestAccountService.ts`
- **Hook**: `src/features/auth/hooks/useGuestAccountMerge.ts`
- **Modal**: `src/components/auth/GuestAccountMergeModal.tsx`
- **Pin Service**: `src/features/_archive/map-pins/services/publicMapPinService.ts`

## Usage Example

```typescript
// In a component that handles auth state changes
import { useGuestAccountMerge } from '@/features/auth/hooks/useGuestAccountMerge';
import { GuestAccountMergeModal } from '@/components/auth/GuestAccountMergeModal';

function MyComponent() {
  const { user } = useAuth();
  const { state } = useGuestAccountMerge();
  const [showMergeModal, setShowMergeModal] = useState(false);

  useEffect(() => {
    if (user && state.hasGuestData && state.pinCount > 0) {
      setShowMergeModal(true);
    }
  }, [user, state]);

  return (
    <>
      {/* Your app content */}
      <GuestAccountMergeModal 
        isOpen={showMergeModal} 
        onClose={() => setShowMergeModal(false)} 
      />
    </>
  );
}
```


