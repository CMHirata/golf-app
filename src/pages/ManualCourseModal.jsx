// ─── ManualCourseModal.jsx ─────────────────────────────────────────────────────
// SI validation rules (USGA):
//   2 nines  → nine 0: odd  1,3,5,7,9,11,13,15,17
//              nine 1: even 2,4,6,8,10,12,14,16,18
//   1 or 3+  → each nine: 1–9, no odd/even constraint

import { useState, useRef, useEffect } from 'react';
import { Btn, Inp, G, GA, GB } from '../components/ui.jsx';
import { ScoreKeypad } from './ScoreKeypad.jsx';

const PINK = '#c2185b';
const ERR  = '#c0392b';

// Shared no-arrow select style
const SEL = {
  width:'100%', boxSizing:'border-box', borderRadius:4, fontSize:11,
  padding:'2px 0', textAlign:'center', textAlignLast:'center',
  background:'#fff', border:'1px solid #ddd',
  WebkitAppearance:'none', MozAppearance:'none', appearance:'none',
};

function siValidSet(nineCount, nineIdx) {
  if (nineCount === 2) {
    return nineIdx === 0 ? [1,3,5,7,9,11,13,15,17] : [2,4,6,8,10,12,14,16,18];
  }
  return [1,2,3,4,5,6,7,8,9];
}

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

// ─── Module-level kpField helper ─────────────────────────────────────────────
// Renders a readOnly tap-to-edit field that opens ScoreKeypad (H-14: no system keyboard)
function KpField({ fieldId, value, mode, placeholder, activeFieldId, onActivate, onCommit, style={} }) {
  const display  = value !== '' && value != null ? String(value) : '';
  const isActive = activeFieldId === fieldId;
  return (
    <input type="text" inputMode="none" readOnly value={display} placeholder={placeholder}
      onFocus={e => { e.target.blur(); onActivate(fieldId, '', false, mode, onCommit, ()=>{}); }}
      style={{ border: isActive ? `2px solid ${G}` : '1px solid #ddd', borderRadius:5,
        padding:'3px 4px', fontSize:11, fontFamily:'inherit', background: isActive ? GA : '#fff',
        color: display ? '#222' : '#aaa', cursor:'pointer', width:'100%', boxSizing:'border-box',
        textAlign:'center', ...style }}
    />
  );
}

// ─── TeeRow ───────────────────────────────────────────────────────────────────
function TeeRow({ tee, nineNames, onChange, onRemove, onActivate, teeIdx = 0, activeFieldId }) {
  const nineCount = nineNames.length;
  const nineYards = (tee.nineYards?.length === nineCount) ? tee.nineYards : Array(nineCount).fill('');

  const setNineYard = (ni, val) => {
    const next = [...nineYards];
    next[ni] = val === '' ? '' : parseInt(val) || '';
    onChange({ ...tee, nineYards: next, totalYards: next.reduce((s,y) => s+(parseInt(y)||0), 0) || '' });
  };

  const kp = (fieldId, value, mode, placeholder, onCommit) => (
    <KpField fieldId={fieldId} value={value} mode={mode} placeholder={placeholder}
      activeFieldId={activeFieldId} onActivate={onActivate} onCommit={onCommit}/>
  );

  return (
    <div style={{ border:'1.5px solid #e0ece0', borderRadius:10, padding:'8px 10px', marginBottom:6 }}>
      <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:7 }}>
        <Inp value={tee.name} onChange={v=>onChange({...tee,name:v})} placeholder="Tee name"
          style={{ flex:1, fontSize:13, padding:'4px 8px' }}/>
        {onRemove && <Btn small variant="danger" onClick={onRemove} style={{ padding:'3px 7px', fontSize:11 }}>✕</Btn>}
      </div>

      <div style={{ display:'flex', gap:4, alignItems:'center', marginBottom:5 }}>
        <span style={{ fontSize:10, fontWeight:700, color:'#555', width:14, flexShrink:0 }}>M</span>
        <div style={{ flex:1 }}>
          {kp(`tee${teeIdx}_ratingM`, tee.rating, 'handicap-decimal', 'Rating',
            v => { const n=parseInt(v||'0'); onChange({...tee, rating: isNaN(n)?'':String(n/10)}); })}
        </div>
        <span style={{ fontSize:11, color:'#bbb', flexShrink:0 }}>/</span>
        <div style={{ flex:1 }}>
          {kp(`tee${teeIdx}_slopeM`, tee.slope, 'integer', 'Slope',
            v => onChange({...tee, slope: v}))}
        </div>
        <span style={{ fontSize:10, fontWeight:700, color:PINK, width:14, flexShrink:0, textAlign:'right' }}>W</span>
        <div style={{ flex:1 }}>
          {kp(`tee${teeIdx}_ratingW`, tee.ratingW, 'handicap-decimal', 'Rating',
            v => { const n=parseInt(v||'0'); onChange({...tee, ratingW: isNaN(n)?'':String(n/10)}); })}
        </div>
        <span style={{ fontSize:11, color:'#bbb', flexShrink:0 }}>/</span>
        <div style={{ flex:1 }}>
          {kp(`tee${teeIdx}_slopeW`, tee.slopeW, 'integer', 'Slope',
            v => onChange({...tee, slopeW: v}))}
        </div>
      </div>

      <div style={{ display:'flex', gap:4, alignItems:'center' }}>
        <span style={{ fontSize:10, fontWeight:700, color:'#555', flexShrink:0, paddingRight:2 }}>Yardage</span>
        {nineNames.map((nineName, ni) => (
          <div key={ni} style={{ flex:1 }}>
            {kp(`tee${teeIdx}_yds${ni}`, nineYards[ni], 'integer', nineName,
              v => setNineYard(ni, v))}
          </div>
        ))}
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, fontWeight:700, color:G, padding:'3px 4px', background:GB, borderRadius:5, textAlign:'center' }}>
            {nineYards.reduce((s,y) => s+(parseInt(y)||0), 0) || '—'}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── NineEditor ───────────────────────────────────────────────────────────────
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

  const selStyle = (extra={}) => ({ ...SEL, ...extra });

  const mwLbl = (color) => ({
    fontSize:10, fontWeight:700, color, width:20, flexShrink:0,
    display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:3,
  });

  const secHdr = (label, sub) => (
    <div style={{ fontSize:10, fontWeight:700, color:'#888', marginBottom:3, display:'flex', alignItems:'baseline', gap:6 }}>
      {label}{sub && <span style={{ fontWeight:400, color:'#bbb' }}>{sub}</span>}
    </div>
  );

  const holeNumRow = (
    <div style={{ display:'grid', gridTemplateColumns:'20px repeat(9,1fr)', gap:3, marginBottom:2 }}>
      <div/>
      {holeNums.map(n => <div key={n} style={{ fontSize:8, color:'#bbb', textAlign:'center' }}>{n}</div>)}
    </div>
  );

  return (
    <div style={{ background:'#fafafa', borderRadius:10, padding:'8px 10px', marginBottom:6 }}>
      <div style={{ display:'flex', gap:6, marginBottom:7, alignItems:'center' }}>
        <Inp value={nine.name} onChange={v=>onChange({...nine,name:v})} placeholder="Nine name"
          style={{ flex:1, fontSize:13, padding:'4px 8px' }}/>
        {onRemove && <Btn small variant="danger" onClick={onRemove} style={{ padding:'3px 7px' }}>✕</Btn>}
      </div>

      {/* Par */}
      {secHdr('Par', showWomens && parTotW ? `M ${parTotM} · W ${parTotW}` : `total: ${parTotM}`)}
      {holeNumRow}
      <div style={{ display:'grid', gridTemplateColumns:'20px repeat(9,1fr)', gap:3, marginBottom:3 }}>
        <div style={mwLbl('#555')}>M</div>
        {nine.pars?.map((par, h) => (
          <select key={h} value={par}
            onChange={e => { const p=[...nine.pars]; p[h]=parseInt(e.target.value); setPars(p); }}
            style={selStyle()}>
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
                base[h] = parseInt(e.target.value); setParsW(base);
              }}
              style={selStyle({ border:`1px solid ${PINK}55`, background:'#fff0f5' })}>
              {[3,4,5,6].map(v=><option key={v} value={v}>{v}</option>)}
            </select>
          ))}
        </div>
      )}

      {/* Stroke Index */}
      {secHdr('Stroke Index')}
      {holeNumRow}
      <div style={{ display:'grid', gridTemplateColumns:'20px repeat(9,1fr)', gap:3, marginBottom:3 }}>
        <div style={mwLbl('#555')}>M</div>
        {(nine.handicaps || []).map((hc, h) => {
          const isDup = dups.has(h);
          return (
            <select key={h} value={hc}
              onChange={e => { const hs=[...nine.handicaps]; hs[h]=parseInt(e.target.value); setHcp(hs); }}
              style={selStyle(isDup ? { border:`1.5px solid ${ERR}`, color:ERR, background:'#fce8e8' } : {})}>
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
                  base[h] = parseInt(e.target.value); setHcpW(base);
                }}
                style={selStyle(isDup
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

// ─── TeesTableLayout ──────────────────────────────────────────────────────────
// Tees 2: two aligned tables — Rating/Slope, then Yardage — one row per tee
function TeesTableLayout({ tees, nines, showWomens, onUpdateTee, onAddTee, onRemoveTee, setupKp, onActivate }) {
  const nineNames = nines.map((n,i) => n.name || `Nine ${i+1}`);
  const activeFieldId = setupKp?.fieldId;

  const hdrSt = { fontSize:9, fontWeight:700, color:'#888', textAlign:'center', paddingBottom:3 };

  const kp = (fieldId, value, mode, placeholder, onCommit) => (
    <KpField fieldId={fieldId} value={value} mode={mode} placeholder={placeholder}
      activeFieldId={activeFieldId} onActivate={onActivate} onCommit={onCommit}/>
  );

  return (
    <div>
      {/* ── Rating / Slope table ── */}
      <div style={{ fontSize:10, fontWeight:700, color:'#888', marginBottom:4 }}>Rating / Slope</div>
      <div style={{ marginBottom:12 }}>
        <table style={{ width:'100%', borderCollapse:'collapse', tableLayout:'fixed' }}>
          <colgroup>
            <col style={{ width:'24%' }}/>
            <col style={{ width:'14%' }}/>
            <col style={{ width:'3%'  }}/>
            <col style={{ width:'14%' }}/>
            {showWomens && <col style={{ width:'4%'  }}/>}
            {showWomens && <col style={{ width:'14%' }}/>}
            {showWomens && <col style={{ width:'3%'  }}/>}
            {showWomens && <col style={{ width:'14%' }}/>}
            <col style={{ width:'24px' }}/>
          </colgroup>
          <thead>
            <tr>
              <th></th>
              <th colSpan={3} style={{ ...hdrSt, color:'#555', textAlign:'center', paddingBottom:4 }}>Men</th>
              {showWomens && <th></th>}
              {showWomens && <th colSpan={3} style={{ ...hdrSt, color:PINK, textAlign:'center', paddingBottom:4 }}>Women</th>}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tees.map((t, ti) => (
              <tr key={ti}>
                <td style={{ paddingRight:6, paddingBottom:3 }}>
                  <input value={t.name} placeholder="Tee name"
                    onChange={e=>onUpdateTee(ti,{...t,name:e.target.value})}
                    style={{ border:'1px solid #ddd', borderRadius:4, fontSize:11,
                      padding:'3px 5px', width:'100%', boxSizing:'border-box' }}/>
                </td>
                <td style={{ paddingBottom:3 }}>
                  {kp(`ttl${ti}_rM`, t.rating, 'handicap-decimal', 'Rating',
                    v => { const n=parseInt(v||'0'); onUpdateTee(ti,{...t, rating: isNaN(n)?'':String(n/10)}); })}
                </td>
                <td style={{ fontSize:11, color:'#bbb', textAlign:'center', padding:'0 1px 3px' }}>/</td>
                <td style={{ paddingBottom:3 }}>
                  {kp(`ttl${ti}_sM`, t.slope, 'integer', 'Slope',
                    v => onUpdateTee(ti,{...t, slope: v}))}
                </td>
                {showWomens && <td style={{ paddingBottom:3 }}/>}
                {showWomens && (
                  <td style={{ paddingBottom:3 }}>
                    {kp(`ttl${ti}_rW`, t.ratingW, 'handicap-decimal', 'Rating',
                      v => { const n=parseInt(v||'0'); onUpdateTee(ti,{...t, ratingW: isNaN(n)?'':String(n/10)}); })}
                  </td>
                )}
                {showWomens && (
                  <td style={{ fontSize:11, color:'#bbb', textAlign:'center', padding:'0 1px 3px' }}>/</td>
                )}
                {showWomens && (
                  <td style={{ paddingBottom:3 }}>
                    {kp(`ttl${ti}_sW`, t.slopeW, 'integer', 'Slope',
                      v => onUpdateTee(ti,{...t, slopeW: v}))}
                  </td>
                )}
                <td style={{ paddingLeft:4, paddingBottom:3, textAlign:'right' }}>
                  {tees.length > 1 &&
                    <button onClick={()=>onRemoveTee(ti)}
                      style={{ background:'#e53935', border:'none', borderRadius:'50%', width:18, height:18,
                        color:'#fff', fontSize:11, cursor:'pointer', padding:0,
                        display:'inline-flex', alignItems:'center', justifyContent:'center' }}>✕</button>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Btn small variant="outline" onClick={onAddTee} style={{ marginBottom:14 }}>+ Add Tee</Btn>

      {/* ── Yardage table ── */}
      <div style={{ fontSize:10, fontWeight:700, color:'#888', marginBottom:4 }}>Yardage</div>
      <div style={{ overflowX:'auto', marginBottom:8 }}>
        <table style={{ width:'100%', borderCollapse:'separate', borderSpacing:'0 3px' }}>
          <thead>
            <tr>
              <th style={{ ...hdrSt, textAlign:'left' }}></th>
              {nineNames.map((n,i) => <th key={i} style={hdrSt}>{n}</th>)}
              <th style={{ ...hdrSt, color:G }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {tees.map((t, ti) => {
              const nineYards = (t.nineYards?.length === nineNames.length)
                ? t.nineYards : Array(nineNames.length).fill('');
              const total = nineYards.reduce((s,y) => s+(parseInt(y)||0), 0);
              const setYard = (ni, val) => {
                const next = [...nineYards];
                next[ni] = val === '' ? '' : parseInt(val)||'';
                onUpdateTee(ti, {...t, nineYards: next, totalYards: next.reduce((s,y)=>s+(parseInt(y)||0),0)||''});
              };
              return (
                <tr key={ti}>
                  <td style={{ paddingRight:6, fontSize:11, fontWeight:700, color:'#333', whiteSpace:'nowrap' }}>
                    {t.name || `Tee ${ti+1}`}
                  </td>
                  {nineNames.map((nineName, ni) => (
                    <td key={ni} style={{ paddingRight:2 }}>
                      {kp(`tty${ti}_y${ni}`, nineYards[ni], 'integer', nineName,
                        v => setYard(ni, v))}
                    </td>
                  ))}
                  <td>
                    <div style={{ fontSize:11, fontWeight:700, color:G, padding:'3px 4px',
                      background:GB, borderRadius:4, textAlign:'center' }}>
                      {total || '—'}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── ManualCourseModal ─────────────────────────────────────────────────────────
export default function ManualCourseModal({ initialData, onSave, onClose }) {
  const [name,       setName]       = useState(initialData?.name || '');
  const [loc,        setLoc]        = useState(initialData?.location || '');
  const [showWomens, setShowWomens] = useState(
    !!(initialData?.nines?.some(n => n.handicapsWomen?.length || n.parsWomen?.length))
  );
  const [activeTab,       setActiveTab]       = useState('holes');
  const [saveErr,         setSaveErr]         = useState('');
  const [confirmDiscard,  setConfirmDiscard]  = useState(false);

  const [setupKp, setSetupKp] = useState(null);
  const setupKpRef    = useRef(null);
  const setupKpCbsRef = useRef({ onChange: null, onCommit: null });

  const setupKpStateRef = useRef(null);
  const modalCardRef    = useRef(null);
  setupKpStateRef.current = setupKp;

  useEffect(() => {
    const handler = (e) => {
      if (!setupKpStateRef.current) return;
      const t = e.target;
      // Ignore taps on KpField inputs
      if (t && t.tagName === 'INPUT' && t.readOnly && t.getAttribute('inputmode') === 'none') return;
      // Ignore taps inside keypad
      if (setupKpRef.current && setupKpRef.current.contains(t)) return;
      // Ignore taps inside modal card (e.g. scrolling) — only close on taps outside modal entirely
      if (modalCardRef.current && modalCardRef.current.contains(t)) return;
      setupKpCbsRef.current.onCommit?.();
      setSetupKp(null);
    };
    document.addEventListener('touchstart', handler);
    document.addEventListener('mousedown', handler);
    return () => {
      document.removeEventListener('touchstart', handler);
      document.removeEventListener('mousedown', handler);
    };
  }, []); // register once, never re-register

  const activateSetupKp = (fieldId, _seedValue, kpPlus, mode, onChange, onCommit) => {
    setupKpCbsRef.current = { onChange, onCommit };
    setSetupKp({ fieldId, kpValue: '', kpPlus: kpPlus || false, mode });
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
      if (t.rating  !== '' && t.rating  != null) out.rating  = parseFloat(t.rating);  else delete out.rating;
      if (t.slope   !== '' && t.slope   != null) out.slope   = parseInt(t.slope);     else delete out.slope;
      if (t.ratingW !== '' && t.ratingW != null) out.ratingW = parseFloat(t.ratingW); else delete out.ratingW;
      if (t.slopeW  !== '' && t.slopeW  != null) out.slopeW  = parseInt(t.slopeW);   else delete out.slopeW;
      const cleanNY = (t.nineYards||[]).map(y => parseInt(y)||0);
      if (cleanNY.some(y => y > 0)) {
        out.nineYards  = cleanNY;
        out.totalYards = cleanNY.reduce((a,b) => a+b, 0);
      } else if (t.totalYards !== '' && t.totalYards != null) {
        out.totalYards = parseInt(t.totalYards); delete out.nineYards;
      } else { delete out.nineYards; delete out.totalYards; }
      return out;
    });
    onSave({ name: name.trim(), location: loc.trim(), nines: cleanNines, tees: cleanTees });
  };

  const tabStyle = active => ({
    flex:1, padding:'7px 4px', fontSize:12, fontWeight:700, border:'none', cursor:'pointer',
    background: active ? G : '#f0f8f0', color: active ? '#fff' : '#888',
    borderRadius: active ? 8 : 0, transition:'all .15s',
  });

  const KP_HEIGHT = 300;

  return (
  <>
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:300, display:'flex', alignItems:'flex-start', justifyContent:'center',
      padding:'16px 16px 16px' }}
      onTouchMove={e => e.preventDefault()}
      onTouchStart={e => { if (e.target === e.currentTarget) e.preventDefault(); }}>
      <style>{`
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance:none; margin:0; }
        input[type=number] { -moz-appearance:textfield; }
        select { -webkit-appearance:none; -moz-appearance:none; appearance:none; }
      `}</style>
      <div ref={modalCardRef} style={{ background:'#fff', borderRadius:20, padding:20, width:'100%', maxWidth:500, marginTop:10, position:'relative',
        maxHeight: setupKp ? `calc(100vh - ${KP_HEIGHT + 32}px)` : 'calc(100vh - 32px)',
        overflowY:'auto', transition:'max-height .2s' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
          <div style={{ fontWeight:800, fontSize:17, color:G }}>{initialData ? 'Edit Course' : 'Enter Manually'}</div>
          <button onClick={() => setConfirmDiscard(true)} style={{ border:'none', background:'none', fontSize:24, cursor:'pointer', color:'#aaa' }}>×</button>
        </div>

        <Inp value={name}    onChange={setName}    placeholder="Course name *"          style={{ marginBottom:6 }}/>
        <Inp value={loc}  onChange={setLoc}  placeholder="City, State (optional)" style={{ marginBottom:12 }}/>

        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12, padding:'7px 12px', background:'#f8f8f8', borderRadius:10 }}>
          <div style={{ flex:1, fontSize:12, color:'#555' }}><strong>Include women's data</strong></div>
          <button onClick={() => setShowWomens(v => !v)}
            style={{ width:40, height:22, borderRadius:11, border:'none', cursor:'pointer',
              background: showWomens ? PINK : '#ddd', position:'relative', flexShrink:0 }}>
            <span style={{ position:'absolute', top:2, width:18, height:18, borderRadius:9,
              background:'#fff', transition:'left .15s', left: showWomens ? 20 : 2 }}/>
          </button>
        </div>

        <div style={{ display:'flex', background:'#f0f8f0', borderRadius:10, padding:3, marginBottom:12, gap:3 }}>
          <button style={tabStyle(activeTab==='holes')} onClick={()=>setActiveTab('holes')}>Par &amp; Handicap</button>
          <button style={tabStyle(activeTab==='tees2')} onClick={()=>setActiveTab('tees2')}>Rating/Slope &amp; Yardage</button>
        </div>

        {activeTab === 'holes' && (
          <div>
            {nines.map((nine, ni) => (
              <NineEditor key={ni} nine={nine} idx={ni} nineCount={nines.length}
                onChange={v => updateNine(ni, v)}
                onRemove={nines.length > 1 ? () => removeNine(ni) : null}
                showWomens={showWomens}
              />
            ))}
            <Btn small variant="outline" onClick={addNine} style={{ marginBottom:8 }}>+ Add Nine</Btn>
          </div>
        )}

        {/* TEES 1 — card-per-tee layout, kept for potential settings menu option
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
        */}

        {activeTab === 'tees2' && (
          <TeesTableLayout
            tees={tees} nines={nines} showWomens={showWomens}
            onUpdateTee={updateTee} onAddTee={addTee} onRemoveTee={removeTee}
            setupKp={setupKp} onActivate={activateSetupKp}
          />
        )}

        {saveErr && (
          <div style={{ background:'#fce8e8', color:ERR, borderRadius:8, padding:'8px 12px', fontSize:12, marginTop:8, fontWeight:600 }}>
            {saveErr}
          </div>
        )}

        <div style={{ display:'flex', gap:8, marginTop:12 }}>
          <Btn variant="outline" onClick={() => setConfirmDiscard(true)} style={{ flex:1 }}>Cancel</Btn>
          <Btn onClick={handleSave} disabled={!name.trim()} style={{ flex:2 }}>
            {initialData ? 'Save Changes' : 'Save Course'}
          </Btn>
        </div>

        {/* Discard confirmation */}
        {confirmDiscard && (
          <div style={{ position:'absolute', inset:0, background:'rgba(255,255,255,.96)', borderRadius:20,
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, padding:24 }}>
            <div style={{ fontSize:17, fontWeight:800, color:ERR }}>Discard Changes?</div>
            <div style={{ fontSize:13, color:'#555', textAlign:'center' }}>
              Any unsaved edits will be lost.
            </div>
            <div style={{ display:'flex', gap:10, width:'100%' }}>
              <Btn variant="outline" onClick={() => setConfirmDiscard(false)} style={{ flex:1 }}>Keep Editing</Btn>
              <Btn onClick={onClose} style={{ flex:1, background:ERR, borderColor:ERR }}>Discard</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
    {setupKp && (
      <ScoreKeypad containerRef={setupKpRef} visible={true}
        value={setupKp.kpValue} kpPlus={setupKp.kpPlus} mode={setupKp.mode} noPlus={true}
        onChange={val => {
          setSetupKp(kp => {
            if (!kp) return null;
            if (val === kp.kpValue) return kp;
            setupKpCbsRef.current.onChange?.(val);
            return { ...kp, kpValue: val };
          });
        }}
        onPlusToggle={() => {}}
        onBackspace={() => { setSetupKp(kp => { if (!kp) return null; const next = kp.kpValue.slice(0,-1); setupKpCbsRef.current.onChange?.(next); return { ...kp, kpValue: next }; }); }}
        onCommit={() => { setupKpCbsRef.current.onCommit?.(); setSetupKp(null); }}
      />
    )}
  </>
  );
}
