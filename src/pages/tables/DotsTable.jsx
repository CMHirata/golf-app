// ✅ Self-checked (13-C.8): individual-mode dtIdxs now filtered to exclude
// players with `exclude_player` resolution (PartialGameContract §11.3 / §6.1
// pool-family). Team mode unchanged — exclude_player is rejected by the
// resolver UI for team Dots so the filter is a no-op there. Engine reader
// in payouts.js applies the same filter at compute time, keeping display
// and engine in lockstep.
//
// ✅ Self-checked: verified startHole/endHole props consume call-site prop names,
// §3.6 midpoint derivation for front/back split, §3.7 segLen derivation for
// Sixes mode SEG_HOLES, all data helpers updated to use allH (not ALL18),
// landscape single-half, renderAll18→renderAll renamed, renderSegGrid uses
// dynamic holes+labels, pivot helpers (pivotSegTot, teamDotCountHoles) use
// derived segs, no parseInt('X'), default [0,17] byte-identical to prior behavior.

// ─── tables/DotsTable.jsx ─────────────────────────────────────────────────────
// RENDER ONLY — no business logic in this file.
// No scoring calculations. No match state computation.
// All logic must come from engine/ or scorecardUtils.js
// Team mode layout: Dots_Contract.md §10.5 (v2.4)
//   Sixes: three segment blocks; A/B/C sub-columns in pivot
//   Match: front/back blocks with team label; Team A/Team B pivot columns
//   Individual: unchanged (§10.6)
// Range spec: PartialGameContract.md §3.6 (midpoint) / §3.7 (Sixes segLen)
//   effectiveRange passed as { startHole, endHole } at call site

import { useState } from 'react';
import { restoreDotDefs, SP_CLR, SP_BG, SP_HDR, COL_W, TOT_W, NAME_MIN, applyDepartureGuardrailToDotEntries } from '../scorecard/scorecardUtils.js';
import { GameSection, HalfLabel, TableDivider } from '../scorecard/GameSection.jsx';
import { getDotsPartner, getMatchTeamPartner } from '../../engine/games.js';

const entryCount = v => typeof v === 'number' ? v : (v === true ? 1 : 0);

const SP = {
  hdrBg:  SP_HDR,
  hdrClr: SP_CLR,
  totBg:  '#dac8f5',
  totClr: SP_CLR,
  row:    [SP_BG, '#faf5ff'],
  border: '#dac8f5',
};

// ── §3.6 midpoint derivation for front/back split ─────────────────────────────
function splitByMidpoint(startHole, endHole) {
  const totalHoles = endHole - startHole + 1;
  const midHole    = startHole + Math.floor(totalHoles / 2);
  const frontH = [];
  const backH  = [];
  for (let h = startHole; h < midHole; h++) frontH.push(h);
  for (let h = midHole; h <= endHole; h++) backH.push(h);
  return { frontH, backH, allH: [...frontH, ...backH] };
}

// ── §3.7 Sixes segment derivation (mirrors SixesTable.deriveSegs) ─────────────
function deriveSixesSegs(startHole, endHole) {
  const totalHoles = endHole - startHole + 1;
  const segLen = Math.floor(totalHoles / 3);
  const s0start = startHole;
  const s1start = startHole + segLen;
  const s2start = startHole + segLen * 2;
  const seg0holes = [];
  for (let h = s0start; h < s1start; h++) seg0holes.push(h);
  const seg1holes = [];
  for (let h = s1start; h < s2start; h++) seg1holes.push(h);
  const seg2holes = [];
  for (let h = s2start; h <= endHole; h++) seg2holes.push(h);
  return [seg0holes, seg1holes, seg2holes];
}

// ── Canonical half detection ──────────────────────────────────────────────────
const allInFront = holes => holes.length > 0 && holes.every(h => h <= 8);
const allInBack  = holes => holes.length > 0 && holes.every(h => h >= 9);

export function DotsTable({
  players, dots, dotEntries, gameOpts, dotsPlayers, isLandscape,
  sixesTeams, matches,
  // Phase 2B range props — pre-resolved at call site per Dots Contract §7.5/§7.6
  startHole = 0,
  endHole   = 17,
  // 13-C.7.6: Per-player departure metadata. When provided, dotEntries are
  // filtered via the engine departure data guardrail (PartialGameContract
  // §14 invariant 21) — any dot entry for player pi at hole h > departureHole
  // is ignored. Default `{}` preserves byte-identical pre-13-C.7.6 rendering.
  earlyDepartureOpts = {},
}) {
  const [tooltip, setTooltip] = useState(null);

  const restored = restoreDotDefs(dots);

  // 13-C.7.6: Apply guardrail BEFORE any aggregation. All downstream reads
  // of `dotEntries` (per-cell value, totals, share/companion lookups) work
  // off the guarded copy. The engine reader in payouts.js applies the same
  // guardrail at compute time.
  dotEntries = applyDepartureGuardrailToDotEntries(dotEntries, earlyDepartureOpts);

  const rawTeamMode = gameOpts?.Dots?.teamMode ?? gameOpts?.Specials?.teamMode;
  const legacyTeam  = gameOpts?.Dots?.teamScoring ?? gameOpts?.Specials?.teamScoring;
  const isTeamMode  = rawTeamMode ? rawTeamMode !== 'none' : !!legacyTeam;
  const teamSource  = rawTeamMode && rawTeamMode !== 'none'
    ? rawTeamMode
    : (legacyTeam ? 'Sixes' : 'none');
  const isSixes = isTeamMode && teamSource === 'Sixes';
  const isMatch = isTeamMode && teamSource.startsWith('Match:');

  const enabled   = (restored || []).filter(s => s.enabled && (s.id !== 'team' || isTeamMode));
  if (!enabled.length) return null;

  const dtIdxsRaw = dotsPlayers?.length ? dotsPlayers : players.map((_, i) => i);
  // 13-C.8: filter out players with `exclude_player` resolution for Dots/
  // Specials. exclude_player is only allowed for individual-mode Dots (per
  // PartialGameContract §6.1); in team mode the resolution is rejected by
  // the resolver UI so this filter is a no-op there.
  const dtIdxs = !isTeamMode
    ? dtIdxsRaw.filter(pi => {
        const r1 = earlyDepartureOpts?.[pi]?.gameResolutions?.['Dots']?.topLevel;
        const r2 = earlyDepartureOpts?.[pi]?.gameResolutions?.['Specials']?.topLevel;
        return r1 !== 'exclude_player' && r2 !== 'exclude_player';
      })
    : dtIdxsRaw;
  const dtPlayers = dtIdxs.map(i => players[i]).filter(Boolean);

  // ── Derive hole arrays from effective range ───────────────────────────────
  // §3.6 midpoint for front/back (Match and individual modes)
  const { frontH, backH, allH } = splitByMidpoint(startHole, endHole);
  // §3.7 Sixes segments (Sixes team mode)
  const SEG_HOLES = isSixes ? deriveSixesSegs(startHole, endHole) : [[], [], []];

  // Single-half landscape: range entirely in one canonical half
  const rangeSingleHalf = allInFront(allH) || allInBack(allH);

  // ── Data helpers ──────────────────────────────────────────────────────────
  // nonTeamCellCount: counts only non-team entries for a player on a hole.
  const nonTeamCellCount = (h, pi) => {
    let total = 0;
    Object.entries(dotEntries || {}).forEach(([key, v]) => {
      const cnt = entryCount(v); if (!cnt) return;
      const parts = key.split('_');
      if (parseInt(parts[0]) !== h || parseInt(parts[1]) !== pi) return;
      if (parts[2] === 'team') return;
      total += cnt;
    });
    return total;
  };

  const cellCount = (h, pi) => {
    let total = 0;
    Object.entries(dotEntries || {}).forEach(([key, v]) => {
      const cnt = entryCount(v); if (!cnt) return;
      const parts = key.split('_');
      if (parseInt(parts[0]) !== h || parseInt(parts[1]) !== pi) return;
      total += cnt;
    });
    return total;
  };

  // Use derived allH (not hardcoded ALL18) for all round-total helpers
  const playerHolesTot = (pi, holes) => holes.reduce((s, h) => s + nonTeamCellCount(h, pi), 0);
  const playerRoundTot = (pi)         => playerHolesTot(pi, allH);
  const holeTotal      = (h)          => dtIdxs.reduce((sum, pi) => sum + nonTeamCellCount(h, pi), 0);
  const playerSegTot   = (pi, seg)    => playerHolesTot(pi, SEG_HOLES[seg]);

  const dotTypeCountHoles = (pi, dotId, holes) => {
    let cnt = 0;
    for (const h of holes) cnt += entryCount(dotEntries?.[`${h}_${pi}_${dotId}`]);
    return cnt;
  };
  const dotTypeCount = (pi, dotId) => dotTypeCountHoles(pi, dotId, allH);

  // ownDotCount: counts own dots only — excludes companion entries received
  const ownDotCount = (pi) => {
    let cnt = 0;
    Object.entries(dotEntries || {}).forEach(([key, v]) => {
      const c = entryCount(v); if (!c) return;
      const parts = key.split('_');
      if (parseInt(parts[1]) !== pi) return;
      if (parts[2] === 'team' && parts.length > 3) return;
      const sp = (restored || []).find(s => s.enabled && s.id === parts[2]);
      if (sp) cnt += c;
    });
    return cnt;
  };

  // pivotRoundTot: counts ALL entries for pivot Dots total row (over allH)
  const pivotRoundTot = (pi) => {
    let total = 0;
    Object.entries(dotEntries || {}).forEach(([key, v]) => {
      const cnt = entryCount(v); if (!cnt) return;
      const parts = key.split('_');
      if (parseInt(parts[1]) !== pi) return;
      // Only count entries for holes in the effective range
      const h = parseInt(parts[0]);
      if (!allH.includes(h)) return;
      total += cnt;
    });
    return total;
  };

  // pivotSegTot: counts ALL entries for a segment — used in Sixes pivot Total row
  const pivotSegTot = (pi, seg) => {
    const holes = SEG_HOLES[seg];
    let total = 0;
    Object.entries(dotEntries || {}).forEach(([key, v]) => {
      const cnt = entryCount(v); if (!cnt) return;
      const parts = key.split('_');
      if (parseInt(parts[1]) !== pi) return;
      if (!holes.includes(parseInt(parts[0]))) return;
      total += cnt;
    });
    return total;
  };

  const teamDotCountHoles = (pi, holes) => {
    let cnt = 0;
    Object.entries(dotEntries || {}).forEach(([key, v]) => {
      const c = entryCount(v); if (!c) return;
      const parts = key.split('_');
      if (parseInt(parts[1]) !== pi) return;
      if (!holes.includes(parseInt(parts[0]))) return;
      if (parts[2] === 'team') cnt += c;
    });
    return cnt;
  };
  const teamDotCount = (pi) => teamDotCountHoles(pi, allH);

  // ── Tooltip ───────────────────────────────────────────────────────────────
  const tooltipLines = (h, pi) => {
    const lines = [];
    enabled.filter(sp => sp.id !== 'team').forEach(sp => {
      const cnt = entryCount(dotEntries?.[`${h}_${pi}_${sp.id}`]);
      if (cnt > 0) lines.push(cnt > 1 ? `${sp.name} ×${cnt}` : sp.name);
    });
    if (isTeamMode) {
      let teamCnt = 0;
      Object.entries(dotEntries || {}).forEach(([key, v]) => {
        const cnt = entryCount(v); if (!cnt) return;
        const parts = key.split('_');
        if (parseInt(parts[0]) !== h || parseInt(parts[1]) !== pi) return;
        if (parts[2] === 'team') teamCnt += cnt;
      });
      if (teamCnt > 0) lines.push(teamCnt > 1 ? `Team ×${teamCnt}` : 'Team');
    }
    return lines;
  };

  const handleCellTap = (h, pi, count) => {
    if (!count) return;
    setTooltip(prev => (prev?.hole === h && prev?.pi === pi) ? null : { hole: h, pi });
  };

  const TooltipBubble = ({ h, pi }) => {
    const lines = tooltipLines(h, pi);
    if (!lines.length) return null;
    return (
      <div onClick={e => e.stopPropagation()} style={{
        position: 'absolute', top: '100%', right: 0, zIndex: 50,
        background: '#fff', border: `1.5px solid ${SP_CLR}`,
        borderRadius: 8, padding: '5px 9px', minWidth: 90,
        boxShadow: '0 4px 16px rgba(0,0,0,.18)',
        fontSize: 11, color: SP_CLR, fontWeight: 600, whiteSpace: 'nowrap',
      }}>
        {lines.map((l, i) => <div key={i}>{l}</div>)}
      </div>
    );
  };

  const ScoreCell = ({ h, pi }) => {
    const cnt    = nonTeamCellCount(h, pi);
    const isOpen = tooltip?.hole === h && tooltip?.pi === pi;
    return (
      <td
        onClick={e => { e.stopPropagation(); handleCellTap(h, pi, cnt); }}
        style={{ textAlign: 'center', fontSize: 12, position: 'relative',
                 fontWeight: cnt > 0 ? 700 : 400,
                 color: cnt > 0 ? SP.hdrClr : '#ddd',
                 cursor: cnt > 0 ? 'pointer' : 'default',
                 padding: '3px 1px' }}
      >
        {cnt > 0 ? cnt : '·'}
        {isOpen && <TooltipBubble h={h} pi={pi}/>}
      </td>
    );
  };

  const TotCell = ({ value, wide }) => (
    <td style={{
      textAlign: 'center', fontWeight: 700,
      fontSize: wide ? 12 : 11,
      color: SP.totClr, background: SP.totBg,
      padding: '2px 4px',
    }}>
      {value > 0 ? value : '·'}
    </td>
  );

  // ── Team pairing helpers ──────────────────────────────────────────────────
  const getSixesSegPairing = (seg) => {
    if (!sixesTeams) return null;
    const p0        = dtIdxs[0];
    const p0partner = getDotsPartner(p0, seg, sixesTeams, players);
    if (p0partner < 0) return null;
    const teamA = [p0, p0partner];
    const teamB = dtIdxs.filter(pi => !teamA.includes(pi));
    const fmt   = idxs => idxs.map(pi => players[pi]?.name?.split(' ')[0] || '').join('/');
    return `${fmt(teamA)} vs ${fmt(teamB)}`;
  };

  const getMatchPairing = () => {
    if (!matches?.length) return null;
    const matchId   = isMatch ? teamSource.slice(6) : null;
    const teamMatch = (matchId && matches.find(m => m.id === matchId))
      || matches.find(m => m.format === 'team');
    if (!teamMatch) return null;
    const { teamA = [], teamB = [] } = teamMatch;
    const fmt = idxs => idxs.map(pi => players[pi]?.name?.split(' ')[0] || '').join('/');
    return `${fmt(teamA)} vs ${fmt(teamB)}`;
  };

  const getMatchTeams = () => {
    if (!matches?.length) return { teamA: [], teamB: [] };
    const matchId   = isMatch ? teamSource.slice(6) : null;
    const teamMatch = (matchId && matches.find(m => m.id === matchId))
      || matches.find(m => m.format === 'team');
    if (!teamMatch) return { teamA: [], teamB: [] };
    return { teamA: teamMatch.teamA || [], teamB: teamMatch.teamB || [] };
  };

  // ── Shared grid (individual mode + Match F/B blocks) ─────────────────────
  const renderGrid = (holes, label, colLabel) => (
    <>
      {label && <HalfLabel>{label}</HalfLabel>}
      <div style={{ padding: '0 8px 4px', overflowX: 'auto' }} onClick={() => setTooltip(null)}>
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%',
                        minWidth: NAME_MIN + holes.length * COL_W + TOT_W }}>
          <colgroup>
            <col style={{ minWidth: NAME_MIN }}/>
            {holes.map(h => <col key={h} style={{ width: COL_W }}/>)}
            <col style={{ width: TOT_W }}/>
          </colgroup>
          <thead>
            <tr>
              <th style={{ padding: '3px 6px', background: SP.hdrBg, color: SP.hdrClr, fontSize: 10, textAlign: 'left' }}></th>
              {holes.map(h => (
                <th key={h} style={{ padding: '2px 1px', background: SP.hdrBg, color: SP.hdrClr, fontSize: 10, textAlign: 'center' }}>{h + 1}</th>
              ))}
              <th style={{ padding: '2px 4px', background: SP.totBg, color: SP.totClr, fontSize: 10, textAlign: 'center', fontWeight: 700 }}>{colLabel}</th>
            </tr>
          </thead>
          <tbody>
            {dtIdxs.map((pi, rowIdx) => (
              <tr key={pi} style={{ background: SP.row[rowIdx % 2] }}>
                <td style={{ padding: '2px 6px', fontSize: 11, fontWeight: 700, color: SP.hdrClr,
                             overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {players[pi]?.name || ''}
                </td>
                {holes.map(h => <ScoreCell key={h} h={h} pi={pi}/>)}
                <TotCell value={playerHolesTot(pi, holes)}/>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  // ── Sixes: segment grid ────────────────────────────────────────────────────
  const renderSegGrid = (seg) => {
    const holes   = SEG_HOLES[seg];
    if (!holes || holes.length === 0) return null;
    const pairing = getSixesSegPairing(seg);
    // Dynamic hole range label (1-based): "Match A · holes 1–6 · ..."
    const holeRangeLabel = `holes ${holes[0]+1}–${holes[holes.length-1]+1}`;
    const segLetterLabel = ['Match A', 'Match B', 'Match C'][seg];
    const label = pairing
      ? `${segLetterLabel} · ${holeRangeLabel} · ${pairing}`
      : `${segLetterLabel} · ${holeRangeLabel}`;
    const colLabel = 'Total';
    return (
      <div key={seg}>
        <HalfLabel>{label}</HalfLabel>
        <div style={{ padding: '0 8px 4px', overflowX: 'auto' }} onClick={() => setTooltip(null)}>
          <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%',
                          minWidth: NAME_MIN + holes.length * COL_W + TOT_W }}>
            <colgroup>
              <col style={{ minWidth: NAME_MIN }}/>
              {holes.map(h => <col key={h} style={{ width: COL_W }}/>)}
              <col style={{ width: TOT_W }}/>
            </colgroup>
            <thead>
              <tr>
                <th style={{ padding: '3px 6px', background: SP.hdrBg, color: SP.hdrClr, fontSize: 10, textAlign: 'left' }}></th>
                {holes.map(h => (
                  <th key={h} style={{ padding: '2px 1px', background: SP.hdrBg, color: SP.hdrClr, fontSize: 10, textAlign: 'center' }}>{h + 1}</th>
                ))}
                <th style={{ padding: '2px 4px', background: SP.totBg, color: SP.totClr, fontSize: 10, textAlign: 'center', fontWeight: 700 }}>{colLabel}</th>
              </tr>
            </thead>
            <tbody>
              {dtIdxs.map((pi, rowIdx) => (
                <tr key={pi} style={{ background: SP.row[rowIdx % 2] }}>
                  <td style={{ padding: '2px 6px', fontSize: 11, fontWeight: 700, color: SP.hdrClr,
                               overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {players[pi]?.name || ''}
                  </td>
                  {holes.map(h => <ScoreCell key={h} h={h} pi={pi}/>)}
                  <TotCell value={playerSegTot(pi, seg)}/>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ── Landscape / compact: single table spanning effective range ────────────
  // Used by Match and individual modes.
  // singleHalf=true: one hole block + Total column (no F/B split)
  // singleHalf=false: frontH | Front Total | backH | Back Total | Grand Total
  const renderAll = () => {
    if (rangeSingleHalf) {
      // Compact single-half layout
      return (
        <div style={{ padding: '0 8px 4px', overflowX: 'auto' }} onClick={() => setTooltip(null)}>
          <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%',
                          minWidth: NAME_MIN + allH.length * COL_W + TOT_W }}>
            <colgroup>
              <col style={{ minWidth: NAME_MIN }}/>
              {allH.map(h => <col key={h} style={{ width: COL_W }}/>)}
              <col style={{ width: TOT_W }}/>
            </colgroup>
            <thead>
              <tr>
                <th style={{ padding: '3px 6px', background: SP.hdrBg, color: SP.hdrClr, fontSize: 10, textAlign: 'left' }}></th>
                {allH.map(h => <th key={h} style={{ padding: '2px 1px', background: SP.hdrBg, color: SP.hdrClr, fontSize: 10, textAlign: 'center' }}>{h + 1}</th>)}
                <th style={{ padding: '2px 4px', background: SP.totBg, color: SP.totClr, fontSize: 10, textAlign: 'center', fontWeight: 800 }}>Tot</th>
              </tr>
            </thead>
            <tbody>
              {dtIdxs.map((pi, rowIdx) => (
                <tr key={pi} style={{ background: SP.row[rowIdx % 2] }}>
                  <td style={{ padding: '2px 6px', fontSize: 11, fontWeight: 700, color: SP.hdrClr,
                               overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {players[pi]?.name || ''}
                  </td>
                  {allH.map(h => <ScoreCell key={h} h={h} pi={pi}/>)}
                  <TotCell value={playerRoundTot(pi)} wide/>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    // Two-half landscape layout
    const frontTots = dtIdxs.map(pi => playerHolesTot(pi, frontH));
    const backTots  = dtIdxs.map(pi => playerHolesTot(pi, backH));
    const roundTots = dtIdxs.map(pi => playerRoundTot(pi));
    return (
      <div style={{ padding: '0 8px 4px', overflowX: 'auto' }} onClick={() => setTooltip(null)}>
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%',
                        minWidth: NAME_MIN + allH.length * COL_W + 3 * TOT_W }}>
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
              <th style={{ padding: '3px 6px', background: SP.hdrBg, color: SP.hdrClr, fontSize: 10, textAlign: 'left' }}></th>
              {frontH.map(h => <th key={h} style={{ padding: '2px 1px', background: SP.hdrBg, color: SP.hdrClr, fontSize: 10, textAlign: 'center' }}>{h + 1}</th>)}
              <th style={{ padding: '2px 4px', background: SP.totBg, color: SP.totClr, fontSize: 10, textAlign: 'center', fontWeight: 700 }}>F9</th>
              {backH.map(h => <th key={h} style={{ padding: '2px 1px', background: SP.hdrBg, color: SP.hdrClr, fontSize: 10, textAlign: 'center' }}>{h + 1}</th>)}
              <th style={{ padding: '2px 4px', background: SP.totBg, color: SP.totClr, fontSize: 10, textAlign: 'center', fontWeight: 700 }}>B9</th>
              <th style={{ padding: '2px 4px', background: SP.totBg, color: SP.totClr, fontSize: 10, textAlign: 'center', fontWeight: 800 }}>Tot</th>
            </tr>
          </thead>
          <tbody>
            {dtIdxs.map((pi, rowIdx) => (
              <tr key={pi} style={{ background: SP.row[rowIdx % 2] }}>
                <td style={{ padding: '2px 6px', fontSize: 11, fontWeight: 700, color: SP.hdrClr,
                             overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {players[pi]?.name || ''}
                </td>
                {frontH.map(h => <ScoreCell key={h} h={h} pi={pi}/>)}
                <TotCell value={frontTots[rowIdx]}/>
                {backH.map(h => <ScoreCell key={h} h={h} pi={pi}/>)}
                <TotCell value={backTots[rowIdx]}/>
                <TotCell value={roundTots[rowIdx]} wide/>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ── Active dot-type rows for pivot (shared by all pivot variants) ─────────
  const activeRows = [
    ...enabled.filter(sp => sp.id !== 'team').filter(sp => dtIdxs.some(pi => dotTypeCount(pi, sp.id) > 0)),
    ...(isTeamMode && dtIdxs.some(pi => teamDotCount(pi) > 0) ? [{ id: 'team', name: 'Team' }] : []),
  ];

  // ── Pivot: individual mode ─────────────────────────────────────────────────
  const renderPivotIndividual = () => {
    if (!activeRows.length) return null;
    const roundTots = dtIdxs.map(pi => playerRoundTot(pi));
    const maxTot    = Math.max(...roundTots);
    return (
      <div style={{ margin: '0 8px 0', borderRadius: 8, overflow: 'hidden',
                    border: `1px solid ${SP.border}`, background: SP_BG }}>
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%' }}>
          <colgroup>
            <col style={{ minWidth: 70 }}/>
            {dtIdxs.map(pi => <col key={pi} style={{ width: `${Math.floor(100 / (dtIdxs.length + 1))}%` }}/>)}
          </colgroup>
          <thead>
            <tr>
              <th style={{ padding: '4px 8px', background: SP.hdrBg, color: SP.hdrClr, fontSize: 10, textAlign: 'left', fontWeight: 700 }}>Type</th>
              {dtPlayers.map((p, i) => (
                <th key={i} style={{ padding: '4px 4px', background: SP.hdrBg, color: SP.hdrClr, fontSize: 10, textAlign: 'center', fontWeight: 700,
                                     overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name.split(' ')[0]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeRows.map((sp, ri) => (
              <tr key={sp.id} style={{ background: ri % 2 === 0 ? SP_BG : '#faf5ff' }}>
                <td style={{ padding: '4px 8px', fontSize: 11, fontWeight: 600, color: SP.hdrClr }}>{sp.name}</td>
                {dtIdxs.map(pi => {
                  const cnt = sp.id === 'team' ? teamDotCount(pi) : dotTypeCount(pi, sp.id);
                  return (
                    <td key={pi} style={{ textAlign: 'center', fontSize: 12, fontWeight: cnt > 0 ? 700 : 400, color: cnt > 0 ? SP.hdrClr : '#ccc' }}>
                      {cnt > 0 ? cnt : '·'}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr style={{ borderTop: `1.5px solid ${SP.border}` }}>
              <td style={{ padding: '4px 8px', fontSize: 11, fontWeight: 800, color: SP.totClr, background: SP.totBg }}>Total</td>
              {dtIdxs.map((pi, i) => {
                const tot      = roundTots[i];
                const isLeader = tot > 0 && tot === maxTot;
                return (
                  <td key={pi} style={{ textAlign: 'center', fontSize: 14, fontWeight: 800, color: SP.totClr,
                                         background: isLeader ? '#c9a8f0' : SP.totBg, padding: '4px 2px' }}>
                    {tot > 0 ? tot : '·'}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  // ── Pivot: Sixes — A/B/C sub-columns per player ───────────────────────────
  const renderPivotSixes = () => {
    if (!activeRows.length) return null;
    return (
      <div style={{ margin: '0 8px 0', borderRadius: 8, overflow: 'hidden',
                    border: `1px solid ${SP.border}`, background: SP_BG }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%',
                          minWidth: 60 + dtIdxs.length * 3 * 22 }}>
            <colgroup>
              <col style={{ minWidth: 60 }}/>
              {dtIdxs.flatMap(pi => [
                <col key={`${pi}a`} style={{ width: 22 }}/>,
                <col key={`${pi}b`} style={{ width: 22 }}/>,
                <col key={`${pi}c`} style={{ width: 22 }}/>,
              ])}
            </colgroup>
            <thead>
              <tr>
                <th style={{ padding: '4px 8px', background: SP.hdrBg, color: SP.hdrClr, fontSize: 10, textAlign: 'left', fontWeight: 700 }} rowSpan={2}>Type</th>
                {dtPlayers.map((p, i) => (
                  <th key={i} colSpan={3} style={{ padding: '3px 2px', background: SP.hdrBg, color: SP.hdrClr, fontSize: 10, textAlign: 'center', fontWeight: 700,
                                                    borderRight: i < dtPlayers.length - 1 ? `1.5px solid ${SP.border}` : 'none',
                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name.split(' ')[0]}
                  </th>
                ))}
              </tr>
              <tr>
                {dtIdxs.flatMap((pi, i) => (
                  ['A','B','C'].map((lbl, si) => (
                    <th key={`${pi}_${si}`} style={{ padding: '2px 1px', background: '#e8dcf8', color: '#534AB7',
                                                      fontSize: 9, textAlign: 'center', fontWeight: 600,
                                                      borderRight: si === 2 && i < dtIdxs.length - 1 ? `1.5px solid ${SP.border}` : 'none' }}>
                      {lbl}
                    </th>
                  ))
                ))}
              </tr>
            </thead>
            <tbody>
              {activeRows.map((sp, ri) => (
                <tr key={sp.id} style={{ background: ri % 2 === 0 ? SP_BG : '#faf5ff' }}>
                  <td style={{ padding: '3px 8px', fontSize: 10, fontWeight: 600, color: SP.hdrClr }}>{sp.name}</td>
                  {dtIdxs.flatMap((pi, i) => (
                    [0,1,2].map(seg => {
                      const cnt = sp.id === 'team'
                        ? teamDotCountHoles(pi, SEG_HOLES[seg])
                        : dotTypeCountHoles(pi, sp.id, SEG_HOLES[seg]);
                      return (
                        <td key={`${pi}_${seg}`} style={{ textAlign: 'center', fontSize: 11, fontWeight: cnt > 0 ? 700 : 400,
                                                           color: cnt > 0 ? SP.hdrClr : '#ccc',
                                                           borderRight: seg === 2 && i < dtIdxs.length - 1 ? `1.5px solid #d0c0ee` : 'none' }}>
                          {cnt > 0 ? cnt : '·'}
                        </td>
                      );
                    })
                  ))}
                </tr>
              ))}
              <tr style={{ borderTop: `1.5px solid ${SP.border}` }}>
                <td style={{ padding: '3px 8px', fontSize: 10, fontWeight: 800, color: SP.totClr, background: SP.totBg }}>Total</td>
                {dtIdxs.flatMap((pi, i) => (
                  [0,1,2].map(seg => {
                    const tot      = pivotSegTot(pi, seg);
                    const maxSeg   = Math.max(...dtIdxs.map(p => pivotSegTot(p, seg)));
                    const isLeader = tot > 0 && tot === maxSeg;
                    return (
                      <td key={`${pi}_${seg}`} style={{ textAlign: 'center', fontSize: 12, fontWeight: 800,
                                                          color: SP.totClr,
                                                          background: isLeader ? '#c9a8f0' : SP.totBg,
                                                          borderRight: seg === 2 && i < dtIdxs.length - 1 ? `1.5px solid #b08de0` : 'none',
                                                          padding: '3px 2px' }}>
                        {tot > 0 ? tot : '·'}
                      </td>
                    );
                  })
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ── Pivot: Match — Team A / Team B columns ────────────────────────────────
  const renderPivotMatch = () => {
    if (!activeRows.length) return null;
    const { teamA, teamB } = getMatchTeams();
    const tA = teamA.filter(pi => dtIdxs.includes(pi));
    const tB = teamB.filter(pi => dtIdxs.includes(pi));
    if (!tA.length && !tB.length) return renderPivotIndividual();

    const allIdxs = [...tA, ...tB];
    const roundTots = allIdxs.map(pi => pivotRoundTot(pi));
    const maxTot    = Math.max(...roundTots);

    return (
      <div style={{ margin: '0 8px 0', borderRadius: 8, overflow: 'hidden',
                    border: `1px solid ${SP.border}`, background: SP_BG }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%',
                          minWidth: 60 + allIdxs.length * 38 }}>
            <colgroup>
              <col style={{ minWidth: 60 }}/>
              {allIdxs.map(pi => <col key={pi} style={{ width: 38 }}/>)}
            </colgroup>
            <thead>
              <tr>
                <th style={{ padding: '4px 8px', background: SP.hdrBg, color: SP.hdrClr, fontSize: 10, textAlign: 'left', fontWeight: 700 }} rowSpan={2}>Type</th>
                {tA.length > 0 && (
                  <th colSpan={tA.length} style={{ padding: '3px 2px', background: SP.hdrBg, color: SP.hdrClr, fontSize: 11, textAlign: 'center', fontWeight: 700,
                                                    borderRight: `2px solid ${SP.border}` }}>
                    Team A
                  </th>
                )}
                {tB.length > 0 && (
                  <th colSpan={tB.length} style={{ padding: '3px 2px', background: SP.hdrBg, color: SP.hdrClr, fontSize: 11, textAlign: 'center', fontWeight: 700 }}>
                    Team B
                  </th>
                )}
              </tr>
              <tr>
                {tA.map((pi, i) => (
                  <th key={pi} style={{ padding: '3px 2px', background: '#e8dcf8', color: '#534AB7',
                                         fontSize: 9, fontWeight: 600, textAlign: 'center',
                                         borderRight: i === tA.length - 1 ? `2px solid ${SP.border}` : 'none',
                                         overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {players[pi]?.name?.split(' ')[0] || ''}
                  </th>
                ))}
                {tB.map(pi => (
                  <th key={pi} style={{ padding: '3px 2px', background: '#e8dcf8', color: '#534AB7',
                                         fontSize: 9, fontWeight: 600, textAlign: 'center',
                                         overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {players[pi]?.name?.split(' ')[0] || ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeRows.map((sp, ri) => (
                <tr key={sp.id} style={{ background: ri % 2 === 0 ? SP_BG : '#faf5ff' }}>
                  <td style={{ padding: '3px 8px', fontSize: 10, fontWeight: 600, color: SP.hdrClr }}>{sp.name}</td>
                  {tA.map((pi, i) => {
                    const cnt = sp.id === 'team' ? teamDotCount(pi) : dotTypeCount(pi, sp.id);
                    return (
                      <td key={pi} style={{ textAlign: 'center', fontSize: 11, fontWeight: cnt > 0 ? 700 : 400,
                                             color: cnt > 0 ? SP.hdrClr : '#ccc',
                                             borderRight: i === tA.length - 1 ? `2px solid #d0c0ee` : 'none' }}>
                        {cnt > 0 ? cnt : '·'}
                      </td>
                    );
                  })}
                  {tB.map(pi => {
                    const cnt = sp.id === 'team' ? teamDotCount(pi) : dotTypeCount(pi, sp.id);
                    return (
                      <td key={pi} style={{ textAlign: 'center', fontSize: 11, fontWeight: cnt > 0 ? 700 : 400, color: cnt > 0 ? SP.hdrClr : '#ccc' }}>
                        {cnt > 0 ? cnt : '·'}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr style={{ borderTop: `1.5px solid ${SP.border}` }}>
                <td style={{ padding: '3px 8px', fontSize: 10, fontWeight: 800, color: SP.totClr, background: SP.totBg }}>Total</td>
                {tA.map((pi, i) => {
                  const tot      = pivotRoundTot(pi);
                  const isLeader = tot > 0 && tot === maxTot;
                  return (
                    <td key={pi} style={{ textAlign: 'center', fontSize: 13, fontWeight: 800, color: SP.totClr,
                                           background: isLeader ? '#c9a8f0' : SP.totBg,
                                           borderRight: i === tA.length - 1 ? `2px solid #b08de0` : 'none',
                                           padding: '3px 2px' }}>
                      {tot > 0 ? tot : '·'}
                    </td>
                  );
                })}
                {tB.map(pi => {
                  const tot      = pivotRoundTot(pi);
                  const isLeader = tot > 0 && tot === maxTot;
                  return (
                    <td key={pi} style={{ textAlign: 'center', fontSize: 13, fontWeight: 800, color: SP.totClr,
                                           background: isLeader ? '#c9a8f0' : SP.totBg, padding: '3px 2px' }}>
                      {tot > 0 ? tot : '·'}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ── Dispatchers ───────────────────────────────────────────────────────────
  const renderTopSection = () => {
    if (isSixes) {
      return (
        <>
          {renderSegGrid(0)}
          <TableDivider/>
          {renderSegGrid(1)}
          <TableDivider/>
          {renderSegGrid(2)}
        </>
      );
    }
    if (isMatch) {
      const pairing = getMatchPairing();
      // Derived front/back labels for HalfLabel headers
      const frontLabel = allInFront(frontH) && allInBack(backH) ? 'Front 9' : `Holes ${frontH[0]+1}–${frontH[frontH.length-1]+1}`;
      const backLabel  = allInFront(frontH) && allInBack(backH) ? 'Back 9'  : `Holes ${backH[0]+1}–${backH[backH.length-1]+1}`;
      return (
        <>
          {pairing && (
            <div style={{ padding: '4px 10px 2px', fontSize: 11, fontWeight: 600, color: SP.hdrClr }}>
              Team Match · {pairing}
            </div>
          )}
          {isLandscape
            ? renderAll()
            : (
              <>
                {renderGrid(frontH, frontLabel, 'Total')}
                <TableDivider/>
                {renderGrid(backH, backLabel, 'Total')}
              </>
            )
          }
        </>
      );
    }
    // Individual mode (§10.6)
    const frontLabel = allInFront(frontH) && allInBack(backH) ? 'Front 9' : `Holes ${frontH[0]+1}–${frontH[frontH.length-1]+1}`;
    const backLabel  = allInFront(frontH) && allInBack(backH) ? 'Back 9'  : `Holes ${backH[0]+1}–${backH[backH.length-1]+1}`;
    return isLandscape
      ? renderAll()
      : (
        <>
          {renderGrid(frontH, frontLabel, 'Total')}
          <TableDivider/>
          {renderGrid(backH, backLabel, 'Total')}
        </>
      );
  };

  const renderPivot = () => {
    if (isSixes) return renderPivotSixes();
    if (isMatch) return renderPivotMatch();
    return renderPivotIndividual();
  };

  return (
    <GameSection title="Dots" color={SP.hdrClr} borderColor={SP.border}
      onClick={() => setTooltip(null)}
    >
      {renderTopSection()}
      <TableDivider/>
      <div style={{ padding: '8px 0 10px' }}>
        {renderPivot()}
      </div>
    </GameSection>
  );
}
