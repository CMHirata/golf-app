// ─── src/components/BottomNav.jsx ─────────────────────────────────────────────
// Fixed-bottom navigation bar: two side tabs, center logo button, two side tabs.
//
// Extracted verbatim from App.jsx <nav> block in session 13-E.2. Pure
// reorganization — zero logic changes.
//
// Props:
//   tab           — current active tab id (string)
//   setTab        — setter for direct tab navigation (used by side-tab buttons)
//   inProgress    — round-in-progress flag (controls gold-dot indicator)
//   centerActive  — whether the center button shows the active ring/bar
//                   (true when tab is in the round flow per CENTER_FLOW_TABS)
//   onCenterTap   — handler for center button taps. App.jsx owns the
//                   "Start Scoring" trigger logic (H-11) — this component
//                   delegates entirely to that callback.
//   navBarHeight  — fixed nav bar height in px (excludes safe-area-inset)
//
// ✅ Self-checked (13-E.2): JSX moved verbatim from App.jsx prior lines
//   412–521; all six referenced symbols (G, SIDE_TABS, TheCardIcon, plus
//   the five props) are imported or destructured. Center-button onClick
//   delegates to onCenterTap so H-11 (handleCenterTap owns startTriggerRef
//   call) is preserved. No internal state.

import { G } from './ui.jsx';
import { SIDE_TABS, TheCardIcon } from './NavIcons.jsx';

export default function BottomNav({ tab, setTab, inProgress, centerActive, onCenterTap, navBarHeight }) {
  return (
    /* ── Bottom nav — always visible ── */
    /* overflow:visible required so center button protrusion + ring are not clipped */
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#fff',
      borderTop: '1px solid #e0ece0',
      display: 'flex',
      alignItems: 'center',
      zIndex: 50,
      height: `calc(${navBarHeight}px + env(safe-area-inset-bottom))`,
      paddingBottom: 'env(safe-area-inset-bottom)',
      overflow: 'visible',
    }}>

      {/* Left two tabs: Home, Players */}
      {/* Home gets marginLeft to push it away from the screen edge.          */}
      {/* Padding stays symmetric so the active indicator bar stays centered. */}
      {SIDE_TABS.slice(0, 2).map(({ id, label, Icon }, i) => {
        const active = tab === id;
        return (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            height: navBarHeight, padding: '0 4px',
            marginLeft: i === 0 ? 10 : 0,
            border: 'none', background: 'none', cursor: 'pointer',
            position: 'relative', gap: 3,
          }}>
            {active && <div style={{
              position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
              width: 28, height: 3, background: G, borderRadius: '0 0 4px 4px',
            }}/>}
            <Icon size={29} color={active ? G : '#aaa'} strokeWidth={active ? 2.2 : 1.6}/>
            <span style={{ fontSize: 11, fontWeight: active ? 700 : 400, color: active ? G : '#aaa', fontFamily: 'inherit', letterSpacing: '-0.1px' }}>
              {label}
            </span>
          </button>
        );
      })}

      {/* ── Center logo button ── */}
      {/* Fixed-width slot prevents the circle from squeezing the outer tabs.  */}
      {/* marginTop: -18 lifts the button 18px above the nav bar top edge.     */}
      {/* overflow:visible on <nav> ensures the ring shadow renders unclipped.  */}
      <div style={{
        flexShrink: 0, width: 76,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        height: navBarHeight, position: 'relative',
      }}>
        {centerActive && <div style={{
          position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: 28, height: 3, background: G, borderRadius: '0 0 4px 4px',
        }}/>}
        <button
          onClick={onCenterTap}
          style={{
            width: 57, height: 57, borderRadius: '50%',
            background: G,
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
            marginTop: -18,
            boxShadow: centerActive
              ? `0 0 0 2.5px #fff, 0 0 0 4.5px ${G}`
              : '0 3px 10px rgba(26,71,42,0.4)',
            flexShrink: 0,
          }}
        >
          <TheCardIcon size={36}/>
          {/* Gold dot — matches flag color, signals round in progress */}
          {inProgress && (
            <div style={{
              position: 'absolute', top: 1, right: 1,
              width: 10, height: 10,
              background: '#c9a84c',
              borderRadius: '50%',
              border: '2px solid #fff',
            }}/>
          )}
        </button>
      </div>

      {/* Right two tabs: Courses, History */}
      {/* History gets marginRight to push it away from the screen edge.       */}
      {/* Padding stays symmetric so the active indicator bar stays centered.  */}
      {SIDE_TABS.slice(2).map(({ id, label, Icon }, i) => {
        const active = tab === id;
        return (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            height: navBarHeight, padding: '0 4px',
            marginRight: i === 1 ? 10 : 0,
            border: 'none', background: 'none', cursor: 'pointer',
            position: 'relative', gap: 3,
          }}>
            {active && <div style={{
              position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
              width: 28, height: 3, background: G, borderRadius: '0 0 4px 4px',
            }}/>}
            <Icon size={29} color={active ? G : '#aaa'} strokeWidth={active ? 2.2 : 1.6}/>
            <span style={{ fontSize: 11, fontWeight: active ? 700 : 400, color: active ? G : '#aaa', fontFamily: 'inherit', letterSpacing: '-0.1px' }}>
              {label}
            </span>
          </button>
        );
      })}

    </nav>
  );
}
