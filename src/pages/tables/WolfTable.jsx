// ─── WolfTable.jsx ────────────────────────────────────────────────────────────
// Render-only Wolf game table. Wolf_Contract.md §8 / ARCHITECTURE_FOUNDATIONS §2.
// CONTAINS NO SCORING LOGIC. All display values from props.
//
// Layout: front nine / back nine horizontal rows, one row per player.
// Players listed in wolfOrder sequence.
// Point delta per hole shown in each cell.
// Wolf-team cells shaded purple; opponent cells shaded orange.
//
// ✅ Self-checked (16-A fix): horizontal layout, wolfOrder sequence, team shading,
//   single-table structure matching other game tables.

import { COL_W, TOT_W, NAME_MIN, resolveDisplayNames, FRONT_H, BACK_H } from '../scorecard/scorecardUtils.js';

const W = { hdrBg: '#f0e8f8', hdrClr: '#4a1580', totBg: '#dac8f5', border: '#dac8f5' };
const WOLF_TEAM_BG = '#ede0f8';
const OPP_BG      = '#fff3e8';
const POS_CLR = '#27ae60';
const NEG_CLR = '#c0392b';
const NEU_CLR = '#aaa';

const fmtDelta = d => d === 0 ? '–' : d > 0 ? `+${d}` : `${d}`;
const dClr     = d => d > 0 ? POS_CLR : d < 0 ? NEG_CLR : NEU_CLR;

export default function WolfTable({ players, wolfState, opts }) {
  if (!wolfState || !players || players.length !== 4) return null;

  const { holes, cumulative } = wolfState;
  const wolfOrder = opts?.wolfOrder || [0, 1, 2, 3];
  const dispNames = resolveDisplayNames(players);
  const firstName = i => dispNames[i]?.name || players[i]?.name?.split(' ')[0] || '?';

  // Players rendered in wolfOrder sequence
  const orderedPis = wolfOrder;

  // Per-player half totals
  const frontTot = new Array(4).fill(0);
  const backTot  = new Array(4).fill(0);
  holes.forEach(hole => {
    hole.deltas.forEach((d, pi) => {
      if (hole.holeIdx < 9) frontTot[pi] += d; else backTot[pi] += d;
    });
  });

  const cellBg = (pi, h) => {
    const hole = holes[h];
    if (!hole?.resolved) return '#fafafa';
    const wolfTeam = (hole.loneWolf || hole.blindWolf)
      ? [hole.wolfIdx]
      : [hole.wolfIdx, hole.partnerIdx].filter(x => x != null);
    return wolfTeam.includes(pi) ? WOLF_TEAM_BG : OPP_BG;
  };

  const hdrStyle = (w, extra = {}) => ({
    background: W.hdrBg, color: W.hdrClr, fontSize: 10, fontWeight: 700,
    padding: '3px 2px', textAlign: 'center', width: w, minWidth: w,
    border: `1px solid ${W.border}`, ...extra,
  });

  const half = (holeRange, totLabel, totArr) => holeRange.map((h, hi) => (
    <td key={h} style={{
      textAlign: 'center', fontSize: 10, fontWeight: 700,
      padding: '2px 1px', width: COL_W, minWidth: COL_W,
      border: `1px solid ${W.border}`,
    }}>
      {/* placeholder — overridden per player row */}
    </td>
  ));

  return (
    <div style={{ overflowX: 'auto', marginBottom: 8, WebkitOverflowScrolling: 'touch' }}>
      <div style={{ fontSize: 10, color: W.hdrClr, fontWeight: 700, marginBottom: 3, paddingLeft: 2 }}>
        Wolf <span style={{ fontSize: 9, fontWeight: 400, color: '#aaa', marginLeft: 4 }}>purple = wolf team · orange = opponents</span>
      </div>
      <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th style={hdrStyle(NAME_MIN, { textAlign: 'left', padding: '3px 6px' })}>Player</th>
            {FRONT_H.map(h => <th key={h} style={hdrStyle(COL_W)}>{h + 1}</th>)}
            <th style={hdrStyle(TOT_W)}>Out</th>
            {BACK_H.map(h => <th key={h} style={hdrStyle(COL_W)}>{h + 1}</th>)}
            <th style={hdrStyle(TOT_W)}>In</th>
            <th style={hdrStyle(TOT_W)}>Tot</th>
          </tr>
        </thead>
        <tbody>
          {orderedPis.map((pi, rowIdx) => {
            const rowBg = rowIdx % 2 === 0 ? '#fafafa' : '#fff';
            return (
              <tr key={pi}>
                <td style={{ padding: '2px 6px', fontSize: 11, fontWeight: 600,
                             background: rowBg, border: `1px solid ${W.border}`,
                             overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                             width: NAME_MIN, minWidth: NAME_MIN }}>
                  {firstName(pi)}
                </td>
                {FRONT_H.map(h => {
                  const hole = holes[h];
                  const d = hole?.deltas?.[pi] ?? 0;
                  return (
                    <td key={h} style={{
                      textAlign: 'center', fontSize: 10, fontWeight: 700,
                      padding: '2px 1px', width: COL_W, minWidth: COL_W,
                      border: `1px solid ${W.border}`,
                      background: cellBg(pi, h),
                      color: hole?.resolved ? dClr(d) : '#ccc',
                    }}>
                      {hole?.resolved ? fmtDelta(d) : ''}
                    </td>
                  );
                })}
                <td style={{ textAlign: 'center', fontSize: 10, fontWeight: 700,
                             background: W.totBg, border: `1px solid ${W.border}`,
                             width: TOT_W, minWidth: TOT_W,
                             color: dClr(frontTot[pi]) }}>
                  {fmtDelta(frontTot[pi])}
                </td>
                {BACK_H.map(h => {
                  const hole = holes[h];
                  const d = hole?.deltas?.[pi] ?? 0;
                  return (
                    <td key={h} style={{
                      textAlign: 'center', fontSize: 10, fontWeight: 700,
                      padding: '2px 1px', width: COL_W, minWidth: COL_W,
                      border: `1px solid ${W.border}`,
                      background: cellBg(pi, h),
                      color: hole?.resolved ? dClr(d) : '#ccc',
                    }}>
                      {hole?.resolved ? fmtDelta(d) : ''}
                    </td>
                  );
                })}
                <td style={{ textAlign: 'center', fontSize: 10, fontWeight: 700,
                             background: W.totBg, border: `1px solid ${W.border}`,
                             width: TOT_W, minWidth: TOT_W,
                             color: dClr(backTot[pi]) }}>
                  {fmtDelta(backTot[pi])}
                </td>
                <td style={{ textAlign: 'center', fontSize: 11, fontWeight: 800,
                             background: W.totBg, border: `1px solid ${W.border}`,
                             width: TOT_W, minWidth: TOT_W,
                             color: dClr(cumulative[pi]) }}>
                  {cumulative[pi] > 0 ? `+${cumulative[pi]}` : cumulative[pi] === 0 ? '0' : cumulative[pi]}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
