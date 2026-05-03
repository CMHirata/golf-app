// ─── scorecard/DepartureResolverSheet.jsx ─────────────────────────────────────
// RENDER ONLY — no business logic in this file.
// No scoring calculations. No match state computation.
// All logic must come from engine/ or scorecardUtils.js
//
// ✅ Self-checked (13-C.8.1): Team Dots lock-to-parent enforcement. When a
// game row carries `parentGameKey` (set by resolverUtils for team-mode Dots
// locked to Sixes / a team Match), the sheet computes a `lockedTo` prop
// based on the parent's CURRENT DRAFT resolution and passes it to the
// GameResolutionRow:
//   parent = abandon  → Dots locked to { topLevel: 'abandon',  reason: ... }
//   parent = end_at_k → Dots locked to { topLevel: 'end_at_k', reason: ... }
//   parent = continue / unset → no lock (Dots row is freely editable)
// The lock is recomputed on every draft change, so a user toggling the
// parent's pill immediately reflects in the locked Dots row. The sheet
// also auto-syncs the draft so the locked decision is committed on Confirm
// even if the user never tapped the (disabled) Dots pill.
//
// ✅ Self-checked (13-C.7.5 / v2.0): Prop migration per Resolver_UI_Spec
// §2.1 v1.1. Canonical prop is `departedPlayerName: string` (singular).
// The v1.0 plural form `departedPlayerNames: string[]` is retained as a
// deprecated alias for backward-compat with 13-C.6 storage shape — when
// provided, the sheet uses `[0]` and emits a console warning. The `scenario`
// prop is now optional and ignored — the v2.0 sequenced model handles
// Scenario A/B routing in the sequencer (ScorecardPage); the sheet itself
// always renders a single departed player.
//
// ✅ Self-checked (13-E.4): Header copy edge-case fix. New optional prop
// `roundStartHole` (default 0). When `departureHole < roundStartHole`, the
// header reads "[Name] left before hole [roundStartHole + 1]" instead of
// "[Name] left after hole [departureHole + 1]". This covers two cases:
// (a) long-press X on the round's first hole → departureHole one less than
// roundStartHole (e.g. -1 for full round, 8 for back-9 round); (b) any
// future code path producing a pre-start departureHole. Default of 0
// preserves byte-identical behavior for all existing call sites that do
// not yet pass the prop.
//
// ✅ Self-checked (13-C.6): Bottom-sheet modal per Resolver_UI_Spec §2.1.
// Owns its own draft selection state internally per §2.4(a) — parent
// receives a SINGLE onConfirm event with the final committed map; no
// incremental change events. Cancel discards the draft. Re-seeded from
// `initialResolutions` whenever `open` transitions from false → true
// (failure-mode check 8c bullet 5). ESC + backdrop tap fire onCancel per
// §2.5.

import { useEffect, useRef, useState } from 'react';
import { Btn, G } from '../../components/ui.jsx';
import { GameResolutionRow } from './GameResolutionRow.jsx';

// Deep-merge a partial resolution into the draft. Sub-maps `segments` and
// `presses` are shallow-merged (the caller always sends a single-key
// object for these); other fields are replaced.
function mergeDraft(prevForGame, partial) {
  const next = { ...prevForGame, ...partial };
  if (partial.segments) {
    next.segments = { ...(prevForGame.segments || {}), ...partial.segments };
  }
  if (partial.presses) {
    next.presses = { ...(prevForGame.presses || {}), ...partial.presses };
  }
  // If topLevelVariant is explicitly undefined in the partial (i.e. the user
  // switched to abandon/continue/exclude_player or to a non-clinch end_at_k),
  // remove it so it doesn't linger and accidentally re-apply on a later
  // re-selection of a clinch variant.
  if ('topLevelVariant' in partial && partial.topLevelVariant === undefined) {
    delete next.topLevelVariant;
  }
  return next;
}

// Resolve the canonical name from either the v1.1 singular prop or the
// v1.0 deprecated plural alias. Logs a one-time console warning when the
// deprecated form is used.
let _hasWarnedPluralAlias = false;
function resolveSingleName(departedPlayerName, departedPlayerNames) {
  if (typeof departedPlayerName === 'string' && departedPlayerName.length > 0) {
    return departedPlayerName;
  }
  if (Array.isArray(departedPlayerNames) && departedPlayerNames.length > 0) {
    if (!_hasWarnedPluralAlias) {
      _hasWarnedPluralAlias = true;
      console.warn(
        '[DepartureResolverSheet] `departedPlayerNames: string[]` is the v1.0 ' +
        'deprecated alias. Use `departedPlayerName: string` (singular) per ' +
        'Resolver_UI_Spec §2.1 v1.1. Using departedPlayerNames[0].'
      );
    }
    return departedPlayerNames[0];
  }
  return '';
}

// 13-C.8.1: Compute the lock state for a Dots row whose `parentGameKey` is
// set (team-mode Dots locked to a parent team game). Returns:
//   { topLevel: 'abandon',  reason } when parent.topLevel === 'abandon'
//   { topLevel: 'end_at_k', reason } when parent.topLevel === 'end_at_k'
//   null otherwise (continue / unset / exclude_player → Dots is free)
//
// `parentResolution` is the draft entry for the parent game; `departureHole`
// is the current event's hole, used to format the "ends at hole X" reason.
function computeLockedToFromParent(parentResolution, parentLabel, departureHole) {
  const tl = parentResolution?.topLevel;
  if (!tl) return null;
  if (tl === 'abandon') {
    return {
      topLevel: 'abandon',
      reason:   `Locked to ${parentLabel} — parent abandoned`,
    };
  }
  if (tl === 'end_at_k') {
    return {
      topLevel: 'end_at_k',
      reason:   `Locked to ${parentLabel} — ends at hole ${departureHole + 1}`,
    };
  }
  return null;
}

// 13-C.8.1: look up a parent game's display label from the games list. The
// parentGameKey on a Dots row is either 'Sixes' (literal) or a matchDef.id
// (e.g., 'mp_0-1') when teamMode is `Match:<id>`. We display "Sixes" verbatim
// for the Sixes case and the parent gameRow's label (which is the match's
// "Match A (Tom vs Dave)" string) when matched.
function lookupParentLabel(games, parentGameKey) {
  if (parentGameKey === 'Sixes') return 'Sixes';
  const match = (games || []).find(g => g.gameKey === parentGameKey);
  return match?.label || parentGameKey;
}

export function DepartureResolverSheet({
  open,
  scenario,                  // v1.0 — optional and ignored in v2.0
  departureHole,
  departedPlayerName,        // v1.1 canonical (singular)
  departedPlayerNames,       // v1.0 deprecated alias (array)
  games,
  initialResolutions,
  onConfirm,
  onCancel,
  roundStartHole = 0,        // 13-E.4: header copy edge-case for pre-start departures
}) {
  const [draft, setDraft] = useState(initialResolutions || {});
  const wasOpenRef = useRef(false);
  const cardRef    = useRef(null);
  const firstFocusRef = useRef(null);

  // Re-seed draft from initialResolutions on each open (false→true transition).
  // Do NOT re-seed on every render — that would clobber the user's in-flight
  // selections every time the parent re-renders.
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setDraft(initialResolutions || {});
    }
    wasOpenRef.current = open;
  }, [open, initialResolutions]);

  // ESC closes (Cancel) per §2.5.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onCancel?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  // Initial focus on first interactive control on open.
  useEffect(() => {
    if (!open) return;
    // Defer one tick so the sheet has mounted before .focus() runs.
    const t = setTimeout(() => {
      if (firstFocusRef.current && typeof firstFocusRef.current.focus === 'function') {
        try { firstFocusRef.current.focus(); } catch (_) {}
      }
    }, 0);
    return () => clearTimeout(t);
  }, [open]);

  // 13-C.8.1: Auto-sync the draft for any locked rows. When a user toggles
  // the parent's (Sixes / team Match) top-level, the locked child Dots row's
  // draft must follow so it commits on Confirm even if the user never
  // interacts with the (disabled) Dots pills. We recompute on every draft
  // change. The auto-sync also resets segments/presses on the Dots row when
  // its forced topLevel changes (matches the user-driven reset behavior in
  // GameResolutionRow's partialFromOption).
  useEffect(() => {
    if (!open) return;
    if (!Array.isArray(games)) return;
    let changed = false;
    let nextDraft = draft;
    for (const gr of games) {
      if (!gr.parentGameKey) continue;
      const parentRes  = nextDraft[gr.parentGameKey];
      const parentLbl  = lookupParentLabel(games, gr.parentGameKey);
      const lockedTo   = computeLockedToFromParent(parentRes, parentLbl, departureHole);
      if (!lockedTo) continue;
      const childRes   = nextDraft[gr.gameKey] || {};
      if (childRes.topLevel === lockedTo.topLevel) continue;
      // Apply the forced topLevel; clear segments/presses (consistent with
      // the rest-on-topLevel-change pattern noted in Resolver_UI_Spec §10.1).
      nextDraft = {
        ...nextDraft,
        [gr.gameKey]: { topLevel: lockedTo.topLevel },
      };
      changed = true;
    }
    if (changed) setDraft(nextDraft);
  }, [open, draft, games, departureHole]);

  if (!open) return null;

  // v2.0 (Resolver_UI_Spec §2.1 v1.1): always single-name header.
  // 13-E.4: When `departureHole < roundStartHole`, the player departed before
  // the round's first hole was completed (e.g. long-press X on hole 1 of an
  // 18-hole round → departureHole = -1, or long-press X on hole 10 of a
  // back-9 round → departureHole = 8 < roundStartHole = 9). In that case
  // "left after hole 0" / "left after hole 9" reads awkwardly or untruthfully;
  // use "left before hole {roundStartHole + 1}" instead. The parallel
  // "[Name] left [preposition] hole [n]" structure is preserved.
  const name = resolveSingleName(departedPlayerName, departedPlayerNames);
  const headerText = departureHole < roundStartHole
    ? `${name} left before hole ${roundStartHole + 1}`
    : `${name} left after hole ${departureHole + 1}`;

  const handlePartial = (gameKey, partial) => {
    setDraft(prev => ({
      ...prev,
      [gameKey]: mergeDraft(prev[gameKey] || {}, partial),
    }));
  };

  const handleConfirm = () => {
    onConfirm?.(draft);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div
        ref={cardRef}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={headerText}
        style={{
          background: '#fff',
          borderRadius: '20px 20px 0 0',
          width: '100%',
          maxWidth: 520,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.18)',
        }}
      >
        {/* ── Header ── */}
        <div style={{ padding: '18px 18px 6px' }}>
          <div style={{ fontWeight: 800, fontSize: 16, color: G }}>
            {headerText}
          </div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 3 }}>
            How should each game be resolved?
          </div>
        </div>

        {/* ── Body — scrollable list of GameResolutionRow ── */}
        <div style={{
          flex: '1 1 auto',
          overflowY: 'auto',
          padding: '4px 18px 12px',
        }}>
          {(games || []).length === 0 ? (
            <div style={{ fontSize: 12, color: '#999', textAlign: 'center', padding: '24px 0' }}>
              No active games involve {name || 'the departed player'}.
            </div>
          ) : (
            (games || []).map((gr, idx) => {
              // 13-C.8.1: compute lockedTo for team-mode Dots rows (rows
              // whose parentGameKey points at Sixes / a team Match in the
              // SAME event). Other rows pass undefined → no lock applied.
              let lockedTo;
              if (gr.parentGameKey) {
                const parentRes = draft[gr.parentGameKey];
                const parentLbl = lookupParentLabel(games, gr.parentGameKey);
                lockedTo = computeLockedToFromParent(parentRes, parentLbl, departureHole);
              }
              return (
                <div key={gr.gameKey} ref={idx === 0 ? firstFocusRef : null} tabIndex={idx === 0 ? -1 : undefined}>
                  <GameResolutionRow
                    gameRow={gr}
                    resolution={draft[gr.gameKey] || {}}
                    onChange={handlePartial}
                    lockedTo={lockedTo}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer — pinned ── */}
        <div style={{
          flex: '0 0 auto',
          borderTop: '1px solid #eee',
          padding: '12px 18px 16px',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
          display: 'flex',
          gap: 8,
        }}>
          <Btn variant="ghost" onClick={onCancel} style={{ flex: 1 }}>
            Cancel
          </Btn>
          <Btn onClick={handleConfirm} style={{ flex: 1 }}>
            Confirm
          </Btn>
        </div>
      </div>
    </div>
  );
}
