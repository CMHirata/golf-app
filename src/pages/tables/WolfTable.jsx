// ─── WolfTable.jsx ────────────────────────────────────────────────────────────
// Render-only Wolf game table.
// Wolf_Contract.md §8 / ARCHITECTURE_FOUNDATIONS §2 (UI layer).
//
// CONTAINS NO SCORING LOGIC. All display values come from props.
// Engine is called via buildWolfState() in scorecardUtils.js (Category 2).
// ScorecardPage calls buildWolfState and passes wolfState as a prop.
//
// Props:
//   players:     activePlayers[]
//   wolfState:   WolfResult from buildWolfState() — { holes, cumulative }
//   opts:        gameOpts.Wolf — { bet, wolfOrder, carryover, grossNetNOL }
//   isLandscape: boolean
//
// ✅ Self-checked (16-A): No engine calls. All data from props. Zero-width
//   guard on wolfState present. Player name display uses resolveDisplayNames.
//   carryPoints column shows accumulated carry coming INTO each hole.

import { COL_W, TOT_W, nameTd, resolveDisplayNames } from '../scorecard/scorecardUtils.js';
import { G } from '../../components/ui.jsx';

// Design tokens for Wolf table
const W = {
  hdrBg:  '#f0e8f8',
  hdrClr: '#4a1580',
  totBg:  '#dac8f5',
  totClr: '#4a1580',
  border: '#dac8f5',
};

const WOLF_A  = '#e8f0fc'; // winner chip bg (wolf-side)
const WOLF_B  = '#fef3e8'; // winner chip bg (opp-side)
const POS_CLR = '#27ae60'; // positive running total
const NEG_CLR = '#d32f2f'; // negative running total
const NEU_CLR = '#888';    // zero running total

function ptChip(val) {
  const clr = val > 0 ? POS_CLR : val < 0 ? NEG_CLR : NEU_CLR;
  const bg  = val > 0 ? '#edfaee' : val < 0 ? '#ffeaea' : '#f4f4f4';
  return (
    <div style={{
      display: 'inline-block', minWidth: 28, textAlign: 'center',
      padding: '1px 5px', borderRadius: 8,
      background: bg, border: `1px solid ${clr}`,
      fontSize: 10, fontWeight: 700, color: clr,
    }}>
      {val > 0 ? `+${val}` : val}
    </div>
  );
}

export default function WolfTable({ players, wolfState, opts, isLandscape }) {
  if (!wolfState || !players || players.length !== 4) return null;

  const { holes, cumulative } = wolfState;
  const dispNames = resolveDisplayNames(players);
  const firstName = i => dispNames[i]?.name || players[i]?.name?.split(' ')[0] || '?';

  // Running totals per player accumulated as we render rows
  const running = [0, 0, 0, 0];

  const thHdr = (content, w, extra = {}) => (
    <th style={{
      background: W.hdrBg, color: W.hdrClr,
      fontSize: 10, fontWeight: 700,
      padding: '3px 2px', textAlign: 'center',
      width: w, minWidth: w,
      border: `1px solid ${W.border}`,
      ...extra,
    }}>{content}</th>
  );

  return (
    <div style={{ overflowX: 'auto', marginBottom: 8, WebkitOverflowScrolling: 'touch' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 11, tableLayout: 'fixed', width: '100%' }}>
        <thead>
          <tr>
            {thHdr('#', 20)}
            {thHdr('Wolf', 44)}
            {thHdr('Pick', 52)}
            {thHdr('Pts', 28)}
            {thHdr('Result', 56)}
            {players.map((_, i) => thHdr(firstName(i), COL_W, {}))}
          </tr>
        </thead>
        <tbody>
          {holes.map((hole, rowIdx) => {
            // Accumulate running totals
            hole.deltas.forEach((d, i) => (running[i] += d));

            const rowBg = rowIdx % 2 === 0 ? '#fafafa' : '#fff';
            const holeNum = hole.holeIdx + 1;

            // Wolf / pick label
            const wolfName = firstName(hole.wolfIdx);
            let pickLabel = '—';
            if (hole.resolved || hole.blindWolf || hole.loneWolf || hole.partnerIdx != null) {
              if (hole.blindWolf)      pickLabel = 'Blind';
              else if (hole.loneWolf)  pickLabel = 'Lone';
              else if (hole.partnerIdx != null) pickLabel = `+ ${firstName(hole.partnerIdx)}`;
            }

            // Points at stake
            let ptsDisplay = null;
            if (hole.pointValue > 0) {
              const carry = hole.carryPoints;
              const base  = hole.pointValue;
              if (carry > 0) {
                ptsDisplay = <span style={{ color: '#e07020', fontWeight: 700 }}>{base + carry}*</span>;
              } else {
                ptsDisplay = <span>{base}</span>;
              }
            }

            // Result chip
            let resultCell = null;
            if (hole.resolved && !hole.tied && hole.winningTeam) {
              const wt = hole.winningTeam;
              const isWolfWin = wt.includes(hole.wolfIdx);
              const chipBg  = isWolfWin ? WOLF_A : WOLF_B;
              const chipClr = isWolfWin ? W.hdrClr : '#7b3f00';
              const label   = isWolfWin
                ? (hole.loneWolf || hole.blindWolf ? 'Wolf' : `Wolf+${firstName(hole.partnerIdx)}`)
                : 'Opponents';
              resultCell = (
                <div style={{
                  display: 'inline-block', padding: '1px 5px', borderRadius: 6,
                  background: chipBg, border: `1px solid ${chipClr}`,
                  fontSize: 10, fontWeight: 700, color: chipClr, whiteSpace: 'nowrap',
                }}>
                  {label}
                </div>
              );
            } else if (hole.resolved && hole.tied) {
              resultCell = <span style={{ color: '#aaa', fontSize: 10 }}>Tie</span>;
            }

            const td = (content, w, align = 'center', extra = {}) => (
              <td style={{
                padding: '2px 3px', textAlign: align, background: rowBg,
                border: `1px solid #eee`, width: w, minWidth: w,
                ...extra,
              }}>{content}</td>
            );

            return (
              <tr key={hole.holeIdx}>
                {td(holeNum, 20)}
                {td(<span style={{ fontWeight: 700, color: W.hdrClr }}>{wolfName}</span>, 44)}
                {td(<span style={{ color: '#444' }}>{pickLabel}</span>, 52)}
                {td(ptsDisplay ?? '—', 28)}
                {td(resultCell ?? '', 56)}
                {players.map((_, i) => td(ptChip(running[i]), COL_W))}
              </tr>
            );
          })}

          {/* Totals row */}
          <tr>
            <td colSpan={5} style={{
              background: W.totBg, color: W.totClr,
              fontWeight: 700, fontSize: 11,
              padding: '3px 6px', textAlign: 'right',
              border: `1px solid ${W.border}`,
            }}>Total pts</td>
            {cumulative.map((val, i) => (
              <td key={i} style={{
                background: W.totBg,
                border: `1px solid ${W.border}`,
                padding: '2px 3px', textAlign: 'center',
              }}>
                {ptChip(val)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      {holes.some(h => h.carryPoints > 0) && (
        <div style={{ fontSize: 10, color: '#e07020', marginTop: 3, textAlign: 'right' }}>
          * includes carried points
        </div>
      )}
    </div>
  );
}
