/**
 * Profile Types
 * 
 * Shared type definitions for the profile page and related components.
 * Single source of truth for Pin, Account, and Ownership types.
 */

// =============================================================================
// PIN TYPES
// =============================================================================

// ProfilePin is now an alias for Mention (mentions table)
export interface ProfilePin {
  id: string;
  lat: number;
  lng: number;
  description: string | null;
  collection_id: string | null;
  visibility: PinVisibility;
  image_url?: string | null;
  video_url?: string | null;
  media_type?: 'image' | 'video' | 'none';
  created_at: string;
  updated_at: string;
}

export type PinVisibility = 'public' | 'only_me';

// =============================================================================
// ACCOUNT TYPES
// =============================================================================

export interface ProfileAccount {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  image_url: string | null;
  cover_image_url: string | null;
  bio: string | null;
  city_id: string | null;
  view_count: number;
  traits: string[] | null;
  user_id: string | null;
  plan?: string | null;
  role?: string | null; // User role: 'user' | 'admin'
  subscription_status?: string | null; // Stripe subscription status
  billing_mode?: string | null; // Billing mode configuration
  created_at: string;
}

// =============================================================================
// OWNERSHIP TYPES
// =============================================================================

export type ViewerType = 'authenticated' | 'anonymous';

export interface ViewerInfo {
  type: ViewerType;
  userId?: string;
  email?: string;
}

export interface ProfileOwnership {
  /** True if viewer owns this profile (server-confirmed for auth users, client-confirmed for guests) */
  isOwner: boolean;
  /** True if the profile belongs to a guest account (no user_id) */
  isGuestAccount: boolean;
  /** Current view mode - owner can toggle to 'visitor' to preview */
  viewMode: 'owner' | 'visitor';
  /** Effective permissions based on ownership + viewMode */
  canEdit: boolean;
  canCreatePin: boolean;
  canSeePrivatePins: boolean;
  /** Information about who is viewing */
  viewer: ViewerInfo | null;
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const TRAIT_OPTIONS = [
  // ❤️ Emotional & Meaning
  { id: 'sentimental', label: '❤️ Sentimental' },
  { id: 'nostalgic', label: '🫶 Nostalgic' },
  { id: 'reflective', label: '🌅 Reflective' },
  { id: 'introspective', label: '🧠 Introspective' },
  { id: 'peace-seeking', label: '🕊️ Peace-Seeking' },
  { id: 'hopeful', label: '🌈 Hopeful' },
  { id: 'healing', label: '💔 Healing' },
  { id: 'grateful', label: '🙏 Grateful' },
  // 🌲 Care, Stewardship & Responsibility
  { id: 'steward', label: '🌲 Steward' },
  { id: 'protector', label: '🛡️ Protector' },
  { id: 'guardian', label: '⚠️ Guardian' },
  { id: 'caretaker', label: '🌱 Caretaker' },
  { id: 'sustainability-minded', label: '♻️ Sustainability-Minded' },
  { id: 'prepared', label: '🧯 Prepared' },
  { id: 'duty-driven', label: '🧭 Duty-Driven' },
  // 🧭 Exploration & Curiosity
  { id: 'explorer', label: '🧭 Explorer' },
  { id: 'curious', label: '🔍 Curious' },
  { id: 'wanderer', label: '🗺️ Wanderer' },
  { id: 'adventurous', label: '🌄 Adventurous' },
  { id: 'experimental', label: '🧪 Experimental' },
  { id: 'traveler', label: '🧳 Traveler' },
  // 🏘️ Belonging & Place Identity
  { id: 'localist', label: '🏘️ Localist' },
  { id: 'rooted', label: '🏡 Rooted' },
  { id: 'neighborhood-focused', label: '🧱 Neighborhood-Focused' },
  { id: 'hometown-proud', label: '🪵 Hometown-Proud' },
  { id: 'belonging-driven', label: '🫂 Belonging-Driven' },
  { id: 'place-attached', label: '📍 Place-Attached' },
  // 🧑‍🤝‍🧑 Social & Community Energy
  { id: 'connector', label: '🧑‍🤝‍🧑 Connector' },
  { id: 'relationship-builder', label: '🤝 Relationship-Builder' },
  { id: 'organizer', label: '📣 Organizer' },
  { id: 'gatherer', label: '🎉 Gatherer' },
  { id: 'helper', label: '🛟 Helper' },
  { id: 'supportive', label: '🫶 Supportive' },
  { id: 'communicative', label: '🗣️ Communicative' },
  // 🧑‍🎨 Expression & Creativity
  { id: 'storyteller', label: '🧑‍🎨 Storyteller' },
  { id: 'writer', label: '✍️ Writer' },
  { id: 'expressive', label: '🎭 Expressive' },
  { id: 'documentarian', label: '📸 Documentarian' },
  { id: 'artistic', label: '🎶 Artistic' },
  { id: 'poetic', label: '🪶 Poetic' },
  // 🧠 Observation & Insight
  { id: 'observer', label: '🧠 Observer' },
  { id: 'pattern-seeker', label: '📊 Pattern-Seeker' },
  { id: 'analytical', label: '🧩 Analytical' },
  { id: 'detail-oriented', label: '🔎 Detail-Oriented' },
  { id: 'context-aware', label: '🧭 Context-Aware' },
  { id: 'systems-thinking', label: '🧠 Systems-Thinking' },
  // 🧓 Time, Memory & Legacy
  { id: 'keeper-of-memory', label: '🧓 Keeper of Memory' },
  { id: 'historian', label: '🕰️ Historian' },
  { id: 'archivist', label: '📜 Archivist' },
  { id: 'tradition-oriented', label: '🌾 Tradition-Oriented' },
  { id: 'legacy-minded', label: '🧬 Legacy-Minded' },
  { id: 'remembrance-focused', label: '🪦 Remembrance-Focused' },
  // 🌆🌾 Environment Orientation
  { id: 'urban-focused', label: '🌆 Urban-Focused' },
  { id: 'city-oriented', label: '🏙️ City-Oriented' },
  { id: 'infrastructure-aware', label: '🚇 Infrastructure-Aware' },
  { id: 'development-curious', label: '🏗️ Development-Curious' },
  { id: 'pedestrian-minded', label: '🚶 Pedestrian-Minded' },
  { id: 'rural-rooted', label: '🌾 Rural-Rooted' },
  { id: 'land-connected', label: '🚜 Land-Connected' },
  { id: 'nature-centered', label: '🌲 Nature-Centered' },
  { id: 'outdoor-oriented', label: '🐟 Outdoor-Oriented' },
  { id: 'solitude-seeking', label: '🌌 Solitude-Seeking' },
  // ⚙️ Practical & Situational Awareness
  { id: 'problem-solver', label: '🧰 Problem-Solver' },
  { id: 'fixer', label: '🛠️ Fixer' },
  { id: 'navigator', label: '📍 Navigator' },
  { id: 'watchful', label: '🕵️ Watchful' },
  { id: 'safety-focused', label: '🧯 Safety-Focused' },
  // 🌱 Engagement Style
  { id: 'quiet-participant', label: '🌱 Quiet Participant' },
  { id: 'conversational', label: '💬 Conversational' },
  { id: 'selective', label: '✋ Selective' },
  { id: 'repeat-visitor', label: '🔁 Repeat Visitor' },
  { id: 'saver', label: '📌 Saver' },
  { id: 'reactor', label: '❤️ Reactor' },
  // 🧘 Energy, Pace & Rhythm
  { id: 'slow-paced', label: '🧘 Slow-Paced' },
  { id: 'high-energy', label: '⚡ High-Energy' },
  { id: 'optimistic', label: '🌤️ Optimistic' },
  { id: 'contemplative', label: '🌫️ Contemplative' },
  { id: 'emotionally-fluid', label: '🌊 Emotionally Fluid' },
  { id: 'seasonally-adaptive', label: '🔄 Seasonally Adaptive' },
  // 💼 Economic Participation & Work
  { id: 'business-owner', label: '🧑‍💼 Business Owner' },
  { id: 'local-shop-owner', label: '🏪 Local Shop Owner' },
  { id: 'hospitality-operator', label: '🍽️ Hospitality Operator' },
  { id: 'property-owner', label: '🏗️ Property Owner' },
  { id: 'side-hustler', label: '🧩 Side-Hustler' },
  { id: 'service-provider', label: '🛠️ Service Provider' },
  { id: 'tradesperson', label: '🧰 Tradesperson' },
  { id: 'builder', label: '👷 Builder' },
  { id: 'technician', label: '🧑‍🔧 Technician' },
  { id: 'creative-worker', label: '🧑‍🎨 Creative Worker' },
  { id: 'educator', label: '🧑‍🏫 Educator' },
  { id: 'care-worker', label: '🧑‍⚕️ Care Worker' },
  { id: 'food-worker', label: '🧑‍🍳 Food Worker' },
  { id: 'remote-worker', label: '🧑‍💻 Remote Worker' },
  { id: 'mobile-worker', label: '🚚 Mobile Worker' },
  { id: 'gig-contract-worker', label: '🧳 Gig / Contract Worker' },
  { id: 'student-worker', label: '🧑‍🎓 Student Worker' },
  { id: 'retired-semi-retired', label: '🧓 Retired / Semi-Retired' },
  // 🔁 Value Creation & Commerce Style
  { id: 'knowledge-based', label: '🧠 Knowledge-Based' },
  { id: 'hands-on', label: '✋ Hands-On' },
  { id: 'creative-driven', label: '🎨 Creative-Driven' },
  { id: 'product-based', label: '📦 Product-Based' },
  { id: 'relationship-based', label: '🤝 Relationship-Based' },
  { id: 'process-driven', label: '⚙️ Process-Driven' },
  { id: 'advisory-focused', label: '🧭 Advisory-Focused' },
  { id: 'local-consumer', label: '🛍️ Local Consumer' },
  { id: 'buy-local-advocate', label: '🌱 Buy-Local Advocate' },
  { id: 'circular-economy-minded', label: '♻️ Circular-Economy Minded' },
  { id: 'budget-conscious', label: '💳 Budget-Conscious' },
  { id: 'experience-driven', label: '🎟️ Experience-Driven' },
  { id: 'impact-driven', label: '🌍 Impact-Driven' },
  { id: 'formal-business', label: '🧾 Formal Business' },
  { id: 'micro-commerce', label: '🧺 Micro-Commerce' },
  { id: 'peer-to-peer', label: '🤝 Peer-to-Peer' },
  { id: 'event-based', label: '🎪 Event-Based' },
  { id: 'pop-up-temporary', label: '🛍️ Pop-Up / Temporary' },
  { id: 'digital-only', label: '🌐 Digital-Only' },
  { id: 'economy-observant', label: '👀 Economy-Observant' },
  { id: 'trend-aware', label: '📊 Trend-Aware' },
  { id: 'place-value-oriented', label: '🗺️ Place-Value Oriented' },
] as const;

export type TraitId = typeof TRAIT_OPTIONS[number]['id'];

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/** Get display name from account data */
export function getDisplayName(account: ProfileAccount): string {
  if (account.first_name) {
    return account.last_name 
      ? `${account.first_name} ${account.last_name}`
      : account.first_name;
  }
  return 'User';
}

/** Format date for display */
export function formatPinDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Format join date */
export function formatJoinDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

/** Count pins by visibility */
export function countPinsByVisibility(pins: ProfilePin[]): { 
  public: number; 
  private: number; 
  total: number;
} {
  const publicCount = pins.filter(p => p.visibility === 'public').length;
  const privateCount = pins.filter(p => p.visibility === 'only_me').length;
  return {
    public: publicCount,
    private: privateCount,
    total: publicCount + privateCount,
  };
}

/** Filter pins for visitor view (hide private) */
export function filterPinsForVisitor(pins: ProfilePin[]): ProfilePin[] {
  return pins.filter(p => p.visibility === 'public');
}

