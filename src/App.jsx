import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { GLOBAL_CSS } from './components/ui.jsx';
// Note (13-E.2): G token import dropped — was used by inline <nav> JSX which
// moved to BottomNav.jsx. BottomNav imports G directly.
import { ls, SK } from './services/storage.js';
import { roundLib } from './services/roundLib.js';
import { computePayouts } from './engine/payouts.js';
import { buildPayoutArgs } from './services/roundUtils.js';
import { triggerExport } from './services/exportUtils.js';
import { useIsLandscape } from './hooks/useIsLandscape.js';
import BottomNav from './components/BottomNav.jsx';
import { CENTER_FLOW_TABS } from './components/NavIcons.jsx';

import HomePage           from './pages/HomePage.jsx';
import PlayersPage        from './pages/PlayersPage.jsx';
import CoursesPage        from './pages/CoursesPage.jsx';
import NewRoundPage       from './pages/NewRoundPage.jsx';
import ScorecardPage      from './pages/ScorecardPage.jsx';
import ResultsPage        from './pages/ResultsPage.jsx';
import HistoryPage        from './pages/HistoryPage.jsx';
import { RoundSummaryModal } from './pages/RoundSummaryModal.jsx';

// ✅ Self-checked (13-E.2): App.jsx slim-down. Four extractions completed:
//   (1) Nav SVG icons + SIDE_TABS + CENTER_FLOW_TABS → components/NavIcons.jsx.
//       App.jsx imports CENTER_FLOW_TABS only (used by `centerActive` derivation).
//   (2) Bottom-nav <nav> JSX → components/BottomNav.jsx. Replaced inline JSX
//       with <BottomNav .../>; props wired: tab, setTab, inProgress,
//       centerActive, onCenterTap=handleCenterTap, navBarHeight=NAV_BAR_HEIGHT.
//       H-11 preserved: handleCenterTap (still defined here) owns the
//       startTriggerRef call when inProgress && tab === 'new-round'.
//   (3) makeExportFilename + triggerExport → services/exportUtils.js.
//       App.jsx imports triggerExport only (handleSaveRound call site).
//   (4) useIsLandscape hook → hooks/useIsLandscape.js. Replaces the local
//       useState+useEffect pair (prior lines 366–375). H-4 preserved:
//       ScorecardPage continues computing its own.
//   NAV_BAR_HEIGHT and ACTION_BAR_HEIGHT remain local to App.jsx
//   (constants/layout.js holds different values for Scorecard/Results pages —
//   reconciliation is a known open item, out of scope here). Round-lifecycle
//   handlers (handleStartRound, handleSaveRound, handleGoResults,
//   handleBackToSetup, handleLoadRound, handleDiscardRound, handleHomeNewRound,
//   handleCenterTap) are state-machine code and stay in App.jsx as scoped.

// ── Layout constants ──────────────────────────────────────────────────────────
// NAV_BAR_HEIGHT: fixed bottom nav bar height (px, excludes safe-area-inset).
// ACTION_BAR_HEIGHT: pinned action bar height used by Scorecard and Results.
// If either value changes, update the matching constants in ScorecardPage.jsx
// and ResultsPage.jsx as well (known duplication — tracked in ASS open items).
const NAV_BAR_HEIGHT    = 68;
const ACTION_BAR_HEIGHT = 52;

// 13-C.2: `strokePlayIncompleteMsg` was removed. Per PartialGameContract §1A.6,
// Results → is always tappable (including mid-round for in-progress standings).
// The save-time gate lives in ResultsPage.jsx `getMissingScoresError` where it
// is the correct guard for writing incomplete rounds to history.

// ── Helper: clear all round-related local state ───────────────────────────────
function clearRoundStorage() {
  ls.del(SK.activeRound);
  localStorage.removeItem('golf_round_setup_v5');
}

export default function App() {
  const [tab, setTab] = useState('home');
  const [loadedRoundSetup, setLoadedRoundSetup] = useState(null);

  // ── A-6: roundVersion makes inProgress reactive ───────────────────────────
  const [roundVersion, setRoundVersion] = useState(0);

  // ── A-2: newRoundKey forces NewRoundPage to remount blank ────────────────
  const [newRoundKey, setNewRoundKey] = useState(0);

  // ── R-4: summaryRound — round to show in read-only RoundSummaryModal ─────
  const [summaryRound, setSummaryRound] = useState(null);

  // Ref to NewRoundPage's handleStart — used by center button to trigger
  // Start Scoring when the user is on the new-round tab with a round in progress.
  const startTriggerRef = useRef(null);

  // ── A-6: inProgress derived from roundVersion so it updates reactively ───
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const inProgress = useMemo(() => !!ls.get(SK.activeRound), [roundVersion]);

  // ── Scroll to top on every tab change ────────────────────────────────────
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);

  const getActiveRound = useCallback(() => {
    const ar = ls.get(SK.activeRound);
    if (!ar) return ar;
    // Ensure gameOpts always has grossNetNOL set (migrates rounds saved before 11-I.3).
    // NOTE: Stableford skips the o.scoring fallback — in Stableford, opts.scoring holds
    // the team hole-scoring rule ('cumulative'|'bestball'), not a handicap mode value.
    const GNL_DEFAULTS = { 'Stroke Play': 'gross', Dots: 'gross', Stableford: 'net' };
    const go = ar.gameOpts || {};
    let changed = false;
    const migratedOpts = Object.fromEntries(
      Object.entries(go).map(([g, o]) => {
        if (o && o.grossNetNOL === undefined) {
          changed = true;
          const gnl = g === 'Stableford'
            ? (GNL_DEFAULTS[g] || 'net')
            : (o.scoring ?? (GNL_DEFAULTS[g] || 'net'));
          return [g, { ...o, grossNetNOL: gnl }];
        }
        return [g, o];
      })
    );
    if (!changed) return ar;
    return { ...ar, gameOpts: migratedOpts };
  }, []);

  const saveActiveRound = useCallback((data) => {
    ls.set(SK.activeRound, data);
    setRoundVersion(v => v + 1);
  }, []);

  const clearActiveRound = useCallback(() => {
    clearRoundStorage();
    setRoundVersion(v => v + 1);
  }, []);

  const handleStartRound = useCallback((roundState) => {
    saveActiveRound(roundState);
    setTab('scorecard');
  }, [saveActiveRound]);

  // 13-C.7.5 / v2.0: Reactive resolver trigger ref. ScorecardPage exposes
  // `triggerReactiveResolver()` which fires the sequenced chain when there
  // are unresolved departure events, then calls back into onResults when
  // the chain completes.
  const scorecardRef = useRef(null);

  // Internal: actually transition to Results — runs payouts compute and
  // switches the tab. Called either directly (no resolution needed) or by
  // the sequencer's onChainComplete callback after the user finishes the
  // resolver chain.
  const performGoResults = useCallback(() => {
    const ar = getActiveRound();
    if (!ar) return;
    try {
      const result = computePayouts(buildPayoutArgs(ar));
      saveActiveRound({ ...ar, breakdown: result.breakdown, bank: result.bank });
    } catch(e) { console.error('Payout compute error:', e); }
    setTab('results');
  }, [getActiveRound, saveActiveRound]);

  const handleGoResults = useCallback(() => {
    const ar = getActiveRound();
    if (!ar) return;
    // 13-C.2: Results → is always tappable per PartialGameContract §1A.6,
    // including mid-round (shows current standings on scores entered so far).
    // The prior Stroke Play incomplete-scores gate was moved to the save-time
    // check in ResultsPage (`getMissingScoresError`) which is the correct guard.
    //
    // 13-C.7.5 / v2.0: Before transitioning, fire the reactive resolver
    // chain if any unresolved departure events exist. The chain's
    // onChainComplete callback will call performGoResults when finished.
    // If no chain is needed (no events, or all events skip-when-current),
    // performGoResults runs immediately.
    const fired = scorecardRef.current?.triggerReactiveResolver?.(performGoResults);
    if (fired) {
      // Chain is in flight (or completed synchronously via skip-when-current,
      // in which case onChainComplete already called performGoResults).
      // Either way, do not transition here — performGoResults handles it.
      return;
    }
    performGoResults();
  }, [getActiveRound, performGoResults]);

  // G-6: Auto-export on save
  const handleSaveRound = useCallback(async () => {
    const ar = getActiveRound();
    if (!ar) return;
    let arToSave = ar;
    try {
      const result = computePayouts(buildPayoutArgs(ar));
      arToSave = { ...ar, breakdown: result.breakdown, bank: result.bank };
      saveActiveRound(arToSave);
    } catch(e) {
      console.error('Payout recompute error on save:', e);
    }
    roundLib.saveFromActive(arToSave);
    clearRoundStorage();
    setRoundVersion(v => v + 1);
    setNewRoundKey(k => k + 1);
    setLoadedRoundSetup(null);
    try { await triggerExport(); } catch(e) { console.error('Auto-export error (non-fatal):', e); }
    setTab('history');
  }, [getActiveRound, saveActiveRound]);

  // ── A-1: Discard the active round ────────────────────────────────────────
  const handleDiscardRound = useCallback(() => {
    clearRoundStorage();
    setRoundVersion(v => v + 1);
    setNewRoundKey(k => k + 1);
    setLoadedRoundSetup(null);
    setTab('home');
  }, []);

  // ── A-2: New Round from HomePage ─────────────────────────────────────────
  const handleHomeNewRound = useCallback(() => {
    const existing = ls.get(SK.activeRound);
    if (existing) {
      const ok = window.confirm('Starting a new round will discard your round in progress. Continue?');
      if (!ok) return;
      clearRoundStorage();
      setRoundVersion(v => v + 1);
    }
    setNewRoundKey(k => k + 1);
    setLoadedRoundSetup(null);
    setTab('new-round');
  }, []);

  // ── Back to setup from scorecard ─────────────────────────────────────────
  const handleBackToSetup = useCallback(() => {
    const ar = getActiveRound();
    if (ar) {
      const shim = roundLib.fromActiveRound(ar);
      setLoadedRoundSetup(roundLib.toSetupState(shim));
      setNewRoundKey(k => k + 1);
    }
    setTab('new-round');
  }, [getActiveRound]);

  // ── G-7: History-load conflict warning ───────────────────────────────────
  const handleLoadRound = useCallback((r) => {
    try {
      const existingAr = ls.get(SK.activeRound);
      if (existingAr) {
        const hasScores = existingAr.scores?.some(holeScores =>
          holeScores?.some(s => s !== '' && s != null)
        );
        if (hasScores) {
          const ok = window.confirm('Loading this round will replace your round in progress. Continue?');
          if (!ok) return;
        }
      }
      saveActiveRound(roundLib.toActiveRound(r));
      setLoadedRoundSetup(roundLib.toSetupState(r));
      setTab('new-round');
    } catch(e) {
      console.error('handleLoadRound failed:', e);
      alert('Could not load round: ' + e.message);
    }
  }, [saveActiveRound]);

  // ── Center button tap handler ─────────────────────────────────────────────
  // When a round is in progress and the user is on the new-round tab,
  // treat the center button as "Start Scoring" — run the full round assembly
  // so any setup changes are committed before navigating to the scorecard.
  // Otherwise navigate to the scorecard directly (already scored round), or
  // to new-round setup (no round in progress).
  const handleCenterTap = useCallback(() => {
    if (inProgress && tab === 'new-round') {
      startTriggerRef.current?.();
    } else if (inProgress) {
      setTab('scorecard');
    } else {
      setNewRoundKey(k => k + 1);
      setLoadedRoundSetup(null);
      setTab('new-round');
    }
  }, [inProgress, tab]);

  const centerActive = CENTER_FLOW_TABS.has(tab);

  // Landscape detection for full-width scorecard/results layout
  const isLandscape = useIsLandscape();

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f0f7f0',
      fontFamily: "'DM Sans','Helvetica Neue',sans-serif",
      color: '#222',
      touchAction: 'pan-y',
      WebkitTextSizeAdjust: '100%',
      overflowX: 'clip',
      paddingBottom: `calc(${NAV_BAR_HEIGHT}px + env(safe-area-inset-bottom))`,
    }}>
      <style>{GLOBAL_CSS}</style>

      <div style={{ maxWidth: isLandscape ? 'none' : 520, margin: '0 auto' }}>
        {tab === 'home'      && <HomePage      onNewRound={handleHomeNewRound} onResume={() => setTab('scorecard')} onHistory={() => setTab('history')} inProgress={inProgress} onRoundTap={r => setSummaryRound(r)}/>}
        {tab === 'players'   && <PlayersPage />}
        {tab === 'courses'   && <CoursesPage />}
        {tab === 'new-round' && (
          <NewRoundPage
            key={newRoundKey}
            onStart={handleStartRound}
            onGoScorecard={() => setTab('scorecard')}
            onSaveEdits={() => { setLoadedRoundSetup(null); setTab('history'); }}
            inProgress={inProgress}
            loadedRound={loadedRoundSetup}
            onLoadedRoundConsumed={() => setLoadedRoundSetup(null)}
            getActiveRound={getActiveRound}
            startTriggerRef={startTriggerRef}
          />
        )}
        {tab === 'scorecard' && <ScorecardPage ref={scorecardRef} getActiveRound={getActiveRound} saveActiveRound={saveActiveRound} onResults={handleGoResults} onBack={handleBackToSetup} onDiscard={handleDiscardRound}/>}
        {tab === 'results'   && <ResultsPage   getActiveRound={getActiveRound} onSave={handleSaveRound} onBack={() => setTab('scorecard')}/>}
        {tab === 'history'   && <HistoryPage   onLoadRound={handleLoadRound}/>}
      </div>

      <BottomNav
        tab={tab}
        setTab={setTab}
        inProgress={inProgress}
        centerActive={centerActive}
        onCenterTap={handleCenterTap}
        navBarHeight={NAV_BAR_HEIGHT}
      />

      {/* R-4: RoundSummaryModal overlay */}
      {summaryRound && (
        <RoundSummaryModal r={summaryRound} onClose={() => setSummaryRound(null)} />
      )}
    </div>
  );
}
