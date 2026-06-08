// ✅ Self-checked (13-G.2): Three scoreForMode call sites (individual + team A + team B
// hole winner derivations) now read per-player siArray with fallback to round-shared
// hcps for legacy reloads (Handicap_Contract §5).
//
// ⚠️ Self-check finding (post-device-test): runMatchNassau was called without
// the range arg, so its internal F/B split used hardcoded FRONT_H/BACK_H
// (holes 0–8 / 9–17). For a 9-hole round the engine's backBets (holes 9–17)
// had no overlap with the display-layer backH (holes 4–8 from midpoint of [0,8]),
// causing the Back tile to show "–". Fixed: pass { startHole: effStart,
// endHole: effEnd } as the range arg so engine and display use the same midpoint.

// ─── tables/MatchNassauTable.jsx ──────────────────────────────────────────────
// RENDER ONLY — no business logic in this file.
// No scoring calculations. No match state computation.
// All logic must come from engine/ or scorecardUtils.js
//
// Display spec: Nassau_Match_Contract.md v2.9 §1.3 (partial-range note)
// Range spec:   PartialGameContract.md §3.6 (universal F/B/T midpoint rule)

import { useState } from 'react';
import { scoreForMode, xGrossScore } from '../../engine/handicap.js';
import { isNassauMatch, runMatchNassau } from '../../engine/games.js';
import {
  M, MP, COL_W, TOT_W, NAME_MIN,
  fmtLead, buildLeadState, lastScoredInHoles, scoringLabel,
  applyDepartureGuardrailToScores,
} from '../scorecard/scorecardUtils.js';
import { GameSection, HalfLabel, TableDivider } from '../scorecard/GameSection.jsx';
import { PressModal, SegmentChipColumns } from '../scorecard/PressModal.jsx';
import { G, RED } from '../../components/ui.jsx';

// ── Team color tokens — colorblind-safe blue/red, matching SixesTable ─────────
const TMA_BG  = '#dbeeff';
const TMA_CLR = '#0c447c';
const TMA_LED = '#185fa5';
const TMB_BG  = '#fffbe8';
const TMB_CLR = '#7a4f00';
const TMB_LED = '#a06800';

// ── §13.2 Individual format: first + last initial, concatenated ───────────────
const initials = name => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
};

// ── §13.3 Team format: collision-aware name resolution ───────────────────────
function resolveMatchTeamNames(teamAIdxs, teamBIdxs, players) {
  const allIdxs    = [...teamAIdxs, ...teamBIdxs];
  const allPlayers = allIdxs.map(i => players[i]);

  const firstNames = allPlayers.map(p => (p?.name || '?').trim().split(/\s+/)[0]);
  const lastInits  = allPlayers.map(p => {
    const parts = (p?.name || '').trim().split(/\s+/);
    return parts.length >= 2 ? parts[parts.length - 1][0].toUpperCase() : '';
  });

  const resolved = firstNames.map((fn, i) => {
    const collision = firstNames.some((other, j) => j !== i && other === fn);
    if (!collision) return fn;
    return lastInits[i] ? `${fn} ${lastInits[i]}` : fn;
  });

  const resolvedA = resolved.slice(0, teamAIdxs.length);
  const resolvedB = resolved.slice(teamAIdxs.length);

  return {
    chipA: resolvedA.map(n => n[0].toUpperCase()).join('/'),
    chipB: resolvedB.map(n => n[0].toUpperCase()).join('/'),
    nmA:   resolvedA.join('/'),
    nmB:   resolvedB.join('/'),
  };
}

// ── §3.6 Front/Back/Total midpoint derivation ─────────────────────────────────
// Given an effective range [startHole, endHole] (0-based, inclusive), returns
// { frontH, backH, allH } hole-index arrays.
// Back gets the extra hole on odd-length ranges.
function splitByMidpoint(startHole, endHole) {
  const totalHoles = endHole - startHole + 1;
  const midHole    = startHole + Math.floor(totalHoles / 2);
  const frontH = [];
  const backH  = [];
  for (let h = startHole; h < midHole; h++) frontH.push(h);
  for (let h = midHole; h <= endHole; h++) backH.push(h);
  const allH = [...frontH, ...backH];
  return { frontH, backH, allH };
}

// ── Canonical half detection — for single-half landscape ──────────────────────
// Returns true if every hole in the array is in the canonical front 9 (0–8).
const allInFront = holes => holes.length > 0 && holes.every(h => h <= 8);
// Returns true if every hole in the array is in the canonical back 9 (9–17).
const allInBack  = holes => holes.length > 0 && holes.every(h => h >= 9);

export function MatchNassauTable({
  players, scores, hcps, matches, courseHcps, minCourseHcp,
  manualPresses, setManualPresses, isLandscape,
  // Phase 2B range props — per-match ranges resolved inside this table.
  // Defaults preserve byte-identical full-round behavior (§3.6 invariant #13.b).
  gameRanges    = {},
  roundStartHole = 0,
  roundEndHole   = 17,
  // 13-C.7.6: Engine departure data guardrail (PartialGameContract §14
  // invariant 21). Filters scores past departureHole before aggregation.
  earlyDepartureOpts = {},
}) {

  if (!matches?.length) return (
    <GameSection title="Match / Nassau" color={M.hdrClr} borderColor={M.border}>
      <div style={{ color: '#aaa', fontSize: 12, padding: '8px 10px 10px' }}>No matches configured — go to Setup.</div>
    </GameSection>
  );

  // 13-C.7.6: Apply guardrail before any score aggregation. All downstream
  // engine calls (runMatchNassau, indivHoleWinner, teamHoleWinner) read
  // through `scores` so blanket replacement here covers all paths.
  scores = applyDepartureGuardrailToScores(scores, earlyDepartureOpts, players.length);

  const indivHoleWinner = (pi1, pi2, h, mode) => {
    const r1 = scores[h]?.[pi1];
    const r2 = scores[h]?.[pi2];
    if (r1 === '' || r1 == null || r2 === '' || r2 == null) return null;
    const p1X = r1 === 'X', p2X = r2 === 'X';
    if (p1X && p2X) return 0;
    if (p1X) return 2;
    if (p2X) return 1;
    const g1 = parseInt(r1), g2 = parseInt(r2);
    if (!g1 || !g2) return null;
    const v1 = scoreForMode(g1, courseHcps[pi1], (players[pi1]?.siArray || hcps)[h], minCourseHcp, mode);
    const v2 = scoreForMode(g2, courseHcps[pi2], (players[pi2]?.siArray || hcps)[h], minCourseHcp, mode);
    if (v1 < v2) return 1; if (v2 < v1) return 2; return 0;
  };

  const teamHoleWinner = (teamA, teamB, h, mode, tiebreak) => {
    const rawsA = teamA.map(pi => scores[h]?.[pi]);
    const rawsB = teamB.map(pi => scores[h]?.[pi]);
    if (rawsA.some(r => r === '' || r == null) || rawsB.some(r => r === '' || r == null)) return null;
    const valsA = rawsA.map((raw, ii) => {
      if (raw === 'X') return Infinity;
      const g = parseInt(raw);
      return g ? scoreForMode(g, courseHcps[teamA[ii]], (players[teamA[ii]]?.siArray || hcps)[h], minCourseHcp, mode) : Infinity;
    });
    const valsB = rawsB.map((raw, ii) => {
      if (raw === 'X') return Infinity;
      const g = parseInt(raw);
      return g ? scoreForMode(g, courseHcps[teamB[ii]], (players[teamB[ii]]?.siArray || hcps)[h], minCourseHcp, mode) : Infinity;
    });
    const bestA = Math.min(...valsA), bestB = Math.min(...valsB);
    if (!isFinite(bestA) && !isFinite(bestB)) return 0;
    if (bestA < bestB) return 'a';
    if (bestB < bestA) return 'b';
    if (tiebreak === 'second' && teamA.length >= 2 && teamB.length >= 2) {
      const s2A = Math.max(...valsA.filter(isFinite)), s2B = Math.max(...valsB.filter(isFinite));
      if (s2A < s2B) return 'a';
      if (s2B < s2A) return 'b';
    } else if (tiebreak === 'cumulative' && teamA.length >= 2 && teamB.length >= 2) {
      const sumA = valsA.map(v => isFinite(v) ? v : 0).reduce((s, v) => s + v, 0);
      const sumB = valsB.map(v => isFinite(v) ? v : 0).reduce((s, v) => s + v, 0);
      if (sumA < sumB) return 'a';
      if (sumB < sumA) return 'b';
    }
    return tiebreak === 'half' ? 'half' : 0;
  };

  // ── renderHalf — portrait table for one hole array ────────────────────────
  // renderHalf — portrait table for one canonical half.
  // fullHs: full 9-column array (FULL_FRONT or FULL_BACK) — always rendered.
  // hs: in-range subset of fullHs — holes with real data.
  // Holes in fullHs but not in hs render as gray empty cells (matching ScoreGrid).
  const renderHalf = (fullHs, hs, betsForHalf, holeWinFn, nm1, nm2, lbl1, lbl2, isTeam) => {
    const inRange = new Set(hs);
    return (
      <div style={{ padding: '0 8px 4px' }}>
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%', minWidth: NAME_MIN + fullHs.length * COL_W + TOT_W }}>
          <colgroup>
            <col/>
            {fullHs.map(h => <col key={h} style={{ width: COL_W }}/>)}
            <col style={{ width: TOT_W }}/>
          </colgroup>
          <thead>
            <tr>
              <th style={{ padding: '3px 6px', background: M.hdrBg, color: M.hdrClr, fontSize: 10, textAlign: 'left' }}></th>
              {fullHs.map(h => <th key={h} style={{ padding: '2px 1px', background: M.hdrBg, color: M.hdrClr, fontSize: 10, textAlign: 'center' }}>{h + 1}</th>)}
              <th style={{ padding: '2px 4px', background: M.totBg, color: M.totClr, fontSize: 10, textAlign: 'center', fontWeight: 700 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {betsForHalf.map((bet, bi) => {
              const isOverall = bet.isOverall;
              const isPress   = bet.isPress;
              const rowBg     = isOverall ? '#f5fbf5' : '#f5fbf5';
              const labelClr  = isOverall ? MP.clr : '#888';
              const tBg       = isOverall ? MP.totBg : M.totBg;
              const lastH     = [...hs].reverse().find(h => bet.leadState?.[h] !== undefined);
              const leadInfo  = lastH != null ? fmtLead(bet.leadState[lastH].lead, bet.leadState[lastH].matchOver, bet.leadState[lastH].holesLeft) : null;
              const statusClr = leadInfo
                ? (bet.leadState[lastH].lead > 0 ? TMA_LED : bet.leadState[lastH].lead < 0 ? TMB_LED : M.hdrClr)
                : '#aaa';
              return (
                <tr key={bi} style={{ background: rowBg }}>
                  <td style={{ padding: '2px 6px', fontSize: 10, color: labelClr, fontWeight: (isOverall || isPress) ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bet.label}</td>
                  {fullHs.map(h => {
                    // Out-of-range hole — muted green tint, harmonises with Match table palette
                    if (!inRange.has(h)) return <td key={h} style={{ background: '#dceadc' }}/>;
                    if (h < (bet.startHole ?? 0)) return <td key={h} style={{ textAlign: 'center', color: '#e8e8e8', fontSize: 11 }}>·</td>;
                    const w = holeWinFn(h);
                    if (w === null) return <td key={h} style={{ textAlign: 'center', color: '#ddd', fontSize: 11 }}>·</td>;
                    if (w === 0 || w === 'half') return <td key={h} style={{ textAlign: 'center', color: '#bbb', fontSize: 12 }}>–</td>;
                    const side1 = (w === 1 || w === 'a');
                    const chipBg  = side1 ? TMA_BG  : TMB_BG;
                    const chipClr = side1 ? TMA_CLR : TMB_CLR;
                    return (
                      <td key={h} style={{ textAlign: 'center', padding: '1px' }}>
                        <span style={{
                          display: 'inline-block', width: 22, height: 18, lineHeight: '18px',
                          fontSize: 10, fontWeight: 500, borderRadius: 3,
                          background: chipBg, color: chipClr,
                        }}>
                          {side1 ? lbl1 : lbl2}
                        </span>
                      </td>
                    );
                  })}
                  <td style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, background: tBg, color: statusClr, padding: '2px 4px' }}>
                    {leadInfo ? leadInfo.text : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // ── renderAll — landscape table for a given allH/frontH/backH set ─────────
  // singleHalf=true when range is entirely in one canonical half — renders
  // the table with just one hole block and a Status column (no F/B split).
  const renderAll = (allRows, holeWinFn, frontH, backH, allH, nm1, nm2, lbl1, lbl2, isTeam, singleHalf) => {
    if (singleHalf) {
      // Single-half compact landscape: one hole block + Status column
      const tableMinW = NAME_MIN + allH.length * COL_W + TOT_W;
      return (
        <div style={{ overflowX: 'auto', padding: '0 8px 4px' }}>
          <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%', minWidth: tableMinW }}>
            <colgroup>
              <col style={{ minWidth: NAME_MIN }}/>
              {allH.map(h => <col key={h} style={{ width: COL_W }}/>)}
              <col style={{ width: TOT_W }}/>
            </colgroup>
            <thead>
              <tr>
                <th style={{ padding: '3px 6px', background: M.hdrBg, color: M.hdrClr, fontSize: 10, textAlign: 'left' }}></th>
                {allH.map(h => <th key={h} style={{ padding: '2px 1px', background: M.hdrBg, color: M.hdrClr, fontSize: 10, textAlign: 'center' }}>{h + 1}</th>)}
                <th style={{ padding: '2px 4px', background: M.totBg, color: M.totClr, fontSize: 10, textAlign: 'center', fontWeight: 800 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {allRows.map((bet, bi) => {
                const isOverall = bet.isOverall;
                const isPress   = bet.isPress;
                const rowBg     = isOverall ? '#f5fbf5' : '#f5fbf5';
                const labelClr  = isOverall ? MP.clr : '#888';
                const tBg       = isOverall ? MP.totBg : M.totBg;
                const lastAll   = [...allH].reverse().find(h => bet.leadState?.[h] !== undefined);
                const allLead   = lastAll != null ? bet.leadState[lastAll] : null;
                const allInfo   = allLead ? fmtLead(allLead.lead, allLead.matchOver, allLead.holesLeft) : null;
                const allClr    = allLead ? (allLead.lead > 0 ? TMA_LED : allLead.lead < 0 ? TMB_LED : M.hdrClr) : '#aaa';
                const holeTd = (h) => {
                  if (h < (bet.startHole ?? 0)) return <td key={h} style={{ textAlign: 'center', color: '#e8e8e8', fontSize: 11 }}>·</td>;
                  const w = holeWinFn(h);
                  if (w === null) return <td key={h} style={{ textAlign: 'center', color: '#ddd', fontSize: 11 }}>·</td>;
                  if (w === 0 || w === 'half') return <td key={h} style={{ textAlign: 'center', color: '#bbb', fontSize: 12 }}>–</td>;
                  const side1   = (w === 1 || w === 'a');
                  const chipBg  = side1 ? TMA_BG  : TMB_BG;
                  const chipClr = side1 ? TMA_CLR : TMB_CLR;
                  return (
                    <td key={h} style={{ textAlign: 'center', padding: '1px' }}>
                      <span style={{ display: 'inline-block', width: 22, height: 18, lineHeight: '18px', fontSize: 10, fontWeight: 500, borderRadius: 3, background: chipBg, color: chipClr }}>
                        {side1 ? lbl1 : lbl2}
                      </span>
                    </td>
                  );
                };
                return (
                  <tr key={bi} style={{ background: rowBg }}>
                    <td style={{ padding: '2px 6px', fontSize: 10, color: labelClr, fontWeight: (isOverall || isPress) ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bet.label}</td>
                    {allH.map(h => holeTd(h))}
                    <td style={{ textAlign: 'center', fontSize: 11, fontWeight: 800, background: tBg, color: allClr, padding: '2px 4px' }}>{allInfo ? allInfo.text : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }

    // Two-half landscape: Front holes | Front Status | Back holes | Back Status | Total Status
    const tableMinW = NAME_MIN + allH.length * COL_W + 2 * TOT_W + TOT_W;
    return (
      <div style={{ overflowX: 'auto', padding: '0 8px 4px' }}>
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%', minWidth: tableMinW }}>
          <colgroup>
            <col style={{ minWidth: NAME_MIN }}/>
            {frontH.map(h => <col key={h} style={{ width: COL_W }}/>)}
            <col style={{ width: TOT_W }}/>
            {backH.map(h => <col key={h} style={{ width: COL_W }}/>)}
            <col style={{ width: TOT_W }}/>
            <col style={{ width: TOT_W }}/>
          </colgroup>
          <thead>
            <tr>
              <th style={{ padding: '3px 6px', background: M.hdrBg, color: M.hdrClr, fontSize: 10, textAlign: 'left' }}></th>
              {frontH.map(h => <th key={h} style={{ padding: '2px 1px', background: M.hdrBg, color: M.hdrClr, fontSize: 10, textAlign: 'center' }}>{h + 1}</th>)}
              <th style={{ padding: '2px 4px', background: M.totBg, color: M.totClr, fontSize: 10, textAlign: 'center', fontWeight: 700 }}>Total</th>
              {backH.map(h => <th key={h} style={{ padding: '2px 1px', background: M.hdrBg, color: M.hdrClr, fontSize: 10, textAlign: 'center' }}>{h + 1}</th>)}
              <th style={{ padding: '2px 4px', background: M.totBg, color: M.totClr, fontSize: 10, textAlign: 'center', fontWeight: 700 }}>Total</th>
              <th style={{ padding: '2px 4px', background: M.totBg, color: M.totClr, fontSize: 10, textAlign: 'center', fontWeight: 800 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {allRows.map((bet, bi) => {
              const isOverall = bet.isOverall;
              const isPress   = bet.isPress;
              const rowBg     = isOverall ? '#f5fbf5' : '#f5fbf5';
              const labelClr  = isOverall ? MP.clr : '#888';
              const tBg       = isOverall ? MP.totBg : M.totBg;

              const lastF  = [...frontH].reverse().find(h => bet.leadStateFront?.[h] !== undefined);
              const f9Lead = lastF != null ? bet.leadStateFront[lastF] : null;
              const f9Info = f9Lead ? fmtLead(f9Lead.lead, f9Lead.matchOver, f9Lead.holesLeft) : null;
              const f9Clr  = f9Lead ? (f9Lead.lead > 0 ? TMA_LED : f9Lead.lead < 0 ? TMB_LED : M.hdrClr) : '#aaa';

              const lastB  = [...backH].reverse().find(h => bet.leadStateBack?.[h] !== undefined);
              const b9Lead = lastB != null ? bet.leadStateBack[lastB] : null;
              const b9Info = b9Lead ? fmtLead(b9Lead.lead, b9Lead.matchOver, b9Lead.holesLeft) : null;
              const b9Clr  = b9Lead ? (b9Lead.lead > 0 ? TMA_LED : b9Lead.lead < 0 ? TMB_LED : M.hdrClr) : '#aaa';

              const lastAll  = [...allH].reverse().find(h => bet.leadState?.[h] !== undefined);
              const allLead  = lastAll != null ? bet.leadState[lastAll] : null;
              const allInfo  = allLead ? fmtLead(allLead.lead, allLead.matchOver, allLead.holesLeft) : null;
              const allClr   = allLead ? (allLead.lead > 0 ? TMA_LED : allLead.lead < 0 ? TMB_LED : M.hdrClr) : '#aaa';

              const holeTd = (h) => {
                if (h < (bet.startHole ?? 0)) return <td key={h} style={{ textAlign: 'center', color: '#e8e8e8', fontSize: 11 }}>·</td>;
                const w = holeWinFn(h);
                if (w === null) return <td key={h} style={{ textAlign: 'center', color: '#ddd', fontSize: 11 }}>·</td>;
                if (w === 0 || w === 'half') return <td key={h} style={{ textAlign: 'center', color: '#bbb', fontSize: 12 }}>–</td>;
                const side1   = (w === 1 || w === 'a');
                const chipBg  = side1 ? TMA_BG  : TMB_BG;
                const chipClr = side1 ? TMA_CLR : TMB_CLR;
                return (
                  <td key={h} style={{ textAlign: 'center', padding: '1px' }}>
                    <span style={{ display: 'inline-block', width: 22, height: 18, lineHeight: '18px', fontSize: 10, fontWeight: 500, borderRadius: 3, background: chipBg, color: chipClr }}>
                      {side1 ? lbl1 : lbl2}
                    </span>
                  </td>
                );
              };

              return (
                <tr key={bi} style={{ background: rowBg }}>
                  <td style={{ padding: '2px 6px', fontSize: 10, color: labelClr, fontWeight: (isOverall || isPress) ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bet.label}</td>
                  {frontH.map(h => holeTd(h))}
                  <td style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, background: tBg, color: f9Clr, padding: '2px 3px' }}>{f9Info ? f9Info.text : '—'}</td>
                  {backH.map(h => holeTd(h))}
                  <td style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, background: tBg, color: b9Clr, padding: '2px 3px' }}>{b9Info ? b9Info.text : '—'}</td>
                  <td style={{ textAlign: 'center', fontSize: 11, fontWeight: 800, background: tBg, color: allClr, padding: '2px 4px' }}>{allInfo ? allInfo.text : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const [pressModal, setPressModal] = useState(null);

  return (
    <>
      {pressModal && (() => {
        const { betHoles, mpKey, depth, minHole, existingPressHole, label, status, winnerName } = pressModal;
        return (
          <PressModal
            title={`Press: ${label}`}
            status={status}
            winnerName={winnerName}
            validHoles={betHoles}
            existingPressHole={existingPressHole}
            minHole={minHole}
            onConfirm={h => {
              setManualPresses(prev => {
                const ex = prev[mpKey] || [];
                const trimmed = ex.slice(0, depth);
                if (trimmed.includes(h)) return prev;
                return { ...prev, [mpKey]: [...trimmed, h].sort((a,b) => a-b) };
              });
              setPressModal(null);
            }}
            onRemove={h => {
              setManualPresses(prev => ({
                ...prev,
                [mpKey]: (prev[mpKey] || []).filter(x => x < h),
              }));
              setPressModal(null);
            }}
            onClose={() => setPressModal(null)}
          />
        );
      })()}

      {matches.map((matchDef, mi) => {
        const matchId  = matchDef.id || `match_${mi}`;
        const isTeam   = matchDef.format === 'team';
        const nassau   = isNassauMatch(matchDef);
        const mode     = matchDef.grossNetNOL ?? matchDef.scoring ?? 'net';
        const tiebreak = matchDef.scoring ?? matchDef.tiebreak ?? 'none';
        const matchLetter = String.fromCharCode(65 + mi);
        const title    = `Match ${matchLetter}`;

        const legacyN = (matchDef.autoPress && matchDef.autoPress !== 'none') ? parseInt(matchDef.autoPress) : 0;
        const toN = (v) => (v && v !== 'none') ? parseInt(v) : legacyN;
        const apF = toN(matchDef.autoPressF);
        const apB = toN(matchDef.autoPressB);
        const apO = toN(matchDef.autoPressO);
        const apParts = [];
        if (apF > 0) apParts.push(`F${apF}`);
        if (apB > 0) apParts.push(`B${apB}`);
        if (apO > 0) apParts.push(`O${apO}`);
        const badge = scoringLabel(mode);

        // ── Per-match effective range — §3.6 midpoint derivation ─────────────
        // Each match's range comes from gameRanges[matchId] if present and
        // valid; otherwise falls back to round bounds (invariant #13.b).
        const rawEntry = gameRanges?.[matchId];
        let effStart, effEnd;
        if (rawEntry
            && Number.isInteger(rawEntry.startHole)
            && Number.isInteger(rawEntry.endHole)
            && rawEntry.startHole >= roundStartHole
            && rawEntry.endHole   <= roundEndHole
            && rawEntry.startHole <  rawEntry.endHole) {
          effStart = rawEntry.startHole;
          effEnd   = rawEntry.endHole;
        } else {
          effStart = roundStartHole;
          effEnd   = roundEndHole;
        }
        const { frontH, backH, allH } = splitByMidpoint(effStart, effEnd);

        // Single-half landscape: range is entirely in one canonical half
        const rangeSingleHalf = allInFront(allH) || allInBack(allH);

        // Canonical display halves — split at the golf-course boundary (holes 0–8
        // are front nine, holes 9–17 are back nine) regardless of midpoint.
        // Used for non-Nassau portrait rendering so that e.g. holes 5–13 display
        // as "holes 5–9" on the front row and "holes 10–13" on the back row,
        // matching the physical scorecard layout. Nassau matches use frontH/backH
        // from splitByMidpoint (which drives the engine's F/B bet segments).
        const canonFrontH = allH.filter(h => h <= 8);
        const canonBackH  = allH.filter(h => h >= 9);

        // ── Name / chip label resolution ──────────────────────────────────────
        let nm1, nm2, lbl1, lbl2;
        if (isTeam) {
          const r = resolveMatchTeamNames(matchDef.teamA || [], matchDef.teamB || [], players);
          nm1 = r.nmA; nm2 = r.nmB; lbl1 = r.chipA; lbl2 = r.chipB;
        } else {
          nm1 = players[matchDef.p1]?.name || '?';
          nm2 = players[matchDef.p2]?.name || '?';
          lbl1 = initials(nm1);
          lbl2 = initials(nm2);
        }

        const valid = isTeam
          ? (matchDef.teamA?.length > 0 && matchDef.teamB?.length > 0 && [...(matchDef.teamA||[]), ...(matchDef.teamB||[])].every(i => players[i]))
          : (players[matchDef.p1] && players[matchDef.p2]);

        if (!valid) return (
          <GameSection key={matchId} title={title} badge={badge} color={M.hdrClr} borderColor={M.border}>
            <div style={{ color: '#aaa', fontSize: 12, padding: '8px 10px 10px' }}>Incomplete match setup — go to Setup.</div>
          </GameSection>
        );

        const holeWinFn = isTeam
          ? (h) => teamHoleWinner(matchDef.teamA, matchDef.teamB, h, mode, tiebreak)
          : (h) => indivHoleWinner(matchDef.p1, matchDef.p2, h, mode);

        // Internal press key strings remain 'Match:{id}:Overall' — NOT renamed this session
        const mpFront   = (manualPresses || {})[`Match:${matchId}:Front`]   || [];
        const mpBack    = (manualPresses || {})[`Match:${matchId}:Back`]    || [];
        const mpOverall = (manualPresses || {})[`Match:${matchId}:Overall`] || [];

        // Pass effStart/effEnd so the engine's internal F/B midpoint matches
        // the display-layer splitByMidpoint derivation above. Without this,
        // a 9-hole match's engine backBets cover holes 9–17 (engine default)
        // while backH covers holes 4–8 (midpoint of [0,8]) — no overlap.
        const { front: frontBets, back: backBets, overall: overallBets } = runMatchNassau(
          scores, players, matchDef, courseHcps, minCourseHcp,
          { front: mpFront, back: mpBack, overall: mpOverall },
          { startHole: effStart, endHole: effEnd }
        );

        // buildDisplayBets: create lead-state-decorated bet rows for portrait rendering
        const buildDisplayBets = (engineBets, hs, isOverallRow) => {
          return engineBets
            .filter(b => (b.startHole ?? 0) <= hs[hs.length - 1])
            .map((b, i) => {
              const startH    = b.startHole ?? hs[0];
              const runHoles  = hs.filter(h => h >= startH);
              const leadState = buildLeadState(holeWinFn, runHoles);
              return { label: b.label, startHole: startH, isOverall: isOverallRow, isPress: i > 0, leadState };
            });
        };

        // Portrait: separate front/back half tables.
        // Nassau: use midpoint-derived frontH/backH (matches engine F/B bet segments).
        // Non-Nassau: use canonFrontH/canonBackH (canonical hole-9 boundary) so
        //   a range like holes 5-13 shows "5-9" front and "10-13" back.
        const frontDisplayBets = nassau ? buildDisplayBets(frontBets, frontH, false) : [];
        const backDisplayBets  = nassau ? buildDisplayBets(backBets,  backH,  false) : [];
        const overallFront     = buildDisplayBets(overallBets, nassau ? frontH : canonFrontH, nassau).map(b => ({ ...b, isPress: false }));
        const overallBack      = buildDisplayBets(overallBets, nassau ? backH  : canonBackH,  nassau).map(b => ({ ...b, isPress: false }));

        const frontRows = nassau ? [...frontDisplayBets, ...overallFront] : overallFront;
        const backRows  = nassau ? [...backDisplayBets,  ...overallBack]  : overallBack;

        // Landscape rows: three leadState scopes per row
        const allRows = (() => {
          const makeBet = (engineBets, isOverallRow) => engineBets.map((b, i) => {
            const startH = b.startHole ?? 0;
            return {
              label:          b.label,
              startHole:      startH,
              isOverall:      isOverallRow,
              isPress:        i > 0,
              leadState:      buildLeadState(holeWinFn, allH.filter(h => h >= startH)),
              leadStateFront: buildLeadState(holeWinFn, frontH.filter(h => h >= startH)),
              leadStateBack:  buildLeadState(holeWinFn, backH.filter(h => h >= startH)),
            };
          });
          if (!nassau) return makeBet(overallBets, false);
          return [
            ...makeBet(frontBets,   false),
            ...makeBet(backBets,    false),
            ...makeBet(overallBets, true).map(b => ({ ...b, isPress: false })),
          ];
        })();

        // makeBetChip: builds a chip descriptor for the bottom chip bar
        const makeBetChip = (bet, segHoles, segLabel, depth, totalDepths, mpKey, mpArr) => {
          const betHoles  = segHoles.filter(h => h >= (bet.startHole ?? segHoles[0]));
          const leadState = buildLeadState(holeWinFn, betHoles);
          const lastH     = [...betHoles].reverse().find(h => leadState[h] !== undefined);
          const info      = lastH != null ? fmtLead(leadState[lastH].lead, leadState[lastH].matchOver, leadState[lastH].holesLeft) : null;
          const winnerName = info ? (leadState[lastH].lead > 0 ? nm1 : leadState[lastH].lead < 0 ? nm2 : 'All Square') : '—';

          const chipBg = info
            ? (leadState[lastH].lead > 0
                ? TMA_BG
                : leadState[lastH].lead < 0
                  ? TMB_BG
                  : '#f5fbf5')
            : M.hdrBg;
          const chipColor = info
            ? (leadState[lastH].lead > 0 ? TMA_LED : leadState[lastH].lead < 0 ? TMB_LED : '#aaa')
            : '#aaa';

          const existingPressHole = mpArr[depth] ?? null;
          const minHole       = bet.startHole ?? segHoles[0];
          const label         = depth === 0 ? segLabel : bet.label;
          const hasChildPress = existingPressHole !== null;
          const isLastInChain = depth === totalDepths - 1;
          const lastScored    = lastScoredInHoles(holeWinFn, betHoles);
          const canAddPress   = isLastInChain && lastScored !== null && lastScored < betHoles[betHoles.length - 1];
          const pressable     = hasChildPress || canAddPress;

          return {
            label, winnerName, value: info ? info.text : '—',
            color: chipColor,
            bg: chipBg, labelColor: M.hdrClr,
            pressable, hasChildPress, isPress: depth > 0,
            onLongPress: () => setPressModal({
              matchId, segment: segLabel, betHoles, mpKey, mpArr, depth,
              minHole, existingPressHole,
              label: `${nm1} vs ${nm2} · ${label}`,
              status: info ? info.text : '—',
              winnerName,
            }),
          };
        };

        // buildSegment: chip bar segment builder — uses derived per-match hole arrays
        const buildSegment = (engineBets, segHoles, segLabel) => {
          // Internal key uses 'Overall' (NOT renamed this session — D2 scope guardrail)
          const mpKey = `Match:${matchId}:${segLabel === 'Total' ? 'Overall' : segLabel}`;
          const mpArr = (manualPresses || {})[mpKey] || [];
          const total = engineBets.length || 1;
          const [main, ...presses] = engineBets;
          if (!main) return {
            mainChip: makeBetChip({ startHole: segHoles[0], label: segLabel }, segHoles, segLabel, 0, 1, mpKey, mpArr),
            pressChips: [],
          };
          return {
            mainChip:   makeBetChip(main, segHoles, segLabel, 0, total, mpKey, mpArr),
            pressChips: presses.map((pb, pi) => makeBetChip(pb, segHoles, segLabel, pi + 1, total, mpKey, mpArr)),
          };
        };

        // Segment chip bar: "Front" / "Back" / "Total" labels (D2)
        // Internal press key for Total segment remains 'Match:{id}:Overall' (D2 guardrail)
        const segments = nassau ? [
          buildSegment(frontBets,   frontH, 'Front'),
          buildSegment(backBets,    backH,  'Back'),
          buildSegment(overallBets, allH,   'Total'),
        ] : [
          buildSegment(overallBets, allH, 'Total'),
        ];

        // Portrait: HalfLabel texts.
        // Nassau: labels derive from midpoint-split frontH/backH (matches engine segments).
        // Non-Nassau: labels derive from canonical canonFrontH/canonBackH (hole-9 boundary).
        const dispFrontH = nassau ? frontH : canonFrontH;
        const dispBackH  = nassau ? backH  : canonBackH;
        const frontLabel = allInFront(dispFrontH) && allInBack(dispBackH) ? 'Front' : `Holes ${dispFrontH[0]+1}–${dispFrontH[dispFrontH.length-1]+1}`;
        const backLabel  = allInFront(dispFrontH) && allInBack(dispBackH) ? 'Back'  : `Holes ${dispBackH[0]+1}–${dispBackH[dispBackH.length-1]+1}`;

        // Portrait layout decision — mirrors ScoreGrid's half-rendering rule:
        //   - Range spans both canonical halves (holes 1–9 AND 10–18 both present):
        //     render two half-tables (front section + back section), same as ScoreGrid.
        //   - Range entirely in one canonical half (e.g. 9-hole front-only round):
        //     render a single table covering allH — no split, no empty back section.
        const splitPortrait = !rangeSingleHalf; // true when range spans both canonical halves

        // For the single-table (single-half) path, build rows over allH directly.
        const singleHalfRows = buildDisplayBets(overallBets, allH, false);

        return (
          <GameSection key={matchId} title={title} badge={badge} color={M.hdrClr} borderColor={M.border}>
            <div style={{ fontSize: 11, fontWeight: 700, color: M.hdrClr, padding: '5px 10px 2px' }}>
              {isTeam ? (
                <>
                  <span style={{ color: TMA_LED }}>{nm1}</span>
                  <span style={{ color: '#aaa', fontWeight: 400, margin: '0 4px' }}>vs</span>
                  <span style={{ color: TMB_LED }}>{nm2}</span>
                </>
              ) : (
                `${nm1} vs ${nm2}`
              )}
            </div>
            {isLandscape ? (
              renderAll(allRows, holeWinFn, frontH, backH, allH, nm1, nm2, lbl1, lbl2, isTeam, rangeSingleHalf)
            ) : splitPortrait ? (
              <>
                <HalfLabel>{frontLabel}</HalfLabel>
                {renderHalf([0,1,2,3,4,5,6,7,8], dispFrontH, frontRows, holeWinFn, nm1, nm2, lbl1, lbl2, isTeam)}
                <TableDivider/>
                <HalfLabel>{backLabel}</HalfLabel>
                {renderHalf([9,10,11,12,13,14,15,16,17], dispBackH, backRows, holeWinFn, nm1, nm2, lbl1, lbl2, isTeam)}
              </>
            ) : (
              // Single canonical half — one table, no divider
              <>
                <HalfLabel>{`Holes ${allH[0]+1}–${allH[allH.length-1]+1}`}</HalfLabel>
                {renderHalf(allInFront(allH) ? [0,1,2,3,4,5,6,7,8] : [9,10,11,12,13,14,15,16,17], allH, singleHalfRows, holeWinFn, nm1, nm2, lbl1, lbl2, isTeam)}
              </>
            )}
            <TableDivider/>
            <SegmentChipColumns segments={segments}/>
          </GameSection>
        );
      })}
    </>
  );
}
