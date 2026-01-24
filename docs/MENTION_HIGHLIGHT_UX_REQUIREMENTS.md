# Mention Highlight UX Requirements

## What's Missing

### Current Implementation
- ✅ Navigates to `/live?lat=...&lng=...` when clicking mention
- ✅ Map zooms to location
- ✅ Sheet opens with all mentions at location
- ❌ **Missing:** Mention ID not passed in URL
- ❌ **Missing:** Specific mention not highlighted on map
- ❌ **Missing:** Specific mention not highlighted in sheet
- ❌ **Missing:** No visual indication which mention was clicked

### What Needs to Happen

## UX Requirements (Plain English)

### 1. When User Clicks Mention in Feed
- Navigate to `/live?lat=44.9778&lng=-93.2650&mentionId=abc-123`
- URL includes the specific mention ID

### 2. Map Behavior
- Map zooms to the mention's location
- **The specific mention pin should be highlighted:**
  - Option A: Pin pulses (animated glow/pulse effect)
  - Option B: Pin is larger than other pins
  - Option C: Pin has a colored ring/border around it
  - Option D: Pin shows a popup/tooltip automatically
  - **Best:** Combination - larger pin + colored ring + optional popup

### 3. Mentions Sheet Behavior
- Sheet opens automatically
- **The clicked mention should be:**
  - Highlighted with different background color (e.g., blue background)
  - Scrolled into view (if not at top)
  - Maybe has a "You clicked this" indicator
  - Positioned at top of list (even if not closest)

### 4. Visual Hierarchy
- **On Map:**
  - Selected mention: Larger, colored ring, maybe pulsing
  - Other mentions: Normal size, standard appearance
  - Clear visual distinction

- **In Sheet:**
  - Selected mention: Blue/colored background, maybe border
  - Other mentions: Gray background
  - Selected mention at top or clearly marked

### 5. User Can See Context
- User understands which mention they clicked
- User can see other mentions at same location
- User can click other mentions to switch selection
- User can close sheet and see highlighted mention on map

## Technical Requirements

### URL Parameters
- Add `mentionId` parameter: `/live?lat=...&lng=...&mentionId=...`
- Parse `mentionId` from URL
- Pass to map layer for highlighting
- Pass to sheet for highlighting

### Map Highlighting
- MentionsLayer needs to support highlighting a specific mention ID
- Add highlight layer or modify existing pin style
- Use Mapbox expressions to make selected pin larger/different color
- Or add separate highlight source/layer for selected mention

### Sheet Highlighting
- LocationMentionsSheet needs `selectedMentionId` prop
- Highlight the matching mention in the list
- Scroll to it on open
- Maybe move it to top of list

### State Management
- Track selected mention ID from URL
- Pass to MentionsLayer component
- Pass to LocationMentionsSheet component
- Clear when sheet closes or user navigates away

## Implementation Plan

### Step 1: Update MentionCard
- Add `mentionId` to URL: `/live?lat=...&lng=...&mentionId={mention.id}`

### Step 2: Update URL State Hook
- Parse `mentionId` from URL
- Include in `urlState` object

### Step 3: Update MentionsLayer
- Accept `selectedMentionId` prop
- Add highlight layer or modify pin style for selected mention
- Make selected pin visually distinct (larger, colored ring, pulse)

### Step 4: Update LocationMentionsSheet
- Accept `selectedMentionId` prop
- Highlight matching mention in list
- Scroll to it on open
- Move it to top of list

### Step 5: Update Live Page
- Pass `selectedMentionId` from URL to MentionsLayer
- Pass `selectedMentionId` from URL to LocationMentionsSheet
