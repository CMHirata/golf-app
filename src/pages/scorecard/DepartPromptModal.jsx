// ─── scorecard/DepartPromptModal.jsx ──────────────────────────────────────────
// RENDER ONLY — no business logic in this file.
// Pure render of the long-press X confirmation prompt. State (departPrompt)
// and handlers (cancel / confirm) live in ScoreGrid.jsx.
// See PartialGameContract §8.2 (v1.9): the long-press is a pure departure-
// intent gesture; no score is written for hole h.
//
// ✅ Self-checked (13-E.4): Extracted verbatim from ScoreGrid.jsx (~lines
// 1359–1421). Zero closure dependencies — `playerName`, `holeNumber` (1-based),
// `onCancel`, `onConfirm` are all explicit props. State ownership unchanged:
// ScoreGrid still owns `departPrompt` and gates mount/unmount.

import { G } from '../../components/ui.jsx';

export function DepartPromptModal({ playerName, holeNumber, onCancel, onConfirm }) {
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
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Is ${playerName} done for the round?`}
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
          Is {playerName} done for the round?
        </div>
        <div style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>
          If so, hole {holeNumber} and later will lock for {playerName}.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
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
            onClick={onConfirm}
            style={{
              padding: '11px 14px', borderRadius: 10,
              border: 'none', background: G, color: '#fff',
              fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            Yes, {playerName} is leaving
          </button>
        </div>
      </div>
    </div>
  );
}
