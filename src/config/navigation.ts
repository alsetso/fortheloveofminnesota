import {
  HomeIcon,
  MapIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  UserIcon,
  BuildingStorefrontIcon,
} from '@heroicons/react/24/outline';

export interface NavItem {
  name?: string;
  label?: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
  description?: string;
  category?: string;
}

// Main navigation items for app sidebar
export const appNavItems: NavItem[] = [
  { href: '/', label: 'Home', icon: HomeIcon },
  { href: '/maps', label: 'Maps', icon: MapIcon },
  { href: '/account/settings', label: 'Settings', icon: Cog6ToothIcon },
];

// Public navigation items for SimpleNav
export const publicNavItems: NavItem[] = [
  { href: '/', label: 'Home', icon: HomeIcon },
  { href: '/maps', label: 'Maps', icon: MapIcon },
];

// Legacy navItems for backward compatibility
export const navItems: NavItem[] = [
  {
    name: 'Home',
    href: '/',
    icon: HomeIcon,
    description: 'Connect with real estate professionals and discover development opportunities',
    category: 'Main',
  },
  {
    name: 'Maps',
    href: '/maps',
    icon: MapIcon,
    description: 'Interactive maps of Minnesota showing development opportunities and property acquisitions',
    category: 'Map',
  },
  {
    name: 'Settings',
    href: '/account/settings',
    icon: Cog6ToothIcon,
    description: 'Manage your account settings and preferences',
    category: 'Account',
  },
];

export const getNavItemsByCategory = () => {
  const categories = new Map<string, NavItem[]>();
  navItems.forEach((item) => {
    const category = item.category || 'Other';
    if (!categories.has(category)) {
      categories.set(category, []);
    }
    const categoryItems = categories.get(category);
    if (categoryItems) {
      categoryItems.push(item);
    }
  });
  return categories;
};
