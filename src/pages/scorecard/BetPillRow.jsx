// ─── scorecard/BetPillRow.jsx ─────────────────────────────────────────────────
// RENDER ONLY — no business logic in this file.
// No scoring calculations. No match state computation.
// All logic must come from engine/ or scorecardUtils.js
//
// ✅ Self-checked (13-C.6): Atomic row per Resolver_UI_Spec §2.3. Pure
// presentational: no internal state, no engine call. Status-badge text and
// color follow the §2.3 convention table verbatim. The `indented` prop
// applies a left margin (~16px) when the row is a press nested under a
// segment. `aria-pressed` exposed on each pill; `role="status"` on the badge.

import { G } from '../../components/ui.jsx';

const BADGE_TEXT = {
  closed:      'Closed ✓',
  in_progress: 'In progress',
  complete:    'Complete',
  partial:     'Partial',
};

// Per §2.3: closed/complete = G; in_progress/partial = neutral gray.
function badgeStyle(status) {
  const isPositive = status === 'closed' || status === 'complete';
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    borderRadius: 10,
    fontSize: 10,
    fontWeight: 700,
    fontFamily: 'inherit',
    background: isPositive ? G          : '#eee',
    color:      isPositive ? '#fff'     : '#666',
    whiteSpace: 'nowrap',
  };
}

// Pill pair — selected = filled green, unselected = outlined.
function pillStyle(selected) {
  return {
    flex: '0 0 auto',
    padding: '6px 14px',
    borderRadius: 8,
    border: selected ? `1.5px solid ${G}` : '1.5px solid #ccc',
    background: selected ? G : '#fff',
    color:      selected ? '#fff' : '#555',
    fontSize: 12,
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
    transition: 'all .15s',
    WebkitTapHighlightColor: 'transparent',
  };
}

export function BetPillRow({ label, status, decision, onChange, indented = false }) {
  const isPay = decision === 'pay';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 0',
        marginLeft: indented ? 16 : 0,
      }}
    >
      <div style={{
        flex: '1 1 auto',
        fontSize: 12,
        fontWeight: 600,
        color: '#333',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        minWidth: 0,
      }}>
        {label}
      </div>

      <div role="status" style={badgeStyle(status)}>
        {BADGE_TEXT[status] || status}
      </div>

      <div style={{ display: 'flex', gap: 4, flex: '0 0 auto' }}>
        <button
          type="button"
          aria-pressed={isPay}
          onClick={() => onChange('pay')}
          style={pillStyle(isPay)}
        >
          Pay
        </button>
        <button
          type="button"
          aria-pressed={!isPay}
          onClick={() => onChange('abandon')}
          style={pillStyle(!isPay)}
        >
          Abandon
        </button>
      </div>
    </div>
  );
}
