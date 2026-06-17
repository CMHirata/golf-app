// ─── scorecard/ScoreGrid.jsx ──────────────────────────────────────────────────
// ✅ Self-checked (13-G.2): Inline gender-IIFE replaced with players[pi].siArray[h]
// in both interactive and read-only cell renders (Handicap_Contract §5).
// scoreForMode and xGrossScore calls now read per-player siArray with fallback
// to round-shared hcps. Round-shared hcps/hcpsWomen retained for SI display
// header rows only. Bug repro: hole 17 with Aimee receiving 1 stroke via women's
// SI now propagates correctly through grossTotal/netTotal.
//
// RENDER ONLY — no business logic in this file.
// Handles the hole-by-hole score entry grid, long-press dots popup, and
// handicap dot display. All scoring math arrives via props from ScorecardPage.
// See App Data Model Contract §8 for mutation rules.
//
// ✅ Self-checked (13-C.6): Long-press X handler reads (h, pi) from
// `activeKpCellRef.current` (H-19 closure-safe pattern). It does NOT write
// any score — the long-press is a pure departure-intent gesture. The hole
// the user long-pressed on is the FIRST locked hole (their last playable
// hole is h-1), so `departureHole` is passed as `h - 1` to the resolver.
// Edge case: long-press on hole 0 → departureHole = -1, all 18 holes
// lock, resolver still opens (player departed before any hole was played).
//
// ✅ Self-checked (13-C.6 device-test): Locked cells (`–`) are FULLY
// INERT — no listeners, no cursor: pointer, no tap response. Undo gesture
// moved to the player name `<td>`: a 500ms LONG-PRESS on the dimmed name
// fires `onUndoDeparturePrompt(pi)`. The hint text under the name reads
// "hold name to resume" to match the new gesture target. Long-press uses
// dedicated `undoLongPressTimer` / `undoLongPressFired` refs keyed by
// `pi` (not `${h}_${pi}`) since the gesture target is now a single per-
// row element. `scores[h][pi]` for h >= original-longpress-hole is left
// untouched — the visual `–` is rendered by the cell, not stored. No
// engine calls added.
//
// ✅ Self-checked (13-E.4): Extracted depart-prompt inline JSX (~63 lines)
// to DepartPromptModal.jsx. Replaced with `<DepartPromptModal>` taking
// 4 props (`playerName`, `holeNumber`, `onCancel`, `onConfirm`). State
// (`departPrompt` + setter) and both handlers (`handleDepartCancel`,
// `handleDepartConfirmYes`) remain owned here. No state coupling change.

import { useRef, useCallback, useState, useEffect } from 'react';
import { G, BIRDIE_COLOR, BOGEY_COLOR } from '../../components/ui.jsx';
import { strokesForMode, scoreForMode, xGrossScore } from '../../engine/handicap.js';
import { restoreDotDefs, COL_W, TOT_W, NAME_MIN, parRelative } from './scorecardUtils.js';
import { getDotsPartner, getMatchTeamPartner, sixesSegForHole } from '../../engine/games.js';
import { DotsPopup }        from './DotsPopup.jsx';
import { ZoomModal }        from './ZoomModal.jsx';
import { ScoreKeypad }      from '../ScoreKeypad.jsx';
import { DepartPromptModal } from './DepartPromptModal.jsx';
import { NinesTable }       from '../tables/NinesTable.jsx';
import { StablefordTable }  from '../tables/StablefordTable.jsx';
import { SkinsTable }       from '../tables/SkinsTable.jsx';
import { StrokePlayTable }  from '../tables/StrokePlayTable.jsx';
import { MatchNassauTable } from '../tables/MatchNassauTable.jsx';
import { SixesTable }       from '../tables/SixesTable.jsx';
import { DotsTable }        from '../tables/DotsTable.jsx';
import WolfTable            from '../tables/WolfTable.jsx';
import { TotalsCard }       from './TotalsCard.jsx';

// ── PopDots ────────────────────────────────────────────────────────────────────
function PopDots({ courseHcp, hcpRank, minCourseHcp, mode }) {
  const n = strokesForMode(courseHcp, hcpRank, minCourseHcp, mode);
  if (n <= 0) return null;
  return (
    <div style={{ position: 'absolute', bottom: 2, right: 2, display: 'flex', gap: 1.5, pointerEvents: 'none' }}>
      {Array.from({ length: n }).map((_, i) => <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: G }}/>)}
    </div>
  );
}

// ── PlusMark — plus-CH indicator (Handicap_Contract §5.16) ────────────────────
// Shown in score cells where courseHcps[pi] < 0 && hcps[h] <= Math.abs(courseHcps[pi]).
// Mutually exclusive with PopDots — a player either has dots (CH > 0), a + mark
// (CH < 0 on a plus hole), or nothing (CH === 0 or not a plus hole).
function PlusMark() {
  return (
    <div style={{ position: 'absolute', bottom: 2, right: 2, pointerEvents: 'none',
      fontSize: 6, fontWeight: 800, color: G, lineHeight: 1 }}>+</div>
  );
}

// ── DotBadge ───────────────────────────────────────────────────────────────────
function DotBadge({ count }) {
  if (!count) return null;
  return (
    <div style={{
      position: 'absolute', top: -2, right: -2,
      width: 13, height: 13, borderRadius: '50%',
      background: G, color: '#fff',
      fontSize: 7, fontWeight: 800, lineHeight: 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none', zIndex: 2,
    }}>{count}</div>
  );
}

// ── ScoreIndicator — par-relative overlay (§4.11) ─────────────────────────────
// Absolutely-positioned SVG overlaid on a score cell. Stroke-only, no fill.
// level: 'eagle' | 'birdie' | 'bogey' | 'double_bogey' (null / 'par' → no render)
function ScoreIndicator({ level }) {
  if (!level || level === 'par') return null;
  const isBirdie = level === 'birdie' || level === 'eagle';
  const color    = isBirdie ? BIRDIE_COLOR : BOGEY_COLOR;
  const sw       = 1.5;

  // Fixed 26×26 viewBox
  // circles/squares (not stretched ovals). All shapes inset from cell edge
  // so they clear the cell's borderRadius and never touch the border.
  if (level === 'birdie') {
    return (
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }}
           viewBox="0 0 26 26">
        <circle cx="13" cy="13" r="11" stroke={color} strokeWidth={sw} fill="none"/>
      </svg>
    );
  }
  if (level === 'eagle') {
    return (
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }}
           viewBox="0 0 26 26">
        <circle cx="13" cy="13" r="11" stroke={color} strokeWidth={sw} fill="none"/>
        <circle cx="13" cy="13" r="9"  stroke={color} strokeWidth={sw} fill="none"/>
      </svg>
    );
  }
  if (level === 'bogey') {
    return (
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }}
           viewBox="0 0 26 26">
        <rect x="2.5" y="2.5" width="21" height="21" rx="0" ry="0"
          stroke={color} strokeWidth={sw} fill="none"/>
      </svg>
    );
  }
  // double_bogey
  return (
    <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none' }}
         viewBox="0 0 26 26">
      <rect x="2.5" y="2.5" width="21" height="21" rx="0" ry="0"
        stroke={color} strokeWidth={sw} fill="none"/>
      <rect x="4.5" y="4.5" width="17" height="17" rx="0" ry="0"
        stroke={color} strokeWidth={sw} fill="none"/>
    </svg>
  );
}

// ── ScoreGrid ──────────────────────────────────────────────────────────────────
export function ScoreGrid({
  players, pars, hcps, hcpsWomen, courseHcps, minCourseHcp,
  effectiveMinCourseHcp, nonParticipantIdxs,
  scores, setScores,
  dotMode, isMixed, setDotModeOverride,
  nolDotGame, setNolDotGame, nolDotOptions,
  primaryMode, activeGames, gameOpts,
  matches, sixesTeams, strokePlayPlayers, skinsPlayers, stablefordPlayers, ninesPlayers,
  dotsPlayers,
  dots, dotEntries, setDotEntries,
  manualPresses, setManualPresses,
  isLandscape: isLandscapeProp,
  zoomTriggerRef,
  // 13-C.2: Round length — defaults preserve full 18-hole behavior when props
  // are absent. Drives column count, cell navigation bounds, and firstEmptyHole.
  roundStartHole = 0,
  roundNumHoles  = 18,
  // 13-C.3: Per-game hole range overrides — keyed by game name (e.g. 'Skins',
  // 'Stableford') or matchDef.id for individual Match instances. Absent or
  // {} → all games inherit the round range (full no-op). Forwarded down to
  // each table component; tables trim their display to the effective range.
  // Score-entry cells are NOT trimmed by gameRanges — only by the round range.
  gameRanges     = {},
  // 13-C.6: Per-player departure metadata (PartialGameContract §4.5).
  // Shape: { [playerIdx]: { departureHole: number, gameResolutions: {...} } }.
  // When present for player i, score cells for h > departureHole render
  // non-interactive `–`; the player's name <td> is dimmed and accepts a
  // long-press to undo. Absent / {} → no departures (full no-op, byte-
  // identical pre-13-C.6 rendering).
  earlyDepartureOpts = {},
  // 13-C.6: Fired when the user long-presses X and confirms departure via
  // the inline prompt. Parent (ScorecardPage) is responsible for building
  // the resolver-sheet args and opening the sheet.
  //   ({ scenario: 'A', departureHole: number, departedPlayerIdxs: number[] }) => void
  onOpenDepartureResolver,
  // 13-C.7.5 / v2.0: Fired when the user confirms departure but the new
  // event's departureHole would be EARLIER than an existing recorded
  // departure — out-of-order proactive entry per PartialGameContract §8.5.
  // Parent shows ReorderDeparturesModal; on confirm, parent executes the
  // clear-and-replay flow per §8.6 (clear conflicting earlyDepartureOpts
  // entries and re-fire sequenced resolver chain).
  //   ({
  //     newPlayerIdx:             number,
  //     newDepartureHole:         number,
  //     conflictingPlayerIdx:     number,
  //     conflictingDepartureHole: number,
  //   }) => void
  onOpenReorderDeparturesModal,
  // 13-C.6: Fired when the user long-presses the dimmed player name td
  // for a departed player. Parent shows the resume prompt and clears
  // `earlyDepartureOpts[pi]` on confirmation. Locked `–` score cells do
  // not participate in this gesture — they are fully inert.
  //   (pi: number) => void
  onUndoDeparturePrompt,
  // Wolf: per-hole picks, setter, and pre-computed display state
  wolfPicks     = {},
  setWolfPicks,
  wolfState     = null,
}) {
  // 13-C.2: Derived end hole (never stored per PartialGameContract §1A.3, §14.17)
  const roundEndHole = roundStartHole + roundNumHoles - 1;
  // 13-C.2: inRound(h) tells the renderer whether a hole is part of the round.
  // Out-of-round cells within a rendered Front 9 / Back 9 section display as
  // a non-interactive gray cell with an em-dash `–` (invariant #15).
  const inRound = (h) => h >= roundStartHole && h <= roundEndHole;
  // 13-C.2: Front 9 is rendered in full (9 columns) whenever the round contains
  // ANY front-9 hole; same for Back 9. Out-of-round columns within a rendered
  // half display as gray non-interactive cells. This keeps the familiar 9-per-
  // side scorecard layout regardless of round length while honoring the
  // "display `–` for holes not played" invariant. For a full round both halves
  // render and every cell is in-round → identical output to pre-13-C.2.
  const FULL_FRONT = [0,1,2,3,4,5,6,7,8];
  const FULL_BACK  = [9,10,11,12,13,14,15,16,17];
  const anyFrontInRound = roundStartHole <= 8;
  const anyBackInRound  = roundEndHole   >= 9;

  // Gender-aware SI row display (Handicap_Contract §2.7)
  const genders    = players.map(p => (p.gender || '').toLowerCase());
  const hasFemale  = genders.some(g => g === 'f' || g === 'female' || g === 'w');
  const hasMale    = genders.some(g => g !== 'f' && g !== 'female' && g !== 'w');
  const showWomenSI = !!(hcpsWomen && hasFemale);
  const siMLabel   = (hasFemale && hasMale) ? 'M.Hcp' : 'Hcp';
  const siWLabel   = 'W.Hcp';
  const refs  = useRef({});
  const [popup,    setPopup]    = useState(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomHole, setZoomHole] = useState(0);

  // ── ScoreKeypad state (13-B addition) ──────────────────────────────────────
  const [activeKpCell,  setActiveKpCell]  = useState(null); // { h, pi } | null
  const [kpValue,       setKpValue]       = useState('');
  const kpAdvanceTimer  = useRef(null);
  const kpContainerRef  = useRef(null);
  const zoomCardRef     = useRef(null); // attached to ZoomModal card — exempts it from dismiss handler
  const savedKpCellRef  = useRef(null); // saved cell to restore after DotsPopup closes
  const activeKpCellRef = useRef(null); // always-current mirror of activeKpCell for use in closures

  // 13-C.6: Long-press X confirmation prompt — small inline modal asking
  // "Is [Name] done for the round?" with two buttons. Saved cell at the
  // moment the long-press fires so we know who we're asking about.
  const [departPrompt, setDepartPrompt] = useState(null); // { h, pi } | null

  // Wolf pick popup — fires when the user first scores all players on a hole
  // that has no pick yet. { holeIdx, wolfIdx } | null
  const [wolfPickPrompt, setWolfPickPrompt] = useState(null);

  // Keep activeKpCellRef always current — used inside setTimeout closures in startLongPress
  useEffect(() => { activeKpCellRef.current = activeKpCell; }, [activeKpCell]);
  const firstEmptyHole = useCallback(() => {
    // 13-C.2: Search bounded by round. Falls back to last hole of round, not 17.
    for (let h = roundStartHole; h <= roundEndHole; h++) {
      for (let pi = 0; pi < players.length; pi++) {
        const v = scores[h]?.[pi];
        if (v === '' || v == null) return h;
      }
    }
    return roundEndHole;
  }, [scores, players.length, roundStartHole, roundEndHole]);

  const openZoom = useCallback(() => {
    setZoomHole(firstEmptyHole());
    setZoomOpen(true);
  }, [firstEmptyHole]);

  // Expose openZoom to parent (ScorecardPage) for landscape zoom button
  useEffect(() => {
    if (zoomTriggerRef) zoomTriggerRef.current = openZoom;
  }, [openZoom, zoomTriggerRef]);

  const closeZoom = useCallback(() => {
    setZoomOpen(false);
    setActiveKpCell(null);
    setKpValue('');
  }, []);

  // (ZoomModal initial-cell-activation effect moved below openKeypadOnCell's
  // definition — see after openKeypadOnCell — so it can call that function
  // directly without relying on closure timing across the render.)

  // H-4: isLandscape passed from ScorecardPage; fall back to local detection.
  const [isLandscapeLocal, setIsLandscapeLocal] = useState(
    () => typeof window !== 'undefined' && window.innerWidth > window.innerHeight
  );
  useEffect(() => {
    if (isLandscapeProp !== undefined) return;
    const update = () => setIsLandscapeLocal(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [isLandscapeProp]);
  const isLandscape = isLandscapeProp !== undefined ? isLandscapeProp : isLandscapeLocal;

  // Read-only guard: zoom/keypad only available when setScores is provided
  const canZoom = !!setScores;

  // Keypad visible whenever a cell is active. Shows above ZoomModal (zIndex 300 > 200).
  const kpVisible = canZoom && !!activeKpCell;

  const dotsGameActive = activeGames.includes('Dots') || activeGames.includes('Specials');

  const SCORING_SPECIAL_PRIORITY = ['ace', 'condor', 'albatross', 'eagle', 'birdie'];

  const autoMark = useCallback((h, pi, g) => {
    if (!dotsGameActive) return;
    const dtIdxs = dotsPlayers?.length ? dotsPlayers : players.map((_, i) => i);
    if (!dtIdxs.includes(pi)) return;

    const par = pars[h];
    const dotsOpts   = gameOpts?.Dots || gameOpts?.Specials || {};
    const dotScoring = dotsOpts.grossNetNOL ?? dotsOpts.scoring;
    const gNum = parseInt(g) || 0;
    const effectiveScore = (gNum && dotScoring === 'net' && courseHcps && players[pi]?.siArray && minCourseHcp != null)
      ? scoreForMode(gNum, courseHcps[pi], players[pi].siArray[h], minCourseHcp, 'net')
      : gNum || null;

    const rawTeamMode = dotsOpts.teamMode;
    const legacyTeam  = dotsOpts.teamScoring;
    const teamSource  = rawTeamMode && rawTeamMode !== 'none'
      ? rawTeamMode
      : (legacyTeam ? 'Sixes' : 'none');
    const isTeamMode = teamSource !== 'none';
    const getPartner = () => {
      if (teamSource === 'Sixes') return getDotsPartner(pi, sixesSegForHole(h), sixesTeams, players);
      if (teamSource.startsWith('Match:')) {
        const matchId  = teamSource.slice(6);
        const teamMatch = matches?.find(m => m.id === matchId) || matches?.find(m => m.format === 'team');
        return getMatchTeamPartner(pi, teamMatch ? [teamMatch] : []);
      }
      return -1;
    };

    const entryCount = v => typeof v === 'number' ? v : (v === true ? 1 : 0);
    const restoredDots = restoreDotDefs(dots);
    const ens = restoredDots.filter(s => s.enabled);

    setDotEntries(prev => {
      const n = { ...prev };
      const autoSpecials = restoredDots.filter(s => s.enabled && s.auto && s.autoWhen && s.id !== 'team');

      if (!effectiveScore || !par) {
        autoSpecials.forEach(sp => { delete n[`${h}_${pi}_${sp.id}`]; });
      } else {
        const scoringIds = new Set(SCORING_SPECIAL_PRIORITY);
        const nonScoring = autoSpecials.filter(sp => !scoringIds.has(sp.id));
        const scoringCandidates = autoSpecials
          .filter(sp => scoringIds.has(sp.id))
          .sort((a, b) => SCORING_SPECIAL_PRIORITY.indexOf(a.id) - SCORING_SPECIAL_PRIORITY.indexOf(b.id));

        const winner = scoringCandidates.find(sp => sp.autoWhen(effectiveScore, par));

        scoringCandidates.forEach(sp => {
          const key = `${h}_${pi}_${sp.id}`;
          if (sp === winner) n[key] = 1;
          else delete n[key];
        });

        nonScoring.forEach(sp => {
          const key = `${h}_${pi}_${sp.id}`;
          if (sp.autoWhen(effectiveScore, par)) n[key] = 1;
          else delete n[key];
        });
      }

      // Always delete ALL stale companion entries written by pi on hole h,
      // regardless of which receiver they point to. This cleans up orphaned
      // companions from a previous teamMode (e.g. Sixes→Match transition).
      Object.keys(n).forEach(key => {
        const parts = key.split('_');
        if (parts[2] === 'team' && parts.length > 3 &&
            parseInt(parts[0]) === h &&
            parseInt(parts[parts.length - 1]) === pi) {
          delete n[key];
        }
      });

      if (isTeamMode) {
        const partnerIdx = getPartner();
        if (partnerIdx >= 0) {
          const compKey = `${h}_${partnerIdx}_team_dot_for_${pi}`;
          let total = 0;
          Object.entries(n).forEach(([key, v]) => {
            const cnt = entryCount(v);
            if (!cnt) return;
            const parts = key.split('_');
            if (parseInt(parts[0]) !== h || parseInt(parts[1]) !== pi) return;
            if (parts[2] === 'team') return;
            const sp = ens.find(s => s.id === parts.slice(2).join('_'));
            if (sp) total += cnt;
          });
          if (total > 0) n[compKey] = total; else delete n[compKey];
        }
      }

      return n;
    });
  }, [pars, hcps, courseHcps, minCourseHcp, dots, dotsGameActive, gameOpts,
      dotsPlayers, players, sixesTeams, matches, setDotEntries]);

  useEffect(() => {
    if (!dotsGameActive) return;
    const dtIdxs = dotsPlayers?.length ? dotsPlayers : players.map((_, i) => i);
    for (let h = 0; h < 18; h++) {
      dtIdxs.forEach(pi => {
        const g = parseInt(scores[h]?.[pi]);
        if (g) autoMark(h, pi, g);
      });
    }
  }, [dotsGameActive]); // eslint-disable-line react-hooks/exhaustive-deps

  const longPressTimer = useRef({});
  const longPressFired = useRef({}); // tracks cells where long-press completed

  // 13-C.6: Refs for the player-name long-press undo gesture. Keyed by
  // player index `pi` (one row per player). Distinct from the dots long-
  // press refs above because the target element is the name td, not a
  // score cell — they cannot conflict.
  const undoLongPressTimer = useRef({});
  const undoLongPressFired = useRef({});

  const startLongPress = (h, pi) => {
    if (dotsGameActive) {
      const dtIdxs = dotsPlayers?.length ? dotsPlayers : players.map((_, i) => i);
      if (!dtIdxs.includes(pi)) return;
    }
    const key = `${h}_${pi}`;
    longPressFired.current[key] = false;
    longPressTimer.current[key] = setTimeout(() => {
      longPressFired.current[key] = true;
      // Save and hide the keypad while DotsPopup is open
      savedKpCellRef.current = activeKpCellRef.current;
      setActiveKpCell(null);
      setKpValue('');
      setPopup({ hole: h, pi });
    }, 500);
  };

  const cancelLongPress = (h, pi) => {
    const key = `${h}_${pi}`;
    if (longPressTimer.current[key]) {
      clearTimeout(longPressTimer.current[key]);
      delete longPressTimer.current[key];
    }
  };

  // ── Legacy keyboard advance (for any remaining input elements) ─────────────
  const advanceRef = useRef(null);
  advanceRef.current = (h, pi) => {
    const npi = pi + 1 < players.length ? pi + 1 : 0;
    const nh  = pi + 1 < players.length ? h : h + 1;
    if (nh < 18) {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const el = refs.current[`${nh}_${npi}`];
        if (el) { el.focus(); try { el.select(); } catch (_) {} }
      }));
    }
  };

  const advanceTimer = useRef(null);
  const scheduleAdvance = useCallback((h, pi, firstDigit) => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    if (firstDigit === '1') {
      advanceTimer.current = setTimeout(() => { advanceTimer.current = null; advanceRef.current(h, pi); }, 700);
    } else {
      advanceRef.current(h, pi);
    }
  }, []);

  const cancelAdvance = useCallback(() => {
    if (advanceTimer.current) { clearTimeout(advanceTimer.current); advanceTimer.current = null; }
  }, []);

  const pendingAdvance = useRef(null);

  const handleKeyDown = useCallback((h, pi, e) => {
    if ((e.key === 'Enter' || e.key === 'Tab') && !e.shiftKey) {
      e.preventDefault(); cancelAdvance(); advanceRef.current(h, pi); return;
    }
    if (e.key === 'Backspace') {
      cancelAdvance();
      const cur = scores[h]?.[pi];
      if (cur === '' || cur == null || cur === 0) {
        e.preventDefault();
        const ppi = pi - 1 >= 0 ? pi - 1 : players.length - 1;
        const ph  = pi - 1 >= 0 ? h : h - 1;
        if (ph >= 0) {
          requestAnimationFrame(() => requestAnimationFrame(() => {
            const el = refs.current[`${ph}_${ppi}`];
            if (el) { el.focus(); try { el.select(); } catch (_) {} }
          }));
        }
      }
      return;
    }
    if (/^[1-9]$/.test(e.key)) {
      const curVal = String(scores[h]?.[pi] ?? '');
      if (curVal === '1') cancelAdvance();
      pendingAdvance.current = { h, pi, key: e.key };
      const el = refs.current[`${h}_${pi}`];
      if (el && el.selectionStart === 0 && el.selectionEnd === el.value.length && e.key === curVal) {
        e.preventDefault();
        const v = parseInt(e.key);
        setScores(prev => { const n = prev.map(r => [...r]); n[h][pi] = v; return n; });
        if (v) autoMark(h, pi, v);
        scheduleAdvance(h, pi, e.key);
        pendingAdvance.current = null;
      }
    }
  }, [players.length, scores, autoMark, scheduleAdvance, cancelAdvance]);

  const handleScore = (h, pi, val) => {
    // Allow 'X' through directly — do not strip via digit-only filter
    if (val === 'X') {
      setScores(prev => { const n = prev.map(r => [...r]); n[h][pi] = 'X'; return n; });
      // X does not auto-mark dots
      return;
    }
    const digits  = val.replace(/[^0-9]/g, '');
    let effective;
    if (digits.length === 2 && digits[0] === '1') effective = digits;
    else if (digits.length > 1) effective = digits[0];
    else effective = digits;
    const v = effective === '' ? '' : Math.max(1, Math.min(15, parseInt(effective) || 0));
    setScores(prev => { const n = prev.map(r => [...r]); n[h][pi] = v; return n; });
    autoMark(h, pi, v);
    if (effective !== '' && pendingAdvance.current?.h === h && pendingAdvance.current?.pi === pi) {
      const firstDigit = pendingAdvance.current.key;
      pendingAdvance.current = null;
      if (digits.length === 2) { cancelAdvance(); advanceRef.current(h, pi); }
      else scheduleAdvance(h, pi, firstDigit);
    }
  };

  const dotsScoringMode = ((gameOpts?.Dots || gameOpts?.Specials || {})).grossNetNOL ?? ((gameOpts?.Dots || gameOpts?.Specials || {})).scoring ?? 'gross';
  useEffect(() => {
    if (!dotsGameActive) return;
    const dtIdxs = dotsPlayers?.length ? dotsPlayers : players.map((_, i) => i);
    for (let h = 0; h < 18; h++) {
      dtIdxs.forEach(pi => {
        const g = parseInt(scores[h]?.[pi]);
        autoMark(h, pi, g || 0);
      });
    }
  }, [dotsScoringMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // X scores contribute xGrossScore (par+2+strokes), matching TotalsCard §7.2.
  // parseInt('X') = NaN which silently dropped X holes from totals before this fix.
  // 13-G.2: xGrossScore takes per-player siArray; scoreForMode rank reads from same.
  const grossTotal = (pi, hs) => hs.reduce((s, h) => {
    const raw = scores[h]?.[pi];
    const siA = players[pi]?.siArray || hcps;
    if (raw === 'X') return s + xGrossScore(h, courseHcps[pi], siA, pars);
    return s + (parseInt(raw) || 0);
  }, 0);
  const netTotal   = (pi, hs) => hs.reduce((s, h) => {
    const raw = scores[h]?.[pi];
    if (raw === '' || raw == null) return s;
    const siA = players[pi]?.siArray || hcps;
    const g = raw === 'X' ? xGrossScore(h, courseHcps[pi], siA, pars) : parseInt(raw);
    return g ? s + (scoreForMode(g, courseHcps[pi], siA[h], minCourseHcp, primaryMode) || 0) : s;
  }, 0);
  const parTotal   = hs => hs.reduce((s, h) => s + (pars[h] || 0), 0);

  const sc = (h, pi) => {
    if (!dotsGameActive) return 0;
    const rs = restoreDotDefs(dots);
    const entryCount = v => typeof v === 'number' ? v : (v === true ? 1 : 0);
    return rs.filter(s => s.enabled && s.id !== 'team').reduce((sum, s) => {
      return sum + entryCount(dotEntries[`${h}_${pi}_${s.id}`]);
    }, 0);
  };

  // ── ScoreKeypad callbacks (13-B addition) ──────────────────────────────────

  // Cancel the keypad advance timer
  const cancelKpAdvance = useCallback(() => {
    if (kpAdvanceTimer.current) { clearTimeout(kpAdvanceTimer.current); kpAdvanceTimer.current = null; }
  }, []);

  // Open keypad on a specific cell — always seeds kpValue='' (H-16)
  const openKeypadOnCell = useCallback((h, pi) => {
    cancelKpAdvance();
    // Wolf intercept: manual tap on pi===0 — show pick popup before keypad.
    // Auto-advance path is handled inside kpAdvanceCell at hole boundary.
    // wolfIdx is read from the engine-computed wolfState (handles lastTwoHoles
    // fairness modes correctly) rather than recomputing rotation here.
    if (pi === 0 && activeGames?.includes('Wolf') && setWolfPicks) {
      const engineHole = wolfState?.holes?.[h];
      const skipped = engineHole?.skipped;
      if (!skipped) {
        const wolfIdx = engineHole?.wolfIdx ?? (gameOpts?.Wolf?.wolfOrder || [0,1,2,3])[h % 4];
        setActiveKpCell(null);
        setKpValue('');
        setWolfPickPrompt({ holeIdx: h, wolfIdx, resumeCell: { h, pi: 0 } });
        return;
      }
      // Skipped hole — no popup, open keypad directly
    }
    setActiveKpCell({ h, pi });
    setKpValue('');
  }, [cancelKpAdvance, activeGames, gameOpts, setWolfPicks, wolfState]);

  // When ZoomModal opens, activate the first empty cell on the target hole.
  // Deferred by one tick so the dismiss handler (touchend) doesn't immediately
  // clear it (the zoom button tap fires touchend after setZoomOpen).
  // Routed through openKeypadOnCell (not setActiveKpCell directly) so the
  // Wolf pick popup intercept fires correctly when targetPi === 0 — this is
  // what makes the popup open on Hole 1 when ZoomModal defaults there on
  // round start, matching the auto-advance and manual-tap paths.
  useEffect(() => {
    if (!zoomOpen) return;
    const timer = setTimeout(() => {
      let targetPi = 0;
      for (let pi = 0; pi < players.length; pi++) {
        const v = scores[zoomHole]?.[pi];
        if (v === '' || v == null) { targetPi = pi; break; }
      }
      openKeypadOnCell(zoomHole, targetPi);
    }, 0);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomOpen]);

  // iOS click-suppression: track when touchend handled a tap so the
  // synthetic click that follows ~300ms later is ignored. preventDefault()
  // alone is unreliable in React 18 because touch listeners attach as passive.
  const touchHandledRef = useRef(0);

  // Advance to next cell after a score is committed
  const kpAdvanceCell = useCallback((h, pi) => {
    const npi = pi + 1 < players.length ? pi + 1 : 0;
    const nh  = pi + 1 < players.length ? h : h + 1;
    // 13-C.2: Cannot advance past the last hole of the round.
    if (nh > roundEndHole) {
      setActiveKpCell(null);
      setKpValue('');
      return;
    }
    // Wolf: when crossing into a new hole (nh !== h), show pick popup instead
    // of opening keypad. resumeKeypad restores activeKpCell after pick.
    // wolfIdx read from engine-computed wolfState (handles lastTwoHoles modes).
    if (nh !== h && activeGames?.includes('Wolf') && setWolfPicks) {
      const engineHole = wolfState?.holes?.[nh];
      const skipped = engineHole?.skipped;
      if (!skipped) {
        const wolfIdx = engineHole?.wolfIdx ?? (gameOpts?.Wolf?.wolfOrder || [0,1,2,3])[nh % 4];
        setZoomHole(nh);
        setActiveKpCell(null);
        setKpValue('');
        setWolfPickPrompt({ holeIdx: nh, wolfIdx, resumeCell: { h: nh, pi: 0 } });
        return;
      }
      // Skipped hole — fall through to open keypad directly
    }
    // Keep ZoomModal centred on the active hole when crossing a hole boundary
    if (nh !== h) setZoomHole(nh);
    setActiveKpCell({ h: nh, pi: npi });
    setKpValue('');
  }, [players.length, setZoomHole, roundEndHole, activeGames, gameOpts, setWolfPicks, wolfState]);

  // Retreat to prior cell
  const kpRetreatCell = useCallback((h, pi) => {
    const ppi = pi - 1 >= 0 ? pi - 1 : players.length - 1;
    const ph  = pi - 1 >= 0 ? h : h - 1;
    // 13-C.2: Cannot retreat before the first hole of the round.
    if (ph < roundStartHole) return;
    // Keep ZoomModal centred on the active hole when crossing a hole boundary
    if (ph !== h) setZoomHole(ph);
    setActiveKpCell({ h: ph, pi: ppi });
    setKpValue('');
  }, [players.length, setZoomHole, roundStartHole]);

  // Schedule advance after entry — immediate for all except '1' (700ms window)
  const scheduleKpAdvance = useCallback((h, pi, val) => {
    cancelKpAdvance();
    if (val === '1') {
      kpAdvanceTimer.current = setTimeout(() => {
        kpAdvanceTimer.current = null;
        kpAdvanceCell(h, pi);
      }, 700);
    } else {
      kpAdvanceCell(h, pi);
    }
  }, [cancelKpAdvance, kpAdvanceCell]);

  // Keypad onChange — called for every digit and 'X'
  const handleKpChange = useCallback((newVal) => {
    if (!activeKpCell) return;
    const { h, pi } = activeKpCell;

    if (newVal === 'X') {
      // Write 'X' immediately and advance
      setKpValue('X');
      setScores(prev => { const n = prev.map(r => [...r]); n[h][pi] = 'X'; return n; });
      scheduleKpAdvance(h, pi, 'X');
      return;
    }

    // Digit string — interpret as score
    const digits = newVal.replace(/[^0-9]/g, '');
    let effective;
    if (digits.length === 2 && digits[0] === '1') effective = digits;
    else if (digits.length > 1) effective = digits[0];
    else effective = digits;

    const committed = effective === '' ? '' : Math.max(1, Math.min(15, parseInt(effective) || 0));
    setKpValue(effective); // show in-progress value in cell
    if (committed !== '') {
      setScores(prev => { const n = prev.map(r => [...r]); n[h][pi] = committed; return n; });
      autoMark(h, pi, committed);
      // Two-digit score: advance immediately. Single-digit '1': wait 700ms.
      const advanceKey = digits.length >= 2 ? '2' : (digits[0] || '');
      scheduleKpAdvance(h, pi, advanceKey);
    }
  }, [activeKpCell, setScores, autoMark, scheduleKpAdvance]);

  // Keypad onBackspace
  const handleKpBackspace = useCallback(() => {
    if (!activeKpCell) return;
    const { h, pi } = activeKpCell;
    cancelKpAdvance();

    if (kpValue.length > 0) {
      // Remove last char from in-progress value
      const next = kpValue.slice(0, -1);
      setKpValue(next);
      if (next === '') {
        // In-progress cleared — also clear committed score
        setScores(prev => { const n = prev.map(r => [...r]); n[h][pi] = ''; return n; });
        autoMark(h, pi, 0);
      } else {
        const v = Math.max(1, Math.min(15, parseInt(next) || 0));
        setScores(prev => { const n = prev.map(r => [...r]); n[h][pi] = v; return n; });
        autoMark(h, pi, v);
      }
    } else {
      // kpValue already empty
      const committed = scores[h]?.[pi];
      if (committed !== '' && committed != null) {
        // Clear committed score, stay on cell
        setScores(prev => { const n = prev.map(r => [...r]); n[h][pi] = ''; return n; });
        autoMark(h, pi, 0);
      } else {
        // Cell empty — retreat
        kpRetreatCell(h, pi);
      }
    }
  }, [activeKpCell, kpValue, scores, setScores, autoMark, cancelKpAdvance, kpRetreatCell]);

  // Dismiss keypad on outside tap — exempts INPUT elements, keypad container, and ZoomModal card
  useEffect(() => {
    if (!kpVisible) return;
    const handler = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (kpContainerRef.current?.contains(e.target)) return;
      if (zoomCardRef.current?.contains(e.target)) return;
      cancelKpAdvance();
      setActiveKpCell(null);
      setKpValue('');
    };
    document.addEventListener('touchend', handler, { capture: true });
    return () => document.removeEventListener('touchend', handler, { capture: true });
  }, [kpVisible, cancelKpAdvance]);

  // ── 13-C.6: Long-press X handler ───────────────────────────────────────────
  // ScoreKeypad fires `onLongPressX()` with no args when X is held for 600ms.
  // We read the active cell from `activeKpCellRef.current` (H-19 closure-safe
  // pattern — never read activeKpCell directly here; the ref-mirror is the
  // only source guaranteed current at fire time).
  //
  // Behavior per PartialGameContract §8.2 (v1.9):
  //   - The long-press is a pure DEPARTURE-INTENT gesture. No score is
  //     written for hole h. The user enters the hole's score normally
  //     afterward if relevant. (Earlier contract revisions said to save 'X'
  //     immediately; this was corrected in 13-C.6 because the long-press
  //     expresses "I'm leaving," not "I picked up on this hole.")
  //   - Show confirmation prompt with two buttons:
  //       Cancel               → close prompt; no further action
  //       Yes, [Name] is leaving → call parent's onOpenDepartureResolver
  //
  // The keypad is hidden while the prompt is open so the user can see the
  // prompt without the keypad on top of it.
  const handleLongPressX = useCallback(() => {
    const cell = activeKpCellRef.current;
    if (!cell) return;
    const { h, pi } = cell;

    // Hide keypad before the prompt mounts. No score is written.
    cancelKpAdvance();
    setActiveKpCell(null);
    setKpValue('');

    // Open the confirmation prompt. The prompt's "Yes" branch will read
    // (h, pi) back out of departPrompt to fire the parent's resolver-open
    // callback with the right departureHole and departedPlayerIdxs.
    setDepartPrompt({ h, pi });
  }, [cancelKpAdvance]);

  // Cancel — close prompt; no further action. The hole's score remains
  // whatever it was before the long-press (typically blank).
  const handleDepartCancel = useCallback(() => {
    setDepartPrompt(null);
  }, []);

  // "Yes, [Name] is leaving" — close prompt, fire parent's resolver-open
  // callback with scenario='A' and the single departed player's index.
  //
  // departureHole semantics (per Resolver_UI_Spec §8.2 step 3, amended in
  // 13-C.6 device testing):
  //   When the user long-presses X on hole h, hole h is the FIRST locked
  //   hole — the player did not play h. Their last playable hole is h-1.
  //   So we pass `departureHole = h - 1`. The locked-cell render check
  //   `cell_h > departureHole` then locks h itself (h > h-1) and all
  //   later holes.
  //
  // Edge case: long-press on hole 0 → departureHole = -1. This represents
  // "departed before any hole was played" — a real scenario (player
  // no-shows after the round started). All 18 holes lock; the resolver
  // sheet opens and offers Abandon for every game. No special-casing.
  //
  // 13-C.7.5 / v2.0 amendment: Out-of-order detection per
  // PartialGameContract §8.5. If any OTHER player in earlyDepartureOpts
  // has a recorded departureHole strictly LATER than this new event's
  // departureHole (h - 1), we cannot proceed with normal sequenced
  // entry — the chronological order would be violated. Fire the
  // ReorderDeparturesModal instead; the parent (ScorecardPage) handles
  // the clear-and-replay flow on confirm. We pass the conflicting
  // earlier-vs-later context up to the parent for modal display + the
  // pending event so the parent can re-fire the chain after clearing.
  const handleDepartConfirmYes = useCallback(() => {
    if (!departPrompt) return;
    const { h, pi } = departPrompt;
    const newDepartureHole = h - 1;

    // Look for an existing event whose departureHole is strictly LATER
    // than the new one. If found, this is a Reorder Departures case.
    let conflict = null;
    Object.entries(earlyDepartureOpts || {}).forEach(([piStr, entry]) => {
      const otherPi = Number(piStr);
      if (otherPi === pi) return; // shouldn't happen — same player long-pressed twice
      if (!entry || typeof entry.departureHole !== 'number') return;
      if (entry.departureHole > newDepartureHole) {
        // Track the earliest conflict (the player whose departure is
        // closest to our new event but still later). Multiple conflicts
        // are all resolved by the same clear-and-replay; we display the
        // earliest one in the modal text.
        if (!conflict || entry.departureHole < conflict.departureHole) {
          conflict = { pi: otherPi, departureHole: entry.departureHole };
        }
      }
    });

    setDepartPrompt(null);

    if (conflict) {
      // Out-of-order — fire the Reorder Departures modal via the parent
      // callback. The parent owns the clear-and-replay execution per
      // PartialGameContract §8.6.
      onOpenReorderDeparturesModal?.({
        newPlayerIdx:        pi,
        newDepartureHole,
        conflictingPlayerIdx: conflict.pi,
        conflictingDepartureHole: conflict.departureHole,
      });
      return;
    }

    // Normal path — proactive single-event entry.
    onOpenDepartureResolver?.({
      scenario: 'A',
      departureHole: newDepartureHole,
      departedPlayerIdxs: [pi],
    });
  }, [departPrompt, onOpenDepartureResolver, onOpenReorderDeparturesModal, earlyDepartureOpts]);

  // ── 13-C.6: Player-name long-press for undo ────────────────────────────────
  // The dimmed name `<td>` for a departed player accepts a 500ms long-press
  // to fire `onUndoDeparturePrompt(pi)`. Locked `–` score cells are inert
  // — this is the only undo gesture target. Refs keyed by `pi` (one per
  // row). Returns a memoized handler bundle from a closure so we don't
  // recreate functions on every render.
  const startUndoNameLongPress = useCallback((pi) => {
    undoLongPressFired.current[pi] = false;
    undoLongPressTimer.current[pi] = setTimeout(() => {
      undoLongPressFired.current[pi] = true;
      onUndoDeparturePrompt?.(pi);
    }, 500);
  }, [onUndoDeparturePrompt]);

  const cancelUndoNameLongPress = useCallback((pi) => {
    if (undoLongPressTimer.current[pi]) {
      clearTimeout(undoLongPressTimer.current[pi]);
      delete undoLongPressTimer.current[pi];
    }
  }, []);

  // ── renderCell — replaces inline <input> in both renderHalf and renderLandscape
  // Renders a tappable div that opens the keypad on tap, long-presses for dots.
  // NX display: X scores show as "{xGross}X" with amber X and #fffbe6 background.
  // 13-C.2: Out-of-round cells render as a non-interactive gray cell with `–`.
  const renderCell = (h, pi, fontSize = 13, padding = '5px 0') => {
    const vertPad = (() => {
      const m = String(padding).match(/^(\d+(?:\.\d+)?)/);
      return m ? parseFloat(m[1]) * 2 : 10;
    })();
    const cellHeight = Math.round(fontSize * 1.2) + vertPad + 2;

    // 13-C.2: Out-of-round hole — gray, non-interactive, empty (no `–` char).
    // Owner preference: gray cell is a sufficient visual signal; character would
    // clash with scorecard readability. Par and M.Hcp rows keep their real values
    // (they're handled in renderHalf/renderLandscape, not here).
    if (!inRound(h)) {
      return (
        <div style={{ position: 'relative' }}>
          <div style={{
            width: '100%', boxSizing: 'border-box',
            border: '1px solid #e0e0e0',
            borderRadius: 4,
            textAlign: 'center',
            fontSize,
            fontFamily: 'inherit',
            background: '#e8e8e8',
            color: '#aaa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: cellHeight,
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}/>
        </div>
      );
    }

    // 13-C.6: Post-departure hole — player marked as departed and h is past
    // their `departureHole`. Renders `–` fully INERT — no listeners, no
    // cursor, no tap response. The undo gesture lives on the player name
    // td (long-press the dimmed name to bring up the resume prompt).
    //
    // Visually distinct from out-of-round (which is empty/gray) — this is
    // the player-level lock per PartialGameContract §5.5 / §8.3. The actual
    // stored `scores[h][pi]` value is left as-is — usually '' but possibly
    // a real score if the user entered one before invoking departure. We
    // do not write '-' or 'X' to storage; the visual is rendered here.
    const dep = earlyDepartureOpts?.[pi];
    if (dep && Number.isInteger(dep.departureHole) && h > dep.departureHole) {
      return (
        <div style={{ position: 'relative' }}>
          <div
            style={{
              width: '100%', boxSizing: 'border-box',
              border: '1px solid #d8d8d8',
              borderRadius: 4,
              textAlign: 'center',
              fontSize,
              fontFamily: 'inherit',
              background: '#f0f0f0',
              color: '#999',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: cellHeight,
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }}
          >–</div>
        </div>
      );
    }

    const dotCount  = sc(h, pi);
    const val       = scores[h]?.[pi] ?? '';
    const isX       = val === 'X';
    const isActive  = activeKpCell?.h === h && activeKpCell?.pi === pi;
    // In-progress kpValue display: show kpValue while this cell is active and user is mid-entry
    const displayVal = isActive && kpValue !== '' ? kpValue : (isX ? null : (val !== '' ? val : ''));

    const siA = players[pi]?.siArray || hcps;
    const xGross = isX ? xGrossScore(h, courseHcps[pi], siA, pars) : null;

    const cellStyle = {
      width: '100%', boxSizing: 'border-box',
      border: isActive ? `2px solid ${G}` : '1px solid #ddd',
      borderRadius: 4,
      textAlign: 'center',
      fontSize,
      fontFamily: 'inherit',
      background: isX ? '#fffbe6' : '#fff',
      color: '#222',
      outline: 'none',
      WebkitAppearance: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: cellHeight,
      cursor: canZoom ? 'pointer' : 'default',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      position: 'relative',
    };

    if (!canZoom) {
      // Read-only — plain div, no interaction
      return (
        <div style={{ position: 'relative' }}>
          <div style={cellStyle}>
            {isX ? (
              <>{xGross}<span style={{ color: '#b8860b', fontWeight: 800, marginLeft: 1 }}>X</span></>
            ) : displayVal}
          </div>
          {!isX && <ScoreIndicator level={parRelative(val, pars[h])}/>}
          <DotBadge count={dotCount}/>
          {dotMode && !(dotMode === 'netofflow' && nonParticipantIdxs?.has(pi)) && (() => {
            const ch = courseHcps[pi];
            // 13-G.2: per-player SI from players[pi].siArray (Handicap_Contract §5).
            // Fallback to round-shared hcps for any legacy player object lacking siArray.
            const siRank = siA[h] ?? hcps[h];
            if (ch < 0 && siRank > 18 - Math.abs(ch)) return <PlusMark/>;
            if (ch > 0) return <PopDots courseHcp={ch} hcpRank={siRank}
              minCourseHcp={dotMode === 'netofflow' ? effectiveMinCourseHcp : minCourseHcp}
              mode={dotMode}/>;
            return null;
          })()}
        </div>
      );
    }

    return (
      <div style={{ position: 'relative' }}>
        <div
          style={cellStyle}
          onClick={e => {
            // Suppress the synthetic click that iOS fires ~300ms after touchend.
            // (preventDefault on touchend is unreliable in React 18.)
            if (Date.now() - touchHandledRef.current < 600) return;
            openKeypadOnCell(h, pi);
          }}
          onTouchStart={() => startLongPress(h, pi)}
          onTouchEnd={(e) => {
            e.preventDefault();
            touchHandledRef.current = Date.now();
            const fired = longPressFired.current[`${h}_${pi}`];
            cancelLongPress(h, pi);
            if (!fired) openKeypadOnCell(h, pi);
          }}
          onTouchMove={() => cancelLongPress(h, pi)}
        >
          {isX ? (
            <>{xGross}<span style={{ color: '#b8860b', fontWeight: 800, marginLeft: 1 }}>X</span></>
          ) : displayVal}
        </div>
        {!isX && <ScoreIndicator level={parRelative(val, pars[h])}/>}
        <DotBadge count={dotCount}/>
        {dotMode && !(dotMode === 'netofflow' && nonParticipantIdxs?.has(pi)) && (() => {
          const ch = courseHcps[pi];
          // 13-G.2: per-player SI from players[pi].siArray (Handicap_Contract §5).
          const siRank = siA[h] ?? hcps[h];
          if (ch < 0 && siRank > 18 - Math.abs(ch)) return <PlusMark/>;
          if (ch > 0) return <PopDots courseHcp={ch} hcpRank={siRank}
            minCourseHcp={dotMode === 'netofflow' ? effectiveMinCourseHcp : minCourseHcp}
            mode={dotMode}/>;
          return null;
        })()}
      </div>
    );
  };

  // ── Zoom button — SVG magnifier ────────────────────────────────────────────
  const ZoomBtn = () => (
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 2, paddingRight: 2 }}>
      <button
        onClick={openZoom}
        title="Open zoom score entry"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '2px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        aria-label="Zoom score entry"
      >
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="7.5" stroke={G} strokeWidth="2.2"/>
          <line x1="17.8" y1="17.8" x2="24" y2="24" stroke={G} strokeWidth="2.4" strokeLinecap="round"/>
          <line x1="9" y1="12" x2="15" y2="12" stroke={G} strokeWidth="1.8" strokeLinecap="round"/>
          <line x1="12" y1="9" x2="12" y2="15" stroke={G} strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );

  const renderHalf = (hs, halfLabel, showZoom = false) => {
    const inRoundHs = hs.filter(inRound);
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
          <div style={{ fontWeight: 700, color: G, fontSize: 12 }}>{halfLabel}</div>
          {canZoom && showZoom && <ZoomBtn />}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%', minWidth: NAME_MIN + hs.length * COL_W + TOT_W }}>
            <colgroup>
              <col/>
              {hs.map(h => <col key={h} style={{ width: COL_W }}/>)}
              <col style={{ width: TOT_W }}/>
            </colgroup>
            <thead><tr>
              <th style={{ padding: '4px 4px', background: '#f0f4f0', color: '#555', fontSize: 10, textAlign: 'left' }}></th>
              {hs.map(h => <th key={h} style={{ padding: '3px 1px', background: '#f0f4f0', color: '#555', fontSize: 10, textAlign: 'center' }}>{h + 1}</th>)}
              <th style={{ padding: '3px 3px', background: '#f0f4f0', color: '#555', fontSize: 10, textAlign: 'center' }}>Total</th>
            </tr></thead>
            <tbody>
              <tr>
                <td style={{ padding: '2px 6px', fontSize: 10, color: G, fontWeight: 700, background: '#f8fbf8' }}>Par</td>
                {hs.map(h => <td key={h} style={{ textAlign: 'center', fontSize: 10, color: G, fontWeight: 600, background: '#f8fbf8' }}>{pars[h]}</td>)}
                <td style={{ textAlign: 'center', fontSize: 10, color: G, fontWeight: 700, background: '#f8fbf8' }}>{parTotal(inRoundHs)}</td>
              </tr>
              <tr>
                <td style={{ padding: '1px 6px', fontSize: 9, color: '#aaa', fontWeight: 600, background: '#fafcfa' }}>{siMLabel}</td>
                {hs.map(h => <td key={h} style={{ textAlign: 'center', fontSize: 9, color: '#ccc', background: '#fafcfa' }}>{hcps[h]}</td>)}
                <td/>
              </tr>
              {showWomenSI && (
                <tr>
                  <td style={{ padding: '1px 6px', fontSize: 9, color: '#c2185b', fontWeight: 600, background: '#fafcfa' }}>{siWLabel}</td>
                  {hs.map(h => <td key={h} style={{ textAlign: 'center', fontSize: 9, color: '#e8a0b8', background: '#fafcfa' }}>{hcpsWomen[h]}</td>)}
                  <td/>
                </tr>
              )}
              {players.map((p, pi) => {
                const gt9 = grossTotal(pi, inRoundHs);
                const nt9 = netTotal(pi, inRoundHs);
                // 13-C.6: Dim name <td> when player is marked as departed.
                // Show a subtle hint underneath telling the user how to undo.
                const isDeparted = !!earlyDepartureOpts?.[pi];
                return <tr key={pi} style={{ background: pi % 2 === 0 ? '#fff' : '#f5fbf5' }}>
                  <td
                    onTouchStart={isDeparted ? () => startUndoNameLongPress(pi) : undefined}
                    onTouchEnd={isDeparted ? () => cancelUndoNameLongPress(pi) : undefined}
                    onTouchMove={isDeparted ? () => cancelUndoNameLongPress(pi) : undefined}
                    onTouchCancel={isDeparted ? () => cancelUndoNameLongPress(pi) : undefined}
                    onMouseDown={isDeparted ? () => startUndoNameLongPress(pi) : undefined}
                    onMouseUp={isDeparted ? () => cancelUndoNameLongPress(pi) : undefined}
                    onMouseLeave={isDeparted ? () => cancelUndoNameLongPress(pi) : undefined}
                    style={{
                      padding: '2px 4px', fontSize: 11, fontWeight: 600,
                      color: isDeparted ? '#999' : '#333',
                      opacity: isDeparted ? 0.55 : 1,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      lineHeight: 1.15,
                      cursor: isDeparted ? 'pointer' : 'default',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                  }}>
                    {p.name}
                    {isDeparted && (
                      <div style={{ fontSize: 8, fontWeight: 500, color: '#999', marginTop: 1, letterSpacing: 0.3 }}>
                        hold name to resume
                      </div>
                    )}
                  </td>
                  {hs.map(h => (
                    <td key={h} style={{ padding: 1, position: 'relative' }}>
                      {renderCell(h, pi, 13, '5px 0')}
                    </td>
                  ))}
                  <td style={{ textAlign: 'center', fontWeight: 700, color: '#222', fontSize: 11, padding: '2px 4px', whiteSpace: 'nowrap', lineHeight: 1.2 }}>
                    {gt9 || '-'}{gt9 > 0 && <><br/><span style={{ fontSize: 9, color: '#888', fontWeight: 400 }}>({nt9})</span></>}
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderLandscape = () => {
    // 13-C.2: Render full 9-column Front and/or Back sections whenever the
    // round contains any hole in that half. Out-of-round cells show gray
    // background in SCORE rows only (via renderCell). Par and M.Hcp rows show
    // real values across all columns (owner preference — graying those rows
    // clashed with readability). Totals use in-round subsets.
    const FRONT = FULL_FRONT;
    const BACK  = FULL_BACK;
    const FRONT_IN = FRONT.filter(inRound);
    const BACK_IN  = BACK.filter(inRound);
    const ALL_IN   = [...FRONT_IN, ...BACK_IN];
    const hasFront = anyFrontInRound;
    const hasBack  = anyBackInRound;
    const isPartial = !(hasFront && hasBack);
    const frontCount = hasFront ? FRONT.length : 0;
    const backCount  = hasBack  ? BACK.length  : 0;
    const extraCols = (hasFront ? 1 : 0) + (hasBack ? 1 : 0) + 1;
    const tableMinW = NAME_MIN + (frontCount + backCount) * COL_W + extraCols * TOT_W;

    // E5 fix: for partial rounds (only Front or only Back rendered), use
    // natural table width so the name column doesn't expand to fill empty
    // space on the right. Full rounds keep width:100% to preserve existing
    // name-column stretch behavior on wide landscape screens.
    const tableWidth = isPartial ? tableMinW : '100%';

    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: tableWidth, minWidth: tableMinW }}>
            <colgroup>
              <col style={{ minWidth: NAME_MIN }}/>
              {hasFront && FRONT.map(h => <col key={h} style={{ width: COL_W }}/>)}
              {hasFront && <col style={{ width: TOT_W }}/>}
              {hasBack  && BACK.map(h  => <col key={h} style={{ width: COL_W }}/>)}
              {hasBack  && <col style={{ width: TOT_W }}/>}
              <col style={{ width: TOT_W }}/>
            </colgroup>
            <thead>
              <tr>
                <th style={{ padding: '3px 4px', background: '#f0f4f0', color: '#555', fontSize: 10, textAlign: 'left' }}></th>
                {hasFront && FRONT.map(h => (
                  <th key={h} style={{ padding: '2px 1px', background: '#f0f4f0', color: '#555', fontSize: 10, textAlign: 'center' }}>{h+1}</th>
                ))}
                {hasFront && <th style={{ padding: '2px 3px', background: '#e8f0e8', color: G, fontSize: 10, fontWeight: 800, textAlign: 'center' }}>Total</th>}
                {hasBack  && BACK.map(h  => (
                  <th key={h} style={{ padding: '2px 1px', background: '#f0f4f0', color: '#555', fontSize: 10, textAlign: 'center' }}>{h+1}</th>
                ))}
                {hasBack  && <th style={{ padding: '2px 3px', background: '#e8f0e8', color: G, fontSize: 10, fontWeight: 800, textAlign: 'center' }}>Total</th>}
                <th style={{ padding: '2px 3px', background: '#d8ead8', color: G, fontSize: 10, fontWeight: 800, textAlign: 'center' }}>Total</th>
              </tr>
              <tr>
                <td style={{ padding: '1px 6px', fontSize: 9, color: G, fontWeight: 700, background: '#f8fbf8' }}>Par</td>
                {hasFront && FRONT.map(h => (
                  <td key={h} style={{ textAlign: 'center', fontSize: 9, color: G, fontWeight: 600, background: '#f8fbf8' }}>{pars[h]}</td>
                ))}
                {hasFront && <td style={{ textAlign: 'center', fontSize: 9, color: G, fontWeight: 700, background: '#f0f7f0' }}>{parTotal(FRONT_IN)}</td>}
                {hasBack  && BACK.map(h => (
                  <td key={h} style={{ textAlign: 'center', fontSize: 9, color: G, fontWeight: 600, background: '#f8fbf8' }}>{pars[h]}</td>
                ))}
                {hasBack  && <td style={{ textAlign: 'center', fontSize: 9, color: G, fontWeight: 700, background: '#f0f7f0' }}>{parTotal(BACK_IN)}</td>}
                <td style={{ textAlign: 'center', fontSize: 9, color: G, fontWeight: 700, background: '#eaf4ea' }}>{parTotal(ALL_IN)}</td>
              </tr>
              <tr>
                <td style={{ padding: '1px 6px', fontSize: 9, color: '#aaa', fontWeight: 600, background: '#fafcfa' }}>{siMLabel}</td>
                {hasFront && FRONT.map(h => (
                  <td key={h} style={{ textAlign: 'center', fontSize: 9, color: '#ccc', background: '#fafcfa' }}>{hcps[h]}</td>
                ))}
                {hasFront && <td style={{ background: '#fafcfa' }}/>}
                {hasBack  && BACK.map(h => (
                  <td key={h} style={{ textAlign: 'center', fontSize: 9, color: '#ccc', background: '#fafcfa' }}>{hcps[h]}</td>
                ))}
                {hasBack  && <td style={{ background: '#fafcfa' }}/>}
                <td style={{ background: '#fafcfa' }}/>
              </tr>
              {showWomenSI && (
                <tr>
                  <td style={{ padding: '1px 6px', fontSize: 9, color: '#c2185b', fontWeight: 600, background: '#fafcfa' }}>{siWLabel}</td>
                  {hasFront && FRONT.map(h => (
                    <td key={h} style={{ textAlign: 'center', fontSize: 9, color: '#e8a0b8', background: '#fafcfa' }}>{hcpsWomen[h]}</td>
                  ))}
                  {hasFront && <td style={{ background: '#fafcfa' }}/>}
                  {hasBack  && BACK.map(h => (
                    <td key={h} style={{ textAlign: 'center', fontSize: 9, color: '#e8a0b8', background: '#fafcfa' }}>{hcpsWomen[h]}</td>
                  ))}
                  {hasBack  && <td style={{ background: '#fafcfa' }}/>}
                  <td style={{ background: '#fafcfa' }}/>
                </tr>
              )}
            </thead>
            <tbody>
              {players.map((p, pi) => {
                const gF = grossTotal(pi, FRONT_IN), nF = netTotal(pi, FRONT_IN);
                const gB = grossTotal(pi, BACK_IN),  nB = netTotal(pi, BACK_IN);
                // 13-C.6: Dim name <td> when player is marked as departed.
                // Show a subtle hint underneath telling the user how to undo.
                const isDeparted = !!earlyDepartureOpts?.[pi];
                return (
                  <tr key={pi} style={{ background: pi % 2 === 0 ? '#fff' : '#f5fbf5' }}>
                    <td
                      onTouchStart={isDeparted ? () => startUndoNameLongPress(pi) : undefined}
                      onTouchEnd={isDeparted ? () => cancelUndoNameLongPress(pi) : undefined}
                      onTouchMove={isDeparted ? () => cancelUndoNameLongPress(pi) : undefined}
                      onTouchCancel={isDeparted ? () => cancelUndoNameLongPress(pi) : undefined}
                      onMouseDown={isDeparted ? () => startUndoNameLongPress(pi) : undefined}
                      onMouseUp={isDeparted ? () => cancelUndoNameLongPress(pi) : undefined}
                      onMouseLeave={isDeparted ? () => cancelUndoNameLongPress(pi) : undefined}
                      style={{
                        padding: '2px 4px', fontSize: 11, fontWeight: 600,
                        color: isDeparted ? '#999' : '#333',
                        opacity: isDeparted ? 0.55 : 1,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        lineHeight: 1.15,
                        cursor: isDeparted ? 'pointer' : 'default',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                    }}>
                      {p.name}
                      {isDeparted && (
                        <div style={{ fontSize: 8, fontWeight: 500, color: '#999', marginTop: 1, letterSpacing: 0.3 }}>
                          hold name to resume
                        </div>
                      )}
                    </td>
                    {hasFront && FRONT.map(h => (
                      <td key={h} style={{ padding: 1, position: 'relative' }}>
                        {renderCell(h, pi, 12, '4px 0')}
                      </td>
                    ))}
                    {hasFront && (
                      <td style={{ textAlign: 'center', fontWeight: 700, color: G, fontSize: 10, padding: '1px 2px', background: '#f0f7f0', whiteSpace: 'nowrap', lineHeight: 1.1 }}>
                        {gF||'-'}{gF>0&&<><br/><span style={{ fontSize:8,color:'#888',fontWeight:400 }}>({nF})</span></>}
                      </td>
                    )}
                    {hasBack && BACK.map(h => (
                      <td key={h} style={{ padding: 1, position: 'relative' }}>
                        {renderCell(h, pi, 12, '4px 0')}
                      </td>
                    ))}
                    {hasBack && (
                      <td style={{ textAlign: 'center', fontWeight: 700, color: G, fontSize: 10, padding: '1px 2px', background: '#f0f7f0', whiteSpace: 'nowrap', lineHeight: 1.1 }}>
                        {gB||'-'}{gB>0&&<><br/><span style={{ fontSize:8,color:'#888',fontWeight:400 }}>({nB})</span></>}
                      </td>
                    )}
                    <td style={{ textAlign: 'center', fontWeight: 800, color: G, fontSize: 11, padding: '1px 3px', background: '#e8f4e8', whiteSpace: 'nowrap', lineHeight: 1.1 }}>
                      {(gF+gB)||'-'}{(gF+gB)>0&&<><br/><span style={{ fontSize:8,color:'#888',fontWeight:400 }}>(n{nF+nB})</span></>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const hasGameTables = ['Nines','Stableford','Skins','Stroke Play','Match / Nassau','Sixes','Wolf'].some(g => activeGames.includes(g));

  return (
    <div>
      {/* DotsPopup — zIndex 400, renders above ZoomModal (zIndex 200) */}
      {popup && (
        <DotsPopup
          hole={popup.hole} pi={popup.pi}
          playerName={players[popup.pi]?.name}
          par={pars[popup.hole]}
          gross={parseInt(scores[popup.hole]?.[popup.pi]) || null}
          dots={dots} entries={dotEntries} setEntries={setDotEntries}
          sixesTeams={sixesTeams} matches={matches} players={players}
          gameOpts={gameOpts}
          onClose={() => {
            setPopup(null);
            // Restore keypad to the cell that was active before DotsPopup opened
            if (savedKpCellRef.current) {
              setActiveKpCell(savedKpCellRef.current);
              setKpValue('');
              savedKpCellRef.current = null;
            }
          }}
          courseHcps={courseHcps} hcps={hcps} minCourseHcp={minCourseHcp}
          paddingTop={zoomOpen ? 92 : undefined}
        />
      )}

      {/* ZoomModal — cells call onCellTap which routes to ScoreGrid's openKeypadOnCell */}
      {zoomOpen && (
        <ZoomModal
          players={players} pars={pars} hcps={hcps} hcpsWomen={hcpsWomen}
          courseHcps={courseHcps} minCourseHcp={minCourseHcp}
          effectiveMinCourseHcp={effectiveMinCourseHcp}
          nonParticipantIdxs={nonParticipantIdxs}
          scores={scores}
          dotMode={dotMode} isMixed={isMixed} setDotModeOverride={setDotModeOverride}
          nolDotGame={nolDotGame} setNolDotGame={setNolDotGame}
          nolDotOptions={nolDotOptions}
          startLongPress={startLongPress} cancelLongPress={cancelLongPress}
          dotsGameActive={dotsGameActive} sc={sc}
          zoomHole={zoomHole} setZoomHole={setZoomHole} setZoomOpen={closeZoom}
          setPopup={setPopup}
          activeKpCell={activeKpCell}
          onCellTap={(h, pi) => {
            // Don't open keypad if this tap was actually the finger-lift from a long-press
            if (longPressFired.current[`${h}_${pi}`]) return;
            openKeypadOnCell(h, pi);
          }}
          cardRef={zoomCardRef}
          roundStartHole={roundStartHole}
          roundEndHole={roundEndHole}
        />
      )}

      {isLandscape
        ? renderLandscape()
        : (
          <>
            {/* 13-C.2: Render Front 9 section (full 9 columns) whenever the  */}
            {/* round touches any front-9 hole. Out-of-round columns within   */}
            {/* the rendered section display as gray `–` (handled in          */}
            {/* renderCell). Par / M.Hcp rows also gray out via renderHalf.   */}
            {anyFrontInRound && renderHalf(FULL_FRONT, 'Front', true)}
            {/* Back 9 section — same rule, rendered whenever round touches any back-9 hole. */}
            {anyBackInRound  && renderHalf(FULL_BACK,  'Back',  !anyFrontInRound)}
          </>
        )
      }
      {/* 13-C.3: In landscape partial mode, constrain TotalsCard AND all game  */}
      {/* tables to match the compact scoregrid width. Width is derived from   */}
      {/* the round hole count (not hardcoded 18) so a 9-hole landscape round  */}
      {/* doesn't leave blank space to the right of the tables.               */}
      <div style={(() => {
        if (!isLandscape) return { paddingTop: 4, marginTop: 4 };
        const isPartial = !(anyFrontInRound && anyBackInRound);
        if (!isPartial) return { paddingTop: 4, marginTop: 4 };
        const frontCount = anyFrontInRound ? FULL_FRONT.length : 0;
        const backCount  = anyBackInRound  ? FULL_BACK.length  : 0;
        const extraCols  = (anyFrontInRound ? 1 : 0) + (anyBackInRound ? 1 : 0) + 1;
        const tableMinW  = NAME_MIN + (frontCount + backCount) * COL_W + extraCols * TOT_W;
        return { paddingTop: 4, marginTop: 4, width: tableMinW, maxWidth: tableMinW };
      })()}>
        <TotalsCard
          players={players} pars={pars} scores={scores}
          courseHcps={courseHcps} hcps={hcps}
          minCourseHcp={minCourseHcp} primaryMode={primaryMode}
          roundStartHole={roundStartHole}
          roundNumHoles={roundNumHoles}
          earlyDepartureOpts={earlyDepartureOpts}
        />
        {hasGameTables && (() => {
          // 13-C.3: Compute per-game effective hole range for each table.
          // Game-level (non-score) trimming only. Score-entry cells above
          // still honor the round range, not per-game ranges (invariant #14).
          //
          // Range resolution:
          //   - Game name key (Skins, Nines, Stableford, Stroke Play, Sixes)
          //     → gameRanges[name] || round default
          //   - Match instance key (matchDef.id)
          //     → resolved inside MatchNassauTable (per-match pill)
          //   - Dots team mode: inherits from team source (handled below)
          const gameRange = (key) => {
            const entry = gameRanges?.[key];
            if (entry
                && Number.isInteger(entry.startHole)
                && Number.isInteger(entry.endHole)
                && entry.startHole >= roundStartHole
                && entry.endHole   <= roundEndHole
                && entry.startHole <  entry.endHole) {
              return { startHole: entry.startHole, endHole: entry.endHole };
            }
            return { startHole: roundStartHole, endHole: roundEndHole };
          };
          const ninesR  = gameRange('Nines');
          const stabR   = gameRange('Stableford');
          const skinsR  = gameRange('Skins');
          const spR     = gameRange('Stroke Play');
          const sixesR  = gameRange('Sixes');
          return (
            <>
              {activeGames.includes('Nines')           && <NinesTable        players={players} scores={scores} pars={pars} hcps={hcps} opts={gameOpts.Nines}          courseHcps={courseHcps} minCourseHcp={minCourseHcp} ninesPlayers={ninesPlayers}          isLandscape={isLandscape} startHole={ninesR.startHole} endHole={ninesR.endHole} earlyDepartureOpts={earlyDepartureOpts}/>}
              {activeGames.includes('Stableford')       && <StablefordTable   players={players} scores={scores} pars={pars} hcps={hcps} opts={gameOpts.Stableford}     courseHcps={courseHcps} minCourseHcp={minCourseHcp} stablefordPlayers={stablefordPlayers}  isLandscape={isLandscape} startHole={stabR.startHole}  endHole={stabR.endHole} earlyDepartureOpts={earlyDepartureOpts}/>}
              {activeGames.includes('Skins')            && <SkinsTable        players={players} scores={scores}             hcps={hcps} opts={gameOpts.Skins}           courseHcps={courseHcps} minCourseHcp={minCourseHcp} skinsPlayerIdxs={skinsPlayers}          isLandscape={isLandscape} startHole={skinsR.startHole} endHole={skinsR.endHole} earlyDepartureOpts={earlyDepartureOpts}/>}
              {activeGames.includes('Stroke Play')      && <StrokePlayTable   players={players} scores={scores} pars={pars} hcps={hcps} opts={gameOpts['Stroke Play']} courseHcps={courseHcps} minCourseHcp={minCourseHcp} strokePlayPlayers={strokePlayPlayers}  isLandscape={isLandscape} startHole={spR.startHole}    endHole={spR.endHole} earlyDepartureOpts={earlyDepartureOpts}/>}
              {/* Match / Nassau: per-match ranges are keyed by matchDef.id; MatchNassauTable reads them directly from gameRanges. Round bounds forwarded for range-fallback inside the table. */}
              {activeGames.includes('Match / Nassau')   && <MatchNassauTable  players={players} scores={scores}             hcps={hcps} matches={matches || []}         courseHcps={courseHcps} minCourseHcp={minCourseHcp} manualPresses={manualPresses} setManualPresses={setManualPresses} isLandscape={isLandscape} gameRanges={gameRanges} roundStartHole={roundStartHole} roundEndHole={roundEndHole} earlyDepartureOpts={earlyDepartureOpts}/>}
              {activeGames.includes('Sixes')            && <SixesTable        players={players} scores={scores}             hcps={hcps} opts={gameOpts.Sixes}           courseHcps={courseHcps} minCourseHcp={minCourseHcp} sixesTeams={sixesTeams} manualPresses={manualPresses} setManualPresses={setManualPresses}                         startHole={sixesR.startHole} endHole={sixesR.endHole} earlyDepartureOpts={earlyDepartureOpts}/>}
              {activeGames.includes('Wolf') && wolfState  && <WolfTable          players={players} wolfState={wolfState} opts={gameOpts.Wolf} isLandscape={isLandscape}/>}
            </>
          );
        })()}
        {dotsGameActive && (() => {
          // 13-C.3: Dots range resolution — in team mode, Dots is LOCKED to
          // the team source's range per D-3A (mirrors GameConfig UI lock).
          // Individual mode uses gameRanges['Dots'].
          const dotsOpts = gameOpts?.Dots || gameOpts?.Specials || {};
          const rawTeamMode = dotsOpts.teamMode;
          const legacyTeam  = dotsOpts.teamScoring;
          const isTeamMode  = rawTeamMode ? rawTeamMode !== 'none' : !!legacyTeam;
          const teamSource  = rawTeamMode && rawTeamMode !== 'none'
            ? rawTeamMode
            : (legacyTeam ? 'Sixes' : 'none');
          const getRange = (key) => {
            const entry = gameRanges?.[key];
            if (entry
                && Number.isInteger(entry.startHole)
                && Number.isInteger(entry.endHole)
                && entry.startHole >= roundStartHole
                && entry.endHole   <= roundEndHole
                && entry.startHole <  entry.endHole) {
              return { startHole: entry.startHole, endHole: entry.endHole };
            }
            return { startHole: roundStartHole, endHole: roundEndHole };
          };
          let dotsR;
          if (isTeamMode && teamSource === 'Sixes')               dotsR = getRange('Sixes');
          else if (isTeamMode && teamSource.startsWith('Match:')) dotsR = getRange(teamSource.slice(6));
          else                                                     dotsR = getRange('Dots');
          return (
            <DotsTable
              players={players} dots={dots} dotEntries={dotEntries}
              gameOpts={gameOpts} dotsPlayers={dotsPlayers}
              isLandscape={isLandscape}
              sixesTeams={sixesTeams}
              matches={matches}
              startHole={dotsR.startHole} endHole={dotsR.endHole}
              earlyDepartureOpts={earlyDepartureOpts}
            />
          );
        })()}
      </div>

      {/* ScoreKeypad — fixed-bottom overlay, hidden when ZoomModal is open */}
      <ScoreKeypad
        containerRef={kpContainerRef}
        visible={kpVisible}
        value={kpValue}
        onChange={handleKpChange}
        onBackspace={handleKpBackspace}
        onLongPressX={handleLongPressX}
      />

      {/* 13-C.6: Long-press X confirmation prompt. Lightweight inline modal —
          NOT a third major modal; it's just two buttons. Per PartialGameContract
          §8.2 (v1.9), no score is written for hole h — the long-press is a
          pure departure-intent gesture. The hole's score remains blank (or
          whatever it was) and the user can enter it normally afterward.
          13-E.4: Render extracted to DepartPromptModal.jsx. State (departPrompt)
          and handlers (handleDepartCancel / handleDepartConfirmYes) remain
          owned here; the modal is pure render given props. */}
      {departPrompt && (
        <DepartPromptModal
          playerName={players[departPrompt.pi]?.name || 'Player'}
          holeNumber={departPrompt.h + 1}
          onCancel={handleDepartCancel}
          onConfirm={handleDepartConfirmYes}
        />
      )}

      {/* Wolf pick popup — fires when player 0's cell is activated on any hole.
          Shows current pick highlighted if one exists (re-tap to change).
          After any selection, keypad resumes on cell {h, pi:0} — stays open.
          H-40: onTouchEnd fires action + records timestamp; onClick no-ops within 600ms. */}
      {wolfPickPrompt && (() => {
        const { holeIdx, wolfIdx, resumeCell } = wolfPickPrompt;
        const wolfName   = players[wolfIdx]?.name?.split(' ')[0] || '?';
        const nonWolf    = players.map((_, i) => i).filter(i => i !== wolfIdx);
        const existingPick = wolfPicks?.[holeIdx] ?? null;
        const wolfTouchRef = { current: 0 };

        // closePopup: dismisses the popup only — never reopens the keypad.
        // Used by outside-tap so the user can always back out to navigate
        // elsewhere (other tabs, game tiles, etc.) without being trapped.
        const closePopup = () => setWolfPickPrompt(null);

        const resumeKeypad = () => {
          setWolfPickPrompt(null);
          if (resumeCell) {
            setActiveKpCell(resumeCell);
            setKpValue('');
          }
        };

        // Outside-tap always dismisses. If a pick already existed for this
        // hole, resume the keypad (user was just reviewing/editing). If no
        // pick exists yet, close without reopening the keypad — the cell
        // stays inactive, so no score can be typed; tapping that cell again
        // will re-show this popup (openKeypadOnCell's pi===0 gate).
        const handleOutsideTap = () => {
          if (existingPick) resumeKeypad();
          else closePopup();
        };

        const makePick = (partnerIdx, loneWolf, blindWolf, pointValue) => {
          if (setWolfPicks) {
            setWolfPicks(prev => ({ ...prev, [holeIdx]: {
              wolfIdx, partnerIdx: partnerIdx ?? null,
              loneWolf: !!loneWolf, blindWolf: !!blindWolf, pointValue,
            }}));
          }
          resumeKeypad();
        };

        const isSelected = (partnerIdx, loneWolf, blindWolf) => {
          if (!existingPick) return false;
          if (blindWolf)  return existingPick.blindWolf;
          if (loneWolf)   return existingPick.loneWolf && !existingPick.blindWolf;
          return existingPick.partnerIdx === partnerIdx;
        };

        const guardedBtn = (action, style, selectedStyle, isActive, children) => (
          <button
            onTouchEnd={(e) => { e.preventDefault(); wolfTouchRef.current = Date.now(); action(); }}
            onClick={() => { if (Date.now() - wolfTouchRef.current < 600) return; action(); }}
            style={{
              padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              border: '1.5px solid transparent',
              ...(isActive ? selectedStyle : style),
            }}>
            {isActive && <span style={{ marginRight: 6, fontSize: 12 }}>✓</span>}
            {children}
          </button>
        );

        return (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 450, background: 'rgba(0,0,0,0.45)',
                     display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onTouchEnd={(e) => { if (e.target === e.currentTarget) { wolfTouchRef.current = Date.now(); handleOutsideTap(); } }}
            onClick={(e) => { if (e.target === e.currentTarget && Date.now() - wolfTouchRef.current > 600) handleOutsideTap(); }}
          >
            <div onClick={e => e.stopPropagation()}
              style={{ background: '#fff', borderRadius: 14, padding: '18px 16px 16px',
                       width: '100%', maxWidth: 320, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: '#4a1580', marginBottom: 4 }}>
                Hole {holeIdx + 1} — {wolfName} is Wolf
              </div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 14 }}>
                {existingPick ? 'Current pick shown — tap to change' : 'Select partner or go alone — required before scoring this hole'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {nonWolf.map(pi => {
                  const name = players[pi]?.name?.split(' ')[0] || '?';
                  const active = isSelected(pi, false, false);
                  return guardedBtn(
                    () => makePick(pi, false, false, 1),
                    { border: '1.5px solid #dac8f5', background: '#f0e8f8', color: '#4a1580' },
                    { border: '2px solid #4a1580',   background: '#dac8f5', color: '#4a1580' },
                    active,
                    <span>Partner: {name} <span style={{ fontSize: 11, fontWeight: 400, color: '#888' }}>(1 pt)</span></span>
                  );
                })}
                {guardedBtn(
                  () => makePick(null, true, false, 2),
                  { border: '1.5px solid #dac8f5', background: '#f0e8f8', color: '#4a1580' },
                  { border: '2px solid #4a1580',   background: '#dac8f5', color: '#4a1580' },
                  isSelected(null, true, false),
                  <span>Go Lone Wolf <span style={{ fontSize: 11, fontWeight: 400, color: '#888' }}>(2 pts)</span></span>
                )}
                {guardedBtn(
                  () => makePick(null, false, true, 3),
                  { border: '1.5px solid #dac8f5', background: '#f0e8f8', color: '#4a1580' },
                  { border: '2px solid #4a1580',   background: '#dac8f5', color: '#4a1580' },
                  isSelected(null, false, true),
                  <span>Go Blind Wolf <span style={{ fontSize: 11, fontWeight: 400, color: '#888' }}>(3 pts)</span></span>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
