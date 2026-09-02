import {
  IconMap,
  IconLayers,
  IconPin,
  IconNavigate,
  IconBuildings,
  IconUser,
  IconUsers,
  IconLogs,
  IconCalculator,
  IconRupee,
} from '@/components/ui/icons'

/**
 * Admin/manage destinations — one source of truth for the dashboard's Manage
 * grid and the desktop sidebar. `adminOnly` rows hide from managers.
 */
export const MANAGE_LINKS = [
  { href: '/admin/cities', label: 'Cities', sub: 'Operator groups', icon: IconMap, adminOnly: true },
  { href: '/admin/operators', label: 'Operators', sub: 'Zone groups', icon: IconLayers },
  { href: '/admin/zones', label: 'Zones', sub: 'Coverage areas', icon: IconPin },
  { href: '/admin/fiber', label: 'Fiber routes', sub: 'Network lines', icon: IconNavigate },
  { href: '/admin/building-types', label: 'Building types', sub: 'Form options', icon: IconBuildings },
  { href: '/admin/users', label: 'Users', sub: 'Team & roles', icon: IconUser, adminOnly: true },
  {
    href: '/admin/partner-approvals',
    label: 'Partner approvals',
    sub: 'Verify documents',
    icon: IconUsers,
    adminOnly: true,
  },
  {
    href: '/payouts',
    label: 'Payouts',
    sub: 'Pay partners what they earned',
    icon: IconRupee,
    adminOnly: true,
  },
  {
    href: '/calculator',
    label: 'Revenue calculator',
    sub: 'What a partner earns',
    icon: IconCalculator,
    adminOnly: true,
  },
  { href: '/admin/system-logs', label: 'System logs', sub: 'Audit trail', icon: IconLogs, adminOnly: true },
]
