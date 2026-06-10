// ✅ Self-checked (13-C.8): applyDepartureGuardrailToDotEntries extended
// to also discard companion entries where the EARNER has departed past
// the recorded hole (parts[5] check). Backward-compatible with legacy
// `team_special_for` keys. Cosmetic-only fix; primary entries (keyed by
// the earner's pi at parts[1]) were already filtered. No other changes.
//
// ─── scorecard/scorecardUtils.js ──────────────────────────────────────────────
// Display logic layer — bridges engine output and UI components.
//
// TWO CATEGORIES ONLY:
//   Category 1 — Pure formatters: no engine dependency, no side effects.
//   Category 2 — Derived state builders: call engine functions, interpret output.
//
// PROHIBITED: scoring math, reimplementing engine logic, localStorage access.
// TEST: if changing engine rules would change a function's output → move to engine.

import { DOTS_DEF } from '../../engine/games.js';
import { runWolf } from '../../engine/games.js';
import { strokesForMode } from '../../engine/handicap.js';
import { G, RED } from '../../components/ui.jsx';

// ── Layout constants (shared across all game tables) ──────────────────────────
export const COL_W    = 26;
export const TOT_W    = 36;
export const NAME_MIN = 80;

// ── Design token objects (shared style palettes per game) ─────────────────────
export const M  = { hdrBg: '#e8f4e8', hdrClr: '#1f4d1f', totBg: '#c8e0c8', totClr: '#1f4d1f', border: '#c8e0c8' };
export const MP = { bg: '#fffbe8', totBg: '#f5e099', clr: '#8a6000' };
export const N  = { hdrBg: '#e8f0fc', hdrClr: '#1a3a5c', totBg: '#c8d8f8', totClr: '#1a3a5c', row: ['#f0f5ff','#e8f0fc'], border: '#c8d8f8' };
export const S  = { hdrBg: '#fef3e8', hdrClr: '#7b3f00', totBg: '#fce4c4', totClr: '#7b3f00', row: ['#fffdf8','#fef9f0'], border: '#fce4c4' };
export const K  = { hdrBg: '#f2eafa', hdrClr: '#4a1580', totBg: '#dac8f5', totClr: '#4a1580', row: ['#f9f5ff','#f2eafa'], border: '#dac8f5' };
export const P  = { hdrBg: '#edf7ed', hdrClr: '#1a5c1a', totBg: '#c8e8c8', totClr: '#1a5c1a', row: ['#f5fbf5','#edf7ed'], border: '#c8e8c8' };
export const SX     = { hdrBg: '#e8f5e9', hdrClr: '#2e7d32', totBg: '#c8e6c9', totClr: '#2e7d32', border: '#c8e6c9' };
export const SX_A   = '#d0ebd0';
export const SX_B   = '#ffe8cc';
export const SX_AC  = '#27ae60';
export const SX_BC  = '#e07020';
export const SP_CLR = '#7b3fa0';
export const SP_BG  = '#f5eefa';
export const SP_HDR = '#f0e4f8';

// Hole range constants
export const FRONT_H = [0,1,2,3,4,5,6,7,8];
export const BACK_H  = [9,10,11,12,13,14,15,16,17];
export const ALL18_H = [...FRONT_H, ...BACK_H];

// Shared name cell style for game tables
export const nameTd = { padding: '2px 6px', fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };

/**
 * resolveDisplayNames(players) → string[]
 * Category 1 — Pure formatter. No engine dependency.
 *
 * Given an array of player objects, returns a parallel array of display-name
 * strings for use in chips and headers throughout the UI.
 *
 * Rules:
 *   1. Default label = first name only.
 *   2. First-name collision → append last initial (e.g. "Chris H").
 *   3. First-name + last-initial collision (e.g. Chris Hirata vs Chris Hightower)
 *      → flag with `stacked: true` so the caller can render first/last on two lines.
 *      The `name` property in this case is still the first name; the caller reads
 *      `lastName` to render the second line.
 *
 * Returns array of objects: { name: string, lastName: string|null, stacked: boolean }
 * Callers that only need a flat string can use the `name` property directly when
 * `stacked` is false, or `name + ' ' + lastName` when stacked is true.
 */
export function resolveDisplayNames(players) {
  const firstNames = players.map(p => (p?.name || '?').trim().split(/\s+/)[0]);
  const lastNames  = players.map(p => {
    const parts = (p?.name || '').trim().split(/\s+/);
    return parts.length >= 2 ? parts[parts.length - 1] : '';
  });
  const lastInits = lastNames.map(ln => ln ? ln[0].toUpperCase() : '');

  // Pass 1: detect first-name collisions
  const withInit = firstNames.map((fn, i) => {
    const collision = firstNames.some((other, j) => j !== i && other === fn);
    if (!collision) return { label: fn, hasInit: false };
    return { label: lastInits[i] ? `${fn} ${lastInits[i]}` : fn, hasInit: !!lastInits[i] };
  });

  // Pass 2: detect label collisions after adding initials (e.g. Chris H vs Chris H)
  return withInit.map((entry, i) => {
    if (!entry.hasInit) return { name: entry.label, lastName: null, stacked: false };
    const labelCollision = withInit.some((other, j) => j !== i && other.label === entry.label);
    if (!labelCollision) return { name: entry.label, lastName: null, stacked: false };
    // Still colliding after initial — go stacked (first name + full last name)
    return { name: firstNames[i], lastName: lastNames[i] || null, stacked: true };
  });
}

// ── 13-C.7.6: Engine departure data guardrail (display side) ──────────────────
//
// Per PartialGameContract §14 invariant 21, ANY score stored at hole
// > departureHole for a departed player is treated as if absent. The engine
// (payouts.js) applies this once at compute time. Display-side consumers
// (game tables: SkinsTable, RoundSummaryModal, etc.) that import engine
// helpers like `calcSkinsHole` directly bypass payouts.js and would
// otherwise see and honor stale post-departure scores. This helper
// produces a guardrail-applied scores array that table components MUST
// use instead of raw `scores`.
//
// The result is a defensively-clean copy: only modified rows/cells are
// new arrays; unaffected holes share references with the input. Callers
// can swap this in without breaking memoization downstream as long as
// `earlyDepartureOpts` is stable across renders (which it is — it lives
// in activeRound and only changes via resolver writes).
//
// Returns the input scores array unchanged when no departures are present.
export function applyDepartureGuardrailToScores(scores, earlyDepartureOpts, playerCount) {
  if (!scores) return scores;
  if (!earlyDepartureOpts || Object.keys(earlyDepartureOpts).length === 0) {
    return scores;
  }
  const maxHoleForPlayer = new Array(playerCount).fill(Infinity);
  let anyCap = false;
  Object.entries(earlyDepartureOpts).forEach(([piStr, entry]) => {
    const pi = Number(piStr);
    if (pi >= 0 && pi < playerCount && entry && typeof entry.departureHole === 'number') {
      maxHoleForPlayer[pi] = entry.departureHole;
      anyCap = true;
    }
  });
  if (!anyCap) return scores;

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

// 13-C.7.6: Engine departure data guardrail (Dots-side).
//
// `dotEntries` is keyed by `${hole}_${playerIdx}_${dotId}` and read by
// DotsTable, MatchNassauTable team-special companions, and any other
// consumer that aggregates dots. Per PartialGameContract §14 invariant 21,
// any dot entry for player `pi` at hole `h > departureHole` is ignored
// regardless of how it ended up in storage (e.g., assigned before the
// long-press X gesture, imported from legacy data, etc.).
//
// Returns a filtered shallow copy with the offending keys removed, or the
// input map unchanged when no departures are present. The original map is
// never mutated.
//
// 13-C.8 amendment: companion entries are also discarded when the EARNER
// has departed past the recorded hole. Companion key shape is
//   `${h}_${partnerPi}_team_dot_for_${earnerPi}`           (current)
//   `${h}_${partnerPi}_team_special_for_${earnerPi}`       (legacy v1.x)
// The guardrail's primary check uses parts[1] (partner pi). The companion
// check additionally extracts the earner pi from parts[5] and discards
// the entry when the earner has departed before the hole. Without this,
// a partner could earn a credit at a hole the earner never reached —
// cosmetically wrong on the scorecard even though payouts already exclude
// the earner's primary contribution. Affects Dots display only; payouts
// engine is unchanged because the primary entries (`${h}_${earnerPi}_${id}`)
// were already discarded.
export function applyDepartureGuardrailToDotEntries(dotEntries, earlyDepartureOpts) {
  if (!dotEntries) return dotEntries;
  if (!earlyDepartureOpts || Object.keys(earlyDepartureOpts).length === 0) {
    return dotEntries;
  }
  const maxHoleForPlayer = {};
  let anyCap = false;
  Object.entries(earlyDepartureOpts).forEach(([piStr, entry]) => {
    if (entry && typeof entry.departureHole === 'number') {
      maxHoleForPlayer[piStr] = entry.departureHole;
      anyCap = true;
    }
  });
  if (!anyCap) return dotEntries;

  let mutated = false;
  let out = dotEntries;
  for (const key of Object.keys(dotEntries)) {
    // Key shape: `${h}_${pi}_${dotId}` — split on first two underscores.
    const m = key.match(/^(\d+)_(\d+)_/);
    if (!m) continue;
    const h     = Number(m[1]);
    const piStr = m[2];
    const cap   = maxHoleForPlayer[piStr];
    if (cap !== undefined && h > cap) {
      if (!mutated) { out = { ...dotEntries }; mutated = true; }
      delete out[key];
      continue;
    }
    // 13-C.8: Companion-entry earner check.
    // Parse `${h}_${partnerPi}_team_dot_for_${earnerPi}` or legacy
    // `${h}_${partnerPi}_team_special_for_${earnerPi}`. Split on `_`:
    //   parts[0] = h, parts[1] = partnerPi, parts[2] = 'team',
    //   parts[3] = 'dot' | 'special', parts[4] = 'for', parts[5] = earnerPi
    const parts = key.split('_');
    if (parts.length >= 6
        && parts[2] === 'team'
        && (parts[3] === 'dot' || parts[3] === 'special')
        && parts[4] === 'for') {
      const earnerStr = parts[5];
      const earnerCap = maxHoleForPlayer[earnerStr];
      if (earnerCap !== undefined && h > earnerCap) {
        if (!mutated) { out = { ...dotEntries }; mutated = true; }
        delete out[key];
      }
    }
  }
  return out;
}

// ── Category 1 — Pure formatters ──────────────────────────────────────────────

/**
 * Format a match lead state into a display string and color.
 * Returns { text, color }.
 *   "AS"      — All Square (lead === 0)
 *   "{n}UP"   — leading, match open
 *   "{n}&{h}" — leading, match closed
 *   "—"       — no holes played yet
 */
export function fmtLead(lead, matchOver, holesLeft) {
  if (lead === 0) return { text: 'AS', color: '#3a3abd' };
  const n = Math.abs(lead);
  const t = matchOver ? `${n}&${holesLeft}` : `${n}UP`;
  return lead > 0 ? { text: t, color: G } : { text: t, color: RED };
}

/**
 * Scoring mode label for game card badges.
 * 'gross' → 'Gross', 'netofflow' → 'NOL', anything else → 'Net'
 */
export const scoringLabel = m => m === 'gross' ? 'Gross' : m === 'netofflow' ? 'NOL' : 'Net';

/**
 * Returns true if the matchDef is a Nassau (has Front or Back bet).
 * Single authoritative display-layer test for Nassau vs. straight Match Play.
 * Note: engine also exports isNassauMatch — use that in engine code, this in display code.
 */
export function isNassauMatchDisplay(matchDef) {
  return (matchDef?.betFront > 0) || (matchDef?.betBack > 0);
}

/**
 * Restore dot definitions after JSON serialization (Dots Contract §12).
 * Renamed from restoreAutoWhen in v2.0.
 *
 * Handles three restoration tasks:
 * 1. Re-attaches autoWhen functions (stripped by JSON) for auto dots (ace/eagle/birdie).
 * 2. Restores multi field from DOTS_DEF for built-ins if absent (old rounds predate the field).
 * 3. Migrates pts → value for rounds saved before v2.0.
 *
 * MUST be called before using dots from any state that passed through localStorage.
 * Source of truth is always DOTS_DEF in games.js.
 *
 * Custom dots (id starts with 'c_'): no autoWhen (always auto:false);
 * multi defaults to true if absent; value migrated from pts if absent.
 */
export function restoreDotDefs(dots) {
  if (!dots?.length) return dots;
  return dots.map(sp => {
    const def = DOTS_DEF.find(d => d.id === sp.id);
    let restored = sp;
    // 1. Re-attach autoWhen for auto dots
    if (def?.autoWhen && !sp.autoWhen)
      restored = { ...restored, autoWhen: def.autoWhen };
    // 2. Restore multi if absent
    if (restored.multi === undefined)
      restored = { ...restored, multi: def ? (def.multi ?? false) : true };
    // 3. v2.0 migration: pts → value
    if (restored.value === undefined) {
      const fallback = restored.pts ?? (def ? def.value : 1);
      restored = { ...restored, value: fallback };
    }
    return restored;
  });
}

// Backward-compatibility alias — components updated in Sprint 11 but
// any lingering references will still resolve correctly.
export const restoreAutoWhen = restoreDotDefs;

// ── Category 2 — Derived state builders ──────────────────────────────────────

/**
 * computeNolDotOptions — Category 2 derived state builder.
 *
 * Returns the array of qualifying NOL subset pill options for the unified
 * dot mode control. The base 'Net' and 'NOL' segments are NOT included —
 * ScorecardPage adds those unconditionally based on hasNet / hasNOL.
 *
 * A game qualifies when its resolved participant subset excludes the round's
 * global low-handicap player: subsetMin < minCourseHcp.
 * Empty subset array → all players participate → subsetMin === minCourseHcp
 * → does not qualify (consistent with payouts.js subsetMin() behavior).
 *
 * Returns Array<{ value: string, label: string, subsetIdxs: number[] }>
 *   value      — nolDotGame state string ('Skins', 'Match:m_123_abc', etc.)
 *   label      — display label for the pill segment ('NOL Skins', 'NOL Match A', …)
 *   subsetIdxs — resolved participant indices (used to compute effectiveMinCourseHcp
 *                and nonParticipantIdxs in ScorecardPage)
 */
export function computeNolDotOptions({
  activeGames, gameOpts, matches,
  skinsPlayers, stablefordPlayers, ninesPlayers, strokePlayPlayers, sixesPlayers,
  courseHcps, minCourseHcp,
}) {
  const opts = [];
  const n = courseHcps.length;
  const allIdxs = Array.from({ length: n }, (_, i) => i);

  // Resolve a subset: empty array means all players
  const resolve = arr => (arr && arr.length > 0) ? arr : allIdxs;
  const subMin  = idxs => Math.min(...idxs.map(i => courseHcps[i]));
  // A subset qualifies when its minimum courseHcp is HIGHER than the full-field
  // minimum — meaning the round's low-handicap player is excluded from the subset.
  // Lower courseHcp = better player. Excluding the low player raises the subset min.
  const qualifies = idxs => subMin(idxs) > minCourseHcp;

  // Named subset games — only qualify if the game is active AND in NOL mode
  // AND the participant subset excludes the round's low-handicap player.
  const isNOL = key => {
    const opts = gameOpts?.[key] || {};
    return (opts.grossNetNOL ?? opts.scoring) === 'netofflow';
  };

  const subsetGames = [
    { key: 'Skins',       players: skinsPlayers,      value: 'Skins',   label: 'NOL Skins'   },
    { key: 'Stableford',  players: stablefordPlayers, value: 'Stab',    label: 'NOL Stab'    },
    { key: 'Nines',       players: ninesPlayers,       value: 'Nines',   label: 'NOL Nines'   },
    { key: 'Stroke Play', players: strokePlayPlayers,  value: 'Stroke',  label: 'NOL Stroke'  },
    { key: 'Sixes',       players: sixesPlayers,       value: 'Sixes',   label: 'NOL Sixes'   },
  ];

  for (const { key, players, value, label } of subsetGames) {
    if (!activeGames.includes(key)) continue;
    if (!isNOL(key)) continue;
    const idxs = resolve(players);
    if (qualifies(idxs)) opts.push({ value, label, subsetIdxs: idxs });
  }

  // Match instances — qualify only when the match's own grossNetNOL is 'netofflow'
  // AND the participant set excludes the low player.
  if (activeGames.includes('Match / Nassau')) {
    (matches || []).forEach((m, idx) => {
      const matchMode = m.grossNetNOL ?? m.scoring ?? 'net';
      if (matchMode !== 'netofflow') return;
      const letter   = String.fromCharCode(65 + idx);
      const involved = m.format === 'team'
        ? [...(m.teamA || []), ...(m.teamB || [])]
        : [m.p1, m.p2].filter(p => p != null);
      if (!involved.length) return;
      if (qualifies(involved)) {
        opts.push({
          value:      `Match:${m.id}`,
          label:      `NOL Match ${letter}`,
          subsetIdxs: involved,
        });
      }
    });
  }

  // ── Grouping pass ────────────────────────────────────────────────────────
  // Games with identical participant sets produce identical dot display —
  // same effectiveMinCourseHcp, same nonParticipantIdxs. Merge them into
  // one button to avoid redundant options.
  //
  // Fingerprint: sorted subsetIdxs joined as a string — e.g. "1,2,3".
  // Used only for grouping; never stored or exposed to the UI.
  //
  // Merged entry shape:
  //   value      — fingerprint string (e.g. "1,2,3") used as nolDotGame value
  //   label      — short game names joined with " / " (e.g. "NOL Skins / Match A")
  //   subsetIdxs — the shared participant index array
  //
  // When only one game has a given fingerprint, value stays as the original
  // single-game value string for readability (e.g. 'Skins' not '1,2,3').

  const grouped = new Map(); // fingerprint → { value, labels[], subsetIdxs }

  for (const opt of opts) {
    const fp = [...opt.subsetIdxs].sort((a, b) => a - b).join(',');
    if (!grouped.has(fp)) {
      grouped.set(fp, { value: opt.value, fp, labels: [opt.label], subsetIdxs: opt.subsetIdxs });
    } else {
      const g = grouped.get(fp);
      g.labels.push(opt.label);
      // When multiple games share a fingerprint, use the fingerprint as the
      // stable value (avoids ambiguity about which game's value to use).
      g.value = fp;
    }
  }

  return Array.from(grouped.values()).map(g => ({
    value:      g.value,
    label:      g.labels.join(' / '),
    subsetIdxs: g.subsetIdxs,
  }));
}

/**
 * Build per-hole lead state for a match bet.
 * holeWinFn: (holeIndex) → 1 | 2 | 'a' | 'b' | 'half' | 0 | null
 * runHoles: array of 0-based hole indices this bet covers.
 * Returns: object keyed by hole index → { lead, matchOver, holesLeft }
 */
export function buildLeadState(holeWinFn, runHoles) {
  let lead = 0, matchOver = false;
  const state = {};
  let played = 0;
  for (const h of runHoles) {
    const w = holeWinFn(h);
    if (w === null) break;
    if (!matchOver) {
      const wVal = (w === 1 || w === 'a') ? 1 : (w === 2 || w === 'b') ? -1 : 0;
      lead += wVal;
      played++;
      const holesLeft = runHoles.length - played;
      if (Math.abs(lead) > holesLeft) matchOver = true;
    }
    state[h] = { lead, matchOver, holesLeft: runHoles.length - played };
  }
  return state;
}

/**
 * Returns the last hole index in `holes` for which holeWinFn returns non-null.
 */
export function lastScoredInHoles(holeWinFn, holes) {
  let last = null;
  for (const h of holes) {
    if (holeWinFn(h) !== null) last = h; else break;
  }
  return last;
}

/**
 * Returns the number of handicap stroke dots for a score cell.
 */
export function getStrokeDotCount(courseHcp, hcpRank, minCourseHcp, mode) {
  return strokesForMode(courseHcp, hcpRank, minCourseHcp, mode || 'net');
}

/**
 * parRelative(score, par) → 'eagle' | 'birdie' | 'par' | 'bogey' | 'double_bogey'
 * Category 1 — Pure formatter. No engine dependency.
 *
 * Returns the par-relative label for a gross score on a given hole par.
 * Returns null when either argument is missing/falsy (caller suppresses indicator).
 * 'eagle' covers hole-in-one and albatross (score ≤ par − 2).
 * 'double_bogey' covers triple-bogey and worse (score ≥ par + 2).
 */
export function parRelative(score, par) {
  if (!par || score == null || score === '' || score === 'X') return null;
  const s = typeof score === 'string' ? parseInt(score, 10) : score;
  if (!Number.isFinite(s) || s <= 0) return null;
  const diff = s - par;
  if (diff <= -2) return 'eagle';
  if (diff === -1) return 'birdie';
  if (diff === 0)  return 'par';
  if (diff === 1)  return 'bogey';
  return 'double_bogey';
}

// ── buildWolfState — Category 2 derived state builder ─────────────────────────
// Calls runWolf and returns a WolfResult-shaped object for WolfTable.
// Wolf_Contract.md §8.3 / ARCHITECTURE_FOUNDATIONS §2.
// ScorecardPage calls this and passes the result to WolfTable as a prop.
//
// Returns null when Wolf is not active, player count !== 4, or opts absent.

export function buildWolfState({ scores, players, gameOpts, wolfPicks, courseHcps, minCourseHcp }) {
  if (!players || players.length !== 4) return null;
  const opts = gameOpts?.Wolf;
  if (!opts) return null;
  return runWolf(scores, players, opts, wolfPicks || {}, courseHcps, minCourseHcp);
}
