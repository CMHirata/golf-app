// ─── pages/history/HistoryIcons.jsx ──────────────────────────────────────────
// SVG action icons used by the History page and its swipeable row.
//
// Extracted verbatim from HistoryPage.jsx in 13-E.3 per Architectural Decision
// #23 (codebase extraction pattern). Zero logic changes.
//
// ✅ Self-checked (13-E.3): IconShare, IconEdit, IconTrash moved verbatim.
// IconDownload (Export button) and IconUpload (Import button) glyphs replaced
// with circle-up / circle-down to fix reversed semantics in the original code
// and to read cleanly at the 14px button size. Component names retained to
// keep HistoryPage.jsx imports stable. `G` token import preserved for
// IconDownload's default color binding.

import { G } from '../../components/ui.jsx';

export const IconShare = ({ color = '#fff', size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
    <polyline points="16 6 12 2 8 6"/>
    <line x1="12" y1="2" x2="12" y2="15"/>
  </svg>
);

export const IconEdit = ({ color = '#fff', size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

export const IconTrash = ({ color = '#fff', size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/>
    <path d="M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

// Circle-with-up-arrow → "Export" (data going out / up to backup).
// Used by HistoryPage's Backup & Restore card on the Export button.
// 13-E.3: glyph reads cleanly at the 14px button size where finer details
// (cloud outlines, tray shapes) become illegible. Component name retained
// for import stability.
export const IconDownload = ({ color = G, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/>
    <polyline points="8 12 12 8 16 12"/>
    <line x1="12" y1="8" x2="12" y2="17"/>
  </svg>
);

// Circle-with-down-arrow → "Import" (data coming in / down from backup).
// Used by HistoryPage's Backup & Restore card on the Import button.
// 13-E.3: mirrors IconDownload's circle metaphor with a downward arrow.
// Component name retained for import stability.
export const IconUpload = ({ color = '#666', size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/>
    <polyline points="8 12 12 16 16 12"/>
    <line x1="12" y1="7" x2="12" y2="16"/>
  </svg>
);
