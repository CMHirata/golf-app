// ─── ManualCourseModal.jsx ─────────────────────────────────────────────────────
// Pure render components — no logic, no state mutations beyond local form state.
// Contains three tightly-coupled components used only together:
//   TeeRow     — one editable tee box row (rating, slope, yardage per nine)
//   NineEditor — one editable nine (pars + stroke index, men's + optional women's)
//   ManualCourseModal — full modal wrapping both, for add and edit flows
//
// Called from CoursesPage for both "Manual" add and "Edit" flows.

import { useState, useRef, useEffect } from 'react';
import { Btn, Inp, G, GA, GB } from '../components/ui.jsx';
import { ScoreKeypad } from './ScoreKeypad.jsx';

const PINK = '#c2185b';

// ─── TeeRow ───────────────────────────────────────────────────────────────────
// tee shape: { name, rating, slope, ratingW, slopeW, nineYards[], totalYards }
// nineYards: one OUT total per nine in order; totalYards = sum.
// onActivate (optional): custom keypad activation — ScoreKeypad_Contract §6.2/§6.4
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

  // Helper: build a numeric input for keypad-activated fields
  // Uses readOnly + onFocus to suppress iOS keyboard
  const kpField = (fieldId, currentVal, mode, placeholder, onCommit) => {
    if (!onActivate) return null;
    const display = currentVal !== '' && currentVal != null ? String(currentVal) : '';
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
          borderRadius:8, padding: isActive ? '3px 5px' : '4px 6px',
          fontSize:13, fontFamily:'inherit',
          background: isActive ? GA : '#fff',
          color: display ? '#222' : '#aaa', cursor:'pointer',
          width:'100%', boxSizing:'border-box', textAlign:'center',
        }}
      />
    );
  };

  return (
    <div style={{ border:'1.5px solid #e0ece0', borderRadius:10, padding:'10px 12px', marginBottom:8 }}>
      {/* Name + remove */}
      <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:8 }}>
        <Inp value={tee.name} onChange={v=>onChange({...tee,name:v})} placeholder="Tee name" style={{ flex:1, fontSize:13, padding:'5px 8px' }}/>
        {onRemove && <Btn small variant="danger" onClick={onRemove} style={{ padding:'4px 8px', fontSize:11 }}>✕</Btn>}
      </div>
      {/* Men's */}
      <div style={{ display:'flex', gap:6, marginBottom:6, alignItems:'flex-end' }}>
        <div style={{ fontSize:10, fontWeight:700, color:'#555', width:22, paddingBottom:4 }}>M</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:9, color:'#aaa', marginBottom:2 }}>Rating</div>
          {onActivate
            ? kpField(`tee${teeIdx}_ratingM`, tee.rating, 'handicap-decimal', '72.3', v => {
                const n = parseInt(v||'0'); const r = isNaN(n) ? '' : String(n / 10);
                onChange({...tee, rating: r});
              })
            : <Inp value={tee.rating||''} onChange={v=>onChange({...tee,rating:v})} placeholder="72.3" type="number" style={{ fontSize:13, padding:'4px 6px' }}/>
          }
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:9, color:'#aaa', marginBottom:2 }}>Slope</div>
          {onActivate
            ? kpField(`tee${teeIdx}_slopeM`, tee.slope, 'integer', '131', v => {
                onChange({...tee, slope: v});
              })
            : <Inp value={tee.slope||''} onChange={v=>onChange({...tee,slope:v})} placeholder="131" type="number" style={{ fontSize:13, padding:'4px 6px' }}/>
          }
        </div>
      </div>
      {/* Women's */}
      <div style={{ display:'flex', gap:6, marginBottom:8, alignItems:'flex-end' }}>
        <div style={{ fontSize:10, fontWeight:700, color:PINK, width:22, paddingBottom:4 }}>W</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:9, color:'#aaa', marginBottom:2 }}>Rating</div>
          {onActivate
            ? kpField(`tee${teeIdx}_ratingW`, tee.ratingW, 'handicap-decimal', '74.1', v => {
                const n = parseInt(v||'0'); const r = isNaN(n) ? '' : String(n / 10);
                onChange({...tee, ratingW: r});
              })
            : <Inp value={tee.ratingW||''} onChange={v=>onChange({...tee,ratingW:v})} placeholder="74.1" type="number" style={{ fontSize:13, padding:'4px 6px' }}/>
          }
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:9, color:'#aaa', marginBottom:2 }}>Slope</div>
          {onActivate
            ? kpField(`tee${teeIdx}_slopeW`, tee.slopeW, 'integer', '128', v => {
                onChange({...tee, slopeW: v});
              })
            : <Inp value={tee.slopeW||''} onChange={v=>onChange({...tee,slopeW:v})} placeholder="128" type="number" style={{ fontSize:13, padding:'4px 6px' }}/>
          }
        </div>
      </div>
      {/* Nine yardage totals */}
      <div style={{ display:'flex', gap:6, alignItems:'flex-end' }}>
        <div style={{ fontSize:9, color:'#aaa', width:22, paddingBottom:4 }}>yds</div>
        {nineNames.map((nineName, ni) => (
          <div key={ni} style={{ flex:1 }}>
            <div style={{ fontSize:9, color:'#aaa', marginBottom:2 }}>{nineName}</div>
            {onActivate
              ? kpField(`tee${teeIdx}_yds${ni}`, nineYards[ni], 'integer', '3200', v => setNineYard(ni, v))
              : <Inp value={nineYards[ni]||''} onChange={v=>setNineYard(ni, v)}
                  placeholder="3200" type="number" style={{ fontSize:13, padding:'4px 6px' }}/>
            }
          </div>
        ))}
        <div style={{ flex:1 }}>
          <div style={{ fontSize:9, color:G, fontWeight:700, marginBottom:2 }}>Total</div>
          <div style={{ fontSize:13, fontWeight:700, color:G, padding:'4px 6px', background:GB, borderRadius:6, textAlign:'center' }}>
            {nineYards.reduce((s,y) => s+(parseInt(y)||0), 0) || '—'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── NineEditor ───────────────────────────────────────────────────────────────
function NineEditor({ nine, idx, onChange, onRemove, showWomens }) {
  const setPars    = (pars)             => onChange({ ...nine, pars });
  const setHcp     = (handicaps)        => onChange({ ...nine, handicaps });
  const setParsW   = (parsWomen)        => onChange({ ...nine, parsWomen });
  const setHcpW    = (handicapsWomen)   => onChange({ ...nine, handicapsWomen });

  const parTotM = nine.pars?.reduce((a,b) => a+b, 0) || 0;
  const parTotW = nine.parsWomen?.reduce((a,b) => a+b, 0) || 0;

  return (
    <div style={{ background:'#fafafa', borderRadius:10, padding:10, marginBottom:8 }}>
      <div style={{ display:'flex', gap:6, marginBottom:6, alignItems:'center' }}>
        <Inp value={nine.name} onChange={v=>onChange({...nine,name:v})} placeholder="Nine name" style={{ flex:1, fontSize:13, padding:'5px 8px' }}/>
        {onRemove && <Btn small variant="danger" onClick={onRemove} style={{ padding:'4px 8px' }}>✕</Btn>}
      </div>

      {/* Men's Par */}
      <div style={{ marginBottom:8 }}>
        <div style={{ fontSize:10, fontWeight:700, color:'#555', marginBottom:3 }}>
          Par — Men's <span style={{ color:'#aaa', fontWeight:400 }}>total: {parTotM}</span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(9,1fr)', gap:3 }}>
          {nine.pars?.map((par, h) => (
            <div key={h} style={{ textAlign:'center' }}>
              <div style={{ fontSize:8, color:'#aaa', marginBottom:1 }}>{idx*9+h+1}</div>
              <select value={par}
                onChange={e => { const p=[...nine.pars]; p[h]=parseInt(e.target.value); setPars(p); }}
                style={{ width:'100%', border:'1px solid #ddd', borderRadius:4, fontSize:11, padding:'2px 0' }}>
                {[3,4,5,6].map(v=><option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Women's Par (if different) */}
      {showWomens && (
        <div style={{ marginBottom:8 }}>
          <div style={{ fontSize:10, fontWeight:700, color:PINK, marginBottom:3 }}>
            Par — Women's <span style={{ color:'#aaa', fontWeight:400 }}>(leave same as men's if identical) total: {parTotW||parTotM}</span>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(9,1fr)', gap:3 }}>
            {(nine.parsWomen || nine.pars || []).map((par, h) => (
              <div key={h} style={{ textAlign:'center' }}>
                <div style={{ fontSize:8, color:'#aaa', marginBottom:1 }}>{idx*9+h+1}</div>
                <select value={par}
                  onChange={e => {
                    const base = nine.parsWomen ? [...nine.parsWomen] : [...nine.pars];
                    base[h] = parseInt(e.target.value);
                    setParsW(base);
                  }}
                  style={{ width:'100%', border:`1px solid ${PINK}55`, borderRadius:4, fontSize:11, padding:'2px 0', background:'#fff0f5' }}>
                  {[3,4,5,6].map(v=><option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Men's Stroke Index */}
      <div style={{ marginBottom: showWomens ? 8 : 0 }}>
        <div style={{ fontSize:10, fontWeight:700, color:'#555', marginBottom:3 }}>Men's Stroke Index (1–18)</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(9,1fr)', gap:3 }}>
          {nine.handicaps?.map((hc, h) => (
            <div key={h} style={{ textAlign:'center' }}>
              <div style={{ fontSize:8, color:'#aaa', marginBottom:1 }}>{idx*9+h+1}</div>
              <input type="number" min={1} max={18} value={hc}
                onChange={e => { const hs=[...nine.handicaps]; hs[h]=parseInt(e.target.value)||1; setHcp(hs); }}
                style={{ width:'100%', border:'1px solid #ddd', borderRadius:4, fontSize:10, textAlign:'center', padding:'2px 0' }}/>
            </div>
          ))}
        </div>
      </div>

      {/* Women's Stroke Index */}
      {showWomens && (
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:PINK, marginBottom:3 }}>Women's Stroke Index (1–18)</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(9,1fr)', gap:3 }}>
            {(nine.handicapsWomen || nine.handicaps || []).map((hc, h) => (
              <div key={h} style={{ textAlign:'center' }}>
                <div style={{ fontSize:8, color:'#aaa', marginBottom:1 }}>{idx*9+h+1}</div>
                <input type="number" min={1} max={18} value={hc}
                  onChange={e => {
                    const base = nine.handicapsWomen ? [...nine.handicapsWomen] : [...nine.handicaps];
                    base[h] = parseInt(e.target.value)||1;
                    setHcpW(base);
                  }}
                  style={{ width:'100%', border:`1px solid ${PINK}55`, borderRadius:4, fontSize:10, textAlign:'center', padding:'2px 0', background:'#fff0f5' }}/>
              </div>
            ))}
          </div>
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
  const [activeTab, setActiveTab] = useState('holes'); // 'holes' | 'tees'

  // B-12: Setup keypad — ScoreKeypad_Contract §10.5
  const [setupKp, setSetupKp] = useState(null);
  const setupKpRef    = useRef(null);
  const setupKpCbsRef = useRef({ onChange: null, onCommit: null });

  // Global touchend dismiss
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
        name:            n.name || '',
        pars:            n.pars?.length            ? [...n.pars]            : [4,4,3,5,4,3,4,5,4],
        parsWomen:       n.parsWomen?.length        ? [...n.parsWomen]       : null,
        handicaps:       n.handicaps?.length        ? [...n.handicaps]       : [1,3,5,7,9,11,13,15,17],
        handicapsWomen:  n.handicapsWomen?.length   ? [...n.handicapsWomen]  : null,
      }));
    }
    return [
      { name:'Front', pars:[4,4,3,5,4,3,4,5,4], parsWomen:null, handicaps:[1,3,5,7,9,11,13,15,17], handicapsWomen:null },
      { name:'Back',  pars:[4,4,3,5,4,3,4,5,4], parsWomen:null, handicaps:[2,4,6,8,10,12,14,16,18], handicapsWomen:null },
    ];
  });

  const [tees, setTees] = useState(() => {
    if (initialData?.tees?.length) {
      return initialData.tees.map(t => ({ ...t }));
    }
    return [{ name:'White', rating:'', slope:'', ratingW:'', slopeW:'', nineYards:[], totalYards:'' }];
  });

  const updateNine = (i, val) => setNines(n => { const a=[...n]; a[i]=val; return a; });
  const addNine    = () => setNines(n => [...n, {
    name:'', pars:[4,4,3,5,4,3,4,5,4], parsWomen:null,
    handicaps:[1,3,5,7,9,11,13,15,17], handicapsWomen:null,
  }]);
  const removeNine = (i) => setNines(n => n.filter((_,j) => j!==i));

  const updateTee = (i, val) => setTees(t => { const a=[...t]; a[i]=val; return a; });
  const addTee    = () => setTees(t => [...t, { name:'', rating:'', slope:'', ratingW:'', slopeW:'', nineYards:[], totalYards:'' }]);
  const removeTee = (i) => setTees(t => t.filter((_,j) => j!==i));

  const handleSave = () => {
    if (!name.trim()) return;
    const cleanNines = nines.map(n => {
      // Spread all nine fields to avoid accidentally dropping any
      const out = { ...n, name: n.name, pars: n.pars, handicaps: n.handicaps };
      if (showWomens && n.parsWomen)      out.parsWomen      = n.parsWomen;
      else                               delete out.parsWomen;
      if (showWomens && n.handicapsWomen) out.handicapsWomen = n.handicapsWomen;
      else                               delete out.handicapsWomen;
      return out;
    });
    const cleanTees = tees.map(t => {
      // Spread all existing tee fields first so nothing is silently dropped,
      // then parse/coerce the editable numeric fields.
      const out = { ...t };
      // Coerce numeric fields — keep as numbers, or delete if blank
      if (t.rating  !== '' && t.rating  != null) out.rating  = parseFloat(t.rating);
      else delete out.rating;
      if (t.slope   !== '' && t.slope   != null) out.slope   = parseInt(t.slope);
      else delete out.slope;
      if (t.ratingW !== '' && t.ratingW != null) out.ratingW = parseFloat(t.ratingW);
      else delete out.ratingW;
      if (t.slopeW  !== '' && t.slopeW  != null) out.slopeW  = parseInt(t.slopeW);
      else delete out.slopeW;
      // nineYards — rebuild from TeeRow state, compute totalYards
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
    flex:1, padding:'8px 4px', fontSize:12, fontWeight:700, border:'none', cursor:'pointer',
    background: active ? G : '#f0f8f0', color: active ? '#fff' : '#888',
    borderRadius: active ? 8 : 0, transition: 'all .15s',
  });

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:300, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'16px 16px 80px', overflowY:'auto' }} onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:20, padding:20, width:'100%', maxWidth:500, marginTop:10 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
          <div style={{ fontWeight:800, fontSize:17, color:G }}>{initialData ? 'Edit Course' : 'Enter Manually'}</div>
          <button onClick={onClose} style={{ border:'none', background:'none', fontSize:24, cursor:'pointer', color:'#aaa' }}>×</button>
        </div>

        {/* Basic info */}
        <Inp value={name}    onChange={setName}    placeholder="Course name *" style={{ marginBottom:6 }}/>
        <Inp value={loc}     onChange={setLoc}     placeholder="City, State (optional)" style={{ marginBottom:6 }}/>
        <Inp value={website} onChange={setWebsite} placeholder="Website (optional)" style={{ marginBottom:12 }}/>

        {/* Women's data toggle */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12, padding:'8px 12px', background:'#f8f8f8', borderRadius:10 }}>
          <div style={{ flex:1, fontSize:12, color:'#555' }}>
            <strong>Include women's data</strong> — separate par & stroke index for women
          </div>
          <button onClick={() => setShowWomens(v => !v)}
            style={{ width:40, height:22, borderRadius:11, border:'none', cursor:'pointer',
              background: showWomens ? PINK : '#ddd', position:'relative', flexShrink:0 }}>
            <span style={{ position:'absolute', top:2, width:18, height:18, borderRadius:9,
              background:'#fff', transition:'left .15s', left: showWomens ? 20 : 2 }}/>
          </button>
        </div>

        {/* Tab switcher */}
        <div style={{ display:'flex', background:'#f0f8f0', borderRadius:10, padding:3, marginBottom:12, gap:3 }}>
          <button style={tabStyle(activeTab==='holes')} onClick={()=>setActiveTab('holes')}>Holes & Handicaps</button>
          <button style={tabStyle(activeTab==='tees')}  onClick={()=>setActiveTab('tees')}>Tee Boxes & Yardage</button>
        </div>

        {activeTab === 'holes' && (
          <div>
            {nines.map((nine, ni) => (
              <NineEditor key={ni} nine={nine} idx={ni}
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
