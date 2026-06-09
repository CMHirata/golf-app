// ─── NewRoundPage.jsx ─────────────────────────────────────────────────────────
// ✅ Self-checked (13-G.2): handleStart now attaches siArray = buildPlayerSI(p, layout)
// to each player in activePlayers (Handicap_Contract §2.5 caller responsibility,
// inv 21). Engines read players[pi].siArray[h] from this point on. No other
// changes — layout/pars/hcps/hcpsWomen still passed through to roundState for
// SI display rows.
//
// ✅ Self-checked (13-E.7): Three card bodies extracted to CourseCard.jsx,
// PlayersCard.jsx, GamesCard.jsx (all under pages/new-round/). All useState,
// useEffect, useCallback, useMemo, all handlers (handleStart, handleSaveEdits,
// handleResumeReload, handleCourseSelect, toggleGame, setOpt, setGameRange,
// computePlayerCH), roundLengthError, allOpts, activePlayers, layout/pars/hcps
// derivations, the page shell, sticky header, reload/resume banners, Date card,
// pinned Start Round button, and modal mounts all remain in this file.
// NineDropdown/TeeDropdown/HIField/CHField extracted to NewRoundHelpers.jsx
// (Option B — single shared file; no longer defined here, no longer imported here;
// CourseCard and PlayersCard import them directly). CoursePickerPopup stays
// module-scope here per scope brief. GAME_CONFIGS, defaultMatch, makeMatchId
// stay module-scope here per scope brief.
// H-11: startTriggerRef wiring via no-dep-array useEffect unchanged.
// H-21: no state fields moved; toSetupState round-trip unaffected.
// H-23: draft-string pattern lives in CourseCard — clamp on blur, not keystroke.
// H-8: betType / GAME_CONFIGS never stored; remain static here.

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ls, SK } from '../services/storage.js';
import { playerLib } from '../services/playerLib.js';
import { courseLib } from '../services/courseLib.js';
import { roundLib } from '../services/roundLib.js';
import { buildGenderLayout, DEF_PARS, DEF_HCP, groupCourseHandicaps, minGroupHandicap, DEFAULT_STAB, courseHandicap, parseIndex, buildPlayerSI } from '../engine/handicap.js';
import { DOTS_DEF, ALL_GAMES } from '../engine/games.js';
import { Btn, Sel, Inp, Tog, Card, BetInput, G, GA, GB, RED, AMB, AMBBG } from '../components/ui.jsx';
import { ACTION_BAR_HEIGHT, NAV_BAR_HEIGHT } from '../constants/layout.js';
import PlayerPickerPopup from './PlayerPickerPopup.jsx';
import GameConfig, { GameTile } from './new-round/GameConfig.jsx';
import GameConfigMatch from './new-round/GameConfigMatch.jsx';
import { PlayerDropdown, StyledSel } from './PlayerDropdown.jsx';
import CourseCard from './new-round/NewRoundCourseCard.jsx';
import PlayersCard from './new-round/PlayersCard.jsx';
import GamesCard from './new-round/GamesCard.jsx';
import { ScoreKeypad } from './ScoreKeypad.jsx';

const SETUP_KEY = 'golf_round_setup_v5';
const loadSetup = () => { try { return JSON.parse(localStorage.getItem(SETUP_KEY) || 'null'); } catch { return null; } };

// ─── GAME_CONFIGS ──────────────────────────────────────────────────────────────
// Static read-only constant — NEVER stored in gameOpts or any persisted state.
// Used only by the setup UI for display routing. (App_Data_Model_Contract §5.5a)
const GAME_CONFIGS = {
  'Match / Nassau': {
    betType: 'segment', modes: [{ value:'nassau', label:'Nassau' }, { value:'total', label:'Total' }],
    defaultMode: 'nassau', pressable: true, subsetPicker: false,
    scoringModes: ['gross','net','netofflow'], pairedOption: 'scoring',
  },
  'Stroke Play': {
    betType: 'segment', modes: [{ value:'total', label:'Total' }, { value:'segments', label:'F/B/T' }],
    defaultMode: 'total', pressable: false, subsetPicker: true, subsetMinPlayers: 2,
    scoringModes: ['gross','net','netofflow'], pairedOption: null,
  },
  'Nines': {
    betType: 'rate', modes: [{ value:'perpoint', label:'Per Point' }, { value:'segments', label:'F/B/T' }],
    defaultMode: 'perpoint', pressable: false, subsetPicker: true, subsetMinPlayers: 3, subsetRequired: 3,
    scoringModes: ['gross','net','netofflow'], pairedOption: 'niner',
  },
  'Stableford': {
    betType: 'rate', modes: [{ value:'perpoint', label:'Per Point' }, { value:'total', label:'Total' }, { value:'segments', label:'F/B/T' }],
    defaultMode: 'perpoint', pressable: false, subsetPicker: true, subsetMinPlayers: 2,
    scoringModes: ['gross','net','netofflow'], pairedOption: null, hasPointsTable: true,
  },
  'Skins': {
    betType: 'rate', modes: [{ value:'perSkin', label:'Per Skin' }, { value:'pot', label:'Pot' }],
    defaultMode: 'perSkin', pressable: false, subsetPicker: true, subsetMinPlayers: 2,
    scoringModes: ['gross','net','netofflow'], pairedOption: 'carryover',
  },
  'Sixes': {
    betType: 'perMatch', modes: [], defaultMode: null, pressable: true, subsetPicker: false,
    scoringModes: ['gross','net','netofflow'], pairedOption: 'scoring',
  },
  'Dots': {
    betType: 'rate', modes: [{ value:'spread', label:'Spread' }, { value:'total', label:'Total' }],
    defaultMode: 'spread', pressable: false, subsetPicker: true, subsetMinPlayers: 2,
    scoringModes: ['gross','net'], pairedOption: 'teamsMode', hasDotsTable: true,
  },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
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

// ─── CoursePickerPopup ─────────────────────────────────────────────────────────
// Bottom-sheet popup for selecting a course, mirrors PlayerPickerPopup pattern.
function CoursePickerPopup({ allCourses, snapshotCourse, selectedId, onConfirm, onClose }) {
  const [picked, setPicked] = useState(selectedId || '');
  const courses = [
    ...(snapshotCourse && !allCourses.find(c => c.id === snapshotCourse.id)
      ? [{ ...snapshotCourse, _fromHistory: true }] : []),
    ...allCourses,
  ].sort((a, b) => {
    const sa = a.starred ? 0 : 1, sb = b.starred ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return (a.name || '').localeCompare(b.name || '');
  });
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:300,display:'flex',alignItems:'flex-end',justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'#fff',borderRadius:'20px 20px 0 0',width:'100%',maxWidth:520,maxHeight:'80vh',display:'flex',flexDirection:'column' }} onClick={e=>e.stopPropagation()}>
        <div style={{ overflowY:'auto',flex:1,padding:'20px 20px 8px' }}>
          <div style={{ fontWeight:800,fontSize:17,color:G,marginBottom:4 }}>Select Course</div>
          <div style={{ fontSize:11,color:'#888',marginBottom:14 }}>Tap to select</div>
          <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
            {courses.map(c => {
              const sel = picked === c.id;
              return (
                <div key={c.id} onClick={() => { setPicked(c.id); }}
                  style={{ padding:'11px 14px',borderRadius:12,border:`1.5px solid ${sel?G:'#eee'}`,background:sel?GA:'#fff',cursor:'pointer',display:'flex',alignItems:'center',gap:8 }}>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontWeight:700,fontSize:14,color:sel?G:'#222' }}>{c.name}{c._fromHistory ? <span style={{ fontSize:11,fontWeight:400,color:'#aaa',marginLeft:6 }}>(from history)</span> : ''}</div>
                    {c.location && <div style={{ fontSize:11,color:'#888',marginTop:1 }}>{c.location}</div>}
                  </div>
                  {c.starred && <span style={{ fontSize:17,color:'#fff9c4',textShadow:'0 0 2px rgba(0,0,0,0.35)',flexShrink:0 }}>★</span>}
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ padding:'10px 20px 24px',borderTop:'1px solid #eee',background:'#fff',flexShrink:0 }}>
          <div style={{ display:'flex',gap:8 }}>
            <Btn variant="outline" onClick={onClose} style={{ flex:1 }}>Cancel</Btn>
            <Btn onClick={() => onConfirm(picked)} disabled={!picked} style={{ flex:2 }}>Confirm</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── NewRoundPage ──────────────────────────────────────────────────────────────
export default function NewRoundPage({ onStart, onGoScorecard, onSaveEdits, inProgress, loadedRound, onLoadedRoundConsumed, getActiveRound, startTriggerRef }) {
  const allPlayers = useMemo(() => playerLib.list(), []);
  const allCourses = useMemo(() => courseLib.list(), []);

  // initSrc is used for useState initializers AND by handleStart for dot_entries/
  // reloadedScores preservation. It must be frozen at mount — loadedRound is
  // cleared by onLoadedRoundConsumed after mount, causing re-renders where
  // loadedRound becomes null. Without freezing, handleStart would read the
  // post-clear initSrc (= setup draft, no dot_entries) and wipe manual dots.
  const initSrcRef = useRef(loadedRound || loadSetup());
  const initSrc    = initSrcRef.current;

  // A-10: Use local date, not UTC. toISOString() returns UTC which shows
  // tomorrow's date for US timezones after ~5pm.
  const today = (() => {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  })();

  const [roundDate,           setRoundDate]           = useState(loadedRound?.roundDate || today);
  const [selectedCourseId,    setSelectedCourseId]    = useState(initSrc?.selectedCourseId || '');
  const [frontNine,           setFrontNine]            = useState(initSrc?.frontNine || '');
  const [backNine,            setBackNine]             = useState(initSrc?.backNine || '');
  const [selectedTee,         setSelectedTee]          = useState(initSrc?.selectedTee || '');
  const [selectedPlayerIds,   setSelectedPlayerIds]    = useState(initSrc?.selectedPlayerIds || []);
  const [activeGames,         setActiveGames]          = useState(initSrc?.activeGames || []);
  const [gameOpts,            setGameOpts]             = useState(initSrc?.gameOpts || {});
  const [gameBets,            setGameBets]             = useState(initSrc?.gameBets || {});
  const [matches,             setMatches]              = useState(initSrc?.matches || []);
  const [strokePlayPlayers,   setStrokePlayPlayers]    = useState(initSrc?.strokePlayPlayers || []);
  const [skinsPlayers,        setSkinsPlayers]         = useState(initSrc?.skinsPlayers || []);
  const [ninesPlayers,        setNinesPlayers]         = useState(initSrc?.ninesPlayers || []);
  const [stablefordPlayers,   setStablefordPlayers]    = useState(initSrc?.stablefordPlayers || []);
  const [dotsPlayers,         setDotsPlayers]          = useState(initSrc?.dotsPlayers || []);
  // G-1 fix: sixesPlayers was missing entirely from state — added here.
  const [sixesPlayers,        setSixesPlayers]         = useState(initSrc?.sixesPlayers || []);
  const [sixesTeams,          setSixesTeams]           = useState(initSrc?.sixesTeams || [null, null, null]);
  const [dots,                setDots]                 = useState(initSrc?.dots || DOTS_DEF.map(s => ({...s})));
  const [showPlayerPicker,    setShowPlayerPicker]     = useState(false);
  const [showCoursePicker,    setShowCoursePicker]     = useState(false);
  const [isReload,            setIsReload]             = useState(!!loadedRound?.isReload);

  // 13-C.2: Round length state — stored 0-based internally, displayed 1-based in UI.
  // Defaults: start hole 1 (index 0), 18 holes (full round).
  // PartialGameContract §1A.1, §1A.2.
  const [roundStartHole, setRoundStartHole] = useState(initSrc?.roundStartHole ?? 0);
  const [roundNumHoles,  setRoundNumHoles]  = useState(initSrc?.roundNumHoles  ?? 18);

  // B-2: Setup keypad state — ScoreKeypad_Contract §10.1
  // State holds only display values (kpValue, kpPlus, mode, fieldId, visible).
  // Callbacks (onChange, onCommit) live in a ref so they never go stale.
  const [setupKp, setSetupKp] = useState(null);
  const setupKpRef    = useRef(null);
  const setupKpCbsRef = useRef({ onChange: null, onCommit: null });

  // 13-C.3: Per-game hole range overrides. Keyed by game name (e.g. 'Skins',
  // 'Nines', 'Stableford') for standard games, or `matchDef.id` for each Match
  // instance per PartialGameContract §4.3. Absent or {} = all games use the
  // full round range. Restored from initSrc on reload so saved per-game ranges
  // survive a back-to-setup or history reload.
  const [gameRanges, setGameRanges] = useState(initSrc?.gameRanges ?? {});

  // setGameRange(gameKey, { startHole, endHole } | null) — add/update/remove
  // a per-game range entry. Passing `null` or a range that equals the round
  // bounds clears the entry (the game falls back to the round range). Matches
  // GameConfig's onCommit / onResetToRound contract.
  const setGameRange = useCallback((gameKey, range) => {
    setGameRanges(prev => {
      const next = { ...prev };
      if (!range || !Number.isInteger(range.startHole) || !Number.isInteger(range.endHole)) {
        delete next[gameKey];
        return next;
      }
      next[gameKey] = { startHole: range.startHole, endHole: range.endHole };
      return next;
    });
  }, []);

  // 13-C.2: Draft strings for the Start Hole / End Hole inputs.
  // Clamping on every keystroke snaps the field to the min/max mid-typing,
  // blocking legitimate multi-digit entries (e.g. typing "12" starts at "1"
  // which was clamped up to min 3). Decoupling the input string from the
  // numeric state lets the field hold any transient text during editing;
  // we validate and clamp only on blur. `null` means the input is not being
  // edited — it shows the committed numeric value derived from state.
  const [startHoleDraft, setStartHoleDraft] = useState(null);
  const [endHoleDraft,   setEndHoleDraft]   = useState(null);

  // Manual CH overrides: { [playerId]: number } — set when user types directly into CH field.
  // On back-to-setup restore: if a player snapshot has courseHcpVal but no ghin (meaning
  // they used a manual CH entry rather than HI), restore that value as an override so the
  // CH field shows the correct value rather than recalculating from a missing HI.
  const [playerCHOverrides, setPlayerCHOverrides] = useState(() => {
    const src = initSrc?.playerSnapshots || [];
    const overrides = {};
    src.forEach(p => {
      if (p.courseHcpVal != null && (!p.ghin || p.ghin.toString().trim() === '')) {
        overrides[p.id] = p.courseHcpVal;
      }
    });
    return overrides;
  });

  // B-2 fix: courseSnapshot and playerSnapshots are frozen into state at mount.
  // They must NEVER be recomputed from loadedRound after mount — App.jsx clears
  // loadedRound immediately after mount via onLoadedRoundConsumed, so any value
  // derived from loadedRound outside of useState would become null on the next
  // render. These are the authoritative time-capsule values for the round being
  // edited. They never fall back to the live library.
  const [courseSnapshot,  setCourseSnapshot]  = useState(initSrc?.courseSnapshot  || null);
  const [playerSnapshots, setPlayerSnapshots] = useState(initSrc?.playerSnapshots || []);

  // G-2/G-3: Per-player HI and tee state (replaces HIConfirmPopup).
  // playerHIs: { [playerId]: string } — editable HI for each player
  // playerTees: { [playerId]: string } — selected tee name per player
  // Initialized from frozen playerSnapshots (reload) or player library (new round).
  const [playerHIs, setPlayerHIs] = useState(() => {
    const src = initSrc?.playerSnapshots || [];
    return Object.fromEntries(src.map(p => [p.id, p.ghin || '']));
  });
  const [playerTees, setPlayerTees] = useState(() => {
    // Restore per-player tees from frozen snapshots (reload path), else default to selectedTee
    const src = initSrc?.playerSnapshots || [];
    const fallback = initSrc?.selectedTee || '';
    return Object.fromEntries(src.map(p => [p.id, p.selectedTee || fallback]));
  });

  useEffect(() => {
    if (loadedRound && onLoadedRoundConsumed) onLoadedRoundConsumed();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // B-2: Global dismiss for setup keypad — close when tapping outside keypad
  // EXCEPT when tapping a keypad-activating field (readOnly input with inputMode="none")
  // — those fields will re-open/swap the keypad atomically via onFocus.
  useEffect(() => {
    if (!setupKp) return;
    const handler = (e) => {
      if (setupKpRef.current && setupKpRef.current.contains(e.target)) return;
      // Also bail if target is a keypad-activating input — let its onFocus
      // handle the field swap without dismissing first.
      const t = e.target;
      if (t && t.tagName === 'INPUT' && t.readOnly && t.getAttribute('inputmode') === 'none') return;
      setupKpCbsRef.current.onCommit?.();
      setSetupKp(null);
    };
    document.addEventListener('touchstart', handler);
    document.addEventListener('mousedown', handler);
    return () => {
      document.removeEventListener('touchstart', handler);
      document.removeEventListener('mousedown', handler);
    };
  }, [setupKp]);

  // B-3 fix: freeze roundId at mount from loadedRound (not initSrc).
  // initSrc may fall through to the setup draft on re-renders after
  // onLoadedRoundConsumed clears loadedRound — the draft has no roundId.
  // loadedRound is only available on the first render, so we capture it here.
  const roundIdRef = useRef(loadedRound?.roundId || null);

  const isReloadRef = useRef(!!loadedRound?.isReload);
  useEffect(() => {
    if (isReloadRef.current) return;
    localStorage.setItem(SETUP_KEY, JSON.stringify({
      roundDate, selectedCourseId, frontNine, backNine, selectedTee,
      selectedPlayerIds, activeGames, gameOpts, gameBets,
      matches, strokePlayPlayers, skinsPlayers, ninesPlayers, stablefordPlayers,
      dotsPlayers, sixesPlayers, sixesTeams, dots,
      // 13-C.2: Persist round length so user's choice survives reloads/drafts.
      roundStartHole, roundNumHoles,
      // 13-C.3: Persist per-game hole ranges so custom overrides survive
      // back-to-setup and browser reload.
      gameRanges,
    }));
  }, [roundDate, selectedCourseId, frontNine, backNine, selectedTee, selectedPlayerIds, activeGames,
      gameOpts, gameBets, matches, strokePlayPlayers, skinsPlayers, ninesPlayers, stablefordPlayers,
      dotsPlayers, sixesPlayers, sixesTeams, dots,
      roundStartHole, roundNumHoles, gameRanges]);

  // 13-C.3: When the round boundary changes (user adjusts start hole or number
  // of holes), drop any gameRanges entry that now falls outside the new
  // boundary. This prevents a stored override from silently contradicting
  // §1A.4 ("game range can never extend beyond the round", invariant #18).
  // Runs only when round boundary changes — not on every gameRanges edit.
  useEffect(() => {
    const roundEnd = roundStartHole + roundNumHoles - 1;
    setGameRanges(prev => {
      let changed = false;
      const next = {};
      Object.entries(prev || {}).forEach(([k, v]) => {
        if (v && Number.isInteger(v.startHole) && Number.isInteger(v.endHole)
            && v.startHole >= roundStartHole && v.endHole <= roundEnd
            && v.startHole < v.endHole) {
          next[k] = v;
        } else {
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [roundStartHole, roundNumHoles]);

  // B-2 fix: In reload mode, the course comes from the frozen snapshot only —
  // never from the live library. The snapshot is the authoritative time capsule.
  // In new-round mode, the course comes from the library (user is picking a course).
  const courseFromLib  = allCourses.find(c => c.id === selectedCourseId) || null;
  const course = isReload
    ? (courseFromLib || courseSnapshot || null)
    : (courseFromLib || null);

  const handleCourseSelect = (id) => {
    setSelectedCourseId(id);
    const c = allCourses.find(x => x.id === id);
    if (c) {
      setFrontNine(c.nines?.[0]?.name || '');
      setBackNine(c.nines?.[1]?.name || c.nines?.[0]?.name || '');
      // Do not auto-pick a tee — start blank so user makes an intentional choice.
      // First player to pick a tee will propagate to all others (see TeeDropdown onChange).
      setSelectedTee('');
      setPlayerTees(prev => {
        const cleared = { ...prev };
        Object.keys(cleared).forEach(pid => { cleared[pid] = ''; });
        return cleared;
      });
    }
  };

  const toggleGame = (g) => {
    setActiveGames(prev => {
      const next = prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g];
      if (g === 'Match / Nassau' && !prev.includes(g)) {
        if (matches.length === 0) setMatches([defaultMatch(activePlayers)]);
      }
      return next;
    });
  };

  const setOpt = (g, k, v) => setGameOpts(prev => ({ ...prev, [g]: { ...(prev[g]||{}), [k]: v } }));

  const layout     = course ? buildGenderLayout(course.nines || [], frontNine, backNine) : null;
  const pars       = layout?.pars || DEF_PARS;
  const hcps       = layout?.hcps || DEF_HCP;
  const hcpsWomen  = layout?.hcpsWomen || null;
  const parsWomen  = layout?.parsWomen || null;
  const hasWomenSI = layout?.hasWomenSI ?? false;
  // Per-game default for grossNetNOL when neither field is stored.
  // NOTE: Stableford is listed here explicitly so allOpts never falls back to
  // o.scoring for grossNetNOL — in Stableford, opts.scoring holds the team
  // hole-scoring rule ('cumulative'|'bestball'), not a handicap mode value.
  const GNL_DEFAULTS = { 'Stroke Play': 'gross', Dots: 'gross', Stableford: 'net' };
  const allOpts = Object.fromEntries(ALL_GAMES.map(g => {
    const o = gameOpts[g] || {};
    // Always write grossNetNOL explicitly so activeRound never has an absent mode field.
    // Stableford skips the o.scoring fallback (collision risk — see NOTE above).
    const gnl = o.grossNetNOL ?? (g === 'Stableford' ? null : o.scoring) ?? (GNL_DEFAULTS[g] || 'net');
    return [g, { ...o, grossNetNOL: gnl, bet: gameBets[g] || 0 }];
  }));

  // playerSnapshots is frozen in state at mount (see useState above).
  // activePlayers resolves each selected ID against the live library first,
  // then falls back to the frozen snapshot. In reload mode the snapshot IS
  // the authoritative source, so players not in the current library still load.
  const activePlayers = selectedPlayerIds.map(id => {
    const snap = playerSnapshots.find(p => p.id === id);
    if (snap) return snap;                          // snapshot always wins in reload
    return allPlayers.find(p => p.id === id) || null; // new-round: live library only
  }).filter(Boolean);

  // G-2/G-3: When selectedPlayerIds changes, initialise any new players' HI and tee.
  useEffect(() => {
    setPlayerHIs(prev => {
      const next = { ...prev };
      activePlayers.forEach(p => {
        if (!(p.id in next)) next[p.id] = p.ghin || '';
      });
      return next;
    });
    setPlayerTees(prev => {
      const next = { ...prev };
      activePlayers.forEach(p => {
        if (!(p.id in next)) next[p.id] = selectedTee || '';
      });
      return next;
    });
  }, [selectedPlayerIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // G-3: Compute per-player course handicap for display in the Players card.
  // Returns the manual override if set, otherwise calculates from HI.
  // Returns null if HI is absent or no tee data available.
  const computePlayerCH = (playerId, hiStr) => {
    if (playerCHOverrides[playerId] != null) return playerCHOverrides[playerId];
    if (!hiStr || hiStr.toString().trim() === '') return null;
    const teeName = playerTees[playerId] || selectedTee || '';
    const tee = course?.tees?.find(t => t.name === teeName) || null;
    const player = activePlayers.find(p => p.id === playerId);
    const isF = player && (player.gender || '').toLowerCase().trim();
    const useWomens = (isF === 'f' || isF === 'female' || isF === 'w') && tee?.slopeW && tee?.ratingW;
    // Use gender-appropriate par total (Handicap_Contract §2.1 / §2.7)
    const activeNines = (course?.nines || []).filter(n => n.name === frontNine || n.name === backNine);
    const totalPar = useWomens
      ? (activeNines.reduce((s, n) => {
          const np = n.parsWomen?.length === 9 ? n.parsWomen : n.pars;
          return s + (np ? np.reduce((a, b) => a + b, 0) : 0);
        }, 0) || pars.reduce((a, b) => a + b, 0))
      : pars.reduce((a, b) => a + b, 0);
    return courseHandicap(
      parseIndex(hiStr),
      useWomens ? tee.slopeW  : tee?.slope,
      useWomens ? tee.ratingW : tee?.rating,
      totalPar
    );
  };

  // B-2: Setup keypad activation — ScoreKeypad_Contract §10.2
  // kpValue is ALWAYS seeded empty when activating from a field.
  // This gives "select-to-overwrite" behavior: typing first digit replaces
  // the persisted value entirely (since the field's onChange callback computes
  // the new field value from the keypad's running buffer).
  const activateSetupKp = useCallback((fieldId, _seedValue, kpPlus, mode, onChange, onCommit) => {
    setupKpCbsRef.current = { onChange, onCommit };
    setSetupKp({ fieldId, kpValue: '', kpPlus, mode });
  }, []);

  // 13-C.2: Round length validation (operates on committed state only; the
  // per-input drafts are never validated until blur).
  // Rules: start hole 1–18, end hole ≤ 18 and ≥ start + 2 (min 3 holes).
  const roundLengthError = useMemo(() => {
    if (!Number.isInteger(roundStartHole) || roundStartHole < 0 || roundStartHole > 17) {
      return 'Start hole must be between 1 and 18.';
    }
    if (!Number.isInteger(roundNumHoles) || roundNumHoles < 3) {
      return 'Round must be at least 3 holes.';
    }
    if (roundStartHole + roundNumHoles - 1 > 17) {
      return `A round starting on hole ${roundStartHole + 1} cannot end past hole 18.`;
    }
    return '';
  }, [roundStartHole, roundNumHoles]);

  const handleStart = () => {
    if (activePlayers.length < 2) { alert('Select at least 2 players'); return; }

    // 13-C.2: Block start if round length is invalid. Message is also shown
    // inline below the pickers, but we alert here to match the existing
    // validation-blocker pattern (Sixes/Nines/Stableford below).
    if (roundLengthError) { alert(roundLengthError); return; }

    // G-5: Sixes requires exactly 4 players (Round Lifecycle Contract §2.5, §14)
    if (activeGames.includes('Sixes') && activePlayers.length === 5) {
      alert('Sixes requires 4 players. A 5-player subset picker for Sixes is not yet available. Remove one player or disable Sixes to continue.');
      return;
    }

    // Nines requires exactly 3 players selected in a 4+ player round (Nines Contract §9 / G-5)
    if (activeGames.includes('Nines') && activePlayers.length > 3 && (ninesPlayers||[]).length < 3) {
      alert('Nines requires exactly 3 players to be selected. Please select 3 players in the Nines options.');
      return;
    }

    // G-4: Score-overwrite warning (Round Lifecycle Contract §2.6)
    // Only warn when lineup has changed AND the existing round has scored holes.
    const existingAr = getActiveRound ? getActiveRound() : null;
    if (existingAr) {
      const existingPlayerIds = existingAr.activePlayers?.map(p => p.id) ?? [];
      const newPlayerIds = activePlayers.map(p => p.id);
      const lineupChanged =
        existingPlayerIds.length !== newPlayerIds.length ||
        existingPlayerIds.some((id, i) => id !== newPlayerIds[i]);
      const hasScores = existingAr.scores?.some(holeScores =>
        holeScores?.some(s => s !== '' && s != null)
      );
      if (lineupChanged && hasScores) {
        const ok = window.confirm('Starting a new round will erase all current scores. Continue?');
        if (!ok) return;
      }
    }

    // Stableford team mode requires both teams fully assigned
    if (activeGames.includes('Stableford') && (gameOpts.Stableford?.format ?? 'individual') === 'team') {
      const tA = gameOpts.Stableford?.teamA ?? [];
      const tB = gameOpts.Stableford?.teamB ?? [];
      if (tA.length < 2 || tB.length < 2) {
        alert('Stableford Teams requires 2 players on each team. Please assign all players before starting.');
        return;
      }
    }

    // Update player library records if HI changed.
    const updatedPlayers = activePlayers.map(p => ({
      ...p,
      ghin: playerHIs[p.id] ?? p.ghin,
      selectedTee: playerTees[p.id] || selectedTee || '',
    }));
    updatedPlayers.forEach(p => {
      const orig = allPlayers.find(x => x.id === p.id);
      if (orig && orig.ghin !== p.ghin) playerLib.update(p.id, { ghin: p.ghin });
    });

    // G-3: Build per-player tee array for groupCourseHandicaps
    const perPlayerTees = updatedPlayers.map(p => {
      const teeName = p.selectedTee || selectedTee || '';
      return course?.tees?.find(t => t.name === teeName) || null;
    });

    const activeNinesForHcps = (course?.nines || []).filter(n => n.name === frontNine || n.name === backNine);
    const courseHcps   = groupCourseHandicaps(updatedPlayers, perPlayerTees, pars, activeNinesForHcps);
    // Apply manual CH overrides — if user typed a CH directly, use that instead of calculated value
    const finalCourseHcps = courseHcps.map((ch, i) => {
      const pid = updatedPlayers[i]?.id;
      return (pid && playerCHOverrides[pid] != null) ? playerCHOverrides[pid] : ch;
    });
    const minCourseHcp = minGroupHandicap(finalCourseHcps);

    // Preserve existing scores/dotEntries only when lineup is unchanged
    const existingAr2 = getActiveRound ? getActiveRound() : null;
    const existingPlayerIds2 = existingAr2?.activePlayers?.map(p => p.id) ?? [];
    const newPlayerIds2 = updatedPlayers.map(p => p.id);
    const playerLineupUnchanged =
      existingAr2 &&
      existingPlayerIds2.length === newPlayerIds2.length &&
      existingPlayerIds2.every((id, i) => id === newPlayerIds2[i]);

    const scores = isReload && initSrc?.reloadedScores?.length
      ? initSrc.reloadedScores
      : playerLineupUnchanged && existingAr2?.scores
        ? existingAr2.scores
        : Array.from({ length: 18 }, () => new Array(updatedPlayers.length).fill(''));

    const dotEntries = isReload
      ? (initSrc?.dot_entries || {})
      : playerLineupUnchanged && existingAr2?.dotEntries
        ? existingAr2.dotEntries
        : {};

    const manualPresses = isReload
      ? (initSrc?.manual_presses || {})
      : playerLineupUnchanged && existingAr2?.manualPresses
        ? existingAr2.manualPresses
        : {};

    // 13-C.7.6: Preserve departure data through Back→Setup→Forward navigation.
    const earlyDepartureOpts = isReload
      ? (initSrc?.earlyDepartureOpts || undefined)
      : playerLineupUnchanged && existingAr2?.earlyDepartureOpts
        ? existingAr2.earlyDepartureOpts
        : undefined;

    const earlyEndOpts = isReload
      ? (initSrc?.earlyEndOpts || undefined)
      : playerLineupUnchanged && existingAr2?.earlyEndOpts
        ? existingAr2.earlyEndOpts
        : undefined;

    const lastCompletedHole = isReload
      ? (typeof initSrc?.lastCompletedHole === 'number' ? initSrc.lastCompletedHole : undefined)
      : playerLineupUnchanged && typeof existingAr2?.lastCompletedHole === 'number'
        ? existingAr2.lastCompletedHole
        : undefined;

    // G-1: sixesPlayers is now included in roundState.
    // B-3 fix: roundId comes from roundIdRef (frozen at mount from loadedRound).
    const roundState = {
      roundId:  roundIdRef.current,
      roundDate, course, frontNine, backNine, selectedTee, layout, pars, hcps,
      hcpsWomen, parsWomen,
      activePlayers: updatedPlayers.map((p, i) => ({
        ...p,
        courseHcpVal: finalCourseHcps[i],
        // 13-G.2 / Handicap_Contract §2.5, §2.8, inv 21:
        // Build per-player SI array from gender + layout. Engines read this
        // (players[pi].siArray[h]) instead of the round-shared hcps[].
        siArray: buildPlayerSI(p, layout),
      })),
      courseHcps: finalCourseHcps, minCourseHcp,
      activeGames,
      gameOpts: allOpts,
      matches,
      strokePlayPlayers,
      skinsPlayers,
      // Auto-populate ninesPlayers for 3-player rounds (picker never shown; Nines Contract §9 G-5).
      ninesPlayers: activeGames.includes('Nines') && updatedPlayers.length === 3
        ? [0, 1, 2]
        : (ninesPlayers || []),
      stablefordPlayers,
      sixesTeams,
      sixesPlayers,
      dotsPlayers,
      dots,
      dotEntries,
      manualPresses,
      scores,
      roundStartHole,
      roundNumHoles,
      gameRanges,
      ...(earlyDepartureOpts ? { earlyDepartureOpts } : {}),
      ...(earlyEndOpts        ? { earlyEndOpts }        : {}),
      ...(lastCompletedHole !== undefined ? { lastCompletedHole } : {}),
    };
    onStart(roundState);
  };

  // Expose handleStart to parent via ref so the center nav button can trigger
  // Start Scoring without the user having to tap the button explicitly.
  useEffect(() => {
    if (startTriggerRef) startTriggerRef.current = handleStart;
  }); // no dep array — always keep ref current with latest handleStart closure

  const handleResumeReload = () => { onGoScorecard(); };

  const handleSaveEdits = () => {
    const roundId = initSrc?.roundId;
    if (!roundId) { alert('Cannot save: original round ID missing.'); return; }

    // Build updated player snapshots reflecting any HI or tee changes made in setup.
    const updatedPlayerSnapshots = activePlayers.map(p => ({
      id:           p.id,
      name:         p.name,
      gender:       p.gender || '',
      ghin:         playerHIs[p.id] ?? p.ghin ?? '',
      courseHcpVal: p.courseHcpVal ?? null,
      selectedTee:  playerTees[p.id] || selectedTee || '',
    }));

    const changes = {
      date:                roundDate,
      course_name:         course?.name || 'Unknown',
      course_snapshot:     course       || null,
      front_nine:          frontNine,
      back_nine:           backNine,
      selected_tee:        selectedTee,
      players:             updatedPlayerSnapshots,
      active_games:        activeGames,
      game_opts:           allOpts,
      matches,
      stroke_play_players: strokePlayPlayers,
      skins_players:       skinsPlayers,
      nines_players:       ninesPlayers,
      stableford_players:  stablefordPlayers,
      sixes_teams:         sixesTeams,
      sixes_players:       sixesPlayers,
      dots_players:        dotsPlayers,
      dots,
    };
    roundLib.update(roundId, changes);
    if (onSaveEdits) onSaveEdits();
  };

  return (
    <div style={{ minHeight: '100vh', background: '#eef4ee' }}>
      <div style={{ background:G, padding:'8px 16px 7px', position:'sticky', top:0, zIndex:10, boxShadow:'0 2px 12px rgba(0,0,0,.2)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <img src="/logo_lockup.png" alt="The Card" style={{ height:58, width:'auto', display:'block' }} />
        <div style={{ color:'#fff', fontWeight:800, fontSize:16, letterSpacing:'0.12em', textTransform:'uppercase', fontFamily:'inherit' }}>
          {isReload ? 'Edit Round' : 'New Round'}
        </div>
      </div>

      <div style={{ padding: '14px 14px', maxWidth: 520, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: ACTION_BAR_HEIGHT + 16 }}>

        {/* Reload banner */}
        {isReload && (
          <div style={{ background:'#e8f5e8', border:'1.5px solid #a0d0a0', borderRadius:12, padding:'12px 14px' }}>
            <div style={{ fontWeight:700, fontSize:13, color:G, marginBottom:4 }}>Editing Historical Round</div>
            <div style={{ fontSize:12, color:'#555', marginBottom:10 }}>
              Change the date, bets, games, or tee below, then tap <strong>Save Changes</strong> to update without touching scores.
              Or tap <strong>Go to Scorecard</strong> to correct individual scores.
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <Btn onClick={handleSaveEdits} style={{ flex:1 }}>Save Changes</Btn>
              <Btn variant="outline" onClick={handleResumeReload} style={{ flex:1 }}>Go to Scorecard</Btn>
            </div>
          </div>
        )}

        {/* Resume banner */}
        {inProgress && !isReload && (
          <div style={{ background:'#fff9e6', border:'1.5px solid #f0c040', borderRadius:12, padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div style={{ fontSize:13, color:RED, fontWeight:700 }}>Round in progress</div>
            <Btn small onClick={onGoScorecard} style={{ background:RED, color:'#fff', border:'none' }}>Resume →</Btn>
          </div>
        )}

        {/* Date */}
        <Card>
          <div style={{ fontSize:12, fontWeight:700, color:'#666', marginBottom:5 }}>Round Date</div>
          <input
            type="date"
            value={roundDate}
            onChange={e => setRoundDate(e.target.value)}
            style={{ width:'100%', boxSizing:'border-box', border:'1px solid #ddd', borderRadius:8,
              padding:'8px 10px', fontSize:13, fontFamily:'inherit', background:'#fff',
              color:G, fontWeight:600, outline:'none', WebkitAppearance:'none', display:'block' }}
          />
        </Card>

        {/* Course */}
        <CourseCard
          course={course}
          courseFromLib={courseFromLib}
          courseSnapshot={courseSnapshot}
          isReload={isReload}
          allCourses={allCourses}
          frontNine={frontNine}
          backNine={backNine}
          roundStartHole={roundStartHole}
          roundNumHoles={roundNumHoles}
          startHoleDraft={startHoleDraft}
          endHoleDraft={endHoleDraft}
          roundLengthError={roundLengthError}
          setShowCoursePicker={setShowCoursePicker}
          setFrontNine={setFrontNine}
          setBackNine={setBackNine}
          setRoundStartHole={setRoundStartHole}
          setRoundNumHoles={setRoundNumHoles}
          setStartHoleDraft={setStartHoleDraft}
          setEndHoleDraft={setEndHoleDraft}
        />

        {/* Players */}
        <PlayersCard
          activePlayers={activePlayers}
          playerHIs={playerHIs}
          playerTees={playerTees}
          playerCHOverrides={playerCHOverrides}
          selectedTee={selectedTee}
          course={course}
          setShowPlayerPicker={setShowPlayerPicker}
          setPlayerHIs={setPlayerHIs}
          setPlayerTees={setPlayerTees}
          setPlayerCHOverrides={setPlayerCHOverrides}
          setSelectedTee={setSelectedTee}
          computePlayerCH={computePlayerCH}
          activateSetupKp={activateSetupKp}
          activeFieldId={setupKp?.fieldId}
        />

        {/* Women's SI warning — shown when a female player is in the group
            and the course has no handicapsWomen data (Handicap_Contract §8 G-4) */}
        {(() => {
          if (!course) return null;
          const femalePlayers = activePlayers.filter(p => {
            const g = (p.gender || '').toLowerCase().trim();
            return g === 'f' || g === 'female' || g === 'w';
          });
          if (femalePlayers.length === 0) return null;
          if (hasWomenSI) return null;
          const names = femalePlayers.map(p => p.name.split(' ')[0]).join(', ');
          return (
            <div style={{
              background: '#fff8e1', border: '1.5px solid #ffa000',
              borderRadius: 10, padding: '10px 12px',
              fontSize: 12, color: '#e65100', lineHeight: 1.5,
            }}>
              <strong style={{ fontWeight: 700 }}>Women's stroke index missing.</strong>{' '}
              {names}'s handicap strokes will use men's stroke indexes.
              Add women's stroke index data in course settings for accurate allocation.
            </div>
          );
        })()}

        {/* Games */}
        <GamesCard
          activeGames={activeGames}
          activePlayers={activePlayers}
          gameOpts={gameOpts}
          gameBets={gameBets}
          matches={matches}
          dots={dots}
          sixesTeams={sixesTeams}
          gameRanges={gameRanges}
          roundStartHole={roundStartHole}
          roundNumHoles={roundNumHoles}
          strokePlayPlayers={strokePlayPlayers}
          setStrokePlayPlayers={setStrokePlayPlayers}
          skinsPlayers={skinsPlayers}
          setSkinsPlayers={setSkinsPlayers}
          ninesPlayers={ninesPlayers}
          setNinesPlayers={setNinesPlayers}
          stablefordPlayers={stablefordPlayers}
          setStablefordPlayers={setStablefordPlayers}
          dotsPlayers={dotsPlayers}
          setDotsPlayers={setDotsPlayers}
          sixesPlayers={sixesPlayers}
          setSixesPlayers={setSixesPlayers}
          toggleGame={toggleGame}
          setOpt={setOpt}
          setMatches={setMatches}
          setGameBets={setGameBets}
          setDots={setDots}
          setSixesTeams={setSixesTeams}
          setGameRange={setGameRange}
          activateSetupKp={activateSetupKp}
          activeFieldId={setupKp?.fieldId}
        />

        {/* Pinned Start Round button — fixed action bar above nav bar */}
      </div>
      <div style={{ position:'fixed', bottom:NAV_BAR_HEIGHT, left:0, right:0, zIndex:20,
                    background:'#fff', borderTop:'0.5px solid #ddeedd',
                    padding:'10px 14px 12px', maxWidth:520, margin:'0 auto' }}>
        <button onClick={handleStart} disabled={activePlayers.length < 2}
          style={{ width:'100%', background: activePlayers.length < 2 ? '#ccc' : G,
                   color:'#fff', border:'none', borderRadius:14,
                   padding:'15px 20px', fontSize:15, fontWeight:700,
                   cursor: activePlayers.length < 2 ? 'not-allowed' : 'pointer',
                   fontFamily:'inherit' }}>
          {isReload ? 'Re-score Round →' : 'Start Scoring →'}
        </button>
      </div>

      {showPlayerPicker && (
        <PlayerPickerPopup allPlayers={allPlayers} selectedIds={selectedPlayerIds}
          onConfirm={ids=>{setSelectedPlayerIds(ids);setShowPlayerPicker(false);}} onClose={()=>setShowPlayerPicker(false)}/>
      )}
      {showCoursePicker && (
        <CoursePickerPopup
          allCourses={allCourses}
          snapshotCourse={isReload && courseSnapshot && !courseFromLib ? courseSnapshot : null}
          selectedId={selectedCourseId}
          onConfirm={id => { handleCourseSelect(id); setShowCoursePicker(false); }}
          onClose={() => setShowCoursePicker(false)}
        />
      )}

      {/* B-2: Setup keypad — ScoreKeypad_Contract §10.3 */}
      {setupKp && (
        <ScoreKeypad
          containerRef={setupKpRef}
          visible={true}
          value={setupKp.kpValue}
          kpPlus={setupKp.kpPlus}
          mode={setupKp.mode}
          noPlus={setupKp.mode !== 'handicap-decimal' && setupKp.mode !== 'handicap-int'}
          onChange={val => {
            setSetupKp(kp => {
              if (!kp) return null;
              setupKpCbsRef.current.onChange?.(val, kp.kpPlus);
              return { ...kp, kpValue: val };
            });
          }}
          onPlusToggle={() => {
            setSetupKp(kp => {
              if (!kp) return null;
              const newPlus = !kp.kpPlus;
              setupKpCbsRef.current.onChange?.(kp.kpValue, newPlus);
              return { ...kp, kpPlus: newPlus };
            });
          }}
          onBackspace={() => {
            setSetupKp(kp => {
              if (!kp) return null;
              const next = kp.kpValue.slice(0, -1);
              setupKpCbsRef.current.onChange?.(next, kp.kpPlus);
              return { ...kp, kpValue: next };
            });
          }}
          onCommit={() => {
            setupKpCbsRef.current.onCommit?.();
            setSetupKp(null);
          }}
        />
      )}
    </div>
  );
}
