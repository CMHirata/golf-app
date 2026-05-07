// ✅ Self-checked (13-G.2): All engine call sites updated to drop the round-shared
// `hcps` parameter — engines now read players[pi].siArray[h] internally per
// Handicap_Contract §5 / inv 21. Updated calls: calcSkinsHole, calcStrokePlay,
// runMatchNassau, calcNines, runSixesSegment, calcTeamStablefordTotal (now takes
// players array), calcStablefordTotal (now takes players[pi].siArray), and the
// inline segScore stroke-play scoreForMode call. The `hcps` parameter on
// computePayouts() itself is retained for caller back-compat and is unused;
// removing it would touch every caller of computePayouts unnecessarily.
//
// ✅ Self-checked (13-C.8.1): Sixes breakdown now emits a columnar layout
// (Front 6 / Middle 6 / Last 6 / Game Total) — `colHeaders` + per-row
// `matchCols` populated from per-segment gb tracking. Labels use
// sixesSegLabel(si, segLen) so partial-range Sixes (e.g. 12 holes →
// 4-hole segments → "Front 4 / Middle 4 / Last 4") render correctly.
// The decorative emoji prefix on the Sixes header was also removed —
// label is now plain "Sixes" (matching app-wide no-new-emoji direction).
// Existing emoji prefixes on other game headers (Stroke Play, Skins,
// Match, Nines, Dots) are preserved for back-compat with legacy filters.
//
// ✅ Self-checked (13-C.8): Engine departure handling per PartialGameContract
// §11.2–§11.9 + Resolver_UI_Spec §4. Each game block now (a) aggregates its
// per-player + group-stop resolutions; (b) skips entirely on `abandon`;
// (c) applies trimScoresToHole per departed player for `end_at_k`;
// (d) applies excludePlayerSubset for `exclude_player`;
// (e) Skins applies a per-hole eligibility partition for `continue`;
// (f) for clinch-family (Match/Sixes), evaluates segment + press status and
// zeroes Pay/Abandon-flagged contributions before merging into bank;
// (g) for completion-family (Stableford/Stroke Play/Nines segments mode),
// zeroes per-segment Pay/Abandon-flagged contributions identically.
// `earlyEndOpts` (Scenario B) is consumed identically to a per-player
// end_at_k applied to ALL players at lastCompletedHole.
// Match/Nassau breakdown is now emitted PER MATCH (one entry per matchDef.id)
// per session decision — combined header retired.
// Engine firewall preserved — games.js and handicap.js untouched.
// Dots `continue` follows Option B: the departure guardrail filters
// post-departure entries (including companion entries — see scorecardUtils
// 13-C.8 amendment). Team Dots locked to a parent team game inherits the
// parent's end-hole if the parent ended; convert-to-individual mechanic
// deferred (BP D-15 — to be added at session close).
// Verified: no parseInt('X'); zero-sum invariant preserved by symmetric
// abandon-zeroing; default segment/press decision is 'pay' (matches
// resolver UI emission); legacy/full-round paths unchanged when agg has
// no resolutions.
//
// ─── payouts.js ───────────────────────────────────────────────────────────────
// Computes final dollar payouts for every active game.
// Pure function — no React, no DOM. Returns { bank, breakdown }.
//
// NOL + SUBSET RULE (Handicap Contract §5):
//   When a game operates on a player subset and scoring mode is 'netofflow',
//   minCourseHcp passed to the engine must be the minimum course handicap of
//   the participating subset only — never from a superset of players.
//   All per-game blocks below use subsetMin() to enforce this invariant.
//
// 13-C.3 — PartialGameContract §3.6, §11.1, invariant #13:
//   - `splitRangeByMidpoint(startHole, endHole)` is the universal F/B/T midpoint
//     split helper. Back gets the extra hole on odd-length ranges.
//   - `rangeFor(gameKey)` resolves a game's effective range from
//     `gameRanges[gameKey]`, defaulting to [roundStartHole, roundEndHole].
//   - Match and Stableford-team pass the range to the engine via the optional
//     `range` argument on `runMatchNassau` and `calcTeamStablefordTotal`.
//     All other games are trimmed at the pre-processing layer before the
//     engine is called.

import { scoreForMode } from './handicap.js';
import {
  calcSkins, calcSkinsHole,
  calcNines, ninesPts,
  runMatchNassau, isNassauMatch, matchLabel,
  getSixesTeam, calcSixesSegment, runSixesSegment,
  calcStablefordTotal, calcTeamStablefordTotal,
  calcStrokePlay,
  getDotsPartner, getMatchTeamPartner, sixesSegForHole,
} from './games.js';

function initBank(players) {
  const bank = {};
  players.forEach(p => (bank[p.name] = 0));
  return bank;
}

/** Pay the winner of a segment vs all other players in the subset */
function payWinner(winner, players, bet, gb) {
  players.forEach(p => {
    if (p.name !== winner) { gb[p.name] -= bet; gb[winner] += bet; }
  });
}

/**
 * Compute the minimum course handicap for a subset of player indices.
 */
function subsetMin(cHcps, idxs, globalMin, mode) {
  if (mode !== 'netofflow' || !idxs?.length) return globalMin;
  return Math.min(...idxs.map(i => cHcps[i]));
}

/**
 * 13-C.3 — PartialGameContract §3.6. Universal F/B/T midpoint split.
 */
function splitRangeByMidpoint(startHole, endHole) {
  const total = endHole - startHole + 1;
  const mid   = startHole + Math.floor(total / 2);
  const front = [];
  const back  = [];
  const all   = [];
  for (let h = startHole; h < mid;      h++) front.push(h);
  for (let h = mid;       h <= endHole; h++) back.push(h);
  for (let h = startHole; h <= endHole; h++) all.push(h);
  return { front, back, all };
}

/**
 * 13-C.3 — resolve a game's effective hole range.
 */
function rangeFor(key, gameRanges, roundStartHole, roundEndHole) {
  const entry = gameRanges?.[key];
  if (entry
      && Number.isInteger(entry.startHole)
      && Number.isInteger(entry.endHole)
      && entry.startHole >= roundStartHole
      && entry.endHole   <= roundEndHole
      && entry.startHole <  entry.endHole) {
    return { startHole: entry.startHole, endHole: entry.endHole };
  }
  return { startHole: roundStartHole, endHole: roundEndHole };
}

/**
 * 13-C.3 — trim a scores array to a hole range.
 */
function trimScoresToRange(scores, startHole, endHole, playerCount) {
  const empty = Array(playerCount).fill('');
  const out = [];
  for (let h = 0; h < 18; h++) {
    if (h >= startHole && h <= endHole) out.push(scores[h] || empty);
    else out.push(empty);
  }
  return out;
}

// 13-C.7.5 / v2.0: Engine departure data guardrail per PartialGameContract
// §14 invariant 21. Applied once at the top of computePayouts.
function applyDepartureGuardrail(scores, earlyDepartureOpts, playerCount) {
  if (!earlyDepartureOpts || Object.keys(earlyDepartureOpts).length === 0) {
    return scores;
  }
  const maxHoleForPlayer = new Array(playerCount).fill(Infinity);
  Object.entries(earlyDepartureOpts).forEach(([piStr, entry]) => {
    const pi = Number(piStr);
    if (pi >= 0 && pi < playerCount && entry && typeof entry.departureHole === 'number') {
      maxHoleForPlayer[pi] = entry.departureHole;
    }
  });
  if (maxHoleForPlayer.every(m => m === Infinity)) return scores;

  const out = [];
  for (let h = 0; h < 18; h++) {
    const row = scores[h] || new Array(playerCount).fill('');
    let mutated = false;
    let newRow = null;
    for (let pi = 0; pi < playerCount; pi++) {
      if (h > maxHoleForPlayer[pi] && row[pi] !== '' && row[pi] != null) {
        if (!mutated) { newRow = row.slice(); mutated = true; }
        newRow[pi] = '';
      }
    }
    out.push(mutated ? newRow : row);
  }
  return out;
}

// 13-C.8 — Resolver_UI_Spec §4.2 primitive.
// Per-player score trim. Returns a new 18-row array where, for the specified
// playerIdx, scores at holes strictly greater than `lastHole` are replaced
// with `''`. All other players preserved. Idempotent. Composes by chaining.
function trimScoresToHole(scores, playerIdx, lastHole, playerCount) {
  const out = [];
  for (let h = 0; h < 18; h++) {
    const row = scores[h] || new Array(playerCount).fill('');
    if (h > lastHole && row[playerIdx] !== '' && row[playerIdx] != null) {
      const newRow = row.slice();
      newRow[playerIdx] = '';
      out.push(newRow);
    } else {
      out.push(row);
    }
  }
  return out;
}

// 13-C.8 — Resolver_UI_Spec §4.2 primitive.
// Returns a new array with `excludePi` removed. If `subsetIdxs` is empty
// (which means "all players" by Payout Contract §4.1 convention), expands
// to all-player indices and removes.
function excludePlayerSubset(subsetIdxs, excludePi, allPlayersLength) {
  if (!subsetIdxs?.length) {
    return Array.from({ length: allPlayersLength }, (_, i) => i)
                .filter(i => i !== excludePi);
  }
  return subsetIdxs.filter(i => i !== excludePi);
}

// 13-C.8 — Aggregate per-player + group-stop events for a game key into a
// single effective resolution. Precedence: abandon > end_at_k > continue/
// exclude_player. Multiple compatible events compose.
//
// Returns AggregatedResolution:
//   {
//     abandoned:           boolean,
//     endAtK:              { hole, segments, presses } | null,    // hole = MAX departureHole among end_at_k events; segments/presses merged from latest
//     continueByPlayer:    { [pi]: departureHole },
//     excludedPlayers:     [pi, ...],
//     groupStop:           { hole, segments, presses } | null,    // Scenario B (lastCompletedHole)
//     endAtKByPlayer:      { [pi]: departureHole },                // per-player end_at_k departure holes (for trim)
//     hasAnyResolution:    boolean,
//   }
function aggregateResolutionForGame(earlyDepartureOpts, earlyEndOpts, lastCompletedHole, gameKey) {
  const out = {
    abandoned:        false,
    endAtK:           null,
    continueByPlayer: {},
    excludedPlayers:  [],
    groupStop:        null,
    endAtKByPlayer:   {},
    hasAnyResolution: false,
  };

  const events = Object.entries(earlyDepartureOpts || {})
    .map(([piStr, e]) => ({ pi: Number(piStr), entry: e }))
    .filter(x => x.entry && typeof x.entry.departureHole === 'number')
    .sort((a, b) => {
      const eo = (a.entry.eventOrder ?? a.entry.departureHole) -
                 (b.entry.eventOrder ?? b.entry.departureHole);
      return eo !== 0 ? eo : (a.pi - b.pi);
    });

  for (const ev of events) {
    const res = ev.entry.gameResolutions?.[gameKey];
    if (!res || !res.topLevel) continue;
    out.hasAnyResolution = true;
    const tl = res.topLevel;
    if (tl === 'abandon') {
      out.abandoned = true;
      continue;
    }
    if (tl === 'end_at_k') {
      const h = ev.entry.departureHole;
      out.endAtKByPlayer[ev.pi] = h;
      if (out.endAtK == null) {
        out.endAtK = { hole: h, segments: { ...(res.segments || {}) }, presses: { ...(res.presses || {}) } };
      } else {
        if (h > out.endAtK.hole) out.endAtK.hole = h;
        out.endAtK.segments = { ...out.endAtK.segments, ...(res.segments || {}) };
        out.endAtK.presses  = { ...out.endAtK.presses,  ...(res.presses  || {}) };
      }
      continue;
    }
    if (tl === 'continue') {
      out.continueByPlayer[ev.pi] = ev.entry.departureHole;
      continue;
    }
    if (tl === 'exclude_player') {
      if (!out.excludedPlayers.includes(ev.pi)) out.excludedPlayers.push(ev.pi);
      continue;
    }
  }

  // Scenario B group-stop: applied uniformly to ALL players.
  if (earlyEndOpts && earlyEndOpts[gameKey] && typeof lastCompletedHole === 'number') {
    const ge = earlyEndOpts[gameKey];
    out.hasAnyResolution = true;
    if (ge.topLevel === 'abandon') {
      out.abandoned = true;
    } else if (ge.topLevel === 'end_at_k') {
      out.groupStop = {
        hole:     lastCompletedHole,
        segments: { ...(ge.segments || {}) },
        presses:  { ...(ge.presses  || {}) },
      };
    } else if (ge.topLevel === 'continue' || ge.topLevel === 'exclude_player') {
      // Group-stop continue/exclude_player are atypical — collapse to end_at_k
      // semantics (stop here, all segments paid by default).
      out.groupStop = {
        hole:     lastCompletedHole,
        segments: {},
        presses:  {},
      };
    }
  }

  return out;
}

// 13-C.8 — Apply the per-player end_at_k trim and Scenario B group-stop trim
// to the scores array for a given game's aggregated resolution. Returns a
// transformed scores array (input never mutated). `continue` players are NOT
// trimmed (they keep their scores); the per-hole eligibility partition for
// pool-family `continue` is handled in the game block itself (Skins).
// `exclude_player` is handled at subset level, not score level.
function applyResolutionToScores(scores, agg, players) {
  const playerCount = players.length;
  let s = scores;

  // Per-player end_at_k trim: each player's tail past their departureHole.
  Object.entries(agg.endAtKByPlayer).forEach(([piStr, hole]) => {
    const pi = Number(piStr);
    s = trimScoresToHole(s, pi, hole, playerCount);
  });

  // Group-stop: trim ALL players to lastCompletedHole.
  if (agg.groupStop) {
    for (let pi = 0; pi < playerCount; pi++) {
      if (agg.excludedPlayers.includes(pi)) continue;
      s = trimScoresToHole(s, pi, agg.groupStop.hole, playerCount);
    }
  }

  return s;
}

// 13-C.8 — Per-segment Pay/Abandon decision lookup.
// Group-stop pills override per-player pills (since the round ended for
// everyone). Default 'pay' for any segment not present in the resolution
// (matches resolver UI emission default).
function decisionForSegment(agg, segKey) {
  if (agg.groupStop) {
    const v = agg.groupStop.segments?.[segKey];
    if (v === 'abandon' || v === 'pay') return v;
    return 'pay';
  }
  if (agg.endAtK) {
    const v = agg.endAtK.segments?.[segKey];
    if (v === 'abandon' || v === 'pay') return v;
    return 'pay';
  }
  return 'pay';
}

function decisionForPress(agg, triggerHole) {
  if (agg.groupStop) {
    const v = agg.groupStop.presses?.[triggerHole];
    if (v === 'abandon' || v === 'pay') return v;
    return 'pay';
  }
  if (agg.endAtK) {
    const v = agg.endAtK.presses?.[triggerHole];
    if (v === 'abandon' || v === 'pay') return v;
    return 'pay';
  }
  return 'pay';
}

// 13-C.8 — Build a compact segment-status summary for the breakdown header.
// Examples: "paid Front only", "paid Front, Back only", "all abandoned".
// Returns null if all segments are 'pay' (no decoration needed).
function summarizeSegmentDecisions(segs) {
  const paid       = segs.filter(s => s.decision !== 'abandon');
  const abandoned  = segs.filter(s => s.decision === 'abandon');
  if (abandoned.length === 0) return null;
  if (paid.length === 0)      return 'all abandoned';
  return `paid ${paid.map(s => s.label).join(', ')} only`;
}

// 13-C.8 — Decorate a game header with resolution outcome.
// `players` for exclude_player name expansion. `segDecisions` is the optional
// segment-status array (clinch + completion families that ran end_at_k).
function decorateHeader(baseLabel, agg, players, segDecisions = null) {
  if (!agg.hasAnyResolution) return baseLabel;
  const parts = [];

  if (agg.endAtK || agg.groupStop) {
    const hole     = (agg.groupStop ?? agg.endAtK).hole;
    const stopWord = agg.groupStop ? 'round ended' : 'ended';
    const segSummary = segDecisions ? summarizeSegmentDecisions(segDecisions) : null;
    if (segSummary) parts.push(`${stopWord} at hole ${hole + 1}, ${segSummary}`);
    else            parts.push(`${stopWord} at hole ${hole + 1}`);
  }
  if (Object.keys(agg.continueByPlayer).length > 0) {
    const names = Object.keys(agg.continueByPlayer)
      .map(piStr => players[Number(piStr)]?.name)
      .filter(Boolean);
    parts.push(names.length ? `continued (${names.join(', ')} departed)` : 'continued');
  }
  if (agg.excludedPlayers.length > 0) {
    const names = agg.excludedPlayers
      .map(pi => players[pi]?.name)
      .filter(Boolean);
    parts.push(names.length ? `drop player (${names.join(', ')})` : 'drop player');
  }

  if (parts.length === 0) return baseLabel;
  return `${baseLabel} — ${parts.join(' · ')}`;
}

// 13-C.8 — Sixes-specific segment label generator. Resolver UI uses
// "Front 6 / Middle 6 / Last 6" for full-round Sixes; for partial ranges,
// segment lengths adjust (e.g., 12-hole Sixes range → "Front 4 / Middle 4 /
// Last 4"). Per session decision, breakdown header reuses these labels.
function sixesSegLabel(segIdx, segLen) {
  const prefix = ['Front', 'Middle', 'Last'][segIdx] || `Seg ${segIdx + 1}`;
  return `${prefix} ${segLen}`;
}

export function computePayouts({
  players, pars, hcps, scores,
  activeGames, gameOpts,
  matches = [],
  strokePlayPlayers = [],
  skinsPlayers = [],
  stablefordPlayers = [],
  ninesPlayers = [],
  sixesTeams,
  sixesPlayers = [],
  dotsPlayers = [],
  dots, dotEntries,
  courseHcps,
  minCourseHcp,
  manualPresses = {},
  // 13-C.2 / 13-C.3
  roundStartHole = 0,
  roundNumHoles  = 18,
  gameRanges     = {},
  // 13-C.7.5 / v2.0
  earlyDepartureOpts = {},
  // 13-C.8: Group-stop (Scenario B) metadata.
  earlyEndOpts       = {},
  lastCompletedHole,
}) {
  const bank      = initBank(players);
  const breakdown = [];
  const cHcps    = courseHcps || players.map(p => Math.round(parseFloat(p.ghin) || 0));
  const minCHcp  = minCourseHcp ?? Math.min(...cHcps);
  const parTot   = pars.reduce((a, b) => a + b, 0);
  const playerCount = players.length;

  // 13-C.7.5: Apply the engine departure data guardrail before any engine call.
  scores = applyDepartureGuardrail(scores, earlyDepartureOpts, playerCount);

  // 13-C.2: Derived round-end hole.
  const roundEndHole = roundStartHole + roundNumHoles - 1;

  // 13-C.8: Group-stop is in effect only when lastCompletedHole < roundEndHole
  // AND earlyEndOpts contains at least one game resolution.
  const hasGroupStop = typeof lastCompletedHole === 'number'
                    && lastCompletedHole < roundEndHole
                    && earlyEndOpts
                    && Object.keys(earlyEndOpts).length > 0;
  const effectiveEndOpts            = hasGroupStop ? earlyEndOpts       : {};
  const effectiveLastCompletedHole  = hasGroupStop ? lastCompletedHole  : undefined;

  const gameRange   = (key) => rangeFor(key, gameRanges, roundStartHole, roundEndHole);
  const aggregateFor = (gameKey) => aggregateResolutionForGame(
    earlyDepartureOpts, effectiveEndOpts, effectiveLastCompletedHole, gameKey
  );

  // ── Stroke Play ────────────────────────────────────────────────────────────
  if (activeGames.includes('Stroke Play')) {
    const bet        = gameOpts['Stroke Play']?.bet  || 0;
    const mode       = gameOpts['Stroke Play']?.grossNetNOL ?? gameOpts['Stroke Play']?.scoring ?? 'net';
    const strokeMode = gameOpts['Stroke Play']?.betMode ?? gameOpts['Stroke Play']?.strokeMode ?? 'total';
    const spBetF     = gameOpts['Stroke Play']?.betF  ?? bet;
    const spBetB     = gameOpts['Stroke Play']?.betB  ?? bet;
    const spBet18    = gameOpts['Stroke Play']?.bet18 ?? bet;

    const agg = aggregateFor('Stroke Play');
    if (agg.abandoned) {
      // Skip game entirely (no breakdown, no bank contribution).
    } else {
      let spIdxs = strokePlayPlayers?.length ? strokePlayPlayers : players.map((_, i) => i);
      agg.excludedPlayers.forEach(pi => {
        spIdxs = excludePlayerSubset(spIdxs, pi, playerCount);
      });

      if (spIdxs.length >= 2) {
        const localScores = applyResolutionToScores(scores, agg, players);

        const spMin  = subsetMin(cHcps, spIdxs, minCHcp, mode);
        const gb     = initBank(players);

        const { startHole: spStart, endHole: spEnd } = gameRange('Stroke Play');
        const { front: spFront, back: spBack } = splitRangeByMidpoint(spStart, spEnd);
        const spScores = trimScoresToRange(localScores, spStart, spEnd, playerCount);

        const payWinnerStroke = (segRows, segBet) => {
          const segDelta = {};
          players.forEach(p => (segDelta[p.name] = 0));
          if (segBet <= 0 || !segRows.length) return segDelta;
          const low = segRows[0].nd;
          const winners = segRows.filter(r => r.nd === low);
          const losers  = segRows.filter(r => r.nd !== low);
          if (losers.length > 0) {
            const pot   = losers.length * segBet;
            const split = pot / winners.length;
            winners.forEach(w => { gb[w.name] += split; segDelta[w.name] += split; });
            losers.forEach(l  => { gb[l.name] -= segBet; segDelta[l.name] -= segBet; });
          }
          return segDelta;
        };

        if (strokeMode === 'nassau' || strokeMode === 'segments') {
          const segScore = (holes) => {
            return spIdxs.map(pi => {
              const p = players[pi];
              let nd = 0;
              for (const h of holes) {
                const raw = localScores[h]?.[pi];
                if (raw === 'X' || raw === '' || raw == null) continue;
                const g = parseInt(raw);
                if (!g) continue;
                const net = scoreForMode(g, cHcps[pi], players[pi].siArray[h], spMin, mode);
                nd += net - pars[h];
              }
              return { name: p.name, nd };
            }).sort((a, b) => a.nd - b.nd);
          };
          const fDelta = payWinnerStroke(segScore(spFront), spBetF);
          const bDelta = payWinnerStroke(segScore(spBack),  spBetB);
          const rows18 = calcStrokePlay(spScores, players, pars, mode, cHcps, spMin, spIdxs);
          const oDelta = payWinnerStroke(rows18, spBet18);

          // 13-C.8: Apply per-segment Pay/Abandon decisions (zero out abandoned
          // segment contributions and reverse them in gb).
          const showSegPills = !!(agg.endAtK || agg.groupStop);
          const segDecisions = showSegPills ? [
            { key: 'front',   label: 'Front',   decision: decisionForSegment(agg, 'front'),   delta: fDelta },
            { key: 'back',    label: 'Back',    decision: decisionForSegment(agg, 'back'),    delta: bDelta },
            { key: 'overall', label: 'Overall', decision: decisionForSegment(agg, 'overall'), delta: oDelta },
          ] : null;

          if (segDecisions) {
            segDecisions.forEach(({ decision, delta }) => {
              if (decision === 'abandon') {
                Object.entries(delta).forEach(([n, v]) => { gb[n] -= v; delta[n] = 0; });
              }
            });
          }

          Object.entries(gb).forEach(([n, v]) => (bank[n] += v));
          breakdown.push({
            game: decorateHeader('🏌️ Stroke Play (Nassau)', agg, players,
              segDecisions ? segDecisions.map(s => ({ label: s.label, decision: s.decision })) : null),
            colHeaders: ['Front', 'Back', 'Total', 'Game Total'],
            rows: rows18.map(r => {
              const f = fDelta[r.name] || 0;
              const b = bDelta[r.name] || 0;
              const o = oDelta[r.name] || 0;
              return {
                name:      r.name,
                matchCols: [f, b, o, f + b + o],
                net:       gb[r.name] || 0,
              };
            }),
          });
        } else {
          const rows = calcStrokePlay(spScores, players, pars, mode, cHcps, spMin, spIdxs);
          if (bet > 0 && rows.length > 0) {
            const lowNd   = rows[0].nd;
            const winners = rows.filter(r => r.nd === lowNd);
            const losers  = rows.filter(r => r.nd !== lowNd);
            if (losers.length > 0) {
              const pot   = losers.length * bet;
              const split = pot / winners.length;
              winners.forEach(w => { gb[w.name] += split; });
              losers.forEach(l  => { gb[l.name] -= bet;   });
            }
          }
          Object.entries(gb).forEach(([n, v]) => (bank[n] += v));
          breakdown.push({
            game: decorateHeader('🏌️ Stroke Play', agg, players),
            rows: rows.map(r => ({
              name:   r.name,
              detail: `${r.gt} gross / ${r.nt} net (${r.nd > 0 ? '+' : ''}${r.nd})`,
              net:    gb[r.name] || 0,
            })),
          });
        }
      }
    }
  }

  // ── Skins ──────────────────────────────────────────────────────────────────
  if (activeGames.includes('Skins')) {
    const bet          = gameOpts.Skins?.bet || 0;
    const payoutMode   = gameOpts.Skins?.mode || 'perSkin';
    const scoringMode  = gameOpts.Skins?.grossNetNOL ?? gameOpts.Skins?.scoring ?? 'net';
    const carryover    = gameOpts.Skins?.carryover === false ? false : true;

    const agg = aggregateFor('Skins');
    if (agg.abandoned) {
      // Skip
    } else {
      let idxs = skinsPlayers?.length ? skinsPlayers : players.map((_, i) => i);
      agg.excludedPlayers.forEach(pi => {
        idxs = excludePlayerSubset(idxs, pi, playerCount);
      });

      if (idxs.length >= 2) {
        const skinPs       = idxs.map(i => players[i]).filter(Boolean);
        const subsetSize   = skinPs.length;
        const skinsMin     = subsetMin(cHcps, idxs, minCHcp, scoringMode);

        // 13-C.3: range; 13-C.8: cap at end_at_k / group-stop hole.
        // `continue` does NOT cap the range — remaining players keep playing.
        let { startHole: skStart, endHole: skEnd } = gameRange('Skins');
        if (agg.endAtK)    skEnd = Math.min(skEnd, agg.endAtK.hole);
        if (agg.groupStop) skEnd = Math.min(skEnd, agg.groupStop.hole);

        const localScores = applyResolutionToScores(scores, agg, players);

        // 13-C.8: Per-hole eligible subset under `continue`.
        const hasContinue = Object.keys(agg.continueByPlayer).length > 0;
        const eligibleIdxsForHole = (h) => {
          if (!hasContinue) return idxs;
          return idxs.filter(pi => {
            const cdh = agg.continueByPlayer[pi];
            if (cdh != null && h > cdh) return false;
            return true;
          });
        };

        // Hole-by-hole computation. Tracks totals + per-skin win records for
        // perSkin mode under `continue` (eligible-count-aware settlement).
        const totals = {};
        players.forEach(p => (totals[p.name] = 0));
        // skinWinEvents[]: { winnerName, value, eligible: number[] }
        const skinWinEvents = [];

        let carryCount = 0;
        for (let h = skStart; h <= skEnd; h++) {
          const eligible = eligibleIdxsForHole(h);
          if (eligible.length < 2) continue; // no skin possible, no carryover advance
          const result = calcSkinsHole(h, localScores, players, scoringMode, cHcps, skinsMin, eligible);
          if (!result) break; // missing scores within eligible subset
          if (result.tied) {
            carryCount++;
          } else {
            const value = carryover ? 1 + carryCount : 1;
            const winnerName = players[result.wiIdx].name;
            totals[winnerName] = (totals[winnerName] || 0) + value;
            skinWinEvents.push({ winnerName, winnerIdx: result.wiIdx, value, eligible: eligible.slice() });
            carryCount = 0;
          }
        }

        const gb = initBank(players);
        const totalAwardedSkins = skinPs.reduce((sum, p) => sum + (totals[p.name] || 0), 0);

        if (bet > 0) {
          if (payoutMode === 'perSkin') {
            if (hasContinue) {
              // Per-event settlement: each won skin pays bet × value from each
              // eligible loser at THAT hole to the winner.
              skinWinEvents.forEach(({ winnerIdx, winnerName, value, eligible }) => {
                eligible.forEach(pi => {
                  if (pi === winnerIdx) {
                    gb[winnerName] += (eligible.length - 1) * bet * value;
                  } else {
                    gb[players[pi].name] -= bet * value;
                  }
                });
              });
            } else {
              // Original full-subset settlement (non-continue).
              if (totalAwardedSkins > 0) {
                const skinValue = bet * subsetSize;
                const pp        = totalAwardedSkins * bet;
                skinPs.forEach(p => { gb[p.name] += (totals[p.name] || 0) * skinValue - pp; });
              }
            }
          } else {
            // pot mode: original subset paid in; pot split by skins won.
            if (totalAwardedSkins > 0) {
              const pot           = bet * subsetSize;
              const skinUnitValue = pot / totalAwardedSkins;
              skinPs.forEach(p => { gb[p.name] += (totals[p.name] || 0) * skinUnitValue - bet; });
            }
          }
        }

        Object.entries(gb).forEach(([n, v]) => (bank[n] += v));
        breakdown.push({
          game: decorateHeader('💰 Skins', agg, players),
          rows: skinPs.map(p => ({
            name:   p.name,
            detail: `${totals[p.name]} skins`,
            net:    gb[p.name] || 0,
          })).sort((a, b) => b.net - a.net),
        });
      }
    }
  }

  // ── Match / Nassau ─────────────────────────────────────────────────────────
  // 13-C.8: Per-match breakdown rows always (Option A). One breakdown entry
  // per match instance, keyed by matchDef.id. The combined '🥊 Match / Nassau'
  // header is no longer emitted.
  if (activeGames.includes('Match / Nassau') && matches.length > 0) {
    matches.forEach((matchDef, mi) => {
      const matchKey = matchDef.id || `match_${mi}`;
      const agg = aggregateFor(matchKey);

      if (agg.abandoned) return; // Skip this match — no breakdown, no bank contribution.

      const manuPresses = {
        front:   manualPresses[`Match:${matchKey}:Front`]   || [],
        back:    manualPresses[`Match:${matchKey}:Back`]    || [],
        overall: manualPresses[`Match:${matchKey}:Overall`] || [],
      };

      const isTeam = matchDef.format === 'team';
      const sideA  = isTeam ? (matchDef.teamA || []) : [matchDef.p1];
      const sideB  = isTeam ? (matchDef.teamB || []) : [matchDef.p2];
      const involved = [...sideA, ...sideB].filter(i => players[i]);
      const matchMode = matchDef.grossNetNOL ?? matchDef.scoring ?? 'net';
      const matchMin  = subsetMin(cHcps, involved, minCHcp, matchMode);

      const matchRange  = gameRange(matchKey);
      const localScores = applyResolutionToScores(scores, agg, players);

      const { front, back, overall } = runMatchNassau(
        localScores, players, matchDef, cHcps, matchMin, manuPresses,
        matchRange
      );

      const betF = matchDef.betFront   || 0;
      const betB = matchDef.betBack    || 0;
      const betO = matchDef.betOverall || 0;
      const matchSidesLabel = matchLabel(matchDef, players);
      const isNassau = isNassauMatch(matchDef);
      const matchLetter = String.fromCharCode(65 + mi);
      const baseLbl = `🥊 Match ${matchLetter}`;

      const gb = initBank(players);
      const playerDetails = {};
      players.forEach(p => (playerDetails[p.name] = []));

      const netF = {}, netB = {}, netO = {};
      players.forEach(p => { netF[p.name] = 0; netB[p.name] = 0; netO[p.name] = 0; });

      const applyMatchBet = (m, betAmt, deltaMap) => {
        if (betAmt <= 0 || m.thru <= 0 || m.lead === 0) return;
        if (!isTeam) {
          const wi = m.lead > 0 ? matchDef.p1 : matchDef.p2;
          const li = m.lead > 0 ? matchDef.p2 : matchDef.p1;
          if (players[wi] && players[li]) {
            deltaMap[players[wi].name] += betAmt;
            deltaMap[players[li].name] -= betAmt;
          }
        } else {
          const winSide = m.lead > 0 ? sideA : sideB;
          const losSide = m.lead > 0 ? sideB : sideA;
          winSide.forEach(wi => { if (players[wi]) deltaMap[players[wi].name] += betAmt; });
          losSide.forEach(li => { if (players[li]) deltaMap[players[li].name] -= betAmt; });
        }
      };

      const segments = [
        { bets: front,   betAmt: betF, segKey: 'front',   delta: netF, segLabel: 'Front',   pressList: manuPresses.front   },
        { bets: back,    betAmt: betB, segKey: 'back',    delta: netB, segLabel: 'Back',    pressList: manuPresses.back    },
        { bets: overall, betAmt: betO, segKey: 'overall', delta: netO, segLabel: isNassau ? 'Overall' : 'Main', pressList: manuPresses.overall },
      ];

      segments.forEach(({ bets, betAmt, segKey, delta, segLabel, pressList }) => {
        // playerDetails captured for ALL bets (status text on Results page).
        bets.forEach(m => {
          if (m.thru > 0) {
            involved.forEach(pi => {
              if (players[pi]) {
                const tag = `${segLabel}${bets.length > 1 ? ` (${m.label})` : ''}`;
                playerDetails[players[pi].name].push(`${tag}: ${m.status}`);
              }
            });
          }
        });

        // Main bet (index 0): segment-level decision.
        const segDecision = decisionForSegment(agg, segKey);
        if (segDecision === 'pay') {
          applyMatchBet(bets[0], betAmt, delta);
        }

        // Press bets — each independent. Trigger hole = pressList[depth-1].
        for (let depth = 1; depth < bets.length; depth++) {
          const triggerHole = pressList[depth - 1];
          const pressDecision = (typeof triggerHole === 'number')
            ? decisionForPress(agg, triggerHole)
            : 'pay';
          if (pressDecision === 'pay') {
            applyMatchBet(bets[depth], betAmt, delta);
          }
        }
      });

      players.forEach(p => {
        gb[p.name] = (netF[p.name] || 0) + (netB[p.name] || 0) + (netO[p.name] || 0);
      });
      Object.entries(gb).forEach(([n, v]) => (bank[n] += v));

      const showSegPills = !!(agg.endAtK || agg.groupStop);
      const segDecisions = showSegPills ? segments.map(s => ({
        label:    s.segLabel,
        decision: decisionForSegment(agg, s.segKey),
      })) : null;

      breakdown.push({
        game: decorateHeader(`${baseLbl} (${matchSidesLabel})`, agg, players, segDecisions),
        colHeaders: ['Front', 'Back', 'Total', 'Game Total'],
        rows: involved.map(pi => {
          const nm = players[pi]?.name;
          if (!nm) return null;
          const f = netF[nm] || 0;
          const b = netB[nm] || 0;
          const o = netO[nm] || 0;
          return {
            name:      nm,
            matchCols: [f, b, o, f + b + o],
            net:       f + b + o,
            detail:    playerDetails[nm]?.join(' · ') || '—',
          };
        }).filter(r => r).sort((a, b) => b.net - a.net),
      });
    });
  }

  // ── Stableford ─────────────────────────────────────────────────────────────
  if (activeGames.includes('Stableford')) {
    const bet         = gameOpts.Stableford?.bet || 0;
    const mode        = gameOpts.Stableford?.grossNetNOL ?? 'net';
    const stabBetMode = gameOpts.Stableford?.betMode ?? gameOpts.Stableford?.stabBetMode ?? 'perpoint';
    const stabTable   = gameOpts.Stableford?.stabTable ?? null;
    const format      = gameOpts.Stableford?.format ?? 'individual';
    const teamA       = gameOpts.Stableford?.teamA ?? [];
    const teamB       = gameOpts.Stableford?.teamB ?? [];
    const scoring     = gameOpts.Stableford?.scoring ?? 'cumulative';

    const agg = aggregateFor('Stableford');
    if (agg.abandoned) {
      // Skip
    } else {
      const stabBetF  = gameOpts.Stableford?.betF  || bet;
      const stabBetB  = gameOpts.Stableford?.betB  || bet;
      const stabBet18 = gameOpts.Stableford?.bet18 || bet;

      const { startHole: stabStart, endHole: stabEnd } = gameRange('Stableford');
      const { front: stabFront, back: stabBack, all: stabAll } = splitRangeByMidpoint(stabStart, stabEnd);
      const stabRange = { startHole: stabStart, endHole: stabEnd };

      const localScores = applyResolutionToScores(scores, agg, players);
      const gb = initBank(players);

      if (format === 'team' && teamA.length === 2 && teamB.length === 2) {
        // ── Team mode (Match-family — exclude_player not allowed) ──────────
        const teamIdxs = [...teamA, ...teamB];
        const stabMin  = subsetMin(cHcps, teamIdxs, minCHcp, mode);

        const teamTots = (idxs) =>
          calcTeamStablefordTotal(localScores, players, pars, cHcps, stabMin, mode, stabTable, idxs, scoring, stabAll, stabRange);

        const payTeamSeg = (totA, totB, segBet) => {
          const segDelta = {};
          [...teamA, ...teamB].forEach(pi => (segDelta[players[pi].name] = 0));
          if (segBet <= 0 || totA === totB) return segDelta;
          const [winners, losers] = totA > totB ? [teamA, teamB] : [teamB, teamA];
          winners.forEach(pi => { gb[players[pi].name] += segBet; segDelta[players[pi].name] += segBet; });
          losers.forEach(pi  => { gb[players[pi].name] -= segBet; segDelta[players[pi].name] -= segBet; });
          return segDelta;
        };

        if (stabBetMode === 'perpoint') {
          const rA = teamTots(teamA);
          const rB = teamTots(teamB);
          const diff = Math.abs(rA.pts - rB.pts);
          if (bet > 0 && diff > 0) {
            const perPlayer = diff * bet;
            const [winners, losers] = rA.pts > rB.pts ? [teamA, teamB] : [teamB, teamA];
            winners.forEach(pi => { gb[players[pi].name] += perPlayer; });
            losers.forEach(pi  => { gb[players[pi].name] -= perPlayer; });
          }
          Object.entries(gb).forEach(([n, v]) => (bank[n] += v));
          const allTeamPis = [...teamA, ...teamB];
          breakdown.push({
            game: decorateHeader('Stableford', agg, players),
            rows: allTeamPis
              .map(pi => ({ name: players[pi].name, detail: `${teamA.includes(pi) ? rA.pts : rB.pts} pts`, net: gb[players[pi].name] || 0 }))
              .sort((a, b) => b.net - a.net),
          });
        } else if (stabBetMode === 'segments') {
          const rA = teamTots(teamA);
          const rB = teamTots(teamB);
          const fDelta = payTeamSeg(rA.ptsF, rB.ptsF, stabBetF);
          const bDelta = payTeamSeg(rA.ptsB, rB.ptsB, stabBetB);
          const oDelta = payTeamSeg(rA.pts,  rB.pts,  stabBet18);

          const showSegPills = !!(agg.endAtK || agg.groupStop);
          const segDecisions = showSegPills ? [
            { key: 'front',   label: 'Front',   decision: decisionForSegment(agg, 'front'),   delta: fDelta },
            { key: 'back',    label: 'Back',    decision: decisionForSegment(agg, 'back'),    delta: bDelta },
            { key: 'overall', label: 'Overall', decision: decisionForSegment(agg, 'overall'), delta: oDelta },
          ] : null;

          if (segDecisions) {
            segDecisions.forEach(({ decision, delta }) => {
              if (decision === 'abandon') {
                Object.entries(delta).forEach(([n, v]) => { gb[n] -= v; delta[n] = 0; });
              }
            });
          }

          Object.entries(gb).forEach(([n, v]) => (bank[n] += v));
          const allTeamPis = [...teamA, ...teamB];
          breakdown.push({
            game: decorateHeader('Stableford', agg, players,
              segDecisions ? segDecisions.map(s => ({ label: s.label, decision: s.decision })) : null),
            colHeaders: ['Front', 'Back', 'Total', 'Game Total'],
            rows: allTeamPis.map(pi => {
              const nm = players[pi].name;
              const f  = fDelta[nm] || 0;
              const b  = bDelta[nm] || 0;
              const o  = oDelta[nm] || 0;
              return {
                name:      nm,
                matchCols: [f, b, o, f + b + o],
                net:       gb[nm] || 0,
              };
            }),
          });
        } else {
          const rA = teamTots(teamA);
          const rB = teamTots(teamB);
          if (bet > 0) payTeamSeg(rA.pts, rB.pts, bet);
          Object.entries(gb).forEach(([n, v]) => (bank[n] += v));
          const allTeamPis = [...teamA, ...teamB];
          breakdown.push({
            game: decorateHeader('Stableford', agg, players),
            rows: allTeamPis
              .map(pi => ({ name: players[pi].name, detail: `${teamA.includes(pi) ? rA.pts : rB.pts} pts`, net: gb[players[pi].name] || 0 }))
              .sort((a, b) => b.net - a.net),
          });
        }
      } else {
        // ── Individual mode (Pool-family — exclude_player allowed) ─────────
        let stabIdxs = stablefordPlayers?.length ? stablefordPlayers : players.map((_, i) => i);
        agg.excludedPlayers.forEach(pi => {
          stabIdxs = excludePlayerSubset(stabIdxs, pi, playerCount);
        });

        if (stabIdxs.length >= 2) {
          const stabMin = subsetMin(cHcps, stabIdxs, minCHcp, mode);

          const stabScore = (pi, holes) =>
            calcStablefordTotal(localScores, pi, pars, players[pi].siArray, cHcps[pi], stabMin, mode, stabTable, holes);

          const paySegStab = (arr, field, segBet) => {
            const segDelta = {};
            arr.forEach(r => (segDelta[r.name] = 0));
            if (segBet <= 0) return segDelta;
            const maxVal  = Math.max(...arr.map(r => r[field]));
            const winners = arr.filter(r => r[field] === maxVal);
            const losers  = arr.filter(r => r[field] < maxVal);
            if (losers.length === 0) return segDelta;
            const share = (losers.length * segBet) / winners.length;
            losers.forEach(r  => { gb[r.name] -= segBet; segDelta[r.name] -= segBet; });
            winners.forEach(r => { gb[r.name] += share;  segDelta[r.name] += share; });
            return segDelta;
          };

          if (stabBetMode === 'perpoint' && bet > 0) {
            const ranked = stabIdxs
              .map(pi => ({ name: players[pi].name, pts: stabScore(pi, stabAll) }))
              .sort((a, b) => b.pts - a.pts);
            for (let i = 0; i < ranked.length; i++)
              for (let j = i + 1; j < ranked.length; j++) {
                const diff = ranked[i].pts - ranked[j].pts;
                if (diff > 0) { gb[ranked[i].name] += diff * bet; gb[ranked[j].name] -= diff * bet; }
              }
            Object.entries(gb).forEach(([n, v]) => (bank[n] += v));
            breakdown.push({
              game: decorateHeader('Stableford', agg, players),
              rows: ranked.map(r => ({ name: r.name, detail: `${r.pts} pts`, net: gb[r.name] || 0 })),
            });
          } else if (stabBetMode === 'nassau' || stabBetMode === 'segments') {
            const pts18 = stabIdxs.map(pi => ({
              name: players[pi].name,
              pts:  stabScore(pi, stabAll),
              ptsF: stabScore(pi, stabFront),
              ptsB: stabScore(pi, stabBack),
            }));
            const fDelta = paySegStab(pts18, 'ptsF', stabBetF);
            const bDelta = paySegStab(pts18, 'ptsB', stabBetB);
            const oDelta = paySegStab(pts18, 'pts',  stabBet18);

            const showSegPills = !!(agg.endAtK || agg.groupStop);
            const segDecisions = showSegPills ? [
              { key: 'front',   label: 'Front',   decision: decisionForSegment(agg, 'front'),   delta: fDelta },
              { key: 'back',    label: 'Back',    decision: decisionForSegment(agg, 'back'),    delta: bDelta },
              { key: 'overall', label: 'Overall', decision: decisionForSegment(agg, 'overall'), delta: oDelta },
            ] : null;

            if (segDecisions) {
              segDecisions.forEach(({ decision, delta }) => {
                if (decision === 'abandon') {
                  Object.entries(delta).forEach(([n, v]) => { gb[n] -= v; delta[n] = 0; });
                }
              });
            }

            Object.entries(gb).forEach(([n, v]) => (bank[n] += v));
            breakdown.push({
              game: decorateHeader('Stableford', agg, players,
                segDecisions ? segDecisions.map(s => ({ label: s.label, decision: s.decision })) : null),
              colHeaders: ['Front', 'Back', 'Total', 'Game Total'],
              rows: pts18.map(r => {
                const f = fDelta[r.name] || 0;
                const b = bDelta[r.name] || 0;
                const o = oDelta[r.name] || 0;
                return {
                  name:      r.name,
                  matchCols: [f, b, o, f + b + o],
                  net:       gb[r.name] || 0,
                };
              }),
            });
          } else {
            const pts18 = stabIdxs
              .map(pi => ({ name: players[pi].name, pts: stabScore(pi, stabAll) }))
              .sort((a, b) => b.pts - a.pts);
            if (bet > 0) {
              const maxPts  = pts18[0]?.pts ?? 0;
              const winners = pts18.filter(r => r.pts === maxPts);
              const losers  = pts18.filter(r => r.pts < maxPts);
              if (losers.length > 0) {
                const share = (losers.length * bet) / winners.length;
                losers.forEach(r  => { gb[r.name] -= bet; });
                winners.forEach(r => { gb[r.name] += share; });
              }
            }
            Object.entries(gb).forEach(([n, v]) => (bank[n] += v));
            breakdown.push({
              game: decorateHeader('Stableford', agg, players),
              rows: pts18.map(r => ({ name: r.name, detail: `${r.pts} pts`, net: gb[r.name] || 0 })),
            });
          }
        }
      }
    }
  }

  // ── Nines ──────────────────────────────────────────────────────────────────
  if (activeGames.includes('Nines')) {
    const bet       = gameOpts.Nines?.bet || 0;
    const mode      = gameOpts.Nines?.grossNetNOL ?? gameOpts.Nines?.scoring ?? 'net';
    const ninesMode = gameOpts.Nines?.betMode ?? gameOpts.Nines?.ninesMode ?? 'perpoint';
    const blitz     = gameOpts.Nines?.blitz || false;

    const agg = aggregateFor('Nines');
    if (agg.abandoned) {
      // Skip
    } else {
      const ninesBetF  = gameOpts.Nines?.betF  ?? bet;
      const ninesBetB  = gameOpts.Nines?.betB  ?? bet;
      const ninesBet18 = gameOpts.Nines?.bet18 ?? bet;

      const nPlayerIdx = ninesPlayers?.length === 3
        ? ninesPlayers
        : (gameOpts.Nines?.ninesPlayers?.length === 3
            ? gameOpts.Nines.ninesPlayers
            : players.length === 3
                ? [0, 1, 2]
                : null);

      const nPlayers = nPlayerIdx ? nPlayerIdx.map(i => players[i]).filter(Boolean) : [];

      if (nPlayers.length >= 3) {
        const gb = initBank(players);
        const ninesMin = subsetMin(cHcps, nPlayerIdx, minCHcp, mode);

        const { startHole: ninesStart, endHole: ninesEnd } = gameRange('Nines');
        const { front: ninesFront, back: ninesBack, all: ninesAll } = splitRangeByMidpoint(ninesStart, ninesEnd);

        const localScores = applyResolutionToScores(scores, agg, players);

        const calcTots = (holes) => {
          const { totals } = calcNines(localScores, players, nPlayerIdx, mode, blitz, holes, cHcps, ninesMin);
          return nPlayers.map((p, i) => ({ name: p.name, pts: totals[i] }));
        };

        const payRanked = (ranked, rate) => {
          for (let i = 0; i < ranked.length; i++)
            for (let j = i + 1; j < ranked.length; j++) {
              const diff = ranked[i].pts - ranked[j].pts;
              if (diff > 0 && rate > 0) {
                gb[ranked[i].name] += diff * rate;
                gb[ranked[j].name] -= diff * rate;
              }
            }
        };

        const payNassauSeg = (ranked, segBet) => {
          const segDelta = {};
          ranked.forEach(r => (segDelta[r.name] = 0));
          if (segBet <= 0) return segDelta;
          for (let i = 0; i < ranked.length; i++)
            for (let j = i + 1; j < ranked.length; j++)
              if (ranked[i].pts > ranked[j].pts) {
                gb[ranked[i].name] += segBet; segDelta[ranked[i].name] += segBet;
                gb[ranked[j].name] -= segBet; segDelta[ranked[j].name] -= segBet;
              }
          return segDelta;
        };

        if (ninesMode === 'perpoint') {
          const ranked = calcTots(ninesAll).sort((a, b) => b.pts - a.pts);
          if (bet > 0) payRanked(ranked, bet);
          Object.entries(gb).forEach(([n, v]) => (bank[n] += v));
          breakdown.push({
            game: decorateHeader('🔢 Nines', agg, players),
            rows: ranked.map(r => ({ name: r.name, detail: `${r.pts} pts`, net: gb[r.name] || 0 })),
          });
        } else {
          const f9 = calcTots(ninesFront).sort((a, b) => b.pts - a.pts);
          const b9 = calcTots(ninesBack).sort((a, b) => b.pts - a.pts);
          const ov = calcTots(ninesAll).sort((a, b) => b.pts - a.pts);
          const fDelta = payNassauSeg(f9, ninesBetF);
          const bDelta = payNassauSeg(b9, ninesBetB);
          const oDelta = payNassauSeg(ov, ninesBet18);

          const showSegPills = !!(agg.endAtK || agg.groupStop);
          const segDecisions = showSegPills ? [
            { key: 'front',   label: 'Front',   decision: decisionForSegment(agg, 'front'),   delta: fDelta },
            { key: 'back',    label: 'Back',    decision: decisionForSegment(agg, 'back'),    delta: bDelta },
            { key: 'overall', label: 'Overall', decision: decisionForSegment(agg, 'overall'), delta: oDelta },
          ] : null;

          if (segDecisions) {
            segDecisions.forEach(({ decision, delta }) => {
              if (decision === 'abandon') {
                Object.entries(delta).forEach(([n, v]) => { gb[n] -= v; delta[n] = 0; });
              }
            });
          }

          Object.entries(gb).forEach(([n, v]) => (bank[n] += v));
          breakdown.push({
            game: decorateHeader('🔢 Nines (Nassau)', agg, players,
              segDecisions ? segDecisions.map(s => ({ label: s.label, decision: s.decision })) : null),
            colHeaders: ['Front', 'Back', 'Total', 'Game Total'],
            rows: nPlayers.map(p => {
              const f = fDelta[p.name] || 0;
              const b = bDelta[p.name] || 0;
              const o = oDelta[p.name] || 0;
              return {
                name:      p.name,
                matchCols: [f, b, o, f + b + o],
                net:       gb[p.name] || 0,
              };
            }),
          });
        }
      }
    }
  }

  // ── Sixes ──────────────────────────────────────────────────────────────────
  if (activeGames.includes('Sixes') && sixesTeams?.[0]?.a != null && sixesTeams?.[1]?.a != null) {
    const bet      = gameOpts.Sixes?.bet || 0;
    const mode     = gameOpts.Sixes?.grossNetNOL ?? gameOpts.Sixes?.scoring ?? 'net';
    const tiebreak = gameOpts.Sixes?.scoring ?? gameOpts.Sixes?.tiebreak ?? 'none';

    const agg = aggregateFor('Sixes');
    if (agg.abandoned) {
      // Skip
    } else {
      const gb = initBank(players);
      // 13-C.8.1: track per-segment gb so the breakdown can render
      // Front 6 / Middle 6 / Last 6 / Game Total columns. Each segment's
      // contributions to gb are also added to gbSeg[si] so the columnar
      // display reflects exactly where each player's net came from.
      const gbSeg = [initBank(players), initBank(players), initBank(players)];

      const autoN = (gameOpts.Sixes?.autoPress && gameOpts.Sixes?.autoPress !== 'none')
        ? parseInt(gameOpts.Sixes?.autoPress)
        : 0;

      const { startHole: sxStart, endHole: sxEnd } = gameRange('Sixes');
      const sxLen    = sxEnd - sxStart + 1;
      const segLen   = Math.floor(sxLen / 3);

      const SEG_HOLES = [
        Array.from({ length: segLen }, (_, i) => sxStart + i),
        Array.from({ length: segLen }, (_, i) => sxStart + segLen + i),
        Array.from({ length: segLen }, (_, i) => sxStart + 2 * segLen + i),
      ];
      const SEG_KEYS      = ['Sixes:seg0', 'Sixes:seg1', 'Sixes:seg2'];
      const SEG_PILL_KEYS = ['seg0', 'seg1', 'seg2'];

      const localScores = applyResolutionToScores(scores, agg, players);

      // Track per-segment decision for header decoration.
      const segDecisionsList = [];

      SEG_HOLES.forEach((holes, si) => {
        const team = getSixesTeam(si, sixesTeams, players);
        if (!team) return;

        const mpHoles = manualPresses[SEG_KEYS[si]] || [];

        const { a, b } = team;
        const others = players.map((_, i) => i).filter(i => i !== a && i !== b);
        const segIdxs = sixesPlayers.length
          ? sixesPlayers
          : [a, b, ...others.slice(0, 2)];
        const segMin = subsetMin(cHcps, segIdxs, minCHcp, mode);

        const matchLevels = runSixesSegment(
          holes, localScores, players,
          team, mode, tiebreak,
          cHcps, segMin,
          autoN, mpHoles
        );
        if (!matchLevels) return;

        const [c, d] = others;

        const segDecision = decisionForSegment(agg, SEG_PILL_KEYS[si]);
        segDecisionsList.push({ label: sixesSegLabel(si, segLen), decision: segDecision });

        matchLevels.forEach((m, mi) => {
          if (bet <= 0 || !m.winTeam || m.thru <= 0) return;

          let decision;
          if (mi === 0) {
            decision = segDecision; // Main bet — segment-level decision.
          } else {
            // Press bet — per-press decision keyed by trigger hole.
            const triggerHole = mpHoles[mi - 1];
            decision = (typeof triggerHole === 'number')
              ? decisionForPress(agg, triggerHole)
              : 'pay';
          }

          if (decision === 'abandon') return;

          const ws = m.winTeam === 'ab' ? [a, b] : [c, d];
          const ls = m.winTeam === 'ab' ? [c, d] : [a, b];
          ws.forEach(wi => {
            gb[players[wi].name]            += bet;
            gbSeg[si][players[wi].name]     += bet;
          });
          ls.forEach(li => {
            gb[players[li].name]            -= bet;
            gbSeg[si][players[li].name]     -= bet;
          });
        });
      });

      Object.entries(gb).forEach(([n, v]) => (bank[n] += v));
      // 13-C.8.1: columnar breakdown — Front 6 / Middle 6 / Last 6 / Game Total.
      // Labels use sixesSegLabel(si, segLen) so partial-range Sixes (e.g. 12
      // holes → 4-hole segments → "Front 4 / Middle 4 / Last 4") render correctly.
      const seg0Lbl = sixesSegLabel(0, segLen);
      const seg1Lbl = sixesSegLabel(1, segLen);
      const seg2Lbl = sixesSegLabel(2, segLen);
      breakdown.push({
        game: decorateHeader('Sixes', agg, players,
          (agg.endAtK || agg.groupStop) ? segDecisionsList : null),
        colHeaders: [seg0Lbl, seg1Lbl, seg2Lbl, 'Game Total'],
        rows: players.map(p => {
          const s0 = gbSeg[0][p.name] || 0;
          const s1 = gbSeg[1][p.name] || 0;
          const s2 = gbSeg[2][p.name] || 0;
          const total = gb[p.name] || 0;
          return {
            name:      p.name,
            detail:    '',
            net:       total,
            matchCols: [s0, s1, s2, total],
          };
        }).sort((a, b) => b.net - a.net),
      });
    }
  }

  // ── Dots ───────────────────────────────────────────────────────────────────
  // Formerly "Specials" — renamed in v2.0.
  // 13-C.8: For team Dots locked to a parent team game (Sixes / team Match),
  // a `continue` Dots resolution is silently treated as the parent's resolution
  // when the parent ended (end_at_k or abandon). The parent's end-hole caps
  // the Dots range. Convert-to-individual after parent ends is deferred (BP D-15).
  // Departed players' post-departure dot entries (including companion entries
  // where the earner has departed) are filtered upstream by the engine guardrail.
  const dotsGameActive = activeGames.includes('Dots') || activeGames.includes('Specials');
  if (dotsGameActive) {
    const dotsKey = activeGames.includes('Dots') ? 'Dots' : 'Specials';
    const agg = aggregateFor(dotsKey);

    if (agg.abandoned) {
      // Skip
    } else {
      const dotsOpts = gameOpts.Dots || gameOpts.Specials || {};
      const dolPt    = dotsOpts.bet || 0;
      const ens      = (dots || []).filter(s => s.enabled);
      const gb       = initBank(players);

      const entryCount = v => typeof v === 'number' ? v : (v === true ? 1 : 0);

      const rawTeamMode = dotsOpts.teamMode;
      const legacyTeam  = dotsOpts.teamScoring;
      const isTeamMode  = rawTeamMode ? rawTeamMode !== 'none' : !!legacyTeam;
      const teamSource  = rawTeamMode && rawTeamMode !== 'none'
        ? rawTeamMode
        : (legacyTeam ? 'Sixes' : 'none');

      // Build subset (with exclude_player applied — individual mode only).
      let dtIdxs = dotsPlayers?.length ? dotsPlayers : players.map((_, i) => i);
      if (!isTeamMode) {
        agg.excludedPlayers.forEach(pi => {
          dtIdxs = excludePlayerSubset(dtIdxs, pi, playerCount);
        });
      }
      const dtPlayers = dtIdxs.map(i => players[i]).filter(Boolean);

      // 13-C.8: Team Dots → check parent team game's resolution.
      // Parent abandoned → Dots also abandons (skip block).
      let parentAbandoned = false;
      let parentEndCap    = null;
      if (isTeamMode && teamSource === 'Sixes') {
        const sixesAgg = aggregateFor('Sixes');
        if (sixesAgg.abandoned) parentAbandoned = true;
        else {
          if (sixesAgg.endAtK)    parentEndCap = sixesAgg.endAtK.hole;
          if (sixesAgg.groupStop) parentEndCap = parentEndCap == null
            ? sixesAgg.groupStop.hole
            : Math.min(parentEndCap, sixesAgg.groupStop.hole);
        }
      } else if (isTeamMode && teamSource.startsWith('Match:')) {
        const matchKey = teamSource.slice(6);
        const matchAgg = aggregateFor(matchKey);
        if (matchAgg.abandoned) parentAbandoned = true;
        else {
          if (matchAgg.endAtK)    parentEndCap = matchAgg.endAtK.hole;
          if (matchAgg.groupStop) parentEndCap = parentEndCap == null
            ? matchAgg.groupStop.hole
            : Math.min(parentEndCap, matchAgg.groupStop.hole);
        }
      }

      if (!parentAbandoned && dtPlayers.length >= 2) {
        // Resolve Dots range. Team Dots is locked to its parent's range.
        let dotsStart, dotsEnd;
        if (isTeamMode && teamSource === 'Sixes') {
          ({ startHole: dotsStart, endHole: dotsEnd } = gameRange('Sixes'));
        } else if (isTeamMode && teamSource.startsWith('Match:')) {
          ({ startHole: dotsStart, endHole: dotsEnd } = gameRange(teamSource.slice(6)));
        } else {
          ({ startHole: dotsStart, endHole: dotsEnd } = gameRange(dotsKey));
        }

        // 13-C.8: cap at end_at_k / group-stop hole (own resolution + parent).
        if (agg.endAtK)    dotsEnd = Math.min(dotsEnd, agg.endAtK.hole);
        if (agg.groupStop) dotsEnd = Math.min(dotsEnd, agg.groupStop.hole);
        if (parentEndCap != null) dotsEnd = Math.min(dotsEnd, parentEndCap);

        const inDotsRange = (h) => h >= dotsStart && h <= dotsEnd;

        // ── indivDots accumulation ─────────────────────────────────────────
        const indivDots = players.map(() => 0);
        Object.entries(dotEntries || {}).forEach(([key, v]) => {
          const cnt = entryCount(v);
          if (!cnt) return;
          const parts = key.split('_');
          if (parts[2] === 'team' && parts.length > 3) return; // skip companions
          const h     = parseInt(parts[0]);
          if (!inDotsRange(h)) return;
          const pi    = parseInt(parts[1]);
          const id    = parts.slice(2).join('_');
          const sp    = ens.find(s => s.id === id);
          if (sp && players[pi]) indivDots[pi] += (sp.value ?? sp.pts ?? 1) * cnt;
        });

        // ── Pairwise settlement — team-aware ───────────────────────────────
        if (isTeamMode && teamSource === 'Sixes') {
          const sxLen = dotsEnd - dotsStart + 1;
          const segLen = Math.floor(sxLen / 3);
          const SIXES_SEG_HOLES = [
            Array.from({ length: segLen }, (_, i) => dotsStart + i),
            Array.from({ length: segLen }, (_, i) => dotsStart + segLen + i),
            Array.from({ length: segLen }, (_, i) => dotsStart + 2 * segLen + i),
          ];
          const segForHole = (h) => {
            for (let s = 0; s < 3; s++) if (SIXES_SEG_HOLES[s].includes(h)) return s;
            return -1;
          };

          const segDots = players.map(() => [0, 0, 0]);
          Object.entries(dotEntries || {}).forEach(([key, v]) => {
            const cnt = entryCount(v); if (!cnt) return;
            const parts = key.split('_');
            if (parts[2] === 'team' && parts.length > 3) return;
            const h     = parseInt(parts[0]);
            const seg   = segForHole(h);
            if (seg < 0) return;
            const pi    = parseInt(parts[1]);
            const sp    = ens.find(s => s.id === parts.slice(2).join('_'));
            if (!sp || !players[pi]) return;
            segDots[pi][seg] += (sp.value ?? sp.pts ?? 1) * cnt;
          });

          const gbSeg = [initBank(players), initBank(players), initBank(players)];

          if (dolPt > 0) {
            for (let seg = 0; seg < 3; seg++) {
              const p0 = dtIdxs[0];
              const p0partner = getDotsPartner(p0, seg, sixesTeams, players);
              if (p0partner < 0) continue;
              const teamA = [p0, p0partner].filter(pi => dtIdxs.includes(pi));
              const teamB = dtIdxs.filter(pi => !teamA.includes(pi));
              if (!teamA.length || !teamB.length) continue;

              const totA = teamA.reduce((s, pi) => s + segDots[pi][seg], 0);
              const totB = teamB.reduce((s, pi) => s + segDots[pi][seg], 0);
              const diff = totA - totB;

              if (diff > 0) {
                teamA.forEach(pi => {
                  gb[players[pi].name]         += diff * dolPt;
                  gbSeg[seg][players[pi].name] += diff * dolPt;
                });
                teamB.forEach(pi => {
                  gb[players[pi].name]         -= diff * dolPt;
                  gbSeg[seg][players[pi].name] -= diff * dolPt;
                });
              } else if (diff < 0) {
                teamB.forEach(pi => {
                  gb[players[pi].name]         += (-diff) * dolPt;
                  gbSeg[seg][players[pi].name] += (-diff) * dolPt;
                });
                teamA.forEach(pi => {
                  gb[players[pi].name]         -= (-diff) * dolPt;
                  gbSeg[seg][players[pi].name] -= (-diff) * dolPt;
                });
              }
            }
          }

          Object.entries(gb).forEach(([n, v]) => (bank[n] += v));
          breakdown.push({
            game: decorateHeader('🏅 Dots', agg, players),
            colHeaders: ['Match A', 'Match B', 'Match C', 'Total'],
            rows: dtPlayers.map((p, ii) => {
              const pi = dtIdxs[ii];
              return {
                name:      p.name,
                detail:    '',
                net:       gb[p.name] || 0,
                matchCols: [
                  gbSeg[0][p.name] || 0,
                  gbSeg[1][p.name] || 0,
                  gbSeg[2][p.name] || 0,
                  gb[p.name] || 0,
                ],
              };
            }).sort((a, b) => b.net - a.net),
          });

        } else if (isTeamMode && teamSource.startsWith('Match:')) {
          const matchId   = teamSource.slice(6);
          const teamMatch = matches.find(m => m.id === matchId) || matches.find(m => m.format === 'team');
          const tA = (teamMatch?.teamA || []).filter(pi => dtIdxs.includes(pi));
          const tB = (teamMatch?.teamB || []).filter(pi => dtIdxs.includes(pi));

          if (dolPt > 0 && tA.length && tB.length) {
            const ownDots = players.map(() => 0);
            Object.entries(dotEntries || {}).forEach(([key, v]) => {
              const cnt = entryCount(v); if (!cnt) return;
              const parts = key.split('_');
              if (parts[2] === 'team' && parts.length > 3) return;
              const h  = parseInt(parts[0]);
              if (!inDotsRange(h)) return;
              const pi = parseInt(parts[1]);
              const sp = ens.find(s => s.id === parts.slice(2).join('_'));
              if (sp && players[pi]) ownDots[pi] += (sp.value ?? sp.pts ?? 1) * cnt;
            });

            const totA = tA.reduce((s, pi) => s + ownDots[pi], 0);
            const totB = tB.reduce((s, pi) => s + ownDots[pi], 0);
            const diff = totA - totB;
            if (diff > 0) {
              tA.forEach(pi => { gb[players[pi].name] += diff * dolPt; });
              tB.forEach(pi => { gb[players[pi].name] -= diff * dolPt; });
            } else if (diff < 0) {
              tB.forEach(pi => { gb[players[pi].name] += (-diff) * dolPt; });
              tA.forEach(pi => { gb[players[pi].name] -= (-diff) * dolPt; });
            }
          }

          Object.entries(gb).forEach(([n, v]) => (bank[n] += v));
          breakdown.push({
            game: decorateHeader('🏅 Dots', agg, players),
            colHeaders: ['Match', 'Total'],
            rows: dtPlayers.map((p, ii) => {
              const net = gb[p.name] || 0;
              return {
                name:      p.name,
                detail:    '',
                net,
                matchCols: [net, net],
              };
            }).sort((a, b) => b.net - a.net),
          });

        } else {
          // Individual mode — pairwise loop
          if (dolPt > 0) {
            for (let ii = 0; ii < dtIdxs.length; ii++) {
              for (let jj = ii + 1; jj < dtIdxs.length; jj++) {
                const ei = dtIdxs[ii], ej = dtIdxs[jj];
                if (!players[ei] || !players[ej]) continue;
                const diff = indivDots[ei] - indivDots[ej];
                if (diff > 0) {
                  gb[players[ei].name] += diff * dolPt;
                  gb[players[ej].name] -= diff * dolPt;
                } else if (diff < 0) {
                  gb[players[ej].name] += (-diff) * dolPt;
                  gb[players[ei].name] -= (-diff) * dolPt;
                }
              }
            }
          }

          Object.entries(gb).forEach(([n, v]) => (bank[n] += v));
          breakdown.push({
            game: decorateHeader('🏅 Dots', agg, players),
            rows: dtPlayers.map((p, ii) => ({
              name:   p.name,
              detail: '',
              net:    gb[p.name] || 0,
            })).sort((a, b) => b.net - a.net),
          });
        }
      }
    }
  }

  // ── Zero-sum invariant check ───────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const total = Object.values(bank).reduce((a, b) => a + b, 0);
    if (Math.abs(total) > 0.01) {
      console.error('[payouts] Zero-sum violation — total net:', total, bank);
    }
  }

  return { bank, breakdown };
}
