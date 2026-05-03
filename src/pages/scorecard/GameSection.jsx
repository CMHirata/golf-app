// ─── scorecard/GameSection.jsx ────────────────────────────────────────────────
// Shared chrome components used by all game table sections.
// Pure presentational — no logic, no engine calls.
//
// GameTable gains an optional `landscape` prop.
// When landscape=true, pass allHoles=[0..17] and the table renders all 18 holes
// in one row with F9/B9 subtotal columns. Children must provide a matching
// number of <td> cells (9 + 1 subtotal + 9 + 1 subtotal + 1 total = 21 cols).
// When landscape=false (default), behaves exactly as before (9 holes + 1 total).

import { COL_W, TOT_W, NAME_MIN } from './scorecardUtils.js';

const FRONT = [0,1,2,3,4,5,6,7,8];
const BACK  = [9,10,11,12,13,14,15,16,17];

export function GameSection({ title, badge, badge2, color, borderColor, children }) {
  return (
    <div style={{ marginBottom: 14, background: '#fff', borderRadius: 12, border: `1px solid ${borderColor}`, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px 5px' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{title}</span>
        <div style={{ display:'flex', gap:4, alignItems:'center' }}>
          {badge  && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 8, background: borderColor, color }}>{badge}</span>}
          {badge2 && <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 8, background: borderColor, color }}>{badge2}</span>}
        </div>
      </div>
      {children}
    </div>
  );
}

export function HalfLabel({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 600, color: '#888', padding: '3px 10px 2px' }}>{children}</div>;
}

export function TableDivider() {
  return <div style={{ height: '0.5px', background: '#e8e8e8', margin: '0 8px' }}/>;
}

export function ColNote({ children }) {
  return <div style={{ fontSize: 10, color: '#aaa', padding: '2px 10px 6px' }}>{children}</div>;
}

/**
 * GameTable — renders a 9-hole or 18-hole (landscape) scoring table.
 *
 * Portrait (landscape=false, default):
 *   hs = 9 hole indices, colHeader = half label ("F9"/"B9")
 *   children = <tr> with name + 9 score cells + 1 total cell
 *
 * Landscape (landscape=true):
 *   hs is ignored; always renders FRONT then BACK with subtotals.
 *   colHeader is ignored; shows F9 / B9 / Tot columns.
 *   children must produce a <tr> with:
 *     name + 9 front cells + F9 cell + 9 back cells + B9 cell + Tot cell
 *   Pass landscape=true and the children renderer receives { landscape:true }
 *   via the render-prop pattern OR caller supplies pre-built <tr>s.
 *
 * For simplicity, children is always a plain React node (pre-built <tr>s).
 * The caller is responsible for building the correct number of <td>s.
 */
export function GameTable({ hs, colHeader, headerBg, headerColor, totBg, totColor, children, landscape }) {
  if (landscape) {
    const tableMinW = NAME_MIN + 18 * COL_W + 2 * TOT_W + TOT_W;
    return (
      <div style={{ overflowX: 'auto', paddingBottom: 2 }}>
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%', minWidth: tableMinW }}>
          <colgroup>
            <col/>
            {FRONT.map(h => <col key={h} style={{ width: COL_W }}/>)}
            <col style={{ width: TOT_W }}/>{/* F9 */}
            {BACK.map(h => <col key={h} style={{ width: COL_W }}/>)}
            <col style={{ width: TOT_W }}/>{/* B9 */}
            <col style={{ width: TOT_W }}/>{/* Tot */}
          </colgroup>
          <thead>
            <tr>
              <th style={{ padding: '3px 6px', background: headerBg, color: headerColor, fontSize: 10, textAlign: 'left' }}></th>
              {FRONT.map(h => <th key={h} style={{ padding: '2px 1px', background: headerBg, color: headerColor, fontSize: 10, textAlign: 'center' }}>{h + 1}</th>)}
              <th style={{ padding: '2px 4px', background: totBg, color: totColor, fontSize: 10, textAlign: 'center', fontWeight: 700 }}>Total</th>
              {BACK.map(h => <th key={h} style={{ padding: '2px 1px', background: headerBg, color: headerColor, fontSize: 10, textAlign: 'center' }}>{h + 1}</th>)}
              <th style={{ padding: '2px 4px', background: totBg, color: totColor, fontSize: 10, textAlign: 'center', fontWeight: 700 }}>Total</th>
              <th style={{ padding: '2px 4px', background: totBg, color: totColor, fontSize: 10, textAlign: 'center', fontWeight: 800 }}>Total</th>
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    );
  }

  // Portrait: original 9-hole layout
  return (
    <div style={{ overflowX: 'auto', paddingBottom: 2 }}>
      <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%', minWidth: NAME_MIN + 9 * COL_W + TOT_W }}>
        <colgroup>
          <col/>
          {hs.map(h => <col key={h} style={{ width: COL_W }}/>)}
          <col style={{ width: TOT_W }}/>
        </colgroup>
        <thead>
          <tr>
            <th style={{ padding: '3px 6px', background: headerBg, color: headerColor, fontSize: 10, textAlign: 'left' }}></th>
            {hs.map(h => <th key={h} style={{ padding: '2px 1px', background: headerBg, color: headerColor, fontSize: 10, textAlign: 'center' }}>{h + 1}</th>)}
            <th style={{ padding: '2px 4px', background: totBg, color: totColor, fontSize: 10, textAlign: 'center', fontWeight: 700 }}>{colHeader}</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function PlayerChips({ players, values, chipBg, chipColor, leaderBg, leaderColor, fmtVal, subLabel }) {
  const maxVal = Math.max(...values);
  const n = players.length;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)`, gap: 6, padding: '6px 8px 8px' }}>
      {players.map((p, pi) => {
        const v = values[pi];
        const isLeader = v > 0 && v === maxVal;
        const clr = isLeader ? leaderColor : chipColor;
        const parts = (p?.name || '').trim().split(/\s+/);
        const first = parts[0] || '?';
        const last  = parts.length >= 2 ? parts[parts.length - 1] : '';
        return (
          <div key={pi} style={{ textAlign: 'center', borderRadius: 8, padding: '5px 4px', background: isLeader ? leaderBg : chipBg, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: clr, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{first}</div>
            {last && <div style={{ fontSize: 10, fontWeight: 400, color: clr, opacity: 0.7, lineHeight: 1.2, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{last}</div>}
            <div style={{ fontSize: 15, fontWeight: 700, color: clr }}>{fmtVal(v)}</div>
            <div style={{ fontSize: 10, color: '#aaa' }}>{subLabel}</div>
          </div>
        );
      })}
    </div>
  );
}
