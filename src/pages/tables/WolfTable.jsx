// ─── tables/WolfTable.jsx ─────────────────────────────────────────────────────
// Render-only Wolf game table. Wolf_Contract.md §8 / ARCHITECTURE_FOUNDATIONS §2.
// CONTAINS NO SCORING LOGIC. All display values from props.
//
// Uses GameSection / GameTable / HalfLabel / TableDivider / PlayerChips
// from GameSection.jsx — identical structure to NinesTable / StablefordTable.
// Green palette (M tokens). Wolf-team cells shaded purple; opponent cells orange.
//
// ✅ Self-checked (16-A fix3): uses GameSection shell, GameTable for column
//   alignment, PlayerChips for totals. wolfOrder player sequence. Portrait
//   stacked front/back. Landscape all-18. Team shading per hole.

import { M, nameTd, scoringLabel } from '../scorecard/scorecardUtils.js';
import { GameSection, GameTable, HalfLabel, TableDivider, PlayerChips } from '../scorecard/GameSection.jsx';

const WOLF_TEAM_BG = '#ede0f8'; // wolf + partner cells  (purple tint)
const OPP_BG      = '#fff3e8'; // opponent cells         (orange tint)
const POS_CLR     = '#27ae60';
const NEG_CLR     = '#c0392b';
const NEU_CLR     = '#aaa';

const fmtDelta = d => d === 0 ? '·' : d > 0 ? `+${d}` : `${d}`;
const dClr     = d => d > 0 ? POS_CLR : d < 0 ? NEG_CLR : NEU_CLR;

// Wolf design tokens — green palette matching M but with row alternation
const W = {
  hdrBg:  M.hdrBg,
  hdrClr: M.hdrClr,
  totBg:  M.totBg,
  totClr: M.totClr,
  border: M.border,
  row:    ['#f5fbf5', '#edf7ed'],
};

export default function WolfTable({ players, wolfState, opts, isLandscape }) {
  if (!wolfState || !players || players.length !== 4) return null;

  const { holes, cumulative } = wolfState;
  const wolfOrder   = opts?.wolfOrder   || [0, 1, 2, 3];
  const grossNetNOL = opts?.grossNetNOL ?? 'net';

  // Players rendered in wolfOrder sequence
  const orderedPis = wolfOrder;
  const orderedPlayers = orderedPis.map(pi => players[pi]).filter(Boolean);

  // Per-player half totals
  const frontTot = new Array(4).fill(0);
  const backTot  = new Array(4).fill(0);
  holes.forEach(hole => {
    hole.deltas.forEach((d, pi) => {
      if (hole.holeIdx < 9) frontTot[pi] += d; else backTot[pi] += d;
    });
  });

  // Background for a cell: purple = wolf team, orange = opponents, white = unplayed
  const cellBg = (pi, h) => {
    const hole = holes[h];
    if (!hole?.resolved) return undefined; // inherit row bg
    const wolfTeam = (hole.loneWolf || hole.blindWolf)
      ? [hole.wolfIdx]
      : [hole.wolfIdx, hole.partnerIdx].filter(x => x != null);
    return wolfTeam.includes(pi) ? WOLF_TEAM_BG : OPP_BG;
  };

  const FRONT_H = [0,1,2,3,4,5,6,7,8];
  const BACK_H  = [9,10,11,12,13,14,15,16,17];

  const renderHalf = (hs, label) => {
    return (
      <>
        <HalfLabel>{label}</HalfLabel>
        <div style={{ padding: '0 8px 4px' }}>
          <GameTable hs={hs} colHeader="Total" headerBg={W.hdrBg} headerColor={W.hdrClr} totBg={W.totBg} totColor={W.totClr}>
            {orderedPlayers.map((p, rowIdx) => {
              const pi  = orderedPis[rowIdx];
              const tot = hs === FRONT_H ? frontTot[pi] : backTot[pi];
              return (
                <tr key={pi} style={{ background: W.row[rowIdx % 2] }}>
                  <td style={{ ...nameTd, color: W.hdrClr }}>{p.name}</td>
                  {hs.map(h => {
                    const hole = holes[h];
                    const d    = hole?.deltas?.[pi] ?? 0;
                    const bg   = cellBg(pi, h);
                    return (
                      <td key={h} style={{
                        textAlign: 'center', fontSize: 11,
                        fontWeight: hole?.resolved && d !== 0 ? 700 : 400,
                        color: hole?.resolved ? dClr(d) : '#ccc',
                        ...(bg ? { background: bg } : {}),
                      }}>
                        {hole?.resolved ? fmtDelta(d) : '·'}
                      </td>
                    );
                  })}
                  <td style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: W.totClr, background: W.totBg, padding: '2px 4px' }}>
                    {tot !== 0 ? fmtDelta(tot) : '·'}
                  </td>
                </tr>
              );
            })}
          </GameTable>
        </div>
      </>
    );
  };

  const renderAll18 = () => (
    <div style={{ padding: '0 8px 4px' }}>
      <GameTable landscape headerBg={W.hdrBg} headerColor={W.hdrClr} totBg={W.totBg} totColor={W.totClr}>
        {orderedPlayers.map((p, rowIdx) => {
          const pi = orderedPis[rowIdx];
          const ft = frontTot[pi];
          const bt = backTot[pi];
          return (
            <tr key={pi} style={{ background: W.row[rowIdx % 2] }}>
              <td style={{ ...nameTd, color: W.hdrClr }}>{p.name}</td>
              {FRONT_H.map(h => {
                const hole = holes[h]; const d = hole?.deltas?.[pi] ?? 0; const bg = cellBg(pi, h);
                return <td key={h} style={{ textAlign:'center', fontSize:11, fontWeight: hole?.resolved && d !== 0 ? 700 : 400, color: hole?.resolved ? dClr(d) : '#ccc', ...(bg ? { background: bg } : {}) }}>{hole?.resolved ? fmtDelta(d) : '·'}</td>;
              })}
              <td style={{ textAlign:'center', fontSize:11, fontWeight:700, color:W.totClr, background:W.totBg, padding:'2px 3px' }}>{ft !== 0 ? fmtDelta(ft) : '·'}</td>
              {BACK_H.map(h => {
                const hole = holes[h]; const d = hole?.deltas?.[pi] ?? 0; const bg = cellBg(pi, h);
                return <td key={h} style={{ textAlign:'center', fontSize:11, fontWeight: hole?.resolved && d !== 0 ? 700 : 400, color: hole?.resolved ? dClr(d) : '#ccc', ...(bg ? { background: bg } : {}) }}>{hole?.resolved ? fmtDelta(d) : '·'}</td>;
              })}
              <td style={{ textAlign:'center', fontSize:11, fontWeight:700, color:W.totClr, background:W.totBg, padding:'2px 3px' }}>{bt !== 0 ? fmtDelta(bt) : '·'}</td>
              <td style={{ textAlign:'center', fontSize:11, fontWeight:800, color:W.totClr, background:W.totBg, padding:'2px 3px' }}>{cumulative[pi] !== 0 ? fmtDelta(cumulative[pi]) : '·'}</td>
            </tr>
          );
        })}
      </GameTable>
    </div>
  );

  return (
    <GameSection title="Wolf" badge={scoringLabel(grossNetNOL)} color={W.hdrClr} borderColor={W.border}>
      {isLandscape ? (
        renderAll18()
      ) : (
        <>
          {renderHalf(FRONT_H, 'Front')}
          <TableDivider/>
          {renderHalf(BACK_H, 'Back')}
        </>
      )}
      <TableDivider/>
      <PlayerChips
        players={orderedPlayers}
        values={orderedPis.map(pi => cumulative[pi])}
        chipBg={W.hdrBg} chipColor={W.hdrClr}
        leaderBg={W.totBg} leaderColor={W.totClr}
        fmtVal={v => v > 0 ? `+${v}` : v} subLabel="pts"
      />
    </GameSection>
  );
}
