// ─── GamesCard.jsx ─────────────────────────────────────────────────────────────
// ✅ Self-checked (13-E.7): Verbatim extraction of the Games card body from
// NewRoundPage.jsx (lines ~1152–1382 pre-extraction). No logic added or removed.
// All setters/handlers are parent-owned; this component is render-only for the
// card body. State ownership: zero local state; all values and setters via props.
// H-6: StyledSel consumed from PlayerDropdown — no new picker implementations.
// H-8: GAME_CONFIGS / betType stay in NewRoundPage; GamesCard receives only the
//       data it needs to render (activeGames, gameOpts, etc.) — no betType in props.
// GameTile, GameConfig, GameConfigMatch imported from their existing locations.
// ALL_GAMES imported from engine for the sorted tile loop.

import { G, GA, Card } from '../../components/ui.jsx';
import { ALL_GAMES } from '../../engine/games.js';
import { StyledSel } from '../PlayerDropdown.jsx';
import GameConfig, { GameTile } from '../new-round/GameConfig.jsx';
import GameConfigMatch from '../new-round/GameConfigMatch.jsx';

// Props:
//   Data:    activeGames, activePlayers, gameOpts, gameBets, matches, dots,
//            sixesTeams, gameRanges, roundStartHole, roundNumHoles
//   Per-game subset state + setters:
//            strokePlayPlayers, setStrokePlayPlayers,
//            skinsPlayers, setSkinsPlayers,
//            ninesPlayers, setNinesPlayers,
//            stablefordPlayers, setStablefordPlayers,
//            dotsPlayers, setDotsPlayers,
//            sixesPlayers, setSixesPlayers
//   Setters/handlers:
//            toggleGame, setOpt, setMatches, setGameBets,
//            setDots, setSixesTeams, setGameRange
export default function GamesCard({
  activeGames, activePlayers, gameOpts, gameBets, matches, dots,
  sixesTeams, gameRanges, roundStartHole, roundNumHoles,
  strokePlayPlayers, setStrokePlayPlayers,
  skinsPlayers, setSkinsPlayers,
  ninesPlayers, setNinesPlayers,
  stablefordPlayers, setStablefordPlayers,
  dotsPlayers, setDotsPlayers,
  sixesPlayers, setSixesPlayers,
  toggleGame, setOpt, setMatches, setGameBets,
  setDots, setSixesTeams, setGameRange,
  activateSetupKp,
  activeFieldId,
}) {
  return (
    <Card>
      <div style={{ fontWeight:700, fontSize:14, color:G, marginBottom:8 }}>Games & Bets</div>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {(() => {
          // Display name helper — shows "Match" for the stored key "Match / Nassau".
          const displayGameName = g => g === 'Match / Nassau' ? 'Match' : g;

          // Alphabetical order by display name.
          const sortedGames = [...ALL_GAMES].sort((a, b) =>
            displayGameName(a).localeCompare(displayGameName(b))
          );

          const tiles = [];

          sortedGames.forEach(g => {
            const on    = activeGames.includes(g);
            const opts  = gameOpts[g] || {};

            // ── Match / Nassau: special handling ────────────────────────
            if (g === 'Match / Nassau') {
              // OFF → single collapsed placeholder tile.
              if (!on) {
                tiles.push(
                  <GameTile key="match-placeholder"
                    title="Match"
                    on={false}
                    onToggle={() => toggleGame(g)}
                  >
                    {/* never renders — tile is collapsed */}
                  </GameTile>
                );
                return;
              }

              // ON → one GameTile per match instance + "+ Add another Match" tile.
              matches.forEach((m, idx) => {
                const letter = String.fromCharCode(65 + idx); // 'A', 'B', 'C'...
                const matchTitle = `Match ${letter}`;
                const twoPlayers = activePlayers.length === 2;

                // Secondary dropdown: Individual / Team (hidden for 2-player rounds)
                const secondaryDropdown = twoPlayers ? null : (
                  <StyledSel
                    value={m.format || 'individual'}
                    onChange={v => setMatches(prev => prev.map(x => x.id === m.id ? { ...x, format: v } : x))}
                    options={[
                      { value:'individual', label:'Individual' },
                      { value:'team',       label:'Team' },
                    ]}
                    width="100%"
                  />
                );

                // Checkbox toggle: unchecking removes THIS match. If it's the only
                // one, also remove the game from activeGames (reverts to placeholder).
                const onMatchToggle = () => {
                  if (matches.length === 1) {
                    // Last match — turn off the whole game.
                    toggleGame('Match / Nassau');
                  } else {
                    // Remove just this match instance.
                    setMatches(prev => prev.filter(x => x.id !== m.id));
                    // If Dots teamMode references this match, reset to 'none'.
                    const dotsMode = gameOpts['Dots']?.teamMode;
                    if (dotsMode === `Match:${m.id}`) {
                      setOpt('Dots', 'teamMode', 'none');
                      setDotsPlayers([]);
                    }
                  }
                };

                tiles.push(
                  <GameTile key={m.id}
                    title={matchTitle}
                    on={true}
                    onToggle={onMatchToggle}
                    secondaryDropdown={secondaryDropdown}
                    scoring={m.grossNetNOL ?? m.scoring ?? 'net'}
                    onScoringChange={v => setMatches(prev => prev.map(x => x.id === m.id ? { ...x, grossNetNOL: v } : x))}
                    includeNOL={true}
                    showScoring={true}
                  >
                    <GameConfigMatch
                      match={m}
                      players={activePlayers}
                      onChange={updated => setMatches(prev => prev.map(x => x.id === m.id ? updated : x))}
                      gameRanges={gameRanges}
                      setGameRange={setGameRange}
                      roundStartHole={roundStartHole}
                      roundEndHole={roundStartHole + roundNumHoles - 1}
                      activateSetupKp={activateSetupKp}
                      activeFieldId={activeFieldId}
                    />
                  </GameTile>
                );
              });

              // "+ Add another Match" tile — dashed outline, same width as tiles.
              tiles.push(
                <button key="add-match"
                  onClick={() => setMatches(prev => [...prev, defaultMatch(activePlayers)])}
                  style={{
                    width:'100%', padding:'9px 12px', borderRadius:12,
                    border:`1.5px dashed ${G}`, background:GA,
                    cursor:'pointer', fontSize:13, fontWeight:700, color:G,
                    fontFamily:'inherit', textAlign:'left',
                  }}>
                  + Add another Match
                </button>
              );
              return;
            }

            // ── All other games ────────────────────────────────────────
            const showScoring = true;
            const includeNOL  = g !== 'Dots';
            const scoring     = opts.grossNetNOL ?? opts.scoring ?? (g === 'Dots' ? 'gross' : g === 'Stroke Play' ? 'gross' : 'net');

            // Secondary dropdown per game:
            //   Stableford: Individual / Teams (Teams disabled — Option Z, 11-L unblocks)
            //   Dots:       Individual / Sixes Teams / Match Teams (dynamic)
            let secondaryDropdown = null;

            if (g === 'Stableford' && on) {
              const canTeam = activePlayers.length >= 4;
              secondaryDropdown = (
                <StyledSel
                  value={opts.format || 'individual'}
                  onChange={v => {
                    setOpt(g, 'format', v);
                    // Reset team assignments when switching back to individual
                    if (v === 'individual') {
                      setOpt(g, 'teamA', []);
                      setOpt(g, 'teamB', []);
                    }
                  }}
                  options={[
                    { value:'individual', label:'Individual' },
                    { value:'team',       label:'Teams', disabled: !canTeam },
                  ]}
                  width="100%"
                />
              );
            } else if (g === 'Dots' && on) {
              const teamModeOpts = [{ value:'none', label:'Individual' }];
              if (activeGames.includes('Sixes'))
                teamModeOpts.push({ value:'Sixes', label:'Sixes Teams' });
              if (activeGames.includes('Match / Nassau')) {
                matches?.forEach((m, idx) => {
                  if (m.format === 'team') {
                    const letter = String.fromCharCode(65 + idx);
                    teamModeOpts.push({ value:`Match:${m.id}`, label:`Match ${letter} Teams` });
                  }
                });
              }

              const currentTeamMode = opts.teamMode ?? (opts.teamScoring ? 'Sixes' : 'none');

              if (teamModeOpts.length > 1) {
                secondaryDropdown = (
                  <StyledSel
                    value={currentTeamMode}
                    onChange={v => {
                      setOpt(g, 'teamMode', v);
                      setOpt(g, 'teamScoring', false);
                      if (v === 'none') {
                        setDotsPlayers([]);
                      } else if (v === 'Sixes') {
                        const t0 = sixesTeams?.[0], t1 = sixesTeams?.[1];
                        if (t0 && t1) {
                          const idxs = [...new Set([t0.a, t0.b, t1.a, t1.b]
                            .filter(i => i != null && activePlayers[i]))]
                            .sort((a,b) => a - b);
                          setDotsPlayers(idxs.length === 4 ? idxs : []);
                        } else setDotsPlayers([]);
                      } else if (v.startsWith('Match:')) {
                        const matchId = v.slice(6); // strip 'Match:'
                        const tm = matches?.find(m => m.id === matchId);
                        if (tm) {
                          const idxs = [...new Set([...(tm.teamA || []), ...(tm.teamB || [])]
                            .filter(i => i != null && activePlayers[i]))]
                            .sort((a,b) => a - b);
                          setDotsPlayers(idxs.length >= 2 ? idxs : []);
                        } else setDotsPlayers([]);
                      }
                    }}
                    options={teamModeOpts}
                    width="100%"
                  />
                );
              }
            }

            tiles.push(
              <GameTile
                key={g}
                title={displayGameName(g)}
                subtitle={
                  g === 'Dots'  ? 'Specials, Junk' :
                  g === 'Sixes' ? 'Round Robin'    :
                  null
                }
                on={on}
                onToggle={() => toggleGame(g)}
                secondaryDropdown={secondaryDropdown}
                scoring={scoring}
                onScoringChange={v => setOpt(g, 'grossNetNOL', v)}
                includeNOL={includeNOL}
                showScoring={showScoring}
              >
                <GameConfig game={g} opts={opts} setOpt={(k,v) => setOpt(g, k, v)}
                  bet={gameBets[g] || 0} setBet={v => setGameBets(p => ({ ...p, [g]: v }))}
                  players={activePlayers}
                  sixesTeams={sixesTeams} setSixesTeams={setSixesTeams}
                  strokePlayPlayers={strokePlayPlayers} setStrokePlayPlayers={setStrokePlayPlayers}
                  skinsPlayers={skinsPlayers} setSkinsPlayers={setSkinsPlayers}
                  ninesPlayers={ninesPlayers} setNinesPlayers={setNinesPlayers}
                  stablefordPlayers={stablefordPlayers} setStablefordPlayers={setStablefordPlayers}
                  dotsPlayers={dotsPlayers} setDotsPlayers={setDotsPlayers}
                  dots={dots} setDots={setDots}
                  gameRanges={gameRanges} setGameRange={setGameRange}
                  roundStartHole={roundStartHole}
                  roundEndHole={roundStartHole + roundNumHoles - 1}
                  activateSetupKp={activateSetupKp}
                  activeFieldId={activeFieldId}
                />
              </GameTile>
            );
          });

          return tiles;
        })()}
      </div>
    </Card>
  );
}

// ─── defaultMatch helper (local copy — parent also holds this) ─────────────────
// GamesCard calls defaultMatch only for the "+ Add another Match" button.
// The authoritative copy stays in NewRoundPage.jsx (module scope); this local
// copy is a duplicate so GamesCard has no import dependency on NewRoundPage.
// If the shape ever changes, both copies must be updated together.
function makeMatchId() { return `m_${Date.now()}_${Math.random().toString(36).slice(2,6)}`; }

function defaultMatch(players, format = 'individual') {
  if (format === 'individual') {
    const p1 = players.length >= 1 ? 0 : null;
    const p2 = players.length === 2 ? 1 : null;
    return { id: makeMatchId(), format: 'individual', p1, p2, grossNetNOL: 'net', autoPressF: 'none', autoPressB: 'none', autoPressO: 'none', scoring: 'none', betFront: 0, betBack: 0, betOverall: 0 };
  }
  const tA = players.length >= 4 ? [0, 1] : [];
  const tB = players.length >= 4 ? [2, 3] : [];
  return { id: makeMatchId(), format: 'team', teamA: tA, teamB: tB, grossNetNOL: 'net', autoPressF: 'none', autoPressB: 'none', autoPressO: 'none', scoring: 'none', betFront: 0, betBack: 0, betOverall: 0 };
}
