/**
 * First-path segments that must never be claimable as account usernames.
 * Keeps `/:username` from colliding with App Router surfaces + common system paths.
 */
export const RESERVED_USERNAMES = new Set([
  'ads',
  'api',
  'auth',
  'campaign',
  'calendar',
  'chat',
  'contacts',
  'discover',
  'explore',
  'feed',
  'fly',
  'game',
  'helpdesk',
  'login',
  'map',
  'message',
  'messages',
  'outside',
  'page',
  'pages',
  'place',
  'play',
  'post',
  'privacy',
  'profile',
  'setup',
  'signup',
  'story',
  'tos',
  'welcome',
  'account',
  'accounts',
  'admin',
  'assets',
  'favicon.ico',
  'notifications',
  'null',
  'robots.txt',
  'settings',
  'services',
  'static',
  'undefined',
  'www',
  '_next',
]);

export function isReservedUsername(raw: string): boolean {
  const u = raw.trim().toLowerCase().replace(/^@/, '');
  return RESERVED_USERNAMES.has(u);
}
