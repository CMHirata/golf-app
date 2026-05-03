// ─── scorecard/ReorderDeparturesModal.jsx ─────────────────────────────────────
// RENDER ONLY — no business logic in this file.
// No scoring calculations. No match state computation.
// All logic must come from engine/ or scorecardUtils.js
//
// ✅ Self-checked (13-C.7.5 / v2.0): Out-of-order departure detection modal
// per Resolver_UI_Spec §6.5 / PartialGameContract §8.5. Fired by
// ScoreGrid's long-press X handler when the user attempts to record a
// departure for player B at hole h, but a prior departure for player A
// already exists at a LATER hole than h. The user has two choices:
//   - Cancel: dismiss without action (no departure recorded)
//   - Reorder Departures: clear A's resolutions and re-fire the sequenced
//     resolver chain for both A and B in chronological order, with no
//     pre-population from prior selections (per locked design decision).
//
// Pure presentational. Parent owns the open/closed state and fires the
// callbacks. Modal layout matches the 13-C.6 depart-confirm in-app modal
// pattern (centered card, two-button footer).

import { useEffect, useRef } from 'react';
import { Btn, G } from '../../components/ui.jsx';

export function ReorderDeparturesModal({
  open,
  newPlayerName,        // string — the player just long-pressed (B)
  newHole,              // 0-based hole number — the hole B is leaving at
  conflictingPlayerName, // string — the player whose existing departure is later (A)
  conflictingHole,      // 0-based hole number — A's existing departure hole
  onCancel,
  onConfirm,
}) {
  const cardRef = useRef(null);
  const focusRef = useRef(null);

  // ESC closes (Cancel).
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onCancel?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  // Initial focus on the Cancel button (safer default — the destructive
  // Reorder Departures action requires deliberate selection).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      if (focusRef.current && typeof focusRef.current.focus === 'function') {
        try { focusRef.current.focus(); } catch (_) {}
      }
    }, 0);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;

  // 1-based display per spec.
  const newHoleDisplay = newHole + 1;
  const conflictHoleDisplay = conflictingHole + 1;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 450,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={onCancel}
    >
      <div
        ref={cardRef}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Reorder Departures"
        style={{
          background: '#fff',
          borderRadius: 12,
          width: '100%',
          maxWidth: 360,
          padding: 18,
          boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
        }}
      >
        {/* ── Header with warning glyph ── */}
        <div style={{
          fontWeight: 800,
          fontSize: 15,
          color: G,
          marginBottom: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ fontSize: 18 }}>⚠</span>
          <span>Earlier departure detected</span>
        </div>

        {/* ── Body ── */}
        <div style={{ fontSize: 13, color: '#444', lineHeight: 1.5, marginBottom: 16 }}>
          {newPlayerName} is leaving at hole {newHoleDisplay}, which is earlier
          than {conflictingPlayerName}'s recorded departure at hole {conflictHoleDisplay}.
          This requires reconfirming all choices.
        </div>

        {/* ── Footer ── */}
        <div style={{
          display: 'flex',
          gap: 8,
        }}>
          <Btn variant="ghost" onClick={onCancel} style={{ flex: 1 }} ref={focusRef}>
            Cancel
          </Btn>
          <Btn onClick={onConfirm} style={{ flex: 1 }}>
            Reorder Departures
          </Btn>
        </div>
      </div>
    </div>
  );
}
