// ─── services/roundUtils.js ───────────────────────────────────────────────────
// ✅ Self-checked (13-G.2.fix): runMatchNassau call updated to drop the round-shared
// hcps argument (Handicap_Contract §5). Engine reads players[pi].siArray[h]
// internally. This was the cause of the blank-screen crash on history reload
// and round summary modal — the old hcps array was being passed as the
// matchDef arg, breaking destructuring downstream.
//
// Payout argument assembly and per-match payout breakdown.
// Share rendering subsystem extracted to shareUtils.js in session 13-E.6.
//
// Retained exports:
//   buildPayoutArgs        — assembles the full arg object for computePayouts()
//   computePerMatchPayouts — per-match breakdown used by ResultsPage,
//                            RoundSummaryModal, HistoryPage share path
//   cleanGameName          — strips emoji prefix from game name strings;
//                            consumed by PayoutDisplay.jsx and shareUtils.js
//
// ✅ Self-checked (13-E.6): Share functions removed. Only buildPayoutArgs,
//    computePerMatchPayouts, and cleanGameName remain. Dead imports removed
//    (renderToStaticMarkup, createElement, jsPDF, all table components, logo
//    loader). runMatchNassau retained — still needed by computePerMatchPayouts.
//    cleanGameName kept here (not moved to shareUtils) so PayoutDisplay.jsx
//    import path is unchanged and cleanGameName remains in its natural home
//    alongside other payout/game-name utilities.

import { runMatchNassau } from '../engine/games.js';

// ── buildPayoutArgs ──────────────────────────────────────────────────────────
// ✅ Self-checked (13-C.6): `earlyDepartureOpts` pass-through added per
// PartialGameContract §4.4. payouts.js does not read this field yet — that's
// 13-C.8 work. Pass-through is required now so the proactive entry path can
// write the field without payout output changing (still computed as if the
// round were full). Default `{}` for byte-identical pre-13-C.6 behavior when
// no departures exist.
export function buildPayoutArgs(ar) {
  return {
    players:           ar.activePlayers,
    pars:              ar.pars,
    hcps:              ar.hcps,
    scores:            ar.scores,
    activeGames:       ar.activeGames,
    gameOpts:          ar.gameOpts,
    matches:             ar.matches             || [],
    strokePlayPlayers:   ar.strokePlayPlayers   || [],
    skinsPlayers:        ar.skinsPlayers        || [],
    stablefordPlayers:   ar.stablefordPlayers   || [],
    ninesPlayers:        ar.ninesPlayers        || [],
    sixesTeams:          ar.sixesTeams,
    sixesPlayers:        ar.sixesPlayers        || [],
    dotsPlayers:         ar.dotsPlayers         || [],
    dots:                ar.dots,
    dotEntries:          ar.dotEntries,
    courseHcps:          ar.courseHcps,
    minCourseHcp:        ar.minCourseHcp,
    manualPresses:       ar.manualPresses       || {},
    // 13-C.2/13-C.3: Round length + per-game ranges.
    // `roundStartHole`/`roundNumHoles` establish the round boundary; `gameRanges`
    // holds per-game overrides within that boundary (keyed by game name or
    // matchDef.id per PartialGameContract §4.3). Defaults preserve full-round
    // no-op behavior (invariant #13).
    roundStartHole:      ar.roundStartHole      ?? 0,
    roundNumHoles:       ar.roundNumHoles       ?? 18,
    gameRanges:          ar.gameRanges          ?? {},
    // 13-C.6: Per-player departure metadata. Pass-through only — payouts.js
    // ignores this field until 13-C.8 ships the engine-side reader. Default
    // `{}` so the field is always a defined object (no `undefined` surprises
    // in the engine call site).
    earlyDepartureOpts:  ar.earlyDepartureOpts  ?? {},
    // 13-C.8: Group-stop (Scenario B) metadata per App_Data_Model_Contract §10.
    // `earlyEndOpts` is { [gameKey]: SegmentedResolution } populated when the
    // last unresolved player triggers a group-stop. `lastCompletedHole` is
    // the hole index where the round ended for everyone. payouts.js gates
    // group-stop on lastCompletedHole < roundEndHole AND non-empty earlyEndOpts.
    earlyEndOpts:        ar.earlyEndOpts        ?? {},
    lastCompletedHole:   ar.lastCompletedHole,
  };
}

// ── computePerMatchPayouts ───────────────────────────────────────────────────
// 13-C.3: `gameRanges`, `roundStartHole`, `roundEndHole` are optional. Per-match
// range resolved via the matchDef.id / fallback key scheme (same as payouts.js).
//
// 13-C.7.6: `earlyDepartureOpts` feeds the engine departure data guardrail
// (PartialGameContract §14 invariant 21).
//
// 13-C.8: Engine departure handling expanded to honor SegmentedResolution
// per match (PartialGameContract §11.2). For each match:
//   • Aggregates per-player events + Scenario B group-stop into AggregatedResolution
//   • Returns null (filtered out) for matches where any player chose `abandon`
//   • Trims scores per-player for `end_at_k` (each departed player's tail past
//     their departureHole) and globally for group-stop (lastCompletedHole)
//   • Zeroes per-segment Pay/Abandon contributions to F/B/O matchCols
//   • Zeroes per-press Pay/Abandon contributions (trigger hole = manualPresses[..][depth-1])
//   • Returns `decoration` string for the SubHeader (e.g. "ended at hole 11,
//     paid Front only", "continued (Tom departed)") — null when no resolution
//     decoration is needed.
// Engine firewall preserved — runMatchNassau is called with already-trimmed
// scores; pay/abandon zeroing happens at the post-engine ledger stage.
//
// New positional signature (back-compat: trailing args default to no-op):
//   computePerMatchPayouts(matches, players, scores, hcps, courseHcps,
//     minCourseHcp, manualPresses, gameRanges, roundStartHole, roundEndHole,
//     earlyDepartureOpts, earlyEndOpts, lastCompletedHole)
export function computePerMatchPayouts(
  matches, players, scores, hcps, courseHcps, minCourseHcp, manualPresses,
  gameRanges = {}, roundStartHole = 0, roundEndHole = 17,
  earlyDepartureOpts = {},
  earlyEndOpts = {},
  lastCompletedHole,
) {
  if (!matches?.length) return [];

  const playerCount = players.length;

  // 13-C.7.6: Apply the engine departure data guardrail before any engine call.
  // (Inline to avoid scorecardUtils → components/ui circular import on the
  // share-image path.)
  if (earlyDepartureOpts && Object.keys(earlyDepartureOpts).length > 0) {
    const maxHole = new Array(playerCount).fill(Infinity);
    let anyCap = false;
    Object.entries(earlyDepartureOpts).forEach(([piStr, e]) => {
      const pi = Number(piStr);
      if (pi >= 0 && pi < playerCount && e && typeof e.departureHole === 'number') {
        maxHole[pi] = e.departureHole;
        anyCap = true;
      }
    });
    if (anyCap) {
      const filtered = [];
      for (let h = 0; h < 18; h++) {
        const row = scores[h] || new Array(playerCount).fill('');
        let mutated = false;
        let newRow = null;
        for (let pi = 0; pi < playerCount; pi++) {
          if (h > maxHole[pi] && row[pi] !== '' && row[pi] != null) {
            if (!mutated) { newRow = row.slice(); mutated = true; }
            newRow[pi] = '';
          }
        }
        filtered.push(mutated ? newRow : row);
      }
      scores = filtered;
    }
  }

  const subsetMin = (cHcps, idxs, globalMin, mode) => {
    if (mode !== 'netofflow' || !idxs?.length) return globalMin;
    return Math.min(...idxs.map(i => cHcps[i]));
  };

  // Resolve per-match range. Mirrors rangeFor() in payouts.js.
  const resolveMatchRange = (matchKey) => {
    const entry = gameRanges?.[matchKey];
    if (entry
        && Number.isInteger(entry.startHole)
        && Number.isInteger(entry.endHole)
        && entry.startHole >= roundStartHole
        && entry.endHole   <= roundEndHole
        && entry.startHole <  entry.endHole) {
      return { startHole: entry.startHole, endHole: entry.endHole };
    }
    return { startHole: roundStartHole, endHole: roundEndHole };
  };

  // 13-C.8: Group-stop is in effect only when lastCompletedHole < roundEndHole
  // AND earlyEndOpts contains at least one game resolution.
  const hasGroupStop = typeof lastCompletedHole === 'number'
                    && lastCompletedHole < roundEndHole
                    && earlyEndOpts
                    && Object.keys(earlyEndOpts).length > 0;
  const effectiveEndOpts            = hasGroupStop ? earlyEndOpts       : {};
  const effectiveLastCompletedHole  = hasGroupStop ? lastCompletedHole  : undefined;

  // 13-C.8: Aggregate per-match resolution (mirrors aggregateResolutionForGame
  // in payouts.js).
  const aggregateForMatch = (matchKey) => {
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
      const res = ev.entry.gameResolutions?.[matchKey];
      if (!res || !res.topLevel) continue;
      out.hasAnyResolution = true;
      const tl = res.topLevel;
      if (tl === 'abandon') { out.abandoned = true; continue; }
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
    if (effectiveEndOpts && effectiveEndOpts[matchKey] && typeof effectiveLastCompletedHole === 'number') {
      const ge = effectiveEndOpts[matchKey];
      out.hasAnyResolution = true;
      if (ge.topLevel === 'abandon') {
        out.abandoned = true;
      } else if (ge.topLevel === 'end_at_k') {
        out.groupStop = {
          hole:     effectiveLastCompletedHole,
          segments: { ...(ge.segments || {}) },
          presses:  { ...(ge.presses  || {}) },
        };
      } else if (ge.topLevel === 'continue' || ge.topLevel === 'exclude_player') {
        out.groupStop = { hole: effectiveLastCompletedHole, segments: {}, presses: {} };
      }
    }
    return out;
  };

  // Per-player + group-stop trim (mirrors applyResolutionToScores).
  const applyTrim = (s, agg) => {
    Object.entries(agg.endAtKByPlayer).forEach(([piStr, hole]) => {
      const pi = Number(piStr);
      const out = [];
      for (let h = 0; h < 18; h++) {
        const row = s[h] || new Array(playerCount).fill('');
        if (h > hole && row[pi] !== '' && row[pi] != null) {
          const newRow = row.slice();
          newRow[pi] = '';
          out.push(newRow);
        } else {
          out.push(row);
        }
      }
      s = out;
    });
    if (agg.groupStop) {
      const out = [];
      for (let h = 0; h < 18; h++) {
        const row = s[h] || new Array(playerCount).fill('');
        if (h > agg.groupStop.hole) {
          let mutated = false;
          let newRow = null;
          for (let pi = 0; pi < playerCount; pi++) {
            if (agg.excludedPlayers.includes(pi)) continue;
            if (row[pi] !== '' && row[pi] != null) {
              if (!mutated) { newRow = row.slice(); mutated = true; }
              newRow[pi] = '';
            }
          }
          out.push(mutated ? newRow : row);
        } else {
          out.push(row);
        }
      }
      s = out;
    }
    return s;
  };

  const decisionForSegment = (agg, segKey) => {
    if (agg.groupStop) {
      const v = agg.groupStop.segments?.[segKey];
      if (v === 'abandon' || v === 'pay') return v;
      return 'abandon';
    }
    if (agg.endAtK) {
      const v = agg.endAtK.segments?.[segKey];
      if (v === 'abandon' || v === 'pay') return v;
      return 'abandon';
    }
    return 'pay';
  };
  const decisionForPress = (agg, triggerHole) => {
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
  };

  const summarizeSegmentDecisions = (segs) => {
    const paid      = segs.filter(s => s.decision !== 'abandon');
    const abandoned = segs.filter(s => s.decision === 'abandon');
    if (abandoned.length === 0) return null;
    if (paid.length === 0)      return 'all abandoned';
    return `Paid ${paid.map(s => s.label).join(', ')} only.`;
  };

  const buildDecoration = (agg, segDecisions) => {
    if (!agg.hasAnyResolution) return null;
    const parts = [];
    if (agg.endAtK || agg.groupStop) {
      const hole     = (agg.groupStop ?? agg.endAtK).hole;
      const stopWord = agg.groupStop ? 'Round ended' : 'Ended';
      const segSummary = segDecisions ? summarizeSegmentDecisions(segDecisions) : null;
      if (segSummary) parts.push(`${stopWord} at hole ${hole + 1}. ${segSummary}`);
      else            parts.push(`${stopWord} at hole ${hole + 1}`);
    }
    if (Object.keys(agg.continueByPlayer).length > 0) {
      const names = Object.keys(agg.continueByPlayer)
        .map(piStr => players[Number(piStr)]?.name)
        .filter(Boolean);
      parts.push(names.length ? `continued (${names.join(', ')} departed)` : 'continued');
    }
    if (agg.excludedPlayers.length > 0) {
      const names = agg.excludedPlayers.map(pi => players[pi]?.name).filter(Boolean);
      parts.push(names.length ? `drop player (${names.join(', ')})` : 'drop player');
    }
    return parts.length ? parts.join(' · ') : null;
  };

  const out = [];
  matches.forEach((matchDef, mi) => {
    const matchKey = matchDef.id || `match_${mi}`;
    const agg      = aggregateForMatch(matchKey);

    // 13-C.8: Abandoned matches are filtered out — no breakdown row, no
    // bank contribution. (Bank contribution is computed by computePayouts;
    // this function only produces the display rows.)
    if (agg.abandoned) return;

    const isTeam   = matchDef.format === 'team';
    const sideA    = isTeam ? (matchDef.teamA || []) : [matchDef.p1];
    const sideB    = isTeam ? (matchDef.teamB || []) : [matchDef.p2];
    const involved = [...sideA, ...sideB].filter(i => players[i]);
    const mode     = matchDef.grossNetNOL ?? matchDef.scoring ?? 'net';
    const matchMin = subsetMin(courseHcps, involved, minCourseHcp, mode);
    const mp = {
      front:   (manualPresses||{})[`Match:${matchKey}:Front`]   || [],
      back:    (manualPresses||{})[`Match:${matchKey}:Back`]    || [],
      overall: (manualPresses||{})[`Match:${matchKey}:Overall`] || [],
    };
    const matchRange  = resolveMatchRange(matchKey);

    // 13-C.8: Trim scores per resolution (per-player end_at_k + group-stop).
    const localScores = applyTrim(scores, agg);

    const { front, back, overall } = runMatchNassau(
      localScores, players, matchDef, courseHcps, matchMin, mp, matchRange
    );
    const betF = matchDef.betFront   || 0;
    const betB = matchDef.betBack    || 0;
    const betO = matchDef.betOverall || 0;
    const lbl  = `Match ${String.fromCharCode(65 + mi)}`;

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

    // 13-C.8: Per-segment + per-press Pay/Abandon application.
    const segments = [
      { bets: front,   betAmt: betF, segKey: 'front',   delta: netF, pressList: mp.front   },
      { bets: back,    betAmt: betB, segKey: 'back',    delta: netB, pressList: mp.back    },
      { bets: overall, betAmt: betO, segKey: 'overall', delta: netO, pressList: mp.overall },
    ];
    segments.forEach(({ bets, betAmt, segKey, delta, pressList }) => {
      if (betAmt <= 0) return;
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

    const showSegPills = !!(agg.endAtK || agg.groupStop);
    const segDecisionsForHeader = showSegPills ? [
      betF > 0 ? { label: 'Front',   decision: decisionForSegment(agg, 'front')   } : null,
      betB > 0 ? { label: 'Back',    decision: decisionForSegment(agg, 'back')    } : null,
      betO > 0 ? { label: 'Overall', decision: decisionForSegment(agg, 'overall') } : null,
    ].filter(Boolean) : null;
    const decoration = buildDecoration(agg, segDecisionsForHeader);

    const rows = involved
      .map(pi => {
        const nm = players[pi]?.name;
        if (!nm) return null;
        const f = netF[nm] || 0;
        const b = netB[nm] || 0;
        const o = netO[nm] || 0;
        return {
          name:      nm,
          matchCols: [f, b, o, f + b + o],
          net:       f + b + o,
        };
      })
      .filter(r => r)
      .sort((a, b) => b.net - a.net);

    out.push({
      label:      lbl,
      colHeaders: ['Front', 'Back', 'Total', 'Game Total'],
      rows,
      decoration,
    });
  });
  return out;
}

// ── cleanGameName ────────────────────────────────────────────────────────────
export function cleanGameName(g) {
  return g.replace(/^[\p{Emoji}\s]+/u, '').trim();
}
