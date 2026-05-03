// ─── GameConfigSkins.jsx ──────────────────────────────────────────────────────
// Skins game configuration panel.
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
// ✅ Self-checked (13-E): All props verified against GameConfig default export
//   signature. BetSection extraField (carryover StyledSel) wiring preserved
//   exactly. GameRangePill/Popup logic moved inline verbatim.

import { useState } from 'react';
import {
  BetSection, PlayerSubsetDropdown,
  GameRangePill, GameRangePopup,
} from './GameConfigShared.jsx';
import { StyledSel } from '../PlayerDropdown.jsx';

export function GameConfigSkins({
  opts, setOpt, bet, setBet, players,
  skinsPlayers, setSkinsPlayers,
  gameRanges = {}, setGameRange,
  roundStartHole = 0, roundEndHole = 17,
  activateSetupKp,
  activeFieldId,
}) {
  const [rangeOpen, setRangeOpen] = useState(false);

  const entry     = gameRanges?.['Skins'];
  const hasCustom = !!(entry && Number.isInteger(entry.startHole) && Number.isInteger(entry.endHole));
  const effStart  = hasCustom ? entry.startHole : roundStartHole;
  const effEnd    = hasCustom ? entry.endHole   : roundEndHole;

  return (
    <>
      {players.length > 2 && (
        <PlayerSubsetDropdown
          players={players}
          selectedIdxs={skinsPlayers}
          onChange={setSkinsPlayers}
        />
      )}
      <BetSection
        modes={[{ value:'perSkin', label:'Per Skin' }, { value:'pot', label:'Pot' }]}
        mode={opts.mode || 'perSkin'}
        onModeChange={v => setOpt('mode', v)}
        values={{ single: bet }}
        onValueChange={(_, v) => setBet(v)}
        extraField={
          <StyledSel
            value={opts.carryover === false ? false : true}
            onChange={v => setOpt('carryover', v)}
            options={[{ value:true, label:'Carryover' }, { value:false, label:'No Carryover' }]}
            width="100%"
          />
        }
        onActivate={activateSetupKp}
        activeFieldId={activeFieldId}
        betSectionId="skins"
      />
      <GameRangePill
        startHole={effStart} endHole={effEnd}
        isCustom={hasCustom}
        onOpen={() => setRangeOpen(true)}
      />
      {rangeOpen && (
        <GameRangePopup
          gameKey="Skins"
          gameLabel="Skins"
          initialStart={effStart} initialEnd={effEnd}
          roundStart={roundStartHole} roundEnd={roundEndHole}
          isCustom={hasCustom}
          onCommit={(s, e) => {
            if (s === roundStartHole && e === roundEndHole) {
              setGameRange?.('Skins', null);
            } else {
              setGameRange?.('Skins', { startHole: s, endHole: e });
            }
            setRangeOpen(false);
          }}
          onResetToRound={() => { setGameRange?.('Skins', null); setRangeOpen(false); }}
          onClose={() => setRangeOpen(false)}
          onActivate={activateSetupKp}
        activeFieldId={activeFieldId}
        />
      )}
    </>
  );
}
