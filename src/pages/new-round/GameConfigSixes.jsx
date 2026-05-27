// ─── GameConfigSixes.jsx ──────────────────────────────────────────────────────
// Sixes game configuration panel.
// Extracted from GameConfig.jsx (13-E). Moved to src/pages/new-round/ in 15-J.
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
//   Sixes requires exactly 4 players. Match 1 and Match 2 team pickers enforce
//   no repeat-teammate rules via priorTeammates(). Match 3 is fully auto-derived.
//   GameRangePill uses gameKey='Sixes' (structural minimum 9 holes, divisible
//   by 3, per PartialGameContract §16 G-4 / Sixes_Contract D-10).
//
// ✅ Self-checked (13-E): All props verified. sixesTeams/setSixesTeams wiring
//   preserved verbatim — functional updater pattern `prev => { n=[...prev]; ... }`
//   unchanged. priorTeammates() closure over sixesTeams preserved. BetSection
//   pressable wiring (autoPress) unchanged. Scoring StyledSel unchanged.

import { useState } from 'react';
import { RED } from '../../components/ui.jsx';
import { PlayerDropdown, ReadOnlyBubble, StyledSel } from '../PlayerDropdown.jsx';
import {
  BetSection,
  GameRangePill, GameRangePopup,
} from './GameConfigShared.jsx';

export function GameConfigSixes({
  opts, setOpt, bet, setBet, players,
  sixesTeams, setSixesTeams,
  gameRanges = {}, setGameRange,
  roundStartHole = 0, roundEndHole = 17,
  activateSetupKp,
  activeFieldId,
}) {
  const [rangeOpen, setRangeOpen] = useState(false);

  // With 4 players there are exactly 3 distinct pairings:
  //   {0+1 vs 2+3}, {0+2 vs 1+3}, {0+3 vs 1+2}
  // Pick randomly from the 2 pairings that differ from the current Match 1,
  // then assign the remaining pairing to Match 2.
  // Guarantees no two matches share the same partner pair.
  function randomizeTeams() {
    const allPairings = [
      [[0,1],[2,3]],
      [[0,2],[1,3]],
      [[0,3],[1,2]],
    ];
    const cur1a = sixesTeams[0]?.a, cur1b = sixesTeams[0]?.b;
    const sameAsM1 = ([a, b]) =>
      (a === cur1a && b === cur1b) || (a === cur1b && b === cur1a);
    const others = allPairings.filter(([m1]) => !sameAsM1(m1));
    const pick = others[Math.floor(Math.random() * others.length)];
    const [m1, m2] = pick;
    setSixesTeams([
      { a: m1[0], b: m1[1] },
      { a: m2[0], b: m2[1] },
    ]);
  }

  const entry     = gameRanges?.['Sixes'];
  const hasCustom = !!(entry && Number.isInteger(entry.startHole) && Number.isInteger(entry.endHole));
  const effStart  = hasCustom ? entry.startHole : roundStartHole;
  const effEnd    = hasCustom ? entry.endHole   : roundEndHole;

  return (
    <>
      {players.length < 4 && (
        <div style={{ background:'#fce8e8', color:RED, borderRadius:8, padding:'8px 11px', fontSize:12, marginBottom:8 }}>
          Sixes requires 4 players.
        </div>
      )}
      {players.length >= 4 && (() => {
        const usedPairs = [];
        [0, 1].forEach(s => {
          const st = sixesTeams[s];
          const a = st?.a ?? null, b = st?.b ?? null;
          if (a != null && b != null) {
            usedPairs.push([a, b]);
            const teamB = players.map((_,i)=>i).filter(i => i!==a && i!==b);
            if (teamB.length === 2) usedPairs.push([teamB[0], teamB[1]]);
          }
        });

        const all4 = players.map((_,i)=>i);
        const allPairs2 = [];
        for (let i=0;i<all4.length;i++) for (let j=i+1;j<all4.length;j++) allPairs2.push([all4[i],all4[j]]);
        const remaining = allPairs2.filter(([x,y]) =>
          !usedPairs.some(([a,b]) => (a===x&&b===y)||(a===y&&b===x))
        );
        const m3A = remaining[0] || null;
        const m3B = m3A ? all4.filter(i => i!==m3A[0] && i!==m3A[1]) : [];

        return (
          <div style={{ marginBottom:8 }}>
            {[0, 1].map(seg => {
              const t = sixesTeams[seg];
              const slot0 = t?.a ?? null;
              const slot1 = t?.b ?? null;
              const teamAArr = [slot0, slot1].filter(x => x != null);

              const priorTeammates = anchor => {
                if (anchor == null) return [];
                const otherSeg = seg === 0 ? 1 : 0;
                const os = sixesTeams[otherSeg];
                if (!os || os.a == null || os.b == null) return [];
                const pairs = [[os.a, os.b]];
                const otherTeamB = players.map((_,i)=>i).filter(i => i!==os.a && i!==os.b);
                if (otherTeamB.length === 2) pairs.push([otherTeamB[0], otherTeamB[1]]);
                return pairs
                  .filter(([x,y]) => x===anchor || y===anchor)
                  .map(([x,y]) => x===anchor ? y : x);
              };

              const extraExcludes = [
                ...priorTeammates(slot0),
                ...priorTeammates(slot1),
              ].filter(x => x != null);

              const teamB = teamAArr.length === 2
                ? players.map((_,i)=>i).filter(i => i!==slot0 && i!==slot1)
                : [];

              return (
                <div key={seg} style={{ marginBottom:10 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#4a9e4a', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                    Match {seg + 1}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:8, alignItems:'center' }}>
                    {/* Team A — left, stacked */}
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      <PlayerDropdown players={players} value={slot0}
                        onChange={vi => setSixesTeams(prev => { const n=[...prev]; n[seg]={a:vi,b:vi===slot1?null:slot1}; return n; })}
                        label="Player 1"
                        excludeIdxs={[slot1, ...extraExcludes].filter(x=>x!=null)}
                        panelLabel={`Match ${seg+1} — Player 1`}
                        firstNameOnly
                        {...(seg === 0 ? {
                          footerSlot: close => (
                            <div
                              onClick={() => { randomizeTeams(); close(); }}
                              style={{ width:'100%', padding:'6px 9px',
                                       borderRadius:10, border:'1.5px solid #ddd',
                                       background:'#f9fdf9', color:'#333',
                                       fontSize:12, fontWeight:700,
                                       textAlign:'center', cursor:'pointer',
                                       boxSizing:'border-box' }}>
                              Randomize Teams
                            </div>
                          )
                        } : {})}/>
                      <PlayerDropdown players={players} value={slot1}
                        onChange={vi => setSixesTeams(prev => { const n=[...prev]; n[seg]={a:slot0,b:vi}; return n; })}
                        label="Player 2"
                        excludeIdxs={[slot0, ...extraExcludes].filter(x=>x!=null)}
                        panelLabel={`Match ${seg+1} — Player 2`}
                        firstNameOnly/>
                    </div>
                    <span style={{ fontSize:11, color:'#aaa' }}>vs</span>
                    {/* Team B — right, stacked */}
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {teamAArr.length === 2 ? (
                        <>
                          <ReadOnlyBubble p={players[teamB[0]]??null} firstNameOnly/>
                          <ReadOnlyBubble p={players[teamB[1]]??null} firstNameOnly/>
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
              );
            })}
            {/* Match 3 — fully auto-derived, compact 3-column */}
            {m3A && m3B.length === 2 && (
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#4a9e4a', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.05em' }}>
                  Match 3
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:8, alignItems:'center' }}>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    <ReadOnlyBubble p={players[m3A[0]]??null} firstNameOnly/>
                    <ReadOnlyBubble p={players[m3A[1]]??null} firstNameOnly/>
                  </div>
                  <span style={{ fontSize:11, color:'#aaa' }}>vs</span>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    <ReadOnlyBubble p={players[m3B[0]]??null} firstNameOnly/>
                    <ReadOnlyBubble p={players[m3B[1]]??null} firstNameOnly/>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}
      <BetSection
        modes={[]}
        values={{ single: bet }}
        onValueChange={(_, v) => setBet(v)}
        pressable
        pressValues={{ single: opts.autoPress || 'none' }}
        onPressChange={(_, v) => setOpt('autoPress', v)}
        onActivate={activateSetupKp}
        activeFieldId={activeFieldId}
        betSectionId="sixes"
      />
      <div style={{ marginTop:8 }}>
        <StyledSel
          value={opts.scoring ?? opts.tiebreak ?? 'none'}
          onChange={v => setOpt('scoring', v)}
          options={[
            { value:'none',       label:'Best Ball' },
            { value:'second',     label:'2nd Ball Breaks Tie' },
            { value:'cumulative', label:'Cumulative Score' },
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
          gameKey="Sixes"
          gameLabel="Sixes"
          initialStart={effStart} initialEnd={effEnd}
          roundStart={roundStartHole} roundEnd={roundEndHole}
          isCustom={hasCustom}
          onCommit={(s, e) => {
            if (s === roundStartHole && e === roundEndHole) {
              setGameRange?.('Sixes', null);
            } else {
              setGameRange?.('Sixes', { startHole: s, endHole: e });
            }
            setRangeOpen(false);
          }}
          onResetToRound={() => { setGameRange?.('Sixes', null); setRangeOpen(false); }}
          onClose={() => setRangeOpen(false)}
          onActivate={activateSetupKp}
        activeFieldId={activeFieldId}
        />
      )}
    </>
  );
}
