// ─── PlayersPage.jsx ──────────────────────────────────────────────────────────
//
// ✅ Self-checked (15-L rev4): PlayerRow has three icon buttons: camera (tap to
// view/change/remove photo), star toggle, money list toggle. Avatar tap opens
// full-screen photo expand when photo exists; opens file picker otherwise.
// Email/phone removed entirely. Gender kept (needed for handicap) but icon
// removed from row subtitle. Edit modal: photo section removed (handled on row);
// email/phone fields removed; gender toggle kept. MergeModal updated to exclude
// email/phone fields. H-41: icon buttons inside row content area.

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { playerLib } from '../services/playerLib.js';
import { Btn, Inp, Card, G, GA, RED } from '../components/ui.jsx';
import { ScoreKeypad } from './ScoreKeypad.jsx';
import SwipeableRow from '../components/SwipeableRow.jsx';
import PlayerAvatar from '../components/PlayerAvatar.jsx';
import ImageCropOverlay from '../components/ImageCropOverlay.jsx';

// ── SVG icons ─────────────────────────────────────────────────────────────────
const IconWarning = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="#856404" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const IconPerson = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
    stroke="#bbb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

// Camera with + cross (add/change photo)
const IconCameraAdd = ({ color = '#1a472a' }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="3.5"/>
    <line x1="12" y1="11.5" x2="12" y2="14.5"/>
    <line x1="10.5" y1="13" x2="13.5" y2="13"/>
  </svg>
);

// Camera with X (remove photo)
const IconCameraRemove = ({ color = '#999' }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="3.5"/>
    <line x1="10.5" y1="11.5" x2="13.5" y2="14.5"/>
    <line x1="13.5" y1="11.5" x2="10.5" y2="14.5"/>
  </svg>
);

const IconMoney = ({ included }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke={included ? '#27ae60' : '#ccc'}
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"/>
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
  </svg>
);

// ── helpers ───────────────────────────────────────────────────────────────────
function normName(n) { return (n || '').trim().toLowerCase().replace(/\s+/g, ' '); }
const EMPTY_FORM = { name: '', gender: 'M', ghin: '' };

// ── Field ─────────────────────────────────────────────────────────────────────
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

// ── FullScreenPhotoOverlay ────────────────────────────────────────────────────
// H-35: dismiss via explicit buttons only (no tap-outside — prevents accidental
// dismissal while tapping Change/Remove).
// H-39: native non-passive touchmove blocks page scroll.
function FullScreenPhotoOverlay({ player, onChangeTap, onRemove, onClose }) {
  const overlayRef = useRef(null);
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const prevent = (e) => e.preventDefault();
    el.addEventListener('touchmove', prevent, { passive: false });
    return () => el.removeEventListener('touchmove', prevent);
  }, []);

  return (
    <div ref={overlayRef} style={{
      position: 'fixed', inset: 0, zIndex: 1500,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <img src={player.photo} alt={player.name} style={{
        width: '80vw', height: '80vw', maxWidth: 340, maxHeight: 340,
        borderRadius: '50%', objectFit: 'cover', border: '3px solid #fff',
      }} />
      <div style={{ marginTop: 14, color: '#fff', fontSize: 16, fontWeight: 700 }}>{player.name}</div>
      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        {[
          { label: 'Change', action: onChangeTap },
          { label: 'Delete', action: onRemove },
          { label: 'Cancel', action: onClose },
        ].map(({ label, action }) => (
          <button key={label} onClick={action} style={{
            width: 90, padding: '12px 0', borderRadius: 10,
            border: '1.5px solid rgba(255,255,255,0.4)',
            background: 'transparent', color: '#fff',
            fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            textAlign: 'center',
          }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── PlayerModal ───────────────────────────────────────────────────────────────
function PlayerModal({ initial = EMPTY_FORM, onSave, onCancel, title, existingNames = [],
  onActivate, activeFieldId }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });
  const [errors, setErrors] = useState({});
  const ghinRef = useRef(null);
  const btnRowRef = useRef(null);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) { e.name = 'Name is required'; }
    else if (existingNames.includes(normName(form.name))) { e.name = 'A player with this name already exists'; }
    if (!form.ghin.trim()) e.ghin = 'Handicap Index is required';
    return e;
  };

  const handleSave = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onSave({ name: form.name.trim(), gender: form.gender, ghin: form.ghin.trim() });
  };

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
        set('ghin', abs === '' ? '' : (newKpPlus ? '+' + abs : abs));
      },
      () => {},
    );
    setTimeout(() => btnRowRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }), 50);
  } : null;

  const ghinField = (
    <input
      ref={ghinRef}
      type="text"
      inputMode={onActivate ? 'none' : 'text'}
      readOnly={!!onActivate}
      value={form.ghin}
      placeholder="e.g. 8.2  or  +5.4 for plus"
      onFocus={handleGhinFocus || undefined}
      onChange={onActivate ? undefined : e => set('ghin', e.target.value)}
      style={{
        border: activeFieldId === 'ghin' ? `2px solid ${G}` : `1px solid ${errors.ghin ? RED : '#ddd'}`,
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
              <button type="button" key={opt.v} onClick={() => set('gender', opt.v)}
                style={{ flex:1, padding:'9px 0', borderRadius:10, border:`2px solid ${form.gender===opt.v?G:'#ddd'}`, background:form.gender===opt.v?GA:'#fff', fontWeight:700, fontSize:14, color:form.gender===opt.v?G:'#666', cursor:'pointer' }}>
                {opt.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Handicap Index" required error={errors.ghin}>
          {ghinField}
          <div style={{ fontSize:11, color:'#999', marginTop:3 }}>Enter plus handicaps as +5.4. Used to calculate course handicap.</div>
        </Field>
        <div ref={btnRowRef} style={{ display:'flex', gap:10, marginTop:8 }}>
          <Btn variant="outline" onClick={onCancel} style={{ flex:1 }}>Cancel</Btn>
          <Btn onClick={handleSave} style={{ flex:2 }}>
            {title === 'Add Player' ? '+ Add Player' : 'Save Changes'}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ── MergeModal ────────────────────────────────────────────────────────────────
function MergeModal({ dupes, onMerge, onCancel }) {
  const [a, b] = dupes;
  const fields = ['name', 'gender', 'ghin'];
  const labels = { name:'Name', gender:'Gender', ghin:'Handicap Index' };
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
                <button type="button" key={side} onClick={() => setPicks(pk => ({ ...pk, [f]: side }))}
                  style={{ padding:'7px 6px', borderRadius:9, fontSize:12, textAlign:'center', border:`2px solid ${chosen?G:'#e0e0e0'}`, background:chosen?GA:'#fafafa', color:chosen?G:(empty?'#ccc':'#444'), fontWeight:chosen?700:400, cursor:'pointer', fontStyle:empty?'italic':'normal' }}>
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

// ── PlayerRow ─────────────────────────────────────────────────────────────────
// Three icon buttons on right: camera, star, $.
// Avatar tap: photo exists → full-screen expand; no photo → file picker.
// H-41: all buttons inside row content area, not on SwipeableRow handle.
function PlayerRow({ p, onAvatarTap, onToggleStar, onToggleMoney, openId, setOpenId, onEdit, onDelete }) {
  const parts     = p.name?.trim().split(/\s+/) || [];
  const firstName = parts.slice(0, -1).join(' ');
  const lastName  = parts[parts.length - 1];
  const inMoney   = p.inMoneyLists ?? true;

  return (
    <SwipeableRow
      id={p.id}
      openId={openId}
      setOpenId={setOpenId}
      onEdit={onEdit}
      onDelete={onDelete}
      deleteWarning={`Remove ${p.name} from the roster?`}
    >
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:13, border:'1.5px solid #e8f0e8', background:'#fff' }}>

        {/* Avatar */}
        <PlayerAvatar
          player={p}
          size={40}
          starred={p.starred}
          onPress={() => onAvatarTap(p)}
        />

        {/* Name + HI */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:14, color:'#222', lineHeight:1.3 }}>
            {parts.length >= 2 ? <>{firstName} <strong>{lastName}</strong></> : <strong>{p.name}</strong>}
          </div>
          <div style={{ fontSize:11, color:'#888', marginTop:1 }}>
            HI: <strong style={{ color:G }}>{p.ghin || '—'}</strong>
          </div>
        </div>

        {/* Icon button strip */}
        <div style={{ display:'flex', alignItems:'center', gap:2, flexShrink:0 }}>
          {/* Star */}
          <button
            type="button"
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onToggleStar(p); }}
            title={p.starred ? 'Remove from favorites' : 'Mark as favorite'}
            style={{ border:'none', background:'none', cursor:'pointer', padding:'6px', display:'flex', alignItems:'center', fontSize:19, color: p.starred ? '#fff9c4' : '#ddd', textShadow: p.starred ? '0 0 2px rgba(0,0,0,0.35)' : 'none' }}
          >
            ★
          </button>
          {/* Money */}
          <button
            type="button"
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onToggleMoney(p); }}
            title={inMoney ? 'Exclude from Money List' : 'Include in Money List'}
            style={{ border:'none', background:'none', cursor:'pointer', padding:'6px', display:'flex', alignItems:'center' }}
          >
            <IconMoney included={inMoney} />
          </button>
        </div>
      </div>
    </SwipeableRow>
  );
}

// ── PlayersPage ───────────────────────────────────────────────────────────────
export default function PlayersPage() {
  const [players,   setPlayers]   = useState(() => playerLib.list());
  const [modal,     setModal]     = useState(null);
  const [merging,   setMerging]   = useState(null);
  const [openRowId, setOpenRowId] = useState(null);
  const [expandPlayer, setExpandPlayer] = useState(null); // full-screen photo
  const [cropTarget,   setCropTarget]   = useState(null); // { player, imageSrc }

  const fileInputRef    = useRef(null);
  const pendingPhotoRef = useRef(null); // player whose photo is being changed

  // B-11: Setup keypad
  const [setupKp, setSetupKp] = useState(null);
  const setupKpRef    = useRef(null);
  const setupKpCbsRef = useRef({ onChange: null, onCommit: null });

  const refresh = useCallback(() => setPlayers(playerLib.list()), []);

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
  const editNormNames = useMemo(() => {
    if (!modal || modal === 'add') return allNormNames;
    return players.filter(p => p.id !== modal.id).map(p => normName(p.name));
  }, [modal, players, allNormNames]);

  const handleAdd      = (data) => { playerLib.save(data); setModal(null); refresh(); };
  const handleSaveEdit = (data) => { playerLib.update(modal.id, data); setModal(null); refresh(); };
  const handleDelete   = (p)    => { playerLib.delete(p.id); refresh(); };
  const handleMerge    = (idA, idB, merged) => { playerLib.update(idA, merged); playerLib.delete(idB); setMerging(null); refresh(); };

  const handleToggleStar  = useCallback((p) => { playerLib.update(p.id, { starred: !p.starred }); refresh(); }, [refresh]);
  const handleToggleMoney = useCallback((p) => { playerLib.update(p.id, { inMoneyLists: !(p.inMoneyLists ?? true) }); refresh(); }, [refresh]);

  // Avatar tap: photo → full-screen expand; no photo → file picker
  const handleAvatarTap = useCallback((p) => {
    if (p.photo) {
      setExpandPlayer(p);
    } else {
      pendingPhotoRef.current = p;
      fileInputRef.current?.click();
    }
  }, []);


  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !pendingPhotoRef.current) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCropTarget({ player: pendingPhotoRef.current, imageSrc: ev.target.result });
    reader.readAsDataURL(file);
  }, []);

  const handleCropSave = useCallback((base64) => {
    if (!cropTarget) return;
    playerLib.update(cropTarget.player.id, { photo: base64 });
    setCropTarget(null);
    setExpandPlayer(null);
    refresh();
  }, [cropTarget, refresh]);

  const handlePhotoRemove = useCallback((p) => {
    playerLib.update(p.id, { photo: undefined });
    setExpandPlayer(null);
    refresh();
  }, [refresh]);

  // "Change" from full-screen overlay: close overlay, open file picker
  const handleExpandChangeTap = useCallback((p) => {
    setExpandPlayer(null);
    pendingPhotoRef.current = p;
    // Small delay so overlay unmounts before file picker opens
    setTimeout(() => fileInputRef.current?.click(), 50);
  }, []);

  return (
    <div style={{ minHeight:'100vh', background:'#eef4ee' }}>

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleFileChange} />

      {/* Header */}
      <div style={{ background:G, padding:'8px 16px 7px', position:'sticky', top:0, zIndex:10, boxShadow:'0 2px 12px rgba(0,0,0,.2)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <img src="/logo_lockup.png" alt="The Card" style={{ height:58, width:'auto', display:'block' }} />
        <div style={{ color:'#fff', fontWeight:800, fontSize:16, letterSpacing:'0.12em', textTransform:'uppercase', fontFamily:'inherit' }}>Players</div>
      </div>

      <div style={{ padding:'14px 14px 80px', maxWidth:520, margin:'0 auto' }}>

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

        <Btn onClick={() => setModal('add')} style={{ width:'100%', marginBottom:14, padding:'12px', fontSize:15 }}>
          + Add Player
        </Btn>

        <Card style={{ padding:'14px 14px' }}>
          <div style={{ fontWeight:700, fontSize:14, color:G, marginBottom:10 }}>
            Roster — {players.length} player{players.length !== 1 ? 's' : ''}
          </div>
          {players.length === 0 ? (
            <div style={{ textAlign:'center', padding:'28px 0', color:'#bbb' }}>
              <div style={{ marginBottom:8, display:'flex', justifyContent:'center' }}><IconPerson /></div>
              <div style={{ fontSize:14 }}>No players yet.</div>
              <div style={{ fontSize:12, marginTop:4 }}>Tap "+ Add Player" to get started.</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {players.map(p => (
                <PlayerRow
                  key={p.id}
                  p={p}
                  openId={openRowId}
                  setOpenId={setOpenRowId}
                  onEdit={() => { setOpenRowId(null); setModal(p); }}
                  onDelete={() => handleDelete(p)}
                  onAvatarTap={handleAvatarTap}
                  onToggleStar={handleToggleStar}
                  onToggleMoney={handleToggleMoney}
                />
              ))}
            </div>
          )}
        </Card>

        {players.length > 0 && (
          <div style={{ fontSize:11, color:'#aaa', textAlign:'center', marginTop:6 }}>
            Swipe left to edit or delete · tap avatar for photo
          </div>
        )}
      </div>

      {modal === 'add' && (
        <PlayerModal
          title="Add Player"
          onSave={handleAdd}
          onCancel={() => { setModal(null); setSetupKp(null); }}
          existingNames={allNormNames}
          onActivate={activateSetupKp}
          activeFieldId={setupKp?.fieldId}
        />
      )}
      {modal && modal !== 'add' && (
        <PlayerModal
          title="Edit Player"
          initial={modal}
          onSave={handleSaveEdit}
          onCancel={() => { setModal(null); setSetupKp(null); }}
          existingNames={editNormNames}
          onActivate={activateSetupKp}
          activeFieldId={setupKp?.fieldId}
        />
      )}
      {merging && <MergeModal dupes={merging} onMerge={handleMerge} onCancel={() => setMerging(null)} />}

      {expandPlayer && (
        <FullScreenPhotoOverlay
          player={expandPlayer}
          onChangeTap={() => handleExpandChangeTap(expandPlayer)}
          onRemove={() => handlePhotoRemove(expandPlayer)}
          onClose={() => setExpandPlayer(null)}
        />
      )}

      {cropTarget && (
        <ImageCropOverlay
          imageSrc={cropTarget.imageSrc}
          onSave={handleCropSave}
          onCancel={() => setCropTarget(null)}
        />
      )}

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
