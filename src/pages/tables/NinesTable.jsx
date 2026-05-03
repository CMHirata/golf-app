// ─── tables/NinesTable.jsx ────────────────────────────────────────────────────
// ✅ Self-checked (13-G.2): scoreForMode now reads per-player siArray for net
// allocation (Handicap_Contract §5). Fallback to round-shared hcps for legacy
// reloads.
//
// RENDER ONLY — no business logic in this file.
// No scoring calculations. No match state computation.
// All logic must come from engine/ or scorecardUtils.js
//
// ✅ Self-checked (13-C.3): Accepts startHole/endHole props (default 0/17).
// Rotation begins at startHole — handled naturally because `holeData` iterates
// only the provided `hs` array, and non-range holes never appear in that
// array. Half labels "Front 9/Back 9" → "Front/Back". Single-half landscape
// renders a 9-column table (Q5). PartialGameContract §2.4, §3.4.

import { scoreForMode, xGrossScore } from '../../engine/handicap.js';
import { ninesPts } from '../../engine/games.js';
import { N, nameTd, scoringLabel, applyDepartureGuardrailToScores } from '../scorecard/scorecardUtils.js';
import { GameSection, GameTable, HalfLabel, TableDivider, ColNote, PlayerChips } from '../scorecard/GameSection.jsx';
import { RED } from '../../components/ui.jsx';

export function NinesTable({
  players, scores, pars, hcps, opts, courseHcps, minCourseHcp, ninesPlayers, isLandscape,
  startHole = 0, endHole = 17,
  // 13-C.7.6: Engine departure data guardrail (PartialGameContract §14
  // invariant 21). Filters scores past departureHole before aggregation.
  earlyDepartureOpts = {},
}) {
  // 13-C.7.6: Apply guardrail before any score aggregation.
  scores = applyDepartureGuardrailToScores(scores, earlyDepartureOpts, players.length);

  const mode  = opts?.grossNetNOL ?? opts?.scoring ?? 'net';
  const blitz = opts?.blitz   || false;

  if (!ninesPlayers || ninesPlayers.length !== 3) return null;
  const activeIdxs = ninesPlayers;
  const activePlayers = activeIdxs.map(i => players[i]).filter(Boolean);
  if (activePlayers.length !== 3) return null;

  const holeData = (hs) => hs.map(h => {
    const raws = activeIdxs.map(pi => scores[h]?.[pi]);
    // Stop if any player unscored (empty/null). 'X' counts as scored.
    if (raws.some(r => r === '' || r == null)) return null;

    const xFlags = raws.map(r => r === 'X');
    const allX   = xFlags.every(Boolean);
    if (allX) return new Array(activeIdxs.length).fill(3);

    // Compute numeric values; X players get null (replaced with worst+1 below)
    const numericVals = raws.map((raw, k) => {
      if (xFlags[k]) return null;
      const pi = activeIdxs[k];
      const g  = parseInt(raw);
      return mode === 'gross' ? g : scoreForMode(g, courseHcps[pi], (players[pi]?.siArray || hcps)[h], minCourseHcp, mode);
    });
    const maxReal  = Math.max(...numericVals.filter(v => v !== null));
    const normVals = numericVals.map(v => v === null ? maxReal + 1 : v);
    return ninesPts(normVals, blitz);
  });

  const vColor = v => v === null ? '#ccc' : v === 9 ? '#7b1fa2' : v === 5 ? '#27ae60' : v === 0 ? RED : '#333';

  // 13-C.3: Range-derived hole arrays
  const frontHoles = []; const backHoles = [];
  for (let h = startHole; h <= endHole; h++) {
    if (h < 9) frontHoles.push(h); else backHoles.push(h);
  }
  const rangeHoles = [...frontHoles, ...backHoles];
  const hasFront = frontHoles.length > 0;
  const hasBack  = backHoles.length  > 0;

  const renderHalf = (hs, label) => {
    if (!hs.length) return null;
    const data   = holeData(hs);
    const halves = activePlayers.map((_, k) => data.reduce((s, pts) => s + (pts ? pts[k] : 0), 0));
    return (
      <>
        <HalfLabel>{label}</HalfLabel>
        <div style={{ padding: '0 8px 4px' }}>
          <GameTable hs={hs} colHeader="Total" headerBg={N.hdrBg} headerColor={N.hdrClr} totBg={N.totBg} totColor={N.totClr}>
            {activePlayers.map((p, k) => (
              <tr key={activeIdxs[k]} style={{ background: N.row[k % 2] }}>
                <td style={{ ...nameTd, color: N.hdrClr }}>{p.name}</td>
                {data.map((pts, i) => { const v = pts ? pts[k] : null; return <td key={i} style={{ textAlign: 'center', fontSize: 11, color: vColor(v), fontWeight: v === 9 ? 700 : 400 }}>{v === null ? '·' : v}</td>; })}
                <td style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: N.totClr, background: N.totBg, padding: '2px 4px' }}>{halves[k]}</td>
              </tr>
            ))}
          </GameTable>
        </div>
      </>
    );
  };

  const renderAll18 = () => {
    const frontData = holeData(frontHoles);
    const backData  = holeData(backHoles);
    const frontTots = activePlayers.map((_, k) => frontData.reduce((s, pts) => s + (pts ? pts[k] : 0), 0));
    const backTots  = activePlayers.map((_, k) => backData.reduce((s, pts) => s + (pts ? pts[k] : 0), 0));

    // Q5: single-half landscape
    if (!hasFront || !hasBack) {
      const hs = hasFront ? frontHoles : backHoles;
      const data = hasFront ? frontData : backData;
      const tots = hasFront ? frontTots : backTots;
      return (
        <div style={{ padding: '0 8px 4px' }}>
          <GameTable hs={hs} colHeader="Total" headerBg={N.hdrBg} headerColor={N.hdrClr} totBg={N.totBg} totColor={N.totClr}>
            {activePlayers.map((p, k) => (
              <tr key={activeIdxs[k]} style={{ background: N.row[k % 2] }}>
                <td style={{ ...nameTd, color: N.hdrClr }}>{p.name}</td>
                {data.map((pts, i) => { const v = pts ? pts[k] : null; return <td key={i} style={{ textAlign: 'center', fontSize: 11, color: vColor(v), fontWeight: v === 9 ? 700 : 400 }}>{v === null ? '·' : v}</td>; })}
                <td style={{ textAlign: 'center', fontSize: 11, fontWeight: 800, color: N.totClr, background: N.totBg, padding: '2px 3px' }}>{tots[k]}</td>
              </tr>
            ))}
          </GameTable>
        </div>
      );
    }

    return (
      <div style={{ padding: '0 8px 4px' }}>
        <GameTable landscape headerBg={N.hdrBg} headerColor={N.hdrClr} totBg={N.totBg} totColor={N.totClr}>
          {activePlayers.map((p, k) => (
            <tr key={activeIdxs[k]} style={{ background: N.row[k % 2] }}>
              <td style={{ ...nameTd, color: N.hdrClr }}>{p.name}</td>
              {frontData.map((pts, i) => { const v = pts ? pts[k] : null; return <td key={`f${i}`} style={{ textAlign: 'center', fontSize: 11, color: vColor(v), fontWeight: v === 9 ? 700 : 400 }}>{v === null ? '·' : v}</td>; })}
              <td style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: N.totClr, background: N.totBg, padding: '2px 3px' }}>{frontTots[k]}</td>
              {backData.map((pts, i) => { const v = pts ? pts[k] : null; return <td key={`b${i}`} style={{ textAlign: 'center', fontSize: 11, color: vColor(v), fontWeight: v === 9 ? 700 : 400 }}>{v === null ? '·' : v}</td>; })}
              <td style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: N.totClr, background: N.totBg, padding: '2px 3px' }}>{backTots[k]}</td>
              <td style={{ textAlign: 'center', fontSize: 11, fontWeight: 800, color: N.totClr, background: N.totBg, padding: '2px 3px' }}>{frontTots[k] + backTots[k]}</td>
            </tr>
          ))}
        </GameTable>
      </div>
    );
  };

  const allData = holeData(rangeHoles);
  const totals = activePlayers.map((_, k) => allData.reduce((s, pts) => s + (pts ? pts[k] : 0), 0));

  return (
    <GameSection title="Nines" badge={`${scoringLabel(mode)}${blitz ? ' · Blitz' : ''}`} color={N.hdrClr} borderColor={N.border}>
      {isLandscape ? (
        renderAll18()
      ) : (
        <>
          {hasFront && renderHalf(frontHoles, 'Front')}
          {hasFront && hasBack && <TableDivider/>}
          {hasBack  && renderHalf(backHoles,  'Back')}
        </>
      )}
      <TableDivider/>
      <PlayerChips players={activePlayers} values={totals} chipBg={N.hdrBg} chipColor={N.hdrClr} leaderBg={N.totBg} leaderColor={N.totClr} fmtVal={v => v} subLabel=""/>
      <ColNote>9 = blitz · 5/3/1 = positions · 0 = lost hole</ColNote>
    </GameSection>
  );
}
