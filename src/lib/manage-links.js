import {
  IconMap,
  IconLayers,
  IconPin,
  IconNavigate,
  IconBuildings,
  IconUser,
  IconUsers,
  IconUserPlus,
  IconShare,
  IconLogs,
  IconCalculator,
  IconRupee,
  IconDashboard,
  IconHome,
  IconCrosshair,
  IconDiamond,
  IconSmartphone,
  IconTeamPlan,
  IconDoc,
} from '@/components/ui/icons'

/**
 * The admin's sidebar, in groups.
 *
 * An admin can reach eighteen places. As one flat list that is a wall nobody
 * reads — so the three or four used daily stay at the top level and the rest
 * live behind a heading you open when you need it.
 *
 * Grouped by what a person is trying to DO: run the partner business, or set
 * up the system. Not by which team built it.
 */
export const NAV_GROUPS = [
  {
    label: 'Field sales',
    items: [
      { href: '/sales/dashboard', label: 'Sales overview', icon: IconDashboard, exact: true },
      { href: '/sales', label: 'Assign buildings', icon: IconBuildings, exact: true },
      { href: '/sales/zones', label: 'Team zones', icon: IconMap, exact: true },
      { href: '/sales/plan', label: 'Team plan', icon: IconTeamPlan, exact: true },
      // The permission executives' societies (hidden from Buildings until accepted).
      { href: '/societies', label: 'Society permissions', icon: IconDoc },
    ],
  },
  {
    label: 'Partner network',
    items: [
      { href: '/partner-dashboard', label: 'Overview', icon: IconDashboard, exact: true },
      { href: '/partners', label: 'Partners', icon: IconUsers },
      { href: '/referrals', label: 'Referrals', icon: IconShare },
      { href: '/leads', label: 'Leads', icon: IconUserPlus },
      { href: '/payouts', label: 'Payouts', icon: IconRupee },
      { href: '/calculator', label: 'Revenue calculator', icon: IconCalculator },
      { href: '/admin/partner-approvals', label: 'Partner approvals', icon: IconUsers },
    ],
  },
  {
    label: 'Manage',
    items: [
      { href: '/admin/cities', label: 'Cities', icon: IconMap },
      { href: '/admin/operators', label: 'Operators', icon: IconLayers },
      { href: '/admin/zones', label: 'Zones', icon: IconPin },
      { href: '/admin/fiber', label: 'Fibers', icon: IconNavigate },
      { href: '/admin/pops', label: 'POPs', icon: IconHome },
      { href: '/admin/closures', label: 'Closures', icon: IconCrosshair },
      { href: '/admin/splitters', label: 'Splitters', icon: IconDiamond },
      { href: '/admin/building-types', label: 'Building types', icon: IconBuildings },
      { href: '/admin/users', label: 'Users', icon: IconUser },
      { href: '/admin/app-releases', label: 'App releases', icon: IconSmartphone },
      { href: '/admin/system-logs', label: 'System logs', icon: IconLogs },
    ],
  },
]

/**
 * The dashboard's Manage grid — one flat list, derived from the groups above
 * so the two can never disagree about what exists.
 *
 * `sub` is the grid's second line; the sidebar shows only the label.
 */
const SUBTITLES = {
  '/societies': 'Permission visits and history',
  '/partner-dashboard': 'Network at a glance',
  '/partners': 'Referral partners',
  '/referrals': 'People they introduced',
  '/leads': 'Customers sent in',
  '/payouts': 'Pay partners what they earned',
  '/calculator': 'What a partner earns',
  '/admin/partner-approvals': 'Verify documents',
  '/admin/cities': 'Operator groups',
  '/admin/operators': 'Zone groups',
  '/admin/zones': 'Coverage areas',
  '/admin/fiber': 'Cables on the map',
  '/admin/pops': 'Sites and OLTs',
  '/admin/closures': 'Splice boxes and splitters',
  '/admin/splitters': 'Splitters and their ports',
  '/admin/building-types': 'Form options',
  '/admin/users': 'Team & roles',
  '/admin/app-releases': 'Partner app versions',
  '/admin/system-logs': 'Audit trail',
}

export const MANAGE_LINKS = NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => ({
    ...item,
    sub: SUBTITLES[item.href] ?? '',
    // Everything in these groups is admin-only; a manager's grid shows the
    // handful they can actually reach.
    adminOnly: ![
      '/admin/operators',
      '/admin/zones',
      '/admin/fiber',
      '/admin/pops',
      '/admin/closures',
      '/admin/splitters',
      '/admin/building-types',
    ].includes(item.href),
  })),
)
