// ─── scorecard/PressModal.jsx ─────────────────────────────────────────────────
// Press interaction UI — PressModal, SinglePressChip, SegmentChipColumns.
// RENDER ONLY — no business logic in this file.
// No scoring calculations. No match state computation.
// All logic must come from engine/ or scorecardUtils.js

import { useRef, useState } from 'react';
import { G } from '../../components/ui.jsx';

export function PressModal({ title, status, winnerName, validHoles, existingPressHole, minHole, onConfirm, onRemove, onClose }) {
  const [selectedHole, setSelectedHole] = useState(existingPressHole ?? null);

  const isExistingSelected = selectedHole !== null && selectedHole === existingPressHole;
  const isNewSelected      = selectedHole !== null && selectedHole !== existingPressHole;
  const hasSelection       = selectedHole !== null;

  const selectableHoles = validHoles.slice(0, -1).filter(h => h >= (minHole ?? 0));

  const handleTap = (h) => {
    setSelectedHole(prev => prev === h ? null : h);
  };

  const handleAction = () => {
    if (!hasSelection) { onClose(); return; }
    if (isExistingSelected) onRemove(selectedHole);
    else                    onConfirm(selectedHole);
  };

  const btnDisabled = !hasSelection;
  const btnBg       = isExistingSelected ? '#c0392b' : hasSelection ? G : '#ccc';
  const btnText     = isExistingSelected
    ? `Remove Press after H${selectedHole + 1}`
    : isNewSelected
      ? existingPressHole != null
        ? `Move Press to after H${selectedHole + 1}`
        : `Add Press after H${selectedHole + 1}`
      : 'Select a hole above';

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:400, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
      onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:'20px 20px 0 0', padding:'20px 18px 28px', width:'100%', maxWidth:520 }}
        onClick={e => e.stopPropagation()}>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
          <div>
            <div style={{ fontWeight:800, fontSize:16, color:G }}>{title}</div>
            <div style={{ fontSize:12, color:'#666', marginTop:1 }}>{winnerName} · {status}</div>
          </div>
          <button onClick={onClose} style={{ border:'none', background:'none', fontSize:20, color:'#aaa', cursor:'pointer', padding:'0 4px' }}>✕</button>
        </div>

        <div style={{ fontSize:11, color:'#888', marginBottom:12 }}>
          {existingPressHole != null
            ? `Press is active after H${existingPressHole + 1}. Tap it to remove, or tap another hole to move it.`
            : 'Tap a hole to set where the press starts. Tap again to deselect.'}
        </div>

        <div style={{ marginBottom: isExistingSelected ? 10 : 18 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#555', marginBottom:8 }}>Press starts after hole:</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {selectableHoles.map(h => {
              const isExisting = h === existingPressHole;
              const isSel      = h === selectedHole;
              let border, bg, color;
              if (isSel && isExisting) {
                border = '2.5px solid #c0392b'; bg = '#fdeaea'; color = '#c0392b';
              } else if (isSel) {
                border = `2.5px solid ${G}`;    bg = G;          color = '#fff';
              } else if (isExisting) {
                border = '2px solid #e07020';   bg = '#fff5ec';  color = '#c05000';
              } else {
                border = '2px solid #e0e0e0';   bg = '#fafafa';  color = '#555';
              }
              return (
                <button key={h} onClick={() => handleTap(h)}
                  style={{ width:38, height:38, borderRadius:9, border, background:bg, color,
                    fontWeight: (isSel || isExisting) ? 800 : 600, fontSize:13,
                    cursor:'pointer', fontFamily:'inherit', position:'relative' }}>
                  {h + 1}
                  {isExisting && !isSel && (
                    <span style={{ position:'absolute', top:2, right:3, fontSize:8, color:'#e07020' }}>●</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {isExistingSelected && (
          <div style={{ marginBottom:14, fontSize:11, color:'#c0392b', background:'#fdecea', borderRadius:8, padding:'7px 10px' }}>
            ⚠️ Removing this press will also delete any child presses that follow.
          </div>
        )}

        <div style={{ display:'flex', gap:8 }}>
          <button onClick={onClose}
            style={{ flex:1, padding:'12px', borderRadius:12, border:'1.5px solid #ddd', background:'#fff',
              fontSize:14, fontWeight:600, color:'#666', cursor:'pointer', fontFamily:'inherit' }}>
            Cancel
          </button>
          <button onClick={handleAction} disabled={btnDisabled}
            style={{ flex:2, padding:'12px', borderRadius:12, border:'none', background:btnBg,
              color:'#fff', fontSize:14, fontWeight:700,
              cursor: btnDisabled ? 'default' : 'pointer',
              opacity: btnDisabled ? 0.45 : 1, fontFamily:'inherit' }}>
            {btnText}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SinglePressChip({ chip, chipKey, timerRef }) {
  const startHold = () => {
    if (!chip.pressable) return;
    timerRef.current[chipKey] = setTimeout(() => {
      chip.onLongPress?.();
      timerRef.current[chipKey] = null;
    }, 500);
  };
  const cancelHold = () => {
    if (timerRef.current[chipKey]) {
      clearTimeout(timerRef.current[chipKey]);
      timerRef.current[chipKey] = null;
    }
  };

  return (
    <div
      onPointerDown={startHold}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      onPointerCancel={cancelHold}
      style={{
        textAlign:'center', borderRadius:8, padding:'6px 4px 5px',
        background:chip.bg, userSelect:'none', WebkitUserSelect:'none',
        cursor: chip.pressable ? 'pointer' : 'default',
        position:'relative',
        boxShadow: chip.pressable ? '0 0 0 1.5px rgba(0,0,0,.08)' : 'none',
        minWidth: 0,
        overflow: 'hidden',
      }}>
      <div style={{ fontSize:10, fontWeight:600, color:chip.labelColor, marginBottom:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{chip.label}</div>
      <div style={{ fontSize:11, fontWeight:600, color:chip.color, lineHeight:1.2, marginBottom:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
        {chip.winnerName || '—'}
      </div>
      <div style={{ fontSize:15, fontWeight:700, color:chip.color }}>{chip.value}</div>
      {chip.pressable && (
        <div style={{ fontSize:8, color:'#bbb', marginTop:1, letterSpacing:0.5 }}>
          {chip.hasChildPress ? 'hold to manage' : 'hold to press'}
        </div>
      )}
    </div>
  );
}

export function SegmentChipColumns({ segments }) {
  const timerRef = useRef({});
  const n = segments.length;
  return (
    <div style={{ display:'grid', gridTemplateColumns:`repeat(${n}, 1fr)`, gap:6, padding:'6px 8px 8px', alignItems:'start' }}>
      {segments.map((seg, si) => (
        <div key={si} style={{ display:'flex', flexDirection:'column', gap:4, minWidth:0 }}>
          <SinglePressChip chip={seg.mainChip} chipKey={`${si}_main`} timerRef={timerRef}/>
          {seg.pressChips.map((pc, pi) => (
            <div key={pi} style={{ display:'flex', flexDirection:'column', gap:3 }}>
              <div style={{ height:1, background:'#e0e0e0', marginLeft:4, marginRight:4 }}/>
              <SinglePressChip chip={pc} chipKey={`${si}_press_${pi}`} timerRef={timerRef}/>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
