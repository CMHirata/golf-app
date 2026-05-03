// ─── src/components/NavIcons.jsx ──────────────────────────────────────────────
// Bottom-nav SVG icon components and tab metadata.
//
// Extracted verbatim from App.jsx in session 13-E.2. Pure reorganization —
// zero logic changes. Consumed by BottomNav.jsx; SIDE_TABS and CENTER_FLOW_TABS
// also live here because they are bottom-nav-specific configuration.
//
// ✅ Self-checked (13-E.2): All five icon components moved verbatim from
//   App.jsx (prior lines 19–68); SIDE_TABS and CENTER_FLOW_TABS moved verbatim
//   from prior App.jsx lines 71–80. All exports are named. Stroke widths,
//   sizes, default colors, and SVG paths byte-identical to original.

// ── Inline SVG nav icons ──────────────────────────────────────────────────────
export const IconHome = ({ size=22, color='currentColor', strokeWidth=1.6 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
    <path d="M9 21V12h6v9"/>
  </svg>
);

export const IconUsers = ({ size=22, color='currentColor', strokeWidth=1.6 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

export const IconMapPin = ({ size=22, color='currentColor', strokeWidth=1.6 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
);

export const IconClock = ({ size=22, color='currentColor', strokeWidth=1.6 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

// ── TheCardIcon — SVG recreation of The Card logo icon ───────────────────────
// Scorecard grid with flagstick (left column), gold triangle flag, horseshoe cup.
// Renders white on the dark green button.
export const TheCardIcon = ({ size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 48 44" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="10" width="40" height="30" rx="2" stroke="#fff" strokeWidth="2.8"/>
    <line x1="4"  y1="20" x2="44" y2="20" stroke="#fff" strokeWidth="2"/>
    <line x1="4"  y1="30" x2="44" y2="30" stroke="#fff" strokeWidth="2"/>
    <line x1="18" y1="10" x2="18" y2="40" stroke="#fff" strokeWidth="2"/>
    <line x1="31" y1="10" x2="31" y2="40" stroke="#fff" strokeWidth="2"/>
    <line x1="9"  y1="2"  x2="9"  y2="20" stroke="#fff" strokeWidth="2.8"/>
    <polygon points="9,2 9,13 20,7" fill="#c9a84c"/>
    <path d="M7 36 Q9 40 11 36" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round"/>
  </svg>
);

// ── Side tabs — flanking the center button ────────────────────────────────────
export const SIDE_TABS = [
  { id: 'home',    label: 'Home',    Icon: IconHome   },
  { id: 'players', label: 'Players', Icon: IconUsers  },
  // center button rendered separately
  { id: 'courses', label: 'Courses', Icon: IconMapPin },
  { id: 'history', label: 'History', Icon: IconClock  },
];

// Center tab is "active" whenever user is in the round flow
export const CENTER_FLOW_TABS = new Set(['new-round', 'scorecard', 'results']);
