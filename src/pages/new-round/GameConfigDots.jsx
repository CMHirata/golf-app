// ─── GameConfigDots.jsx ───────────────────────────────────────────────────────
// Dots (Specials/Junk) game configuration panel.
// Extracted from GameConfig.jsx (13-E). Zero logic changes — verbatim body.
//
// MODULE BOUNDARY
//   Receives all props from the GameConfig dispatcher. Owns local state for:
//   - rangeOpen (GameRangePopup open/close)
//   - editingId / editName / editValue (DotRow inline edit)
//   Calls no engine functions except ls.get/ls.set (storage) for deleteCustom.
//   Shared named exports (GameTile, BetSection, etc.) remain in GameConfig.jsx.
//
// ARCHITECTURE (ARCHITECTURE_FOUNDATIONS.md §2)
//   UI layer only. No engine calls. No state promotion. Props pass through
//   unchanged from dispatcher → panel.
//
// PRIVATE COMPONENTS (not exported — used only within this file)
//   CustomDotAdder — input row to add a new custom dot definition
//   DotRow         — swipeable row for toggling/editing/deleting a dot
//
// DOTS RANGE LOCKING (D-3A)
//   When Dots is in team mode (currentTeamMode !== 'none'), the range pill is
//   disabled and locked to the team source's range (Sixes or Match:<id>).
//   The popup does not open. This mirrors the original renderRangePill() logic
//   for the Dots game exactly.
//
// ✅ Self-checked (13-E): All props verified. deleteCustom storage path (ls.get/
//   ls.set activeRound.dotEntries) preserved verbatim. DotRow swipe logic
//   unchanged. Team-mode range-lock path (currentTeamMode, gameRanges?.['Sixes'],
//   gameRanges?.[mid]) preserved exactly. BetSection dotsMode wiring unchanged.

import { useState, useRef } from 'react';
import { ls, SK } from '../../services/storage.js';
import { Btn, Tog } from '../../components/ui.jsx';
import { StyledSel } from '../PlayerDropdown.jsx';
import {
  BetSection, PlayerSubsetDropdown, PayStylePill,
  GameRangePill, GameRangePopup,
} from './GameConfigShared.jsx';

// ─── CustomDotAdder ────────────────────────────────────────────────────────────
function CustomDotAdder({ onAdd }) {
  const [name,  setName]  = useState('');
  const [value, setValue] = useState(1);
  const [multi, setMulti] = useState(true);
  return (
    <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:6 }}>
      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Custom dot…"
          style={{ flex:1, fontSize:12, padding:'5px 9px', border:'1px solid #ddd', borderRadius:7, fontFamily:'inherit' }}/>
        <span style={{ fontSize:11, color:'#888', flexShrink:0 }}>×</span>
        <input type="text" inputMode="numeric" value={value}
          onChange={e => { const v=parseInt(e.target.value); setValue(isNaN(v)||v<1?1:v); }}
          onFocus={e => e.target.select()}
          style={{ width:34, border:'1px solid #ddd', borderRadius:7, padding:'5px 4px', fontSize:12, textAlign:'center' }}/>
        <Btn small disabled={!name.trim()} onClick={() => {
          if (name.trim()) {
            onAdd({ id:`c_${Date.now()}`, name:name.trim(), value, enabled:true, auto:false, multi });
            setName(''); setValue(1); setMulti(true);
          }
        }}>+ Add</Btn>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:6, paddingLeft:2 }}>
        <Tog small checked={multi} onChange={setMulti}/>
        <span style={{ fontSize:11, color:'#888' }}>Allow multiples per hole</span>
      </div>
    </div>
  );
}

// ─── DotRow ────────────────────────────────────────────────────────────────────
function DotRow({ sp, isEditing, editName, editValue, setEditName, setEditValue,
                  commitEdit, setEditingId, setDots, startEdit, deleteCustom }) {
  const isCustom = sp.id.startsWith('c_');
  const spValue  = sp.value ?? sp.pts ?? 1;
  const [swipeX,  setSwipeX]  = useState(0);
  const [swiping, setSwiping] = useState(false);
  const touchStartX = useRef(0);
  const REVEAL = 88;
  const onTouchStart = e => { touchStartX.current = e.touches[0].clientX; setSwiping(false); };
  const onTouchMove  = e => { const dx = e.touches[0].clientX - touchStartX.current; if (dx < 0) { setSwiping(true); setSwipeX(Math.max(dx, -REVEAL)); } };
  const onTouchEnd   = () => { if (swipeX < -REVEAL/2) setSwipeX(-REVEAL); else { setSwipeX(0); setSwiping(false); } };
  const closeSwipe   = () => { setSwipeX(0); setSwiping(false); };
  return (
    <div style={{ position:'relative', overflow:'hidden', borderRadius:8 }}>
      {isCustom && (
        <div style={{ position:'absolute', right:0, top:0, bottom:0, display:'flex', alignItems:'stretch', zIndex:0 }}>
          <button onClick={() => { closeSwipe(); startEdit(sp); }}
            style={{ width:44, background:'#fff9e6', border:'none', cursor:'pointer', fontSize:11, fontWeight:700, color:'#7a6000', fontFamily:'inherit' }}>Edit</button>
          <button onClick={() => { closeSwipe(); deleteCustom(sp.id); }}
            style={{ width:44, background:'#c0392b', border:'none', cursor:'pointer', fontSize:11, fontWeight:700, color:'#fff', fontFamily:'inherit' }}>Del</button>
        </div>
      )}
      <div
        onTouchStart={isCustom ? onTouchStart : undefined}
        onTouchMove={isCustom ? onTouchMove : undefined}
        onTouchEnd={isCustom ? onTouchEnd : undefined}
        style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 9px', borderRadius:8,
                 background: sp.enabled ? '#f0f8f0' : '#fafafa',
                 border: `1px solid ${sp.enabled ? '#c0dcc0' : '#eee'}`,
                 position:'relative', zIndex:1,
                 transform:`translateX(${swipeX}px)`,
                 transition: swiping ? 'none' : 'transform 0.2s ease' }}>
        <Tog small checked={sp.enabled}
          onChange={v => setDots(p => p.map(s => s.id === sp.id ? { ...s, enabled:v } : s))}/>
        {isEditing ? (
          <>
            <input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
              onBlur={() => commitEdit(sp.id)}
              onKeyDown={e => { if (e.key==='Enter') commitEdit(sp.id); if (e.key==='Escape') setEditingId(null); }}
              style={{ flex:1, fontSize:12, border:'1px solid #aaddaa', borderRadius:5, padding:'2px 5px' }}/>
            <span style={{ fontSize:11, color:'#888', flexShrink:0 }}>×</span>
            <input type="text" inputMode="numeric" value={editValue}
              onChange={e => { const v=parseInt(e.target.value); setEditValue(isNaN(v)||v<1?1:v>10?10:v); }}
              onFocus={e => e.target.select()} onBlur={() => commitEdit(sp.id)}
              style={{ width:34, border:'1px solid #ddd', borderRadius:6, padding:'2px 3px', fontSize:12, textAlign:'center' }}/>
          </>
        ) : (
          <>
            <span style={{ flex:1, fontSize:13, color: sp.enabled ? '#222' : '#aaa' }}>
              {sp.name}{sp.auto && <span style={{ fontSize:10, color:'#4a9e4a', marginLeft:4 }}>auto</span>}
            </span>
            <span style={{ fontSize:11, color:'#888', flexShrink:0 }}>×</span>
            <input type="text" inputMode="numeric"
              value={spValue === 0 ? '' : String(spValue)}
              onChange={e => { const v=parseInt(e.target.value); setDots(p=>p.map(s=>s.id===sp.id?{...s,value:isNaN(v)||v<1?1:v>10?10:v}:s)); }}
              onFocus={e => e.target.select()}
              style={{ width:34, border:'1px solid #ddd', borderRadius:6, padding:'2px 3px', fontSize:12, textAlign:'center' }}/>
          </>
        )}
      </div>
    </div>
  );
}

// ─── GameConfigDots ────────────────────────────────────────────────────────────
export function GameConfigDots({
  opts, setOpt, bet, setBet, players,
  dotsPlayers, setDotsPlayers,
  dots, setDots,
  gameRanges = {}, setGameRange,
  roundStartHole = 0, roundEndHole = 17,
  activateSetupKp,
  activeFieldId,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editName,  setEditName]  = useState('');
  const [editValue, setEditValue] = useState(1);
  const [rangeOpen, setRangeOpen] = useState(false);

  const startEdit  = sp => { setEditingId(sp.id); setEditName(sp.name); setEditValue(sp.value ?? sp.pts ?? 1); };
  const commitEdit = id => {
    if (!editName.trim()) { setEditingId(null); return; }
    setDots(p => p.map(s => s.id === id ? { ...s, name: editName.trim(), value: Math.max(1, Math.min(10, editValue)) } : s));
    setEditingId(null);
  };
  const deleteCustom = id => {
    const updatedDots = dots.filter(s => s.id !== id);
    setDots(updatedDots);
    const ar = ls.get(SK.activeRound);
    if (!ar?.dotEntries) return;
    const ens = updatedDots.filter(s => s.enabled);
    const entryCount = v => typeof v === 'number' ? v : (v === true ? 1 : 0);
    const entries = { ...ar.dotEntries };
    let changed = false;
    Object.keys(entries).forEach(key => {
      const parts = key.split('_');
      if (parts[2] !== 'team') return;
      const hole = parseInt(parts[0]), earnerIdx = parseInt(parts[parts.length-1]);
      if (isNaN(earnerIdx)) return;
      let total = 0;
      Object.entries(entries).forEach(([k, v]) => {
        const cnt = entryCount(v); if (!cnt) return;
        const p = k.split('_');
        if (parseInt(p[0]) !== hole || parseInt(p[1]) !== earnerIdx || p[2] === 'team') return;
        const sp = ens.find(s => s.id === p[2]);
        if (sp) total += cnt;
      });
      const current = entryCount(entries[key]);
      if (total === 0) { delete entries[key]; changed = true; }
      else if (total !== current) { entries[key] = total; changed = true; }
    });
    if (changed) ls.set(SK.activeRound, { ...ar, dotEntries: entries });
  };

  const currentTeamMode = opts.teamMode ?? (opts.teamScoring ? 'Sixes' : 'none');
  const isTeamMode = currentTeamMode !== 'none';

  // Range pill for Dots — locked to team source when in team mode (D-3A).
  const renderRangePill = () => {
    if (isTeamMode) {
      let lockedStart = roundStartHole;
      let lockedEnd   = roundEndHole;
      let note = '';
      if (currentTeamMode === 'Sixes') {
        const sx = gameRanges?.['Sixes'];
        if (sx && Number.isInteger(sx.startHole) && Number.isInteger(sx.endHole)) {
          lockedStart = sx.startHole; lockedEnd = sx.endHole;
        }
        note = 'Range locked to Sixes';
      } else if (currentTeamMode.startsWith('Match:')) {
        const mid = currentTeamMode.slice(6);
        const m = gameRanges?.[mid];
        if (m && Number.isInteger(m.startHole) && Number.isInteger(m.endHole)) {
          lockedStart = m.startHole; lockedEnd = m.endHole;
        }
        note = 'Range locked to Match';
      }
      return (
        <GameRangePill
          startHole={lockedStart} endHole={lockedEnd}
          isCustom={false}
          disabled
          lockedNote={note}
          onOpen={() => {}}
        />
      );
    }

    const entry     = gameRanges?.['Dots'];
    const hasCustom = !!(entry && Number.isInteger(entry.startHole) && Number.isInteger(entry.endHole));
    const effStart  = hasCustom ? entry.startHole : roundStartHole;
    const effEnd    = hasCustom ? entry.endHole   : roundEndHole;

    return (
      <>
        <GameRangePill
          startHole={effStart} endHole={effEnd}
          isCustom={hasCustom}
          onOpen={() => setRangeOpen(true)}
        />
        {rangeOpen && (
          <GameRangePopup
            gameKey="Dots"
            gameLabel="Dots"
            initialStart={effStart} initialEnd={effEnd}
            roundStart={roundStartHole} roundEnd={roundEndHole}
            isCustom={hasCustom}
            onCommit={(s, e) => {
              if (s === roundStartHole && e === roundEndHole) {
                setGameRange?.('Dots', null);
              } else {
                setGameRange?.('Dots', { startHole: s, endHole: e });
              }
              setRangeOpen(false);
            }}
            onResetToRound={() => { setGameRange?.('Dots', null); setRangeOpen(false); }}
            onClose={() => setRangeOpen(false)}
            onActivate={activateSetupKp}
        activeFieldId={activeFieldId}
          />
        )}
      </>
    );
  };

  return (
    <>
      {!isTeamMode && players.length > 2 && (
        <PlayerSubsetDropdown
          players={players}
          selectedIdxs={dotsPlayers}
          onChange={setDotsPlayers}
        />
      )}
      <BetSection
        modes={[{ value:'spread', label:'Point Spread' }, { value:'total', label:'Total' }]}
        mode={opts.dotsMode || 'spread'}
        onModeChange={v => setOpt('dotsMode', v)}
        values={{ single: bet }}
        onValueChange={(_, v) => setBet(v)}
        onActivate={activateSetupKp}
        activeFieldId={activeFieldId}
        betSectionId="dots"
      />
      {!isTeamMode && players.length > 2 && (
        <PayStylePill
          value={opts.payStyle || 'payup'}
          onChange={v => setOpt('payStyle', v)}
        />
      )}
      <div style={{ marginTop:10 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#666', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.04em' }}>Dots to Track</div>
        <div style={{ display:'grid', gap:'5px' }}>
          {dots.filter(sp => sp.id !== 'team').map(sp => (
            <DotRow key={sp.id} sp={sp}
              isEditing={editingId === sp.id}
              editName={editName} editValue={editValue}
              setEditName={setEditName} setEditValue={setEditValue}
              commitEdit={commitEdit} setEditingId={setEditingId}
              setDots={setDots} startEdit={startEdit} deleteCustom={deleteCustom}
            />
          ))}
        </div>
        <CustomDotAdder onAdd={sp => setDots(p => [...p, sp])}/>
      </div>
      {renderRangePill()}
    </>
  );
}
