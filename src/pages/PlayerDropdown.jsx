// ─── PlayerDropdown.jsx ───────────────────────────────────────────────────────
// Shared styled dropdown component for player selection.
// Trigger bubble matches PlayerSubsetChips style (green border/tint when selected).
// Opens a full-width app-styled panel with a 2-per-row grid of name bubbles.
// Used by: MatchCard.jsx, GameConfig.jsx
//
// Props:
//   players     — full players array
//   value       — currently selected global player index (null = none)
//   onChange    — (globalIndex | null) → void
//   label       — placeholder text when nothing selected ("Player 1", etc.)
//   excludeIdxs — global indices to hide from the open panel
//   panelLabel  — override header text inside panel (defaults to label)
//   footerSlot  — optional render prop (close: () => void) => ReactNode
//                 rendered below the player grid; caller receives close() to
//                 dismiss the panel (e.g. after a Randomize action)

import { useState, useEffect, useRef } from 'react';
import { G, GA } from '../components/ui.jsx';

// Split a full name string into { first, last } — last is '' if single-word name.
function splitName(p) {
  const parts = (p?.name || '').trim().split(/\s+/);
  return { first: parts[0] || '?', last: parts.length >= 2 ? parts[parts.length - 1] : '' };
}

// Two-line name block used in trigger bubble and panel cells.
// firstColor / lastColor let callers theme the two lines independently.
function NameBlock({ p, firstSize = 12, firstWeight = 700, firstColor, lastColor, lastOpacity }) {
  const { first, last } = splitName(p);
  return (
    <>
      <div style={{ fontSize:firstSize, fontWeight:firstWeight, color:firstColor, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', lineHeight:1.2 }}>{first}</div>
      {last && <div style={{ fontSize:10, fontWeight:400, color:lastColor, opacity:lastOpacity, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', lineHeight:1.2 }}>{last}</div>}
    </>
  );
}

export function PlayerDropdown({ players, value, onChange, label, excludeIdxs = [], panelLabel, firstNameOnly = false, footerSlot }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  const eligible = players.map((p, i) => ({ p, i })).filter(({ i }) => !excludeIdxs.includes(i));
  const selectedP = value != null ? players[value] : null;
  const displayName = selectedP ? splitName(selectedP).first : null;

  return (
    <div ref={ref} style={{ position:'relative' }}>
      {/* Trigger bubble */}
      <div onClick={() => setOpen(o => !o)}
        style={{ borderRadius:8, padding:'7px 10px',
                 border:`1.5px solid ${value != null ? G : '#ddd'}`,
                 background:value != null ? GA : '#fff',
                 cursor:'pointer', minWidth:0,
                 display:'flex', alignItems:'center', justifyContent:'space-between', gap:4 }}>
        {selectedP != null ? (
          firstNameOnly ? (
            <span style={{ fontSize:13, fontWeight:700, color:G, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{displayName}</span>
          ) : (
            <div style={{ minWidth:0, flex:1 }}>
              <NameBlock p={selectedP} firstColor={G} lastColor={G} lastOpacity={0.6}/>
            </div>
          )
        ) : (
          <span style={{ fontSize:13, color:'#aaa', flex:1 }}>{label}</span>
        )}
        <span style={{ fontSize:9, color:value != null ? G : '#bbb', flexShrink:0, lineHeight:1 }}>{open ? '▲' : '▼'}</span>
      </div>

      {/* Dropdown panel */}
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:50,
                      background:'#fff', border:`1.5px solid ${G}`, borderRadius:12,
                      padding:'10px 10px 8px', boxShadow:'0 4px 16px rgba(0,0,0,0.13)' }}>
          <div style={{ fontSize:10, fontWeight:700, color:G, marginBottom:7,
                        textTransform:'uppercase', letterSpacing:'0.06em' }}>
            {panelLabel || `Selecting ${label}`}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:5 }}>
            {eligible.map(({ p, i }) => {
              const sel = value === i;
              return (
                <div key={i}
                  onClick={() => { onChange(sel ? null : i); setOpen(false); }}
                  style={{ borderRadius:10, padding:'6px 9px',
                           border:`1.5px solid ${sel ? G : '#ddd'}`,
                           background:sel ? GA : '#f9fdf9',
                           cursor:'pointer', minWidth:0 }}>
                  <NameBlock p={p} firstColor={sel ? G : '#333'} lastColor={sel ? G : '#aaa'}/>
                </div>
              );
            })}
          </div>
          {footerSlot && (
            <div style={{ marginTop:7 }}>
              {footerSlot(() => setOpen(false))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── StyledSel ──────────────────────────────────────────────────────────────────
// Styled dropdown matching the app's bubble/card aesthetic.
// Drop-in replacement for the native Sel component in setup forms.
// Props: value, onChange, options [{value, label, disabled?}], placeholder, width (px, default 120)
//
// Option shape:
//   { value: any, label: string, disabled?: boolean }
// When disabled === true, the option renders at 40% opacity with cursor:not-allowed
// and cannot be selected (no onClick handler wired, no panel close).
export function StyledSel({ value, onChange, options, placeholder, width = 120, leftAlign = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    document.addEventListener('touchstart', h);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h); };
  }, [open]);

  const selected = options.find(o => o.value === value);
  const w = typeof width === 'number' ? width : width; // pass-through; CSS handles both '100%' and 120

  return (
    <div ref={ref} style={{ position:'relative', width:w }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ borderRadius:8, padding:'7px 10px',
                 border:`1.5px solid ${selected ? G : '#ddd'}`,
                 background:selected ? GA : '#fff',
                 cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', gap:4,
                 width:'100%', boxSizing:'border-box' }}>
        <span style={{ fontSize:13, fontWeight:selected?700:400, color:selected?G:'#aaa', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, textAlign: leftAlign ? 'left' : 'center' }}>
          {selected ? selected.label : (placeholder || 'Select…')}
        </span>
        <span style={{ fontSize:9, color:selected?G:'#bbb', flexShrink:0 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', right:0, zIndex:50,
                      background:'#fff', border:`1.5px solid ${G}`, borderRadius:12,
                      padding:'6px', boxShadow:'0 4px 16px rgba(0,0,0,0.13)',
                      minWidth: typeof width === 'number' ? width : 120, whiteSpace:'nowrap' }}>
          {options.map(o => {
            const sel = o.value === value;
            const dis = o.disabled === true;
            return (
              <div key={String(o.value)}
                onClick={dis ? undefined : () => { onChange(o.value); setOpen(false); }}
                style={{ borderRadius:8, padding:'7px 10px', marginBottom:3,
                         border:`1.5px solid ${sel && !dis ? G : 'transparent'}`,
                         background:sel && !dis ? GA : 'transparent',
                         cursor: dis ? 'not-allowed' : 'pointer',
                         fontSize:12, fontWeight:sel && !dis ? 700 : 400,
                         color: dis ? '#999' : (sel ? G : '#333'),
                         opacity: dis ? 0.4 : 1,
                         textAlign:'center' }}>
                {o.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
// Non-interactive name bubble for auto-assigned slots (e.g. Team B).
export function ReadOnlyBubble({ p, firstNameOnly = false }) {
  if (!p) {
    return (
      <div style={{ borderRadius:8, padding:'7px 10px', border:'1.5px solid #eee',
                    background:'#fafafa', minWidth:0, textAlign:'center' }}>
        <span style={{ fontSize:13, color:'#ccc' }}>—</span>
      </div>
    );
  }
  return (
    <div style={{ borderRadius:8, padding:'7px 10px', border:'1.5px solid #ddd',
                  background:'#f5f5f5', minWidth:0 }}>
      {firstNameOnly
        ? <span style={{ fontSize:13, fontWeight:700, color:'#888', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block' }}>{splitName(p).first}</span>
        : <NameBlock p={p} firstSize={13} firstColor='#888' lastColor='#bbb'/>
      }
    </div>
  );
}
