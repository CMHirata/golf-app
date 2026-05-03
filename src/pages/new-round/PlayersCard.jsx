// ─── PlayersCard.jsx ───────────────────────────────────────────────────────────
// ✅ Self-checked (13-E.7): Verbatim extraction of the Players card body from
// NewRoundPage.jsx (lines ~1039–1150 pre-extraction). No logic added or removed.
// All setters are parent-owned; this component is render-only for the card body.
// TeeDropdown, HIField, CHField imported from NewRoundHelpers (B resolution).
// H-6: no new picker implementations — TeeDropdown is the existing shared component.
// State ownership: zero local state; all values and setters come from props.
// computePlayerCH is passed as a prop (parent owns the closure over course/pars/etc).

import { G, Card } from '../../components/ui.jsx';
import { playerLib } from '../../services/playerLib.js';
import { TeeDropdown, HIField, CHField } from './NewRoundHelpers.jsx';

// Props:
//   Data:    activePlayers, playerHIs, playerTees, playerCHOverrides,
//            selectedTee, course
//   Setters: setShowPlayerPicker, setPlayerHIs, setPlayerTees,
//            setPlayerCHOverrides, setSelectedTee
//   Helpers: computePlayerCH (passed as prop; parent owns closure)
//   B-2:     activateSetupKp (optional) — custom keypad activation
export default function PlayersCard({
  activePlayers, playerHIs, playerTees, playerCHOverrides,
  selectedTee, course,
  setShowPlayerPicker, setPlayerHIs, setPlayerTees,
  setPlayerCHOverrides, setSelectedTee,
  computePlayerCH,
  activateSetupKp,
  activeFieldId,
}) {
  return (
    <Card>
      <div style={{ fontWeight:700, fontSize:14, color:G, marginBottom:8 }}>Players</div>

      {activePlayers.length === 0 ? (
        /* Empty state: plain CTA button */
        <button onClick={() => setShowPlayerPicker(true)}
          style={{ width:'100%', padding:'10px 12px', borderRadius:12, border:'1.5px solid #ddd',
                   background:'#fff', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
          <span style={{ fontSize:13, color:'#aaa' }}>Select players…</span>
        </button>
      ) : (
        /* Populated state: per-player rows only — no summary tile */
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {activePlayers.map(p => {
            const hi      = playerHIs[p.id] ?? p.ghin ?? '';
            const ch      = computePlayerCH(p.id, hi);
            const teeName = playerTees[p.id] || selectedTee || '';
            const hasManualCH = playerCHOverrides[p.id] != null;
            const parts   = (p.name || '').trim().split(/\s+/);
            const first   = parts.slice(0, -1).join(' ') || p.name;
            const last    = parts.length >= 2 ? parts[parts.length - 1] : '';

            return (
              <div key={p.id} style={{ background:'#f8fbf8', borderRadius:10, border:'1px solid #e8f0e8', padding:'6px 10px',
                                       display:'flex', alignItems:'center', gap:6 }}>

                {/* Name — flex left, centers against full right-side height */}
                <div
                  onClick={() => setShowPlayerPicker(true)}
                  style={{ flex:1, cursor:'pointer', minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:G,
                                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {first}
                  </div>
                  {last && (
                    <div style={{ fontSize:11, fontWeight:400, color:G, opacity:0.65,
                                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {last}
                    </div>
                  )}
                </div>

                {/* Right side: HI+CH on top row, tee below — stacked, right-aligned */}
                <div style={{ flexShrink:0 }}>
                  {/* Row 1: HI + CH */}
                  <div style={{ display:'flex', gap:6, marginBottom: course?.tees?.length > 0 ? 5 : 0 }}>
                    <div style={{ width:72 }}>
                      <HIField
                        value={hi}
                        onChange={v => {
                          setPlayerHIs(prev => ({ ...prev, [p.id]: v }));
                          if (hasManualCH) setPlayerCHOverrides(prev => { const n={...prev}; delete n[p.id]; return n; });
                        }}
                        onBlur={v => {
                          const parsed = parseFloat(v);
                          if (!isNaN(parsed) && v.toString().trim() !== '') {
                            playerLib.update(p.id, { ghin: v });
                          }
                        }}
                        onActivate={activateSetupKp ? (fId, kpVal, kpPlus, mode, onChange, onCommit) => {
                          activateSetupKp(fId, kpVal, kpPlus, mode,
                            (newKpVal, newKpPlus) => {
                              if (newKpVal === '') {
                                setPlayerHIs(prev => ({ ...prev, [p.id]: '' }));
                                return;
                              }
                              const n = parseInt(newKpVal);
                              const abs = isNaN(n) ? '' : String(n / 10);
                              const sign = newKpPlus === true;
                              const hiStr = abs === '' ? '' : (sign ? '+' + abs : abs);
                              setPlayerHIs(prev => ({ ...prev, [p.id]: hiStr }));
                              if (hasManualCH) setPlayerCHOverrides(prev => { const next={...prev}; delete next[p.id]; return next; });
                              if (hiStr !== '') playerLib.update(p.id, { ghin: hiStr });
                            },
                            () => {}
                          );
                        } : undefined}
                        fieldId={`hi_${p.id}`}
                        isActive={activeFieldId === `hi_${p.id}`}
                      />
                    </div>
                    <div style={{ width:72 }}>
                      <CHField
                        ch={ch}
                        isManual={hasManualCH}
                        onManualEntry={(v, isPlus) => {
                          if (v === null || v === undefined) {
                            setPlayerCHOverrides(prev => { const next={...prev}; delete next[p.id]; return next; });
                            return;
                          }
                          const signed = isPlus === true ? -v : v;
                          setPlayerCHOverrides(prev => ({ ...prev, [p.id]: signed }));
                          setPlayerHIs(prev => ({ ...prev, [p.id]: '' }));
                          playerLib.update(p.id, { ghin: '' });
                        }}
                        onActivate={activateSetupKp}
                        fieldId={`ch_${p.id}`}
                        isActive={activeFieldId === `ch_${p.id}`}
                      />
                    </div>
                  </div>
                  {/* Row 2: tee dropdown — same width as HI+CH+gap = 150px */}
                  {course?.tees?.length > 0 && (
                    <div style={{ width:150 }}>
                      <TeeDropdown
                        tees={course.tees}
                        value={teeName}
                        onChange={v => {
                          setPlayerTees(prev => {
                            const next = { ...prev };
                            // If this is the first tee pick (all others blank), fill everyone.
                            const othersAllBlank = activePlayers
                              .filter(op => op.id !== p.id)
                              .every(op => !prev[op.id] || prev[op.id] === '');
                            if (othersAllBlank) {
                              activePlayers.forEach(op => { next[op.id] = v; });
                            } else {
                              next[p.id] = v;
                            }
                            return next;
                          });
                          // Keep selectedTee in sync with first player's tee for
                          // any code paths that still read it as a fallback.
                          setSelectedTee(v);
                        }}
                        label="Select tee…"
                      />
                    </div>
                  )}
                </div>

              </div>
            );
          })}

        </div>
      )}
    </Card>
  );
}
