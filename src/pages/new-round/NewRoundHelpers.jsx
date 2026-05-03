// ─── NewRoundHelpers.jsx ───────────────────────────────────────────────────────
// ✅ Self-checked (13-E.7): Module-scope UI helpers extracted verbatim from
// NewRoundPage.jsx (lines ~121–285 pre-extraction). No behavioral changes.
// Imported by NewRoundPage.jsx, CourseCard.jsx, and PlayersCard.jsx.
// These are NOT React components defined inside another component — they are
// module-scope functions (H-module-scope rule satisfied).
//
// Exported: NineDropdown, TeeDropdown, HIField, CHField

import { useState, useEffect, useRef } from 'react';
import { G, GA } from '../../components/ui.jsx';

// ─── NineDropdown ──────────────────────────────────────────────────────────────
// Styled dropdown for selecting a nine (e.g. Front 9 / Back 9).
export function NineDropdown({ nines, value, onChange, label }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    document.addEventListener('touchstart', h);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h); };
  }, [open]);
  const selected = nines.find(n => n.name === value);
  return (
    <div ref={ref} style={{ position:'relative' }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ borderRadius:20, padding:'6px 10px', border:`1.5px solid ${value ? G : '#ddd'}`, background:value ? GA : '#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', gap:4 }}>
        {selected
          ? <span style={{ fontSize:12, fontWeight:700, color:G }}>{selected.name} <span style={{ fontWeight:400, opacity:0.7 }}>(par {selected.pars?.reduce((a,b)=>a+b,0)})</span></span>
          : <span style={{ fontSize:12, color:'#aaa' }}>{label}</span>}
        <span style={{ fontSize:9, color:value ? G : '#bbb', flexShrink:0 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:50, background:'#fff', border:`1.5px solid ${G}`, borderRadius:12, padding:'8px', boxShadow:'0 4px 16px rgba(0,0,0,0.13)' }}>
          {nines.map(n => {
            const sel = n.name === value;
            return (
              <div key={n.name} onClick={() => { onChange(n.name); setOpen(false); }}
                style={{ borderRadius:10, padding:'7px 10px', border:`1.5px solid ${sel?G:'#ddd'}`, background:sel?GA:'#f9fdf9', cursor:'pointer', marginBottom:5 }}>
                <span style={{ fontSize:12, fontWeight:700, color:sel?G:'#333' }}>{n.name}</span>
                <span style={{ fontSize:11, color:'#888', marginLeft:6 }}>par {n.pars?.reduce((a,b)=>a+b,0)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── TeeDropdown ───────────────────────────────────────────────────────────────
// Styled dropdown for per-player tee selection.
// Trigger height matches HI/CH input fields (padding:'5px 4px', fontSize:12, borderRadius:7).
export function TeeDropdown({ tees, value, onChange, label }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    document.addEventListener('touchstart', h);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h); };
  }, [open]);
  const selected = tees.find(t => t.name === value);
  return (
    <div ref={ref} style={{ position:'relative' }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ borderRadius:7, padding:'5px 6px', border:`1px solid ${value ? G : '#ddd'}`,
                 background:value ? GA : '#fff', cursor:'pointer',
                 display:'flex', alignItems:'center', justifyContent:'space-between', gap:3,
                 width:'100%', boxSizing:'border-box' }}>
        {selected ? (
          <span style={{ fontSize:12, fontWeight:700, color:G,
                         overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
            {selected.name}
          </span>
        ) : (
          <span style={{ fontSize:12, color:'#aaa', flex:1 }}>{label}</span>
        )}
        <span style={{ fontSize:9, color:value ? G : '#bbb', flexShrink:0 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', right:0, zIndex:50,
                      background:'#fff', border:`1.5px solid ${G}`, borderRadius:12,
                      padding:'8px', boxShadow:'0 4px 16px rgba(0,0,0,0.13)', minWidth:160 }}>
          {tees.map(t => {
            const sel = t.name === value;
            return (
              <div key={t.name} onClick={() => { onChange(t.name); setOpen(false); }}
                style={{ borderRadius:10, padding:'6px 10px', border:`1.5px solid ${sel?G:'#ddd'}`,
                         background:sel?GA:'#f9fdf9', cursor:'pointer', marginBottom:5,
                         display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ fontSize:12, fontWeight:700, color:sel?G:'#333' }}>{t.name}</span>
                {(t.rating || t.slope) && <span style={{ fontSize:11, color:'#888', marginLeft:8 }}>{t.rating}/{t.slope}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── HIField ───────────────────────────────────────────────────────────────────
export function HIField({ value, onChange, onBlur, onActivate, fieldId, isActive }) {
  const [focused, setFocused] = useState(false);
  const hasVal = value !== '' && value != null;
  const isPlus = hasVal && String(value).trim().startsWith('+');

  const displayVal = focused && !onActivate
    ? value
    : (hasVal
        ? `HI: ${isPlus
            ? '+' + Math.abs(parseFloat(value)).toFixed(1)
            : parseFloat(value).toFixed(1)}`
        : 'HI');

  const handleFocus = (e) => {
    if (!onActivate) { setFocused(true); setTimeout(() => e.target.select(), 0); return; }
    e.target.blur();
    const raw = (value || '').toString().trim();
    const plus = raw.startsWith('+');
    const numStr = raw.replace(/^\+/, '');
    const parsed = parseFloat(numStr);
    const kpVal = isNaN(parsed) ? '' : String(Math.round(parsed * 10));

    onActivate(
      fieldId || 'hi',
      kpVal,
      plus,
      'handicap-decimal',
      (newKpVal, newKpPlus) => {
        const n = parseInt(newKpVal || '0');
        const abs = isNaN(n) || newKpVal === '' ? '' : String(n / 10);
        const sign = newKpPlus === true;
        const hiStr = abs === '' ? '' : (sign ? '+' + abs : abs);
        onChange(hiStr);
        if (onBlur && abs !== '') onBlur(hiStr);
      },
      () => {},
    );
  };

  const borderColor = isActive ? G : '#ddd';
  const borderWidth = isActive ? '2px' : '1px';

  return (
    <input
      type="text"
      inputMode={onActivate ? 'none' : 'decimal'}
      readOnly={!!onActivate}
      value={displayVal}
      onFocus={handleFocus}
      onChange={onActivate ? undefined : e => onChange(e.target.value)}
      onBlur={onActivate ? undefined : () => { setFocused(false); if (onBlur) onBlur(value); }}
      style={{
        border: `${borderWidth} solid ${borderColor}`,
        borderRadius: 7, padding: isActive ? '4px 3px' : '5px 4px',
        fontSize: 12, textAlign: 'center', fontFamily: 'inherit',
        width: '100%', boxSizing: 'border-box',
        color: hasVal ? G : '#ccc',
        fontWeight: hasVal ? 700 : 400,
        background: isActive ? GA : '#fff',
        cursor: onActivate ? 'pointer' : 'text',
      }}
    />
  );
}

// ─── CHField ───────────────────────────────────────────────────────────────────
export function CHField({ ch, isManual, onManualEntry, onActivate, fieldId, isActive }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState('');
  const hasVal = ch != null;
  const displayVal = hasVal
    ? `CH: ${ch < 0 ? '+' : ''}${Math.round(Math.abs(ch))}`
    : 'CH';

  const handleFocus = (e) => {
    if (!onActivate) { setEditing(true); setDraft(hasVal ? String(Math.round(Math.abs(ch))) : ''); return; }
    e.target.blur();
    const absVal = hasVal ? Math.abs(Math.round(ch)) : null;
    const isPlus = hasVal && ch < 0;
    const kpVal = absVal != null ? String(absVal) : '';
    onActivate(
      fieldId || 'ch', kpVal, isPlus, 'handicap-int',
      (newKpVal, newKpPlus) => {
        // Pass both digits and sign through to onManualEntry so PlayersCard
        // can store the signed CH value.
        if (newKpVal === '') { onManualEntry(null, false); return; }
        const n = parseInt(newKpVal);
        if (!isNaN(n) && n >= 0) onManualEntry(n, newKpPlus === true);
      },
      () => {},
    );
  };

  // Native edit mode (no onActivate)
  if (!onActivate && editing) {
    return (
      <input
        type="text" inputMode="numeric" autoFocus
        value={draft}
        placeholder="CH"
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          const v = parseInt(draft);
          if (!isNaN(v) && v >= 0) onManualEntry(v);
          setEditing(false); setDraft('');
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') e.target.blur();
          if (e.key === 'Escape') { setEditing(false); setDraft(''); }
        }}
        style={{ width:'100%', boxSizing:'border-box', border:`1px solid ${G}`, borderRadius:7,
                 padding:'5px 4px', fontSize:12, textAlign:'center', fontFamily:'inherit',
                 fontWeight:700, color:G }}
      />
    );
  }

  return (
    <input
      type="text"
      inputMode={onActivate ? 'none' : 'numeric'}
      readOnly={!!onActivate}
      value={displayVal}
      onFocus={handleFocus}
      onChange={undefined}
      style={{
        textAlign:'center', fontSize:12, fontWeight: hasVal ? 700 : 400,
        color: hasVal ? G : '#ccc',
        border: isActive
          ? `2px solid ${G}`
          : `1px solid ${isManual ? G : '#ddd'}`,
        borderRadius:7, padding: isActive ? '4px 3px' : '5px 4px',
        background: isActive ? GA : '#fff', boxSizing:'border-box',
        width:'100%', cursor: onActivate ? 'pointer' : 'text',
      }}
    />
  );
}
