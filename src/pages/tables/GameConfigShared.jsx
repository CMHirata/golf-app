// ─── GameConfigShared.jsx ─────────────────────────────────────────────────────
// Shared UI sub-components consumed by game-panel files (GameConfigSkins.jsx,
// GameConfigSixes.jsx, etc.) and re-exported from GameConfig.jsx for callers
// outside the tables/ directory (NewRoundPage, MatchCard).
//
// Extracted to break the circular-import that would result from panel files
// importing named exports from the GameConfig.jsx dispatcher (which in turn
// imports those same panel files). This file has no imports from GameConfig.jsx.
//
// Contents:
//   PRESS_OPTS           — shared press-dropdown option list
//   validateGameRange    — per-game structural validation helper
//   GameRangePill        — bottom-of-tile pill showing effective hole range
//   GameRangePopup       — bottom-sheet popup for editing per-game range
//   BetSection           — universal bet layout
//   PlayerSubsetDropdown — inline dropdown subset picker with C-2 chip closed state
//
// Architecture: UI layer (ARCHITECTURE_FOUNDATIONS.md §2). No engine calls.
//
// ✅ Self-checked (13-E): All component bodies copied verbatim from pre-13-E
//   GameConfig.jsx. Import list trimmed to only what these components need
//   (useState, useRef, useEffect; BetInput, G, GA, RED; StyledSel).

import { useState, useRef, useEffect } from 'react';
import { BetInput, G, GA, RED } from '../../components/ui.jsx';
import { StyledSel } from '../PlayerDropdown.jsx';

// ─── Press options ─────────────────────────────────────────────────────────────
export const PRESS_OPTS = [
  { value:'none', label:'Press' },
  { value:'1',    label:'1 Down' },
  { value:'2',    label:'2 Down' },
  { value:'3',    label:'3 Down' },
  { value:'4',    label:'4 Down' },
  { value:'5',    label:'5 Down' },
];

// ─── validateGameRange ────────────────────────────────────────────────────────
export function validateGameRange(gameKey, start, end, roundStart, roundEnd) {
  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    return { valid: false, error: 'Invalid hole numbers' };
  }
  if (start < roundStart || end > roundEnd) {
    return { valid: false, error: `Must be within holes ${roundStart + 1}–${roundEnd + 1}` };
  }
  if (start >= end) {
    return { valid: false, error: 'Start must come before end' };
  }
  const len = end - start + 1;
  if (gameKey === 'Nines') {
    if (len < 6) return { valid: false, error: 'Nines needs at least 6 holes' };
    return { valid: true, error: '' };
  }
  if (gameKey === 'Sixes') {
    if (len < 9) return { valid: false, error: 'Sixes needs at least 9 holes' };
    if (len % 3 !== 0) return { valid: false, error: 'Sixes range must be divisible by 3' };
    return { valid: true, error: '' };
  }
  if (len < 3) return { valid: false, error: 'At least 3 holes required' };
  return { valid: true, error: '' };
}

// ─── GameRangePill ────────────────────────────────────────────────────────────
export function GameRangePill({ startHole, endHole, isCustom, onOpen, disabled = false, lockedNote = '' }) {
  const label = `Holes ${startHole + 1}–${endHole + 1}`;
  const bg    = disabled ? '#f4f4f4' : isCustom ? GA : '#fafafa';
  const clr   = disabled ? '#bbb'    : isCustom ? G  : '#888';
  const bdr   = disabled ? '#eee'    : isCustom ? G  : '#ddd';
  const weight = isCustom ? 700 : 500;
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', marginTop:10 }}>
      <div
        onClick={disabled ? undefined : onOpen}
        style={{
          display:'inline-flex', alignItems:'center', gap:4,
          padding:'4px 10px', borderRadius:14,
          border:`1px solid ${bdr}`, background:bg,
          fontSize:11, fontWeight:weight, color:clr,
          cursor: disabled ? 'default' : 'pointer',
          fontFamily:'inherit',
          userSelect:'none',
        }}>
        <span>{label}</span>
        {!disabled && <span style={{ fontSize:9, opacity:0.6, marginLeft:2 }}>✎</span>}
      </div>
      {disabled && lockedNote && (
        <div style={{ fontSize:10, color:'#aaa', marginTop:3, fontStyle:'italic' }}>{lockedNote}</div>
      )}
    </div>
  );
}

// ─── GameRangePopup ───────────────────────────────────────────────────────────
// B-13: onActivate (optional) — when provided, Start/End hole inputs use the
// custom keypad (mode='integer', maxDigits implied by 1-18 range) instead of
// the native iOS keyboard. ScoreKeypad_Contract §6.4, §10.
export function GameRangePopup({
  gameKey, gameLabel,
  initialStart, initialEnd,
  roundStart, roundEnd,
  isCustom,
  onCommit, onResetToRound, onClose,
  onActivate,
  activeFieldId,
}) {
  const [startStr, setStartStr] = useState(String(initialStart + 1));
  const [endStr,   setEndStr]   = useState(String(initialEnd + 1));

  const startN = parseInt(startStr);
  const endN   = parseInt(endStr);
  const startOk = Number.isInteger(startN) && startN >= 1 && startN <= 18;
  const endOk   = Number.isInteger(endN)   && endN   >= 1 && endN   <= 18;

  let validationError = '';
  if (!startOk || !endOk) {
    validationError = 'Enter valid hole numbers';
  } else {
    const v = validateGameRange(gameKey, startN - 1, endN - 1, roundStart, roundEnd);
    if (!v.valid) validationError = v.error;
  }
  const canCommit = validationError === '';

  const commit = () => { if (!canCommit) return; onCommit(startN - 1, endN - 1); };

  const wrap = { display:'flex', alignItems:'center', justifyContent:'center', width:'100%' };

  const tapTargetStyle = (ok) => ({
    width:64, textAlign:'center', fontSize:16, fontWeight:700,
    padding:'8px 4px', border:`1.5px solid ${ok ? '#ccc' : RED}`, borderRadius:8,
    fontFamily:'inherit', color: ok ? G : RED, background:'#fff',
    boxSizing:'border-box', cursor:'pointer',
    userSelect:'none', WebkitUserSelect:'none',
    WebkitTapHighlightColor:'transparent',
    display:'flex', alignItems:'center', justifyContent:'center', minHeight:40,
  });

  const inputStyle = (ok) => ({
    width:64, textAlign:'center', fontSize:16, fontWeight:700,
    padding:'8px 4px', border:`1.5px solid ${ok ? '#ccc' : RED}`, borderRadius:8,
    fontFamily:'inherit', color: ok ? G : RED, background:'#fff',
    boxSizing:'border-box',
  });

  // Build a hole-number tap target (keypad) or native input (fallback)
  const holeField = (fieldId, val, setVal, ok, initialFallback) => {
    const isActive = activeFieldId === fieldId;
    if (onActivate) {
      return (
        <input
          type="text"
          inputMode="none"
          readOnly
          value={val}
          onFocus={(e) => {
            e.target.blur();
            onActivate(fieldId, val, false, 'integer',
              (newKpVal) => setVal(newKpVal.slice(0, 2)),
              () => {},
              true,
            );
          }}
          style={{
            width:64, textAlign:'center', fontSize:16, fontWeight:700,
            padding:'8px 4px',
            border: isActive ? `2px solid ${G}` : `1.5px solid ${ok ? '#ccc' : RED}`,
            borderRadius:8,
            fontFamily:'inherit', color: ok ? G : RED,
            background: isActive ? GA : '#fff',
            boxSizing:'border-box', cursor:'pointer',
          }}
        />
      );
    }
    return (
      <input type="text" inputMode="numeric" value={val}
        onFocus={e => { e.target.select(); setVal(''); }}
        onChange={e => setVal(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
        onBlur={() => { if (!val) setVal(String(initialFallback + 1)); }}
        style={inputStyle(ok)}/>
    );
  };

  // B-34/35: When the keypad is active for one of this popup's hole fields,
  // lift the bottom-sheet card above the keypad (~250px tall) so both are visible.
  // No transition — animations cause click-target race conditions on iOS where
  // the user's finger ends up over a different element by the time `click` fires.
  const keypadActive = activeFieldId === 'range_start' || activeFieldId === 'range_end';

  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:400,
               display:'flex', alignItems:'flex-end', justifyContent:'center' }}
      onClick={keypadActive ? undefined : onClose}>
      <div
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
        style={{ background:'#fff', width:'100%', maxWidth:520,
                 padding:'20px 20px 24px', boxSizing:'border-box',
                 marginBottom: keypadActive ? '260px' : 0,
                 boxShadow: keypadActive ? '0 4px 24px rgba(0,0,0,.25)' : 'none',
                 borderRadius: keypadActive ? 14 : '20px 20px 0 0',
        }}>
        <div style={{ fontWeight:800, fontSize:16, color:G, marginBottom:4 }}>
          {gameLabel} — Hole Range
        </div>
        <div style={{ fontSize:11, color:'#888', marginBottom:14 }}>
          Must be within round holes {roundStart + 1}–{roundEnd + 1}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:10 }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'#666', marginBottom:4, textAlign:'center' }}>Start hole</div>
            <div style={wrap}>
              {holeField('range_start', startStr, setStartStr, startOk, initialStart)}
            </div>
          </div>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'#666', marginBottom:4, textAlign:'center' }}>End hole</div>
            <div style={wrap}>
              {holeField('range_end', endStr, setEndStr, endOk, initialEnd)}
            </div>
          </div>
        </div>
        {validationError && (
          <div style={{ fontSize:11, color:RED, marginBottom:10, textAlign:'center', fontWeight:600 }}>
            {validationError}
          </div>
        )}
        <div style={{ display:'flex', gap:8, marginTop:6 }}>
          {isCustom && (
            <button onClick={onResetToRound}
              style={{ flex:1, padding:'10px 12px', borderRadius:10,
                       border:'1.5px solid #ccc', background:'#fff',
                       fontSize:12, fontWeight:600, color:'#666',
                       cursor:'pointer', fontFamily:'inherit' }}>
              Reset to round
            </button>
          )}
          <button onClick={commit} disabled={!canCommit}
            style={{ flex:1, padding:'10px 12px', borderRadius:10, border:'none',
                     background: canCommit ? G : '#ccc',
                     fontSize:13, fontWeight:700, color:'#fff',
                     cursor: canCommit ? 'pointer' : 'not-allowed',
                     fontFamily:'inherit' }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── BetSection ───────────────────────────────────────────────────────────────
// onActivate (optional): passed from page-level keypad owner → BetInput fields.
//   When present, BetInput uses custom keypad instead of native iOS keyboard.
//   UI_Component_Contract §4.10 — carry-forward rule satisfied by MatchCard §16.4.
export function BetSection({
  modes = [], mode, onModeChange,
  values = {}, onValueChange,
  pressable = false, pressValues = {}, onPressChange,
  extraField = null,
  onActivate,
  betSectionId = '',
  activeFieldId,
}) {
  const isFBT = mode === 'nassau' || mode === 'segments';
  const hasModes = modes && modes.length > 0;
  const fid = (field) => betSectionId ? `${betSectionId}_${field}` : field;
  const isActive = (field) => activeFieldId === fid(field);

  const labelRow = (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr',
                  alignItems:'center', width:'100%', marginBottom:6, gap:8 }}>
      <span style={{ fontSize:13, fontWeight:700, color:G }}>Bet</span>
      {hasModes ? <StyledSel value={mode} onChange={onModeChange} options={modes} width="100%"/> : <div/>}
    </div>
  );

  if (isFBT) {
    const labelStyle = { fontSize:11, fontWeight:600, color:'#666', textAlign:'center' };
    const fieldStyle = { width:'100%', boxSizing:'border-box', textAlign:'center' };
    return (
      <div style={{ width:'100%', boxSizing:'border-box', minWidth:0 }}>
        {labelRow}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:4 }}>
          <div style={labelStyle}>Front</div>
          <div style={labelStyle}>Back</div>
          <div style={labelStyle}>Total</div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
          <BetInput value={values.front ?? 0} onChange={v => onValueChange('front', v)} placeholder="$" style={fieldStyle}
            onActivate={onActivate} fieldId={fid('front')} isActive={isActive('front')}/>
          <BetInput value={values.back  ?? 0} onChange={v => onValueChange('back',  v)} placeholder="$" style={fieldStyle}
            onActivate={onActivate} fieldId={fid('back')} isActive={isActive('back')}/>
          <BetInput value={values.total ?? 0} onChange={v => onValueChange('total', v)} placeholder="$" style={fieldStyle}
            onActivate={onActivate} fieldId={fid('total')} isActive={isActive('total')}/>
        </div>
        {pressable && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginTop:6 }}>
            <StyledSel value={pressValues.front || 'none'} onChange={v => onPressChange('front', v)} options={PRESS_OPTS} width="100%"/>
            <StyledSel value={pressValues.back  || 'none'} onChange={v => onPressChange('back',  v)} options={PRESS_OPTS} width="100%"/>
            <StyledSel value={pressValues.total || 'none'} onChange={v => onPressChange('total', v)} options={PRESS_OPTS} width="100%"/>
          </div>
        )}
      </div>
    );
  }

  const fieldStyle = { width:'100%', boxSizing:'border-box', textAlign:'center' };
  const bet = <BetInput value={values.single ?? 0} onChange={v => onValueChange('single', v)} style={fieldStyle}
    onActivate={onActivate} fieldId={fid('single')} isActive={isActive('single')}/>;

  let fieldRow;
  if (pressable) {
    fieldRow = (
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        {bet}
        <StyledSel value={pressValues.single || 'none'} onChange={v => onPressChange('single', v)} options={PRESS_OPTS} width="100%"/>
      </div>
    );
  } else if (extraField) {
    fieldRow = (
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        {bet}
        <div style={{ minWidth:0 }}>{extraField}</div>
      </div>
    );
  } else {
    fieldRow = <div style={{ width:'100%' }}>{bet}</div>;
  }

  return (
    <div style={{ width:'100%', boxSizing:'border-box', minWidth:0 }}>
      {labelRow}
      {fieldRow}
    </div>
  );
}

// ─── PlayerSubsetDropdown ─────────────────────────────────────────────────────
export function PlayerSubsetDropdown({ players, selectedIdxs, onChange, required = null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    document.addEventListener('touchstart', h);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h); };
  }, [open]);

  const allIn = selectedIdxs.length === 0;
  const isValid = required === null || selectedIdxs.length === required || (required > 0 && players.length <= required);
  const borderColor = required !== null && !isValid ? RED : '#c8e0c8';
  const borderWidth = required !== null && !isValid ? '1.5px' : '1px';
  const bg = required !== null && !isValid ? '#fff5f5' : '#fff';

  const chipData = allIn ? [] : selectedIdxs.map(i => {
    const p = players[i];
    const first = (p?.name || '').trim().split(/\s+/)[0] || '?';
    return { i, first };
  });

  return (
    <div ref={ref} style={{ position:'relative', marginBottom:7 }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                 border:`${borderWidth} solid ${borderColor}`,
                 background: bg,
                 borderRadius:8, padding:'7px 10px', cursor:'pointer',
                 minWidth:0, width:'100%', boxSizing:'border-box' }}>
        <div style={{ display:'flex', alignItems:'center', gap:4, flex:1, minWidth:0, overflow:'hidden', whiteSpace:'nowrap' }}>
          {allIn ? (
            <span style={{ fontSize:12, fontWeight:500, color: (required !== null && !isValid) ? RED : G }}>
              All Players
            </span>
          ) : (
            chipData.map(({ i, first }) => (
              <span key={i}
                style={{ display:'inline-block', fontSize:11, fontWeight:700, color:G,
                         background:GA, border:'1px solid #c8e0c8', borderRadius:10,
                         padding:'3px 8px', flexShrink:0 }}>
                {first}
              </span>
            ))
          )}
        </div>
        <span style={{ fontSize:9, color:'#aaa', flexShrink:0, marginLeft:4 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:50,
                      background:'#fff', border:`1.5px solid ${G}`, borderRadius:12,
                      padding:'10px', boxShadow:'0 4px 16px rgba(0,0,0,.13)' }}>
          {required && (
            <div style={{ fontSize:11, color:'#666', fontWeight:600, marginBottom:8 }}>
              Select {required} players
              {selectedIdxs.length > 0 && (
                <span style={{ color: isValid ? G : RED, marginLeft:6 }}>
                  ({selectedIdxs.length} of {required})
                </span>
              )}
            </div>
          )}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
            {players.map((p, i) => {
              const on = allIn || selectedIdxs.includes(i);
              const toggle = () => {
                if (allIn) { onChange(players.map((_, j) => j).filter(j => j !== i)); return; }
                const next = on ? selectedIdxs.filter(x => x !== i) : [...selectedIdxs, i];
                onChange(next.length === players.length ? [] : next);
              };
              const parts = (p?.name || '').trim().split(/\s+/);
              const first = parts[0] || '?';
              const last  = parts.length >= 2 ? parts.slice(1).join(' ') : '';
              return (
                <div key={i} onClick={toggle}
                  style={{ border:`1.5px solid ${on?G:'#ddd'}`, background:on?GA:'#fff',
                           borderRadius:10, padding:'6px 10px', cursor:'pointer', minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:on?G:'#aaa', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{first}</div>
                  {last && <div style={{ fontSize:11, color:on?G:'#bbb', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{last}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
