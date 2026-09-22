import { canViewDashboard } from '../helpers/permission-access';

export interface NavigationMenuItem {
  label: string;
  icon: string;
  route: string;
  activeRoutes?: string[];
  /**
   * Whether the entry is shown at all. An entry nobody can open should not be
   * offered, rather than offered and refused.
   */
  canView?: (permissions: string[] | string | null, role?: string | null) => boolean;
}

export const navigationMenu: NavigationMenuItem[] = [
  {
    label: 'navigation.map',
    icon: 'location',
    route: '/map',
    activeRoutes: ['/map/search/', '/map/collection/'],
  },
  {
    label: 'navigation.dashboard',
    icon: 'dashboard',
    route: '/dashboard',
    canView: canViewDashboard,
  },
  {
    label: 'navigation.activity',
    icon: 'activity',
    route: '/activity',
  },
  {
    label: 'navigation.profile',
    icon: 'profile',
    route: '/profile',
  },
];
