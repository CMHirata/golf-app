// ─── WolfTable.jsx ────────────────────────────────────────────────────────────
// Render-only Wolf game table. Wolf_Contract.md §8 / ARCHITECTURE_FOUNDATIONS §2.
// CONTAINS NO SCORING LOGIC. All display values from props.
//
// Layout: white Card wrapper with title, Front 9 stacked over Back 9 rows,
// one row per player in wolfOrder sequence — matching other game tables.
// Green palette (G / GA / GB tokens). Purple = wolf team; orange = opponents.
//
// ✅ Self-checked (16-A fix2): Card wrapper, stacked front/back, wolfOrder
//   player sequence, team-colour cell shading, green palette header.

import { G, GA, GB, Card } from '../../components/ui.jsx';
import { COL_W, TOT_W, NAME_MIN, resolveDisplayNames, FRONT_H, BACK_H } from '../scorecard/scorecardUtils.js';

const WOLF_TEAM_BG = '#ede0f8'; // wolf + partner cells
const OPP_BG      = '#fff3e8'; // opponent cells
const POS_CLR     = '#27ae60';
const NEG_CLR     = '#c0392b';
const NEU_CLR     = '#aaa';

const fmtDelta = d => d === 0 ? '–' : d > 0 ? `+${d}` : `${d}`;
const dClr     = d => d > 0 ? POS_CLR : d < 0 ? NEG_CLR : NEU_CLR;

export default function WolfTable({ players, wolfState, opts }) {
  if (!wolfState || !players || players.length !== 4) return null;

  const { holes, cumulative } = wolfState;
  const wolfOrder = opts?.wolfOrder || [0, 1, 2, 3];
  const grossNetNOL = opts?.grossNetNOL ?? 'net';
  const modeLabel = grossNetNOL === 'gross' ? 'Gross' : grossNetNOL === 'netofflow' ? 'Net Off Low' : 'Net';

  const dispNames = resolveDisplayNames(players);
  const firstName = i => dispNames[i]?.name || players[i]?.name?.split(' ')[0] || '?';
  const orderedPis = wolfOrder; // players in wolfOrder sequence

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
    if (!hole?.resolved) return '#fff';
    const wolfTeam = (hole.loneWolf || hole.blindWolf)
      ? [hole.wolfIdx]
      : [hole.wolfIdx, hole.partnerIdx].filter(x => x != null);
    return wolfTeam.includes(pi) ? WOLF_TEAM_BG : OPP_BG;
  };

  const hdrTh = (content, w, extra = {}) => (
    <th style={{
      background: GA, color: G, fontSize: 10, fontWeight: 700,
      padding: '3px 2px', textAlign: 'center',
      width: w, minWidth: w,
      borderBottom: `1px solid #ddeedd`,
      ...extra,
    }}>{content}</th>
  );

  const renderHalf = (holeRange, label, totArr) => (
    <>
      {/* Section label row */}
      <tr>
        <td colSpan={holeRange.length + 2}
          style={{ fontSize: 10, fontWeight: 700, color: '#888',
                   padding: '5px 6px 2px', background: '#fff' }}>
          {label}
        </td>
      </tr>
      {/* Hole number header */}
      <tr>
        {hdrTh('', NAME_MIN, { textAlign: 'left', padding: '3px 6px' })}
        {holeRange.map(h => hdrTh(h + 1, COL_W))}
        {hdrTh('Total', TOT_W)}
      </tr>
      {/* Player rows */}
      {orderedPis.map((pi) => (
        <tr key={pi}>
          <td style={{ padding: '3px 6px', fontSize: 12, fontWeight: 600,
                       color: '#222', background: '#fff',
                       overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                       width: NAME_MIN, minWidth: NAME_MIN,
                       borderBottom: '1px solid #f0f0f0' }}>
            {firstName(pi)}
          </td>
          {holeRange.map(h => {
            const hole = holes[h];
            const d = hole?.deltas?.[pi] ?? 0;
            return (
              <td key={h} style={{
                textAlign: 'center', fontSize: 10, fontWeight: 700,
                padding: '3px 1px', width: COL_W, minWidth: COL_W,
                background: cellBg(pi, h),
                borderBottom: '1px solid #f0f0f0',
                color: hole?.resolved ? dClr(d) : '#ccc',
              }}>
                {hole?.resolved ? fmtDelta(d) : ''}
              </td>
            );
          })}
          <td style={{
            textAlign: 'center', fontSize: 11, fontWeight: 700,
            background: GA, width: TOT_W, minWidth: TOT_W,
            borderBottom: '1px solid #ddeedd',
            color: dClr(totArr[pi]),
          }}>
            {fmtDelta(totArr[pi])}
          </td>
        </tr>
      ))}
    </>
  );

  return (
    <Card>
      {/* Card header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: G }}>Wolf</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#888',
                       background: GA, borderRadius: 8, padding: '2px 8px' }}>
          {modeLabel}
        </span>
      </div>
      <div style={{ fontSize: 10, color: '#aaa', marginBottom: 6 }}>
        purple = wolf team · orange = opponents
      </div>

      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <tbody>
            {renderHalf(FRONT_H, 'Front', frontTot)}
            {/* Spacer */}
            <tr><td colSpan={FRONT_H.length + 2} style={{ height: 8, background: '#fff' }}/></tr>
            {renderHalf(BACK_H, 'Back', backTot)}
          </tbody>
        </table>
      </div>

      {/* Total chips row */}
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        {orderedPis.map(pi => (
          <div key={pi} style={{
            flex: 1, minWidth: 60, textAlign: 'center',
            background: GA, borderRadius: 10, padding: '6px 4px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 2 }}>
              {firstName(pi)}
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: dClr(cumulative[pi]) }}>
              {cumulative[pi] > 0 ? `+${cumulative[pi]}` : cumulative[pi] === 0 ? '0' : cumulative[pi]}
            </div>
            <div style={{ fontSize: 9, color: '#aaa' }}>pts</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
