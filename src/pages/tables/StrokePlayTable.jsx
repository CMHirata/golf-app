// ─── tables/StrokePlayTable.jsx ───────────────────────────────────────────────
// ✅ Self-checked (13-G.2): scoreForMode in net derivation now reads per-player
// siArray (Handicap_Contract §5). Fallback to round-shared hcps for legacy reloads.
//
// RENDER ONLY — no business logic in this file.
// No scoring calculations. No match state computation.
// All logic must come from engine/ or scorecardUtils.js
//
// ✅ Self-checked (13-C.8): activeIdxs now filtered to exclude players with
// `exclude_player` resolution for Stroke Play (PartialGameContract §11.3 /
// §6.1 pool-family). Mirrors engine reader in payouts.js.
//
// ✅ Self-checked (13-C.3): Accepts startHole/endHole props (default 0/17).
// Player stats iterate the range only; cum/thru/byHole all reflect the
// effective range. Half labels changed "Front 9 / Back 9" → "Front / Back".
// Single-half landscape renders a 9-column table (Q5). PartialGameContract §2.4.

import { scoreForMode } from '../../engine/handicap.js';
import { P, nameTd, scoringLabel, applyDepartureGuardrailToScores } from '../scorecard/scorecardUtils.js';
import { GameSection, GameTable, HalfLabel, TableDivider } from '../scorecard/GameSection.jsx';
import { RED } from '../../components/ui.jsx';

export function StrokePlayTable({
  players, scores, pars, hcps, opts, courseHcps, minCourseHcp, strokePlayPlayers, isLandscape,
  startHole = 0, endHole = 17,
  // 13-C.7.6: Engine departure data guardrail (PartialGameContract §14
  // invariant 21). Filters out scores past departureHole for any departed
  // player before any aggregation. Default `{}` = no-op when no departures.
  earlyDepartureOpts = {},
}) {
  const mode = opts?.grossNetNOL ?? opts?.scoring ?? 'gross';

  // 13-C.7.6: Apply guardrail before any score aggregation.
  scores = applyDepartureGuardrailToScores(scores, earlyDepartureOpts, players.length);

  const activeIdxsRaw = strokePlayPlayers?.length ? strokePlayPlayers : players.map((_, i) => i);
  // 13-C.8: filter out players with `exclude_player` resolution for Stroke Play
  // (PartialGameContract §11.3 / §6.1 pool-family). Mirrors engine reader in
  // payouts.js — display and engine stay in lockstep.
  const activeIdxs = activeIdxsRaw.filter(pi =>
    earlyDepartureOpts?.[pi]?.gameResolutions?.['Stroke Play']?.topLevel !== 'exclude_player'
  );

  const displayMin = (mode === 'netofflow' && activeIdxs.length)
    ? Math.min(...activeIdxs.map(i => courseHcps[i]))
    : minCourseHcp;

  const fmtDiff = v => v === null ? '·' : v === 0 ? 'E' : v > 0 ? `+${v}` : `${v}`;
  const diffClr = v => v === null ? '#ddd' : v < 0 ? '#27ae60' : v > 0 ? RED : '#555';

  // 13-C.3: Range-derived arrays. Full round → identical to pre-13-C.3 constants.
  const frontHoles = []; const backHoles = [];
  for (let h = startHole; h <= endHole; h++) {
    if (h < 9) frontHoles.push(h); else backHoles.push(h);
  }
  const hasFront = frontHoles.length > 0;
  const hasBack  = backHoles.length  > 0;

  // Stats iterate only over the range. Out-of-range byHole entries left null.
  const playerStats = players.map((_, pi) => {
    let cum = 0, thru = 0;
    const byHole = Array(18).fill(null);
    for (let h = startHole; h <= endHole; h++) {
      const g = parseInt(scores[h]?.[pi]);
      if (!g) continue;
      const net = scoreForMode(g, courseHcps[pi], (players[pi]?.siArray || hcps)[h], displayMin, mode);
      cum += net - pars[h];
      thru++;
      byHole[h] = net - pars[h];
    }
    return { byHole, cum, thru };
  });

  const subsetPlayers = activeIdxs.map(pi => ({ p: players[pi], pi })).filter(({ p }) => p);

  const renderHalf = (hs, label) => {
    if (!hs.length) return null;
    const halves = players.map((_, pi) => hs.reduce((s, h) => s + (playerStats[pi].byHole[h] ?? 0), 0));
    return (
      <>
        <HalfLabel>{label}</HalfLabel>
        <div style={{ padding: '0 8px 4px' }}>
          <GameTable hs={hs} colHeader="Total" headerBg={P.hdrBg} headerColor={P.hdrClr} totBg={P.totBg} totColor={P.totClr}>
            {subsetPlayers.map(({ p, pi }, rowIdx) => {
              const { byHole } = playerStats[pi];
              const anyPlayed  = hs.some(h => byHole[h] !== null);
              return (
                <tr key={pi} style={{ background: P.row[rowIdx % 2] }}>
                  <td style={{ ...nameTd, color: P.hdrClr }}>{p.name}</td>
                  {hs.map(h => <td key={h} style={{ textAlign: 'center', fontSize: 11, color: diffClr(byHole[h]), fontWeight: byHole[h] != null && byHole[h] <= -1 ? 600 : 400 }}>{fmtDiff(byHole[h])}</td>)}
                  <td style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: P.totClr, background: P.totBg, padding: '2px 4px' }}>{anyPlayed ? fmtDiff(halves[pi]) : '·'}</td>
                </tr>
              );
            })}
          </GameTable>
        </div>
      </>
    );
  };

  const renderAll18 = () => {
    const frontHalves = players.map((_, pi) => frontHoles.reduce((s, h) => s + (playerStats[pi].byHole[h] ?? 0), 0));
    const backHalves  = players.map((_, pi) => backHoles.reduce((s, h)  => s + (playerStats[pi].byHole[h] ?? 0), 0));

    // Q5: single-half landscape rendering
    if (!hasFront || !hasBack) {
      const hs = hasFront ? frontHoles : backHoles;
      return (
        <div style={{ padding: '0 8px 4px' }}>
          <GameTable hs={hs} colHeader="Total" headerBg={P.hdrBg} headerColor={P.hdrClr} totBg={P.totBg} totColor={P.totClr}>
            {subsetPlayers.map(({ p, pi }, rowIdx) => {
              const { byHole } = playerStats[pi];
              const anyPlayed = hs.some(h => byHole[h] !== null);
              return (
                <tr key={pi} style={{ background: P.row[rowIdx % 2] }}>
                  <td style={{ ...nameTd, color: P.hdrClr }}>{p.name}</td>
                  {hs.map(h => <td key={h} style={{ textAlign: 'center', fontSize: 11, color: diffClr(byHole[h]), fontWeight: byHole[h] != null && byHole[h] <= -1 ? 600 : 400 }}>{fmtDiff(byHole[h])}</td>)}
                  <td style={{ textAlign: 'center', fontSize: 11, fontWeight: 800, color: P.totClr, background: P.totBg, padding: '2px 3px' }}>{anyPlayed ? fmtDiff(playerStats[pi].cum) : '·'}</td>
                </tr>
              );
            })}
          </GameTable>
        </div>
      );
    }

    return (
      <div style={{ padding: '0 8px 4px' }}>
        <GameTable landscape headerBg={P.hdrBg} headerColor={P.hdrClr} totBg={P.totBg} totColor={P.totClr}>
          {subsetPlayers.map(({ p, pi }, rowIdx) => {
            const { byHole } = playerStats[pi];
            const anyF = frontHoles.some(h => byHole[h] !== null);
            const anyB = backHoles.some(h  => byHole[h] !== null);
            return (
              <tr key={pi} style={{ background: P.row[rowIdx % 2] }}>
                <td style={{ ...nameTd, color: P.hdrClr }}>{p.name}</td>
                {frontHoles.map(h => <td key={h} style={{ textAlign: 'center', fontSize: 11, color: diffClr(byHole[h]), fontWeight: byHole[h] != null && byHole[h] <= -1 ? 600 : 400 }}>{fmtDiff(byHole[h])}</td>)}
                <td style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: P.totClr, background: P.totBg, padding: '2px 3px' }}>{anyF ? fmtDiff(frontHalves[pi]) : '·'}</td>
                {backHoles.map(h => <td key={h} style={{ textAlign: 'center', fontSize: 11, color: diffClr(byHole[h]), fontWeight: byHole[h] != null && byHole[h] <= -1 ? 600 : 400 }}>{fmtDiff(byHole[h])}</td>)}
                <td style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: P.totClr, background: P.totBg, padding: '2px 3px' }}>{anyB ? fmtDiff(backHalves[pi]) : '·'}</td>
                <td style={{ textAlign: 'center', fontSize: 11, fontWeight: 800, color: P.totClr, background: P.totBg, padding: '2px 3px' }}>{(anyF || anyB) ? fmtDiff(playerStats[pi].cum) : '·'}</td>
              </tr>
            );
          })}
        </GameTable>
      </div>
    );
  };

  const sorted = [...subsetPlayers.map(({ p, pi }) => ({ p, pi, stat: playerStats[pi] }))].sort((a, b) => a.stat.cum - b.stat.cum);
  const n = sorted.length;

  return (
    <GameSection title="Stroke Play" badge={scoringLabel(mode)} color={P.hdrClr} borderColor={P.border}>
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
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)`, gap: 6, padding: '6px 8px 8px' }}>
        {sorted.map(({ p, pi, stat }, rank) => {
          const parts = (p?.name || '').trim().split(/\s+/);
          const first = parts[0] || '?';
          const last  = parts.length >= 2 ? parts[parts.length - 1] : '';
          return (
            <div key={pi} style={{ textAlign: 'center', borderRadius: 8, padding: '5px 4px', background: rank === 0 && stat.thru > 0 ? P.totBg : P.hdrBg, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: P.hdrClr, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{first}</div>
              {last && <div style={{ fontSize: 10, fontWeight: 400, color: P.hdrClr, opacity: 0.65, lineHeight: 1.2, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{last}</div>}
              <div style={{ fontSize: 15, fontWeight: 700, color: stat.thru > 0 ? diffClr(stat.cum) : '#aaa' }}>{stat.thru > 0 ? fmtDiff(stat.cum) : '—'}</div>
              <div style={{ fontSize: 10, color: '#aaa' }}>{stat.thru > 0 ? `thru ${stat.thru}h` : '—'}</div>
            </div>
          );
        })}
      </div>
    </GameSection>
  );
}
