# Map Plans Value Proposition - Conceptual Breakdown

## Current Map Settings Owners Can Configure for Editors

### Collaboration Permissions (in `settings.collaboration`)
Owners can enable/disable these for **all authenticated users** (not just members):

1. **`allow_pins`** - Let non-owners add pins to the map
2. **`allow_areas`** - Let non-owners draw areas on the map  
3. **`allow_posts`** - Let non-owners create posts with map data

**Current Limitation**: These are binary on/off for everyone. No differentiation by plan type.

### Membership Settings
- **`auto_approve_members`** - Auto-approve join requests (vs manual approval)
- **`membership_rules`** - Custom rules/terms for membership
- **`membership_questions`** - Up to 5 questions for join requests

### Appearance Settings (affects all viewers)
- **`map_style`** - street, satellite, light, dark
- **`map_layers`** - Congressional districts, CTU boundaries, state/county boundaries
- **`meta`** - Buildings, pitch, terrain, center, zoom

### Presentation Settings
- **`hide_creator`** - Hide owner identity
- **`is_featured`** - Feature on homepage/community feed

---

## Value of Owner Being Contributor/Professional/Business

### Current Plan Features (from billing schema)

#### **Hobby Plan ($0/month)**
- Limited maps (not unlimited)
- No visitor analytics
- No video uploads
- No extended text
- No collections
- No gold profile border

#### **Contributor Plan ($20/month)**
- ✅ **Unlimited Custom Maps** - Create unlimited custom maps
- ✅ **Visitor Analytics** - See who visited your profile
- ✅ **All-Time Historical Data** - Access to all historical data
- ✅ **Extended Text** - Extended text length (1,000 chars)
- ✅ **Video Uploads** - Upload videos to mentions
- ✅ **Unlimited Collections** - Create unlimited collections
- ✅ **Gold Profile Border** - Premium gold border on profile

#### **Professional Plan ($60/month)**
Includes all Contributor features PLUS:
- ✅ **Visitor Identities** - See names/details of profile visitors
- ✅ **Time-Series Charts** - View analytics in chart format
- ✅ **Export Data** - Export analytics to CSV/PDF
- ✅ **Geographic Data** - View geographic analytics
- ✅ **Referrer Tracking** - Track traffic sources
- ✅ **Real-Time Updates** - Real-time analytics updates
- ✅ **Advanced Profile Features** - Advanced profile customization

#### **Business Plan ($200/month)**
- Inherits all Professional features
- Currently no unique features (could add: team management, white-label, API access, etc.)

---

## Features Unlocked with Custom Maps (by Plan)

### Map Ownership Benefits

#### **Hobby Plan Owners**
- Can create maps (limited quantity)
- Basic map settings (appearance, collaboration toggles)
- No analytics on map views/engagement
- No advanced collaboration features

#### **Contributor Plan Owners**
- **Unlimited maps** - No limit on map creation
- **Visitor Analytics** - See who views their maps
- **All-Time Historical Data** - Full analytics history
- Can enable collaboration features (pins/areas/posts)
- Can create membership systems with questions/rules
- Can feature maps on community feed

#### **Professional Plan Owners**
All Contributor benefits PLUS:
- **Visitor Identities** - Know exactly who views their maps
- **Time-Series Charts** - Visualize map engagement over time
- **Export Data** - Export map analytics for reporting
- **Geographic Data** - See where map viewers are located
- **Referrer Tracking** - Understand how people discover maps
- **Real-Time Updates** - Live analytics dashboard

#### **Business Plan Owners**
All Professional benefits PLUS:
- Potential for team management (future)
- Potential for white-label maps (future)
- Potential for API access (future)
- Higher limits on everything

---

## Benefits of Joining Another Map (as Editor)

### Current Editor Role Capabilities
Editors can:
- **Add pins** (if `allow_pins` enabled)
- **Draw areas** (if `allow_areas` enabled)
- **Create posts** (if `allow_posts` enabled)
- **View map settings** (read-only)
- **See other members** and their roles

### Value Proposition for Joining

1. **Collaborative Mapping**
   - Contribute to community-driven maps
   - Add local knowledge, points of interest
   - Build collective geographic knowledge

2. **Access to Curated Content**
   - Join maps created by experts/organizations
   - Access specialized map layers and data
   - Benefit from owner's plan features (analytics, etc.)

3. **Community Engagement**
   - Connect with other map contributors
   - Participate in collaborative projects
   - Build reputation through contributions

4. **Learning & Discovery**
   - See how others structure maps
   - Learn mapping best practices
   - Discover new geographic data sources

### Current Limitation
**No differentiation by editor's plan type** - A Hobby user gets the same editor permissions as a Business user on the same map.

---

## Can Owners Allow Different Value for Different Plan Types?

### Current State: **NO**

Currently, collaboration settings (`allow_pins`, `allow_areas`, `allow_posts`) are:
- **Binary toggles** - Either everyone can do it, or no one can
- **Not plan-aware** - No way to say "only Contributor+ can add pins"
- **Not role-aware beyond owner/manager/editor** - Editors all have same permissions

### Potential Enhancement: Plan-Based Editor Permissions

**Concept**: Owners could configure different collaboration levels based on editor's plan:

```typescript
settings: {
  collaboration: {
    // Current: binary for everyone
    allow_pins: boolean,
    allow_areas: boolean,
    allow_posts: boolean,
    
    // Proposed: plan-based permissions
    pin_permissions: {
      hobby: false,        // Hobby users cannot add pins
      contributor: true,   // Contributor+ can add pins
      professional: true,
      business: true
    },
    area_permissions: {
      hobby: false,
      contributor: true,
      professional: true,
      business: true
    },
    post_permissions: {
      hobby: false,
      contributor: false,   // Only Professional+ can create posts
      professional: true,
      business: true
    },
    
    // Advanced: role + plan combinations
    manager_permissions: {
      // Managers always get full access regardless of plan
      can_manage_members: true,
      can_edit_settings: true,
      can_delete_content: true
    }
  }
}
```

### Value of Plan-Based Permissions

**For Map Owners:**
- **Quality Control** - Restrict editing to paid users (reduces spam/low-quality content)
- **Monetization Incentive** - Encourages users to upgrade to contribute
- **Tiered Collaboration** - Different contribution levels for different plan tiers

**For Editors:**
- **Upgrade Incentive** - "Upgrade to Contributor to add pins to this map"
- **Status Recognition** - Higher plans = more contribution privileges
- **Value Perception** - Paid plans unlock more collaborative features

**For Platform:**
- **Revenue Driver** - Creates clear upgrade path
- **Engagement** - Paid users more likely to contribute quality content
- **Differentiation** - Clear value proposition for each plan tier

---

## Conceptualization: "For the Love of Minnesota Plans" Value

### Core Value Proposition

**Maps are collaborative canvases** where:
1. **Owners** create and curate maps (benefit from plan features)
2. **Editors** contribute content (benefit from joining curated maps)
3. **Plan tiers** unlock different levels of ownership AND editing capabilities

### Three-Layer Value Model

#### Layer 1: Map Ownership Value
**"What can I do with MY maps?"**

- **Hobby**: Basic maps, limited quantity
- **Contributor**: Unlimited maps + analytics + collaboration tools
- **Professional**: Advanced analytics + export + geographic insights
- **Business**: Enterprise features + team management

#### Layer 2: Map Editing Value  
**"What can I do on OTHER people's maps?"**

**Current**: Same permissions for all editors (if enabled)

**Proposed**:
- **Hobby**: View-only (or very limited editing)
- **Contributor**: Can add pins/areas on maps that allow it
- **Professional**: Can add pins/areas/posts + access to advanced map features
- **Business**: Full editing + potential for manager roles on business maps

#### Layer 3: Cross-Map Value
**"How do maps create network effects?"**

- **Discovery**: Higher-tier plans can discover/join more maps
- **Visibility**: Professional/Business maps featured more prominently
- **Analytics**: Owners see who contributes (plan-based insights)
- **Reputation**: Contributors build reputation across maps

### Specific Feature Ideas by Plan

#### Hobby → Contributor Upgrade Value
**Ownership:**
- Unlimited maps (vs limited)
- Visitor analytics
- Video uploads
- Extended text

**Editing:**
- Can add pins/areas on public maps (if enabled)
- Can join maps with membership questions
- Can request membership on private maps

#### Contributor → Professional Upgrade Value
**Ownership:**
- Visitor identities (know your audience)
- Time-series analytics
- Export data
- Geographic insights
- Referrer tracking

**Editing:**
- Can create posts on maps (if enabled)
- Priority in membership requests
- Access to professional-only map features
- Can see map analytics (if owner allows)

#### Professional → Business Upgrade Value
**Ownership:**
- Team management (future)
- White-label maps (future)
- API access (future)
- Higher limits

**Editing:**
- Can become managers on business maps
- Can access business-only collaboration features
- Priority support
- Cross-map analytics dashboard

### Implementation Strategy

#### Phase 1: Plan-Aware Collaboration Settings
```sql
-- Add plan-based permissions to map settings
ALTER TABLE public.map
  ADD COLUMN collaboration_permissions JSONB DEFAULT '{}'::jsonb;

-- Example structure:
{
  "pins": {
    "hobby": false,
    "contributor": true,
    "professional": true,
    "business": true
  },
  "areas": {
    "hobby": false,
    "contributor": true,
    "professional": true,
    "business": true
  },
  "posts": {
    "hobby": false,
    "contributor": false,
    "professional": true,
    "business": true
  }
}
```

#### Phase 2: Editor Plan Detection
- Check editor's plan when they try to add pins/areas/posts
- Show upgrade prompts if their plan doesn't allow action
- Display plan-based permissions in map settings UI

#### Phase 3: Advanced Features
- Plan-based map discovery (Professional+ maps)
- Plan-based analytics sharing
- Plan-based manager role assignment
- Cross-map contribution tracking

### Marketing Messaging

#### For Map Owners
- **"Unlock unlimited maps and analytics with Contributor"**
- **"See who's viewing and contributing with Professional"**
- **"Manage teams and white-label maps with Business"**

#### For Map Editors
- **"Upgrade to Contributor to add pins to community maps"**
- **"Upgrade to Professional to create posts and access advanced features"**
- **"Join Business maps as a manager with Business plan"**

#### For Platform
- **"Maps are collaborative - your plan unlocks both ownership AND editing capabilities"**
- **"Higher plans = more ways to contribute to the community"**
- **"Owners can restrict editing to paid users for quality control"**

---

## Summary: Current vs. Ideal State

### Current State
- ✅ Owners can enable/disable collaboration (binary)
- ✅ Plan tiers unlock ownership features (unlimited maps, analytics)
- ❌ No plan-based differentiation for editors
- ❌ All editors have same permissions (if enabled)
- ❌ No upgrade incentive for editing capabilities

### Ideal State
- ✅ Owners can set plan-based collaboration permissions
- ✅ Editors' plan determines what they can contribute
- ✅ Clear upgrade path: Hobby → Contributor → Professional → Business
- ✅ Both ownership AND editing value increase with plan tier
- ✅ Network effects: Higher plans unlock more collaborative opportunities

### Key Insight
**Maps are both a creation tool AND a collaboration platform.** The value proposition should reflect both:
1. **What you can create** (ownership value)
2. **What you can contribute** (editing value)

Currently, only #1 is plan-gated. Adding #2 creates a more compelling, multi-dimensional value proposition that drives upgrades at every tier.
