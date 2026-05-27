// ─── GameConfigNines.jsx ──────────────────────────────────────────────────────
// Nines game configuration panel.
// Extracted from GameConfig.jsx (13-E). Zero logic changes — verbatim body.
//
// MODULE BOUNDARY
//   Receives all props from the GameConfig dispatcher. Owns local rangeOpen
//   state for the GameRangePopup. Calls no engine functions directly.
//   Shared named exports (GameTile, BetSection, etc.) remain in GameConfig.jsx.
//
// ARCHITECTURE (ARCHITECTURE_FOUNDATIONS.md §2)
//   UI layer only. No engine calls. No state promotion. Props pass through
//   unchanged from dispatcher → panel.
//
// GOTCHAS
//   Nines requires exactly 3 players — show error when < 3; show subset picker
//   when > 3 with required=3 constraint (PlayerSubsetDropdown).
//
// ✅ Self-checked (13-E): All props verified. required=3 PlayerSubsetDropdown
//   constraint preserved. Blitz StyledSel value/onChange wiring unchanged.
//   GameRangePill uses gameKey='Nines' (structural minimum 6 holes per §16 G-4).

import { useState } from 'react';
import { RED } from '../../components/ui.jsx';
import { StyledSel } from '../PlayerDropdown.jsx';
import {
  BetSection, PlayerSubsetDropdown, PayStylePill,
  GameRangePill, GameRangePopup,
} from './GameConfigShared.jsx';

export function GameConfigNines({
  opts, setOpt, bet, setBet, players,
  ninesPlayers, setNinesPlayers,
  gameRanges = {}, setGameRange,
  roundStartHole = 0, roundEndHole = 17,
  activateSetupKp,
  activeFieldId,
}) {
  const [rangeOpen, setRangeOpen] = useState(false);

  const entry     = gameRanges?.['Nines'];
  const hasCustom = !!(entry && Number.isInteger(entry.startHole) && Number.isInteger(entry.endHole));
  const effStart  = hasCustom ? entry.startHole : roundStartHole;
  const effEnd    = hasCustom ? entry.endHole   : roundEndHole;

  return (
    <>
      {players.length < 3 && (
        <div style={{ background:'#fce8e8', color:RED, borderRadius:8, padding:'8px 11px', fontSize:12, marginBottom:8 }}>
          Nines requires at least 3 players.
        </div>
      )}
      {players.length > 3 && (
        <PlayerSubsetDropdown
          players={players}
          selectedIdxs={ninesPlayers || []}
          onChange={setNinesPlayers}
          required={3}
        />
      )}
      <BetSection
        modes={[{ value:'perpoint', label:'Point Spread' }, { value:'total', label:'Total' }, { value:'segments', label:'F/B/T' }]}
        mode={opts.betMode || 'perpoint'}
        onModeChange={v => setOpt('betMode', v)}
        values={{ single: bet, front: opts.betF ?? bet, back: opts.betB ?? bet, total: opts.bet18 ?? bet }}
        onValueChange={(field, v) => {
          if (field === 'single')      setBet(v);
          else if (field === 'front')  setOpt('betF',  v);
          else if (field === 'back')   setOpt('betB',  v);
          else if (field === 'total')  setOpt('bet18', v);
        }}
        onActivate={activateSetupKp}
        activeFieldId={activeFieldId}
        betSectionId="nines"
      />
      {players.length > 2 && (
        <PayStylePill
          value={opts.payStyle || 'payup'}
          onChange={v => setOpt('payStyle', v)}
        />
      )}
      <div style={{ marginTop:8 }}>
        <StyledSel
          value={opts.blitz === true}
          onChange={v => setOpt('blitz', v === true)}
          options={[
            { value:false, label:'No Niner' },
            { value:true,  label:'Niner (Win by Net 2)' },
          ]}
          width="100%"
        />
      </div>
      <GameRangePill
        startHole={effStart} endHole={effEnd}
        isCustom={hasCustom}
        onOpen={() => setRangeOpen(true)}
      />
      {rangeOpen && (
        <GameRangePopup
          gameKey="Nines"
          gameLabel="Nines"
          initialStart={effStart} initialEnd={effEnd}
          roundStart={roundStartHole} roundEnd={roundEndHole}
          isCustom={hasCustom}
          onCommit={(s, e) => {
            if (s === roundStartHole && e === roundEndHole) {
              setGameRange?.('Nines', null);
            } else {
              setGameRange?.('Nines', { startHole: s, endHole: e });
            }
            setRangeOpen(false);
          }}
          onResetToRound={() => { setGameRange?.('Nines', null); setRangeOpen(false); }}
          onClose={() => setRangeOpen(false)}
          onActivate={activateSetupKp}
        activeFieldId={activeFieldId}
        />
      )}
    </>
  );
}
