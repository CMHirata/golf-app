// ─── tables/SkinsTable.jsx ────────────────────────────────────────────────────
// ✅ Self-checked (13-G.2.fix): calcSkinsHole call updated to drop the round-shared
// hcps argument (Handicap_Contract §5). The engine reads players[pi].siArray[h]
// internally. Pre-fix, `hcps` was being passed as the `mode` argument, which
// caused the engine to compute mode-aware net values incorrectly and the
// scorecard skins grid to render no skins.
//
// RENDER ONLY — no business logic in this file.
// No scoring calculations. No match state computation.
// All logic must come from engine/ or scorecardUtils.js
//
// ✅ Self-checked (13-C.7.6): Departure handling per PartialGameContract
// §11.4 / §14 invariant 21. SkinsTable now consumes `earlyDepartureOpts`
// and applies the engine departure data guardrail (any score past a
// player's departureHole is ignored), plus the Skins-specific resolution
// handling for the four resolution tokens:
//   - 'continue':       drop the departing player from contestation
//                       starting at hole > departureHole. Earlier holes
//                       continue to count for them as winners.
//   - 'end_at_k':       stop computing skins past departureHole entirely.
//                       The skin range is truncated to [startHole,
//                       max(events' departureHole where end_at_k applies)].
//   - 'abandon':        skip Skins entirely — display "Game abandoned".
//   - 'exclude_player': retroactively remove the player from contestation
//                       from startHole through end. Their existing scores
//                       are still displayed in the column but they cannot
//                       win or tie any skin.
// Per-hole eligible subset is computed from the original skinsPlayerIdxs
// minus all players whose departure resolution removes them at that hole.
// If the subset drops below 2 players the hole has no skin (display "·").
//
// ✅ Self-checked (13-C.3): Accepts startHole/endHole props (default 0/17 for
// backward compat). The per-hole loop uses the range; half sections show only
// columns in range. Portrait half labels changed "Front 9 / Back 9" → "Front /
// Back" per owner decision Q4c. Landscape: if the range sits entirely on one
// half, a single 9-column table is rendered (per Q5). When the range spans
// both halves, landscape shows Front + Back + Total exactly as before but with
// only in-range columns. PartialGameContract §2.4, invariant #11.
//
// ✅ Self-checked (13-E.4): Removed `if (!rows.length) return null` empty-state
// gate so the GameSection shell renders from round start, matching Stableford /
// Nines / Sixes. Per-hole `cellVal` returns null when no row exists → `skinTd`
// renders `·`; totals and chip values render `·` via `|| '·'` fallback. The
// `abandoned` early-return remains above the main render (unaffected). H-28
// guardrail (`applyDepartureGuardrailToScores`) still fires before any engine
// call. H-13/H-15 (`'X'` handling) unaffected — the gate was a count check,
// not a value check.

import { calcSkinsHole } from '../../engine/games.js';
import { K, nameTd, scoringLabel, applyDepartureGuardrailToScores } from '../scorecard/scorecardUtils.js';
import { GameSection, GameTable, HalfLabel, TableDivider, ColNote, PlayerChips } from '../scorecard/GameSection.jsx';

export function SkinsTable({
  players, scores, hcps, opts, courseHcps, minCourseHcp, skinsPlayerIdxs, isLandscape,
  startHole = 0, endHole = 17,
  // 13-C.7.6: Per-player departure metadata. When provided, SkinsTable
  // applies the engine departure data guardrail and per-hole contestant
  // partitioning. Default `{}` preserves byte-identical pre-13-C.7.6
  // rendering when no departures exist.
  earlyDepartureOpts = {},
}) {
  const mode  = opts?.grossNetNOL ?? opts?.scoring ?? 'net';
  const carry = opts?.carryover !== false;

  const displayIdxs = skinsPlayerIdxs?.length ? skinsPlayerIdxs : players.map((_, i) => i);

  // 13-C.7.6: Apply engine departure data guardrail before any engine call.
  // This is the display-side mirror of payouts.js's applyDepartureGuardrail
  // and protects table consumers from honoring stale post-departure scores.
  const guardedScores = applyDepartureGuardrailToScores(scores, earlyDepartureOpts, players.length);

  // 13-C.7.6: Build the per-hole eligibility map and abandon flag from
  // earlyDepartureOpts and per-player gameResolutions['Skins'].
  //
  // Walk events in chronological order (sorted by departureHole, tie-broken
  // by playerIdx). For each event, inspect the Skins resolution:
  //   - 'abandon':        flag whole game — skip rendering hole results
  //   - 'end_at_k':       cap the skin computation range at this hole
  //   - 'continue':       remove player from eligibility for h > departureHole
  //   - 'exclude_player': remove player from eligibility for ALL holes
  //
  // If multiple events disagree (e.g. one says continue, another abandon),
  // the most-restrictive applies: abandon > end_at_k > continue/exclude.
  let abandoned = false;
  let endAtKHole = null; // highest departureHole where end_at_k was chosen

  // Per-player effective state at each hole. excludedFromAll[pi] = true
  // means the player was exclude_player'd; eligibleFromHoleMap[pi] = h
  // means the player is eligible for holes h <= departureHole only
  // (continue resolution).
  const excludedFromAll = {};
  const continueDepartureHole = {}; // pi → departureHole

  const events = Object.entries(earlyDepartureOpts || {})
    .map(([piStr, e]) => ({ pi: Number(piStr), entry: e }))
    .filter(x => x.entry && typeof x.entry.departureHole === 'number')
    .sort((a, b) => {
      const dh = a.entry.departureHole - b.entry.departureHole;
      return dh !== 0 ? dh : (a.pi - b.pi);
    });

  for (const ev of events) {
    const skinsRes = ev.entry.gameResolutions?.Skins;
    if (!skinsRes) continue;
    const tl = skinsRes.topLevel;
    if (tl === 'abandon') {
      abandoned = true;
      break;
    }
    if (tl === 'end_at_k') {
      const h = ev.entry.departureHole;
      if (endAtKHole === null || h > endAtKHole) endAtKHole = h;
      continue;
    }
    if (tl === 'continue') {
      continueDepartureHole[ev.pi] = ev.entry.departureHole;
      continue;
    }
    if (tl === 'exclude_player') {
      excludedFromAll[ev.pi] = true;
      continue;
    }
    // Unrecognized or unset resolution — leave eligibility untouched.
  }

  // Helper: returns the eligible playerIdx subset for hole h.
  const eligibleIdxsForHole = (h) => {
    return displayIdxs.filter(pi => {
      if (excludedFromAll[pi]) return false;
      const cdh = continueDepartureHole[pi];
      if (cdh != null && h > cdh) return false;
      return true;
    });
  };

  // 13-C.3: Range-derived hole arrays (for full round these equal FRONT/BACK/ALL18).
  // 13-C.7.6: Truncate at endAtKHole if any end_at_k resolution is on file.
  const effectiveEndHole = endAtKHole != null ? Math.min(endHole, endAtKHole) : endHole;
  const rangeHoles = [];
  for (let h = startHole; h <= effectiveEndHole; h++) rangeHoles.push(h);
  const frontHoles = rangeHoles.filter(h => h < 9);
  const backHoles  = rangeHoles.filter(h => h >= 9);
  const hasFront = frontHoles.length > 0;
  const hasBack  = backHoles.length  > 0;

  // Compute hole-by-hole skin results across the effective range. Carryover
  // counter only advances across holes inside the range — out-of-range holes
  // never contribute.
  //
  // 13-C.7.6: When abandoned, skip computation entirely. Otherwise use the
  // per-hole eligibility subset; holes where < 2 players remain produce no
  // skin row (no winner, no carryover advancement).
  const rows = []; let carryCount = 0;
  if (!abandoned) {
    for (const h of rangeHoles) {
      const eligible = eligibleIdxsForHole(h);
      if (eligible.length < 2) {
        // Not enough contestants — no skin possible. Hole produces nothing,
        // no carryover advance.
        continue;
      }
      const result = calcSkinsHole(h, guardedScores, players, mode, courseHcps, minCourseHcp, eligible);
      if (!result) break; // missing scores within the eligible subset
      if (result.tied) { carryCount++; rows.push({ h, tied: true }); }
      else { rows.push({ h, wi: result.wiIdx, value: carry ? 1 + carryCount : 1 }); carryCount = 0; }
    }
  }

  const totals = displayIdxs.map(pi => rows.reduce((s, r) => s + (r.wi === pi ? r.value : 0), 0));

  const cellVal = (displayPos, h) => {
    const pi = displayIdxs[displayPos];
    const r  = rows.find(r => r.h === h);
    if (!r) return null;
    if (r.tied) return 'tie';
    return r.wi === pi ? r.value : 0;
  };

  const skinTd = (v, h) => {
    if (v === null)  return <td key={h} style={{ textAlign: 'center', color: '#ddd', fontSize: 11 }}>·</td>;
    if (v === 'tie') return <td key={h} style={{ textAlign: 'center', color: '#bbb', fontSize: 11 }}>–</td>;
    if (v === 0)     return <td key={h} style={{ textAlign: 'center', color: '#ececec', fontSize: 11 }}>·</td>;
    return (
      <td key={h} style={{ textAlign: 'center', padding: '1px' }}>
        <span style={{ display: 'inline-block', width: 20, height: 18, lineHeight: '18px', fontSize: 10, fontWeight: 700, color: K.hdrClr, background: v > 1 ? '#c4aaf0' : K.totBg, borderRadius: 3 }}>{v}</span>
      </td>
    );
  };

  const renderHalf = (hs, label) => {
    if (!hs.length) return null;
    const halfTotals = displayIdxs.map((pi) =>
      rows.filter(r => hs.includes(r.h) && r.wi === pi).reduce((s, r) => s + r.value, 0)
    );
    const displayPlayers = displayIdxs.map(i => players[i]).filter(Boolean);
    return (
      <>
        <HalfLabel>{label}</HalfLabel>
        <div style={{ padding: '0 8px 4px' }}>
          <GameTable hs={hs} colHeader="Skins" headerBg={K.hdrBg} headerColor={K.hdrClr} totBg={K.totBg} totColor={K.totClr}>
            {displayPlayers.map((p, pos) => (
              <tr key={displayIdxs[pos]} style={{ background: K.row[pos % 2] }}>
                <td style={{ ...nameTd, color: K.hdrClr }}>{p.name}</td>
                {hs.map(h => skinTd(cellVal(pos, h), h))}
                <td style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: K.totClr, background: K.totBg, padding: '2px 4px' }}>{halfTotals[pos] || '·'}</td>
              </tr>
            ))}
          </GameTable>
        </div>
      </>
    );
  };

  const renderAll18 = () => {
    const displayPlayers = displayIdxs.map(i => players[i]).filter(Boolean);
    const frontTots = displayIdxs.map((pi) => rows.filter(r => frontHoles.includes(r.h) && r.wi === pi).reduce((s, r) => s + r.value, 0));
    const backTots  = displayIdxs.map((pi) => rows.filter(r => backHoles.includes(r.h)  && r.wi === pi).reduce((s, r) => s + r.value, 0));

    // 13-C.3 Q5: Single-half range → render just that half as a 9-hole table
    // (no Front+Back split, no F/B total columns — matches ScoreGrid layout).
    if (!hasFront || !hasBack) {
      const hs = hasFront ? frontHoles : backHoles;
      return (
        <div style={{ padding: '0 8px 4px' }}>
          <GameTable hs={hs} colHeader="Skins" headerBg={K.hdrBg} headerColor={K.hdrClr} totBg={K.totBg} totColor={K.totClr}>
            {displayPlayers.map((p, pos) => (
              <tr key={displayIdxs[pos]} style={{ background: K.row[pos % 2] }}>
                <td style={{ ...nameTd, color: K.hdrClr }}>{p.name}</td>
                {hs.map(h => skinTd(cellVal(pos, h), h))}
                <td style={{ textAlign: 'center', fontSize: 11, fontWeight: 800, color: K.totClr, background: K.totBg, padding: '2px 3px' }}>{totals[pos] || '·'}</td>
              </tr>
            ))}
          </GameTable>
        </div>
      );
    }

    return (
      <div style={{ padding: '0 8px 4px' }}>
        <GameTable landscape headerBg={K.hdrBg} headerColor={K.hdrClr} totBg={K.totBg} totColor={K.totClr}>
          {displayPlayers.map((p, pos) => (
            <tr key={displayIdxs[pos]} style={{ background: K.row[pos % 2] }}>
              <td style={{ ...nameTd, color: K.hdrClr }}>{p.name}</td>
              {frontHoles.map(h => skinTd(cellVal(pos, h), h))}
              <td style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: K.totClr, background: K.totBg, padding: '2px 3px' }}>{frontTots[pos] || '·'}</td>
              {backHoles.map(h => skinTd(cellVal(pos, h), h))}
              <td style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: K.totClr, background: K.totBg, padding: '2px 3px' }}>{backTots[pos] || '·'}</td>
              <td style={{ textAlign: 'center', fontSize: 11, fontWeight: 800, color: K.totClr, background: K.totBg, padding: '2px 3px' }}>{totals[pos] || '·'}</td>
            </tr>
          ))}
        </GameTable>
      </div>
    );
  };

  if (abandoned) {
    return (
      <GameSection title="Skins" badge={`${scoringLabel(mode)} · Carry ${carry ? 'on' : 'off'}`} color={K.hdrClr} borderColor={K.border}>
        <div style={{ padding: '12px 12px 16px', fontSize: 12, color: '#888', fontStyle: 'italic' }}>
          Game abandoned at early departure.
        </div>
      </GameSection>
    );
  }

  // 13-E.4: Empty-state behavior matches Stableford / Nines / Sixes — render
  // the GameSection shell with header skeleton from round start. No early-out
  // when `rows` is empty: per-hole `cellVal` returns null → `skinTd` renders
  // `·`; totals and chip values render `·` via the `|| '·'` fallback. The
  // `abandoned` early-return above is unaffected.
  const displayPlayers = displayIdxs.map(i => players[i]).filter(Boolean);

  return (
    <GameSection title="Skins" badge={`${scoringLabel(mode)} · Carry ${carry ? 'on' : 'off'}`} color={K.hdrClr} borderColor={K.border}>
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
      <PlayerChips players={displayPlayers} values={totals} chipBg={K.hdrBg} chipColor={K.hdrClr} leaderBg={K.totBg} leaderColor={K.totClr} fmtVal={v => v} subLabel="skins"/>
      <ColNote>Number = skins on that hole · darker = carryover · – = tied</ColNote>
    </GameSection>
  );
}
