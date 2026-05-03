// ─── GameConfigStableford.jsx ─────────────────────────────────────────────────
// Stableford game configuration panel.
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
//   H-12: opts.scoring holds team hole-scoring rule ('cumulative'|'bestball'),
//   NOT a grossNetNOL value. Do not apply the generic GNL fallback here.
//   H-23: Stableford points table inputs use onFocus select + direct onChange
//   (no draft-string needed — integer-only, no clamping on keystroke).
//
// ✅ Self-checked (13-E): All props verified. setTeamA derived-teamB pattern
//   preserved verbatim. stabTable / DEFAULT_STAB import confirmed. BetSection
//   F/B/T wiring preserved. Team picker slot/exclude logic unchanged.

import { useState } from 'react';
import { DEFAULT_STAB } from '../../engine/handicap.js';
import { G } from '../../components/ui.jsx';
import { PlayerDropdown, ReadOnlyBubble, StyledSel } from '../PlayerDropdown.jsx';
import {
  BetSection, PlayerSubsetDropdown,
  GameRangePill, GameRangePopup,
} from './GameConfigShared.jsx';

export function GameConfigStableford({
  opts, setOpt, bet, setBet, players,
  stablefordPlayers, setStablefordPlayers,
  gameRanges = {}, setGameRange,
  roundStartHole = 0, roundEndHole = 17,
  activateSetupKp,
  activeFieldId,
}) {
  const [rangeOpen, setRangeOpen] = useState(false);

  const stabFormat  = opts.format ?? 'individual';
  const isTeam      = stabFormat === 'team';
  const stabScoring = opts.scoring ?? 'cumulative';
  const stabTeamA   = opts.teamA ?? [];
  const allIdxs     = players.map((_, i) => i);
  const derivedTeamB = allIdxs.filter(i => !stabTeamA.includes(i)).slice(0, 2);
  const stabTeamB   = (opts.teamB ?? []).length === 2 ? opts.teamB : derivedTeamB;

  const slot0 = stabTeamA[0] ?? null;
  const slot1 = stabTeamA[1] ?? null;

  const setTeamA = (newA) => {
    const newB = allIdxs.filter(i => !newA.includes(i)).slice(0, 2);
    setOpt('teamA', newA);
    setOpt('teamB', newB);
  };

  const entry     = gameRanges?.['Stableford'];
  const hasCustom = !!(entry && Number.isInteger(entry.startHole) && Number.isInteger(entry.endHole));
  const effStart  = hasCustom ? entry.startHole : roundStartHole;
  const effEnd    = hasCustom ? entry.endHole   : roundEndHole;

  return (
    <>
      {/* Subset picker — individual mode only, 3+ players */}
      {!isTeam && players.length > 2 && (
        <PlayerSubsetDropdown
          players={players}
          selectedIdxs={stablefordPlayers}
          onChange={setStablefordPlayers}
        />
      )}

      {/* Team picker — Sixes-style stacked layout */}
      {isTeam && players.length >= 4 && (
        <div style={{ marginBottom:10 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:8, alignItems:'center' }}>
            {/* Team A — left column, stacked */}
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <PlayerDropdown
                players={players} value={slot0}
                onChange={vi => {
                  const newA = [vi, vi === slot1 ? null : slot1].filter(x => x != null);
                  setTeamA(newA);
                }}
                label="Player 1"
                excludeIdxs={[slot1].filter(x => x != null)}
                panelLabel="Team A — Player 1"
                firstNameOnly/>
              <PlayerDropdown
                players={players} value={slot1}
                onChange={vi => {
                  const newA = [slot0, vi].filter(x => x != null);
                  setTeamA(newA);
                }}
                label="Player 2"
                excludeIdxs={[slot0].filter(x => x != null)}
                panelLabel="Team A — Player 2"
                firstNameOnly/>
            </div>
            <span style={{ fontSize:11, color:'#aaa' }}>vs</span>
            {/* Team B — right column, stacked read-only */}
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {stabTeamA.length === 2 ? (
                <>
                  <ReadOnlyBubble p={players[stabTeamB[0]] ?? null} firstNameOnly/>
                  <ReadOnlyBubble p={players[stabTeamB[1]] ?? null} firstNameOnly/>
                </>
              ) : (
                <>
                  <ReadOnlyBubble p={null}/>
                  <ReadOnlyBubble p={null}/>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bet section */}
      <BetSection
        modes={[
          { value:'perpoint', label:'Per Point' },
          { value:'total',    label:'Total' },
          { value:'segments', label:'F/B/T' },
        ]}
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
        betSectionId="stableford"
      />

      {/* Points table — 8 rows including condor */}
      <div style={{ marginTop:10 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#666', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.04em' }}>Points</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(8,1fr)', gap:4 }}>
          {[['Condor','4'],['Albtrs','3'],['Eagle','2'],['Birdie','1'],['Par','0'],['Bogey','-1'],['Dbl','-2'],['Worse','-3']].map(([lbl,key]) => {
            const t = opts.stabTable || DEFAULT_STAB;
            return (
              <div key={key} style={{ textAlign:'center' }}>
                <div style={{ fontSize:9, color:'#888', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lbl}</div>
                <input type="text" inputMode="numeric" value={t[key] ?? 0}
                  onFocus={e => e.target.select()}
                  onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 0) setOpt('stabTable', { ...(opts.stabTable || DEFAULT_STAB), [key]: v }); }}
                  style={{ width:'100%', boxSizing:'border-box', border:'1px solid #ddd', borderRadius:6, padding:'4px 2px', fontSize:12, textAlign:'center', fontFamily:'inherit' }}/>
              </div>
            );
          })}
        </div>
        <button onClick={() => setOpt('stabTable', { ...DEFAULT_STAB })}
          style={{ marginTop:4, fontSize:11, color:G, background:'none', border:'none', cursor:'pointer', padding:0 }}>Reset</button>
      </div>

      {/* Scoring rule dropdown — team mode only, full-width, no label */}
      {isTeam && (
        <div style={{ marginTop:8 }}>
          <StyledSel
            value={stabScoring}
            onChange={v => setOpt('scoring', v)}
            options={[
              { value:'cumulative', label:'Cumulative Score' },
              { value:'bestball',   label:'Best Ball'        },
            ]}
            width="100%"
          />
        </div>
      )}

      <GameRangePill
        startHole={effStart} endHole={effEnd}
        isCustom={hasCustom}
        onOpen={() => setRangeOpen(true)}
      />
      {rangeOpen && (
        <GameRangePopup
          gameKey="Stableford"
          gameLabel="Stableford"
          initialStart={effStart} initialEnd={effEnd}
          roundStart={roundStartHole} roundEnd={roundEndHole}
          isCustom={hasCustom}
          onCommit={(s, e) => {
            if (s === roundStartHole && e === roundEndHole) {
              setGameRange?.('Stableford', null);
            } else {
              setGameRange?.('Stableford', { startHole: s, endHole: e });
            }
            setRangeOpen(false);
          }}
          onResetToRound={() => { setGameRange?.('Stableford', null); setRangeOpen(false); }}
          onClose={() => setRangeOpen(false)}
          onActivate={activateSetupKp}
        activeFieldId={activeFieldId}
        />
      )}
    </>
  );
}
