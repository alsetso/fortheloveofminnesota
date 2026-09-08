/** In-dock card popovers — fill the sheet while main dock chrome hides. */
export type DockCardId =
  | 'account'
  | 'delete-account'
  | 'wallet'
  | 'contacts'
  | 'controls'
  | 'map-style'
  | 'set-home-confirm'
  | 'my-places'
  | 'page-manager'
  | 'collections'
  | 'hearts'
  | 'level'
  | 'activity'
  | 'activity-detail'
  | 'activity-followers'
  | 'activity-following'
  | 'notifications'
  | 'steps'
  | 'contributor'
  | 'activity-analytics'
  | 'pin'
  | 'report'
  | 'page'
  | 'profile'
  | 'nearby-place'
  | 'directory-pages'
  | 'community-pins'
  | 'standing'
  | 'atlas'
  | 'backpack'
  | 'address'
  | 'drop-catalog';

export const DOCK_CARD_LABELS: Record<DockCardId, string> = {
  account: 'Account',
  'delete-account': 'Delete account',
  wallet: 'Wallet',
  contacts: 'Contact book',
  controls: 'Controls',
  'map-style': 'Map style',
  'set-home-confirm': 'Set as home',
  'my-places': 'My Places',
  'page-manager': 'My pages',
  collections: 'Collections',
  hearts: 'Hearts',
  level: 'Level',
  activity: 'Activity',
  'activity-detail': 'Activity',
  'activity-followers': 'Followers',
  'activity-following': 'Following',
  notifications: 'Notifications',
  steps: 'Steps',
  contributor: 'Contributor',
  'activity-analytics': 'Analytics',
  pin: 'Post',
  report: 'Report',
  page: 'Page',
  profile: 'Profile',
  'nearby-place': 'Nearby place',
  'directory-pages': 'Directory pages',
  'community-pins': 'Community pins',
  standing: 'Standing',
  atlas: 'Atlas',
  backpack: 'Backpack',
  address: 'Address',
  'drop-catalog': 'Drop a prop',
};
