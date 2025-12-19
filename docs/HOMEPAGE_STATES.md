# Homepage State Management

## Overview

The homepage uses a centralized state management system (`useHomepageState`) to ensure only one modal/component is shown at a time and to handle all user interactions properly.

## State Types

### Modal States
- `none` - No modal is open
- `welcome` - Welcome/sign-in modal is open
- `account` - Account modal is open (with optional tab)
- `create-pin` - Create pin modal is open

### Sidebar State
- `isSidebarOpen` - Whether the location sidebar is visible
- Sidebar is automatically closed when any modal opens
- Sidebar can only be opened when `modalState === 'none'`

### Pin Creation State
- `createPinCoordinates` - Coordinates for the pin being created (null when not creating)

## State Transitions

### 1. Initial Load (No User)
**State:**
- `modalState: 'welcome'`
- `isSidebarOpen: false`

**User Sees:**
- Welcome modal with sign-in form
- Map in background (not interactive)

**User Actions:**
- Sign in → Transitions to authenticated state
- Continue as guest → Closes welcome modal, opens sidebar

---

### 2. Authenticated, No Username (Incomplete Account)
**State:**
- `modalState: 'account'`
- `accountModalTab: 'onboarding'`
- `isSidebarOpen: false`
- `isAccountComplete: false`

**User Sees:**
- Account modal with onboarding tab (other tabs disabled)
- Cannot close modal until account is complete

**User Actions:**
- Complete onboarding → Account becomes complete, modal can be closed
- Modal cannot be closed until username is set

---

### 3. Authenticated, Complete Account
**State:**
- `modalState: 'none'`
- `isSidebarOpen: true`
- `isAccountComplete: true`

**User Sees:**
- Map with location sidebar open
- No modals

**User Actions:**
- Click map → Sidebar shows location details, temporary pin appears
- Click "Create Pin" → Opens create pin modal
- Click account button → Opens account modal

---

### 4. Map Click (Pin Drop)
**State:**
- `modalState: 'none'`
- `isSidebarOpen: true`
- Temporary pin visible on map

**User Sees:**
- Location sidebar with location details
- Temporary red pulsing pin on map
- "Create Pin" button in sidebar

**User Actions:**
- Click "Create Pin" → Transitions to create pin modal
- Click elsewhere on map → Updates location, moves temporary pin
- Click existing pin → Shows pin details in sidebar

**Note:** Map clicks are ignored if a modal is open (welcome, account, or create-pin)

---

### 5. Create Pin Modal
**State:**
- `modalState: 'create-pin'`
- `createPinCoordinates: { lat, lng }`
- `isSidebarOpen: false`
- Temporary pin remains visible

**User Sees:**
- Create pin modal (bottom sheet)
- Temporary pin still visible on map
- Form to enter pin details

**User Actions:**
- Fill form and save → Pin created, modal closes, temporary pin removed
- Click back button → Returns to location sidebar (temporary pin remains)
- Click close/cancel → Modal closes, temporary pin removed

---

### 6. Account Modal (Complete Account)
**State:**
- `modalState: 'account'`
- `accountModalTab: 'settings' | 'analytics' | 'notifications' | 'billing'`
- `isSidebarOpen: false`

**User Sees:**
- Account modal with selected tab
- All tabs accessible (account is complete)

**User Actions:**
- Switch tabs → Updates `accountModalTab`
- Close modal → Returns to map with sidebar open

---

## State Management Rules

### Modal Priority
1. **Welcome modal** - Highest priority (blocks everything when user not authenticated)
2. **Account modal (incomplete)** - Blocks everything until account is complete
3. **Account modal (complete)** - Can be closed, blocks sidebar
4. **Create pin modal** - Blocks sidebar, can be closed

### Sidebar Rules
- Sidebar can only open when `modalState === 'none'`
- Sidebar automatically closes when any modal opens
- Map clicks are ignored if sidebar cannot open (modal blocking)

### Pin Creation Rules
- Temporary pin appears on map click
- Temporary pin remains when transitioning from sidebar to create pin modal
- Temporary pin is removed when:
  - Pin is successfully created
  - Create pin modal is cancelled/closed (not via back button)

### Account Completeness Rules
- Incomplete accounts cannot close account modal
- Incomplete accounts are forced to onboarding tab
- Other tabs are disabled when account is incomplete
- Account completeness is checked on:
  - User authentication
  - Account data updates
  - Modal open

## Implementation Details

### useHomepageState Hook
Centralized hook that manages all homepage state:
- Tracks modal state, sidebar state, pin coordinates
- Handles user authentication state changes
- Checks account completeness automatically
- Provides functions to open/close modals and manage sidebar

### State Transitions
All state transitions go through the hook's update functions:
- `openWelcomeModal()` - Opens welcome modal, closes sidebar
- `closeWelcomeModal()` - Closes welcome modal, opens sidebar
- `openAccountModal(tab?)` - Opens account modal with optional tab
- `closeAccountModal()` - Closes account modal (if account complete)
- `openCreatePinModal(coordinates)` - Opens create pin modal
- `closeCreatePinModal()` - Closes create pin modal
- `backFromCreatePin()` - Returns to sidebar from create pin modal
- `openSidebarForMapClick()` - Opens sidebar for map click (only if no modal)

### Preventing Multiple Modals
The state management ensures only one modal can be open at a time:
- Opening a new modal automatically closes any open modal
- State transitions are atomic (all updates happen together)
- Modal state is a single enum, not multiple boolean flags

## User Experience Flow

### New User Journey
1. Load page → Welcome modal
2. Sign in → Account modal (onboarding tab)
3. Complete onboarding → Map with sidebar
4. Click map → Location sidebar with temporary pin
5. Click "Create Pin" → Create pin modal
6. Create pin → Back to map, pin appears

### Returning User Journey
1. Load page → Map with sidebar (if authenticated)
2. Click map → Location sidebar updates
3. Click "Create Pin" → Create pin modal
4. Create pin → Back to map

### Guest User Journey
1. Load page → Welcome modal
2. Continue as guest → Map with sidebar
3. Click map → Location sidebar (limited functionality)


