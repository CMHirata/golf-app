// ✅ Self-checked (13-G.2): All 9 engine functions now read players[pi].siArray[h]
// instead of the round-shared hcps[h]. hcps parameter dropped from runMatch,
// runTeamMatch, runMatchNassau, runNassau, calcSkinsHole, calcSkins, calcNines,
// calcSixesSegment, runSixesSegment, calcStablefordTotal, calcTeamStablefordTotal,
// calcStrokePlay. Stableford helpers gain siArray param (calcStablefordTotal)
// — calcTeamStablefordTotal reads from players[pi].siArray. Game list, dot defs,
// helper functions, and getSixesTeam unchanged. Per Handicap_Contract §5 / inv 21.
//
// ─── games.js ─────────────────────────────────────────────────────────────────
// All per-game scoring logic. Pure functions — no React, no side effects.
// All functions accept courseHcps (array of signed integers) and minCourseHcp
// instead of computing from raw ghin strings.
//
// 13-G.2 / Handicap_Contract §5 / inv 21: Engines read each player's per-player
// siArray (attached at round-start by buildPlayerSI). The shared hcps[] field
// on activeRound is retained for SI display rows only — engines never read it.

import { scoreForMode, stabPts, hdcpStrokesFromCourseHcp } from './handicap.js';

// ─── Game list ────────────────────────────────────────────────────────────────
// Single source of truth for available games. Import from here everywhere.
// 'Match Play' and 'Nassau' replaced by unified 'Match / Nassau'.
export const ALL_GAMES = ['Stroke Play', 'Skins', 'Match / Nassau', 'Stableford', 'Nines', 'Sixes', 'Dots'];

// ─── Skins ───────────────────────────────────────────────────────────────────
// skinPlayerIdxs: array of player indices participating (empty = all players)
export function calcSkinsHole(h, scores, players, mode, courseHcps, minCourseHcp, skinPlayerIdxs) {
  const idxs = skinPlayerIdxs?.length ? skinPlayerIdxs : players.map((_, i) => i);
  const raws = idxs.map(pi => scores[h]?.[pi]);
  // Stop if any player unscored (empty/null). 'X' counts as scored.
  if (raws.some(v => v === '' || v == null)) return null;

  // "X always loses" — X cannot win a skin against any real score.
  // If all X → tied (skin carries or lost per carryover setting).
  const allX = raws.every(v => v === 'X');
  if (allX) return { tied: true, wiIdx: null };

  // If any real scores exist, X players cannot win — assign them a value
  // worse than any real score by filtering them out of contention.
  const vals = raws.map((raw, ii) => {
    if (raw === 'X') return null; // X loses — excluded from min calculation
    const g = parseInt(raw);
    const pi = idxs[ii];
    const rank = players[pi].siArray[h];
    return scoreForMode(g, courseHcps[pi], rank, minCourseHcp, mode);
  });

  const realVals = vals.filter(v => v !== null);
  const min = Math.min(...realVals);
  const winners = vals.reduce((a, v, ii) => v === min ? [...a, idxs[ii]] : a, []);
  return { tied: winners.length > 1, wiIdx: winners.length === 1 ? winners[0] : null };
}

export function calcSkins(scores, players, mode, carryover, courseHcps, minCourseHcp, skinPlayerIdxs) {
  const idxs = skinPlayerIdxs?.length ? skinPlayerIdxs : players.map((_, i) => i);
  const rows = [];
  let carry   = 0;
  for (let h = 0; h < 18; h++) {
    const result = calcSkinsHole(h, scores, players, mode, courseHcps, minCourseHcp, idxs);
    if (!result) break;
    if (result.tied) { carry++; rows.push({ h, tied: true, carry }); }
    else             { rows.push({ h, wiIdx: result.wiIdx, value: carryover ? 1 + carry : 1 }); carry = 0; }
  }
  const totals = {};
  players.forEach(p => (totals[p.name] = 0));
  rows.filter(r => r.wiIdx != null).forEach(r => (totals[players[r.wiIdx].name] += r.value));
  return { rows, totals };
}

// ─── Nines ───────────────────────────────────────────────────────────────────
export function ninesPts(vals, blitz = false) {
  if (!vals?.length) return [];
  const n = vals.length;
  const s = vals.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const p = new Array(n).fill(0);

  if (blitz && n >= 2 && s[0].v <= s[1].v - 2) { p[s[0].i] = 9; return p; }

  if (n === 2) {
    if (s[0].v < s[1].v) { p[s[0].i] = 9; } else { p[s[0].i] = 5; p[s[1].i] = 4; }
  } else if (n === 3) {
    if      (s[0].v < s[1].v && s[1].v < s[2].v) { p[s[0].i]=5; p[s[1].i]=3; p[s[2].i]=1; }
    else if (s[0].v < s[1].v)                      { p[s[0].i]=5; p[s[1].i]=2; p[s[2].i]=2; }
    else if (s[1].v < s[2].v)                      { p[s[0].i]=4; p[s[1].i]=4; p[s[2].i]=1; }
    else                                            { p[s[0].i]=3; p[s[1].i]=3; p[s[2].i]=3; }
  } else {
    const base = [5, 3, 1, 0, ...new Array(Math.max(0, n - 4)).fill(0)];
    let i = 0;
    while (i < n) {
      let j = i;
      while (j < n && s[j].v === s[i].v) j++;
      const total = base.slice(i, j).reduce((a, b) => a + b, 0);
      const each  = Math.floor(total / (j - i));
      for (let k = i; k < j; k++) p[s[k].i] = each;
      i = j;
    }
  }
  return p;
}

export function calcNines(scores, players, playerIdxs, mode, blitz, holes, courseHcps, minCourseHcp) {
  const totals     = new Array(playerIdxs.length).fill(0);
  const holePoints = [];
  for (const h of holes) {
    const raws = playerIdxs.map(pi => scores[h]?.[pi]);
    // Stop if any player unscored (empty/null). 'X' counts as scored.
    if (raws.some(v => v === '' || v == null)) { holePoints.push(null); break; }

    const xFlags = raws.map(r => r === 'X');
    const allX   = xFlags.every(Boolean);

    if (allX) {
      // All three X — equal split: 3 pts each (three-way tie per "X ties X" rule)
      const pts = new Array(playerIdxs.length).fill(3);
      pts.forEach((p, i) => (totals[i] += p));
      holePoints.push(pts);
      continue;
    }

    // Compute numeric values for real-score players
    const numericVals = raws.map((raw, i) => {
      const pi = playerIdxs[i];
      if (xFlags[i]) return null; // will be replaced with worst value below
      const g = parseInt(raw);
      const rank = players[pi].siArray[h];
      return mode === 'gross' ? g : scoreForMode(g, courseHcps[pi], rank, minCourseHcp, mode);
    });

    // X players come in tied-last. Give them all the same value: max real score + 1.
    // This guarantees they sort after every real score and tie among themselves.
    const maxReal   = Math.max(...numericVals.filter(v => v !== null));
    const normVals  = numericVals.map(v => v === null ? maxReal + 1 : v);

    const pts = ninesPts(normVals, blitz);
    pts.forEach((p, i) => (totals[i] += p));
    holePoints.push(pts);
  }
  return { totals, holePoints };
}

// ─── Match Play (individual) ──────────────────────────────────────────────────
// manualPressHoles: sorted array of hole indices (within `holes`) after which a
// manual press was triggered.
//
// Press hierarchy (§Issue #2 / Contract §6.3):
//   - The BASE match can be pressed (creates Press 1).
//   - Press 1 can itself be pressed (creates Press 2, a "child press").
//   - Each match level is pressed independently — once per level.
//   - manualPressHoles encodes ALL press points. The engine assigns them in order:
//     first manual hole creates Press 1, second creates Press 2 (child of Press 1), etc.
//   - Auto-press: fires on the current active (last) match when it goes N-down.
//     After auto-press fires for a match level, that level is marked `pressed`
//     and cannot auto-press again. The newly created child press can itself auto-press.
//
// No duplicate presses at same start hole (§5.1 / §10): enforced via pressAfterIdx set.
export function runMatch(holes, scores, players, p1, p2, mode, autoN, label, courseHcps, minCourseHcp, manualPressHoles = []) {
  if (!players[p1] || !players[p2]) return [{ label, p1w:0, p2w:0, thru:0, status:'—', lead:0 }];

  const hv = holes.map(h => {
    const r1 = scores[h]?.[p1];
    const r2 = scores[h]?.[p2];
    // Empty = unscored — stop
    if (r1 === '' || r1 == null || r2 === '' || r2 == null) return null;
    // X always loses to a real score; X ties X
    const p1IsX = r1 === 'X';
    const p2IsX = r2 === 'X';
    const g1 = p1IsX ? null : parseInt(r1);
    const g2 = p2IsX ? null : parseInt(r2);
    const r1rank = players[p1].siArray[h];
    const r2rank = players[p2].siArray[h];
    const v1 = p1IsX ? Infinity : scoreForMode(g1, courseHcps[p1], r1rank, minCourseHcp, mode);
    const v2 = p2IsX ? Infinity : scoreForMode(g2, courseHcps[p2], r2rank, minCourseHcp, mode);
    return { v1, v2 };
  });

  const pressAfterIdx = new Set();
  const matches = [{ label, p1w:0, p2w:0, si:0, pressed:false }];
  let pressCount = 0;

  for (let i = 0; i < hv.length; i++) {
    if (!hv[i]) break;
    for (const m of matches) {
      if (hv[i].v1 < hv[i].v2) m.p1w++;
      else if (hv[i].v2 < hv[i].v1) m.p2w++;
    }

    // Auto-press: check the LAST (active) match — if it's down by autoN and hasn't
    // been pressed yet, trigger. This allows child presses to also auto-press.
    const lm = matches[matches.length - 1];
    const autoTrigger = autoN > 0 && !lm.pressed && Math.abs(lm.p1w - lm.p2w) >= autoN;
    const manualTrigger = manualPressHoles.includes(holes[i]);

    if ((autoTrigger || manualTrigger) && i + 1 < hv.length && !pressAfterIdx.has(i)) {
      pressAfterIdx.add(i);
      lm.pressed = true;
      pressCount++;
      matches.push({ label: `Press ${pressCount}`, p1w:0, p2w:0, si:i+1, pressed:false });
    }
  }

  return matches.map(m => {
    const thru  = hv.slice(m.si).filter(Boolean).length;
    const lead  = m.p1w - m.p2w;
    const nm1   = players[p1].name, nm2 = players[p2].name;
    const status = thru === 0 ? '—' : lead === 0 ? 'AS' : lead > 0 ? `${nm1} ${Math.abs(lead)}UP` : `${nm2} ${Math.abs(lead)}UP`;
    return { label: m.label, p1w: m.p1w, p2w: m.p2w, thru, status, lead, startHole: holes[m.si] };
  });
}

// ─── Team Match Play (2v2 best ball) ─────────────────────────────────────────
// teamA/teamB: arrays of player indices [i, j]
// scoring: 'none' | 'second' | 'cumulative' | 'half' — team hole-scoring rule
// Press hierarchy: same rules as runMatch — each match level can be pressed once.
export function runTeamMatch(holes, scores, players, teamA, teamB, mode, autoN, label, courseHcps, minCourseHcp, scoring = 'none', manualPressHoles = []) {
  const hv = holes.map(h => {
    const rawA = teamA.map(pi => scores[h]?.[pi]);
    const rawB = teamB.map(pi => scores[h]?.[pi]);
    // Stop if any player unscored (empty/null — not X, which IS scored)
    if (rawA.some(v => v === '' || v == null) || rawB.some(v => v === '' || v == null)) return null;
    // Compute scored values — X treated as Infinity (always loses)
    const valsA = rawA.map((raw, ii) => {
      if (raw === 'X') return Infinity;
      const g = parseInt(raw);
      const pi = teamA[ii];
      const rank = players[pi].siArray[h];
      return scoreForMode(g, courseHcps[pi], rank, minCourseHcp, mode);
    });
    const valsB = rawB.map((raw, ii) => {
      if (raw === 'X') return Infinity;
      const g = parseInt(raw);
      const pi = teamB[ii];
      const rank = players[pi].siArray[h];
      return scoreForMode(g, courseHcps[pi], rank, minCourseHcp, mode);
    });
    const bestA = Math.min(...valsA);
    const bestB = Math.min(...valsB);
    let winner = null;
    if (bestA < bestB) winner = 'a';
    else if (bestB < bestA) winner = 'b';
    else if (scoring === 'second' && teamA.length >= 2 && teamB.length >= 2) {
      const sec2A = Math.max(...valsA), sec2B = Math.max(...valsB);
      if (sec2A < sec2B) winner = 'a';
      else if (sec2B < sec2A) winner = 'b';
    } else if (scoring === 'cumulative' && teamA.length >= 2 && teamB.length >= 2) {
      // Hole-scoring rule: compare sum of each team's two net scores.
      // Tied sums → hole halved (winner stays null).
      const sumA = valsA.reduce((s, v) => s + v, 0);
      const sumB = valsB.reduce((s, v) => s + v, 0);
      if (sumA < sumB) winner = 'a';
      else if (sumB < sumA) winner = 'b';
    } else if (scoring === 'half') {
      // LEGACY: retained for back-compat with rounds saved before v2.6.
      // Not offered in UI as of 11-I.2. Migrates to 'none' (Best Ball) via shim.
      winner = 'half';
    }
    return { winner, valsA, valsB };
  });

  const pressAfterIdx = new Set();
  const matches = [{ label, aw:0, bw:0, halves:0, si:0, pressed:false }];
  let pressCount = 0;

  for (let i = 0; i < hv.length; i++) {
    if (!hv[i]) break;
    for (const m of matches) {
      if (hv[i].winner === 'a') m.aw++;
      else if (hv[i].winner === 'b') m.bw++;
      else if (hv[i].winner === 'half') m.halves++;
    }

    // Auto-press: check LAST (active) match independently — child presses can also auto-press.
    const lm = matches[matches.length - 1];
    const autoTrigger = autoN > 0 && !lm.pressed && Math.abs(lm.aw - lm.bw) >= autoN;
    const manualTrigger = manualPressHoles.includes(holes[i]);

    if ((autoTrigger || manualTrigger) && i + 1 < hv.length && !pressAfterIdx.has(i)) {
      pressAfterIdx.add(i);
      lm.pressed = true;
      pressCount++;
      matches.push({ label: `Press ${pressCount}`, aw:0, bw:0, halves:0, si:i+1, pressed:false });
    }
  }

  const nmA = teamA.map(i => players[i]?.name).filter(Boolean).join('/');
  const nmB = teamB.map(i => players[i]?.name).filter(Boolean).join('/');

  return matches.map(m => {
    const thru = hv.slice(m.si).filter(Boolean).length;
    const lead = m.aw - m.bw;
    const status = thru === 0 ? '—' : lead === 0 ? 'AS' : lead > 0 ? `${nmA} ${Math.abs(lead)}UP` : `${nmB} ${Math.abs(lead)}UP`;
    return { label: m.label, aw: m.aw, bw: m.bw, thru, status, lead, startHole: holes[m.si], teamA, teamB };
  });
}

// ─── Unified Match / Nassau runner ────────────────────────────────────────────
// matchDef: one entry from activeRound.matches[]
// Returns { front, back, overall } — each is an array of match/press bets.
// For a straight Match (betFront=0, betBack=0), only overall has bets.
// manualPressesForMatch: { front:[], back:[], overall:[] }
//
// 13-C.3 (PartialGameContract §3.6, invariant #13):
//   Optional `range` argument — { startHole, endHole } (0-based, inclusive).
//   When absent or equal to { 0, 17 }, FRONT/BACK/ALL18 are the canonical
//   18-hole arrays [0..8] / [9..17] / [0..17] and output is BYTE-IDENTICAL
//   to pre-13-C.3 behavior. When provided with a non-default range, Front /
//   Back are derived via the universal midpoint rule (Back gets the extra
//   hole on odd-length ranges). Overall spans the full effective range.
export function runMatchNassau(scores, players, matchDef, courseHcps, minCourseHcp, manualPressesForMatch = {}, range) {
  const {
    format = 'individual',
    p1, p2,
    teamA, teamB,
    // grossNetNOL: stroke-adjustment mode ('gross'|'net'|'netofflow')
    // Fallback reads old 'scoring' field for unmigrated rounds.
    grossNetNOL, scoring: legacyScoringField = 'net',
    // Per-segment auto-press thresholds ('none' | '1'..'5')
    // Fall back to legacy autoPress/autoPressN if new fields absent
    autoPressF, autoPressB, autoPressO,
    autoPress = 'none', autoPressN = '2',
    // scoring: team hole-scoring rule ('none'|'second'|'cumulative'|'half')
    // Fallback reads old 'tiebreak' field for unmigrated rounds.
    scoring: teamScoring, tiebreak: legacyTiebreak = 'none',
  } = matchDef;

  const strokeMode = grossNetNOL ?? legacyScoringField;
  const holeScoring = teamScoring ?? legacyTiebreak;

  // Resolve per-segment autoN: new fields take precedence over legacy single field
  const legacyN = (autoPress && autoPress !== 'none') ? parseInt(autoPress) : 0;
  const toN = (v) => (v && v !== 'none') ? parseInt(v) : legacyN;

  const autoNF = toN(autoPressF);
  const autoNB = toN(autoPressB);
  const autoNO = toN(autoPressO);

  const mpF = manualPressesForMatch.front   || [];
  const mpB = manualPressesForMatch.back    || [];
  const mpO = manualPressesForMatch.overall || [];

  // 13-C.3: derive FRONT / BACK / ALL18 from range if provided.
  // Default (range absent or full round [0, 17]) → module-level constants,
  // byte-identical to pre-13-C.3 behavior.
  let fHoles = FRONT, bHoles = BACK, aHoles = ALL18;
  if (range
      && Number.isInteger(range.startHole)
      && Number.isInteger(range.endHole)
      && !(range.startHole === 0 && range.endHole === 17)) {
    const startH = range.startHole;
    const endH   = range.endHole;
    const total  = endH - startH + 1;
    const mid    = startH + Math.floor(total / 2);
    fHoles = [];
    bHoles = [];
    aHoles = [];
    for (let h = startH; h < mid; h++) fHoles.push(h);
    for (let h = mid;    h <= endH;  h++) bHoles.push(h);
    for (let h = startH; h <= endH;  h++) aHoles.push(h);
  }

  if (format === 'team') {
    const tA = teamA || [];
    const tB = teamB || [];
    return {
      front:   runTeamMatch(fHoles, scores, players, tA, tB, strokeMode, autoNF, 'Front',   courseHcps, minCourseHcp, holeScoring, mpF),
      back:    runTeamMatch(bHoles, scores, players, tA, tB, strokeMode, autoNB, 'Back',    courseHcps, minCourseHcp, holeScoring, mpB),
      overall: runTeamMatch(aHoles, scores, players, tA, tB, strokeMode, autoNO, 'Overall', courseHcps, minCourseHcp, holeScoring, mpO),
    };
  }

  // individual
  return {
    front:   runMatch(fHoles, scores, players, p1, p2, strokeMode, autoNF, 'Front',   courseHcps, minCourseHcp, mpF),
    back:    runMatch(bHoles, scores, players, p1, p2, strokeMode, autoNB, 'Back',    courseHcps, minCourseHcp, mpB),
    overall: runMatch(aHoles, scores, players, p1, p2, strokeMode, autoNO, 'Overall', courseHcps, minCourseHcp, mpO),
  };
}

// Determine if a match instance is a "Nassau" (has Front or Back bets) or plain "Match"
export function isNassauMatch(matchDef) {
  return (matchDef.betFront > 0) || (matchDef.betBack > 0);
}

// Human-readable label for a match card
export function matchLabel(matchDef, players) {
  const { format = 'individual', p1, p2, teamA, teamB } = matchDef;
  if (format === 'team') {
    const nmA = (teamA || []).map(i => players[i]?.name).filter(Boolean).join(' & ');
    const nmB = (teamB || []).map(i => players[i]?.name).filter(Boolean).join(' & ');
    return `${nmA} vs ${nmB}`;
  }
  const n1 = players[p1]?.name || '?';
  const n2 = players[p2]?.name || '?';
  return `${n1} vs ${n2}`;
}

const FRONT  = [0,1,2,3,4,5,6,7,8];
const BACK   = [9,10,11,12,13,14,15,16,17];
const ALL18  = [...FRONT,...BACK];

// Legacy exports kept for any remaining direct call-sites
export { FRONT, BACK, ALL18 };
export function runNassau(scores, players, p1, p2, mode, autoN, courseHcps, minCourseHcp, manualPresses = {}) {
  const front   = runMatch(FRONT,  scores, players, p1, p2, mode, autoN, 'Front',   courseHcps, minCourseHcp, manualPresses.front   || []);
  const back    = runMatch(BACK,   scores, players, p1, p2, mode, autoN, 'Back',    courseHcps, minCourseHcp, manualPresses.back    || []);
  const overall = runMatch(ALL18,  scores, players, p1, p2, mode, autoN, 'Overall', courseHcps, minCourseHcp, manualPresses.overall || []);
  return { front, back, overall };
}

// ─── Sixes ────────────────────────────────────────────────────────────────────
export function getSixesTeam(segIdx, sixesTeams, players) {
  if (segIdx < 2) return sixesTeams[segIdx];
  const allPairs = [];
  for (let a = 0; a < players.length; a++)
    for (let b = a + 1; b < players.length; b++)
      allPairs.push([a, b]);
  const used = [
    `${Math.min(sixesTeams[0].a, sixesTeams[0].b)}-${Math.max(sixesTeams[0].a, sixesTeams[0].b)}`,
    `${Math.min(sixesTeams[1].a, sixesTeams[1].b)}-${Math.max(sixesTeams[1].a, sixesTeams[1].b)}`,
  ];
  const auto = allPairs.find(([a, b]) => !used.includes(`${Math.min(a,b)}-${Math.max(a,b)}`));
  return auto ? { a: auto[0], b: auto[1] } : null;
}

export function calcSixesSegment(holes, scores, players, team, mode, scoring, courseHcps, minCourseHcp) {
  const { a, b } = team;
  const others   = players.map((_, i) => i).filter(i => i !== a && i !== b);
  const [c, d]   = others;
  if (d === undefined || !players[c] || !players[d]) return null;

  let abw = 0, cdw = 0;
  for (const h of holes) {
    const raws = players.map((_, pi) => scores[h]?.[pi]);
    if (raws.some(v => v === '' || v == null)) break;
    const vs = raws.map((raw, pi) => {
      if (raw === 'X') return Infinity;
      const g = parseInt(raw);
      const rank = players[pi].siArray[h];
      return scoreForMode(g, courseHcps[pi], rank, minCourseHcp, mode);
    });
    const AB = Math.min(vs[a], vs[b]);
    const CD = Math.min(vs[c], vs[d]);

    let winner = null;
    if      (AB < CD) winner = 'ab';
    else if (CD < AB) winner = 'cd';
    else if (scoring === 'second') {
      const AB2 = Math.max(vs[a], vs[b]), CD2 = Math.max(vs[c], vs[d]);
      if      (AB2 < CD2) winner = 'ab';
      else if (CD2 < AB2) winner = 'cd';
    } else if (scoring === 'cumulative') {
      // Hole-scoring rule: compare sum of each team's two net scores.
      // Tied sums → no point (hole halved).
      const sumAB = vs[a] + vs[b], sumCD = vs[c] + vs[d];
      if      (sumAB < sumCD) winner = 'ab';
      else if (sumCD < sumAB) winner = 'cd';
    } else if (scoring === 'half') { abw += 0.5; cdw += 0.5; continue; }
    if (winner === 'ab') abw++;
    else if (winner === 'cd') cdw++;
  }
  return { abw, cdw, a, b, c, d, winTeam: abw > cdw ? 'ab' : cdw > abw ? 'cd' : null };
}

// ─── Sixes segment with press support ─────────────────────────────────────────
// Mirrors runTeamMatch but uses Sixes best-ball team scoring (team {a,b} vs
// complement {c,d}). Returns MatchResult[] — one entry per match level.
//
// MatchResult shape: { label, abw, cdw, thru, winTeam, lead, startHole }
//   label    — 'Front 6' | 'Middle 6' | 'Last 6' for base; 'Press N' for presses
//   abw/cdw  — hole wins for Team AB / Team CD in this match level only
//   thru     — holes scored in this match level's range
//   winTeam  — 'ab' | 'cd' | null (null = tied or incomplete)
//   lead     — abw − cdw (positive = AB leading)
//   startHole — first hole index of this match level
//
// autoN          — 0 = off; 1/2/3 = hole-lead threshold to trigger auto-press
// manualPressHoles — sorted hole indices (within `holes`) after which press starts
//
// Presses beyond the last scored hole are ignored (§5.1).
// A press at the final hole of the segment is ignored (zero-length guard).
export function runSixesSegment(
  holes, scores, players,
  team, mode, scoring,
  courseHcps, minCourseHcp,
  autoN, manualPressHoles = []
) {
  const { a, b } = team;
  const others = players.map((_, i) => i).filter(i => i !== a && i !== b);
  const [c, d] = others;

  // Guard: need exactly 4 valid players for Sixes
  if (d === undefined || !players[c] || !players[d]) return null;

  // Build per-hole scored values. null = unplayed (stops scoring).
  const hv = holes.map(h => {
    const raws = players.map((_, pi) => scores[h]?.[pi]);
    // Stop on any unscored player (empty/null). 'X' is scored.
    if (raws.some(v => v === '' || v == null)) return null;
    // X treated as Infinity — always loses best-ball comparison
    const vs = raws.map((raw, pi) => {
      if (raw === 'X') return Infinity;
      const g = parseInt(raw);
      const rank = players[pi].siArray[h];
      return scoreForMode(g, courseHcps[pi], rank, minCourseHcp, mode);
    });
    const AB = Math.min(vs[a], vs[b]);
    const CD = Math.min(vs[c], vs[d]);

    let winner = null;
    if (AB < CD) {
      winner = 'ab';
    } else if (CD < AB) {
      winner = 'cd';
    } else if (scoring === 'second') {
      const AB2 = Math.max(vs[a], vs[b]);
      const CD2 = Math.max(vs[c], vs[d]);
      if      (AB2 < CD2) winner = 'ab';
      else if (CD2 < AB2) winner = 'cd';
    } else if (scoring === 'cumulative') {
      // Hole-scoring rule: compare sum of each team's two net scores.
      // Tied sums → hole halved (winner stays null).
      const sumAB = vs[a] + vs[b];
      const sumCD = vs[c] + vs[d];
      if      (sumAB < sumCD) winner = 'ab';
      else if (sumCD < sumAB) winner = 'cd';
    } else if (scoring === 'half') {
      // LEGACY: retained for back-compat. Not offered in UI as of 11-I.2.
      winner = 'half';
    }
    return { winner };
  });

  // Segment labels mirror Sixes_Contract §5.6
  const SEG_LABELS = { 0: 'Front 6', 1: 'Middle 6', 2: 'Last 6' };
  const segIdx = holes[0] < 6 ? 0 : holes[0] < 12 ? 1 : 2;
  const baseLabel = SEG_LABELS[segIdx] ?? 'Segment';

  const pressAfterIdx = new Set();
  const matches = [{ label: baseLabel, abw: 0, cdw: 0, halves: 0, si: 0, pressed: false }];
  let pressCount = 0;

  for (let i = 0; i < hv.length; i++) {
    if (!hv[i]) break; // unplayed hole — stop

    for (const m of matches) {
      if      (hv[i].winner === 'ab')   m.abw++;
      else if (hv[i].winner === 'cd')   m.cdw++;
      else if (hv[i].winner === 'half') { m.abw += 0.5; m.cdw += 0.5; }
    }

    // Auto-press: watches deepest (last) match level only.
    // Once it fires for that level, it's marked pressed; the new child can also auto-press.
    const lm = matches[matches.length - 1];
    const lead = lm.abw - lm.cdw;
    const autoTrigger   = autoN > 0 && !lm.pressed && Math.abs(lead) >= autoN;
    const manualTrigger = manualPressHoles.includes(holes[i]);

    // Guard: press must have at least one remaining hole in segment (§5.1)
    if ((autoTrigger || manualTrigger) && i + 1 < hv.length && !pressAfterIdx.has(i)) {
      pressAfterIdx.add(i);
      lm.pressed = true;
      pressCount++;
      matches.push({ label: `Press ${pressCount}`, abw: 0, cdw: 0, halves: 0, si: i + 1, pressed: false });
    }
  }

  return matches.map(m => {
    const thru = hv.slice(m.si).filter(Boolean).length;
    // Incomplete segment rule (§3.5): winTeam is null if not all 6 holes scored
    const totalHoles = holes.length - m.si;
    const segComplete = thru === totalHoles;
    const lead = m.abw - m.cdw;
    let winTeam = null;
    if (segComplete) {
      winTeam = lead > 0 ? 'ab' : lead < 0 ? 'cd' : null;
    }
    return {
      label:     m.label,
      abw:       m.abw,
      cdw:       m.cdw,
      thru,
      winTeam,
      lead,
      startHole: holes[m.si],
    };
  });
}

// ─── Stableford ──────────────────────────────────────────────────────────────
// For X scores: xGross = par+2+strokes. In net mode this = net double bogey = 0 pts.
// The stabPts function handles this naturally — no special case needed beyond
// substituting xGrossScore for the raw score.
//
// 13-G.2: This individual-stableford helper accepts siArray (per-player SI)
// instead of the round-shared hcps[]. Caller passes players[pi].siArray.
export function calcStablefordTotal(scores, pi, pars, siArray, courseHcp, minCourseHcp, mode, stabTable, holes) {
  return holes.reduce((sum, h) => {
    const raw = scores[h]?.[pi];
    if (raw === '' || raw == null) return sum;
    const rank = siArray[h];
    // X: gross = par + 2 + strokes (ESC maximum). stabPts handles net double bogey → 0 pts naturally.
    if (raw === 'X') {
      const strokes = hdcpStrokesFromCourseHcp(courseHcp, rank);
      const xGross = (pars[h] || 0) + 2 + strokes;
      return sum + (stabPts(xGross, pars[h], courseHcp, rank, minCourseHcp, mode, stabTable) ?? 0);
    }
    const g = parseInt(raw);
    return sum + (g ? stabPts(g, pars[h], courseHcp, rank, minCourseHcp, mode, stabTable) ?? 0 : 0);
  }, 0);
}

// ─── Team Stableford ──────────────────────────────────────────────────────────
// Computes team Stableford totals for a two-player team across specified holes.
// scoring: 'cumulative' (sum both players' pts) | 'bestball' (better of two pts)
// teamIdxs: exactly 2 player indices
// holes: the hole indices the team plays over (already trimmed to the game's
//        effective range by the caller — payouts.js / StablefordTable).
// range (optional, 13-C.3): { startHole, endHole } for F/B midpoint computation.
//        When absent or equal to { 0, 17 }, F/B split falls on hole 9 (h < 9),
//        which is BYTE-IDENTICAL to pre-13-C.3 behavior. When provided with a
//        non-default range, Front / Back boundaries follow PartialGameContract
//        §3.6 (Back gets the extra hole on odd-length ranges).
// Caller must pass minCourseHcp computed from teamA ∪ teamB only (NOL+subset rule).
// Returns { pts, ptsF, ptsB } — totals over the specified holes, split at the
// midpoint of the effective range.
//
// 13-G.2: Reads players[pi].siArray[h] for stroke allocation. The shared hcps[]
// param is dropped — siArray is per-player.
export function calcTeamStablefordTotal(scores, players, pars, courseHcps, minCourseHcp, mode, stabTable, teamIdxs, scoring, holes, range) {
  const [i0, i1] = teamIdxs;
  const rule = scoring ?? 'cumulative';

  // 13-C.3: derive midHole from range. Default behavior (range absent or full
  // round) → midHole = 9, byte-identical to pre-13-C.3 `h < 9` split.
  let midHole = 9;
  if (range
      && Number.isInteger(range.startHole)
      && Number.isInteger(range.endHole)
      && !(range.startHole === 0 && range.endHole === 17)) {
    const total = range.endHole - range.startHole + 1;
    midHole = range.startHole + Math.floor(total / 2);
  }

  let ptsF = 0, ptsB = 0;
  for (const h of holes) {
    const raw0 = scores[h]?.[i0];
    const raw1 = scores[h]?.[i1];
    const stabFor = (raw, pi) => {
      if (raw === '' || raw == null) return 0;
      const rank = players[pi].siArray[h];
      if (raw === 'X') {
        const strokes = hdcpStrokesFromCourseHcp(courseHcps[pi], rank);
        const xGross = (pars[h] || 0) + 2 + strokes;
        return stabPts(xGross, pars[h], courseHcps[pi], rank, minCourseHcp, mode, stabTable) ?? 0;
      }
      const g = parseInt(raw);
      return g ? stabPts(g, pars[h], courseHcps[pi], rank, minCourseHcp, mode, stabTable) ?? 0 : 0;
    };
    const p0 = stabFor(raw0, i0);
    const p1 = stabFor(raw1, i1);
    const holePts = rule === 'bestball' ? Math.max(p0, p1) : p0 + p1;
    if (h < midHole) ptsF += holePts; else ptsB += holePts;
  }
  return { pts: ptsF + ptsB, ptsF, ptsB };
}

// ─── Stroke Play ─────────────────────────────────────────────────────────────
// playerIdxs: optional subset of player indices (empty/absent = all players).
// minCourseHcp: caller must pass the correct value — for NOL+subset rounds this
// must be subsetMin(cHcps, spIdxs, globalMin, mode), computed in the payout block
// (Handicap Contract §5.2 / Payout Contract §4.3). The engine uses it directly.
// Each result row includes `pi` (original player index) for display filtering.
export function calcStrokePlay(scores, players, pars, mode, courseHcps, minCourseHcp, playerIdxs) {
  const parTot = pars.reduce((a, b) => a + b, 0);
  const idxs   = playerIdxs?.length ? playerIdxs : players.map((_, i) => i);
  return idxs.map(pi => {
    const p  = players[pi];
    const siArray = p.siArray;
    const gt = Array.from({ length: 18 }, (_, h) => {
      const raw = scores[h]?.[pi];
      if (raw === 'X') return (pars[h] || 0) + 2 + hdcpStrokesFromCourseHcp(courseHcps[pi], siArray[h]);
      return parseInt(raw) || 0;
    }).reduce((a, b) => a + b, 0);
    const nt = Array.from({ length: 18 }, (_, h) => {
      const raw = scores[h]?.[pi];
      if (raw === 'X') {
        const xg = (pars[h] || 0) + 2 + hdcpStrokesFromCourseHcp(courseHcps[pi], siArray[h]);
        return scoreForMode(xg, courseHcps[pi], siArray[h], minCourseHcp, mode) || 0;
      }
      const g = parseInt(raw);
      return g ? scoreForMode(g, courseHcps[pi], siArray[h], minCourseHcp, mode) || 0 : 0;
    }).reduce((a, b) => a + b, 0);
    return { name: p.name, pi, gt, nt, nd: nt - parTot };
  }).sort((a, b) => a.nd - b.nd);
}

// ─── Specials ────────────────────────────────────────────────────────────────
// ─── Dots ─────────────────────────────────────────────────────────────────────
// Formerly "Specials". Renamed in v2.0.
// DOTS_DEF is the canonical list of all built-in dot types.
// value = dollar value per dot occurrence (renamed from pts in v2.0).
// Backward-compat alias SPECIALS_DEF kept so any un-migrated callers don't crash.
//
// Scoring specials (ace/condor/albatross/eagle/birdie) are mutually exclusive
// per hole — only the highest-value one fires. Priority: ace > condor > albatross
// > eagle > birdie. autoWhen functions receive (effectiveScore, par).
export const DOTS_DEF = [
  { id:'ace',       name:'Ace',       value:5, enabled:true,  auto:true,  multi:false, autoWhen:(g)     => g === 1 },
  { id:'condor',    name:'Condor',    value:5, enabled:true,  auto:true,  multi:false, autoWhen:(g,par) => par - g >= 4 },
  { id:'albatross', name:'Albatross', value:4, enabled:true,  auto:true,  multi:false, autoWhen:(g,par) => par - g === 3 },
  { id:'eagle',     name:'Eagle',     value:3, enabled:true,  auto:true,  multi:false, autoWhen:(g,par) => par - g === 2 },
  { id:'birdie',    name:'Birdie',    value:1, enabled:true,  auto:true,  multi:false, autoWhen:(g,par) => par - g === 1 },
  { id:'sandy',     name:'Sandy',     value:1, enabled:true,  auto:false, multi:true  },
  { id:'polie',     name:'Polie',     value:1, enabled:true,  auto:false, multi:false },
  { id:'kp',        name:'KP',        value:1, enabled:true,  auto:false, multi:true  },
  { id:'chippie',   name:'Chippie',   value:1, enabled:true,  auto:false, multi:false },
  { id:'team',      name:'Team',      value:1, enabled:true,  auto:false, multi:true  },
  // 'team' is auto-awarded to the partner when any standard dot is earned in team mode.
  // Not user-configurable in the popup or setup.
];
// Backward-compat alias — remove after all callers migrated
export const SPECIALS_DEF = DOTS_DEF;

// Returns the partner index for player piNum in the given Sixes segment.
// Used for team dots payout — partner is the same-team player in that segment.
export function getDotsPartner(piNum, segIdx, sixesTeams, players) {
  if (!sixesTeams?.[0] || !sixesTeams?.[1]) return -1;
  let teamA = null;
  if (segIdx < 2) {
    teamA = sixesTeams[segIdx];
  } else {
    const allP = [];
    for (let a = 0; a < players.length; a++)
      for (let b = a + 1; b < players.length; b++)
        allP.push([a, b]);
    const used = [
      `${Math.min(sixesTeams[0].a,sixesTeams[0].b)}-${Math.max(sixesTeams[0].a,sixesTeams[0].b)}`,
      `${Math.min(sixesTeams[1].a,sixesTeams[1].b)}-${Math.max(sixesTeams[1].a,sixesTeams[1].b)}`,
    ];
    const auto = allP.find(([a,b]) => !used.includes(`${Math.min(a,b)}-${Math.max(a,b)}`));
    if (auto) teamA = { a:auto[0], b:auto[1] };
  }
  if (!teamA) return -1;
  const teamBPlayers = players.map((_, i) => i).filter(i => i !== teamA.a && i !== teamA.b);
  if (piNum === teamA.a) return teamA.b;
  if (piNum === teamA.b) return teamA.a;
  if (teamBPlayers.length >= 2) {
    if (piNum === teamBPlayers[0]) return teamBPlayers[1];
    if (piNum === teamBPlayers[1]) return teamBPlayers[0];
  }
  return -1;
}
// Backward-compat alias — remove after all callers migrated
export const getSpecialsPartner = getDotsPartner;

// Returns the partner index for player piNum in a team Match/Nassau game.
// Looks at the first team-format matchDef in matches[].
// Returns -1 if no team match exists or piNum is not a participant.
export function getMatchTeamPartner(piNum, matches) {
  if (!matches?.length) return -1;
  const teamMatch = matches.find(m => m.format === 'team');
  if (!teamMatch) return -1;
  const { teamA = [], teamB = [] } = teamMatch;
  const aIdx = teamA.indexOf(piNum);
  if (aIdx >= 0) {
    return teamA.find(i => i !== piNum) ?? -1;
  }
  const bIdx = teamB.indexOf(piNum);
  if (bIdx >= 0) {
    return teamB.find(i => i !== piNum) ?? -1;
  }
  return -1;
}

// Get the Sixes segment index (0,1,2) for a given hole index (0-based)
export function sixesSegForHole(h) {
  if (h < 6) return 0;
  if (h < 12) return 1;
  return 2;
}
