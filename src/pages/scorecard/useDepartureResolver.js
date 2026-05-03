// ─── useDepartureResolver.js ──────────────────────────────────────────────────
// Custom hook: departure resolver chain state machine.
//
// Extracted from ScorecardPage.jsx (13-C.6 / 13-C.7 / 13-C.7.5 / v2.0).
// Contains zero JSX and zero scoring logic. Owns:
//   - Sequenced per-player departure event chain (proactive + reactive)
//   - Reorder Departures modal state + clear-and-replay flow
//   - Undo departure prompt state
//
// Callers:
//   ScorecardPage.jsx — destructures the returned object and passes callbacks
//   down to ScoreGrid / DepartureResolverSheet / ReorderDeparturesModal.
//   triggerReactiveResolver is forwarded via useImperativeHandle in ScorecardPage.
//
// Governing contracts:
//   PartialGameContract.md §5.4 (sequenced-event model)
//   PartialGameContract.md §5.4.4 (group-stop write rule)
//   PartialGameContract.md §5.4.5 (skip-when-current)
//   PartialGameContract.md §8.4 (undo — scores unchanged)
//   PartialGameContract.md §8.6 (reorder clear-and-replay)
//   Resolver_UI_Spec §2.1 v1.1 (departedPlayerName: string, singular)
//   Resolver_UI_Spec §6.6 (sequencer controller / carry-forward source-of-truth)

import { useCallback, useRef, useState } from 'react';
import {
  buildResolverGameRows,
  classifyPlayersAtResults,
  evalCarryForward,
  defaultsForFamily,
} from './resolverUtils.js';

// ── useDepartureResolver ───────────────────────────────────────────────────────
//
// @param {object} params
//   getActiveRound  — () => activeRound blob (reads fresh from localStorage)
//   saveActiveRound — (blob) => void
//   ar              — the activeRound snapshot captured at render time
//
// @returns {object}  See "Returned interface" section at bottom of this file.
//
export function useDepartureResolver({ getActiveRound, saveActiveRound, ar }) {

  // ── Resolver sheet state ───────────────────────────────────────────────────
  //
  // v2.0 (Resolver_UI_Spec §2.1 v1.1): canonical prop is
  // `departedPlayerName: string` (singular).
  const [resolverState, setResolverState] = useState({
    open: false,
    departedPlayerName: '',
    departureHole: 0,
    departedPlayerIdx: null,
    eventOrder: 0,
    games: [],
    initialResolutions: {},
  });

  // ── Chain refs ─────────────────────────────────────────────────────────────
  //
  // Pending events queue and confirmed-events accumulator. Use refs so the
  // sequencer's onConfirm callback (created with useCallback) can read the
  // most-recent values without re-binding on every confirm.
  const pendingEventsRef   = useRef([]); // events not yet shown
  const confirmedEventsRef = useRef([]); // events already confirmed this chain
  const chainContextRef    = useRef(null); // { allEarlyDeparture, onChainComplete }

  // ── buildEventState ────────────────────────────────────────────────────────
  //
  // Build the resolver props for a single event from the current activeRound
  // plus carry-forward state from all prior events (eventOrder < this event).
  // Returns { skip: true, resolutions } if the sheet should be skipped
  // (per §5.4.5 — already current with carry-forward).
  // Returns { skip: false, sheetState } if the sheet should open.
  //
  // 13-C.7.6 fix: carry-forward is sourced from activeRound.earlyDepartureOpts
  // (the saved source of truth) rather than confirmedEventsRef. This matters
  // because a reactive chain (Results → tap) must see proactive resolutions
  // that were confirmed in a prior chain and written to earlyDepartureOpts but
  // are no longer in confirmedEventsRef (cleared at end of prior chain).
  // See Resolver_UI_Spec §6.6 and PartialGameContract §5.4.5.
  const buildEventState = useCallback((event, activeRound) => {
    const opts = activeRound.earlyDepartureOpts || {};

    // Compose all prior events from earlyDepartureOpts (eventOrder < this event).
    const priorEvents = Object.entries(opts)
      .map(([piStr, e]) => ({
        pi:              Number(piStr),
        departureHole:   e?.departureHole,
        eventOrder:      e?.eventOrder,
        gameResolutions: e?.gameResolutions || {},
      }))
      .filter(e =>
        Number.isFinite(e.departureHole) &&
        Number.isFinite(e.eventOrder) &&
        e.eventOrder < event.eventOrder
      )
      .sort((a, b) => a.eventOrder - b.eventOrder);

    const cf = evalCarryForward(priorEvents, activeRound);
    const departedPlayerIdxs = [event.pi];
    const games = buildResolverGameRows(
      activeRound,
      departedPlayerIdxs,
      'A',               // v2.0 — sheet is unaware of scenario distinction
      event.departureHole,
      cf
    );

    // §5.4.5 skip-when-current: if this player's saved gameResolutions cover
    // exactly the currently-shown games, skip the sheet.
    const savedOpts = opts[event.pi];
    if (savedOpts && savedOpts.gameResolutions) {
      const savedKeys = new Set(Object.keys(savedOpts.gameResolutions));
      const shownKeys = new Set(games.map(g => g.gameKey));
      const allCovered = games.every(g => savedKeys.has(g.gameKey));
      const noExtras   = [...savedKeys].every(k => shownKeys.has(k));
      if (allCovered && noExtras && games.length === savedKeys.size) {
        return { skip: true, resolutions: savedOpts.gameResolutions };
      }
    }

    // Auto-skip if no games to resolve (everything finished by prior events).
    // Per §5.4.3.
    if (games.length === 0) {
      return { skip: true, resolutions: {} };
    }

    // Build per-family defaults with carry-forward context.
    const initialResolutions = {};
    games.forEach(gr => {
      initialResolutions[gr.gameKey] = defaultsForFamily(gr, cf[gr.gameKey]);
    });

    const player = activeRound.activePlayers?.[event.pi];
    const departedPlayerName = player?.name || '?';

    return {
      skip: false,
      sheetState: {
        open: true,
        departedPlayerName,
        departureHole:    event.departureHole,
        departedPlayerIdx: event.pi,
        eventOrder:       event.eventOrder,
        games,
        initialResolutions,
      },
    };
  }, []);

  // ── finishChain ────────────────────────────────────────────────────────────
  //
  // Apply the §5.4.4 group-stop write and clear all chain refs.
  // Called when pendingEventsRef is empty after the last confirm (or after
  // all events were skipped).
  const finishChain = useCallback(() => {
    const ctx    = chainContextRef.current;
    const latest = getActiveRound() || ar;

    // Persist all confirmed event resolutions into earlyDepartureOpts.
    // (Most were already written incrementally in onConfirmResolution, but
    // we consolidate here for robustness against any drift.)
    const newOpts = { ...(latest.earlyDepartureOpts || {}) };
    confirmedEventsRef.current.forEach(ev => {
      newOpts[ev.pi] = {
        departureHole:   ev.departureHole,
        eventOrder:      ev.eventOrder,
        gameResolutions: ev.gameResolutions,
      };
    });

    // §5.4.4 group-stop write: if every player is early-departure, the LAST
    // event in the chain also writes lastCompletedHole and earlyEndOpts.
    let updates = { earlyDepartureOpts: newOpts };
    if (ctx?.allEarlyDeparture && confirmedEventsRef.current.length > 0) {
      const lastEvent = confirmedEventsRef.current[confirmedEventsRef.current.length - 1];
      updates.lastCompletedHole = lastEvent.departureHole;
      updates.earlyEndOpts      = lastEvent.gameResolutions;
    }

    saveActiveRound({ ...latest, ...updates });
    setResolverState(s => ({ ...s, open: false }));

    // Reset chain refs.
    pendingEventsRef.current   = [];
    confirmedEventsRef.current = [];
    chainContextRef.current    = null;

    // Notify caller (App.handleGoResults) the chain is complete.
    if (ctx?.onChainComplete) {
      ctx.onChainComplete();
    }
  }, [getActiveRound, ar, saveActiveRound]);

  // ── fireNextEvent ──────────────────────────────────────────────────────────
  //
  // Fire the next event in the chain (or finish the chain if the queue is
  // empty). Skips events whose carry-forward makes them current (§5.4.5).
  const fireNextEvent = useCallback(() => {
    const latest = getActiveRound() || ar;

    while (pendingEventsRef.current.length > 0) {
      const event  = pendingEventsRef.current[0];
      const result = buildEventState(event, latest);

      if (!result.skip) {
        // Open the sheet. The event stays at queue head until confirmed/cancelled.
        setResolverState(result.sheetState);
        return;
      }

      // Skip — auto-record resolutions and advance.
      pendingEventsRef.current.shift();
      confirmedEventsRef.current.push({
        pi:              event.pi,
        departureHole:   event.departureHole,
        eventOrder:      event.eventOrder,
        gameResolutions: result.resolutions,
      });
    }

    // Queue empty — chain complete.
    finishChain();
  }, [getActiveRound, ar, buildEventState, finishChain]);

  // ── onOpenDepartureResolver ────────────────────────────────────────────────
  //
  // Entry point for PROACTIVE departure (ScoreGrid long-press X).
  // Fires a single-event chain for the new departure event.
  // eventOrder = count of existing events with strictly earlier departureHole
  // + count of equal-hole events with smaller pi (stable tiebreak per §5.4.1).
  const onOpenDepartureResolver = useCallback(({ departureHole, departedPlayerIdxs }) => {
    const latest = getActiveRound() || ar;
    const existingOpts = latest.earlyDepartureOpts || {};
    const existingEvents = Object.entries(existingOpts)
      .filter(([, e]) => e && typeof e.departureHole === 'number')
      .map(([piStr, e]) => ({ pi: Number(piStr), departureHole: e.departureHole }));

    const pi = departedPlayerIdxs[0];
    const eventOrder = existingEvents.filter(e =>
      e.departureHole < departureHole ||
      (e.departureHole === departureHole && e.pi < pi)
    ).length;

    pendingEventsRef.current   = [{ pi, departureHole, eventOrder }];
    confirmedEventsRef.current = [];
    chainContextRef.current    = {
      allEarlyDeparture: false,
      onChainComplete:   null,
    };

    fireNextEvent();
  }, [getActiveRound, ar, fireNextEvent]);

  // ── onConfirmResolution ────────────────────────────────────────────────────
  //
  // Sheet's onConfirm handler — write the event's resolutions to
  // earlyDepartureOpts incrementally and advance the chain.
  const onConfirmResolution = useCallback((resolutions) => {
    const { departureHole, departedPlayerIdx, eventOrder } = resolverState;
    const latest = getActiveRound() || ar;

    // Write this event incrementally so partial-chain state survives a reload.
    const newOpts = { ...(latest.earlyDepartureOpts || {}) };
    newOpts[departedPlayerIdx] = { departureHole, eventOrder, gameResolutions: resolutions };
    saveActiveRound({ ...latest, earlyDepartureOpts: newOpts });

    confirmedEventsRef.current.push({
      pi: departedPlayerIdx, departureHole, eventOrder, gameResolutions: resolutions,
    });

    pendingEventsRef.current.shift();
    fireNextEvent();
  }, [resolverState, getActiveRound, ar, saveActiveRound, fireNextEvent]);

  // ── onCancelResolution ─────────────────────────────────────────────────────
  //
  // Sheet's onCancel handler — abort the chain. Already-confirmed events
  // remain on file (written incrementally); no group-stop write is applied.
  // Per Resolver_UI_Spec §6.6.
  const onCancelResolution = useCallback(() => {
    setResolverState(s => ({ ...s, open: false }));
    pendingEventsRef.current   = [];
    confirmedEventsRef.current = [];
    chainContextRef.current    = null;
  }, []);

  // ── triggerReactiveResolver ────────────────────────────────────────────────
  //
  // Entry point for REACTIVE departure (App.handleGoResults → Results tap).
  // ScorecardPage forwards this via useImperativeHandle so App can call it
  // through a ref.
  //
  // Returns true  → chain fired; caller should wait for onChainComplete.
  // Returns false → no pending events; caller may proceed to Results directly.
  const triggerReactiveResolver = useCallback((onChainComplete) => {
    const latest = getActiveRound() || ar;
    const result = classifyPlayersAtResults(latest);
    if (result.scenario !== 'has-departures' || result.events.length === 0) {
      return false;
    }

    pendingEventsRef.current   = result.events.slice();
    confirmedEventsRef.current = [];
    chainContextRef.current    = {
      allEarlyDeparture: result.allEarlyDeparture,
      onChainComplete:   onChainComplete || null,
    };

    fireNextEvent();
    // fireNextEvent may call finishChain synchronously (all skip-when-current).
    // Return true regardless — the caller's callback already ran.
    return true;
  }, [getActiveRound, ar, fireNextEvent]);

  // ── Reorder Departures modal ───────────────────────────────────────────────
  //
  // ScoreGrid fires onOpenReorderDeparturesModal when an out-of-order
  // proactive departure is detected. On confirm, executes the §8.6
  // clear-and-replay flow.
  const [reorderModalState, setReorderModalState] = useState({
    open:                    false,
    newPlayerIdx:            null,
    newDepartureHole:        0,
    conflictingPlayerIdx:    null,
    conflictingDepartureHole: 0,
  });

  const onOpenReorderDeparturesModal = useCallback((args) => {
    setReorderModalState({ open: true, ...args });
  }, []);

  const cancelReorderModal = useCallback(() => {
    setReorderModalState(s => ({ ...s, open: false }));
  }, []);

  // Confirm reorder: clear conflicting earlyDepartureOpts entries (those with
  // departureHole > newDepartureHole), then re-fire the full sequenced chain
  // including the new event. Per PartialGameContract §8.6.
  const confirmReorderModal = useCallback(() => {
    const { newPlayerIdx, newDepartureHole } = reorderModalState;
    setReorderModalState(s => ({ ...s, open: false }));

    const latest  = getActiveRound() || ar;
    const oldOpts = latest.earlyDepartureOpts || {};

    // Keep entries with departureHole <= newDepartureHole; drop the rest.
    const cleared = {};
    Object.entries(oldOpts).forEach(([piStr, entry]) => {
      const pi = Number(piStr);
      if (pi === newPlayerIdx) return; // guard — shouldn't be present yet
      if (entry && typeof entry.departureHole === 'number') {
        if (entry.departureHole <= newDepartureHole) {
          cleared[piStr] = entry;
        }
        // else: drop — will be re-asked
      }
    });

    saveActiveRound({
      ...latest,
      earlyDepartureOpts: Object.keys(cleared).length ? cleared : undefined,
    });

    // Build full chain: kept events + new event + dropped events, sorted
    // by departureHole ascending, tiebroken by pi.
    const remainingEvents = Object.entries(cleared)
      .map(([piStr, e]) => ({ pi: Number(piStr), departureHole: e.departureHole }));

    const droppedEvents = Object.entries(oldOpts)
      .filter(([piStr, e]) =>
        Number(piStr) !== newPlayerIdx &&
        e && typeof e.departureHole === 'number' &&
        e.departureHole > newDepartureHole
      )
      .map(([piStr, e]) => ({ pi: Number(piStr), departureHole: e.departureHole }));

    const allEvents = [
      ...remainingEvents,
      { pi: newPlayerIdx, departureHole: newDepartureHole },
      ...droppedEvents,
    ].sort((a, b) => {
      const dh = a.departureHole - b.departureHole;
      return dh !== 0 ? dh : a.pi - b.pi;
    });

    // Re-assign eventOrder.
    pendingEventsRef.current   = allEvents.map((e, i) => ({ ...e, eventOrder: i }));
    confirmedEventsRef.current = [];
    chainContextRef.current    = { allEarlyDeparture: false, onChainComplete: null };

    fireNextEvent();
  }, [reorderModalState, getActiveRound, ar, saveActiveRound, fireNextEvent]);

  // ── Undo departure prompt ──────────────────────────────────────────────────
  //
  // Long-press on a dimmed player name in ScoreGrid fires
  // onUndoDeparturePrompt(pi). ScorecardPage renders the styled modal;
  // this hook owns only the state and the write.
  //
  // Per PartialGameContract §8.4: scores at and after the departure hole are
  // unchanged by undo. The long-press X gesture does not write any score
  // (per §8.2 v1.9), so post-undo cells are whatever the user originally
  // entered (typically blank) and ready for normal entry.
  const [undoPromptPi, setUndoPromptPi] = useState(null);

  const onUndoDeparturePrompt = useCallback((pi) => {
    setUndoPromptPi(pi);
  }, []);

  const cancelUndoPrompt = useCallback(() => {
    setUndoPromptPi(null);
  }, []);

  const confirmUndoFromPrompt = useCallback(() => {
    const pi = undoPromptPi;
    if (pi == null) return;
    const latest  = getActiveRound() || ar;
    const newOpts = { ...(latest.earlyDepartureOpts || {}) };
    delete newOpts[pi];
    saveActiveRound({
      ...latest,
      earlyDepartureOpts: Object.keys(newOpts).length ? newOpts : undefined,
    });
    setUndoPromptPi(null);
  }, [undoPromptPi, getActiveRound, ar, saveActiveRound]);

  // ── Returned interface ─────────────────────────────────────────────────────
  //
  // resolverState             — props for <DepartureResolverSheet>
  // reorderModalState         — props for <ReorderDeparturesModal>
  // undoPromptPi              — player index with pending undo (null = closed)
  // onOpenDepartureResolver   — proactive entry point (ScoreGrid long-press X)
  // onConfirmResolution       — sheet confirm handler
  // onCancelResolution        — sheet cancel handler
  // triggerReactiveResolver   — reactive entry point (App via useImperativeHandle)
  // onOpenReorderDeparturesModal — reorder entry point (ScoreGrid out-of-order)
  // cancelReorderModal        — reorder cancel handler
  // confirmReorderModal       — reorder confirm + clear-and-replay handler
  // onUndoDeparturePrompt     — open undo prompt for player pi
  // cancelUndoPrompt          — close undo prompt without writing
  // confirmUndoFromPrompt     — delete earlyDepartureOpts[pi] and close
  return {
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
  };
}
