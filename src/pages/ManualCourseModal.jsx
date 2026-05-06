// ─── ManualCourseModal.jsx ─────────────────────────────────────────────────────
// Pure render components — no logic, no state mutations beyond local form state.
// Contains three tightly-coupled components used only together:
//   TeeRow     — one editable tee box row (rating, slope, yardage per nine)
//   NineEditor — one editable nine (pars + stroke index, men's + optional women's)
//   ManualCourseModal — full modal wrapping both, for add and edit flows
//
// Called from CoursesPage for both "Manual" add and "Edit" flows.
// Also called from PhotoImportModal for post-OCR review ("Review & Save" path).
//
// SI validation rules (USGA):
//   2 nines  → nine 0: odd  1,3,5,7,9,11,13,15,17
//              nine 1: even 2,4,6,8,10,12,14,16,18
//   1 or 3+  → each nine: 1–9, no odd/even constraint

import { useState, useRef, useEffect } from 'react';
import { Btn, Inp, G, GA, GB } from '../components/ui.jsx';
import { ScoreKeypad } from './ScoreKeypad.jsx';

const PINK = '#c2185b';
const ERR  = '#c0392b';

// ─── SI helpers ───────────────────────────────────────────────────────────────

function siValidSet(nineCount, nineIdx) {
  if (nineCount === 2) {
    return nineIdx === 0
      ? [1,3,5,7,9,11,13,15,17]
      : [2,4,6,8,10,12,14,16,18];
  }
  return [1,2,3,4,5,6,7,8,9];
}

// Returns Set of hole indices (0-based) with duplicate SI values within this nine
function dupIndices(handicaps) {
  const seen = {};
  handicaps.forEach((v, i) => {
    if (v == null) return;
    const k = String(v);
    if (!seen[k]) seen[k] = [];
    seen[k].push(i);
  });
  const dups = new Set();
  Object.values(seen).forEach(idxs => { if (idxs.length > 1) idxs.forEach(i => dups.add(i)); });
  return dups;
}

// ─── TeeRow ───────────────────────────────────────────────────────────────────
function TeeRow({ tee, nineNames, onChange, onRemove, onActivate, teeIdx = 0, activeFieldId }) {
  const nineCount = nineNames.length;
  const nineYards = (tee.nineYards?.length === nineCount)
    ? tee.nineYards
    : Array(nineCount).fill('');

  const setNineYard = (ni, val) => {
    const next = [...nineYards];
    next[ni] = val === '' ? '' : parseInt(val) || '';
    const total = next.reduce((s, y) => s + (parseInt(y)||0), 0);
    onChange({ ...tee, nineYards: next, totalYards: total || '' });
  };

  const kpField = (fieldId, currentVal, mode, placeholder, onCommit) => {
    if (!onActivate) return null;
    const display  = currentVal !== '' && currentVal != null ? String(currentVal) : '';
    const isActive = activeFieldId === fieldId;
    return (
      <input
        type="text"
        inputMode="none"
        readOnly
        value={display}
        placeholder={placeholder}
        onFocus={(e) => {
          e.target.blur();
          onActivate(fieldId, display, false, mode,
            (newVal) => onCommit(newVal),
            () => {},
          );
        }}
        style={{
          border: isActive ? `2px solid ${G}` : '1px solid #ddd',
          borderRadius:6, padding: isActive ? '2px 4px' : '3px 5px',
          fontSize:12, fontFamily:'inherit',
          background: isActive ? GA : '#fff',
          color: display ? '#222' : '#aaa', cursor:'pointer',
          width:'100%', boxSizing:'border-box', textAlign:'center',
        }}
      />
    );
  };

  const sublbl = { fontSize:9, color:'#aaa', marginBottom:2 };
  const mwLbl  = (color) => ({ fontSize:10, fontWeight:700, color, width:18, flexShrink:0, display:'flex', alignItems:'center' });

  return (
    <div style={{ border:'1.5px solid #e0ece0', borderRadius:10, padding:'8px 10px', marginBottom:6 }}>
      {/* Name + remove */}
      <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:7 }}>
        <Inp value={tee.name} onChange={v=>onChange({...tee,name:v})} placeholder="Tee name"
          style={{ flex:1, fontSize:13, padding:'4px 8px' }}/>
        {onRemove && <Btn small variant="danger" onClick={onRemove} style={{ padding:'3px 7px', fontSize:11 }}>✕</Btn>}
      </div>

      {/* Rating + Slope — M and W stacked, side by side */}
      <div style={{ display:'flex', gap:8, marginBottom:6 }}>
        <div style={{ flex:1 }}>
          <div style={sublbl}>Rating</div>
          <div style={{ display:'flex', gap:3, alignItems:'center', marginBottom:3 }}>
            <span style={mwLbl('#555')}>M</span>
            {onActivate
              ? kpField(`tee${teeIdx}_ratingM`, tee.rating, 'handicap-decimal', '72.3', v => {
                  const n = parseInt(v||'0'); const r = isNaN(n) ? '' : String(n / 10);
                  onChange({...tee, rating: r});
                })
              : <Inp value={tee.rating||''} onChange={v=>onChange({...tee,rating:v})}
                  placeholder="72.3" type="number" style={{ fontSize:12, padding:'3px 5px' }}/>
            }
          </div>
          <div style={{ display:'flex', gap:3, alignItems:'center' }}>
            <span style={mwLbl(PINK)}>W</span>
            {onActivate
              ? kpField(`tee${teeIdx}_ratingW`, tee.ratingW, 'handicap-decimal', '74.1', v => {
                  const n = parseInt(v||'0'); const r = isNaN(n) ? '' : String(n / 10);
                  onChange({...tee, ratingW: r});
                })
              : <Inp value={tee.ratingW||''} onChange={v=>onChange({...tee,ratingW:v})}
                  placeholder="74.1" type="number" style={{ fontSize:12, padding:'3px 5px' }}/>
            }
          </div>
        </div>
        <div style={{ flex:1 }}>
          <div style={sublbl}>Slope</div>
          <div style={{ display:'flex', gap:3, alignItems:'center', marginBottom:3 }}>
            <span style={mwLbl('#555')}>M</span>
            {onActivate
              ? kpField(`tee${teeIdx}_slopeM`, tee.slope, 'integer', '131', v => onChange({...tee, slope: v}))
              : <Inp value={tee.slope||''} onChange={v=>onChange({...tee,slope:v})}
                  placeholder="131" type="number" style={{ fontSize:12, padding:'3px 5px' }}/>
            }
          </div>
          <div style={{ display:'flex', gap:3, alignItems:'center' }}>
            <span style={mwLbl(PINK)}>W</span>
            {onActivate
              ? kpField(`tee${teeIdx}_slopeW`, tee.slopeW, 'integer', '128', v => onChange({...tee, slopeW: v}))
              : <Inp value={tee.slopeW||''} onChange={v=>onChange({...tee,slopeW:v})}
                  placeholder="128" type="number" style={{ fontSize:12, padding:'3px 5px' }}/>
            }
          </div>
        </div>
      </div>

      {/* Yardage */}
      <div style={{ display:'flex', gap:4, alignItems:'flex-end' }}>
        <div style={{ fontSize:9, color:'#aaa', width:18, paddingBottom:2, flexShrink:0 }}>yds</div>
        {nineNames.map((nineName, ni) => (
          <div key={ni} style={{ flex:1 }}>
            <div style={sublbl}>{nineName}</div>
            {onActivate
              ? kpField(`tee${teeIdx}_yds${ni}`, nineYards[ni], 'integer', '3200', v => setNineYard(ni, v))
              : <Inp value={nineYards[ni]||''} onChange={v=>setNineYard(ni, v)}
                  placeholder="3200" type="number" style={{ fontSize:12, padding:'3px 5px' }}/>
            }
          </div>
        ))}
        <div style={{ flex:1 }}>
          <div style={{ fontSize:9, color:G, fontWeight:700, marginBottom:2 }}>Total</div>
          <div style={{ fontSize:12, fontWeight:700, color:G, padding:'3px 5px', background:GB, borderRadius:6, textAlign:'center' }}>
            {nineYards.reduce((s,y) => s+(parseInt(y)||0), 0) || '—'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── NineEditor ───────────────────────────────────────────────────────────────
// nineCount: total nines in this course (determines valid SI set)
// idx:       0-based index of this nine
function NineEditor({ nine, idx, nineCount, onChange, onRemove, showWomens }) {
  const setPars  = pars           => onChange({ ...nine, pars });
  const setHcp   = handicaps      => onChange({ ...nine, handicaps });
  const setParsW = parsWomen      => onChange({ ...nine, parsWomen });
  const setHcpW  = handicapsWomen => onChange({ ...nine, handicapsWomen });

  const parTotM  = nine.pars?.reduce((a,b) => a+b, 0) || 0;
  const parTotW  = nine.parsWomen?.reduce((a,b) => a+b, 0) || 0;
  const validSI  = siValidSet(nineCount, idx);
  const dups     = dupIndices(nine.handicaps || []);
  const dupsW    = dupIndices(nine.handicapsWomen || nine.handicaps || []);
  const hasSIErr = dups.size > 0 || (showWomens && dupsW.size > 0);

  const holeNums = Array.from({length:9}, (_,h) => idx * 9 + h + 1);

  const cellBox = (extra={}) => ({
    width:'100%', boxSizing:'border-box', border:'1px solid #ddd',
    borderRadius:4, fontSize:11, padding:'2px 0', textAlign:'center',
    background:'#fff', ...extra,
  });

  const mwLbl = (color) => ({
    fontSize:10, fontWeight:700, color, width:20, flexShrink:0,
    display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:3,
  });

  const secHdr = (label, sub) => (
    <div style={{ fontSize:10, fontWeight:700, color:'#888', marginBottom:3, display:'flex', alignItems:'baseline', gap:6 }}>
      {label}
      {sub && <span style={{ fontWeight:400, color:'#bbb' }}>{sub}</span>}
    </div>
  );

  const holeNumRow = (
    <div style={{ display:'grid', gridTemplateColumns:'20px repeat(9,1fr)', gap:3, marginBottom:2 }}>
      <div/>
      {holeNums.map(n => (
        <div key={n} style={{ fontSize:8, color:'#bbb', textAlign:'center' }}>{n}</div>
      ))}
    </div>
  );

  return (
    <div style={{ background:'#fafafa', borderRadius:10, padding:'8px 10px', marginBottom:6 }}>
      {/* Nine name + remove */}
      <div style={{ display:'flex', gap:6, marginBottom:7, alignItems:'center' }}>
        <Inp value={nine.name} onChange={v=>onChange({...nine,name:v})} placeholder="Nine name"
          style={{ flex:1, fontSize:13, padding:'4px 8px' }}/>
        {onRemove && <Btn small variant="danger" onClick={onRemove} style={{ padding:'3px 7px' }}>✕</Btn>}
      </div>

      {/* ── Par ── */}
      {secHdr('Par', showWomens && parTotW ? `M ${parTotM} · W ${parTotW}` : `total: ${parTotM}`)}
      {holeNumRow}
      <div style={{ display:'grid', gridTemplateColumns:'20px repeat(9,1fr)', gap:3, marginBottom:3 }}>
        <div style={mwLbl('#555')}>M</div>
        {nine.pars?.map((par, h) => (
          <select key={h} value={par}
            onChange={e => { const p=[...nine.pars]; p[h]=parseInt(e.target.value); setPars(p); }}
            style={cellBox()}>
            {[3,4,5,6].map(v=><option key={v} value={v}>{v}</option>)}
          </select>
        ))}
      </div>
      {showWomens && (
        <div style={{ display:'grid', gridTemplateColumns:'20px repeat(9,1fr)', gap:3, marginBottom:6 }}>
          <div style={mwLbl(PINK)}>W</div>
          {(nine.parsWomen || nine.pars || []).map((par, h) => (
            <select key={h} value={par}
              onChange={e => {
                const base = nine.parsWomen ? [...nine.parsWomen] : [...nine.pars];
                base[h] = parseInt(e.target.value);
                setParsW(base);
              }}
              style={cellBox({ border:`1px solid ${PINK}55`, background:'#fff0f5' })}>
              {[3,4,5,6].map(v=><option key={v} value={v}>{v}</option>)}
            </select>
          ))}
        </div>
      )}

      {/* ── Stroke Index ── */}
      {secHdr('Stroke Index')}
      {holeNumRow}
      <div style={{ display:'grid', gridTemplateColumns:'20px repeat(9,1fr)', gap:3, marginBottom:3 }}>
        <div style={mwLbl('#555')}>M</div>
        {(nine.handicaps || []).map((hc, h) => {
          const isDup = dups.has(h);
          return (
            <select key={h} value={hc}
              onChange={e => { const hs=[...nine.handicaps]; hs[h]=parseInt(e.target.value); setHcp(hs); }}
              style={cellBox(isDup ? { border:`1.5px solid ${ERR}`, color:ERR, background:'#fce8e8' } : {})}>
              {validSI.map(v=><option key={v} value={v}>{v}</option>)}
            </select>
          );
        })}
      </div>
      {showWomens && (
        <div style={{ display:'grid', gridTemplateColumns:'20px repeat(9,1fr)', gap:3, marginBottom: hasSIErr ? 4 : 0 }}>
          <div style={mwLbl(PINK)}>W</div>
          {(nine.handicapsWomen || nine.handicaps || []).map((hc, h) => {
            const isDup = dupsW.has(h);
            return (
              <select key={h} value={hc}
                onChange={e => {
                  const base = nine.handicapsWomen ? [...nine.handicapsWomen] : [...nine.handicaps];
                  base[h] = parseInt(e.target.value);
                  setHcpW(base);
                }}
                style={cellBox(isDup
                  ? { border:`1.5px solid ${ERR}`, color:ERR, background:'#fce8e8' }
                  : { border:`1px solid ${PINK}55`, background:'#fff0f5' })}>
                {validSI.map(v=><option key={v} value={v}>{v}</option>)}
              </select>
            );
          })}
        </div>
      )}

      {hasSIErr && (
        <div style={{ fontSize:10, color:ERR, marginTop:4, fontWeight:600 }}>
          Duplicate stroke index — each value must appear exactly once per nine.
        </div>
      )}
    </div>
  );
}

// ─── ManualCourseModal ─────────────────────────────────────────────────────────
export default function ManualCourseModal({ initialData, onSave, onClose }) {
  const [name,       setName]       = useState(initialData?.name || '');
  const [loc,        setLoc]        = useState(initialData?.location || '');
  const [website,    setWebsite]    = useState(initialData?.website || '');
  const [showWomens, setShowWomens] = useState(
    !!(initialData?.nines?.some(n => n.handicapsWomen?.length || n.parsWomen?.length))
  );
  const [activeTab, setActiveTab] = useState('holes');
  const [saveErr,   setSaveErr]   = useState('');

  // B-12: Setup keypad — ScoreKeypad_Contract §10.5
  const [setupKp, setSetupKp] = useState(null);
  const setupKpRef    = useRef(null);
  const setupKpCbsRef = useRef({ onChange: null, onCommit: null });

  useEffect(() => {
    if (!setupKp) return;
    const handler = (e) => {
      if (setupKpRef.current && setupKpRef.current.contains(e.target)) return;
      const t = e.target;
      if (t && t.tagName === 'INPUT' && t.readOnly && t.getAttribute('inputmode') === 'none') return;
      setupKpCbsRef.current.onCommit?.();
      setSetupKp(null);
    };
    document.addEventListener('touchstart', handler);
    document.addEventListener('mousedown', handler);
    return () => {
      document.removeEventListener('touchstart', handler);
      document.removeEventListener('mousedown', handler);
    };
  }, [setupKp]);

  const activateSetupKp = (fieldId, _seedValue, kpPlus, mode, onChange, onCommit) => {
    setupKpCbsRef.current = { onChange, onCommit };
    setSetupKp({ fieldId, kpValue: '', kpPlus, mode });
  };

  const [nines, setNines] = useState(() => {
    if (initialData?.nines?.length) {
      return initialData.nines.map(n => ({
        name:           n.name || '',
        pars:           n.pars?.length           ? [...n.pars]           : [4,4,3,5,4,3,4,5,4],
        parsWomen:      n.parsWomen?.length       ? [...n.parsWomen]      : null,
        handicaps:      n.handicaps?.length       ? [...n.handicaps]      : [1,3,5,7,9,11,13,15,17],
        handicapsWomen: n.handicapsWomen?.length  ? [...n.handicapsWomen] : null,
      }));
    }
    return [
      { name:'Front', pars:[4,4,3,5,4,3,4,5,4], parsWomen:null, handicaps:[1,3,5,7,9,11,13,15,17], handicapsWomen:null },
      { name:'Back',  pars:[4,4,3,5,4,3,4,5,4], parsWomen:null, handicaps:[2,4,6,8,10,12,14,16,18], handicapsWomen:null },
    ];
  });

  const [tees, setTees] = useState(() => {
    if (initialData?.tees?.length) return initialData.tees.map(t => ({ ...t }));
    return [{ name:'White', rating:'', slope:'', ratingW:'', slopeW:'', nineYards:[], totalYards:'' }];
  });

  const updateNine = (i, val) => { setSaveErr(''); setNines(n => { const a=[...n]; a[i]=val; return a; }); };
  const addNine    = () => setNines(n => [...n, {
    name:'', pars:[4,4,3,5,4,3,4,5,4], parsWomen:null,
    handicaps:[1,2,3,4,5,6,7,8,9], handicapsWomen:null,
  }]);
  const removeNine = (i) => setNines(n => n.filter((_,j) => j!==i));

  const updateTee = (i, val) => setTees(t => { const a=[...t]; a[i]=val; return a; });
  const addTee    = () => setTees(t => [...t, { name:'', rating:'', slope:'', ratingW:'', slopeW:'', nineYards:[], totalYards:'' }]);
  const removeTee = (i) => setTees(t => t.filter((_,j) => j!==i));

  const siErrorNines = () =>
    nines.map((n, i) => {
      const dM = dupIndices(n.handicaps || []);
      const dW = showWomens ? dupIndices(n.handicapsWomen || n.handicaps || []) : new Set();
      return (dM.size > 0 || dW.size > 0) ? (n.name || `Nine ${i+1}`) : null;
    }).filter(Boolean);

  const handleSave = () => {
    if (!name.trim()) return;
    const badNines = siErrorNines();
    if (badNines.length) {
      setSaveErr(`Fix duplicate stroke index values in: ${badNines.join(', ')}`);
      setActiveTab('holes');
      return;
    }
    setSaveErr('');
    const cleanNines = nines.map(n => {
      const out = { ...n, name: n.name, pars: n.pars, handicaps: n.handicaps };
      if (showWomens && n.parsWomen)       out.parsWomen      = n.parsWomen;
      else                                delete out.parsWomen;
      if (showWomens && n.handicapsWomen)  out.handicapsWomen = n.handicapsWomen;
      else                                delete out.handicapsWomen;
      return out;
    });
    const cleanTees = tees.map(t => {
      const out = { ...t };
      if (t.rating  !== '' && t.rating  != null) out.rating  = parseFloat(t.rating);
      else delete out.rating;
      if (t.slope   !== '' && t.slope   != null) out.slope   = parseInt(t.slope);
      else delete out.slope;
      if (t.ratingW !== '' && t.ratingW != null) out.ratingW = parseFloat(t.ratingW);
      else delete out.ratingW;
      if (t.slopeW  !== '' && t.slopeW  != null) out.slopeW  = parseInt(t.slopeW);
      else delete out.slopeW;
      const cleanNY = (t.nineYards||[]).map(y => parseInt(y)||0);
      if (cleanNY.some(y => y > 0)) {
        out.nineYards  = cleanNY;
        out.totalYards = cleanNY.reduce((a,b) => a+b, 0);
      } else if (t.totalYards !== '' && t.totalYards != null) {
        out.totalYards = parseInt(t.totalYards);
        delete out.nineYards;
      } else {
        delete out.nineYards;
        delete out.totalYards;
      }
      return out;
    });
    onSave({ name: name.trim(), location: loc.trim(), website: website.trim(), nines: cleanNines, tees: cleanTees });
  };

  const tabStyle = active => ({
    flex:1, padding:'7px 4px', fontSize:12, fontWeight:700, border:'none', cursor:'pointer',
    background: active ? G : '#f0f8f0', color: active ? '#fff' : '#888',
    borderRadius: active ? 8 : 0, transition:'all .15s',
  });

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:300, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'16px 16px 80px', overflowY:'auto' }} onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:20, padding:20, width:'100%', maxWidth:500, marginTop:10 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
          <div style={{ fontWeight:800, fontSize:17, color:G }}>{initialData ? 'Edit Course' : 'Enter Manually'}</div>
          <button onClick={onClose} style={{ border:'none', background:'none', fontSize:24, cursor:'pointer', color:'#aaa' }}>×</button>
        </div>

        <Inp value={name}    onChange={setName}    placeholder="Course name *"          style={{ marginBottom:6 }}/>
        <Inp value={loc}     onChange={setLoc}     placeholder="City, State (optional)" style={{ marginBottom:6 }}/>
        <Inp value={website} onChange={setWebsite} placeholder="Website (optional)"     style={{ marginBottom:12 }}/>

        {/* Women's data toggle */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12, padding:'7px 12px', background:'#f8f8f8', borderRadius:10 }}>
          <div style={{ flex:1, fontSize:12, color:'#555' }}><strong>Include women's data</strong></div>
          <button onClick={() => setShowWomens(v => !v)}
            style={{ width:40, height:22, borderRadius:11, border:'none', cursor:'pointer',
              background: showWomens ? PINK : '#ddd', position:'relative', flexShrink:0 }}>
            <span style={{ position:'absolute', top:2, width:18, height:18, borderRadius:9,
              background:'#fff', transition:'left .15s', left: showWomens ? 20 : 2 }}/>
          </button>
        </div>

        {/* Tab switcher */}
        <div style={{ display:'flex', background:'#f0f8f0', borderRadius:10, padding:3, marginBottom:12, gap:3 }}>
          <button style={tabStyle(activeTab==='holes')} onClick={()=>setActiveTab('holes')}>Holes &amp; Handicaps</button>
          <button style={tabStyle(activeTab==='tees')}  onClick={()=>setActiveTab('tees')}>Tee Boxes &amp; Yardage</button>
        </div>

        {activeTab === 'holes' && (
          <div>
            {nines.map((nine, ni) => (
              <NineEditor key={ni} nine={nine} idx={ni}
                nineCount={nines.length}
                onChange={v => updateNine(ni, v)}
                onRemove={nines.length > 1 ? () => removeNine(ni) : null}
                showWomens={showWomens}
              />
            ))}
            <Btn small variant="outline" onClick={addNine} style={{ marginBottom:8 }}>+ Add Nine</Btn>
          </div>
        )}

        {activeTab === 'tees' && (
          <div>
            {tees.map((t, ti) => (
              <TeeRow key={ti} tee={t} teeIdx={ti} nineNames={nines.map(n => n.name||`Nine ${ti+1}`)}
                onChange={v => updateTee(ti, v)}
                onRemove={tees.length > 1 ? () => removeTee(ti) : null}
                onActivate={activateSetupKp}
                activeFieldId={setupKp?.fieldId}
              />
            ))}
            <Btn small variant="outline" onClick={addTee} style={{ marginBottom:8 }}>+ Add Tee</Btn>
          </div>
        )}

        {saveErr && (
          <div style={{ background:'#fce8e8', color:ERR, borderRadius:8, padding:'8px 12px', fontSize:12, marginTop:8, fontWeight:600 }}>
            {saveErr}
          </div>
        )}

        <div style={{ display:'flex', gap:8, marginTop:12 }}>
          <Btn variant="outline" onClick={onClose} style={{ flex:1 }}>Cancel</Btn>
          <Btn onClick={handleSave} disabled={!name.trim()} style={{ flex:2 }}>
            {initialData ? 'Save Changes' : 'Save Course'}
          </Btn>
        </div>
      </div>

      {/* B-12: Setup keypad — ScoreKeypad_Contract §10.5, zIndex 1100 */}
      {setupKp && (
        <ScoreKeypad
          containerRef={setupKpRef}
          visible={true}
          value={setupKp.kpValue}
          kpPlus={setupKp.kpPlus}
          mode={setupKp.mode}
          noPlus={true}
          onChange={val => {
            setSetupKp(kp => {
              if (!kp) return null;
              setupKpCbsRef.current.onChange?.(val);
              return { ...kp, kpValue: val };
            });
          }}
          onPlusToggle={() => {}}
          onBackspace={() => {
            setSetupKp(kp => {
              if (!kp) return null;
              const next = kp.kpValue.slice(0, -1);
              setupKpCbsRef.current.onChange?.(next);
              return { ...kp, kpValue: next };
            });
          }}
          onCommit={() => {
            setupKpCbsRef.current.onCommit?.();
            setSetupKp(null);
          }}
        />
      )}
    </div>
  );
}
