// ─── GameConfigMatch.jsx ──────────────────────────────────────────────────────
// Body content for a single Match/Nassau instance.
// Renamed from MatchCard.jsx → GameConfigMatch.jsx in 15-J for consistency
// with all other GameConfig panel files. Moved to src/pages/new-round/.
// The outer tile container and header row (checkbox, "Match A", format dropdown,
// scoring dropdown) are owned by <GameTile> in NewRoundPage.jsx. This component
// renders only the body shown below the hairline separator when the tile is
// expanded: players section, bet section, tie-break row.
//
// ✅ Self-checked (13-C.3): Added optional per-match range pill (keyed by
// match.id per PartialGameContract §4.3). Identical pattern to non-Match
// games in GameConfig. Props `gameRanges`, `setGameRange`, `roundStartHole`,
// `roundEndHole` flow down from NewRoundPage. Match uses the default 3-hole
// minimum validator. Pill is optional — if range props aren't provided the
// pill does not render (backward compat).
//
// Props:
//   match    — the MatchDef object
//   players  — active players array
//   onChange — (updatedMatch) => void
//   gameRanges (optional) — 13-C.3 per-game range map (keyed by match.id)
//   setGameRange (optional) — (gameKey, { startHole, endHole } | null) => void
//   roundStartHole (optional, default 0)
//   roundEndHole   (optional, default 17)
//
// Note: removal is handled by the tile checkbox via GameTile's onToggle in
// NewRoundPage — no [✕] button here.

import { useState } from 'react';
import { BetSection, GameRangePill, GameRangePopup } from './GameConfigShared.jsx';
import { PlayerDropdown, ReadOnlyBubble, StyledSel } from '../PlayerDropdown.jsx';

const TIEBREAK_OPTS = [
  { value:'none',       label:'Best Ball' },
  { value:'second',     label:'2nd Ball Breaks Tie' },
  { value:'cumulative', label:'Cumulative Score' },
];

export default function GameConfigMatch({
  match, players, onChange,
  // 13-C.3: per-match range props — optional for backward compat
  gameRanges = {}, setGameRange,
  roundStartHole = 0, roundEndHole = 17,
  activateSetupKp,   // B-6: optional — page-level keypad activation callback
  activeFieldId,
}) {
  const set = (key, val) => onChange({ ...match, [key]: val });
  const twoPlayers = players.length === 2;
  const isTeam = !twoPlayers && match.format === 'team';
  const p1 = twoPlayers ? 0 : match.p1;
  const p2 = twoPlayers ? 1 : match.p2;

  // 13-C.3: range popup state
  const [rangeOpen, setRangeOpen] = useState(false);

  // Bet mode UI echo — derived from stored field values.
  const [betMode, setBetMode] = useState(() =>
    (match.betFront > 0 || match.betBack > 0) ? 'nassau' : 'total'
  );
  // Nassau_Match_Contract §16.4 — carry-forward rule:
  //   Total → Nassau: seed betFront and betBack from betOverall
  //   Nassau → Total: clear betFront and betBack to 0
  const switchBetMode = v => {
    setBetMode(v);
    if (v === 'nassau') {
      const carry = match.betOverall || 0;
      onChange({ ...match, betFront: carry, betBack: carry });
    } else {
      onChange({ ...match, betFront: 0, betBack: 0 });
    }
  };

  const teamA = match.teamA || [];
  const teamASlot0 = teamA[0] ?? null;
  const teamASlot1 = teamA[1] ?? null;
  const teamAFull  = teamASlot0 != null && teamASlot1 != null;
  const teamBPlayers = teamAFull ? players.map((_, i) => i).filter(i => !teamA.includes(i)) : [];

  return (
    <>
      {/* Players section — hidden for 2-player rounds */}
      {!twoPlayers && !isTeam && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:8, alignItems:'center', marginBottom:10 }}>
          <PlayerDropdown players={players} value={p1} onChange={v => set('p1', v)}
            label="Player 1" excludeIdxs={p2 != null ? [p2] : []} firstNameOnly/>
          <span style={{ fontSize:11, color:'#aaa' }}>vs</span>
          <PlayerDropdown players={players} value={p2} onChange={v => set('p2', v)}
            label="Player 2" excludeIdxs={p1 != null ? [p1] : []} firstNameOnly/>
        </div>
      )}
      {!twoPlayers && isTeam && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:8, alignItems:'center', marginBottom:10 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <PlayerDropdown players={players} value={teamASlot0}
              onChange={v => {
                const newA = [v, teamASlot1 === v ? null : teamASlot1].filter(x => x != null);
                const newB = players.map((_, i) => i).filter(i => !newA.includes(i));
                onChange({ ...match, teamA: newA, teamB: newB });
              }}
              label="Player 1" excludeIdxs={[teamASlot1].filter(x => x != null)} firstNameOnly/>
            <PlayerDropdown players={players} value={teamASlot1}
              onChange={v => {
                const newA = [teamASlot0 === v ? null : teamASlot0, v].filter(x => x != null);
                const newB = players.map((_, i) => i).filter(i => !newA.includes(i));
                onChange({ ...match, teamA: newA, teamB: newB });
              }}
              label="Player 2" excludeIdxs={[teamASlot0].filter(x => x != null)} firstNameOnly/>
          </div>
          <span style={{ fontSize:11, color:'#aaa' }}>vs</span>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {teamAFull ? (
              <>
                <ReadOnlyBubble p={players[teamBPlayers[0]] ?? null} firstNameOnly/>
                <ReadOnlyBubble p={players[teamBPlayers[1]] ?? null} firstNameOnly/>
              </>
            ) : (
              <>
                <ReadOnlyBubble p={null}/>
                <ReadOnlyBubble p={null}/>
              </>
            )}
          </div>
        </div>
      )}

      {/* Bet section */}
      <BetSection
        modes={[{ value:'nassau', label:'Nassau' }, { value:'total', label:'Total' }]}
        mode={betMode}
        onModeChange={switchBetMode}
        values={{
          front: match.betFront   || 0,
          back:  match.betBack    || 0,
          total: match.betOverall || 0,
          single: match.betOverall || 0,
        }}
        onValueChange={(field, v) => {
          if (field === 'front')       set('betFront',   v);
          else if (field === 'back')   set('betBack',    v);
          else if (field === 'total')  set('betOverall', v);
          else if (field === 'single') set('betOverall', v);
        }}
        pressable
        pressValues={{
          front:  match.autoPressF || 'none',
          back:   match.autoPressB || 'none',
          total:  match.autoPressO || 'none',
          single: match.autoPressO || 'none',
        }}
        onPressChange={(field, v) => {
          if (field === 'front')       set('autoPressF', v);
          else if (field === 'back')   set('autoPressB', v);
          else if (field === 'total')  set('autoPressO', v);
          else if (field === 'single') set('autoPressO', v);
        }}
        onActivate={activateSetupKp}
        betSectionId={`match_${match.id}`}
        activeFieldId={activeFieldId}
      />

      {/* Scoring rule — team format only, when Team A is full AND Team B has 2 */}
      {isTeam && teamAFull && teamBPlayers.length >= 2 && (
        <div style={{ marginTop:8 }}>
          <StyledSel
            value={match.scoring ?? match.tiebreak ?? 'none'}
            onChange={v => set('scoring', v)}
            options={TIEBREAK_OPTS}
            width="100%"
          />
        </div>
      )}

      {/* 13-C.3: per-match range pill + popup (keyed by match.id) */}
      {setGameRange && match.id && (() => {
        const entry = gameRanges?.[match.id];
        const hasCustom = !!(entry && Number.isInteger(entry.startHole) && Number.isInteger(entry.endHole));
        const effStart = hasCustom ? entry.startHole : roundStartHole;
        const effEnd   = hasCustom ? entry.endHole   : roundEndHole;
        return (
          <>
            <GameRangePill
              startHole={effStart} endHole={effEnd}
              isCustom={hasCustom}
              onOpen={() => setRangeOpen(true)}
            />
            {rangeOpen && (
              <GameRangePopup
                gameKey="Match"
                gameLabel="Match"
                initialStart={effStart} initialEnd={effEnd}
                roundStart={roundStartHole} roundEnd={roundEndHole}
                isCustom={hasCustom}
                onCommit={(s, e) => {
                  if (s === roundStartHole && e === roundEndHole) {
                    setGameRange(match.id, null);
                  } else {
                    setGameRange(match.id, { startHole: s, endHole: e });
                  }
                  setRangeOpen(false);
                }}
                onResetToRound={() => { setGameRange(match.id, null); setRangeOpen(false); }}
                onClose={() => setRangeOpen(false)}
                onActivate={activateSetupKp}
                activeFieldId={activeFieldId}
              />
            )}
          </>
        );
      })()}
    </>
  );
}
