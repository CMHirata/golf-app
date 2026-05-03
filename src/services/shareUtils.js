// ─── services/shareUtils.js ───────────────────────────────────────────────────
// ✅ Self-checked (13-G.2): hcpStrokesHtml now reads players[pi].siArray with
// fallback to gender branch + hcps for legacy snapshots. All four xGrossScore
// calls and the single escTotal call now pass siArrayFor(pi) instead of the
// round-shared hcps array. The vestigial minCourseHcp arg dropped from escTotal
// (its pre-13-G.2 signature only took 5 args; the 6th was silently ignored).
//
// Share rendering subsystem: buildShareHtml, buildSharePdf, buildShareImage,
// triggerRoundShare, and share-only helpers.
//
// Extracted from roundUtils.js in session 13-E.6 (verbatim move).
// roundUtils.js retains buildPayoutArgs, computePerMatchPayouts, cleanGameName.
//
// ✅ Self-checked (13-E.6): All share functions moved verbatim. cleanGameName
//    imported from ./roundUtils.js (no circular dependency). All share-only
//    constants, formatters, and helpers moved. Inline applyDepartureGuardrail
//    copy inside buildShareHtml preserved intact per PartialGameContract §11.9
//    / H-28. No engine imports duplicated. No circular import created.

import { runMatchNassau, calcSkins, calcSkinsHole, calcNines, ninesPts, getSixesTeam, calcSixesSegment } from '../engine/games.js';
import { scoreForMode, stabPts, escTotal, xGrossScore, hdcpStrokesFromCourseHcp } from '../engine/handicap.js';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement as h } from 'react';
import { jsPDF } from 'jspdf';
import { SixesTable }      from '../pages/tables/SixesTable.jsx';
import { DotsTable }       from '../pages/tables/DotsTable.jsx';
import { SkinsTable }      from '../pages/tables/SkinsTable.jsx';
import { NinesTable }      from '../pages/tables/NinesTable.jsx';
import { StablefordTable } from '../pages/tables/StablefordTable.jsx';
import { StrokePlayTable } from '../pages/tables/StrokePlayTable.jsx';
import { MatchNassauTable } from '../pages/tables/MatchNassauTable.jsx';
import { cleanGameName } from './roundUtils.js';

// ─── Shared constants ─────────────────────────────────────────────────────────
const G_COLOR = '#1a472a';
const GRN_PAY = '#27ae60';
const RED_PAY = '#c0392b';
const FRONT   = [0,1,2,3,4,5,6,7,8];
const BACK    = [9,10,11,12,13,14,15,16,17];

const TK = {
  S:  { hdr:'#fef3e8', hdrC:'#7b3f00', tot:'#fce4c4', totC:'#7b3f00', rA:'#fffdf8', rB:'#fef9f0', bdr:'#fce4c4', title:'Skins' },
  N:  { hdr:'#e8f0fc', hdrC:'#1a3a5c', tot:'#c8d8f8', totC:'#1a3a5c', rA:'#f0f5ff', rB:'#e8f0fc', bdr:'#c8d8f8', title:'Nines' },
  K:  { hdr:'#f2eafa', hdrC:'#4a1580', tot:'#dac8f5', totC:'#4a1580', rA:'#f9f5ff', rB:'#f2eafa', bdr:'#dac8f5', title:'Stableford' },
  P:  { hdr:'#edf7ed', hdrC:'#1a5c1a', tot:'#c8e8c8', totC:'#1a5c1a', rA:'#f5fbf5', rB:'#edf7ed', bdr:'#c8e8c8', title:'Stroke Play' },
  M:  { hdr:'#e8f4e8', hdrC:'#1f4d1f', tot:'#c8e0c8', totC:'#1f4d1f', rA:'#ffffff', rB:'#f5fbf5', bdr:'#c8e0c8', title:'Match' },
  X:  { hdr:'#e8f5ee', hdrC:'#1a5c38', tot:'#b8dfc8', totC:'#1a5c38', rA:'#f5fbf7', rB:'#e8f5ee', bdr:'#b8dfc8', title:'Sixes' },
  D:  { hdr:'#f2eafa', hdrC:'#4a1580', tot:'#c9a8f0', totC:'#26215C', rA:'#fdfcff', rB:'#f8f4ff', bdr:'#dac8f5', title:'Dots' },
};

// ── Logo loader ────────────────────────────────────────────────────────────────
async function getLogoDataUri() {
  try {
    const resp = await fetch('/logo_lockup.png');
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return new Promise(resolve => {
      const fr = new FileReader();
      fr.onload  = () => resolve(fr.result);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch(e) { return null; }
}

// ─── XML / HTML escaping ──────────────────────────────────────────────────────
function fmtMoney(v) {
  if (v > 0) return `+$${Math.abs(v).toFixed(2)}`;
  if (v < 0) return `-$${Math.abs(v).toFixed(2)}`;
  return '$0';
}

function fmtDate(ds) {
  if (!ds) return '';
  const d = new Date(ds + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', year:'numeric' });
}

function xe(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Fixed render width for the foreignObject content
const FO_WIDTH          = 740;
const FO_WIDTH_PORTRAIT = 390;

// ── Derive handicap dot display mode for share image ────────────────────────
// Priority (per product spec):
//   any net + any NOL          → 'net'
//   all net (no NOL)           → 'net'
//   NOL + NOL-subset mix       → 'netofflow' with globalMin
//   NOL-subset only            → 'netofflow' with subsetMin
//   all NOL (no subset)        → 'netofflow' with globalMin
//   all gross / no hcp games   → 'gross' (no dots)
function deriveShareDotMode(ar) {
  const {
    activeGames = [], gameOpts = {}, matches = [],
    courseHcps = [], minCourseHcp,
    skinsPlayers = [], stablefordPlayers = [], ninesPlayers = [],
    strokePlayPlayers = [], sixesPlayers = [],
  } = ar;
  const allIdxs  = courseHcps.map((_, i) => i);
  const resolve  = arr => arr?.length ? arr : allIdxs;
  const subMin   = idxs => Math.min(...idxs.map(i => courseHcps[i]));
  const globalMin = minCourseHcp ?? (courseHcps.length ? Math.min(...courseHcps) : 0);

  const modes = [];

  // Collect grossNetNOL from all active games
  const addMode = (key, subset) => {
    if (!activeGames.includes(key)) return;
    const m = (gameOpts[key]?.grossNetNOL ?? gameOpts[key]?.scoring ?? 'net');
    modes.push({ mode: m, subset: resolve(subset) });
  };
  addMode('Skins',       skinsPlayers);
  addMode('Stableford',  stablefordPlayers);
  addMode('Nines',       ninesPlayers);
  addMode('Stroke Play', strokePlayPlayers);
  addMode('Sixes',       sixesPlayers);
  addMode('Dots',        []);
  if (activeGames.includes('Match / Nassau')) {
    (matches || []).forEach(m => {
      const mm = m.grossNetNOL ?? m.scoring ?? 'net';
      const inv = m.format === 'team'
        ? [...(m.teamA||[]), ...(m.teamB||[])]
        : [m.p1, m.p2].filter(p => p != null);
      modes.push({ mode: mm, subset: inv.length ? inv : allIdxs });
    });
  }

  const hasNet = modes.some(m => m.mode === 'net');
  const hasNOL = modes.some(m => m.mode === 'netofflow');

  if (!hasNet && !hasNOL) return { mode: 'gross', min: globalMin };
  if (hasNet) return { mode: 'net', min: globalMin };

  // Only NOL — check for subset-only (all NOL games are subsets excluding global low)
  const nolModes  = modes.filter(m => m.mode === 'netofflow');
  const hasFullNOL = nolModes.some(m => subMin(m.subset) === globalMin);
  if (hasFullNOL) return { mode: 'netofflow', min: globalMin };

  // All NOL games are subsets — use the smallest subset min across them
  const subsetMin = Math.min(...nolModes.map(m => subMin(m.subset)));
  return { mode: 'netofflow', min: subsetMin };
}

function buildShareHtml(r, ar, bank, breakdown, matchPayouts, logoDataUri, orientation = 'landscape') {
  const {
    activePlayers: players, pars, hcps, hcpsWomen, scores, courseHcps, minCourseHcp,
    activeGames, gameOpts,
    ninesPlayers, stablefordPlayers, skinsPlayers, strokePlayPlayers,
    manualPresses,
    frontNine, backNine,
    sixesTeams, sixesPlayers,
    dots, dotEntries, dotsPlayers,
    matches,
  } = ar;

  // 13-C.7.6: forward earlyDepartureOpts to every embedded table renderer
  // so the share image honors departures consistently with on-screen tables.
  const earlyDepartureOpts = ar.earlyDepartureOpts || {};

  const isPortrait = orientation === 'portrait';
  const foWidth    = isPortrait ? FO_WIDTH_PORTRAIT : FO_WIDTH;

  const ao = activeGames || [];
  const nP = players.length;
  const parF = FRONT.reduce((s,h)=>s+(pars[h]||0),0);
  const parB = BACK.reduce((s,h)=>s+(pars[h]||0),0);

  // Derive handicap dot mode for this share image
  const { mode: dotMode, min: dotMin } = deriveShareDotMode(ar);

  // 13-G.2: Resolve the SI array for a given player (per-player siArray when
  // present, falling back to round-shared hcps for legacy snapshots).
  const siArrayFor = (pi) => {
    const p = players[pi];
    return (p && Array.isArray(p.siArray)) ? p.siArray : hcps;
  };

  // Handicap stroke dots — absolutely positioned bottom-right, never displace score.
  // Wrapped in a position:relative container in the score cell.
  // Handicap_Contract §5.16: when ch < 0 && rank > 18 - Math.abs(ch), emit '+' span
  // instead of dots (mutually exclusive with dots).
  const hcpStrokesHtml = (pi, h) => {
    const ch  = courseHcps?.[pi] ?? 0;
    // 13-G.2: Prefer per-player siArray (built at round-start by buildPlayerSI).
    // Fall back to gender branch + women's/men's hcps for legacy snapshots.
    const playerObj = players[pi];
    let rank;
    if (playerObj && Array.isArray(playerObj.siArray)) {
      rank = playerObj.siArray[h] ?? hcps[h] ?? 0;
    } else {
      const isF = (() => { const g = (playerObj?.gender || '').toLowerCase(); return g==='f'||g==='female'||g==='w'; })();
      rank = (isF && hcpsWomen) ? (hcpsWomen[h] ?? hcps[h]) : (hcps[h] ?? 0);
    }

    // Plus-CH indicator
    if (ch < 0 && rank > 18 - Math.abs(ch)) {
      return `<span style="position:absolute;bottom:1px;right:1px;font-size:6px;font-weight:800;color:#1a472a;line-height:1;pointer-events:none;">+</span>`;
    }

    let strokes = 0;
    if (dotMode === 'net') {
      strokes = Math.max(0, Math.floor(ch / 18) + (rank <= ch % 18 ? 1 : 0));
    } else if (dotMode === 'netofflow') {
      const diff = ch - (dotMin ?? 0);
      strokes = diff > 0 ? Math.max(0, Math.floor(diff / 18) + (rank <= diff % 18 ? 1 : 0)) : 0;
    }
    if (strokes <= 0) return '';
    const dot = `<span style="display:inline-block;width:3px;height:3px;border-radius:50%;background:#1a472a;flex-shrink:0;"></span>`;
    const dotRow = `<span style="position:absolute;bottom:1px;right:1px;display:flex;gap:1px;pointer-events:none;">${dot.repeat(strokes)}</span>`;
    return dotRow;
  };

  // Per-player departure cap for the `–` rendering rule (PartialGameContract §5.5).
  // 13-C.7.6: share image now mirrors ReadOnlyScorecard's past-departure
  // treatment — holes after a player's departureHole render as `–` in muted
  // gray instead of the underlying (engine-guarded-but-still-stored) score.
  const departureCap = (pi) => {
    const e = earlyDepartureOpts?.[pi] ?? earlyDepartureOpts?.[String(pi)];
    return (e && typeof e.departureHole === 'number') ? e.departureHole : null;
  };
  const isPastDeparture = (h, pi) => {
    const cap = departureCap(pi);
    return cap !== null && h > cap;
  };

  // Wrap score + dots in a relative container so dots can be absolutely positioned.
  // X scores render as "NX" — numeric part normal color, X suffix in amber.
  const scoreCell = (pi, h) => {
    if (isPastDeparture(h, pi)) {
      return `<td style="text-align:center;font-size:10px;color:#ccc;background:#f8f8f8;">–</td>`;
    }
    const raw = scores[h]?.[pi];
    if (raw === 'X') {
      const xg   = xGrossScore(h, courseHcps?.[pi] ?? 0, siArrayFor(pi), pars);
      const dots = hcpStrokesHtml(pi, h);
      const inner = `<span style="color:#222;">${xg}</span><span style="color:#b7770d;font-size:0.85em;">X</span>${dots}`;
      return `<td style="text-align:center;font-size:10px;padding:0;background:#fffbe6;"><div style="position:relative;display:inline-block;min-width:14px;padding:2px 0;">${inner}</div></td>`;
    }
    const g = parseInt(raw) || 0;
    const dots = g ? hcpStrokesHtml(pi, h) : '';
    if (!dots) return `<td style="text-align:center;font-size:10px;">${g||''}</td>`;
    return `<td style="text-align:center;font-size:10px;padding:0;"><div style="position:relative;display:inline-block;min-width:14px;padding:2px 0;">${g}${dots}</div></td>`;
  };

  const ninesLabel = (() => {
    const n = (r.course_snapshot?.nines||[]).length;
    if (n <= 1 || !frontNine) return '';
    return `${frontNine}/${backNine||'B9'}`;
  })();
  // Landscape: inline with dot separator. Portrait: separate line, no dot.
  const ninesSuffix = (!isPortrait && ninesLabel) ? ` · ${ninesLabel}` : '';

  const logoHtml = logoDataUri
    ? `<img src="" style="height:${isPortrait?40:58}px;width:auto;display:block;visibility:hidden;" alt=""/>`
    : `<div style="height:${isPortrait?40:58}px;"></div>`;

  const cols = Math.min(nP, 4);
  const chipHtml = players.map(p => {
    const ch = courseHcps?.[players.indexOf(p)] ?? 0;
    const nameParts = (p.name||'').trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName  = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
    if (isPortrait) {
      return `<div style="background:#fff;border-radius:8px;padding:4px 4px;text-align:center;min-width:0;">
        <div style="font-size:10px;font-weight:700;color:#1a472a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${xe(firstName)}</div>
        ${lastName ? `<div style="font-size:9px;font-weight:500;color:#1a472a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${xe(lastName)}</div>` : ''}
        <div style="font-size:8px;color:#666;white-space:nowrap;margin-top:1px;">HI ${xe(p.ghin||'—')} · CH ${xe(ch)}</div>
      </div>`;
    }
    return `<div style="background:#fff;border-radius:8px;padding:5px 8px;text-align:center;">
      <div style="font-size:12px;font-weight:700;color:#1a472a;">${xe(p.name)}</div>
      <div style="font-size:10px;color:#666;">HI ${xe(p.ghin||'—')} · CH ${xe(ch)}</div>
    </div>`;
  }).join('');

  // Scorecard — landscape: single 18-hole table; portrait: F9 + B9 stacked
  const makeHcpCols  = n => `<colgroup><col style="width:70px"/>${Array(n).fill('<col style="width:28px"/>').join('')}<col style="width:36px"/></colgroup>`;
  const hdRow        = h => `<td style="text-align:center;font-size:9px;color:#555;background:#f0f4f0;">${h+1}</td>`;
  const makeParRow   = (holes, tot) => `<tr><td style="font-size:9px;color:#1a472a;font-weight:700;padding:2px 4px;background:#f8fbf8;">Par</td>${holes.map(h=>`<td style="text-align:center;font-size:9px;color:#1a472a;background:#f8fbf8;">${pars[h]||''}</td>`).join('')}<td style="text-align:center;font-size:9px;font-weight:700;background:#f0f7f0;">${tot}</td></tr>`;
  const makeHcpRow   = (holes) => `<tr><td style="font-size:9px;color:#aaa;padding:1px 4px;background:#fafcfa;">M.Hcp</td>${holes.map(h=>`<td style="text-align:center;font-size:9px;color:#ccc;background:#fafcfa;">${hcps[h]||''}</td>`).join('')}<td style="background:#fafcfa;"></td></tr>`;
  const makeScoreRow = (pi, holes, tot, rowBg) => `<tr style="background:${rowBg}"><td style="font-size:10px;font-weight:600;color:#333;padding:2px 4px;overflow:hidden;white-space:nowrap;">${xe(players[pi].name)}</td>${holes.map(h => scoreCell(pi, h)).join('')}<td style="text-align:center;font-size:10px;font-weight:700;background:#f0f7f0;">${tot||''}</td></tr>`;

  const makeHalfTable = (holes, totPar, label) => {
    const colgroup = makeHcpCols(holes.length);
    const thead = `<thead><tr><th style="background:#f0f4f0;font-size:9px;text-align:left;padding:2px 4px;">${label}</th>${holes.map(hdRow).join('')}<th style="background:#e8f0e8;font-size:9px;color:#1a472a;font-weight:800;text-align:center;">Tot</th></tr>${makeParRow(holes, totPar)}${makeHcpRow(holes)}</thead>`;
    const tbody = `<tbody>${players.map((_, pi) => {
      const tot = holes.reduce((s, h) => {
        // 13-C.7.6: skip past-departure cells in row total per §5.5 / §14 invariant 21.
        if (isPastDeparture(h, pi)) return s;
        const raw = scores[h]?.[pi];
        if (raw === 'X') return s + xGrossScore(h, courseHcps?.[pi] ?? 0, siArrayFor(pi), pars);
        return s + (parseInt(raw) || 0);
      }, 0);
      return makeScoreRow(pi, holes, tot, pi%2===0?'#fff':'#f5fbf5');
    }).join('')}</tbody>`;
    return `<div style="overflow-x:auto;margin-bottom:8px;"><table style="border-collapse:collapse;table-layout:fixed;width:100%;">${colgroup}${thead}${tbody}</table></div>`;
  };

  let scorecardHtml;
  if (isPortrait) {
    scorecardHtml = makeHalfTable(FRONT, parF, 'Front 9') + makeHalfTable(BACK, parB, 'Back 9');
  } else {
    // Landscape: single 18-hole table with F9 + B9 total columns
    const hdCols18 = `<colgroup><col style="width:70px"/>${[...FRONT,...BACK].map(()=>`<col style="width:28px"/>`).join('')}<col style="width:36px"/><col style="width:36px"/></colgroup>`;
    const parRow18 = `<tr><td style="font-size:9px;color:#1a472a;font-weight:700;padding:2px 4px;background:#f8fbf8;">Par</td>${[...FRONT,...BACK].map(h=>`<td style="text-align:center;font-size:9px;color:#1a472a;background:#f8fbf8;">${pars[h]||''}</td>`).join('')}<td style="text-align:center;font-size:9px;font-weight:700;background:#f0f7f0;">${parF}</td><td style="text-align:center;font-size:9px;font-weight:700;background:#f0f7f0;">${parB}</td></tr>`;
    const hcpRow18 = `<tr><td style="font-size:9px;color:#aaa;padding:1px 4px;background:#fafcfa;">M.Hcp</td>${[...FRONT,...BACK].map(h=>`<td style="text-align:center;font-size:9px;color:#ccc;background:#fafcfa;">${hcps[h]||''}</td>`).join('')}<td style="background:#fafcfa;"></td><td style="background:#fafcfa;"></td></tr>`;
    const escRow18 = (pi) => {
      const xAwareHalf = (holes) => holes.reduce((s, h) => {
        // 13-C.7.6: skip past-departure cells in row total.
        if (isPastDeparture(h, pi)) return s;
        const raw = scores[h]?.[pi];
        if (raw === 'X') return s + xGrossScore(h, courseHcps?.[pi] ?? 0, siArrayFor(pi), pars);
        return s + (parseInt(raw) || 0);
      }, 0) || '';
      return `<tr style="background:${pi%2===0?'#fff':'#f5fbf5'}"><td style="font-size:10px;font-weight:600;color:#333;padding:2px 4px;overflow:hidden;white-space:nowrap;">${xe(players[pi].name)}</td>${[...FRONT,...BACK].map(h => scoreCell(pi, h)).join('')}<td style="text-align:center;font-size:10px;font-weight:700;background:#f0f7f0;">${xAwareHalf(FRONT)}</td><td style="text-align:center;font-size:10px;font-weight:700;background:#f0f7f0;">${xAwareHalf(BACK)}</td></tr>`;
    };
    scorecardHtml = `<div style="overflow-x:auto;margin-bottom:12px;"><table style="border-collapse:collapse;table-layout:fixed;width:100%;">${hdCols18}<thead><tr><th style="background:#f0f4f0;font-size:9px;text-align:left;padding:2px 4px;"></th>${[...FRONT,...BACK].map(hdRow).join('')}<th style="background:#e8f0e8;font-size:9px;color:#1a472a;font-weight:800;text-align:center;">F9</th><th style="background:#e8f0e8;font-size:9px;color:#1a472a;font-weight:800;text-align:center;">B9</th></tr>${parRow18}${hcpRow18}</thead><tbody>${players.map((_,pi)=>escRow18(pi)).join('')}</tbody></table></div>`;
  }

  // Round totals block — gross + ESC per player
  const parTotal = [...FRONT,...BACK].reduce((s,h)=>s+(pars[h]||0),0);
  const totalsHtml = (() => {
    const playerCols = players.map((p, pi) => {
      const gross = [...FRONT,...BACK].reduce((s, h) => {
        const raw = scores[h]?.[pi];
        if (raw === 'X') return s + xGrossScore(h, courseHcps?.[pi] ?? 0, siArrayFor(pi), pars);
        return s + (parseInt(raw) || 0);
      }, 0);
      const esc   = escTotal(scores, pi, pars, siArrayFor(pi), courseHcps?.[pi]??0);
      const parts = (p?.name||'').trim().split(/\s+/);
      const first = parts[0]||'?';
      const last  = parts.length >= 2 ? parts[parts.length-1] : '';
      const hasScores = gross > 0;
      const bg = pi%2===0 ? '#fff' : '#f5fbf5';
      return `<td style="text-align:center;padding:6px 4px;background:${bg};border-left:${pi>0?'1px solid #eef4ee':'none'};">
        <div style="font-size:11px;font-weight:600;color:${G_COLOR};overflow:hidden;white-space:nowrap;">${xe(first)}</div>
        ${last?`<div style="font-size:10px;color:${G_COLOR};opacity:0.6;overflow:hidden;white-space:nowrap;">${xe(last)}</div>`:''}
        ${hasScores
          ? `<div style="font-size:15px;font-weight:700;color:#222;line-height:1.2;">${gross}</div><div style="font-size:10px;color:#888;">(${esc} ESC)</div>`
          : `<div style="font-size:13px;color:#ccc;">—</div>`}
      </td>`;
    }).join('');
    return `<div style="margin-bottom:14px;border-radius:8px;border:1px solid #e0ece0;overflow:hidden;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px 5px;background:#fff;">
        <span style="font-size:12px;font-weight:700;color:${G_COLOR};">Round Totals</span>
        <span style="font-size:10px;padding:1px 7px;border-radius:8px;background:#e0ece0;color:${G_COLOR};">Par ${parTotal}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;"><tbody><tr>${playerCols}</tr></tbody></table>
    </div>`;
  })();

  // ── Game tables: render actual React components to static HTML ───────────────
  // renderToStaticMarkup produces clean HTML without React data attributes —
  // identical output to what the modal shows, usable in SVG foreignObject.
  const noOp = () => {};
  let gamesHtml = '';

  try {
    if (ao.includes('Nines')) {
      gamesHtml += renderToStaticMarkup(h(NinesTable, {
        players, scores, pars, hcps,
        opts: gameOpts?.Nines,
        courseHcps, minCourseHcp,
        ninesPlayers: ninesPlayers || [],
        isLandscape: false,
        earlyDepartureOpts,
      }));
    }
    if (ao.includes('Stableford')) {
      gamesHtml += renderToStaticMarkup(h(StablefordTable, {
        players, scores, pars, hcps,
        opts: gameOpts?.Stableford,
        courseHcps, minCourseHcp,
        stablefordPlayers: stablefordPlayers || [],
        isLandscape: false,
        earlyDepartureOpts,
      }));
    }
    if (ao.includes('Skins')) {
      gamesHtml += renderToStaticMarkup(h(SkinsTable, {
        players, scores, hcps,
        opts: gameOpts?.Skins,
        courseHcps, minCourseHcp,
        skinsPlayerIdxs: skinsPlayers || [],
        isLandscape: false,
        earlyDepartureOpts,
      }));
    }
    if (ao.includes('Stroke Play')) {
      gamesHtml += renderToStaticMarkup(h(StrokePlayTable, {
        players, scores, pars, hcps,
        opts: gameOpts?.['Stroke Play'],
        courseHcps, minCourseHcp,
        strokePlayPlayers: strokePlayPlayers || [],
        isLandscape: false,
        earlyDepartureOpts,
      }));
    }
    if (ao.includes('Match / Nassau')) {
      gamesHtml += renderToStaticMarkup(h(MatchNassauTable, {
        players, scores, hcps,
        matches: matches || [],
        courseHcps, minCourseHcp,
        manualPresses: manualPresses || {},
        setManualPresses: noOp,
        isLandscape: false,
        earlyDepartureOpts,
      }));
    }
    if (ao.includes('Sixes')) {
      gamesHtml += renderToStaticMarkup(h(SixesTable, {
        players, scores, hcps,
        opts: gameOpts?.Sixes,
        sixesTeams,
        courseHcps, minCourseHcp,
        manualPresses: manualPresses || {},
        setManualPresses: noOp,
        earlyDepartureOpts,
      }));
    }
    if (ao.includes('Dots') || ao.includes('Specials')) {
      // Render DotsTable for the hole-by-hole segment grids (works correctly),
      // then replace the pivot section with a clean hand-built table that
      // renders reliably in SVG foreignObject.
      const dotsRaw = renderToStaticMarkup(h(DotsTable, {
        players, dots, dotEntries, gameOpts,
        dotsPlayers: dotsPlayers || [],
        isLandscape: false,
        sixesTeams, matches: matches || [],
        earlyDepartureOpts,
      }));

      // Build a clean pivot table from scratch using raw dotEntries data
      const SP_HDR  = '#e8dcf8';
      const SP_CLR  = '#4a1580';
      const SP_TOT  = '#dac8f5';
      const SP_BG   = ['#fdfcff','#f8f4ff'];
      const SP_BDR  = '#dac8f5';

      const restoreDots = (dots||[]).filter(s => s.enabled);
      const entCnt  = v => typeof v === 'number' ? v : (v === true ? 1 : 0);
      const dtIdxs  = (dotsPlayers||[]).length ? dotsPlayers : players.map((_,i)=>i);

      // Detect team mode
      const dotsOpts   = gameOpts?.Dots || gameOpts?.Specials || {};
      const rawTM      = dotsOpts.teamMode;
      const isTM       = rawTM ? rawTM !== 'none' : !!dotsOpts.teamScoring;
      const isSixesTM  = isTM && (rawTM === 'Sixes' || (!rawTM && dotsOpts.teamScoring));
      const isMatchTM  = isTM && rawTM?.startsWith('Match:');
      const SEG_HOLES  = [[0,1,2,3,4,5],[6,7,8,9,10,11],[12,13,14,15,16,17]];
      const ALL_HOLES  = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17];

      // Resolve Match team A/B for Match team mode
      let matchTmA = [], matchTmB = [];
      if (isMatchTM) {
        const matchId = rawTM.slice(6);
        const tm = (matches||[]).find(m => m.id === matchId) || (matches||[]).find(m => m.format === 'team');
        if (tm) {
          matchTmA = (tm.teamA||[]).filter(pi => dtIdxs.includes(pi));
          matchTmB = (tm.teamB||[]).filter(pi => dtIdxs.includes(pi));
        }
      }

      // Count own non-team dots per player per hole set
      const dotCnt = (pi, dotId, holes) => {
        let c = 0;
        for (const h of holes) c += entCnt((dotEntries||{})[`${h}_${pi}_${dotId}`]||0);
        return c;
      };
      // Count team-related entries (own h_pi_team + companions received h_pi_team_dot_for_X)
      const teamCnt = (pi, holes) => {
        let c = 0;
        Object.entries(dotEntries||{}).forEach(([k,v]) => {
          const cnt = entCnt(v); if (!cnt) return;
          const p = k.split('_');
          if (parseInt(p[1]) !== pi) return;
          if (!holes.includes(parseInt(p[0]))) return;
          if (p[2] === 'team') c += cnt;
        });
        return c;
      };
      // Count ALL dot entries for player (own + companions received) — matches playerRoundTot
      const allDotCnt = (pi, holes) => {
        let c = 0;
        Object.entries(dotEntries||{}).forEach(([k,v]) => {
          const cnt = entCnt(v); if (!cnt) return;
          const p = k.split('_');
          if (parseInt(p[1]) !== pi) return;
          if (!holes.includes(parseInt(p[0]))) return;
          c += cnt;
        });
        return c;
      };

      // Active dot types (exclude type rows where everyone has 0)
      const activeDotTypes = restoreDots.filter(sp =>
        dtIdxs.some(pi => [0,1,2].some(s => dotCnt(pi, sp.id, SEG_HOLES[s]) > 0))
      );
      // Add team row if applicable
      const pivotRows = [
        ...activeDotTypes,
        ...(isTM && dtIdxs.some(pi => teamCnt(pi, ALL_HOLES) > 0)
          ? [{ id: 'team', name: 'Team' }] : []),
      ];

      // Column headers: if Sixes team mode, A/B/C per player; else just per player
      const segs  = isSixesTM ? [0,1,2] : [0];
      const sLbls = isSixesTM ? ['A','B','C'] : [''];

      // Build pivot HTML
      let pivHtml = '';
      if (pivotRows.length > 0) {
        const nSegs    = segs.length;

        if (isMatchTM && matchTmA.length && matchTmB.length) {
          // ── Match team mode pivot: Team A | Team B column groups ──────────────
          const allMatchIdxs = [...matchTmA, ...matchTmB];
          const nCols = allMatchIdxs.length;
          const dataColPct = (75 / nCols).toFixed(2);

          const colgroup = `<colgroup>
            <col style="width:25%"/>
            ${allMatchIdxs.map(() => `<col style="width:${dataColPct}%"/>`).join('')}
          </colgroup>`;

          // Team header row
          const teamHdrs = [
            matchTmA.length ? `<th colspan="${matchTmA.length}" style="text-align:center;font-size:11px;font-weight:700;color:${SP_CLR};background:${SP_HDR};padding:3px 2px;border-right:2px solid ${SP_BDR};">Team A</th>` : '',
            matchTmB.length ? `<th colspan="${matchTmB.length}" style="text-align:center;font-size:11px;font-weight:700;color:${SP_CLR};background:${SP_HDR};padding:3px 2px;">Team B</th>` : '',
          ].join('');

          // Player name sub-header row
          const nameHdrs = [
            ...matchTmA.map((pi, i) => {
              const first  = players[pi]?.name?.split(' ')[0] || '';
              const border = i === matchTmA.length - 1 ? `border-right:2px solid ${SP_BDR}` : 'none';
              return `<th style="text-align:center;font-size:9px;font-weight:600;color:${SP_CLR};background:#e8dcf8;padding:3px 2px;${border};">${xe(first)}</th>`;
            }),
            ...matchTmB.map(pi => {
              const first = players[pi]?.name?.split(' ')[0] || '';
              return `<th style="text-align:center;font-size:9px;font-weight:600;color:${SP_CLR};background:#e8dcf8;padding:3px 2px;">${xe(first)}</th>`;
            }),
          ].join('');

          // Data rows
          const dataRows = pivotRows.map((sp, ri) => {
            const cells = [
              ...matchTmA.map((pi, i) => {
                const c = sp.id === 'team' ? teamCnt(pi, ALL_HOLES) : dotCnt(pi, sp.id, ALL_HOLES);
                const border = i === matchTmA.length - 1 ? `border-right:2px solid ${SP_BDR}` : 'none';
                return `<td style="text-align:center;font-size:11px;font-weight:${c>0?700:400};color:${c>0?SP_CLR:'#ccc'};padding:2px 1px;${border};">${c>0?c:'·'}</td>`;
              }),
              ...matchTmB.map(pi => {
                const c = sp.id === 'team' ? teamCnt(pi, ALL_HOLES) : dotCnt(pi, sp.id, ALL_HOLES);
                return `<td style="text-align:center;font-size:11px;font-weight:${c>0?700:400};color:${c>0?SP_CLR:'#ccc'};padding:2px 1px;">${c>0?c:'·'}</td>`;
              }),
            ].join('');
            return `<tr style="background:${SP_BG[ri%2]};"><td style="padding:3px 8px;font-size:10px;font-weight:600;color:${SP_CLR};white-space:nowrap;">${xe(sp.name)}</td>${cells}</tr>`;
          }).join('');

          // Totals row — allDotCnt (own + companions received) matches playerRoundTot
          const totCells = [
            ...matchTmA.map((pi, i) => {
              const tot    = allDotCnt(pi, ALL_HOLES);
              const border = i === matchTmA.length - 1 ? `border-right:2px solid #b08de0` : 'none';
              return `<td style="text-align:center;font-size:12px;font-weight:800;color:${SP_CLR};background:${tot>0?'#c9a8f0':SP_TOT};padding:3px 1px;${border};">${tot>0?tot:'·'}</td>`;
            }),
            ...matchTmB.map(pi => {
              const tot = allDotCnt(pi, ALL_HOLES);
              return `<td style="text-align:center;font-size:12px;font-weight:800;color:${SP_CLR};background:${tot>0?'#c9a8f0':SP_TOT};padding:3px 1px;">${tot>0?tot:'·'}</td>`;
            }),
          ].join('');

          pivHtml = `<div style="margin:0 8px 8px;border-radius:8px;overflow:visible;border:1px solid ${SP_BDR};">
            <table style="border-collapse:collapse;table-layout:fixed;width:100%;">
              ${colgroup}
              <thead>
                <tr>
                  <th style="text-align:left;font-size:10px;font-weight:700;color:${SP_CLR};background:${SP_HDR};padding:4px 8px;white-space:nowrap;" rowspan="2">Type</th>
                  ${teamHdrs}
                </tr>
                <tr>${nameHdrs}</tr>
              </thead>
              <tbody>
                ${dataRows}
                <tr style="border-top:1.5px solid ${SP_BDR};">
                  <td style="padding:3px 8px;font-size:10px;font-weight:800;color:${SP_CLR};background:${SP_TOT};white-space:nowrap;">Total</td>
                  ${totCells}
                </tr>
              </tbody>
            </table>
          </div>`;

        } else {
          // ── Individual / Sixes pivot (existing logic) ─────────────────────────
          const nPlayers  = dtIdxs.length;
          const nDataCols = nPlayers * nSegs;
          const dataColPct = (75 / nDataCols).toFixed(2);

          const colgroup = `<colgroup>
            <col style="width:25%"/>
            ${dtIdxs.flatMap(() => segs.map(() => `<col style="width:${dataColPct}%"/>`)).join('')}
          </colgroup>`;

          const nameHdrs = dtIdxs.map((pi, pIdx) => {
            const first    = players[pi]?.name?.split(' ')[0] || '';
            const isLast   = pIdx === nPlayers - 1;
            const border   = isLast ? 'none' : `border-right:2px solid ${SP_BDR}`;
            return `<th colspan="${nSegs}" style="text-align:center;font-size:10px;font-weight:700;color:${SP_CLR};background:${SP_HDR};padding:3px 2px;${border};">${xe(first)}</th>`;
          }).join('');

          const segHdrs = isSixesTM ? dtIdxs.flatMap((pi, pIdx) =>
            ['A','B','C'].map((lbl, si) => {
              const isLastSeg    = si === 2;
              const isLastPlayer = pIdx === nPlayers - 1;
              const border = isLastSeg && !isLastPlayer ? `border-right:2px solid ${SP_BDR}` : 'none';
              return `<th style="text-align:center;font-size:9px;font-weight:600;color:${SP_CLR};background:#e8dcf8;padding:2px 1px;border-bottom:1px solid ${SP_BDR};${border};">${lbl}</th>`;
            })
          ).join('') : '';

          const dataRows = pivotRows.map((sp, ri) => {
            const cells = dtIdxs.flatMap((pi, pIdx) =>
              segs.map((seg, si) => {
                const holes      = SEG_HOLES[seg];
                const c          = sp.id === 'team' ? teamCnt(pi, holes) : dotCnt(pi, sp.id, holes);
                const isLastSeg  = si === nSegs - 1;
                const isLastP    = pIdx === nPlayers - 1;
                const border     = isLastSeg && !isLastP ? `border-right:2px solid ${SP_BDR}` : 'none';
                return `<td style="text-align:center;font-size:11px;font-weight:${c>0?700:400};color:${c>0?SP_CLR:'#ccc'};padding:2px 1px;${border};">${c>0?c:'·'}</td>`;
              })
            ).join('');
            return `<tr style="background:${SP_BG[ri%2]};"><td style="padding:3px 8px;font-size:10px;font-weight:600;color:${SP_CLR};white-space:nowrap;">${xe(sp.name)}</td>${cells}</tr>`;
          }).join('');

          // Totals row — allDotCnt for team modes, dotCnt sum for individual
          const totCells = dtIdxs.flatMap((pi, pIdx) =>
            segs.map((seg, si) => {
              const holes      = SEG_HOLES[seg];
              const tot        = isTM
                ? allDotCnt(pi, holes)
                : pivotRows.reduce((s,sp) => s + (sp.id === 'team' ? teamCnt(pi, holes) : dotCnt(pi, sp.id, holes)), 0);
              const isLastSeg  = si === nSegs - 1;
              const isLastP    = pIdx === nPlayers - 1;
              const border     = isLastSeg && !isLastP ? `border-right:2px solid ${SP_BDR}` : 'none';
              return `<td style="text-align:center;font-size:12px;font-weight:800;color:${SP_CLR};background:${tot>0?'#c9a8f0':SP_TOT};padding:3px 1px;${border};">${tot>0?tot:'·'}</td>`;
            })
          ).join('');

          pivHtml = `<div style="margin:0 8px 8px;border-radius:8px;overflow:visible;border:1px solid ${SP_BDR};">
            <table style="border-collapse:collapse;table-layout:fixed;width:100%;">
              ${colgroup}
              <thead>
                <tr>
                  <th style="text-align:left;font-size:10px;font-weight:700;color:${SP_CLR};background:${SP_HDR};padding:4px 8px;white-space:nowrap;"${isSixesTM?' rowspan="2"':''}>Type</th>
                  ${nameHdrs}
                </tr>
                ${isSixesTM ? `<tr>${segHdrs}</tr>` : ''}
              </thead>
              <tbody>
                ${dataRows}
                <tr style="border-top:1.5px solid ${SP_BDR};">
                  <td style="padding:3px 8px;font-size:10px;font-weight:800;color:${SP_CLR};background:${SP_TOT};white-space:nowrap;">Total</td>
                  ${totCells}
                </tr>
              </tbody>
            </table>
          </div>`;
        }
      }

      // Find and replace the pivot div in the rendered DotsTable HTML.
      // The pivot is the last <div> child inside the GameSection wrapper.
      // It's wrapped in: <div style="padding:8px 0 10px">PIVOT</div>
      const pivWrapRe = /<div style="padding:8px 0 10px[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*$/;
      const dotsFixed = pivHtml
        ? dotsRaw.replace(pivWrapRe, `<div style="padding:4px 0 8px;">${pivHtml}</div></div>`)
        : dotsRaw;

      gamesHtml += dotsFixed;
    }
  } catch(e) {
    console.error('buildShareHtml: game table render failed', e);
    // Fall through with whatever gamesHtml was built before the error
  }

  // Post-process: SVG foreignObject does not support overflow scrolling, and
  // table-layout:fixed ignores minWidth when width:100% forces compression.
  // renderToStaticMarkup outputs inline styles as CSS strings, e.g.
  //   style="table-layout:fixed;min-width:324px;width:100%"
  //
  // Fix 1: overflow:hidden clips table content at card boundary → visible.
  // Fix 2: overflow-x:auto scroll wrappers don't scroll → visible.
  // Fix 3: table-layout:fixed tables with min-width get compressed to 100%
  //         container width — switch to auto so columns size to their content.
  gamesHtml = gamesHtml
    .replace(/overflow:\s*hidden/g,  'overflow:visible')
    .replace(/overflow-x:\s*auto/g,  'overflow:visible')
    // Switch any table that has both table-layout:fixed AND min-width to auto layout.
    // Uses a two-pass: first tag them, then replace. Simple string replace:
    .replace(/table-layout:fixed/g, (match, offset, str) => {
      // Check if this style attribute also contains min-width
      const styleStart = str.lastIndexOf('style="', offset);
      const styleEnd   = str.indexOf('"', offset + match.length);
      if (styleStart < 0 || styleEnd < 0) return match;
      const styleContent = str.slice(styleStart, styleEnd);
      return styleContent.includes('min-width') ? 'table-layout:auto' : match;
    });

  const secLabel = t => `<div style="font-size:13px;font-weight:800;color:#1a472a;margin:32px 0 8px;padding-bottom:4px;border-bottom:2px solid #1a472a;">${t}</div>`;

  // Payouts
  const sorted = Object.entries(bank||{}).sort((a,b)=>b[1]-a[1]);
  let payHtml = secLabel('Payouts');
  payHtml += `<div style="border-radius:8px;overflow:hidden;border:1px solid #d8ead8;margin-bottom:16px;">`;
  payHtml += `<div style="background:${G_COLOR};padding:6px 12px;"><span style="font-size:11px;font-weight:800;color:#fff;text-transform:uppercase;letter-spacing:0.5px;">Overall (all games)</span></div>`;
  sorted.forEach(([nm, v], i) => {
    const clr = v>0?GRN_PAY:v<0?RED_PAY:'#888';
    const bg  = i%2===0 ? '#fff' : '#f5fbf5';
    payHtml += `<div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;padding:7px 12px;background:${bg};${i>0?'border-top:1px solid #eef4ee;':''}">`;
    payHtml += `<span style="font-weight:500;color:#222;">${xe(nm)}</span>`;
    payHtml += `<span style="font-weight:800;color:${clr};font-size:14px;">${xe(fmtMoney(v))}</span>`;
    payHtml += `</div>`;
  });
  payHtml += `</div>`;
  payHtml += `<div style="font-size:10px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:8px;padding-bottom:3px;border-bottom:1px solid #ccc;">By Game</div>`;
  const drawPaySec = (label, rows) => {
    const nz = (rows||[]).filter(rr => rr.net != null && rr.net !== 0 && !rr.isHeader);
    if (!nz.length) return '';
    let s = `<div style="margin-bottom:10px;border-radius:8px;overflow:hidden;border:1px solid #c8ddc8;">`;
    s += `<div style="background:#2d6a4f;padding:5px 10px;"><span style="font-size:11px;font-weight:700;color:#fff;">${xe(label)}</span></div>`;
    nz.forEach((rr, i) => {
      const clr = rr.net>0?GRN_PAY:RED_PAY;
      const bg  = i%2===0 ? '#fff' : '#f5fbf5';
      s += `<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:5px 10px;background:${bg};${i>0?'border-top:1px solid #f0f0f0;':''}">`;
      s += `<span style="color:#444;">${xe(rr.name)}</span>`;
      s += `<span style="font-weight:700;color:${clr};">${xe(fmtMoney(rr.net))}</span>`;
      s += `</div>`;
    });
    s += `</div>`; return s;
  };
  (matchPayouts||[]).forEach(m => { payHtml += drawPaySec(m.label, m.rows); });
  // 13-C.8: Filter widened. Previously only the combined '🥊 Match / Nassau'
  // header was filtered out. Now also drops any per-match header starting
  // with '🥊 Match ' (e.g. '🥊 Match A (Tom vs Dave)') because those are
  // emitted by computePayouts under Option A and would double-render alongside
  // the matchPayouts list above.
  (breakdown||[])
    .filter(e =>
      e.game !== '🥊 Match / Nassau' &&
      e.game !== 'Match / Nassau' &&
      !String(e.game || '').startsWith('🥊 Match ')
    )
    .forEach(e => {
      payHtml += drawPaySec(cleanGameName(e.game), (e.rows||[]).map(rr=>({name:rr.name,net:rr.net})));
    });

  return `
    <div xmlns="http://www.w3.org/1999/xhtml" style="margin:0;padding:0;font-family:-apple-system,'Helvetica Neue',sans-serif;background:#fff;width:${foWidth}px;">
      <div style="background:${G_COLOR};padding:${isPortrait?'8px 12px':'10px 18px'};display:flex;align-items:center;justify-content:space-between;">
        ${logoHtml}
        <div style="text-align:right;flex:1;margin-left:${isPortrait?'10px':'16px'};">
          <div style="font-weight:800;font-size:${isPortrait?'12px':'16px'};color:#fff;letter-spacing:0.04em;text-transform:uppercase;line-height:1.2;">${xe((r.course_name||'Unknown Course'))}${ninesSuffix}</div>
          ${isPortrait && ninesLabel ? `<div style="font-size:10px;color:#a8d8a8;font-weight:600;letter-spacing:0.03em;margin-top:1px;">${xe(ninesLabel)}</div>` : ''}
          <div style="font-size:${isPortrait?'9px':'11px'};color:#a8d8a8;margin-top:3px;">${xe(fmtDate(r.date))}</div>
        </div>
      </div>
      <div style="background:#ddeedd;padding:8px 14px;">
        <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:6px;">${chipHtml}</div>
      </div>
      <div style="padding:4px 14px 24px;background:#eef4ee;">
        ${scorecardHtml}
        ${totalsHtml}
        ${gamesHtml.length > 0 ? secLabel('Game Results') + gamesHtml : ''}
        ${payHtml}
        <div style="text-align:center;margin-top:16px;padding-top:8px;border-top:1px solid #e8f0e8;font-size:10px;color:#aaa;">The Card</div>
      </div>
    </div>`;
}

async function buildShareImageForeignObject(r, ar, bank, breakdown, matchPayouts, orientation = 'landscape') {
  const logoDataUri = await getLogoDataUri();
  const html = buildShareHtml(r, ar, bank, breakdown, matchPayouts, logoDataUri, orientation);
  const foWidth = orientation === 'portrait' ? FO_WIDTH_PORTRAIT : FO_WIDTH;

  const probe = document.createElement('div');
  probe.style.cssText = `position:fixed;top:0;left:0;width:${foWidth}px;visibility:hidden;pointer-events:none;z-index:9999;`;
  probe.innerHTML = html;
  document.body.appendChild(probe);
  await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
  const measuredH = probe.scrollHeight;
  document.body.removeChild(probe);

  if (!measuredH || measuredH < 100) {
    throw new Error('foreignObject: height measurement failed (' + measuredH + ')');
  }

  const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${foWidth}" height="${measuredH}">
    <foreignObject width="${foWidth}" height="${measuredH}">
      ${html}
    </foreignObject>
  </svg>`;
  const svgB64  = btoa(unescape(encodeURIComponent(svgStr)));
  const dataUri = `data:image/svg+xml;base64,${svgB64}`;

  const SCALE = 2;
  const canvas = document.createElement('canvas');
  canvas.width  = foWidth  * SCALE;
  canvas.height = measuredH * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);

  await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { ctx.drawImage(img, 0, 0, foWidth, measuredH); resolve(); };
    img.onerror = () => reject(new Error('foreignObject img load failed'));
    img.src = dataUri;
  });

  if (logoDataUri) {
    await new Promise(resolve => {
      const logoImg = new Image();
      logoImg.onload = () => {
        const LOGO_H = 58;
        const logoW  = Math.round(LOGO_H * (logoImg.naturalWidth / logoImg.naturalHeight));
        ctx.drawImage(logoImg, 18, 10, logoW, LOGO_H);
        resolve();
      };
      logoImg.onerror = () => resolve();
      logoImg.src = logoDataUri;
    });
  }

  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('foreignObject: toBlob returned null'));
      }, 'image/png');
    } catch(e) { reject(e); }
  });
}

// ── buildSharePdf — portrait PDF via jsPDF ────────────────────────────────────
// Renders the portrait HTML into a single-page PDF whose height exactly matches
// the content — no page breaks, one continuous scrollable document.
// iOS PDF viewer opens it full-width with vertical scroll. Returns Promise<Blob>.
async function buildSharePdf(r, ar, bank, breakdown, matchPayouts) {
  const logoDataUri = await getLogoDataUri();
  const html = buildShareHtml(r, ar, bank, breakdown, matchPayouts, logoDataUri, 'portrait');

  // ── Step 1: measure content height ─────────────────────────────────────────
  const probe = document.createElement('div');
  probe.style.cssText = `position:fixed;top:0;left:0;width:${FO_WIDTH_PORTRAIT}px;visibility:hidden;pointer-events:none;z-index:9999;background:#fff;`;
  probe.innerHTML = html;
  document.body.appendChild(probe);
  await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
  const measuredH = probe.scrollHeight;
  document.body.removeChild(probe);

  if (!measuredH || measuredH < 100) {
    throw new Error('buildSharePdf: height measurement failed (' + measuredH + ')');
  }

  // ── Step 2: render HTML to canvas via SVG foreignObject ───────────────────
  // Reuse the same SVG foreignObject path already proven to work for PNG —
  // no html2canvas dependency needed.
  const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${FO_WIDTH_PORTRAIT}" height="${measuredH}">
    <foreignObject width="${FO_WIDTH_PORTRAIT}" height="${measuredH}">
      ${html}
    </foreignObject>
  </svg>`;
  const svgB64  = btoa(unescape(encodeURIComponent(svgStr)));
  const dataUri = `data:image/svg+xml;base64,${svgB64}`;

  const SCALE = 2;
  const canvas = document.createElement('canvas');
  canvas.width  = FO_WIDTH_PORTRAIT * SCALE;
  canvas.height = measuredH * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);

  await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { ctx.drawImage(img, 0, 0, FO_WIDTH_PORTRAIT, measuredH); resolve(); };
    img.onerror = () => reject(new Error('buildSharePdf: SVG img load failed'));
    img.src = dataUri;
  });

  // Draw logo overlay (portrait uses smaller logo to match 40px header placeholder)
  if (logoDataUri) {
    await new Promise(resolve => {
      const logoImg = new Image();
      logoImg.onload = () => {
        const LOGO_H = 40;
        const logoW  = Math.round(LOGO_H * (logoImg.naturalWidth / logoImg.naturalHeight));
        ctx.drawImage(logoImg, 12, 8, logoW, LOGO_H);
        resolve();
      };
      logoImg.onerror = () => resolve();
      logoImg.src = logoDataUri;
    });
  }

  // ── Step 3: place canvas onto a single jsPDF page sized to content ─────────
  // Page dimensions in px units: exact content size — no page breaks.
  const doc = new jsPDF({
    orientation: 'portrait',
    unit:        'px',
    format:      [FO_WIDTH_PORTRAIT, measuredH],
    hotfixes:    ['px_scaling'],
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.92);
  doc.addImage(imgData, 'JPEG', 0, 0, FO_WIDTH_PORTRAIT, measuredH);

  return new Promise((resolve, reject) => {
    try {
      const blob = doc.output('blob');
      resolve(blob);
    } catch(e) { reject(e); }
  });
}

export async function buildShareImage(r, ar, bank, breakdown, matchPayouts, orientation = 'landscape') {
  if (orientation === 'portrait') {
    return buildSharePdf(r, ar, bank, breakdown, matchPayouts);
  }
  return buildShareImageForeignObject(r, ar, bank, breakdown, matchPayouts, orientation);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function triggerRoundShare(r, ar, bank, breakdown, matchPayouts, prebuiltBlob, orientation = 'landscape') {
  const blob      = prebuiltBlob || await buildShareImage(r, ar, bank, breakdown, matchPayouts, orientation);
  const isPdf     = orientation === 'portrait';
  const ext       = isPdf ? 'pdf' : 'png';
  const mimeType  = isPdf ? 'application/pdf' : 'image/png';
  const filename  = `the-card-${r.date||'round'}.${ext}`;
  const file      = new File([blob], filename, { type: mimeType });
  const subject   = `${r.course_name||'Golf'} — The Card · ${r.date||''}`;
  const text      = `Round summary from ${r.course_name||'golf'} on ${r.date||'today'}.`;
  if (navigator.canShare && navigator.canShare({ files:[file] })) {
    try { await navigator.share({ files:[file], title:subject, text }); return; }
    catch(err) { if (err.name==='AbortError') return; }
  }
  downloadBlob(blob, filename);
}
