// ─── GameConfig.jsx ───────────────────────────────────────────────────────────
// Per-game bet/scoring configuration panel rendered inside NewRoundPage
// when a game toggle is active.
//
// 13-E REFACTOR: Default export is now a thin dispatcher.
// Game-family panel logic lives in dedicated files:
//   GameConfigStrokePlay.jsx  — Stroke Play
//   GameConfigSkins.jsx       — Skins
//   GameConfigStableford.jsx  — Stableford
//   GameConfigNines.jsx       — Nines
//   GameConfigSixes.jsx       — Sixes
//   GameConfigDots.jsx        — Dots (Specials/Junk)
//   // Extension point: GameConfigWolf.jsx — Wolf (future)
//
// Shared sub-components used by panel files live in GameConfigShared.jsx
// (avoids circular imports: panels ← GameConfigShared; dispatcher → panels).
// GameConfig.jsx re-exports everything from GameConfigShared so all existing
// callers (NewRoundPage, MatchCard) import from this file with zero changes.
//
// Named exports from this file:
//   (re-exported from GameConfigShared.jsx)
//   PRESS_OPTS           — shared press-dropdown option list
//   validateGameRange    — per-game structural validation helper
//   GameRangePill        — bottom-of-tile pill showing effective hole range
//   GameRangePopup       — bottom-sheet popup for editing per-game range
//   BetSection           — universal bet layout
//   PlayerSubsetDropdown — inline dropdown subset picker with C-2 chip closed state
//   (defined here)
//   GameTile             — unified morph tile (header + body share one container)
//   TeamPickerPair       — shared team A/B picker (Match team format + Sixes segments)
//   PlayerSubsetChips    — existing chip picker (used inside PlayerSubsetDropdown panel)
//   InlineRow            — label + control row (kept for future use, no current callers)
//
// ✅ Self-checked (13-E): All named exports verified present and re-exported or
//   defined. Dispatcher props signature unchanged from pre-13-E default export.
//   No circular imports: panel files import from GameConfigShared, not GameConfig.
//   H-8: betType / GAME_CONFIGS remain in NewRoundPage.
//   H-6: StyledSel / PlayerDropdown remain in their original consumers.

import { G, GA, GB } from '../../components/ui.jsx';
import { PlayerDropdown, ReadOnlyBubble, StyledSel } from '../PlayerDropdown.jsx';

// Re-export shared sub-components so callers importing from GameConfig.jsx
// continue to work with zero changes (NewRoundPage imports GameTile;
// MatchCard imports BetSection, GameRangePill, GameRangePopup).
export {
  PRESS_OPTS,
  validateGameRange,
  GameRangePill,
  GameRangePopup,
  BetSection,
  PlayerSubsetDropdown,
  PayStylePill,
  TiebreakSelect,
} from './GameConfigShared.jsx';

import { GameConfigStrokePlay } from './GameConfigStrokePlay.jsx';
import { GameConfigSkins }      from './GameConfigSkins.jsx';
import { GameConfigStableford } from './GameConfigStableford.jsx';
import { GameConfigNines }      from './GameConfigNines.jsx';
import { GameConfigSixes }       from './GameConfigSixes.jsx';
import { GameConfigDots }        from './GameConfigDots.jsx';
import { GameConfigWolf }        from './GameConfigWolf.jsx';

// ─── InlineRow — shared export (kept for future use; no internal callers) ─────
export function InlineRow({ label, children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:6 }}>
      <span style={{ fontSize:11, fontWeight:700, color:'#666', flexShrink:0 }}>{label}</span>
      <div style={{ flexShrink:0 }}>{children}</div>
    </div>
  );
}

// ─── PlayerSubsetChips — shared export ───────────────────────────────────────
export function PlayerSubsetChips({ players, selectedIdxs, onChange, label, note, maxSelect }) {
  const n = players.length;
  const cols = n <= 3 ? n : n === 4 ? 2 : 3;
  return (
    <div style={{ marginBottom:8 }}>
      {label && <div style={{ fontSize:11, fontWeight:700, color:'#666', marginBottom:4 }}>{label}</div>}
      {note && <div style={{ fontSize:10, color:'#888', marginBottom:5 }}>{note}</div>}
      <div style={{ display:'grid', gridTemplateColumns:`repeat(${cols}, 1fr)`, gap:5 }}>
        {players.map((p, i) => {
          const allIn = selectedIdxs.length === 0;
          const on = allIn || selectedIdxs.includes(i);
          const atMax = maxSelect != null && selectedIdxs.length >= maxSelect && !selectedIdxs.includes(i);
          const toggle = () => {
            if (atMax) return;
            if (allIn) { onChange(players.map((_,j)=>j).filter(j=>j!==i)); return; }
            const next = on ? selectedIdxs.filter(x=>x!==i) : [...selectedIdxs,i];
            onChange(next.length === players.length ? [] : next);
          };
          const parts = (p?.name || '').trim().split(/\s+/);
          const first = parts[0] || '?';
          const last  = parts.length >= 2 ? parts[parts.length-1] : '';
          return (
            <div key={i} onClick={toggle}
              style={{ border:`1.5px solid ${on?G:atMax?'#eee':'#ddd'}`, background:on?GA:'#fff', borderRadius:20, padding:'5px 8px', cursor:atMax?'not-allowed':'pointer', textAlign:'center', minWidth:0, opacity:atMax?0.5:1 }}>
              <div style={{ fontSize:12, fontWeight:600, color:on?G:'#aaa', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', lineHeight:1.2 }}>{first}</div>
              {last && <div style={{ fontSize:10, fontWeight:400, color:on?G:'#aaa', opacity:0.7, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', lineHeight:1.2 }}>{last}</div>}
            </div>
          );
        })}
      </div>
      {selectedIdxs.length > 0 && selectedIdxs.length < players.length && (
        <div style={{ fontSize:10, color:'#888', marginTop:4 }}>
          {selectedIdxs.length}{maxSelect ? `/${maxSelect}` : ` of ${players.length}`} players · tap to toggle
        </div>
      )}
    </div>
  );
}

// ─── GameTile — shared export ─────────────────────────────────────────────────
// Unified morph tile: header row + (optional) body, all in one container.
// Collapsed: header row only, white background.
// Expanded: header row + hairline separator + body, light-green background (GA).
export function GameTile({
  title, subtitle = null, on, onToggle,
  secondaryDropdown = null, scoring, onScoringChange,
  includeNOL = true, showScoring = true, children,
}) {
  const scoringOpts = [
    { value:'gross',     label:'Gross' },
    { value:'net',       label:'Net' },
    ...(includeNOL ? [{ value:'netofflow', label:'Net Off Low' }] : []),
  ];
  return (
    <div style={{ width:'100%', boxSizing:'border-box', borderRadius:12,
                  border:`1.5px solid ${on?G:'#eee'}`, background:on?GB:'#fff' }}>
      <div onClick={onToggle}
        style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', alignItems:'center',
                 gap:6, padding:'8px 12px', cursor:'pointer' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0,
                      gridColumn: on ? undefined : '1 / -1' }}>
          <input type="checkbox" checked={on} readOnly
            style={{ accentColor:G, width:13, height:13, flexShrink:0, pointerEvents:'none' }}/>
          <span style={{ fontWeight:600, fontSize:13, color:on?G:'#333', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {title}
            {subtitle && !on && (
              <span style={{ fontSize:11, color:'#888', fontWeight:400, marginLeft:5 }}>{subtitle}</span>
            )}
          </span>
        </div>
        <div onClick={e => e.stopPropagation()} style={{ display:'flex', justifyContent:'center' }}>
          {on && secondaryDropdown ? <div style={{ width:'100%' }}>{secondaryDropdown}</div> : null}
        </div>
        <div onClick={e => e.stopPropagation()} style={{ display:'flex', justifyContent:'flex-end' }}>
          {on && showScoring && (
            <div style={{ width:'100%' }}>
              <StyledSel value={scoring || (includeNOL ? 'net' : 'gross')} onChange={onScoringChange}
                options={scoringOpts} width="100%"/>
            </div>
          )}
        </div>
      </div>
      {on && (
        <>
          <div style={{ height:1, background:'#ddeedd', margin:'0 12px' }}/>
          <div style={{ padding:'10px 12px 12px' }}>{children}</div>
        </>
      )}
    </div>
  );
}

// ─── TeamPickerPair — shared export ───────────────────────────────────────────
export function TeamPickerPair({
  players, teamA = [], onTeamAChange,
  excludeIdxs = [],
  labels = ['Player 1','Player 2'],
  teamBPlayers = [],
  separator = 'vs',
  panelLabelPrefix = '',
}) {
  const slot0 = teamA[0] ?? null;
  const slot1 = teamA[1] ?? null;
  const teamAFull = slot0 != null && slot1 != null;

  const setSlot = (slot, pi) => {
    const other = slot === 0 ? slot1 : slot0;
    const newA = slot === 0
      ? [pi, other].filter(x => x != null)
      : [other, pi].filter(x => x != null);
    const cleanA = pi != null && newA[0] === newA[1] ? [pi] : newA;
    onTeamAChange(cleanA);
  };

  const exclude0 = [slot1, ...excludeIdxs].filter(x => x != null);
  const exclude1 = [slot0, ...excludeIdxs].filter(x => x != null);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <div>
        <div style={{ fontSize:10, fontWeight:700, color:'#888', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.04em' }}>Team A</div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ flex:1, minWidth:0 }}>
            <PlayerDropdown players={players} value={slot0} onChange={v => setSlot(0, v)} label={labels[0]}
              excludeIdxs={exclude0}
              panelLabel={panelLabelPrefix ? `${panelLabelPrefix} — ${labels[0]}` : undefined}/>
          </div>
          <span style={{ fontSize:11, color:'#aaa', flexShrink:0 }}>{separator}</span>
          <div style={{ flex:1, minWidth:0 }}>
            <PlayerDropdown players={players} value={slot1} onChange={v => setSlot(1, v)} label={labels[1]}
              excludeIdxs={exclude1}
              panelLabel={panelLabelPrefix ? `${panelLabelPrefix} — ${labels[1]}` : undefined}/>
          </div>
        </div>
      </div>
      {teamAFull && teamBPlayers.length >= 2 && (
        <div>
          <div style={{ fontSize:10, fontWeight:700, color:'#888', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.04em' }}>Team B</div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <div style={{ flex:1, minWidth:0 }}><ReadOnlyBubble p={players[teamBPlayers[0]]??null}/></div>
            <span style={{ fontSize:11, color:'#aaa', flexShrink:0 }}>{separator}</span>
            <div style={{ flex:1, minWidth:0 }}><ReadOnlyBubble p={players[teamBPlayers[1]]??null}/></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── GameConfig dispatcher (default export) ───────────────────────────────────
// Renders the body of a non-Match game tile. Match bodies are rendered directly
// by NewRoundPage.jsx — this component does not handle 'Match / Nassau'.
//
// Props signature is unchanged from the pre-13-E default export. Unused props
// for a given game are ignored by each panel component.
export default function GameConfig({ game, opts, setOpt, bet, setBet, players,
                                     sixesTeams, setSixesTeams,
                                     strokePlayPlayers, setStrokePlayPlayers,
                                     skinsPlayers, setSkinsPlayers,
                                     ninesPlayers, setNinesPlayers,
                                     stablefordPlayers, setStablefordPlayers,
                                     dotsPlayers, setDotsPlayers,
                                     dots, setDots,
                                     gameRanges = {}, setGameRange,
                                     roundStartHole = 0, roundEndHole = 17,
                                     activateSetupKp,
                                     activeFieldId }) {
  if (game === 'Stroke Play') return (
    <GameConfigStrokePlay
      opts={opts} setOpt={setOpt} bet={bet} setBet={setBet} players={players}
      strokePlayPlayers={strokePlayPlayers} setStrokePlayPlayers={setStrokePlayPlayers}
      gameRanges={gameRanges} setGameRange={setGameRange}
      roundStartHole={roundStartHole} roundEndHole={roundEndHole}
      activateSetupKp={activateSetupKp} activeFieldId={activeFieldId}
    />
  );

  if (game === 'Skins') return (
    <GameConfigSkins
      opts={opts} setOpt={setOpt} bet={bet} setBet={setBet} players={players}
      skinsPlayers={skinsPlayers} setSkinsPlayers={setSkinsPlayers}
      gameRanges={gameRanges} setGameRange={setGameRange}
      roundStartHole={roundStartHole} roundEndHole={roundEndHole}
      activateSetupKp={activateSetupKp} activeFieldId={activeFieldId}
    />
  );

  if (game === 'Stableford') return (
    <GameConfigStableford
      opts={opts} setOpt={setOpt} bet={bet} setBet={setBet} players={players}
      stablefordPlayers={stablefordPlayers} setStablefordPlayers={setStablefordPlayers}
      gameRanges={gameRanges} setGameRange={setGameRange}
      roundStartHole={roundStartHole} roundEndHole={roundEndHole}
      activateSetupKp={activateSetupKp} activeFieldId={activeFieldId}
    />
  );

  if (game === 'Nines') return (
    <GameConfigNines
      opts={opts} setOpt={setOpt} bet={bet} setBet={setBet} players={players}
      ninesPlayers={ninesPlayers} setNinesPlayers={setNinesPlayers}
      gameRanges={gameRanges} setGameRange={setGameRange}
      roundStartHole={roundStartHole} roundEndHole={roundEndHole}
      activateSetupKp={activateSetupKp} activeFieldId={activeFieldId}
    />
  );

  if (game === 'Sixes') return (
    <GameConfigSixes
      opts={opts} setOpt={setOpt} bet={bet} setBet={setBet} players={players}
      sixesTeams={sixesTeams} setSixesTeams={setSixesTeams}
      gameRanges={gameRanges} setGameRange={setGameRange}
      roundStartHole={roundStartHole} roundEndHole={roundEndHole}
      activateSetupKp={activateSetupKp} activeFieldId={activeFieldId}
    />
  );

  if (game === 'Dots') return (
    <GameConfigDots
      opts={opts} setOpt={setOpt} bet={bet} setBet={setBet} players={players}
      dotsPlayers={dotsPlayers} setDotsPlayers={setDotsPlayers}
      dots={dots} setDots={setDots}
      gameRanges={gameRanges} setGameRange={setGameRange}
      roundStartHole={roundStartHole} roundEndHole={roundEndHole}
      activateSetupKp={activateSetupKp} activeFieldId={activeFieldId}
    />
  );

  if (game === 'Wolf') return (
    <GameConfigWolf
      opts={opts} setOpt={setOpt} bet={bet} setBet={setBet} players={players}
      activateSetupKp={activateSetupKp} activeFieldId={activeFieldId}
    />
  );

  return null;
}
