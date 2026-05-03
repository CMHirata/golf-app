// ─── PlayersPage.jsx ──────────────────────────────────────────────────────────
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { playerLib } from '../services/playerLib.js';
import { Btn, Inp, Card, G, GA, RED } from '../components/ui.jsx';
import { ScoreKeypad } from './ScoreKeypad.jsx';

// ── SVG icons ─────────────────────────────────────────────────────────────────
const IconWarning = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="#856404" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const IconMail = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
);

const IconPhone = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.8 1.23h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.08 6.08l1.04-1.04a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
  </svg>
);

const IconPerson = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
    stroke="#bbb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

// ─── helpers ──────────────────────────────────────────────────────────────────
function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function normName(n) { return (n || '').trim().toLowerCase().replace(/\s+/g, ' '); }

const EMPTY_FORM = { name: '', gender: 'M', ghin: '', email: '', phone: '' };

// ─── Field ────────────────────────────────────────────────────────────────────
function Field({ label, error, required, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 4 }}>
        {label}{required && <span style={{ color: RED }}> *</span>}
      </div>
      {children}
      {error && <div style={{ fontSize: 11, color: RED, marginTop: 3 }}>{error}</div>}
    </div>
  );
}

// ─── PlayerModal ──────────────────────────────────────────────────────────────
// onActivate (optional): if provided, the GHIN field uses the custom keypad
// instead of the native iOS keyboard. ScoreKeypad_Contract §6.2, §10.5.
function PlayerModal({ initial = EMPTY_FORM, onSave, onCancel, title, existingNames = [], onActivate, activeFieldId }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });
  const [errors, setErrors] = useState({});

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) { e.name = 'Name is required'; }
    else if (existingNames.includes(normName(form.name))) { e.name = 'A player with this name already exists'; }
    if (!form.ghin.trim()) e.ghin = 'Handicap Index is required';
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { e.email = 'Invalid email format'; }
    return e;
  };

  const handleSave = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onSave({ name: form.name.trim(), gender: form.gender, ghin: form.ghin.trim(), email: form.email.trim(), phone: form.phone.trim() });
  };

  // Build the GHIN input — keypad mode or native fallback
  const handleGhinFocus = onActivate ? (e) => {
    e.target.blur();
    const raw = (form.ghin || '').trim();
    const isPlus = raw.startsWith('+');
    const numStr = raw.replace(/^\+/, '');
    const parsed = parseFloat(numStr);
    const kpVal = isNaN(parsed) ? '' : String(Math.round(parsed * 10));
    onActivate('ghin', kpVal, isPlus, 'handicap-decimal',
      (newKpVal, newKpPlus) => {
        if (newKpVal === '') { set('ghin', ''); return; }
        const n = parseInt(newKpVal);
        const abs = isNaN(n) ? '' : String(n / 10);
        const sign = newKpPlus === true;
        set('ghin', abs === '' ? '' : (sign ? '+' + abs : abs));
      },
      () => {},
    );
  } : null;

  const ghinField = (
    <input
      type="text"
      inputMode={onActivate ? 'none' : 'text'}
      readOnly={!!onActivate}
      value={form.ghin}
      placeholder="e.g. 8.2  or  +5.4 for plus"
      onFocus={handleGhinFocus || undefined}
      onChange={onActivate ? undefined : e => set('ghin', e.target.value)}
      style={{
        border: activeFieldId === 'ghin'
          ? `2px solid ${G}`
          : `1px solid ${errors.ghin ? RED : '#ddd'}`,
        borderRadius: 8,
        padding: activeFieldId === 'ghin' ? '7px 10px' : '8px 11px',
        fontSize: 14, fontFamily: 'inherit',
        background: activeFieldId === 'ghin' ? GA : '#fff',
        width: '100%', boxSizing: 'border-box',
        color: form.ghin ? '#222' : '#aaa',
        cursor: onActivate ? 'pointer' : 'text',
      }}
    />
  );

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:1000 }}>
      <div style={{ background:'#fff', borderRadius:'20px 20px 0 0', width:'100%', maxWidth:520, padding:'24px 20px 32px', boxShadow:'0 -4px 24px rgba(0,0,0,0.18)', maxHeight:'92vh', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontWeight:800, fontSize:17, color:G, flex:1 }}>{title}</div>
          <button type="button" onClick={onCancel} style={{ border:'none', background:'#f0f0f0', borderRadius:'50%', width:30, height:30, fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#555' }}>✕</button>
        </div>
        <Field label="Full Name" required error={errors.name}>
          <Inp value={form.name} onChange={v => set('name', v)} placeholder="e.g. John Smith" />
        </Field>
        <Field label="Gender" required>
          <div style={{ display:'flex', gap:10 }}>
            {[{ v:'M', label:'Male' }, { v:'F', label:'Female' }].map(opt => (
              <button type="button" key={opt.v} onClick={() => set('gender', opt.v)} style={{ flex:1, padding:'9px 0', borderRadius:10, border:`2px solid ${form.gender===opt.v?G:'#ddd'}`, background:form.gender===opt.v?GA:'#fff', fontWeight:700, fontSize:14, color:form.gender===opt.v?G:'#666', cursor:'pointer' }}>{opt.label}</button>
            ))}
          </div>
        </Field>
        <Field label="Handicap Index" required error={errors.ghin}>
          {ghinField}
          <div style={{ fontSize:11, color:'#999', marginTop:3 }}>Enter plus handicaps as +5.4. Used to calculate course handicap.</div>
        </Field>
        <div style={{ borderTop:'1px solid #eee', margin:'4px 0 14px', position:'relative' }}>
          <span style={{ position:'absolute', top:-9, left:'50%', transform:'translateX(-50%)', background:'#fff', padding:'0 8px', fontSize:11, color:'#aaa' }}>Optional — for round summary sharing</span>
        </div>
        <Field label="Email" error={errors.email}>
          <Inp value={form.email} onChange={v => set('email', v)} placeholder="player@email.com" type="email" />
        </Field>
        <Field label="Phone">
          <Inp value={form.phone} onChange={v => set('phone', v)} placeholder="(555) 123-4567" type="tel" />
        </Field>
        <div style={{ display:'flex', gap:10, marginTop:8 }}>
          <Btn variant="outline" onClick={onCancel} style={{ flex:1 }}>Cancel</Btn>
          <Btn onClick={handleSave} style={{ flex:2 }}>
            {title === 'Add Player' ? '+ Add Player' : 'Save Changes'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── MergeModal ───────────────────────────────────────────────────────────────
function MergeModal({ dupes, onMerge, onCancel }) {
  const [a, b] = dupes;
  const fields = ['name', 'gender', 'ghin', 'email', 'phone'];
  const labels = { name:'Name', gender:'Gender', ghin:'Handicap Index', email:'Email', phone:'Phone' };
  const initPicks = Object.fromEntries(fields.map(f => [f, (!a[f] && b[f]) ? 'b' : 'a']));
  const [picks, setPicks] = useState(initPicks);
  const merged = Object.fromEntries(fields.map(f => [f, picks[f] === 'b' ? b[f] : a[f]]));
  const fmt = (p, f) => { if (f === 'gender') return p[f] === 'F' ? 'Female' : 'Male'; return p[f] || '—'; };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:1100 }}>
      <div style={{ background:'#fff', borderRadius:'20px 20px 0 0', width:'100%', maxWidth:520, padding:'24px 20px 32px', boxShadow:'0 -4px 24px rgba(0,0,0,0.2)', maxHeight:'92vh', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
          <IconWarning />
          <div style={{ fontWeight:800, fontSize:17, color:'#856404' }}>Duplicate Players Found</div>
        </div>
        <div style={{ fontSize:13, color:'#555', marginBottom:18 }}>
          Two entries exist for <strong>{a.name}</strong>. Tap each field to choose which value to keep. The other record will be deleted.
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'90px 1fr 1fr', gap:6, marginBottom:4 }}>
          <div/>
          <div style={{ fontSize:11, fontWeight:700, color:'#888', textAlign:'center' }}>Record 1</div>
          <div style={{ fontSize:11, fontWeight:700, color:'#888', textAlign:'center' }}>Record 2</div>
        </div>
        {fields.map(f => (
          <div key={f} style={{ display:'grid', gridTemplateColumns:'90px 1fr 1fr', gap:6, marginBottom:7, alignItems:'center' }}>
            <div style={{ fontSize:11, fontWeight:600, color:'#777' }}>{labels[f]}</div>
            {['a','b'].map(side => {
              const p = side === 'a' ? a : b;
              const chosen = picks[f] === side;
              const empty = !p[f];
              return (
                <button type="button" key={side} onClick={() => setPicks(pk => ({ ...pk, [f]: side }))} style={{ padding:'7px 6px', borderRadius:9, fontSize:12, textAlign:'center', border:`2px solid ${chosen?G:'#e0e0e0'}`, background:chosen?GA:'#fafafa', color:chosen?G:(empty?'#ccc':'#444'), fontWeight:chosen?700:400, cursor:'pointer', transition:'all .15s', fontStyle:empty?'italic':'normal' }}>
                  {fmt(p, f)}
                </button>
              );
            })}
          </div>
        ))}
        <div style={{ display:'flex', gap:10, marginTop:16 }}>
          <Btn variant="outline" onClick={onCancel} style={{ flex:1 }}>Cancel</Btn>
          <Btn onClick={() => onMerge(a.id, b.id, merged)} style={{ flex:2 }}>Merge &amp; Save</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── PlayerRow ────────────────────────────────────────────────────────────────
function PlayerRow({ p, onEdit, onDelete }) {
  const parts     = p.name?.trim().split(/\s+/) || [];
  const firstName = parts.slice(0, -1).join(' ');
  const lastName  = parts[parts.length - 1];

  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 12px', borderRadius:13, border:'1.5px solid #e8f0e8', background:'#fff' }}>
      <div style={{ width:40, height:40, borderRadius:'50%', background:p.gender==='F'?'#fce8f3':GA, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontWeight:800, fontSize:14, color:p.gender==='F'?'#a0327a':G, border:`2px solid ${p.gender==='F'?'#f0b8dc':'#c8e6c9'}` }}>
        {initials(p.name)}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:14, color:'#222', lineHeight:1.3 }}>
          {parts.length >= 2 ? <>{firstName} <strong>{lastName}</strong></> : <strong>{p.name}</strong>}
        </div>
        <div style={{ fontSize:11, color:'#888', marginTop:1, display:'flex', alignItems:'center', gap:6 }}>
          {p.gender==='F' ? '♀' : '♂'} · HI: <strong style={{ color:G }}>{p.ghin||'—'}</strong>
          {p.email && <span style={{ color:'#bbb', display:'flex', alignItems:'center' }}><IconMail /></span>}
          {p.phone && <span style={{ color:'#bbb', display:'flex', alignItems:'center' }}><IconPhone /></span>}
        </div>
      </div>
      <div style={{ display:'flex', gap:5, flexShrink:0 }}>
        <Btn small variant="outline" onClick={() => onEdit(p)}>Edit</Btn>
        <Btn small variant="danger"  onClick={() => onDelete(p)}>✕</Btn>
      </div>
    </div>
  );
}

// ─── PlayersPage ──────────────────────────────────────────────────────────────
export default function PlayersPage() {
  const [players, setPlayers] = useState(() => playerLib.list());
  const [modal,   setModal]   = useState(null);
  const [merging, setMerging] = useState(null);

  // B-11: Setup keypad — ScoreKeypad_Contract §10.5
  const [setupKp, setSetupKp] = useState(null);
  const setupKpRef    = useRef(null);
  const setupKpCbsRef = useRef({ onChange: null, onCommit: null });

  const refresh = useCallback(() => setPlayers(playerLib.list()), []);

  // Global touchend dismiss for setup keypad
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

  // Keypad activation callback for GHIN field
  // kpValue always seeded empty for select-to-overwrite UX
  const activateSetupKp = useCallback((fieldId, _seedValue, kpPlus, mode, onChange, onCommit) => {
    setupKpCbsRef.current = { onChange, onCommit };
    setSetupKp({ fieldId, kpValue: '', kpPlus, mode });
  }, []);

  const duplicateGroup = useMemo(() => {
    const seen = {};
    for (const p of players) { const key = normName(p.name); if (seen[key]) return [seen[key], p]; seen[key] = p; }
    return null;
  }, [players]);

  const allNormNames  = useMemo(() => players.map(p => normName(p.name)), [players]);
  const editNormNames = useMemo(() => { if (!modal || modal === 'add') return allNormNames; return players.filter(p => p.id !== modal.id).map(p => normName(p.name)); }, [modal, players, allNormNames]);

  const handleAdd      = (data) => { playerLib.save(data); setModal(null); refresh(); };
  const handleSaveEdit = (data) => { playerLib.update(modal.id, data); setModal(null); refresh(); };
  const handleDelete   = (p)    => { if (!window.confirm(`Remove ${p.name} from the roster?`)) return; playerLib.delete(p.id); refresh(); };
  const handleMerge    = (idA, idB, merged) => { playerLib.update(idA, merged); playerLib.delete(idB); setMerging(null); refresh(); };

  return (
    <div style={{ minHeight:'100vh', background:'#eef4ee' }}>

      {/* ── Header ── */}
      <div style={{ background:G, padding:'8px 16px 7px', position:'sticky', top:0, zIndex:10, boxShadow:'0 2px 12px rgba(0,0,0,.2)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <img src="/logo_lockup.png" alt="The Card" style={{ height:58, width:'auto', display:'block' }} />
        <div style={{ color:'#fff', fontWeight:800, fontSize:16, letterSpacing:'0.12em', textTransform:'uppercase', fontFamily:'inherit' }}>Players</div>
      </div>

      <div style={{ padding:'14px 14px 80px', maxWidth:520, margin:'0 auto' }}>

        {/* Duplicate warning */}
        {duplicateGroup && !merging && (
          <div style={{ background:'#fff3cd', border:'1.5px solid #ffc107', borderRadius:12, padding:'12px 14px', marginBottom:12, display:'flex', alignItems:'center', gap:10 }}>
            <IconWarning />
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:13, color:'#856404' }}>Duplicate player detected</div>
              <div style={{ fontSize:12, color:'#856404', marginTop:2 }}>Two entries for <strong>{duplicateGroup[0].name}</strong> exist.</div>
            </div>
            <Btn small variant="amber" onClick={() => setMerging(duplicateGroup)}>Fix →</Btn>
          </div>
        )}

        {/* Add button */}
        <Btn onClick={() => setModal('add')} style={{ width:'100%', marginBottom:14, padding:'12px', fontSize:15 }}>
          + Add Player
        </Btn>

        {/* Player list */}
        <Card style={{ padding:'14px 14px' }}>
          <div style={{ fontWeight:700, fontSize:14, color:G, marginBottom:10 }}>
            Roster — {players.length} player{players.length!==1?'s':''}
          </div>
          {players.length === 0 ? (
            <div style={{ textAlign:'center', padding:'28px 0', color:'#bbb' }}>
              <div style={{ marginBottom:8, display:'flex', justifyContent:'center' }}><IconPerson /></div>
              <div style={{ fontSize:14 }}>No players yet.</div>
              <div style={{ fontSize:12, marginTop:4 }}>Tap "Add Player" to get started.</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {players.map(p => <PlayerRow key={p.id} p={p} onEdit={p => setModal(p)} onDelete={handleDelete} />)}
            </div>
          )}
        </Card>

        {players.length > 0 && (
          <div style={{ fontSize:11, color:'#aaa', textAlign:'center', marginTop:6, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            <IconMail /> = email on file · <IconPhone /> = phone on file
          </div>
        )}
      </div>

      {modal === 'add' && <PlayerModal title="Add Player" onSave={handleAdd} onCancel={() => { setModal(null); setSetupKp(null); }} existingNames={allNormNames} onActivate={activateSetupKp} activeFieldId={setupKp?.fieldId} />}
      {modal && modal !== 'add' && <PlayerModal title="Edit Player" initial={modal} onSave={handleSaveEdit} onCancel={() => { setModal(null); setSetupKp(null); }} existingNames={editNormNames} onActivate={activateSetupKp} activeFieldId={setupKp?.fieldId} />}
      {merging && <MergeModal dupes={merging} onMerge={handleMerge} onCancel={() => setMerging(null)} />}

      {/* B-11: Setup keypad — zIndex 1100 renders above PlayerModal (zIndex 1000) */}
      {setupKp && (
        <ScoreKeypad
          containerRef={setupKpRef}
          visible={true}
          value={setupKp.kpValue}
          kpPlus={setupKp.kpPlus}
          mode={setupKp.mode}
          noPlus={setupKp.mode !== 'handicap-decimal' && setupKp.mode !== 'handicap-int'}
          onChange={val => {
            setSetupKp(kp => {
              if (!kp) return null;
              setupKpCbsRef.current.onChange?.(val, kp.kpPlus);
              return { ...kp, kpValue: val };
            });
          }}
          onPlusToggle={() => {
            setSetupKp(kp => {
              if (!kp) return null;
              const newPlus = !kp.kpPlus;
              setupKpCbsRef.current.onChange?.(kp.kpValue, newPlus);
              return { ...kp, kpPlus: newPlus };
            });
          }}
          onBackspace={() => {
            setSetupKp(kp => {
              if (!kp) return null;
              const next = kp.kpValue.slice(0, -1);
              setupKpCbsRef.current.onChange?.(next, kp.kpPlus);
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
