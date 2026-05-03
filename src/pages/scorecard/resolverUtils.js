// ─── scorecard/resolverUtils.js ───────────────────────────────────────────────
// ✅ Self-checked (13-G.2.fix): runMatchNassau and runSixesSegment calls updated
// to drop the round-shared hcps argument (Handicap_Contract §5). Engines read
// players[pi].siArray[h] internally.
//
// Display-logic helpers for the early-departure resolver UI.
//
// PURPOSE
//   Produces the `GameRow[]` array consumed by `DepartureResolverSheet` per
//   `Resolver_UI_Spec.md` §2.1, plus the default-resolution shape used to
//   seed the sheet's draft state per §10.2. This is the bridge between
//   the engine layer (game-result computation) and the resolver UI
//   (per-game pill display + per-segment / per-press status badges).
//
// ✅ Self-checked (13-C.8.1): Team Dots → parent linkage. The Dots gameRow
// now emits `parentGameKey: string | null` when Dots is in team mode locked
// to a parent team game (Sixes for `teamMode === 'Sixes'` or `Match:<id>`
// for `teamMode.startsWith('Match:')`; legacy `teamScoring` truthy → 'Sixes').
// Used by DepartureResolverSheet to enforce the locking rule: when the parent
// is being resolved as `end_at_k` or `abandon` in the SAME departure event,
// the Dots row must follow. Pure metadata addition — no behavior change for
// individual-mode Dots (parentGameKey = null).
//
// 13-C.7.5 / v2.0 amendments:
//   1. NEW: `classifyPlayersAtResults(activeRound)` — at Results → tap,
//      classifies each player as Complete / Early-departure / Missing-scores
//      per PartialGameContract §5.2 and produces the sorted unresolved-event
//      sequence per §9.3 (events sorted by `lastScored` ascending; tie-broken
//      stably by playerIdx; eventOrder assigned).
//   2. NEW: `evalCarryForward(events)` — for a given list of events
//      `0..N-1` already confirmed, computes the carry-forward state map
//      per §5.4.2 (per-game status: unresolved/abandoned/ended_at_k/
//      continuing/excluded_player with associated metadata).
//   3. NEW: `defaultsForFamily(gameRow, carryForward)` — per-family default
//      selection per §6.1 (Match-family default `end_at_k`, Pool-family
//      default `continue`). Replaces the unified `end_at_k` default of v1.0.
//   4. UPDATE: `buildResolverGameRows` accepts a `carryForward` parameter
//      and applies §5.4.3 game-row filtering (HIDE games already
//      resolved or where this player was already excluded). Adds
//      `resolutionFamily: 'match' | 'pool'` to every GameRow per §6.1.
//      Match-family Match/Sixes pills simplified to [abandon, end_at_k]
//      (v1.0 had end_at_k_closed_only + end_at_k_closed_and_open variants —
//      v2.0 collapses to one `end_at_k` token; per-segment Pay/Abandon pills
//      provide the same expressivity).
//   5. UPDATE: `exclude_player` UI label changes from "Remove [Name]" to
//      "Drop [Name]" per §6.1; data-model token `'exclude_player'` preserved.
//   6. UPDATE: `continue` is now offered universally for pool-family games
//      (was Skins/Dots only in v1.0).
//   7. UPDATE: `makeDefaultResolution(gameRow)` honors per-family default.
//
// Backward compat: callers that pass `(activeRound, departedPlayerIdxs,
// scenario, departureHole)` still work — the new `carryForward` parameter
// defaults to an empty state object representing "no prior events" which
// produces v1.0-equivalent behavior for single-event proactive entries.
//
// ARCHITECTURE POSITION
//   Same layer as `scorecardUtils.js` Category-2 derived-state builders:
//   calls engine functions and interprets their output for UI consumption.
//   Extracted to its own file (and not added to scorecardUtils.js) because:
//     1. It's a coherent feature subdomain (resolver) consumed by exactly
//        one feature path, not the whole scorecard.
//     2. It will grow further in 13-C.7 (reactive Results→ entry path) and
//        likely 13-C.8 (engine reader). Keeping it isolated prevents
//        scorecardUtils.js from becoming a catch-all general-utility file
//        (warned against in ARCHITECTURE_FOUNDATIONS.md §2).
//     3. Engine-call dependencies here (runMatchNassau, runSixesSegment,
//        getSixesTeam, matchLabel) are wider than scorecardUtils.js's
//        existing engine surface — confining them here keeps the
//        scorecardUtils.js engine import minimal.
//
// ENGINE FIREWALL
//   The clinch evaluator (Resolver_UI_Spec §3.4) is pure arithmetic and
//   does NOT import from payouts.js. Its math will be reproduced inside
//   payouts.js in 13-C.8 (per Resolver_UI_Spec §3.5: "the algorithm runs
//   entirely in payouts.js pre-processing"). The engine-side and display-
//   side implementations are intentionally independent — neither imports
//   the other — keeping the engine layer free of display dependencies and
//   honoring PartialGameContract §11.1 (engine firewall absolute).
//
//   The two `_subsetMin` and `_splitRangeByMidpoint` helpers are inlined
//   here because the canonical definitions in payouts.js are not exported
//   and the session-13-C.6 engine firewall prohibits modifying payouts.js
//   to export them. If those payouts.js helpers are ever changed, this
//   file must be updated to match.
//
// CROSS-REFERENCES
//   - Resolver_UI_Spec.md §2 (component prop interfaces, GameRow shape)
//   - Resolver_UI_Spec.md §3 (clinch detection algorithm)
//   - PartialGameContract.md §4.2 (SegmentedResolution type)
//   - PartialGameContract.md §6.1 (per-game option matrix; exclude_player
//     2+ remaining rule, amended in 13-C.6 from previous 3+ rule)
//   - PartialGameContract.md §7 (game family rules — clinch / completion /
//     hole-by-hole)
//   - ARCHITECTURE_FOUNDATIONS.md §2 (three-layer model; this file sits
//     in the Display Logic Layer alongside scorecardUtils.js)
//
// SELF-CHECK STAMPS
//   ✅ Self-checked (13-C.6): Clinch evaluator pure arithmetic per §3.4 —
//   no engine logic. Engine calls (runMatchNassau, runSixesSegment) mirror
//   the existing call sites in payouts.js exactly (same arg order, same
//   shapes). Not-started presses are filtered BEFORE the GameRow.presses[]
//   array is constructed (failure-mode check 8c bullet 2). Match instances
//   where no departed player participates are skipped entirely (Scenario A
//   §10.3). `topLevelVariant` is set on clinch-family `end_at_k`
//   resolutions only — never on completion or hole-by-hole families
//   (failure-mode check 8c bullet 1). `exclude_player` offered when ≥ 2
//   players remain after removal (PartialGameContract §6.1 v1.8).
//   ✅ Self-checked (13-C.6 device-test): Nassau vs Total Match
//   detection via `isNassauMatch(md)`. Nassau matches render Front / Back
//   / Total rows as before. Total matches render only the Total row,
//   with all presses parented under it. Storage key remains `overall`
//   for backward compatibility with already-saved gameResolutions; the
//   user-facing label is "Total" in both Nassau and Total contexts.
//   "Overall" label removed everywhere — Stableford / Stroke Play / Nines
//   completion segments now render as "Total" instead.

import { runMatchNassau, runSixesSegment, getSixesTeam, matchLabel,
         isNassauMatch }
  from '../../engine/games.js';

// ─── Inlined helpers (mirror payouts.js privates) ─────────────────────────────
// Canonical definitions live in payouts.js (`subsetMin` and the local body of
// `splitRangeByMidpoint`) but that file is engine-firewall-locked per
// session 13-C.6 Section 6. These versions track those originals exactly.

function _subsetMin(cHcps, idxs, globalMin, mode) {
  if (mode !== 'netofflow' || !idxs?.length) return globalMin;
  return Math.min(...idxs.map(i => cHcps[i]));
}

function _splitRangeByMidpoint(startHole, endHole) {
  const total = endHole - startHole + 1;
  const mid   = startHole + Math.floor(total / 2);
  const front = []; const back = []; const all = [];
  for (let h = startHole; h < mid;       h++) front.push(h);
  for (let h = mid;       h <= endHole;  h++) back.push(h);
  for (let h = startHole; h <= endHole;  h++) all.push(h);
  return { front, back, all, mid };
}

// Per-game effective range — mirrors the helper inside ScoreGrid.jsx and
// payouts.js (`rangeFor`). Returns the round range when no per-game
// override is set or the override is malformed.
function _gameRange(key, gameRanges, roundStartHole, roundEndHole) {
  const e = gameRanges?.[key];
  if (e
      && Number.isInteger(e.startHole)
      && Number.isInteger(e.endHole)
      && e.startHole >= roundStartHole
      && e.endHole   <= roundEndHole
      && e.startHole <  e.endHole) {
    return { startHole: e.startHole, endHole: e.endHole };
  }
  return { startHole: roundStartHole, endHole: roundEndHole };
}

// ─── Status evaluators ────────────────────────────────────────────────────────

// Clinch-segment status evaluator (Resolver_UI_Spec §3.4).
//   betStartHole / betEndHole — 0-based, inclusive — the hole range of the bet
//   departureHole              — 0-based — last hole the departed player(s) scored
//   holesWonA / holesWonB      — hole-win counts for sides A and B at departureHole
// Returns { status, leader, lead } per spec §3.3.
//
// 'closed'      iff one side leads by more holes than holes remain (dormie + 1)
// 'in_progress' iff bet has at least one played hole and is not closed
// 'not_started' iff betStartHole > departureHole — sentinel for caller to filter
function evalClinchStatus(betStartHole, betEndHole, departureHole, holesWonA, holesWonB) {
  if (betStartHole > departureHole) {
    return { status: 'not_started', leader: null, lead: 0 };
  }
  const lead = Math.abs(holesWonA - holesWonB);
  const holesRemaining = Math.max(0, betEndHole - departureHole);
  const status = lead > holesRemaining ? 'closed' : 'in_progress';
  let leader = null;
  if      (holesWonA > holesWonB) leader = 'A';
  else if (holesWonB > holesWonA) leader = 'B';
  return { status, leader, lead };
}

// Completion-segment status (PartialGameContract §7.2).
// 'complete' iff departureHole >= last hole of segment range; otherwise 'partial'.
// Caller filters segments whose start is past departureHole BEFORE calling.
function evalCompletionStatus(segStartHole, segEndHole, departureHole) {
  return departureHole >= segEndHole ? 'complete' : 'partial';
}

// ─── classifyPlayersAtResults (v2.0 / 13-C.7.5) ───────────────────────────────

/**
 * Classifies each active player at Results → tap and produces the sorted
 * unresolved-event sequence per PartialGameContract §5.2 / §9.3.
 *
 * For each player, computes:
 *   - `lastScored`: highest hole index in [roundStartHole, roundEndHole]
 *     with a non-empty score (real or X). -1 if no scores exist.
 *   - `trailingEmpty`: true iff every hole from `lastScored + 1` through
 *     `roundEndHole` is empty.
 *
 * Then classifies:
 *   - Complete:        lastScored === roundEndHole
 *   - Early departure: trailingEmpty (and not Complete)
 *   - Missing scores:  has scattered empty holes (non-trailing-empty)
 *
 * Returns:
 *   {
 *     scenario:     'all-complete' | 'has-missing' | 'has-departures',
 *     missingHoles: [{ pi: number, holes: number[] }],   // for has-missing
 *     events:       [{ pi, departureHole, eventOrder, lastScored }, ...],
 *                                                       // for has-departures, sorted by departureHole asc
 *     allEarlyDeparture: boolean,                        // true iff every player
 *                                                       //   is Early-departure
 *                                                       //   (Scenario B per §5.4)
 *   }
 *
 * The `eventOrder` field is computed at this call (NOT read from
 * `earlyDepartureOpts[pi].eventOrder`). The activeRound is the in-flight
 * source of truth; the stored `eventOrder` (when present) is used by
 * persistence round-trip and by §13 backward-compat for v1.x records, but
 * the live classification always re-derives.
 *
 * Ties on `departureHole` broken stably by playerIdx ascending per §5.4.1.
 *
 * @param  {object} activeRound  full activeRound blob
 * @returns {object} classification result
 */
export function classifyPlayersAtResults(activeRound) {
  const ar = activeRound || {};
  const players       = ar.activePlayers     || [];
  const scores        = ar.scores            || [];
  const roundStartHole = ar.roundStartHole ?? 0;
  const roundNumHoles  = ar.roundNumHoles  ?? 18;
  const roundEndHole   = roundStartHole + roundNumHoles - 1;

  // Per-player: lastScored (max hole h in [start, end] where scores[h][pi] is
  // non-empty) and isTrailingEmpty (all holes after lastScored are empty).
  const perPlayer = players.map((_, pi) => {
    let lastScored = -1;
    for (let h = roundStartHole; h <= roundEndHole; h++) {
      const v = scores[h]?.[pi];
      if (v !== undefined && v !== null && v !== '') {
        if (h > lastScored) lastScored = h;
      }
    }
    let trailingEmpty = true;
    if (lastScored >= 0) {
      for (let h = lastScored + 1; h <= roundEndHole; h++) {
        const v = scores[h]?.[pi];
        if (v !== undefined && v !== null && v !== '') {
          trailingEmpty = false;
          break;
        }
      }
      // Also verify intervening holes from start through lastScored have
      // no gaps (i.e., scattered empties before lastScored = Missing).
      let intervalGaps = false;
      for (let h = roundStartHole; h <= lastScored; h++) {
        const v = scores[h]?.[pi];
        if (v === undefined || v === null || v === '') {
          intervalGaps = true;
          break;
        }
      }
      if (intervalGaps) trailingEmpty = false;
    } else {
      // lastScored === -1: no scores at all. Trailing-empty is vacuously true
      // — represents a player who hasn't scored anything yet. Whether this
      // counts as "Early departure at hole -1" or "Missing scores all 18"
      // depends on policy. Per §5.2 spec: lastScored === -1 with all
      // trailingEmpty → "Early departure" with departureHole = -1
      // (represents "departed before any hole was played"). This matches
      // §8.2 step 3 "long-press on hole 0 → departureHole = -1" edge case.
      trailingEmpty = true;
    }
    return { pi, lastScored, trailingEmpty };
  });

  // Classify each player and check for proactive-departure overrides.
  // A player whose `earlyDepartureOpts[pi]` is on file is treated as Early
  // departure with `departureHole` from the saved opts, regardless of any
  // accidental scattered scores past departureHole (those are display-locked
  // and engine-ignored per §14 invariant 21). This is important for the
  // skip-when-current rule (§5.4.5) to evaluate the same event the user
  // configured proactively.
  const opts = ar.earlyDepartureOpts || {};
  const classifications = perPlayer.map(p => {
    const proactive = opts[p.pi];
    if (proactive && typeof proactive.departureHole === 'number') {
      return {
        pi: p.pi,
        klass: 'departure',
        departureHole: proactive.departureHole,
        lastScored: proactive.departureHole,
      };
    }
    if (p.lastScored === roundEndHole) {
      return { pi: p.pi, klass: 'complete', departureHole: null, lastScored: p.lastScored };
    }
    if (p.trailingEmpty) {
      return {
        pi: p.pi,
        klass: 'departure',
        departureHole: p.lastScored,
        lastScored: p.lastScored,
      };
    }
    // Find missing holes (non-trailing-empty cells).
    const missingHoles = [];
    for (let h = roundStartHole; h <= roundEndHole; h++) {
      const v = scores[h]?.[pi];
      if ((v === undefined || v === null || v === '') && h <= p.lastScored) {
        missingHoles.push(h);
      }
    }
    return { pi: p.pi, klass: 'missing', missingHoles };
  });

  const missingPlayers = classifications.filter(c => c.klass === 'missing');
  if (missingPlayers.length > 0) {
    return {
      scenario: 'has-missing',
      missingHoles: missingPlayers.map(c => ({ pi: c.pi, holes: c.missingHoles })),
      events: [],
      allEarlyDeparture: false,
    };
  }

  const departures = classifications.filter(c => c.klass === 'departure');
  if (departures.length === 0) {
    return {
      scenario: 'all-complete',
      missingHoles: [],
      events: [],
      allEarlyDeparture: false,
    };
  }

  // Sort by departureHole ascending; tie-break by pi ascending (§5.4.1).
  const sorted = departures.slice().sort((a, b) => {
    const dh = a.departureHole - b.departureHole;
    return dh !== 0 ? dh : (a.pi - b.pi);
  });
  const events = sorted.map((c, i) => ({
    pi: c.pi,
    departureHole: c.departureHole,
    eventOrder: i,
    lastScored: c.lastScored,
  }));

  const allEarlyDeparture = (departures.length === players.length);

  return {
    scenario: 'has-departures',
    missingHoles: [],
    events,
    allEarlyDeparture,
  };
}

// ─── evalCarryForward (v2.0 / 13-C.7.5) ───────────────────────────────────────

/**
 * Computes the carry-forward state map per PartialGameContract §5.4.2 from a
 * list of already-confirmed events. Used by `buildResolverGameRows` to filter
 * which games are shown for the next event in the chain (§5.4.3).
 *
 * @param  {Array} confirmedEvents  list of events already processed; each:
 *                   {
 *                     pi:              number,
 *                     departureHole:   number,
 *                     eventOrder:      number,
 *                     gameResolutions: { [gameKey]: SegmentedResolution }
 *                   }
 *                   The events should be in eventOrder ascending. The caller
 *                   is responsible for ordering; this function does NOT sort.
 *
 * @param {object} activeRound  needed to derive original participant subsets
 *                              for `continuing` state's `currentSubset`
 *                              tracking.
 *
 * @returns {object} carry-forward state keyed by gameKey:
 *   {
 *     [gameKey]: {
 *       status: 'unresolved' | 'abandoned' | 'ended_at_k' | 'continuing' | 'excluded_player',
 *       atEvent: number | null,
 *       atHole?: number,           // for ended_at_k
 *       currentSubset?: number[],  // for continuing — pi indices currently in the game
 *       excludedIdxs?: number[],   // for excluded_player — pi indices removed retroactively
 *     }
 *   }
 *
 * Games not appearing in any event's gameResolutions are absent from the
 * returned map; the caller treats absence as `unresolved` for any game key
 * it queries.
 */
export function evalCarryForward(confirmedEvents, activeRound) {
  const cf = {};
  const ar = activeRound || {};
  const players = ar.activePlayers || [];
  const allIdxs = players.map((_, i) => i);

  // Helper: the original participant subset for a game at the time the round
  // started. Used to seed `currentSubset` when a game's first carry-forward
  // event picks `continue`.
  const subsetForGame = (gameKey) => {
    if (gameKey === 'Skins')         return (ar.skinsPlayers      || []).length ? ar.skinsPlayers      : allIdxs;
    if (gameKey === 'Stableford')    return (ar.stablefordPlayers || []).length ? ar.stablefordPlayers : allIdxs;
    if (gameKey === 'Stroke Play')   return (ar.strokePlayPlayers || []).length ? ar.strokePlayPlayers : allIdxs;
    if (gameKey === 'Nines')         return (ar.ninesPlayers      || []).length ? ar.ninesPlayers      : allIdxs;
    if (gameKey === 'Sixes')         return (ar.sixesPlayers      || []).length ? ar.sixesPlayers      : allIdxs;
    if (gameKey === 'Dots' || gameKey === 'Specials') {
      return (ar.dotsPlayers || []).length ? ar.dotsPlayers : allIdxs;
    }
    // Match instances: subset is teamA+teamB or [p1, p2].
    const md = (ar.matches || []).find(m => m.id === gameKey);
    if (md) {
      if (md.format === 'team') return [...(md.teamA || []), ...(md.teamB || [])];
      return [md.p1, md.p2].filter(x => x != null);
    }
    return allIdxs;
  };

  for (const event of (confirmedEvents || [])) {
    const resolutions = event.gameResolutions || {};
    for (const [gameKey, res] of Object.entries(resolutions)) {
      const tl = res?.topLevel;
      if (!tl) continue;

      const prior = cf[gameKey] || { status: 'unresolved', atEvent: null };

      if (tl === 'abandon') {
        cf[gameKey] = { status: 'abandoned', atEvent: event.eventOrder };
        continue;
      }
      if (tl === 'end_at_k') {
        cf[gameKey] = {
          status: 'ended_at_k',
          atEvent: event.eventOrder,
          atHole: event.departureHole,
        };
        continue;
      }
      if (tl === 'continue') {
        // The reduced subset is the prior subset (or original participant set)
        // minus the departing player. The departing player's pre-departure
        // results are kept; their post-departure participation is removed.
        const baseSubset = prior.status === 'continuing'
          ? (prior.currentSubset || subsetForGame(gameKey))
          : (prior.status === 'excluded_player'
              ? subsetForGame(gameKey).filter(i => !(prior.excludedIdxs || []).includes(i))
              : subsetForGame(gameKey));
        const newSubset = baseSubset.filter(i => i !== event.pi);
        cf[gameKey] = {
          status: 'continuing',
          atEvent: event.eventOrder,
          currentSubset: newSubset,
        };
        continue;
      }
      if (tl === 'exclude_player') {
        const priorExcluded = prior.status === 'excluded_player'
          ? (prior.excludedIdxs || [])
          : [];
        const newExcluded = priorExcluded.includes(event.pi)
          ? priorExcluded
          : [...priorExcluded, event.pi];
        cf[gameKey] = {
          status: 'excluded_player',
          atEvent: event.eventOrder,
          excludedIdxs: newExcluded,
        };
        continue;
      }
      // Unrecognized topLevel — leave prior state.
    }
  }

  return cf;
}

// ─── resolutionFamilyForGame (v2.0 / 13-C.7.5) ────────────────────────────────

/**
 * Maps a gameRow's gameKey + label/options to its `resolutionFamily`
 * ('match' | 'pool') per PartialGameContract §6.1. This is independent of
 * the existing `family` ('clinch' | 'completion' | 'holeByHole') which
 * describes engine semantics.
 *
 * @param  {string}  gameKey       'Skins' | 'Stableford' | 'Stroke Play' | etc.
 * @param  {object}  gameRow       partially-built gameRow (for inspecting
 *                                 stableford-team vs individual)
 * @param  {object}  activeRound   for inspecting Stableford betMode etc.
 * @returns {'match' | 'pool'}
 */
function resolutionFamilyForGame(gameKey, gameRow, activeRound) {
  // Match instances (gameKey is matchDef.id like 'mp_0-1' or 'nau_2-3') →
  // match-family.
  const matches = activeRound?.matches || [];
  if (matches.find(m => m.id === gameKey)) return 'match';

  // Sixes, Nines → match-family.
  if (gameKey === 'Sixes' || gameKey === 'Nines') return 'match';

  // Stableford: team format → match-family; individual → pool-family.
  if (gameKey === 'Stableford') {
    const stOpts = activeRound?.gameOpts?.Stableford || {};
    const isStabTeam = stOpts.teamMode && stOpts.teamMode !== 'none';
    return isStabTeam ? 'match' : 'pool';
  }

  // Stroke Play, Skins, Dots, Specials → pool-family.
  return 'pool';
}

// ─── defaultsForFamily (v2.0 / 13-C.7.5) ──────────────────────────────────────

/**
 * Returns the default resolution per PartialGameContract §6.1 / §10.2 for a
 * given gameRow, considering carry-forward state (§5.4.2).
 *
 * Match-family default: `end_at_k`
 * Pool-family default:  `continue` (or `end_at_k` if carry-forward state
 *                        already has the game in `continuing` and this
 *                        event would reduce subset below 2)
 *
 * Consumers: ScorecardPage seeds `initialResolutions` by calling this for
 * each gameRow returned by `buildResolverGameRows`.
 *
 * @param  {GameRow} gameRow              row from buildResolverGameRows
 * @param  {object}  carryForwardForGame  optional; carry-forward state for
 *                                        this game (§5.4.2). Used to make
 *                                        defaults context-aware.
 * @returns {SegmentedResolution}
 */
export function defaultsForFamily(gameRow, carryForwardForGame) {
  if (!gameRow) return { topLevel: 'end_at_k' };

  const fam = gameRow.resolutionFamily || 'match';
  const segments = {};
  (gameRow.segments || []).forEach(s => { segments[s.segKey] = 'pay'; });
  const presses = {};
  (gameRow.presses || []).forEach(p => { presses[p.pressKey] = 'pay'; });

  if (fam === 'match') {
    // Match-family default: end_at_k with all segments/presses Pay.
    return {
      topLevel: 'end_at_k',
      segments,
      presses,
    };
  }

  // Pool-family default: continue. No segment/press detail at this level
  // (continue resolution is "pre-departure results kept, game continues
  // with reduced subset" — segment partition lives in payouts.js per §11.4).
  return { topLevel: 'continue' };
}

// ─── buildResolverGameRows ────────────────────────────────────────────────────

/**
 * Constructs the GameRow[] array consumed by `DepartureResolverSheet` per
 * `Resolver_UI_Spec.md` §2.1. Iterates `activeRound.activeGames`, classifies
 * each game's family (clinch / completion / holeByHole), assembles
 * `topLevelOptions` per `PartialGameContract.md` §6.1's matrix, and runs the
 * §3.4 clinch evaluator (Match, Sixes) or §7.2 completion evaluator (Nines,
 * Stableford-segments, Stroke Play-segments) to produce per-segment and
 * per-press status.
 *
 * v2.0 (13-C.7.5) amendments:
 *   - Accepts `carryForward` parameter — state map from prior events in the
 *     sequenced chain per §5.4.2. Filters games per §5.4.3:
 *       • abandoned / ended_at_k by prior event → HIDE
 *       • continuing where departing player not in currentSubset → HIDE
 *       • excluded_player where departing player in excludedIdxs → HIDE
 *       • continuing where departing player IS in currentSubset → SHOW with
 *         options scoped to currentSubset (continue means "continue with
 *         currentSubset minus departing player")
 *   - Adds `resolutionFamily: 'match' | 'pool'` to every GameRow per §6.1.
 *   - Match/Sixes top-level pills simplified to [abandon, end_at_k] (v1.0
 *     had _closed_only and _closed_and_open variants — v2.0 collapses; the
 *     same expressivity is available via per-segment Pay/Abandon pills).
 *   - Pool-family games (Skins, Stableford-individual, Stroke Play, Dots,
 *     Specials) now include the `continue` option universally (v1.0 had it
 *     only on Skins and Dots).
 *   - `exclude_player` UI label changes to "Drop [Name]" (was "Remove [Name]").
 *
 * Backward compat: callers passing only the v1.0 4-arg signature
 *   `(activeRound, departedPlayerIdxs, scenario, departureHole)`
 * still work — `carryForward` defaults to `{}` (no prior events), which
 * yields v1.0-equivalent behavior for single-event proactive entries from
 * 13-C.6.
 *
 * Scenario A behavior (Resolver_UI_Spec §10.3):
 *   - Match instances: only included when at least one departed player
 *     participates. Non-participating matches are skipped entirely.
 *   - Other games: only included when at least one departed player is in
 *     the game's participant subset.
 *
 * Not-started presses (`betStartHole > departureHole`) are filtered out
 * before being added to `GameRow.presses[]` per Resolver_UI_Spec §2.4(b).
 *
 * `exclude_player` rule (PartialGameContract §6.1 v2.0):
 *   Offered only for pool-family games when ≥ 2 players remain in the game's
 *   carry-forward subset after removing the departing player. Not offered
 *   for match-family games (Match/Nassau, Sixes, Nines, Stableford-team).
 *
 * @param  {object}   activeRound          full activeRound blob
 * @param  {number[]} departedPlayerIdxs   indices into activePlayers of departed players
 * @param  {'A'|'B'}  scenario             v1.0 — preserved for back-compat;
 *                                         under v2.0 sequenced model, every event
 *                                         is effectively Scenario A from the sheet's
 *                                         perspective. The group-stop side-effect for
 *                                         Scenario B is applied by the sequencer.
 * @param  {number}   departureHole        0-based last hole the departed player(s) scored
 * @param  {object}   [carryForward={}]    carry-forward state map from prior events
 *                                         per §5.4.2; default empty = no prior events
 * @returns {GameRow[]}                    rows to render in the sheet
 */
export function buildResolverGameRows(activeRound, departedPlayerIdxs, scenario, departureHole, carryForward = {}) {
  const ar = activeRound || {};
  const players       = ar.activePlayers     || [];
  const activeGames   = ar.activeGames       || [];
  const gameOpts      = ar.gameOpts          || {};
  const matches       = ar.matches           || [];
  const scores        = ar.scores            || [];
  const hcps          = ar.hcps              || [];
  const courseHcps    = ar.courseHcps        || [];
  const minCourseHcp  = ar.minCourseHcp      ?? 0;
  const manualPresses = ar.manualPresses     || {};
  const sixesTeams    = ar.sixesTeams        || [null, null, null];
  const sixesPlayers  = ar.sixesPlayers      || [];
  const ninesPlayers  = ar.ninesPlayers      || [];
  const stabPlayers   = ar.stablefordPlayers || [];
  const spPlayers     = ar.strokePlayPlayers || [];
  const skinsPlayers  = ar.skinsPlayers      || [];
  const dotsPlayers   = ar.dotsPlayers       || [];
  const gameRanges    = ar.gameRanges        || {};
  const roundStartHole = ar.roundStartHole ?? 0;
  const roundEndHole   = roundStartHole + (ar.roundNumHoles ?? 18) - 1;

  const allIdxs = players.map((_, i) => i);
  const resolveSubset = arr => (arr && arr.length > 0) ? arr : allIdxs;
  const departedSet = new Set(departedPlayerIdxs);
  const anyDepartedIn = (subset) => subset.some(i => departedSet.has(i));

  // Apply carry-forward state to a base subset to derive the EFFECTIVE subset
  // for this event. Per §5.4.2 / §5.4.3:
  //   - If game is `continuing` from a prior event, use prior currentSubset.
  //   - If game is `excluded_player` from prior events, remove those idxs.
  //   - Otherwise use the base subset (original participant set for the game).
  const effectiveSubsetForGame = (gameKey, baseSubset) => {
    const cf = carryForward[gameKey];
    if (!cf || cf.status === 'unresolved') return baseSubset;
    if (cf.status === 'continuing') return cf.currentSubset || baseSubset;
    if (cf.status === 'excluded_player') {
      const excluded = new Set(cf.excludedIdxs || []);
      return baseSubset.filter(i => !excluded.has(i));
    }
    // abandoned / ended_at_k — game is finished; subset doesn't matter for
    // display because the row will be filtered out at the top of the loop.
    return baseSubset;
  };

  // Returns count of subset members NOT in the departed set — i.e. the
  // game's effective remaining-player count after removal of THIS event's
  // departing player(s).
  const remainingAfterRemoval = (subset) =>
    subset.filter(i => !departedSet.has(i)).length;

  // exclude_player gate per §6.1 v2.0 — 2+ players remaining after removal
  // of the departing player(s) AND the game is pool-family. Match-family
  // games (Match/Nassau, Sixes, Nines, Stableford-team) NEVER offer
  // exclude_player. The scenario === 'A' gate from v1.0 is removed; under
  // v2.0 sequenced model every event is single-player so the exclude check
  // applies based on subset arithmetic, not scenario routing.
  const canExcludePlayer = (subset, resolutionFamily) =>
    resolutionFamily === 'pool' && remainingAfterRemoval(subset) >= 2;

  // Build "Drop [Name]" / "Drop departed players" label per §6.1 v2.0
  // (was "Remove [Name]" in v1.0; data-model token 'exclude_player' preserved).
  const dropPlayerLabel = (subset) => {
    const departedNames = departedPlayerIdxs
      .filter(i => subset.includes(i))
      .map(i => players[i]?.name || '?');
    return departedNames.length === 1
      ? `Drop ${departedNames[0]}`
      : 'Drop departed players';
  };

  // Returns true iff this game has been finished by a prior event in the
  // chain (abandoned or ended_at_k). Such games are HIDDEN from this event's
  // resolver per §5.4.3.
  const finishedByPriorEvent = (gameKey) => {
    const cf = carryForward[gameKey];
    return cf && (cf.status === 'abandoned' || cf.status === 'ended_at_k');
  };

  // Returns true iff the departing player is no longer in this game's
  // current subset due to a prior continue or exclude_player. HIDE per §5.4.3.
  const playerAlreadyRemoved = (gameKey, baseSubset) => {
    const cf = carryForward[gameKey];
    if (!cf) return false;
    if (cf.status === 'continuing') {
      const subset = cf.currentSubset || baseSubset;
      return !departedPlayerIdxs.some(pi => subset.includes(pi));
    }
    if (cf.status === 'excluded_player') {
      const excluded = new Set(cf.excludedIdxs || []);
      return departedPlayerIdxs.every(pi => excluded.has(pi));
    }
    return false;
  };

  const rows = [];

  for (const game of activeGames) {

    // ── Match / Nassau ────────────────────────────────────────────────────────
    // Clinch family. One GameRow per match instance. Only matches involving
    // at least one departed player are added in Scenario A (Spec §10.3).
    if (game === 'Match / Nassau') {
      matches.forEach((md, mi) => {
        const isTeam = md.format === 'team';
        const involved = isTeam
          ? [...(md.teamA || []), ...(md.teamB || [])]
          : [md.p1, md.p2].filter(x => x != null);
        if (!involved.length) return;
        if (scenario === 'A' && !anyDepartedIn(involved)) return;

        const matchKey  = md.id;

        // v2.0: skip if a prior event in the chain already finished this
        // match (abandoned or ended_at_k) per §5.4.3.
        if (finishedByPriorEvent(matchKey)) return;
        // v2.0: skip if the departing player is no longer in this match's
        // current subset (already removed by prior continue/exclude).
        if (playerAlreadyRemoved(matchKey, involved)) return;

        const matchMode = md.grossNetNOL ?? md.scoring ?? 'net';
        const matchMin  = _subsetMin(courseHcps, involved, minCourseHcp, matchMode);

        const range = _gameRange(matchKey, gameRanges, roundStartHole, roundEndHole);

        // Mirror payouts.js call site: separate manual-press buckets per segment.
        const mpForMatch = {
          front:   manualPresses[`Match:${md.id}:Front`]   || [],
          back:    manualPresses[`Match:${md.id}:Back`]    || [],
          overall: manualPresses[`Match:${md.id}:Overall`] || [],
        };

        const { front, back, overall } = runMatchNassau(
          scores, players, md, courseHcps, matchMin, mpForMatch, range
        );

        // Derive per-segment end holes from range using engine's midpoint rule.
        const total = range.endHole - range.startHole + 1;
        const mid   = range.startHole + Math.floor(total / 2);
        const frontEnd = mid - 1;       // last hole of Front
        const backEnd  = range.endHole; // last hole of Back
        const allEnd   = range.endHole; // last hole of full-range bet

        // Segment label helper — adapts F/B labels to non-9-hole halves.
        const fLen = frontEnd - range.startHole + 1;
        const bLen = backEnd  - mid + 1;
        const isFullStandard = (range.startHole === 0 && range.endHole === 17);
        const frontLabel   = isFullStandard ? 'Front 9' : `Front ${fLen}`;
        const backLabel    = isFullStandard ? 'Back 9'  : `Back ${bLen}`;
        // 13-C.6 device-test fix: Total label for the full-range bet — both
        // for Nassau (where "Total" runs alongside Front/Back) and for
        // straight Match Play (where Total is the only bet).
        const totalLabel   = 'Total';

        // 13-C.6 device-test fix: Detect Nassau vs straight Total Match. In
        // Total mode there are no F/B bets — only the full-range bet — and
        // the resolver must show only that single row, with all manual
        // presses parented to it. The engine's `runMatchNassau` returns
        // populated `front` / `back` / `overall` arrays even for Total
        // matches (for downstream display purposes), so the resolver layer
        // is responsible for filtering down to the actually-existing bet
        // structure.
        const nassau = isNassauMatch(md);
        const segDefs = nassau ? [
          { segKey: 'front',   label: frontLabel, bets: front,   end: frontEnd, segStart: range.startHole },
          { segKey: 'back',    label: backLabel,  bets: back,    end: backEnd,  segStart: mid             },
          { segKey: 'overall', label: totalLabel, bets: overall, end: allEnd,   segStart: range.startHole },
        ] : [
          // Straight Match Play: only the Total bet exists. We keep the
          // segKey 'overall' for storage stability — old records with
          // gameResolutions keyed under 'overall' continue to work — but
          // present it to the user as "Total".
          { segKey: 'overall', label: totalLabel, bets: overall, end: allEnd,   segStart: range.startHole },
        ];

        const segRows   = [];
        const pressRows = [];
        segDefs.forEach(({ segKey, label, bets, end, segStart }) => {
          if (!bets || bets.length === 0) return;
          // Skip segment whose start is after departure (segment never began).
          if (segStart > departureHole) return;

          const baseBet  = bets[0]; // base match for this segment
          const baseEval = evalClinchStatus(
            segStart, end, departureHole, baseBet.p1w, baseBet.p2w
          );
          // (segStart > departureHole filter above means status is always
          // 'closed' or 'in_progress' here — never 'not_started'.)
          segRows.push({ segKey, label, status: baseEval.status });

          // Presses live in bets[1..n]. Each has its own startHole. Filter
          // not-started presses out BEFORE constructing pressRows[]
          // (failure-mode check 8c bullet 2).
          for (let i = 1; i < bets.length; i++) {
            const pb = bets[i];
            const pStart = pb.startHole;
            if (pStart > departureHole) continue; // not-started → omit
            const pe = evalClinchStatus(
              pStart, end, departureHole, pb.p1w, pb.p2w
            );
            pressRows.push({
              pressKey:  `Match:${md.id}:${segKey}:press[${i - 1}]`,
              label:     `Press ${i}`,
              parentSeg: segKey,
              status:    pe.status,
            });
          }
        });

        const baseLabel = matchLabel(md, players); // "Dave vs Alice" / "A & B vs C & D"
        const letter    = String.fromCharCode(65 + mi);
        const gameLabel = `Match ${letter}: ${baseLabel}`;

        rows.push({
          gameKey: matchKey,
          label:   gameLabel,
          family:  'clinch',
          resolutionFamily: 'match',
          // v2.0 §6.1: Match-family — only abandon and end_at_k. The v1.0
          // "Pay closed" / "Pay closed + open" variant pills are removed;
          // the simplified end_at_k token always expands per-segment Pay/
          // Abandon pills, providing the same expressivity. Default = end_at_k.
          topLevelOptions: [
            { value: 'abandon',  label: 'Abandon' },
            { value: 'end_at_k', label: 'End at hole ' + (departureHole + 1) },
          ],
          segments: segRows,
          presses:  pressRows,
        });
      });
      continue;
    }

    // ── Sixes ────────────────────────────────────────────────────────────────
    // Match-family per §6.1 v2.0. 4-player game. Any departure ends the
    // game (per Q3.1 in 13-C.7.5 design). Only abandon and end_at_k offered.
    if (game === 'Sixes') {
      const subset = sixesPlayers.length ? sixesPlayers : allIdxs.slice(0, 4);
      if (subset.length < 4) continue;
      if (scenario === 'A' && !anyDepartedIn(subset)) continue;

      // v2.0: skip if already finished by a prior event in the chain.
      if (finishedByPriorEvent('Sixes')) continue;
      if (playerAlreadyRemoved('Sixes', subset)) continue;

      const sxOpts    = gameOpts.Sixes || {};
      const sxMode    = sxOpts.grossNetNOL ?? sxOpts.scoring ?? 'net';
      const sxScoring = sxOpts.scoring ?? sxOpts.tiebreak ?? 'none';
      const sxAutoN   = (sxOpts.autoPress && sxOpts.autoPress !== 'none')
                        ? parseInt(sxOpts.autoPress) : 0;
      const sxMin     = _subsetMin(courseHcps, subset, minCourseHcp, sxMode);

      const sxR    = _gameRange('Sixes', gameRanges, roundStartHole, roundEndHole);
      const sxLen  = sxR.endHole - sxR.startHole + 1;
      const segLen = Math.floor(sxLen / 3); // validator guarantees divisibility
      const SEG_HOLES = [
        Array.from({ length: segLen }, (_, i) => sxR.startHole + i),
        Array.from({ length: segLen }, (_, i) => sxR.startHole + segLen + i),
        Array.from({ length: segLen }, (_, i) => sxR.startHole + 2 * segLen + i),
      ];
      const SEG_KEYS = ['Sixes:seg0', 'Sixes:seg1', 'Sixes:seg2'];

      const segRows   = [];
      const pressRows = [];

      SEG_HOLES.forEach((holes, si) => {
        if (!holes.length) return;
        const segStart = holes[0];
        const segEnd   = holes[holes.length - 1];
        if (segStart > departureHole) return; // segment never started

        const team = getSixesTeam(si, sixesTeams, players);
        if (!team) return;

        const mpHoles = manualPresses[SEG_KEYS[si]] || [];

        const matchLevels = runSixesSegment(
          holes, scores, players,
          team, sxMode, sxScoring,
          courseHcps, sxMin,
          sxAutoN, mpHoles
        );
        if (!matchLevels || !matchLevels.length) return;

        const segLabel = `Seg ${si + 1}`;
        const segKey   = `seg${si}`;

        const baseLevel = matchLevels[0];
        const baseEval  = evalClinchStatus(
          segStart, segEnd, departureHole, baseLevel.abw, baseLevel.cdw
        );
        segRows.push({ segKey, label: segLabel, status: baseEval.status });

        for (let i = 1; i < matchLevels.length; i++) {
          const pb = matchLevels[i];
          const pStart = pb.startHole;
          if (pStart > departureHole) continue;
          const pe = evalClinchStatus(
            pStart, segEnd, departureHole, pb.abw, pb.cdw
          );
          pressRows.push({
            pressKey:  `Sixes:${segKey}:press[${i - 1}]`,
            label:     `Press ${i}`,
            parentSeg: segKey,
            status:    pe.status,
          });
        }
      });

      rows.push({
        gameKey: 'Sixes',
        label:   'Sixes',
        family:  'clinch',
        resolutionFamily: 'match',
        topLevelOptions: [
          { value: 'abandon',  label: 'Abandon' },
          { value: 'end_at_k', label: 'End at hole ' + (departureHole + 1) },
        ],
        segments: segRows,
        presses:  pressRows,
      });
      continue;
    }

    // ── Stableford ───────────────────────────────────────────────────────────
    // Completion family. Individual or team. Segments only when betMode is
    // 'segments'. exclude_player offered for individual mode only in
    // Scenario A when ≥ 2 players remain after removal.
    if (game === 'Stableford') {
      const stabOpts   = gameOpts.Stableford || {};
      const isStabTeam = stabOpts.format === 'team';
      const betMode    = stabOpts.betMode ?? stabOpts.stabBetMode ?? 'perpoint';

      let baseSubset;
      if (isStabTeam) {
        baseSubset = [...(stabOpts.teamA || []), ...(stabOpts.teamB || [])];
      } else {
        baseSubset = resolveSubset(stabPlayers);
      }
      if (!baseSubset.length) continue;
      if (scenario === 'A' && !anyDepartedIn(baseSubset)) continue;

      // v2.0: skip if game already finished or player removed by prior event.
      if (finishedByPriorEvent('Stableford')) continue;
      if (playerAlreadyRemoved('Stableford', baseSubset)) continue;

      // v2.0: effective subset reflects carry-forward state (continuing
      // subsets from prior events, exclusions, etc).
      const subset = effectiveSubsetForGame('Stableford', baseSubset);

      const segments = [];
      if (betMode === 'segments') {
        const stR = _gameRange('Stableford', gameRanges, roundStartHole, roundEndHole);
        const { mid } = _splitRangeByMidpoint(stR.startHole, stR.endHole);
        const isFullStandard = (stR.startHole === 0 && stR.endHole === 17);
        const fLen = mid - stR.startHole;
        const bLen = stR.endHole - mid + 1;
        const segDefs = [
          { segKey: 'front',   label: isFullStandard ? 'Front 9' : `Front ${fLen}`,
            segStart: stR.startHole, segEnd: mid - 1 },
          { segKey: 'back',    label: isFullStandard ? 'Back 9'  : `Back ${bLen}`,
            segStart: mid,           segEnd: stR.endHole },
          { segKey: 'overall', label: 'Total',
            segStart: stR.startHole, segEnd: stR.endHole },
        ];
        segDefs.forEach(({ segKey, label, segStart, segEnd }) => {
          if (segStart > departureHole) return;
          segments.push({
            segKey, label,
            status: evalCompletionStatus(segStart, segEnd, departureHole),
          });
        });
      }

      // v2.0: per-game-family option matrix per §6.1.
      // Stableford-team is match-family (no continue, no exclude_player).
      // Stableford-individual is pool-family (all four options).
      const resolutionFamily = isStabTeam ? 'match' : 'pool';
      const topLevelOptions = [
        { value: 'abandon',  label: 'Abandon' },
        { value: 'end_at_k', label: 'End at hole ' + (departureHole + 1) },
      ];
      if (resolutionFamily === 'pool') {
        topLevelOptions.push({ value: 'continue', label: 'Continue' });
        if (canExcludePlayer(subset, resolutionFamily)) {
          topLevelOptions.push({ value: 'exclude_player', label: dropPlayerLabel(subset) });
        }
      }

      rows.push({
        gameKey: 'Stableford',
        label:   isStabTeam ? 'Stableford (team)' : 'Stableford',
        family:  'completion',
        resolutionFamily,
        topLevelOptions,
        segments,
      });
      continue;
    }

    // ── Stroke Play ──────────────────────────────────────────────────────────
    // Pool-family per §6.1 v2.0. Individual scoring. All four options
    // available (abandon / end_at_k / continue / exclude_player).
    if (game === 'Stroke Play') {
      const baseSubset = resolveSubset(spPlayers);
      if (!baseSubset.length) continue;
      if (scenario === 'A' && !anyDepartedIn(baseSubset)) continue;

      // v2.0: skip if game already finished or player removed by prior event.
      if (finishedByPriorEvent('Stroke Play')) continue;
      if (playerAlreadyRemoved('Stroke Play', baseSubset)) continue;

      const subset = effectiveSubsetForGame('Stroke Play', baseSubset);

      const spOpts  = gameOpts['Stroke Play'] || {};
      const betMode = spOpts.betMode ?? spOpts.strokeMode ?? 'total';

      const segments = [];
      if (betMode === 'segments') {
        const spR = _gameRange('Stroke Play', gameRanges, roundStartHole, roundEndHole);
        const { mid } = _splitRangeByMidpoint(spR.startHole, spR.endHole);
        const isFullStandard = (spR.startHole === 0 && spR.endHole === 17);
        const fLen = mid - spR.startHole;
        const bLen = spR.endHole - mid + 1;
        const segDefs = [
          { segKey: 'front',   label: isFullStandard ? 'Front 9' : `Front ${fLen}`,
            segStart: spR.startHole, segEnd: mid - 1 },
          { segKey: 'back',    label: isFullStandard ? 'Back 9'  : `Back ${bLen}`,
            segStart: mid,           segEnd: spR.endHole },
          { segKey: 'overall', label: 'Total',
            segStart: spR.startHole, segEnd: spR.endHole },
        ];
        segDefs.forEach(({ segKey, label, segStart, segEnd }) => {
          if (segStart > departureHole) return;
          segments.push({
            segKey, label,
            status: evalCompletionStatus(segStart, segEnd, departureHole),
          });
        });
      }

      // v2.0 §6.1: Stroke Play is pool-family — all four options.
      const topLevelOptions = [
        { value: 'abandon',  label: 'Abandon' },
        { value: 'end_at_k', label: 'End at hole ' + (departureHole + 1) },
        { value: 'continue', label: 'Continue' },
      ];
      if (canExcludePlayer(subset, 'pool')) {
        topLevelOptions.push({ value: 'exclude_player', label: dropPlayerLabel(subset) });
      }

      rows.push({
        gameKey: 'Stroke Play',
        label:   'Stroke Play',
        family:  'completion',
        resolutionFamily: 'pool',
        topLevelOptions,
        segments,
      });
      continue;
    }

    // ── Nines ────────────────────────────────────────────────────────────────
    // Match-family per §6.1 v2.0. Hard 3-player engine constraint. Only
    // abandon and end_at_k offered (no continue, no exclude_player).
    if (game === 'Nines') {
      const subset = resolveSubset(ninesPlayers);
      if (subset.length < 3) continue;
      if (scenario === 'A' && !anyDepartedIn(subset)) continue;

      // v2.0: skip if game already finished or player removed by prior event.
      if (finishedByPriorEvent('Nines')) continue;
      if (playerAlreadyRemoved('Nines', subset)) continue;

      const nOpts   = gameOpts.Nines || {};
      const betMode = nOpts.betMode ?? nOpts.ninesMode ?? 'perpoint';

      const segments = [];
      if (betMode === 'segments') {
        const nR = _gameRange('Nines', gameRanges, roundStartHole, roundEndHole);
        const { mid } = _splitRangeByMidpoint(nR.startHole, nR.endHole);
        const isFullStandard = (nR.startHole === 0 && nR.endHole === 17);
        const fLen = mid - nR.startHole;
        const bLen = nR.endHole - mid + 1;
        const segDefs = [
          { segKey: 'front',   label: isFullStandard ? 'Front 9' : `Front ${fLen}`,
            segStart: nR.startHole, segEnd: mid - 1 },
          { segKey: 'back',    label: isFullStandard ? 'Back 9'  : `Back ${bLen}`,
            segStart: mid,          segEnd: nR.endHole },
          { segKey: 'overall', label: 'Total',
            segStart: nR.startHole, segEnd: nR.endHole },
        ];
        segDefs.forEach(({ segKey, label, segStart, segEnd }) => {
          if (segStart > departureHole) return;
          segments.push({
            segKey, label,
            status: evalCompletionStatus(segStart, segEnd, departureHole),
          });
        });
      }

      rows.push({
        gameKey: 'Nines',
        label:   'Nines',
        family:  'completion',
        resolutionFamily: 'match',
        topLevelOptions: [
          { value: 'abandon',  label: 'Abandon' },
          { value: 'end_at_k', label: 'End at hole ' + (departureHole + 1) },
        ],
        segments,
      });
      continue;
    }

    // ── Skins ────────────────────────────────────────────────────────────────
    // Pool-family per §6.1 v2.0. No segments. Top-level: abandon / end_at_k /
    // continue / exclude_player. Default `continue`.
    if (game === 'Skins') {
      const baseSubset = resolveSubset(skinsPlayers);
      if (!baseSubset.length) continue;
      if (scenario === 'A' && !anyDepartedIn(baseSubset)) continue;

      // v2.0: skip if game already finished or player removed by prior event.
      if (finishedByPriorEvent('Skins')) continue;
      if (playerAlreadyRemoved('Skins', baseSubset)) continue;

      const subset = effectiveSubsetForGame('Skins', baseSubset);

      const topLevelOptions = [
        { value: 'abandon',  label: 'Abandon' },
        { value: 'end_at_k', label: 'End at hole ' + (departureHole + 1) },
        { value: 'continue', label: 'Continue' },
      ];
      if (canExcludePlayer(subset, 'pool')) {
        topLevelOptions.push({ value: 'exclude_player', label: dropPlayerLabel(subset) });
      }

      rows.push({
        gameKey: 'Skins',
        label:   'Skins',
        family:  'holeByHole',
        resolutionFamily: 'pool',
        topLevelOptions,
      });
      continue;
    }

    // ── Dots ─────────────────────────────────────────────────────────────────
    // Hole-by-hole family. exclude_player offered in Scenario A when ≥ 2
    // remain after removal.
    if (game === 'Dots' || game === 'Specials') {
      const baseSubset = resolveSubset(dotsPlayers);
      if (!baseSubset.length) continue;
      if (scenario === 'A' && !anyDepartedIn(baseSubset)) continue;

      // v2.0: skip if game already finished or player removed by prior event.
      const dotsKey = game; // 'Dots' or 'Specials' — preserve original key
      if (finishedByPriorEvent(dotsKey)) continue;
      if (playerAlreadyRemoved(dotsKey, baseSubset)) continue;

      const subset = effectiveSubsetForGame(dotsKey, baseSubset);

      // 13-C.8.1: identify the parent team game if Dots is locked to one.
      // teamMode === 'Sixes' → parent is 'Sixes'; teamMode startsWith 'Match:'
      // → parent is the matchDef.id (string after 'Match:'). Legacy
      // teamScoring truthy (no teamMode) → 'Sixes' (for backward-compat with
      // pre-v2.0 saved rounds). Individual mode → null.
      const dotsOpts    = gameOpts[dotsKey] || {};
      const rawTeamMode = dotsOpts.teamMode;
      const legacyTeam  = dotsOpts.teamScoring;
      let parentGameKey = null;
      if (rawTeamMode === 'Sixes') {
        parentGameKey = 'Sixes';
      } else if (typeof rawTeamMode === 'string' && rawTeamMode.startsWith('Match:')) {
        parentGameKey = rawTeamMode.slice(6); // strip 'Match:' prefix → matchDef.id
      } else if (!rawTeamMode && legacyTeam) {
        parentGameKey = 'Sixes';
      }

      const topLevelOptions = [
        { value: 'abandon',  label: 'Abandon' },
        { value: 'end_at_k', label: 'End at hole ' + (departureHole + 1) },
        { value: 'continue', label: 'Continue' },
      ];
      if (canExcludePlayer(subset, 'pool')) {
        topLevelOptions.push({ value: 'exclude_player', label: dropPlayerLabel(subset) });
      }

      rows.push({
        gameKey: dotsKey,
        label:   dotsKey,
        family:  'holeByHole',
        resolutionFamily: 'pool',
        topLevelOptions,
        parentGameKey,
      });
      continue;
    }
  }

  return rows;
}

// ─── makeDefaultResolution ────────────────────────────────────────────────────

/**
 * Default resolution per Resolver_UI_Spec §10.2 — used to seed the sheet's
 * draft state on open.
 *
 * v2.0 (13-C.7.5): Per-family defaults per PartialGameContract §6.1.
 *   - Match-family: `end_at_k` with all segments/presses defaulting to 'pay'
 *   - Pool-family:  `continue` (no segment/press detail at this level —
 *                    `continue` semantics live in payouts.js segment partition
 *                    per §11.4)
 *
 * v1.0 unified `end_at_k` default is preserved as the FALLBACK behavior when
 * the gameRow has no `resolutionFamily` field set (e.g., legacy callers or
 * tests). Per the v2.0 design, all gameRows produced by buildResolverGameRows
 * now carry `resolutionFamily`, so the default in production is per-family.
 *
 * Used by ScorecardPage to construct `initialResolutions` from the games[]
 * array returned by `buildResolverGameRows`. Equivalent to calling
 * `defaultsForFamily(gameRow, undefined)` — provided as a separate export
 * for backward-compat with 13-C.6 call sites.
 */
export function makeDefaultResolution(gameRow) {
  if (!gameRow) return { topLevel: 'end_at_k' };

  // v2.0: when resolutionFamily is set, defer to defaultsForFamily.
  if (gameRow.resolutionFamily) {
    return defaultsForFamily(gameRow);
  }

  // Fallback: v1.0 unified end_at_k default for legacy callers.
  if (gameRow.family === 'clinch') {
    const segments = {};
    (gameRow.segments || []).forEach(s => { segments[s.segKey] = 'pay'; });
    const presses = {};
    (gameRow.presses || []).forEach(p => { presses[p.pressKey] = 'pay'; });
    return {
      topLevel: 'end_at_k',
      topLevelVariant: 'closed_and_open',
      segments,
      presses,
    };
  }

  if (gameRow.family === 'completion') {
    const segments = {};
    (gameRow.segments || []).forEach(s => { segments[s.segKey] = 'pay'; });
    return {
      topLevel: 'end_at_k',
      segments,
    };
  }

  // hole-by-hole
  return { topLevel: 'end_at_k' };
}
