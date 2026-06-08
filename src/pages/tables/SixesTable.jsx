// ✅ Self-checked (13-G.2): scoreForMode in best-ball value derivation now reads
// per-player siArray (Handicap_Contract §5). Fallback to round-shared hcps for
// legacy reloads.
//
// ✅ Self-checked: verified §3.7 dynamic segLen derivation, segment labels
// 'Holes a–b' (1-based), seg.key unchanged as 'Sixes:seg0/1/2', default
// [0,17] produces byte-identical 6/6/6 layout, single-half landscape,
// chip footer labels match table labels (D-4B), no parseInt('X'), press
// key derivation uses derived segs[si] not hardcoded SEGS.

// ─── tables/SixesTable.jsx ────────────────────────────────────────────────────
// RENDER ONLY — no business logic in this file.
// No scoring calculations. No match state computation.
// All logic must come from engine/ or scorecardUtils.js
//
// Display spec: Sixes_Contract.md §3.7 (partial-range, v1.10)
// Range spec:   PartialGameContract.md §3.5 / §3.7 (dynamic segLen rule)
//               segLen = floor(totalHoles / 3); segments[2] ends at endHole.

import { useState } from 'react';
import { scoreForMode } from '../../engine/handicap.js';
import { getSixesTeam, runSixesSegment } from '../../engine/games.js';
import {
  M, SX, COL_W, TOT_W, NAME_MIN,
  scoringLabel, fmtLead, buildLeadState, lastScoredInHoles,
  applyDepartureGuardrailToScores,
} from '../scorecard/scorecardUtils.js';
import { GameSection, TableDivider } from '../scorecard/GameSection.jsx';
import { PressModal, SegmentChipColumns } from '../scorecard/PressModal.jsx';

// ── Sixes-specific color tokens (blue/red, colorblind-safe) ──────────────────
const SXA_BG  = '#dbeeff';
const SXA_CLR = '#0c447c';
const SXB_BG  = '#fffbe8';
const SXB_CLR = '#c0392b';
const SXA_LED = '#185fa5';
const SXB_LED = '#c0392b';

// ── Player-anchored color resolution ─────────────────────────────────────────
// Players at index 0 and 1 are always "blue side"; 2 and 3 are always "red side."
// winnerPi is the global player index of the hole winner.
const isBluePlayer = (winnerPi) => winnerPi <= 1;

// ── Name resolution (§7.5) ────────────────────────────────────────────────────
function resolveSegmentNames(foursome) {
  const firstNames = foursome.map(p => (p?.name || '?').trim().split(/\s+/)[0]);
  const lastInits  = foursome.map(p => {
    const parts = (p?.name || '').trim().split(/\s+/);
    return parts.length >= 2 ? parts[parts.length - 1][0].toUpperCase() : '';
  });
  return firstNames.map((fn, i) => {
    const collision = firstNames.some((other, j) => j !== i && other === fn);
    if (!collision) return fn;
    return lastInits[i] ? `${fn} ${lastInits[i]}` : fn;
  });
}

function initialsFromResolved(nameA, nameB) {
  return `${nameA[0]}/${nameB[0]}`;
}

// Strip "thru N" suffix from fmtLead text (§7.4.2)
function stripThru(text) {
  if (!text) return text;
  const idx = text.indexOf(' thru');
  return idx !== -1 ? text.slice(0, idx) : text;
}

// ── §3.7 Dynamic segment derivation ──────────────────────────────────────────
// Derives three equal-length segment hole arrays from an effective range.
// segLen = floor(totalHoles / 3). Segment 2 ends at endHole (absorbs remainder).
// Default [0, 17]: segLen=6, yields canonical 6/6/6 layout — byte-identical.
// Each seg: { holes: number[], label: string, key: string }
function deriveSegs(startHole, endHole) {
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

  const holesLabel = holes => `Holes ${holes[0]+1}–${holes[holes.length-1]+1}`;

  return [
    { holes: seg0holes, label: holesLabel(seg0holes), key: 'Sixes:seg0' },
    { holes: seg1holes, label: holesLabel(seg1holes), key: 'Sixes:seg1' },
    { holes: seg2holes, label: holesLabel(seg2holes), key: 'Sixes:seg2' },
  ];
}

// ── Canonical half detection — for single-half landscape ──────────────────────
const allInFront = holes => holes.length > 0 && holes.every(h => h <= 8);
const allInBack  = holes => holes.length > 0 && holes.every(h => h >= 9);

// ─────────────────────────────────────────────────────────────────────────────

export function SixesTable({
  players, scores, hcps, opts,
  sixesTeams, courseHcps, minCourseHcp,
  manualPresses, setManualPresses,
  // Phase 2B range props — resolved at call site (ScoreGrid / RoundSummaryModal)
  // via gameRanges['Sixes'] ?? round bounds. Defaults give canonical 6/6/6.
  startHole = 0,
  endHole   = 17,
  // 13-C.7.6: Engine departure data guardrail (PartialGameContract §14
  // invariant 21). Filters scores past departureHole before aggregation.
  earlyDepartureOpts = {},
}) {
  if (!sixesTeams?.[0] || !sixesTeams?.[1]) return null;

  // 13-C.7.6: Apply guardrail before any score aggregation.
  scores = applyDepartureGuardrailToScores(scores, earlyDepartureOpts, players.length);

  const [pressModal, setPressModal] = useState(null);

  const sixesOpts = opts || {};
  const mode      = sixesOpts.grossNetNOL ?? sixesOpts.scoring  ?? 'net';
  const tiebreak  = sixesOpts.scoring ?? sixesOpts.tiebreak ?? 'none';
  const autoN     = (sixesOpts.autoPress && sixesOpts.autoPress !== 'none') ? parseInt(sixesOpts.autoPress) : 0;

  // ── Derive segments from effective range (§3.7) ───────────────────────────
  const segs = deriveSegs(startHole, endHole);

  // Single-half landscape: all three segments fall entirely within one canonical half
  const allSegsInFront = segs.every(s => allInFront(s.holes));
  const allSegsInBack  = segs.every(s => allInBack(s.holes));
  const rangeSingleHalf = allSegsInFront || allSegsInBack;

  // Resolve team assignments for all 3 segments
  const segTeams = segs.map((_, si) => getSixesTeam(si, sixesTeams, players));

  // ── Best-ball hole winner for a given segment ─────────────────────────────
  const holeWinFn = (h, teamA, teamB) => {
    const allScored = [...teamA, ...teamB].every(pi => {
      const v = scores[h]?.[pi];
      return v !== '' && v != null;
    });
    if (!allScored) return null;
    // 'X' treated as Infinity — always loses best-ball comparison
    const val = pi => {
      const raw = scores[h][pi];
      if (raw === 'X') return Infinity;
      return scoreForMode(parseInt(raw), courseHcps[pi], (players[pi]?.siArray || hcps)[h], minCourseHcp, mode);
    };
    const valsA = teamA.map(val);
    const valsB = teamB.map(val);
    const bestA = Math.min(...valsA);
    const bestB = Math.min(...valsB);
    if (bestA < bestB) return 'a';
    if (bestB < bestA) return 'b';
    if (tiebreak === 'second' && teamA.length >= 2 && teamB.length >= 2) {
      const s2A = Math.max(...valsA);
      const s2B = Math.max(...valsB);
      if (s2A < s2B) return 'a';
      if (s2B < s2A) return 'b';
    } else if (tiebreak === 'cumulative' && teamA.length >= 2 && teamB.length >= 2) {
      const sumA = valsA.reduce((s, v) => s + v, 0);
      const sumB = valsB.reduce((s, v) => s + v, 0);
      if (sumA < sumB) return 'a';
      if (sumB < sumA) return 'b';
    }
    return tiebreak === 'half' ? 'half' : 0;
  };

  // ── Segment-scoped holeWinFn ──────────────────────────────────────────────
  const makeSegHoleWinFn = (si) => {
    const team = segTeams[si];
    if (!team) return () => null;
    const { a, b } = team;
    const teamA = [a, b];
    const teamB = players.map((_, i) => i).filter(i => i !== a && i !== b);
    if (teamB.length < 2) return () => null;
    return (h) => holeWinFn(h, teamA, teamB);
  };

  // ── Press chip builder ────────────────────────────────────────────────────
  const makeSegChip = (bet, segHoles, segLabel, depth, totalDepths, mpKey, mpArr, winFn, nmA, nmB, anchorAIsBlue) => {
    const betHoles  = segHoles.filter(h => h >= (bet.startHole ?? segHoles[0]));
    const leadState = buildLeadState(winFn, betHoles);
    const lastH     = [...betHoles].reverse().find(h => leadState[h] !== undefined);
    const rawInfo   = lastH != null
      ? fmtLead(leadState[lastH].lead, leadState[lastH].matchOver, leadState[lastH].holesLeft)
      : null;
    const info = rawInfo ? { ...rawInfo, text: stripThru(rawInfo.text) } : null;

    const isTeamALeading = info && leadState[lastH]?.lead > 0;
    const isTeamBLeading = info && leadState[lastH]?.lead < 0;
    const winnerName = isTeamALeading ? nmA : isTeamBLeading ? nmB : 'All Square';

    const aIsBlue = anchorAIsBlue;
    const chipBg = info
      ? (isTeamALeading
          ? (aIsBlue ? SXA_BG : SXB_BG)
          : isTeamBLeading
            ? (aIsBlue ? SXB_BG : SXA_BG)
            : '#f5fbf5')
      : M.hdrBg;

    const existingPressHole = mpArr[depth] ?? null;
    const minHole           = bet.startHole ?? segHoles[0];
    const label             = depth === 0 ? segLabel : bet.label;
    const hasChildPress     = existingPressHole !== null;
    const isLastInChain     = depth === totalDepths - 1;
    const lastScored        = lastScoredInHoles(winFn, betHoles);
    const canAddPress       = isLastInChain && lastScored !== null && lastScored < betHoles[betHoles.length - 1];
    const pressable         = hasChildPress || canAddPress;
    const chipColor = isTeamALeading
      ? (aIsBlue ? SXA_LED : SXB_LED)
      : isTeamBLeading
        ? (aIsBlue ? SXB_LED : SXA_LED)
        : '#aaa';

    return {
      label, winnerName,
      value: info ? info.text : '—',
      color: chipColor,
      bg: chipBg, labelColor: M.hdrClr,
      pressable, hasChildPress, isPress: depth > 0,
      onLongPress: () => setPressModal({
        mpKey, betHoles, depth, minHole, existingPressHole,
        label:  `${nmA} vs ${nmB} · ${label}`,
        status: info ? info.text : '—',
        winnerName,
      }),
    };
  };

  // ── Build chips for one segment using engine output ───────────────────────
  const buildSegmentChips = (si, winFn, nmA, nmB) => {
    const seg    = segs[si];
    const mpKey  = seg.key;
    const mpArr  = (manualPresses || {})[mpKey] || [];
    const team   = segTeams[si];
    const anchorAIsBlue = team ? isBluePlayer(team.a) : true;
    if (!team) {
      return {
        mainChip: makeSegChip(
          { startHole: seg.holes[0], label: seg.label },
          seg.holes, seg.label, 0, 1, mpKey, mpArr, winFn, nmA, nmB, anchorAIsBlue
        ),
        pressChips: [],
      };
    }

    const engineBets = runSixesSegment(
      seg.holes, scores, players,
      team, mode, tiebreak,
      courseHcps, minCourseHcp,
      autoN, mpArr
    );

    if (!engineBets) {
      return {
        mainChip: makeSegChip(
          { startHole: seg.holes[0], label: seg.label },
          seg.holes, seg.label, 0, 1, mpKey, mpArr, winFn, nmA, nmB, anchorAIsBlue
        ),
        pressChips: [],
      };
    }

    const total = engineBets.length || 1;
    const [main, ...presses] = engineBets;
    return {
      mainChip:   makeSegChip(main,   seg.holes, seg.label, 0,      total, mpKey, mpArr, winFn, nmA, nmB, anchorAIsBlue),
      pressChips: presses.map((pb, pi) =>
        makeSegChip(pb, seg.holes, seg.label, pi + 1, total, mpKey, mpArr, winFn, nmA, nmB, anchorAIsBlue)
      ),
    };
  };

  // ── Render one segment block ──────────────────────────────────────────────
  const renderSegment = (si) => {
    const seg  = segs[si];
    const team = segTeams[si];
    if (!team) return null;

    const { a, b } = team;
    const teamBIdx = players.map((_, i) => i).filter(i => i !== a && i !== b);
    if (teamBIdx.length < 2) return null;
    const [c, d] = teamBIdx;

    const foursome    = [players[a], players[b], players[c], players[d]];
    const resolved    = resolveSegmentNames(foursome);
    const nmA = `${resolved[0]}/${resolved[1]}`;
    const nmB = `${resolved[2]}/${resolved[3]}`;
    const initA = initialsFromResolved(resolved[0], resolved[1]);
    const initB = initialsFromResolved(resolved[2], resolved[3]);

    const winFn = makeSegHoleWinFn(si);

    // Base segment lead state
    const leadState = buildLeadState(winFn, seg.holes);
    const lastH     = [...seg.holes].reverse().find(h => leadState[h] !== undefined);
    const rawInfo   = lastH != null
      ? fmtLead(leadState[lastH].lead, leadState[lastH].matchOver, leadState[lastH].holesLeft)
      : null;
    const statusInfo  = rawInfo ? { ...rawInfo, text: stripThru(rawInfo.text) } : null;
    const segLead     = lastH != null ? leadState[lastH].lead : 0;
    const aIsBlueRow  = isBluePlayer(a);
    const leaderIsBlue = segLead > 0 ? aIsBlueRow : !aIsBlueRow;
    const statusBg    = statusInfo
      ? (segLead !== 0 ? (leaderIsBlue ? SXA_BG : SXB_BG) : '#f5fbf5')
      : '#f5fbf5';
    const statusColor = statusInfo
      ? (segLead !== 0 ? (leaderIsBlue ? SXA_CLR : SXB_CLR) : SX.hdrClr)
      : SX.hdrClr;

    // Engine output for press rows
    const mpArr      = (manualPresses || {})[seg.key] || [];
    const engineBets = runSixesSegment(
      seg.holes, scores, players,
      team, mode, tiebreak,
      courseHcps, minCourseHcp,
      autoN, mpArr
    );
    const pressRows = engineBets ? engineBets.slice(1) : [];

    return (
      <div key={si}>
        {si > 0 && <TableDivider/>}

        {/* Segment header: "Holes a–b · TeamA vs TeamB" */}
        <div style={{ padding: '5px 10px 2px', fontSize: 10, color: '#888' }}>
          <span style={{ fontWeight: 600 }}>{seg.label}</span>
          <span style={{ margin: '0 4px' }}>·</span>
          <span style={{ color: isBluePlayer(a) ? SXA_LED : SXB_LED, fontWeight: 500 }}>{nmA}</span>
          <span style={{ color: '#aaa', margin: '0 4px' }}>vs</span>
          <span style={{ color: isBluePlayer(c) ? SXA_LED : SXB_LED, fontWeight: 500 }}>{nmB}</span>
        </div>

        {/* Hole table */}
        <div style={{ padding: '0 8px 4px', overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%', minWidth: NAME_MIN + seg.holes.length * COL_W + TOT_W }}>
            <colgroup>
              <col/>
              {seg.holes.map(h => <col key={h} style={{ width: COL_W }}/>)}
              <col style={{ width: TOT_W }}/>
            </colgroup>
            <thead>
              <tr>
                <th style={{ padding: '2px 6px', background: M.hdrBg, color: M.hdrClr, fontSize: 10, textAlign: 'left' }}></th>
                {seg.holes.map(h => (
                  <th key={h} style={{ padding: '2px 1px', background: M.hdrBg, color: M.hdrClr, fontSize: 10, textAlign: 'center' }}>{h + 1}</th>
                ))}
                <th style={{ padding: '2px 4px', background: M.totBg, color: M.totClr, fontSize: 10, textAlign: 'center', fontWeight: 700 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {/* Base segment row */}
              <tr style={{ background: '#f5fbf5' }}>
                <td style={{ padding: '2px 6px', fontSize: 10, color: '#888', fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}></td>
                {seg.holes.map(h => {
                  const w = winFn(h);
                  if (w === null) return (
                    <td key={h} style={{ textAlign: 'center', color: '#ddd', fontSize: 11 }}>·</td>
                  );
                  if (w === 0 || w === 'half') return (
                    <td key={h} style={{ textAlign: 'center', color: '#bbb', fontSize: 12 }}>–</td>
                  );
                  const isA = w === 'a';
                  const winnerPi = isA ? a : c;
                  const isBlue = isBluePlayer(winnerPi);
                  return (
                    <td key={h} style={{ textAlign: 'center', padding: '1px' }}>
                      <span style={{
                        display: 'inline-block', width: 22, height: 18, lineHeight: '18px',
                        fontSize: 10, fontWeight: 500, borderRadius: 3,
                        background: isBlue ? SXA_BG : SXB_BG,
                        color:      isBlue ? SXA_CLR : SXB_CLR,
                        textAlign: 'center',
                      }}>
                        {isA ? initA : initB}
                      </span>
                    </td>
                  );
                })}
                <td style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, background: statusBg, color: statusColor, padding: '2px 4px' }}>
                  {statusInfo ? statusInfo.text : '—'}
                </td>
              </tr>

              {/* Press rows */}
              {pressRows.map((pr, pi) => {
                const prHoles     = seg.holes.filter(h => h >= pr.startHole);
                const prLeadState = buildLeadState(winFn, prHoles);
                const prLastH     = [...prHoles].reverse().find(h => prLeadState[h] !== undefined);
                const prRawInfo   = prLastH != null
                  ? fmtLead(prLeadState[prLastH].lead, prLeadState[prLastH].matchOver, prLeadState[prLastH].holesLeft)
                  : null;
                const prStatusInfo  = prRawInfo ? { ...prRawInfo, text: stripThru(prRawInfo.text) } : null;
                const prLead        = prLastH != null ? prLeadState[prLastH].lead : 0;
                const prLeaderIsBlue = prLead > 0 ? aIsBlueRow : !aIsBlueRow;
                const prStatusBg    = prStatusInfo
                  ? (prLead !== 0 ? (prLeaderIsBlue ? SXA_BG : SXB_BG) : '#f5fbf5')
                  : '#f5fbf5';
                const prStatusColor = prStatusInfo
                  ? (prLead !== 0 ? (prLeaderIsBlue ? SXA_CLR : SXB_CLR) : SX.hdrClr)
                  : SX.hdrClr;
                return (
                  <tr key={`press_${pi}`} style={{ background: '#f5fbf5' }}>
                    <td style={{ padding: '2px 6px', fontSize: 10, color: '#888', fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pr.label}
                    </td>
                    {seg.holes.map(h => {
                      if (h < pr.startHole) return (
                        <td key={h} style={{ textAlign: 'center', color: '#e8e8e8', fontSize: 11 }}>·</td>
                      );
                      const w = winFn(h);
                      if (w === null) return (
                        <td key={h} style={{ textAlign: 'center', color: '#ddd', fontSize: 11 }}>·</td>
                      );
                      if (w === 0 || w === 'half') return (
                        <td key={h} style={{ textAlign: 'center', color: '#bbb', fontSize: 12 }}>–</td>
                      );
                      const isA = w === 'a';
                      const winnerPi = isA ? a : c;
                      const isBlue = isBluePlayer(winnerPi);
                      return (
                        <td key={h} style={{ textAlign: 'center', padding: '1px' }}>
                          <span style={{
                            display: 'inline-block', width: 22, height: 18, lineHeight: '18px',
                            fontSize: 10, fontWeight: 500, borderRadius: 3,
                            background: isBlue ? SXA_BG : SXB_BG,
                            color:      isBlue ? SXA_CLR   : SXB_CLR,
                            textAlign: 'center',
                          }}>
                            {isA ? initA : initB}
                          </span>
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, background: prStatusBg, color: prStatusColor, padding: '2px 4px' }}>
                      {prStatusInfo ? prStatusInfo.text : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ── Build chip bar segments ───────────────────────────────────────────────
  const chipSegments = segs.map((seg, si) => {
    const team = segTeams[si];
    if (!team) {
      return {
        mainChip: {
          label: seg.label, winnerName: '—', value: '—',
          color: '#aaa', bg: M.hdrBg, labelColor: M.hdrClr,
          pressable: false, hasChildPress: false, isPress: false,
          onLongPress: () => {},
        },
        pressChips: [],
      };
    }
    const { a, b } = team;
    const teamBIdx  = players.map((_, i) => i).filter(i => i !== a && i !== b);
    const [c, d]    = teamBIdx;
    const foursome  = [players[a], players[b], players[c], players[d]];
    const resolved  = resolveSegmentNames(foursome);
    const nmA = `${resolved[0]}/${resolved[1]}`;
    const nmB = `${resolved[2]}/${resolved[3]}`;
    const winFn = makeSegHoleWinFn(si);
    return buildSegmentChips(si, winFn, nmA, nmB);
  });

  return (
    <GameSection title="Sixes" badge={scoringLabel(mode)} color={M.hdrClr} borderColor={M.border}>

      {pressModal && (() => {
        const { mpKey, betHoles, depth, minHole, existingPressHole, label, status, winnerName } = pressModal;
        return (
          <PressModal
            title={label}
            status={status}
            winnerName={winnerName}
            validHoles={betHoles}
            existingPressHole={existingPressHole}
            minHole={minHole}
            onConfirm={h => {
              setManualPresses(prev => {
                const trimmed = (prev[mpKey] || []).slice(0, depth);
                if (trimmed.includes(h)) return prev;
                return { ...prev, [mpKey]: [...trimmed, h].sort((a, b) => a - b) };
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

      {/* Three segment blocks */}
      {segs.map((_, si) => renderSegment(si))}

      {/* Chip bar */}
      <TableDivider/>
      <SegmentChipColumns segments={chipSegments}/>

    </GameSection>
  );
}
