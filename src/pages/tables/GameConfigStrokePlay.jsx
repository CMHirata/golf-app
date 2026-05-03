// ─── GameConfigStrokePlay.jsx ─────────────────────────────────────────────────
// Stroke Play game configuration panel.
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
//   signature. renderRangePill logic moved inline verbatim — no behavioral
//   change. BetSection values/onValueChange wiring preserved exactly.

import { useState } from 'react';
import {
  BetSection, PlayerSubsetDropdown,
  GameRangePill, GameRangePopup,
} from './GameConfigShared.jsx';

export function GameConfigStrokePlay({
  opts, setOpt, bet, setBet, players,
  strokePlayPlayers, setStrokePlayPlayers,
  gameRanges = {}, setGameRange,
  roundStartHole = 0, roundEndHole = 17,
  activateSetupKp,
  activeFieldId,
}) {
  const [rangeOpen, setRangeOpen] = useState(false);

  const entry     = gameRanges?.['Stroke Play'];
  const hasCustom = !!(entry && Number.isInteger(entry.startHole) && Number.isInteger(entry.endHole));
  const effStart  = hasCustom ? entry.startHole : roundStartHole;
  const effEnd    = hasCustom ? entry.endHole   : roundEndHole;

  return (
    <>
      {players.length > 2 && (
        <PlayerSubsetDropdown
          players={players}
          selectedIdxs={strokePlayPlayers}
          onChange={setStrokePlayPlayers}
        />
      )}
      <BetSection
        modes={[{ value:'total', label:'Total' }, { value:'segments', label:'F/B/T' }]}
        mode={opts.betMode || 'total'}
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
        betSectionId="strokeplay"
      />
      <GameRangePill
        startHole={effStart} endHole={effEnd}
        isCustom={hasCustom}
        onOpen={() => setRangeOpen(true)}
      />
      {rangeOpen && (
        <GameRangePopup
          gameKey="Stroke Play"
          gameLabel="Stroke Play"
          initialStart={effStart} initialEnd={effEnd}
          roundStart={roundStartHole} roundEnd={roundEndHole}
          isCustom={hasCustom}
          onCommit={(s, e) => {
            if (s === roundStartHole && e === roundEndHole) {
              setGameRange?.('Stroke Play', null);
            } else {
              setGameRange?.('Stroke Play', { startHole: s, endHole: e });
            }
            setRangeOpen(false);
          }}
          onResetToRound={() => { setGameRange?.('Stroke Play', null); setRangeOpen(false); }}
          onClose={() => setRangeOpen(false)}
          onActivate={activateSetupKp}
        activeFieldId={activeFieldId}
        />
      )}
    </>
  );
}
