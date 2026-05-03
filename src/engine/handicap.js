// ✅ Self-checked (13-G.2): Added buildPlayerSI export (Handicap_Contract §2.8).
// xGrossScore and escTotal now take siArray (per-player) instead of round-shared
// hcps array — same shape, same indexing; callers pass players[pi].siArray.
// All other exports unchanged. isFemale exported for caller use.
//
// ─── handicap.js ─────────────────────────────────────────────────────────────
// USGA handicap math. No React. Fully unit-testable.
//
// KEY DISTINCTION:
//   Handicap Index  = the portable number on your GHIN card (e.g. 8.2, +5.4)
//   Course Handicap = strokes you get/give at a specific course/tee
//                   = Index × (Slope/113) + (Rating - Par)  → rounded to integer
//
// Plus handicaps (e.g. +5.4) are stored as negative numbers internally (-5.4).
// A player with a +5 course handicap GIVES 5 strokes back — they receive 0
// strokes on any hole, and for net off low purposes others get extra strokes
// relative to them.

export const DEF_PARS = [4,4,3,5,4,3,4,5,4, 4,3,5,4,4,3,5,4,4];
export const DEF_HCP  = [7,11,15,1,5,17,3,9,13, 8,16,2,6,12,18,4,10,14];

// ─── Parsing ─────────────────────────────────────────────────────────────────

/**
 * Parse a handicap index string to a float.
 * Handles plus handicaps entered as "+5.4", "5.4+", or just "-5.4".
 * Plus handicaps are returned as negative numbers.
 */
export function parseIndex(raw) {
  if (raw === null || raw === undefined || raw === '') return 0;
  const s = String(raw).trim();
  if (s.startsWith('+') || s.endsWith('+')) {
    return -(parseFloat(s.replace(/\+/g, '')) || 0);
  }
  return parseFloat(s) || 0;
}

/**
 * Compute course handicap from handicap index.
 * courseHandicap = round(Index x Slope/113 + (Rating - Par))
 * Returns a signed integer — negative means plus handicap (gives strokes).
 */
export function courseHandicap(index, slope, rating, par) {
  const idx = typeof index === 'string' ? parseIndex(index) : (index || 0);
  if (!slope || !rating || !par) return Math.round(idx);
  return Math.round(idx * (slope / 113) + (rating - par));
}

/**
 * Legacy helper — used where we need the integer course handicap.
 * Accepts raw ghin string and optional tee data.
 */
export const chp = (ghin, slope, rating, par) => {
  const idx = parseIndex(ghin);
  if (slope && rating && par) return courseHandicap(idx, slope, rating, par);
  return Math.round(idx);
};

// ─── Stroke allocation ────────────────────────────────────────────────────────

/**
 * How many strokes does a player receive on a specific hole?
 * courseHcp: signed integer course handicap
 * rank: hole stroke index 1-18 (1 = hardest)
 *
 * Standard allocation: a player with courseHcp 20 gets:
 *   - 1 stroke on all 18 holes (rank 1-18)
 *   - 2 strokes on the 2 hardest holes (rank 1-2)
 */
export function hdcpStrokesFromCourseHcp(courseHcp, rank) {
  if (courseHcp <= 0) return 0;
  return Math.floor(courseHcp / 18) + (rank <= courseHcp % 18 ? 1 : 0);
}

/** Net off low: strokes relative to the lowest course handicap in the group. */
function netOffLow(gross, courseHcp, minCourseHcp, rank) {
  const diff = courseHcp - minCourseHcp;
  const strokes = Math.floor(diff / 18) + (rank <= diff % 18 ? 1 : 0);
  return gross - strokes;
}

/** Standard net: just subtract stroke allocation. */
function netOf(gross, courseHcp, rank) {
  return gross - hdcpStrokesFromCourseHcp(courseHcp, rank);
}

/**
 * How many strokes does this player receive on this hole for a given scoring mode?
 * Returns the count (0, 1, or 2) for UI dot display.
 */
export function strokesForMode(courseHcp, hcpRank, minCourseHcp, mode) {
  if (mode === 'gross') return 0;
  if (mode === 'netofflow') {
    const diff = (courseHcp || 0) - (minCourseHcp || 0);
    return Math.floor(diff / 18) + (hcpRank <= diff % 18 ? 1 : 0);
  }
  return hdcpStrokesFromCourseHcp(courseHcp || 0, hcpRank);
}

/** Apply the correct scoring mode to a gross score. */
export function scoreForMode(gross, courseHcp, rank, minCourseHcp, mode) {
  if (!gross) return null;
  if (mode === 'gross')     return gross;
  if (mode === 'netofflow') return netOffLow(gross, courseHcp, minCourseHcp, rank);
  return netOf(gross, courseHcp, rank);
}

/**
 * Compute the gross value for a player who picked up ('X') on a hole.
 * This equals the ESC maximum (Net Double Bogey) for that hole, so no
 * further ESC capping is needed when this value is used in escTotal().
 *
 * Formula: par + 2 + hdcpStrokes(full Net courseHcp)
 * Always returns ≥ par + 2. Uses full Net courseHcp — never NOL offset.
 *
 * 13-G.2 / Handicap_Contract §5: siArray is the PER-PLAYER stroke index array
 * (built at round-start via buildPlayerSI). Callers pass players[pi].siArray.
 *
 * @param {number} holeIdx   — zero-based hole index (0–17)
 * @param {number} courseHcp — signed integer course handicap for this player
 * @param {Array}  siArray   — per-player SI array (rank 1–18 per hole)
 * @param {Array}  pars      — par[hole] for all 18 holes
 * @returns {number} Gross value for an X score on this hole
 */
export function xGrossScore(holeIdx, courseHcp, siArray, pars) {
  return (pars[holeIdx] || 0) + 2 + hdcpStrokesFromCourseHcp(courseHcp, siArray[holeIdx]);
}

/**
 * Compute a player's Adjusted Gross Score (AGS) for GHIN posting purposes,
 * applying the USGA World Handicap System Net Double Bogey cap per hole.
 *
 * Per-hole cap: par + 2 (double bogey) + hdcpStrokesFromCourseHcp(courseHcp, rank)
 * This is "Net Double Bogey" — the maximum score per hole since 2020 WHS.
 * The strokes term uses standard net allocation (not NOL), regardless of the
 * scoring mode used for any active game.
 *
 * 'X' scores (player picked up) are already ESC-capped by definition —
 * xGrossScore() equals the ESC maximum for that hole. They are substituted
 * directly rather than parsed via parseInt (which would return NaN → 0).
 *
 * Only scored holes (gross > 0 or 'X') contribute. Unscored holes ('' / null)
 * are skipped so the function works correctly mid-round.
 *
 * 13-G.2 / Handicap_Contract §5: siArray is the PER-PLAYER stroke index array
 * (built at round-start via buildPlayerSI). Callers pass players[pi].siArray.
 *
 * @param {Array}  scores    — scores[hole][pi], the full 18-hole score array
 * @param {number} pi        — player index
 * @param {Array}  pars      — par[hole] for all 18 holes
 * @param {Array}  siArray   — per-player SI array (rank 1–18 per hole)
 * @param {number} courseHcp — signed integer course handicap for this player
 * @returns {number} Total adjusted gross score (0 if no holes scored)
 */
export function escTotal(scores, pi, pars, siArray, courseHcp) {
  let total = 0;
  for (let h = 0; h < 18; h++) {
    const raw = scores[h]?.[pi];
    // 'X' is already ESC-capped — use xGrossScore directly, no further cap needed.
    if (raw === 'X') {
      total += xGrossScore(h, courseHcp, siArray, pars);
      continue;
    }
    const gross = parseInt(raw) || 0;
    if (!gross) continue;
    const cap = (pars[h] || 0) + 2 + hdcpStrokesFromCourseHcp(courseHcp, siArray[h]);
    total += Math.min(gross, cap);
  }
  return total;
}

// ─── Stableford ──────────────────────────────────────────────────────────────
// Modified Stableford scoring (default):
//   d = par - net_score  (positive = under par)
//   albatross (+3) = 5, eagle (+2) = 4, birdie (+1) = 3
//   par (0) = 2, bogey (-1) = 1, double bogey or worse = 0
//
// KEY: d = par − net. Positive d = under par (good score). Key '3' means
// albatross (+3) = 5 pts; '-3' means triple bogey or worse = 0 pts.
// Lower/more-negative key → worse score. This is counterintuitive — the sign
// follows the "par minus net" convention, not a points scale.
export const DEFAULT_STAB = { '-3':0, '-2':0, '-1':1, '0':2, '1':3, '2':4, '3':5, '4':6 };

export function stabPts(gross, par, courseHcp, rank, minCourseHcp, mode, stabTable) {
  if (!gross) return null;
  const net = scoreForMode(gross, courseHcp, rank, minCourseHcp, mode || 'net');
  const d   = Math.max(-3, Math.min(4, par - net));
  const t   = stabTable || DEFAULT_STAB;
  return t[String(d)] ?? 0;
}

// ─── Interleaved 18-hole layout from two nines ────────────────────────────────
export function buildLayout(nines, frontName, backName) {
  const front = nines.find(n => n.name === frontName) || nines[0];
  const back  = nines.find(n => n.name === backName)  || nines[1] || nines[0];

  const fp = front?.pars      || DEF_PARS.slice(0, 9);
  const bp = back?.pars       || DEF_PARS.slice(9);
  const fh = front?.handicaps || [1,3,5,7,9,11,13,15,17];
  const bh = back?.handicaps  || [2,4,6,8,10,12,14,16,18];

  const cf = new Array(9);
  const cb = new Array(9);
  [...fh].map((h,i) => ({h,i})).sort((a,b) => a.h-b.h).forEach(({i}, r) => cf[i] = 2*r+1);
  [...bh].map((h,i) => ({h,i})).sort((a,b) => a.h-b.h).forEach(({i}, r) => cb[i] = 2*r+2);

  return {
    pars:      [...fp, ...bp],
    hcps:      [...cf, ...cb],
    frontName: front?.name || 'Front',
    backName:  back?.name  || 'Back',
  };
}

/**
 * Gender-aware layout — extends buildLayout with women's par and SI arrays.
 * Handicap_Contract §2.7.
 *
 * Returns all buildLayout fields plus:
 *   parsWomen       — women's per-hole par array, or null if identical to men's / absent
 *   hcpsWomen       — women's combined SI (interleaved), or null if data absent on either nine
 *   parsWomenDiffer — true if any hole's parsWomen !== pars
 *   hasWomenSI      — true if handicapsWomen present on both active nines
 */
export function buildGenderLayout(nines, frontName, backName) {
  const base  = buildLayout(nines, frontName, backName);
  const front = nines.find(n => n.name === frontName) || nines[0];
  const back  = nines.find(n => n.name === backName)  || nines[1] || nines[0];

  // Women's par — fall back to men's per nine if absent
  const fpW = front?.parsWomen?.length === 9 ? front.parsWomen : (front?.pars || DEF_PARS.slice(0, 9));
  const bpW = back?.parsWomen?.length  === 9 ? back.parsWomen  : (back?.pars  || DEF_PARS.slice(9));
  const rawParsWomen = [...fpW, ...bpW];
  const parsWomenDiffer = rawParsWomen.some((p, i) => p !== base.pars[i]);
  const parsWomen = parsWomenDiffer ? rawParsWomen : null;

  // Women's SI — only produce if BOTH nines have handicapsWomen
  const fhW = front?.handicapsWomen;
  const bhW = back?.handicapsWomen;
  const hasWomenSI = !!(fhW?.length === 9 && bhW?.length === 9);
  let hcpsWomen = null;
  if (hasWomenSI) {
    const cfW = new Array(9);
    const cbW = new Array(9);
    [...fhW].map((h,i) => ({h,i})).sort((a,b) => a.h-b.h).forEach(({i}, r) => cfW[i] = 2*r+1);
    [...bhW].map((h,i) => ({h,i})).sort((a,b) => a.h-b.h).forEach(({i}, r) => cbW[i] = 2*r+2);
    hcpsWomen = [...cfW, ...cbW];
  }

  return { ...base, parsWomen, hcpsWomen, parsWomenDiffer, hasWomenSI };
}

// ─── Gender helper ────────────────────────────────────────────────────────────
export function isFemale(player) {
  const g = (player?.gender || '').toLowerCase();
  return g === 'f' || g === 'female' || g === 'w';
}

/**
 * Build the per-player stroke index array (Handicap_Contract §2.8).
 *
 * Returns the 18-element SI array resolved by player gender:
 *   - Female + layout.hcpsWomen present → layout.hcpsWomen
 *   - Otherwise → layout.hcps
 *
 * No interpolation, no per-hole branching — whole-array selection only.
 * Callers (NewRoundPage.handleStart, roundLib.toActiveRound) attach the
 * result as player.siArray before storing into activeRound.
 *
 * @param {Object} player — player object with optional `gender` field
 * @param {Object} layout — output of buildGenderLayout (provides hcps, hcpsWomen)
 * @returns {number[]} 18-element SI array (rank 1–18 per hole)
 */
export function buildPlayerSI(player, layout) {
  if (isFemale(player) && layout?.hcpsWomen?.length === 18) {
    return [...layout.hcpsWomen];
  }
  return [...(layout?.hcps || DEF_HCP)];
}

// ─── Group course handicap helpers ───────────────────────────────────────────

/**
 * Compute course handicaps for all players given per-player tee data.
 * Returns signed integers — negative = plus handicap.
 *
 * tees: array of tee objects, one per player in the same order as players[].
 * nines (optional): course nines array — used for gender-aware par computation
 *   (parsWomen) for female players. When absent, men's par is used for all.
 *
 * Handicap_Contract §2.5: female players use tee.slopeW / tee.ratingW when
 * present; fall back to men's values when absent or zero.
 * Handicap_Contract §2.1 / invariant 19: female players' par = sum of
 * parsWomen across active nines when present; falls back to men's par.
 */
export function groupCourseHandicaps(players, tees, pars, nines) {
  const mensPar = pars ? pars.reduce((a, b) => a + b, 0) : 72;

  // Pre-compute women's total par from nines if available
  let womensPar = null;
  if (nines?.length) {
    const wp = nines.reduce((s, n) => {
      const ninePars = n.parsWomen?.length === 9 ? n.parsWomen : n.pars;
      return s + (ninePars ? ninePars.reduce((a, b) => a + b, 0) : 0);
    }, 0);
    if (wp > 0) womensPar = wp;
  }

  return players.map((p, i) => {
    const tee = tees[i];
    if (isFemale(p) && tee?.slopeW && tee?.ratingW) {
      // Use women's tee data and women's par (Handicap_Contract §2.5, inv 18–19)
      const par = womensPar ?? mensPar;
      return courseHandicap(parseIndex(p.ghin), tee.slopeW, tee.ratingW, par);
    }
    return courseHandicap(parseIndex(p.ghin), tee?.slope, tee?.rating, mensPar);
  });
}

/** Minimum (lowest) course handicap in group — the baseline for net-off-low. */
export function minGroupHandicap(courseHcps) {
  return Math.min(...courseHcps);
}
