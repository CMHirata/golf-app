// ─── scorecard/ZoomModal.jsx ──────────────────────────────────────────────────
// ✅ Self-checked (13-G.2): xGrossScore call + inline gender IIFE for dot/plus
// rendering replaced with players[pi].siArray[h] (Handicap_Contract §5).
// Round-shared hcps/hcpsWomen retained for SI display row only.
//
// RENDER ONLY — no business logic in this file.
// Zoom score entry modal — magnified 3-hole scorecard popup.
//
// Architecture: pure display component. Score entry is handled entirely by
// ScoreGrid's ScoreKeypad overlay. Tapping a cell calls onCellTap(h, pi)
// which routes to ScoreGrid's openKeypadOnCell. The active cell border is
// driven by the activeKpCell prop from ScoreGrid. No hidden input, no keyboard
// focus logic, no advance/retreat logic lives here.

import { G } from '../../components/ui.jsx';
import { strokesForMode, xGrossScore } from '../../engine/handicap.js';

function splitName(fullName = '') {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

function ZoomPopDots({ courseHcp, hcpRank, minCourseHcp, mode }) {
  if (!mode) return null;
  const n = strokesForMode(courseHcp, hcpRank, minCourseHcp, mode);
  if (n <= 0) return null;
  return (
    <div style={{ position: 'absolute', bottom: 3, right: 3, display: 'flex', gap: 2, pointerEvents: 'none' }}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: G }} />
      ))}
    </div>
  );
}

// ── ZoomPlusMark — plus-CH indicator for ZoomModal (Handicap_Contract §5.16) ──
function ZoomPlusMark() {
  return (
    <div style={{ position: 'absolute', bottom: 3, right: 3, pointerEvents: 'none',
      fontSize: 8, fontWeight: 800, color: G, lineHeight: 1 }}>+</div>
  );
}

// isCenter: true for the active (middle) column — larger badge; false for outer columns.
function ZoomDotBadge({ count, isCenter }) {
  if (!count) return null;
  const size   = isCenter ? 22 : 15;
  const fs     = isCenter ? 12 : 7;
  const offset = isCenter ? -5 : -3;
  return (
    <div style={{
      position: 'absolute', top: offset, right: offset,
      width: size, height: size, borderRadius: '50%',
      background: G, color: '#fff',
      fontSize: fs, fontWeight: 800, lineHeight: 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none', zIndex: 2,
    }}>{count}</div>
  );
}

export function ZoomModal({
  players, pars, hcps, hcpsWomen, courseHcps, minCourseHcp,
  effectiveMinCourseHcp, nonParticipantIdxs,
  scores,
  dotMode, isMixed, setDotModeOverride,
  nolDotGame, setNolDotGame, nolDotOptions,
  startLongPress, cancelLongPress,
  dotsGameActive, sc,
  zoomHole, setZoomHole, setZoomOpen,
  setPopup,
  activeKpCell,
  onCellTap,
  cardRef,
  // 13-C.2: Round length — out-of-range holes render as placeholder cells.
  // Defaults preserve full 18-hole behavior when props are absent.
  roundStartHole = 0,
  roundEndHole   = 17,
}) {
  const COL_W  = 62;
  const NAME_W = 90;
  const CELL_H = 67;

  const HDR_BG      = '#f0f4f0';
  const HDR_CLR     = '#555';
  const PAR_BG      = '#f8fbf8';
  const MHCP_BG     = '#fafcfa';
  const PLACEHOLDER = '#f0f4f0';

  const cols   = [zoomHole - 1, zoomHole, zoomHole + 1];
  // 13-C.2: validH now respects round boundary, not just 0..17. For default
  // full rounds (roundStartHole=0, roundEndHole=17) this is identical to the
  // prior h >= 0 && h < 18 check.
  const validH = (h) => h >= roundStartHole && h <= roundEndHole;
  const cellBg = (pi) => pi % 2 === 0 ? '#fff' : '#f5fbf5';
  const isActive = (h, pi) => activeKpCell?.h === h && activeKpCell?.pi === pi;

  const makeCellStyle = (h, pi, isXScore) => ({
    width: '100%', height: '100%',
    boxSizing: 'border-box',
    border: isActive(h, pi) ? `2px solid ${G}` : '1px solid #ddd',
    borderRadius: 4,
    textAlign: 'center',
    fontSize: h === zoomHole ? 26 : 19,
    fontWeight: h === zoomHole ? 700 : 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: isXScore ? '#fffbe6' : '#fff',
    color: h === zoomHole ? '#222' : '#444',
    cursor: 'pointer',
    userSelect: 'none', WebkitUserSelect: 'none',
    position: 'relative',
    minHeight: 63,
  });

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.40)',
        zIndex: 200,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 92, paddingLeft: 8, paddingRight: 8,
      }}
      onMouseDown={() => setZoomOpen(false)}
      onTouchStart={e => e.stopPropagation()}
      onTouchEnd={e => { e.stopPropagation(); if (e.target === e.currentTarget) setZoomOpen(false); }}
    >
      {/* Card */}
      <div
        ref={cardRef}
        style={{
          width: '100%',
          maxWidth: NAME_W + 3 * COL_W + 32,
          background: '#eef4ee',
          borderRadius: 14,
          boxShadow: '0 2px 8px rgba(0,0,0,0.18), 0 8px 28px rgba(0,0,0,0.22), 0 0 0 1px rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}
        onMouseDown={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
        onTouchEnd={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          background: G, padding: '9px 14px 8px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Hole {zoomHole + 1}</div>
          <button
            onClick={() => setZoomOpen(false)}
            style={{
              background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
              color: '#fff', borderRadius: 7, width: 28, height: 28,
              fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
            aria-label="Close zoom"
          >✕</button>
        </div>

        {/* Dot mode pill */}
        {(isMixed || (nolDotOptions || []).length > 0) && (
          <div style={{
            display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
            gap: 6, padding: '5px 10px 4px', background: '#eef4ee',
          }}>
            <span style={{ fontSize: 9, color: '#aaa', flexShrink: 0 }}>Dots:</span>
            <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #c8ddc8' }}>
              {isMixed && (
                <button onClick={() => { setDotModeOverride('net'); setNolDotGame('field'); }}
                  style={{ padding: '2px 7px', fontSize: 9, fontWeight: 600, fontFamily: 'inherit',
                    border: 'none', borderRight: '1px solid #c8ddc8', cursor: 'pointer', lineHeight: 1.4,
                    background: dotMode === 'net' ? G : '#eef4ee',
                    color: dotMode === 'net' ? '#fff' : '#888' }}>Net</button>
              )}
              <button onClick={() => { setDotModeOverride('netofflow'); setNolDotGame('field'); }}
                style={{ padding: '2px 7px', fontSize: 9, fontWeight: 600, fontFamily: 'inherit',
                  border: 'none',
                  borderRight: (nolDotOptions || []).length > 0 ? '1px solid #c8ddc8' : 'none',
                  cursor: 'pointer', lineHeight: 1.4,
                  background: dotMode === 'netofflow' && nolDotGame === 'field' ? G : '#eef4ee',
                  color: dotMode === 'netofflow' && nolDotGame === 'field' ? '#fff' : '#888' }}>NOL</button>
              {(nolDotOptions || []).map((opt, i) => (
                <button key={opt.value} onClick={() => { setDotModeOverride('netofflow'); setNolDotGame(opt.value); }}
                  style={{ padding: '2px 7px', fontSize: 9, fontWeight: 600, fontFamily: 'inherit',
                    border: 'none',
                    borderRight: i < (nolDotOptions || []).length - 1 ? '1px solid #c8ddc8' : 'none',
                    cursor: 'pointer', lineHeight: 1.4,
                    background: dotMode === 'netofflow' && nolDotGame === opt.value ? G : '#eef4ee',
                    color: dotMode === 'netofflow' && nolDotGame === opt.value ? '#fff' : '#888' }}
                >{opt.label}</button>
              ))}
            </div>
          </div>
        )}

        {/* Table */}
        <div style={{ overflow: 'hidden', padding: '0 8px' }}>
          <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%' }}>
            <colgroup>
              <col style={{ width: NAME_W }} />
              {cols.map((_, ci) => <col key={ci} style={{ width: COL_W }} />)}
            </colgroup>
            <thead>
              <tr>
                <th style={{ background: HDR_BG, padding: '5px 6px', fontSize: 11, color: HDR_CLR, textAlign: 'left', fontWeight: 500 }}></th>
                {cols.map((h, ci) => (
                  <th key={ci} style={{
                    background: !validH(h) ? PLACEHOLDER : HDR_BG,
                    color: h === zoomHole ? G : HDR_CLR,
                    fontSize: h === zoomHole ? 18 : 13,
                    fontWeight: h === zoomHole ? 800 : 500,
                    textAlign: 'center', padding: '5px 2px',
                    borderBottom: '1px solid #d8e4d8',
                  }}>{validH(h) ? h + 1 : ''}</th>
                ))}
              </tr>
              <tr>
                <td style={{ background: PAR_BG, padding: '3px 6px', fontSize: 11, color: G, fontWeight: 700 }}>Par</td>
                {cols.map((h, ci) => (
                  <td key={ci} style={{
                    background: !validH(h) ? PLACEHOLDER : PAR_BG,
                    textAlign: 'center', fontSize: h === zoomHole ? 16 : 11,
                    fontWeight: 700, color: G, padding: '3px 2px',
                  }}>{validH(h) ? pars[h] : ''}</td>
                ))}
              </tr>
              <tr>
                <td style={{ background: MHCP_BG, padding: '2px 6px', fontSize: 10, color: '#aaa', fontWeight: 600 }}>M.Hcp</td>
                {cols.map((h, ci) => (
                  <td key={ci} style={{
                    background: !validH(h) ? PLACEHOLDER : MHCP_BG,
                    textAlign: 'center', fontSize: 10, color: '#bbb', padding: '2px 2px',
                  }}>{validH(h) ? hcps[h] : ''}</td>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((p, pi) => {
                const { first, last } = splitName(p.name);
                return (
                  <tr key={pi}>
                    <td style={{
                      padding: '0 6px', background: cellBg(pi),
                      borderTop: '1px solid #eee', verticalAlign: 'middle', height: CELL_H,
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#222', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{first}</div>
                      {last ? <div style={{ fontSize: 11, fontWeight: 400, color: '#888', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{last}</div> : null}
                    </td>
                    {cols.map((h, ci) => {
                      if (!validH(h)) return (
                        <td key={ci} style={{ background: PLACEHOLDER, borderTop: '1px solid #eee', height: CELL_H }} />
                      );
                      const isCenter = h === zoomHole;
                      const dotCount = dotsGameActive ? sc(h, pi) : 0;
                      const val      = scores[h]?.[pi] ?? '';
                      const isXScore = val === 'X';
                      const siA      = players[pi]?.siArray || hcps;
                      const xGross   = isXScore ? xGrossScore(h, courseHcps[pi], siA, pars) : null;
                      return (
                        <td key={ci} style={{
                          padding: 2, position: 'relative',
                          background: cellBg(pi), borderTop: '1px solid #eee', height: CELL_H,
                        }}>
                          <div
                            style={makeCellStyle(h, pi, isXScore)}
                            onMouseDown={e => {
                              e.preventDefault();
                              onCellTap(h, pi);
                              if (h !== zoomHole) setZoomHole(h);
                            }}
                            onTouchStart={() => startLongPress(h, pi)}
                            onTouchEnd={(e) => {
                              e.preventDefault();
                              cancelLongPress(h, pi);
                              onCellTap(h, pi);
                              if (h !== zoomHole) setZoomHole(h);
                            }}
                            onTouchMove={() => cancelLongPress(h, pi)}
                          >
                            {isXScore ? (
                              <>
                                <span>{xGross}</span>
                                <span style={{ color: '#b8860b', fontSize: h === zoomHole ? 16 : 12, fontWeight: 800, marginLeft: 1 }}>X</span>
                              </>
                            ) : (val !== '' && val !== 0 ? val : '')}
                            <ZoomDotBadge count={dotCount} isCenter={isCenter} />
                            {dotMode && !(dotMode === 'netofflow' && nonParticipantIdxs?.has(pi)) && (() => {
                              const ch = courseHcps[pi];
                              // 13-G.2: per-player SI from players[pi].siArray
                              const siRank = siA[h] ?? hcps[h];
                              if (ch < 0 && siRank > 18 - Math.abs(ch)) return <ZoomPlusMark/>;
                              if (ch > 0) return <ZoomPopDots
                                courseHcp={ch} hcpRank={siRank}
                                minCourseHcp={dotMode === 'netofflow' ? effectiveMinCourseHcp : minCourseHcp}
                                mode={dotMode}
                              />;
                              return null;
                            })()}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
