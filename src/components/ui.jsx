// ─── ui.jsx ──────────────────────────────────────────────────────────────────
// Shared UI primitives. Import from here everywhere — single source of truth.

import { useState } from 'react';
import { strokesForMode, chp } from '../engine/handicap.js';

// ─── Design tokens ────────────────────────────────────────────────────────────
export const G    = '#1a472a';  // primary green
export const GA   = '#e8f5ec';  // green tint
export const GB   = '#f2faf4';  // green wash
export const RED  = '#c0392b';
export const AMB  = '#b7770d';
export const AMBBG = '#fff8e1';
export const PALE_YELLOW = '#fff9e6'; // reserved: swipe-menu Edit button bg; future cell highlight use

// ─── Atoms ───────────────────────────────────────────────────────────────────
export function Btn({ children, onClick, variant = 'primary', small, style = {}, disabled }) {
  const bg = disabled    ? '#ccc'
    : variant === 'primary' ? G
    : variant === 'danger'  ? RED
    : variant === 'outline' ? 'transparent'
    : variant === 'amber'   ? AMB
    : '#f0f0f0';
  const color  = variant === 'outline' ? G : variant === 'ghost' ? '#444' : '#fff';
  const border = variant === 'outline' ? `1.5px solid ${G}` : 'none';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: small ? '5px 11px' : '9px 18px',
        borderRadius: 8, border, color,
        fontWeight: 600, fontSize: small ? 12 : 14,
        fontFamily: 'inherit', transition: 'all .15s',
        background: bg, cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
        ...(disabled ? { background: '#ccc', cursor: 'not-allowed' } : {}),
      }}
    >
      {children}
    </button>
  );
}

export function Sel({ value, onChange, options, style = {} }) {
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      style={{ border:'1px solid #ddd', borderRadius:8, padding:'7px 9px', fontSize:13, fontFamily:'inherit', background:'#fff', ...style }}
    >
      {options.map(o => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
    </select>
  );
}

export function Inp({ value, onChange, placeholder, style = {}, type = 'text', onKeyDown, fRef }) {
  return (
    <input
      ref={fRef} type={type} value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder} onKeyDown={onKeyDown}
      style={{
        border:'1px solid #ddd', borderRadius:8, padding:'8px 11px',
        fontSize:14, fontFamily:'inherit', outline:'none',
        background:'#fff', color:'#222', width:'100%', boxSizing:'border-box', ...style,
      }}
    />
  );
}

export function Tog({ checked, onChange, label, small }) {
  return (
    <label style={{ display:'flex', alignItems:'center', gap:7, cursor:'pointer', userSelect:'none' }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: small?28:34, height: small?16:19, borderRadius:10,
          background: checked ? G : '#ccc', position:'relative', transition:'background .2s', flexShrink:0,
        }}
      >
        <div style={{
          position:'absolute', top:2,
          left: checked ? (small?14:17) : 2,
          width: small?12:15, height: small?12:15,
          borderRadius:'50%', background:'#fff', transition:'left .2s',
        }}/>
      </div>
      {label && <span style={{ fontSize: small?11:13, color:'#444' }}>{label}</span>}
    </label>
  );
}

export function Card({ children, style = {} }) {
  return (
    <div style={{
      background:'#fff', borderRadius:16, padding:18,
      marginBottom:14, boxShadow:'0 1px 5px rgba(0,0,0,.07)', ...style,
    }}>
      {children}
    </div>
  );
}

export function SH({ children }) {
  return <div style={{ fontWeight:700, fontSize:15, color:G, marginBottom:8 }}>{children}</div>;
}

export function BetInput({ value, onChange, style, placeholder = '$', onActivate, fieldId, isActive }) {
  const [focused, setFocused] = useState(false);

  const fmtCommitted = (v) => {
    if (v === 0) return '';
    return v % 1 === 0 ? `$${v}` : `$${v.toFixed(2)}`;
  };

  const handleFocus = (e) => {
    if (!onActivate) { setFocused(true); e.target.select(); return; }
    e.target.blur();
    const seed = value === 0 ? '' : String(value);
    onActivate(
      fieldId, seed, false, 'currency',
      (newKpVal) => {
        if (newKpVal === '') { onChange(0); return; }
        const n = parseFloat(newKpVal);
        onChange(isNaN(n) ? 0 : n);
      },
      () => {},
    );
  };

  const displayVal = onActivate
    ? fmtCommitted(value)
    : (focused ? (value === 0 ? '' : String(value)) : fmtCommitted(value));

  return (
    <input
      type="text"
      inputMode={onActivate ? 'none' : 'decimal'}
      readOnly={!!onActivate}
      value={displayVal}
      placeholder={placeholder}
      onFocus={handleFocus}
      onChange={onActivate ? undefined : e => {
        const v = e.target.value.replace(/^\$/, '');
        if (v === '' || v === '.') { onChange(0); return; }
        const n = parseFloat(v);
        if (!isNaN(n)) onChange(n);
      }}
      onBlur={onActivate ? undefined : e => {
        setFocused(false);
        const v = e.target.value.replace(/^\$/, '');
        const n = parseFloat(v);
        onChange(isNaN(n) ? 0 : n);
      }}
      style={{
        width: 60,
        border: isActive ? `2px solid ${G}` : '1px solid #ddd',
        borderRadius: 8, padding: isActive ? '6px 9px' : '7px 10px',
        fontSize: 13, fontFamily: 'inherit', textAlign: 'center',
        color: value === 0 ? '#a8d5b5' : G,
        fontWeight: 600,
        background: isActive ? '#e8f5ec' : '#fff',
        cursor: onActivate ? 'pointer' : 'text',
        ...style,
      }}
    />
  );
}

/** Green dots showing handicap strokes received */
export function PopDots({ ghin, hcpRank, minGhin, mode }) {
  const n = strokesForMode(chp(ghin), hcpRank, minGhin, mode || 'net');
  if (n <= 0) return null;
  return (
    <div style={{ position:'absolute', bottom:2, right:2, display:'flex', gap:1.5, pointerEvents:'none' }}>
      {Array.from({ length: n }).map((_, i) =>
        <div key={i} style={{ width:3, height:3, borderRadius:'50%', background:G }}/>
      )}
    </div>
  );
}

/** Formats a dollar amount as +$X.XX / -$X.XX / $0 */
export const fmtDollar = v =>
  v > 0 ? `+$${Math.abs(v).toFixed(2)}`
: v < 0 ? `-$${Math.abs(v).toFixed(2)}`
:         '$0';

/** Format YYYY-MM-DD without timezone shift */
export function fmtDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) return `${parseInt(parts[1])}/${parseInt(parts[2])}/${parts[0]}`;
  return dateStr;
}

/**
 * ShareOrientationPicker — bottom-sheet modal asking Portrait vs Landscape.
 * Props:
 *   onPick(orientation)  — called with 'portrait' or 'landscape'
 *   onDismiss()          — called when backdrop tapped
 */
export function ShareOrientationPicker({ onPick, onDismiss }) {
  const btnStyle = {
    flex: 1, padding: '14px 8px', borderRadius: 12,
    border: `2px solid ${G}`, background: '#f5fbf5',
    cursor: 'pointer', fontFamily: 'inherit',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
  };
  return (
    <div
      onClick={onDismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: '18px 18px 0 0',
          padding: '20px 20px 32px', width: '100%', maxWidth: 520,
          boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 15, color: G, marginBottom: 4 }}>
          Share Round Summary
        </div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 18 }}>
          Choose image orientation
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button style={btnStyle} onClick={() => onPick('portrait')}>
            <svg width="28" height="36" viewBox="0 0 28 36" fill="none">
              <rect x="2" y="2" width="24" height="32" rx="3" stroke={G} strokeWidth="2.5"/>
              <line x1="6" y1="10" x2="22" y2="10" stroke={G} strokeWidth="1.5"/>
              <line x1="6" y1="15" x2="22" y2="15" stroke={G} strokeWidth="1.5"/>
              <line x1="6" y1="20" x2="16" y2="20" stroke={G} strokeWidth="1.5"/>
            </svg>
            <span style={{ fontSize: 13, fontWeight: 700, color: G }}>Portrait</span>
            <span style={{ fontSize: 10, color: '#888' }}>Phone-friendly</span>
          </button>
          <button style={btnStyle} onClick={() => onPick('landscape')}>
            <svg width="36" height="28" viewBox="0 0 36 28" fill="none">
              <rect x="2" y="2" width="32" height="24" rx="3" stroke={G} strokeWidth="2.5"/>
              <line x1="6" y1="9" x2="30" y2="9" stroke={G} strokeWidth="1.5"/>
              <line x1="6" y1="14" x2="30" y2="14" stroke={G} strokeWidth="1.5"/>
              <line x1="6" y1="19" x2="20" y2="19" stroke={G} strokeWidth="1.5"/>
            </svg>
            <span style={{ fontSize: 13, fontWeight: 700, color: G }}>Landscape</span>
            <span style={{ fontSize: 10, color: '#888' }}>Full scorecard</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// Global styles string — inject once in the App root
export const GLOBAL_CSS = `
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  input[type="number"]::-webkit-inner-spin-button,
  input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; }
  body { touch-action: pan-y; overscroll-behavior: none; }
  table { table-layout: fixed; }
`;
