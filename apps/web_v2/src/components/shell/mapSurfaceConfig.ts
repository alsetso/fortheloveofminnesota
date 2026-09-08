/**
 * /game map surface config.
 *
 * First paint uses last-known MN pose when available (else Capitol).
 * PlayerPresenceController boots Scout (free roam); Play is opt-in via Find Me.
 * Find Me autoResume stays off; presence owns the boot attach.
 */

export type MapSurfaceConfig = {
  /**
   * Map engine first paint.
   * `'capitol'` — always Minnesota State Capitol.
   * `'auto'` — last-known avatar if in MN, else Capitol (/game cold open).
   */
  boot: 'capitol' | 'auto';
  findMe: {
    autoResume: boolean;
    allowCompass: boolean;
    lockToUser: boolean;
  };
};

export const GAME_SURFACE_CONFIG: MapSurfaceConfig = {
  boot: 'auto',
  // Finger orbit only — phone tilt never rotates the map.
  findMe: { autoResume: false, allowCompass: false, lockToUser: true },
};
