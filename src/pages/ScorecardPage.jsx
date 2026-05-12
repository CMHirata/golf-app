// ─── ScorecardPage.jsx ────────────────────────────────────────────────────────
// State owner and page shell for the live scorecard.
// Holds live-round state, persists on change, computes derived display values,
// and passes everything down to ScoreGrid as props.
// Contains NO scoring math, NO grid rendering, NO game table logic.
// See App Data Model Contract §8 for mutation rules.
//
// Departure resolver chain state machine extracted to useDepartureResolver.js
// (planning session refactor). ScorecardPage retains useImperativeHandle wiring
// so App.jsx can trigger the reactive resolver via ref.
//
// ✅ Self-checked (13-C.6): Resolver state added (`resolverState` useState).
// `onOpenDepartureResolver` calls `buildResolverGameRows` from scorecardUtils
// and seeds `initialResolutions` via `makeDefaultResolution`. `onConfirm`
// writes `activeRound.earlyDepartureOpts[i] = { departureHole, gameResolutions }`
// for each departed player and persists via `saveActiveRound`. The persist
// loop's mount-time-snapshot guard reads the LATEST blob via `getActiveRound()`
// before merging the three mutable fields, so subsequent renders preserve
// the freshly-written `earlyDepartureOpts` (no race). The dimmed-name-chip
// behavior is implemented inside ScoreGrid (which receives `earlyDepartureOpts`
// as a prop) — failure-mode check 8c bullet 8: it reflects the OPTS map's
// existence for player i, not score completeness.
//
// ✅ Self-checked (13-C.6 device-test): Undo prompt converted from
// `window.confirm` to a styled inline modal matching the depart-confirm
// modal in ScoreGrid. New `undoPromptPi` state holds the pending player
// index; `confirmUndoFromPrompt` performs the `delete newOpts[pi]` write
// and persists; `cancelUndoPrompt` closes without writing. The
// `onUndoDeparturePrompt` callback passed down to ScoreGrid now opens
// the modal rather than running the confirm synchronously, since the
// gesture target moved from the cell to the player name td and the
// styled modal feels in-app rather than OS-jarring.
//
// ✅ Self-checked (15-C): "Results →" button label changed to "Payouts →".

import { useCallback, useMemo, useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Btn, G } from '../components/ui.jsx';
import { ScoreGrid } from './scorecard/ScoreGrid.jsx';
import { computeNolDotOptions } from './scorecard/scorecardUtils.js';
import { useDepartureResolver } from './scorecard/useDepartureResolver.js';
import { DepartureResolverSheet } from './scorecard/DepartureResolverSheet.jsx';
import { ReorderDeparturesModal } from './scorecard/ReorderDeparturesModal.jsx';

// Layout constants — must match App.jsx
const NAV_BAR_HEIGHT    = 68;
const ACTION_BAR_HEIGHT = 52;

// ── deriveDotModes ─────────────────────────────────────────────────────────────
function deriveDotModes(activeGames, gameOpts, matches) {
  let hasNet = false, hasNOL = false;
  const check = (s) => {
    if (s === 'net')       hasNet = true;
    if (s === 'netofflow') hasNOL = true;
  };
  for (const g of activeGames) {
    if (g === 'Match / Nassau') {
      (matches || []).forEach(m => check(m.grossNetNOL ?? m.scoring ?? 'net'));
    } else if (g === 'Dots' || g === 'Specials') {
      const dotsScoring = gameOpts[g]?.grossNetNOL ?? gameOpts[g]?.scoring;
      if (dotsScoring && dotsScoring !== 'gross') check(dotsScoring);
    } else {
      check(gameOpts[g]?.grossNetNOL ?? gameOpts[g]?.scoring ?? 'net');
    }
  }
  return { hasNet, hasNOL };
}

// ── ScorecardPage ──────────────────────────────────────────────────────────────
//
// 13-C.7.5 / v2.0: Page exposes an imperative handle to App.jsx via ref so
// that the reactive resolver chain (Results → tap with unresolved events)
// can be triggered from outside this component. The exposed shape:
//   {
//     // Returns true if the chain fired (caller should wait for chain
//     // completion via onResults). Returns false if there are no
//     // unresolved events (caller may proceed directly to Results).
//     triggerReactiveResolver: () => boolean,
//   }
const ScorecardPage = forwardRef(function ScorecardPage(
  { getActiveRound, saveActiveRound, onResults, onBack, onDiscard },
  ref
) {
  const ar = getActiveRound();

  if (!ar) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>
        <img src="/logo_icon.png" alt="" style={{ height: 56, width: 'auto', marginBottom: 12, opacity: 0.4 }} />
        <div>No active round. Set up a new round first.</div>
        <Btn onClick={onBack} style={{ marginTop: 16 }}>← New Round</Btn>
      </div>
    );
  }

  const { roundDate, course, pars, hcps, activePlayers, activeGames, gameOpts,
          matches, sixesTeams, dots: initDots, layout,
          courseHcps, minCourseHcp,
          hcpsWomen,
          strokePlayPlayers, skinsPlayers, stablefordPlayers, ninesPlayers,
          dotsPlayers } = ar;

  // 13-C.2: Round length — defaults preserve full 18-hole behavior when absent.
  // Passed down to ScoreGrid which drives column count and cell navigation bounds.
  const roundStartHole = ar.roundStartHole ?? 0;
  const roundNumHoles  = ar.roundNumHoles  ?? 18;

  // 13-C.6: Per-player departure metadata. Default `{}` for byte-identical
  // pre-13-C.6 rendering when no departures exist. Read every render so
  // post-confirm/post-undo updates flow through immediately.
  const earlyDepartureOpts = ar.earlyDepartureOpts || {};

  const [scores,        setScoresState]    = useState(() => ar.scores || Array.from({ length: 18 }, () => new Array(activePlayers.length).fill('')));
  const [dots,          setDots]           = useState(initDots || []);
  const [dotEntries,    setDotEntries_]    = useState(() => ar.dotEntries || {});
  const [manualPresses, setManualPresses_] = useState(() => ar.manualPresses || {});

  // Refs always mirror the latest state values synchronously.
  // Updated inside the wrapped setters below — never via useEffect — so they
  // are always current even before the next render cycle.
  const scoresRef        = useRef(ar.scores || Array.from({ length: 18 }, () => new Array(activePlayers.length).fill('')));
  const dotEntriesRef    = useRef(ar.dotEntries || {});
  const manualPressesRef = useRef(ar.manualPresses || {});

  // Wrapped setters keep refs in sync synchronously.
  const setScores = useCallback((fn) => {
    setScoresState(prev => {
      const next = typeof fn === 'function' ? fn(prev) : fn;
      scoresRef.current = next;
      return next;
    });
  }, []);

  const setDotEntries = useCallback((fn) => {
    setDotEntries_(prev => {
      const next = typeof fn === 'function' ? fn(prev) : fn;
      dotEntriesRef.current = next;
      return next;
    });
  }, []);

  const setManualPresses = useCallback((fn) => {
    setManualPresses_(prev => {
      const next = typeof fn === 'function' ? fn(prev) : fn;
      manualPressesRef.current = next;
      return next;
    });
  }, []);

  const isDiscardingRef = useRef(false);

  // Persist mutable state on every change.
  // Read the latest activeRound from storage so we never clobber breakdown/bank
  // that handleGoResults may have just written (Bug 1 fix).
  // Cleanup flushes on unmount (covers nav-away from scorecard tab) using refs
  // which are always current (Bug 2 fix — center button / nav tab path).
  // Skip flush if discarding — the discard handler clears storage first; flushing
  // after would re-write the cleared round.
  useEffect(() => {
    const latest = getActiveRound() || ar;
    saveActiveRound({ ...latest, scores, dotEntries, manualPresses });
    return () => {
      if (isDiscardingRef.current) return;
      const latestOnUnmount = getActiveRound() || ar;
      saveActiveRound({ ...latestOnUnmount, scores: scoresRef.current, dotEntries: dotEntriesRef.current, manualPresses: manualPressesRef.current });
    };
  }, [scores, dotEntries, manualPresses]);

  // ── Departure resolver chain (extracted to useDepartureResolver.js) ────────
  //
  // All chain state machine logic lives in the hook. ScorecardPage destructures
  // the returned interface and wires it to DepartureResolverSheet,
  // ReorderDeparturesModal, ScoreGrid callbacks, and useImperativeHandle.
  const {
    resolverState,
    reorderModalState,
    undoPromptPi,
    onOpenDepartureResolver,
    onConfirmResolution,
    onCancelResolution,
    triggerReactiveResolver,
    onOpenReorderDeparturesModal,
    cancelReorderModal,
    confirmReorderModal,
    onUndoDeparturePrompt,
    cancelUndoPrompt,
    confirmUndoFromPrompt,
  } = useDepartureResolver({ getActiveRound, saveActiveRound, ar });

  // Expose triggerReactiveResolver to App via ref.
  useImperativeHandle(ref, () => ({
    triggerReactiveResolver,
  }), [triggerReactiveResolver]);

  // Synchronously flush all mutable state to localStorage before handing control
  // back to App.jsx callbacks (handleBackToSetup, handleGoResults). Refs are
  // always current so this is safe even if useEffect hasn't fired yet.
  const flushNow = useCallback(() => {
    const latest = getActiveRound() || ar;
    saveActiveRound({ ...latest, scores: scoresRef.current, dotEntries: dotEntriesRef.current, manualPresses: manualPressesRef.current });
  }, [getActiveRound, ar]);

  const flushAndBack = useCallback(() => {
    flushNow();
    onBack();
  }, [flushNow, onBack]);

  const flushAndResults = useCallback(() => {
    flushNow();
    onResults();
  }, [flushNow, onResults]);

  const primaryMode = useMemo(() => {
    const first = activeGames.find(g => g !== 'Dots' && g !== 'Specials' && g !== 'Match / Nassau');
    return (first ? (gameOpts[first]?.grossNetNOL ?? gameOpts[first]?.scoring) : null) || 'net';
  }, [activeGames, gameOpts]);

  const { hasNet, hasNOL } = useMemo(
    () => deriveDotModes(activeGames, gameOpts, matches || []),
    [activeGames, gameOpts, matches]
  );
  const isMixed        = hasNet && hasNOL;
  const defaultDotMode = (!hasNet && !hasNOL) ? null : hasNet ? 'net' : 'netofflow';
  const [dotModeOverride, setDotModeOverride] = useState(null);
  const dotMode = isMixed ? (dotModeOverride ?? 'net') : defaultDotMode;

  // ── NOL dot selector state (§5.11) ───────────────────────────────────────────
  // nolDotGame selects which subset's minCourseHcp drives dot display.
  // Never persisted. Resets to 'field' whenever dotMode leaves 'netofflow'.
  const [nolDotGame, setNolDotGame] = useState('field');

  useEffect(() => {
    if (dotMode !== 'netofflow') setNolDotGame('field');
  }, [dotMode]);

  // Qualifying subset pill options (§5.13)
  const nolDotOptions = useMemo(() => computeNolDotOptions({
    activeGames,
    gameOpts,
    matches: matches || [],
    skinsPlayers:       skinsPlayers       || [],
    stablefordPlayers:  stablefordPlayers  || [],
    ninesPlayers:       ninesPlayers       || [],
    strokePlayPlayers:  strokePlayPlayers  || [],
    sixesPlayers:       ar.sixesPlayers    || [],
    courseHcps,
    minCourseHcp,
  }), [activeGames, gameOpts, matches, skinsPlayers, stablefordPlayers,
       ninesPlayers, strokePlayPlayers, ar.sixesPlayers, courseHcps, minCourseHcp]);

  // If the currently-selected subset game is no longer a qualifying option
  // (e.g. its scoring mode changed from NOL to Net), reset to 'field'.
  useEffect(() => {
    if (nolDotGame === 'field') return;
    const stillValid = nolDotOptions.some(o => o.value === nolDotGame);
    if (!stillValid) setNolDotGame('field');
  }, [nolDotOptions, nolDotGame]);

  // effectiveMinCourseHcp and nonParticipantIdxs (§5.8)
  const { effectiveMinCourseHcp, nonParticipantIdxs } = useMemo(() => {
    if (dotMode !== 'netofflow' || nolDotGame === 'field') {
      return { effectiveMinCourseHcp: minCourseHcp, nonParticipantIdxs: new Set() };
    }
    const opt = nolDotOptions.find(o => o.value === nolDotGame);
    if (!opt) return { effectiveMinCourseHcp: minCourseHcp, nonParticipantIdxs: new Set() };
    const effMin = Math.min(...opt.subsetIdxs.map(i => courseHcps[i]));
    const allIdxs = activePlayers.map((_, i) => i);
    const nonPart = new Set(allIdxs.filter(i => !opt.subsetIdxs.includes(i)));
    return { effectiveMinCourseHcp: effMin, nonParticipantIdxs: nonPart };
  }, [dotMode, nolDotGame, nolDotOptions, minCourseHcp, courseHcps, activePlayers]);

  // Landscape detection — single source of truth; passed down to ScoreGrid.
  const [isLandscape, setIsLandscape] = useState(
    () => typeof window !== 'undefined' && window.innerWidth > window.innerHeight
  );
  useEffect(() => {
    const update = () => setIsLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  const frontLabel = layout?.frontName;
  const backLabel  = layout?.backName;

  // Ref to ScoreGrid's openZoom — used for landscape zoom button
  const zoomTriggerRef = useRef(null);

  const handleDiscard = () => {
    const ok = window.confirm('Discard this round? All scores will be lost and cannot be recovered.');
    if (!ok) return;
    isDiscardingRef.current = true;
    if (onDiscard) onDiscard();
  };

  const bottomClearance = NAV_BAR_HEIGHT + ACTION_BAR_HEIGHT + 30;
  const actionBarBottom = NAV_BAR_HEIGHT;

  return (
    <div style={{ minHeight: '100vh', background: '#eef4ee' }}>

      {/* ── Sticky page header ── */}
      <div style={{
        background: G, padding: '8px 16px 7px',
        position: 'sticky', top: 0, zIndex: 10,
        boxShadow: '0 2px 8px rgba(0,0,0,.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <img src="/logo_lockup.png" alt="The Card" style={{ height: 58, width: 'auto', display: 'block' }} />
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 15, letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'inherit' }}>
            {course?.name || 'Scorecard'}
          </div>
          {layout && (
            <div style={{ color: '#a8c9a8', fontSize: 10, marginTop: 1 }}>
              {frontLabel} / {backLabel}
            </div>
          )}
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div style={{
        padding: '12px 12px',
        paddingBottom: `calc(${bottomClearance}px + env(safe-area-inset-bottom))`,
      }}>
        {/* ── Dot mode unified pill control (§5.6) ── */}
        {(isMixed || hasNOL) && (isMixed || nolDotOptions.length > 0) && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, color: '#aaa', flexShrink: 0 }}>Dots:</span>
            {/* Single unified pill — all segments in one bordered group */}
            <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid #c8ddc8' }}>
              {/* Net segment — only if hasNet */}
              {hasNet && (
                <button
                  onClick={() => { setDotModeOverride('net'); setNolDotGame('field'); }}
                  style={{
                    padding: '2px 7px', fontSize: 9, fontWeight: 600, fontFamily: 'inherit',
                    border: 'none', borderRight: '1px solid #c8ddc8', cursor: 'pointer', lineHeight: 1.4,
                    background: dotMode === 'net' ? G : '#eef4ee',
                    color:      dotMode === 'net' ? '#fff' : '#888',
                  }}
                >Net</button>
              )}
              {/* NOL (field) segment */}
              <button
                onClick={() => { setDotModeOverride('netofflow'); setNolDotGame('field'); }}
                style={{
                  padding: '2px 7px', fontSize: 9, fontWeight: 600, fontFamily: 'inherit',
                  border: 'none',
                  borderRight: nolDotOptions.length > 0 ? '1px solid #c8ddc8' : 'none',
                  cursor: 'pointer', lineHeight: 1.4,
                  background: dotMode === 'netofflow' && nolDotGame === 'field' ? G : '#eef4ee',
                  color:      dotMode === 'netofflow' && nolDotGame === 'field' ? '#fff' : '#888',
                }}
              >NOL</button>
              {/* Subset segments — inline in same pill */}
              {nolDotOptions.map((opt, i) => (
                <button
                  key={opt.value}
                  onClick={() => { setDotModeOverride('netofflow'); setNolDotGame(opt.value); }}
                  style={{
                    padding: '2px 7px', fontSize: 9, fontWeight: 600, fontFamily: 'inherit',
                    border: 'none',
                    borderRight: i < nolDotOptions.length - 1 ? '1px solid #c8ddc8' : 'none',
                    cursor: 'pointer', lineHeight: 1.4,
                    background: dotMode === 'netofflow' && nolDotGame === opt.value ? G : '#eef4ee',
                    color:      dotMode === 'netofflow' && nolDotGame === opt.value ? '#fff' : '#888',
                  }}
                >{opt.label}</button>
              ))}
            </div>
            {/* Landscape zoom button at far right */}
            {isLandscape && (
              <button
                onClick={() => zoomTriggerRef.current?.()}
                title="Open zoom score entry"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center' }}
                aria-label="Zoom score entry"
              >
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="7.5" stroke={G} strokeWidth="2.2"/>
                  <line x1="17.8" y1="17.8" x2="24" y2="24" stroke={G} strokeWidth="2.4" strokeLinecap="round"/>
                  <line x1="9" y1="12" x2="15" y2="12" stroke={G} strokeWidth="1.8" strokeLinecap="round"/>
                  <line x1="12" y1="9" x2="12" y2="15" stroke={G} strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
        )}
        {/* Landscape zoom button when no dot control is shown */}
        {!((isMixed || hasNOL) && (isMixed || nolDotOptions.length > 0)) && isLandscape && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <button
              onClick={() => zoomTriggerRef.current?.()}
              title="Open zoom score entry"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center' }}
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
        )}

        {activePlayers.length < 2
          ? <div style={{ color: '#aaa', textAlign: 'center', padding: 28 }}>Add at least 2 players in setup.</div>
          : <ScoreGrid
              players={activePlayers} pars={pars} hcps={hcps} hcpsWomen={hcpsWomen || null}
              courseHcps={courseHcps} minCourseHcp={minCourseHcp}
              effectiveMinCourseHcp={effectiveMinCourseHcp}
              nonParticipantIdxs={nonParticipantIdxs}
              scores={scores} setScores={setScores}
              dotMode={dotMode} isMixed={isMixed} setDotModeOverride={setDotModeOverride}
              nolDotGame={nolDotGame} setNolDotGame={setNolDotGame}
              nolDotOptions={nolDotOptions}
              primaryMode={primaryMode} activeGames={activeGames} gameOpts={gameOpts}
              matches={matches || []} sixesTeams={sixesTeams}
              strokePlayPlayers={strokePlayPlayers || []}
              skinsPlayers={skinsPlayers || []}
              stablefordPlayers={stablefordPlayers || []}
              ninesPlayers={ninesPlayers || []}
              dotsPlayers={dotsPlayers || []}
              dots={dots} dotEntries={dotEntries} setDotEntries={setDotEntries}
              manualPresses={manualPresses} setManualPresses={setManualPresses}
              frontLabel={frontLabel} backLabel={backLabel}
              isLandscape={isLandscape}
              zoomTriggerRef={zoomTriggerRef}
              roundStartHole={roundStartHole}
              roundNumHoles={roundNumHoles}
              gameRanges={ar.gameRanges ?? {}}
              earlyDepartureOpts={earlyDepartureOpts}
              onOpenDepartureResolver={onOpenDepartureResolver}
              onOpenReorderDeparturesModal={onOpenReorderDeparturesModal}
              onUndoDeparturePrompt={onUndoDeparturePrompt}
            />
        }
      </div>

      {/* ── Pinned action bar ── */}
      <div style={{
        position: 'fixed',
        bottom: `calc(${actionBarBottom}px + env(safe-area-inset-bottom))`,
        left: 0, right: 0,
        zIndex: 20,
        background: '#eef4ee',
        borderTop: '1px solid #d4e8d4',
        padding: '8px 12px 16px',
      }}>
        <div style={{ display: 'flex', gap: 8, maxWidth: 520, margin: '0 auto' }}>
          <Btn variant="outline" onClick={flushAndBack} style={{ flex: 1 }}>← Setup</Btn>
          <button
            onClick={handleDiscard}
            style={{
              flex: 1,
              border: '1.5px solid #c0392b',
              background: '#fff',
              color: '#c0392b',
              borderRadius: 10,
              padding: '9px 14px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Discard
          </button>
          <Btn onClick={flushAndResults} style={{ flex: 1 }}>Payouts →</Btn>
        </div>
      </div>

      {/* ── Early-departure resolver sheet ──
          Mounted at page level so the backdrop covers the entire scorecard.
          Sheet manages its own draft state internally; we only handle open/
          close and the final onConfirm write.
          v2.0 (Resolver_UI_Spec §2.1 v1.1): canonical prop is
          `departedPlayerName: string` (singular). */}
      <DepartureResolverSheet
        open={resolverState.open}
        departureHole={resolverState.departureHole}
        departedPlayerName={resolverState.departedPlayerName}
        games={resolverState.games}
        initialResolutions={resolverState.initialResolutions}
        onConfirm={onConfirmResolution}
        onCancel={onCancelResolution}
        roundStartHole={roundStartHole}
      />

      {/* ── Reorder Departures modal ──
          Fired by ScoreGrid when a long-press X creates an out-of-order
          proactive departure. On confirm, executes the §8.6 clear-and-replay
          flow (inside useDepartureResolver). */}
      <ReorderDeparturesModal
        open={reorderModalState.open}
        newPlayerName={
          reorderModalState.newPlayerIdx != null
            ? (activePlayers[reorderModalState.newPlayerIdx]?.name || '?')
            : ''
        }
        newHole={reorderModalState.newDepartureHole}
        conflictingPlayerName={
          reorderModalState.conflictingPlayerIdx != null
            ? (activePlayers[reorderModalState.conflictingPlayerIdx]?.name || '?')
            : ''
        }
        conflictingHole={reorderModalState.conflictingDepartureHole}
        onCancel={cancelReorderModal}
        onConfirm={confirmReorderModal}
      />

      {/* ── Undo departure prompt ──
          Styled inline modal. undoPromptPi state lives in useDepartureResolver;
          ScorecardPage owns only the render. */}
      {undoPromptPi != null && (() => {
        const playerName = activePlayers[undoPromptPi]?.name || 'Player';
        return (
          <div
            style={{
              position: 'fixed', inset: 0, zIndex: 450,
              background: 'rgba(0,0,0,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 20,
            }}
            onClick={cancelUndoPrompt}
          >
            <div
              onClick={e => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={`Resume scoring for ${playerName}?`}
              style={{
                background: '#fff',
                borderRadius: 14,
                padding: '20px 18px 18px',
                width: '100%',
                maxWidth: 340,
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 16, color: G, marginBottom: 6 }}>
                Resume scoring for {playerName}?
              </div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>
                {playerName} was marked as departed. Resuming will unlock their remaining holes.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  type="button"
                  onClick={cancelUndoPrompt}
                  style={{
                    padding: '11px 14px', borderRadius: 10,
                    border: '1.5px solid #ccc', background: '#fff', color: '#444',
                    fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmUndoFromPrompt}
                  style={{
                    padding: '11px 14px', borderRadius: 10,
                    border: 'none', background: G, color: '#fff',
                    fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  Yes, resume
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
});

export default ScorecardPage;
