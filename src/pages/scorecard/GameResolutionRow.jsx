// ─── scorecard/GameResolutionRow.jsx ──────────────────────────────────────────
// RENDER ONLY — no business logic in this file.
// No scoring calculations. No match state computation.
// All logic must come from engine/ or scorecardUtils.js
//
// ✅ Self-checked (13-C.8.1):
//   (1) Press rows now interleave with their parent segment in the expanded
//       body — each segment row is followed by its own presses (matched via
//       press.parentSeg === seg.segKey), instead of all segments first then
//       all presses at the bottom. Visually: Front segment → Front Press 1
//       → Front Press 2 → Back segment → Back Press 1 → Total. Orphan presses
//       (no matching parent — defensive) render at the end.
//   (2) New optional prop `lockedTopLevel` — when set to a TopLevelOption
//       value (e.g. 'end_at_k'), only that pill is interactive; all other
//       top-level pills render disabled (greyed out). A small note appears
//       beneath the pill row explaining the lock. Used by DepartureResolverSheet
//       for team Dots locked to a parent team game (Sixes / team Match).
//
// ✅ Self-checked (13-C.7.5 / v2.0): Match-family top-level pills simplified
// per PartialGameContract §6.1 v2.0 — three pills (abandon / end_at_k_closed_only
// / end_at_k_closed_and_open) collapsed to two (abandon / end_at_k). Any
// `end_at_k` selection on a clinch-family game now expands per-segment +
// per-press Pay/Abandon pills, providing the same expressivity as the old
// `closed_and_open` variant. The legacy `topLevelVariant` field is still
// accepted on input (for backward compat with v1.x stored records) — when
// `closed_only` is present in storage, the per-segment defaults that were
// derived from "closed only" (in-progress segments → Abandon) are visible
// via the segment pills, and the user can edit them; the variant field is
// no longer set by user action.
//
// ✅ Self-checked (13-C.6): One row per game in the resolver sheet per
// Resolver_UI_Spec §2.2. Pure presentational: no internal state, no engine
// call. Hole-by-hole never expands. `aria-pressed` on each top-level pill.
// The component does not reset segments/presses when top-level changes —
// that is the parent sheet's responsibility.
//
// ✅ Self-checked (13-C.6 device-test): Pill labels wrap to a second line
// when too long for single-line layout (was `whiteSpace: 'nowrap'` with
// ellipsis truncation). Equal-width pills preserved via `flex: 1 1 0`;
// vertical centering keeps short and long pills aligned in the same row.

import { G } from '../../components/ui.jsx';
import { BetPillRow } from './BetPillRow.jsx';

// Top-level pill style — selected = filled green, unselected = outlined.
// Pills share row width equally (`flex: 1 1 0`) and wrap their text to a
// second line when the label is too long for one row. Vertical centering
// keeps short and long pills visually aligned in the same row.
//
// 13-C.8.1: `disabled` flag added — used by lockedTopLevel mode to grey out
// pills that the user is not allowed to select. Disabled pills show muted
// background, dimmed text, no pointer cursor, and ignore pointer events.
function pillStyle(selected, disabled = false) {
  return {
    flex: '1 1 0',
    padding: '8px 10px',
    borderRadius: 8,
    border: disabled
      ? '1.5px solid #e5e5e5'
      : (selected ? `1.5px solid ${G}` : '1.5px solid #ccc'),
    background: disabled
      ? '#f5f5f5'
      : (selected ? G : '#fff'),
    color: disabled
      ? '#bbb'
      : (selected ? '#fff' : '#444'),
    fontSize: 12,
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: disabled ? 'not-allowed' : 'pointer',
    pointerEvents: disabled ? 'none' : 'auto',
    transition: 'all .15s',
    WebkitTapHighlightColor: 'transparent',
    // 13-C.6 device-test fix: allow wrap so 4-pill rows (Dots) and long
    // labels ("Continue", "Drop [LongName]") render fully instead of
    // being truncated with an ellipsis.
    whiteSpace: 'normal',
    overflow: 'visible',
    textAlign: 'center',
    lineHeight: 1.2,
    minWidth: 0,
    minHeight: 36,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}

// Maps the `value` from a topLevelOption to the resolver-state shape.
//
// v2.0 (13-C.7.5):
//   'abandon'                  → { topLevel: 'abandon' }
//   'end_at_k'                 → { topLevel: 'end_at_k' }   [all families]
//   'continue'                 → { topLevel: 'continue' }
//   'exclude_player'           → { topLevel: 'exclude_player' }
//
// v1.0 backward compat (still accepted on input):
//   'end_at_k_closed_only'     → { topLevel: 'end_at_k', topLevelVariant: 'closed_only' }
//   'end_at_k_closed_and_open' → { topLevel: 'end_at_k', topLevelVariant: 'closed_and_open' }
function partialFromOption(value) {
  switch (value) {
    case 'abandon':                  return { topLevel: 'abandon',         topLevelVariant: undefined };
    case 'end_at_k':                 return { topLevel: 'end_at_k',        topLevelVariant: undefined };
    case 'continue':                 return { topLevel: 'continue',        topLevelVariant: undefined };
    case 'exclude_player':           return { topLevel: 'exclude_player',  topLevelVariant: undefined };
    // v1.0 legacy variants — still accepted but no longer emitted.
    case 'end_at_k_closed_only':     return { topLevel: 'end_at_k',        topLevelVariant: 'closed_only' };
    case 'end_at_k_closed_and_open': return { topLevel: 'end_at_k',        topLevelVariant: 'closed_and_open' };
    default:                         return { topLevel: value,             topLevelVariant: undefined };
  }
}

// Inverse — used to decide which top-level pill is currently selected.
//
// v2.0: clinch-family `end_at_k` (with or without the legacy variant)
// always maps to the simplified `end_at_k` pill.
function optionValueFromResolution(resolution, family) {
  const tl = resolution?.topLevel;
  if (!tl) return null;
  // v2.0: collapse v1.0 variants to plain 'end_at_k' for pill selection.
  // The variant field still carries its value through onConfirm, so older
  // engine readers (and future 13-C.8) can interpret it if desired.
  if (tl === 'end_at_k') return 'end_at_k';
  return tl;
}

export function GameResolutionRow({ gameRow, resolution, onChange, lockedTo }) {
  if (!gameRow) return null;
  const { gameKey, label, family, topLevelOptions = [], segments = [], presses = [] } = gameRow;
  const selectedValue = optionValueFromResolution(resolution, family);

  // 13-C.8.1: when locked, the top-level decision is forced and the pill row
  // is non-interactive. The lockedTo shape is { topLevel, reason } where
  // `topLevel` is one of the standard values ('end_at_k', 'abandon', etc.)
  // and `reason` is a short user-facing explanation. Segment + press pills
  // remain interactive within the locked top level (so a user can still
  // tweak per-segment Pay/Abandon if locked to end_at_k).
  const isLocked = !!lockedTo?.topLevel;
  const effectiveSelectedValue = isLocked ? lockedTo.topLevel : selectedValue;

  // v2.0: any `end_at_k` selection on clinch or completion family expands
  // per-segment pills. Hole-by-hole never expands.
  const tl = isLocked ? lockedTo.topLevel : resolution?.topLevel;
  const isClinchEnd     = family === 'clinch'     && tl === 'end_at_k';
  const isCompletionEnd = family === 'completion' && tl === 'end_at_k';
  const expanded        = isClinchEnd || isCompletionEnd;

  const handleTopLevel = (value) => {
    if (isLocked) return;
    onChange(gameKey, partialFromOption(value));
  };

  const handleSegment = (segKey, decision) => {
    onChange(gameKey, { segments: { [segKey]: decision } });
  };

  const handlePress = (pressKey, decision) => {
    onChange(gameKey, { presses: { [pressKey]: decision } });
  };

  // 13-C.8.1: build a presses-by-parent-segment lookup so each segment can
  // render its own child presses immediately beneath it. A press whose
  // `parentSeg` doesn't match any segment falls back to a tail bucket
  // (rendered after all segments) — this preserves rendering for legacy
  // press rows without a parentSeg field.
  const segKeySet = new Set(segments.map(s => s.segKey));
  const pressesBySeg = {};
  const orphanPresses = [];
  presses.forEach(p => {
    if (p.parentSeg && segKeySet.has(p.parentSeg)) {
      (pressesBySeg[p.parentSeg] ||= []).push(p);
    } else {
      orphanPresses.push(p);
    }
  });

  return (
    <div style={{ padding: '10px 0', borderTop: '1px solid #eee' }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: G, marginBottom: 8 }}>
        {label}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: expanded ? 8 : (isLocked ? 4 : 0) }}>
        {topLevelOptions.map(opt => {
          const isSelected = opt.value === effectiveSelectedValue;
          const disabled   = isLocked && !isSelected;
          return (
            <button
              key={opt.value}
              type="button"
              aria-pressed={isSelected}
              aria-disabled={disabled}
              disabled={disabled}
              onClick={() => handleTopLevel(opt.value)}
              style={pillStyle(isSelected, disabled)}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {isLocked && lockedTo.reason && (
        <div style={{ fontSize: 11, color: '#888', fontStyle: 'italic', marginBottom: 8 }}>
          {lockedTo.reason}
        </div>
      )}

      {expanded && (
        <div style={{ marginTop: 4 }}>
          {segments.map(seg => (
            <div key={seg.segKey}>
              <BetPillRow
                label={seg.label}
                status={seg.status}
                decision={resolution?.segments?.[seg.segKey] ?? 'pay'}
                onChange={(d) => handleSegment(seg.segKey, d)}
              />
              {/* 13-C.8.1: child presses render IMMEDIATELY UNDER the parent
                  segment. Only clinch family has presses populated; completion
                  family's presses[] is always empty. */}
              {isClinchEnd && (pressesBySeg[seg.segKey] || []).map(p => (
                <BetPillRow
                  key={p.pressKey}
                  label={p.label}
                  status={p.status}
                  decision={resolution?.presses?.[p.pressKey] ?? 'pay'}
                  onChange={(d) => handlePress(p.pressKey, d)}
                  indented
                />
              ))}
            </div>
          ))}
          {/* Tail bucket for orphan presses (parentSeg missing/unknown) —
              preserves rendering for legacy data; new gameRows from
              resolverUtils always set parentSeg correctly. */}
          {isClinchEnd && orphanPresses.map(p => (
            <BetPillRow
              key={p.pressKey}
              label={p.label}
              status={p.status}
              decision={resolution?.presses?.[p.pressKey] ?? 'pay'}
              onChange={(d) => handlePress(p.pressKey, d)}
              indented
            />
          ))}
        </div>
      )}
    </div>
  );
}
