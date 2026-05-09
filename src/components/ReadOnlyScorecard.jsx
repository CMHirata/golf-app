// ─── components/ReadOnlyScorecard.jsx ─────────────────────────────────────────
//
// ✅ Self-checked (15-G.2 refinement 2): score text wrapped in span with translateY(-0.06em)
// to correct for DM Sans font metrics — cap-height sits below mathematical center of em
// square, leaving optical gap below number. lineHeight:1 removes descender space; the
// translateY nudge corrects residual baseline offset.
// ✅ Self-checked (15-G.2 refinement): lineHeight:1 added to score wrapper div — uses players[pi].siArray
// when present (live or post-13-G.2 saved rounds) and falls back to the existing
// gender-derived womenSI/hcps for legacy snapshots. hcpDots and the three
// xGrossScore call sites updated to read per-player SI. Display SI rows
// (siRows) preserved as-is — they're course/tee intrinsic, not per-player.
//
// ✅ Self-checked (13-E.8): Extracted byte-equivalent from RoundSummaryModal.jsx
// lines 96–332. Both `–` rendering paths preserved: out-of-round (!inRound(h))
// and past-departure (isPastDeparture(h,pi)) produce identical muted-gray cells.
// Handicap dot rendering (hcpDots) and NOL/net logic preserved verbatim.
// All closure dependencies resolved as module-scope imports. isLandscape accepted
// as prop (H-4 — not computed here). No module-scope component defined inside
// another component (module-scope rule). FRONT/BACK constants duplicated
// (trivial; no shared-state concern). useMemo is the only React hook used.
//
// Consumed by: RoundSummaryModal.jsx only.
// Do NOT generalize for other surfaces without a dedicated session.

import { useMemo } from 'react';
import { G, AMB, BIRDIE_COLOR, BOGEY_COLOR } from './ui.jsx';
import { COL_W, TOT_W, NAME_MIN, parRelative } from '../pages/scorecard/scorecardUtils.js';
import { xGrossScore } from '../engine/handicap.js';

const FRONT = [0,1,2,3,4,5,6,7,8];
const BACK  = [9,10,11,12,13,14,15,16,17];

// ── Read-only scorecard ────────────────────────────────────────────────────────
// Uses same COL_W / TOT_W / NAME_MIN as GameTable so hole columns align.
// Portrait: Front 9 over Back 9 (two separate tables, identical widths).
// Landscape: single 18-hole table with F9 / B9 / Tot subtotals.
//
// 13-C.3 (PartialGameContract §12.1): out-of-round holes render as `–`
// (em-dash) in a muted gray cell. Round totals (F9/B9/Tot) sum only
// in-round holes; par totals reflect the full 9-hole halves so the
// printed card stays familiar.
export function ReadOnlyScorecard({ players, scores, pars, hcps, courseSnapshot, isLandscape, frontNineName, backNineName, courseHcps, minCourseHcp, dotMode, roundStartHole = 0, roundEndHole = 17, earlyDepartureOpts = {} }) {
  const inRound = (h) => h >= roundStartHole && h <= roundEndHole;
  // 13-C.7.6: Per-player departure cap. For player pi, holes h > cap[pi]
  // render as `–` (PartialGameContract §5.5). Map keyed by string playerIdx
  // matches earlyDepartureOpts shape.
  const departureCap = (pi) => {
    const e = earlyDepartureOpts?.[pi] ?? earlyDepartureOpts?.[String(pi)];
    return (e && typeof e.departureHole === 'number') ? e.departureHole : null;
  };
  const isPastDeparture = (h, pi) => {
    const cap = departureCap(pi);
    return cap !== null && h > cap;
  };
  const womenSI = useMemo(() => {
    if (!courseSnapshot?.nines) return null;
    // Use same interleaving as buildGenderLayout (odd ranks = front, even = back).
    const nines = courseSnapshot.nines;
    const frontName = frontNineName;
    const backName  = backNineName;
    const front = nines.find(n => n.name === frontName) || nines[0];
    const back  = nines.find(n => n.name === backName)  || nines[1] || nines[0];
    const fhW = front?.handicapsWomen;
    const bhW = back?.handicapsWomen;
    if (fhW?.length !== 9 || bhW?.length !== 9) return null;
    const cfW = new Array(9);
    const cbW = new Array(9);
    [...fhW].map((h,i) => ({h,i})).sort((a,b) => a.h-b.h).forEach(({i}, r) => cfW[i] = 2*r+1);
    [...bhW].map((h,i) => ({h,i})).sort((a,b) => a.h-b.h).forEach(({i}, r) => cbW[i] = 2*r+2);
    return [...cfW, ...cbW];
  }, [courseSnapshot, frontNineName, backNineName]);

  const genders   = players.map(p => (p.gender || '').toLowerCase());
  const hasFemale = genders.some(g => g === 'f' || g === 'female' || g === 'w');
  const hasMale   = genders.some(g => g === 'm' || g === 'male' || !g);
  const mixed     = hasFemale && hasMale;
  const allFem    = hasFemale && !hasMale;

  // 13-G.2: Per-player SI array resolver. Live rounds carry players[pi].siArray
  // already; legacy saved snapshots may not — fall back to gender-derived SI.
  const siArrayFor = (pi) => {
    const p = players[pi];
    if (p?.siArray && Array.isArray(p.siArray) && p.siArray.length === 18) {
      return p.siArray;
    }
    const isF = genders[pi] === 'f' || genders[pi] === 'female' || genders[pi] === 'w';
    return (isF && womenSI) ? womenSI : hcps;
  };

  const siRows = [];
  if (mixed && womenSI) {
    siRows.push({ label: 'Stroke Index (M)', vals: hcps });
    siRows.push({ label: 'Stroke Index (W)', vals: womenSI });
  } else if (allFem && womenSI) {
    siRows.push({ label: 'Stroke Index', vals: womenSI });
  } else {
    siRows.push({ label: 'Stroke Index', vals: hcps });
  }

  const parF = FRONT.reduce((s,h) => s + (pars[h]||0), 0);
  const parB = BACK.reduce((s,h)  => s + (pars[h]||0), 0);

  // Handicap stroke dots — small green circles, absolutely positioned bottom-right.
  // Returns null | array of dot divs | a single '+' span (plus-CH indicator).
  // Handicap_Contract §5.16: when courseHcps[pi] < 0 && hcps[h] <= Math.abs(ch),
  // render a '+' indicator instead of dots.
  // 13-G.2: prefer players[pi].siArray when present (live round); fall back to
  // gender-derived womenSI/hcps for legacy saved snapshots that lack siArray.
  const hcpDots = (pi, h) => {
    if (!courseHcps) return null;
    const ch = courseHcps[pi] ?? 0;
    const siA = players[pi]?.siArray;
    let rank;
    if (siA && Array.isArray(siA) && siA.length === 18) {
      rank = siA[h] ?? 0;
    } else {
      // Legacy snapshot fallback (Handicap_Contract §5.16.1)
      const isF = (genders[pi] === 'f' || genders[pi] === 'female' || genders[pi] === 'w');
      rank = (isF && womenSI) ? (womenSI[h] ?? hcps[h]) : (hcps[h] ?? 0);
    }

    // Plus-CH indicator — checked before dotMode bail (matches shareUtils)
    if (ch < 0 && rank > 18 - Math.abs(ch)) {
      return [<span key="plus" style={{ fontSize: 6, fontWeight: 800, color: G, lineHeight: 1 }}>+</span>];
    }

    if (!dotMode || dotMode === 'gross') return null;

    let strokes = 0;
    if (dotMode === 'netofflow') {
      const diff = ch - (minCourseHcp ?? 0);
      strokes = diff > 0 ? Math.max(0, Math.floor(diff/18) + (rank <= diff%18 ? 1 : 0)) : 0;
    } else {
      strokes = Math.max(0, Math.floor(ch/18) + (rank <= ch%18 ? 1 : 0));
    }
    if (strokes <= 0) return null;
    return Array.from({ length: strokes }).map((_, i) =>
      <div key={i} style={{ width:3, height:3, borderRadius:'50%', background:G, flexShrink:0 }}/>
    );
  };

  // ── ScoreIndicator — par-relative SVG overlay (mirrors ScoreGrid §4.11) ──────
  const ScoreIndicator = ({ level }) => {
    if (!level || level === 'par') return null;
    const isBirdie = level === 'birdie' || level === 'eagle';
    const color = isBirdie ? BIRDIE_COLOR : BOGEY_COLOR;
    const sw = 1.5;
    const svgStyle = { position:'absolute', top:0, left:0, right:0, bottom:0, width:'100%', height:'100%', pointerEvents:'none', overflow:'visible' };
    if (level === 'birdie') return (
      <svg style={svgStyle} viewBox="0 0 26 26">
        <circle cx="13" cy="13" r="11" stroke={color} strokeWidth={sw} fill="none"/>
      </svg>
    );
    if (level === 'eagle') return (
      <svg style={svgStyle} viewBox="0 0 26 26">
        <circle cx="13" cy="13" r="11" stroke={color} strokeWidth={sw} fill="none"/>
        <circle cx="13" cy="13" r="9"  stroke={color} strokeWidth={sw} fill="none"/>
      </svg>
    );
    if (level === 'bogey') return (
      <svg style={svgStyle} viewBox="0 0 26 26">
        <rect x="2.5" y="2.5" width="21" height="21" rx="0" stroke={color} strokeWidth={sw} fill="none"/>
      </svg>
    );
    return (
      <svg style={svgStyle} viewBox="0 0 26 26">
        <rect x="2.5" y="2.5" width="21" height="21" rx="0" stroke={color} strokeWidth={sw} fill="none"/>
        <rect x="4.5" y="4.5" width="17" height="17" rx="0" stroke={color} strokeWidth={sw} fill="none"/>
      </svg>
    );
  };

  // Shared styles for score cells
  const scoreTd = (h, pi) => {
    // 13-C.3: out-of-round holes render as '–' in muted gray (§12.1).
    if (!inRound(h)) {
      return <td key={h} style={{ textAlign:'center', padding:'1px', color:'#ccc', fontSize:10, background:'#f8f8f8' }}>
        <span>–</span>
      </td>;
    }
    // 13-C.7.6: past-departure cells render as '–' per PartialGameContract §5.5.
    if (isPastDeparture(h, pi)) {
      return <td key={h} style={{ textAlign:'center', padding:'1px', color:'#ccc', fontSize:10, background:'#f8f8f8' }}>
        <span>–</span>
      </td>;
    }
    const raw  = scores[h]?.[pi];
    const isX  = raw === 'X';
    const s    = isX ? 1 : (parseInt(raw) || 0);
    const dots = (isX || s) ? hcpDots(pi, h) : null;
    const AMB_X_BG = '#fffbe6';
    if (isX) {
      const xg = xGrossScore(h, courseHcps?.[pi] ?? 0, siArrayFor(pi), pars);
      return (
        <td key={h} style={{ textAlign:'center', padding:'1px', fontSize:10, background: AMB_X_BG }}>
          <div style={{ position:'relative', display:'inline-block', minWidth:12 }}>
            <span style={{ color:'#222' }}>{xg}</span>
            <span style={{ color: AMB, fontSize:'0.85em' }}>X</span>
            {dots && <div style={{ position:'absolute', bottom:0, right:-1, display:'flex', gap:1, pointerEvents:'none' }}>{dots}</div>}
          </div>
        </td>
      );
    }
    const indicator = s ? parRelative(s, pars[h]) : null;
    return <td key={h} style={{ textAlign:'center', padding:'1px', color: s ? '#222' : '#ccc', fontSize:10 }}>
      <div style={{ position:'relative', display:'inline-flex', alignItems:'center', justifyContent:'center', width:20, height:20, lineHeight:1 }}>
        <span style={{ display:'block', lineHeight:1, transform:'translateY(-0.02em)' }}>{s||'·'}</span>
        {indicator && <ScoreIndicator level={indicator}/>}
        {dots && <div style={{ position:'absolute', bottom:0, right:-1, display:'flex', gap:1, pointerEvents:'none' }}>{dots}</div>}
      </div>
    </td>;
  };

  // Shared header cell style
  const totHdr = { textAlign:'center', padding:'2px 3px', background:'#e8f0e8', color:G, fontWeight:800, fontSize:10 };
  const parTd  = (h) => <td key={h} style={{ textAlign:'center', fontSize:9, color:G, fontWeight:600, background:'#f8fbf8' }}>{pars[h]||''}</td>;
  const siTd   = (vals, h) => <td key={h} style={{ textAlign:'center', fontSize:9, color:'#ccc', background:'#fafcfa' }}>{vals?.[h]||''}</td>;

  if (isLandscape) {
    // Single 18-hole table — minWidth matches GameTable landscape minWidth
    const tableMinW = NAME_MIN + 18*COL_W + 2*TOT_W + TOT_W;
    return (
      <div style={{ overflowX:'auto', marginBottom:10 }}>
        <table style={{ borderCollapse:'collapse', tableLayout:'fixed', width:'100%', minWidth: tableMinW, fontSize:10 }}>
          <colgroup>
            <col style={{ minWidth: NAME_MIN }}/>
            {FRONT.map(h => <col key={h} style={{ width: COL_W }}/>)}
            <col style={{ width: TOT_W }}/>
            {BACK.map(h => <col key={h} style={{ width: COL_W }}/>)}
            <col style={{ width: TOT_W }}/>
            <col style={{ width: TOT_W }}/>
          </colgroup>
          <thead>
            <tr>
              <th style={{ textAlign:'left', padding:'2px 6px', background:'#f0f4f0', color:'#555', fontSize:10 }}></th>
              {FRONT.map(h => <th key={h} style={{ textAlign:'center', padding:'2px 1px', background:'#f0f4f0', color:'#555', fontWeight:400, fontSize:10 }}>{h+1}</th>)}
              <th style={totHdr}>F9</th>
              {BACK.map(h => <th key={h} style={{ textAlign:'center', padding:'2px 1px', background:'#f0f4f0', color:'#555', fontWeight:400, fontSize:10 }}>{h+1}</th>)}
              <th style={totHdr}>B9</th>
              <th style={{ ...totHdr, background:'#d8ead8' }}>Tot</th>
            </tr>
            <tr>
              <td style={{ padding:'1px 6px', fontSize:9, color:G, fontWeight:700, background:'#f8fbf8' }}>Par</td>
              {FRONT.map(h => parTd(h))}
              <td style={{ textAlign:'center', fontSize:9, fontWeight:700, color:G, background:'#eef4ee' }}>{parF}</td>
              {BACK.map(h => parTd(h))}
              <td style={{ textAlign:'center', fontSize:9, fontWeight:700, color:G, background:'#eef4ee' }}>{parB}</td>
              <td style={{ textAlign:'center', fontSize:9, fontWeight:700, color:G, background:'#eaf4ea' }}>{parF+parB}</td>
            </tr>
            {siRows.map(({ label, vals }) => (
              <tr key={label}>
                <td style={{ padding:'1px 6px', fontSize:9, color:'#aaa', background:'#fafcfa' }}>{label}</td>
                {FRONT.map(h => siTd(vals, h))}
                <td style={{ background:'#fafcfa' }}/>
                {BACK.map(h => siTd(vals, h))}
                <td style={{ background:'#fafcfa' }}/><td style={{ background:'#fafcfa' }}/>
              </tr>
            ))}
          </thead>
          <tbody>
            {players.map((p, pi) => {
              const name = typeof p === 'string' ? p : p.name;
              const xAware = (holes) => holes.reduce((s, h) => {
                // 13-C.3: out-of-round holes don't contribute to totals (§12.1).
                // Mirrors the portrait `tot` aggregator below.
                if (!inRound(h)) return s;
                const raw = scores[h]?.[pi];
                if (raw === 'X') return s + xGrossScore(h, courseHcps?.[pi] ?? 0, siArrayFor(pi), pars);
                return s + (parseInt(raw) || 0);
              }, 0);
              const f9 = xAware(FRONT);
              const b9 = xAware(BACK);
              return (
                <tr key={pi} style={{ background: pi%2===0 ? '#fff' : '#f5fbf5' }}>
                  <td style={{ padding:'2px 6px', fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontSize:11 }}>{name}</td>
                  {FRONT.map(h => scoreTd(h, pi))}
                  <td style={{ textAlign:'center', fontWeight:700, background:'#eef4ee', color:G, padding:'1px 2px', fontSize:10 }}>{f9||'-'}</td>
                  {BACK.map(h => scoreTd(h, pi))}
                  <td style={{ textAlign:'center', fontWeight:700, background:'#eef4ee', color:G, padding:'1px 2px', fontSize:10 }}>{b9||'-'}</td>
                  <td style={{ textAlign:'center', fontWeight:800, background:'#e8f4e8', color:G, padding:'1px 3px', fontSize:10 }}>{(f9+b9)||'-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // Portrait: two stacked half-tables. Each uses same COL_W/TOT_W/NAME_MIN as GameTable.
  // R-3: Use named nine labels if available, matching ScoreGrid.jsx format.
  const frontLabel = frontNineName ? `Front 9 (${frontNineName})` : 'Front 9';
  const backLabel  = backNineName  ? `Back 9 (${backNineName})`   : 'Back 9';

  const renderHalf = (hs, label, parTot, isFront) => (
    <div style={{ marginBottom:10 }}>
      <div style={{ fontSize:10, fontWeight:600, color:'#888', marginBottom:3 }}>{label}</div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ borderCollapse:'collapse', tableLayout:'fixed', width:'100%', minWidth: NAME_MIN + 9*COL_W + TOT_W, fontSize:10 }}>
          <colgroup>
            <col style={{ minWidth: NAME_MIN }}/>
            {hs.map(h => <col key={h} style={{ width: COL_W }}/>)}
            <col style={{ width: TOT_W }}/>
          </colgroup>
          <thead>
            <tr>
              <th style={{ textAlign:'left', padding:'2px 6px', background:'#f0f4f0', color:'#555', fontSize:10 }}></th>
              {hs.map(h => <th key={h} style={{ textAlign:'center', padding:'2px 1px', background:'#f0f4f0', color:'#555', fontWeight:400 }}>{h+1}</th>)}
              <th style={totHdr}>{isFront ? 'F9' : 'B9'}</th>
            </tr>
            <tr>
              <td style={{ padding:'1px 6px', fontSize:9, color:G, fontWeight:700, background:'#f8fbf8' }}>Par</td>
              {hs.map(h => parTd(h))}
              <td style={{ textAlign:'center', fontSize:9, fontWeight:700, color:G, background:'#eef4ee' }}>{parTot}</td>
            </tr>
            {siRows.map(({ label: siLabel, vals }) => (
              <tr key={siLabel}>
                <td style={{ padding:'1px 6px', fontSize:9, color:'#aaa', background:'#fafcfa' }}>{siLabel}</td>
                {hs.map(h => siTd(vals, h))}
                <td style={{ background:'#fafcfa' }}/>
              </tr>
            ))}
          </thead>
          <tbody>
            {players.map((p, pi) => {
              const name = typeof p === 'string' ? p : p.name;
              const tot  = hs.reduce((s, h) => {
                // 13-C.3: out-of-round holes don't contribute to totals (§12.1).
                if (!inRound(h)) return s;
                const raw = scores[h]?.[pi];
                if (raw === 'X') return s + xGrossScore(h, courseHcps?.[pi] ?? 0, siArrayFor(pi), pars);
                return s + (parseInt(raw) || 0);
              }, 0);
              return (
                <tr key={pi} style={{ background: pi%2===0 ? '#fff' : '#f5fbf5' }}>
                  <td style={{ padding:'2px 6px', fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontSize:11 }}>{name}</td>
                  {hs.map(h => scoreTd(h, pi))}
                  <td style={{ textAlign:'center', fontWeight:700, background:'#eef4ee', color:G, padding:'1px 2px', fontSize:10 }}>{tot||'-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <>
      {renderHalf(FRONT, frontLabel, parF, true)}
      {renderHalf(BACK,  backLabel,  parB, false)}
    </>
  );
}
