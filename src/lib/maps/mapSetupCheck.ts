/**
 * Check if a map is ready for members to join
 * 
 * A map is considered "setup complete" if:
 * - Map is public AND has collaboration settings configured (allow_pins, allow_areas, or allow_posts)
 * - OR map is private (private maps don't need collaboration settings to accept members)
 */

export interface MapSetupCheck {
  isSetupComplete: boolean;
  reason?: 'collaboration_configured' | 'private_map' | 'not_ready';
}

export function isMapSetupComplete(
  visibility: 'public' | 'private' | 'shared',
  collaborationSettings?: {
    allow_pins?: boolean;
    allow_areas?: boolean;
    allow_posts?: boolean;
  } | null
): MapSetupCheck {
  // Private maps are always ready (they can accept members without collaboration settings)
  if (visibility === 'private') {
    return { isSetupComplete: true, reason: 'private_map' };
  }

  // Public maps need at least one collaboration setting enabled
  if (visibility === 'public' && collaborationSettings) {
    const hasCollaboration = 
      collaborationSettings.allow_pins === true ||
      collaborationSettings.allow_areas === true ||
      collaborationSettings.allow_posts === true;

    if (hasCollaboration) {
      return { isSetupComplete: true, reason: 'collaboration_configured' };
    }
  }

  return { isSetupComplete: false, reason: 'not_ready' };
}
