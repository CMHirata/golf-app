# APP_STATE_SUMMARY.md

This document is the lean, current-state record of where the codebase is right now,
along with durable architectural gotchas the AI must not re-break. It is **not** a
session journal — that role belongs to `BUILD_PLAN.md`, which holds the chronological
session history and the open session plan.

This file should remain short. When a session closes, update the **Current State**
paragraph to reflect the new baseline; do not stack additional session paragraphs.

---

## Update policy — read before any session entry

Before logging a session anywhere, confirm all of the following:

1. **Session designation is owner-provided.** Do not invent. If the owner has not
   specified the exact designation (e.g. "13-C.3"), stop and ask.
2. **Every test required by the relevant contract's Testing section passed on
   device.** ("Section 8" of game contracts is the conventional Testing section
   per Universal_Contract_Template.md.) Pending on-device items keep the
   session out of the Completed Sessions table in BUILD_PLAN.
3. **BUILD_PLAN.md has been reviewed and updated** to reflect what this session
   closed, partially resolved, or invalidated. This happens before the ASS update,
   not after.
4. **Any BUILD_PLAN updates that feel wrong were flagged to the owner** before
   being silently committed. Scope creep is visible, not hidden.
5. **The "Work in Flight" block below was updated** (or cleared, if the sprint
   fully completed with this session), and the **Current State** paragraph was
   refreshed to describe the new baseline.

---

## Work in Flight

_None. Session 13-G.2 fully complete and device-confirmed. Sprint 14 planning resolved (provider = Gemini 2.0 Flash, key storage = Option B localStorage prompt for build phase, Option C proxy deferred). **Next session: 14-A — Gemini photo parse engine swap + localStorage key flow**._

---

## Current State

_Last refresh: April 2026 — Session 13-G.2 implementation complete and confirmed on device._

Session 13-G.2 implementation complete. The engine layer is now gender-blind — every game (Match/Nassau, Skins, Stableford, Nines, Sixes, Stroke Play) reads `players[pi].siArray[h]` for stroke allocation, attached at round-start by `buildPlayerSI(player, layout)`. The `hcps` parameter was dropped from all 9 engine function signatures (`runMatch`, `runTeamMatch`, `runMatchNassau`, `runNassau`, `calcSkinsHole`/`calcSkins`, `calcNines`, `calcSixesSegment`/`runSixesSegment`, `calcStablefordTotal`/`calcTeamStablefordTotal`, `calcStrokePlay`); call sites in `payouts.js`, `roundUtils.js`, `resolverUtils.js`, all six game-table components, the scorecard cells, and `shareUtils.js` updated. `xGrossScore` and `escTotal` accept per-player `siArray`. `roundLib.toActiveRound` rebuilds `siArray` defensively on history reload to honour invariant 21 for legacy records. Round-shared `activeRound.hcps` / `hcpsWomen` retained for SI display rows only — never consulted by engines. `Handicap_Contract.md` v2.0 (§2.5 caller responsibility, §2.8 new `buildPlayerSI` spec, §5.0 new engine SI source rule, invariant 21). `App_Data_Model_Contract.md` Player schema gains `siArray: number[18]`. Sprint 13 fully complete (13-A through 13-G.2). App is stable and on-device confirmed; ready for Sprint 14 (photo import).

---

## Tech Stack

- **React 18** (JSX, hooks) — no class components
- **Vite** — dev server and bundler
- **Pure CSS-in-JS** — all styles are inline JS objects; no external CSS libraries
- **localStorage** — sole persistence layer; no backend, no database
- **Netlify** — drag-and-drop `dist/` deploy

---

## Implementation Gotchas (AI must not re-break these)

### H-1: `restoreDotDefs()` required after deserialization
Any code path that reads `dots` from localStorage or from `activeRound` must call
`restoreDotDefs(dots)` before using the dot definitions. Serialization strips the
`autoWhen` functions. Skipping this call causes auto-marking to silently fail.
Renamed from `restoreAutoWhen()` in Session 11-A.

### H-2: Score inputs must use `display: 'block'`
iOS expands the height of focused inputs unless `display: 'block'` is set explicitly.
Without this, focusing a score cell shifts the entire row downward. Fixed in 1-C.
Do not remove this style from score `<input>` elements.

### H-3: `activeRound` must be a deep clone on load
`getActiveRound()` in `App.jsx` must return a parsed copy from localStorage, never
a live reference. Mutating a cached reference corrupts the stored state silently.

### H-4: Landscape detection — single source of truth in `ScorecardPage`
`isLandscape` is computed once in `ScorecardPage.jsx` and passed down as a prop to
`ScoreGrid` and all game table components. `ScoreGrid` has a local fallback detection
only for the case where the prop is not supplied (e.g. read-only summary view).
Do not add a second independent landscape detector in `ScoreGrid` — it will diverge.

### H-5: `TotalsCard` is rendered inside `ScoreGrid`, not `ScorecardPage`
`TotalsCard` is mounted at the bottom of `ScoreGrid`'s return tree, not in
`ScorecardPage`. This is intentional — it keeps all scorecard display logic
co-located. Do not move it to `ScorecardPage` without explicit owner approval.

### H-6: `StyledSel` / `PlayerDropdown` — do not create parallel picker implementations
All player picker UI and option selects in New Round setup must use `StyledSel`,
`PlayerDropdown`, or `ReadOnlyBubble` from `PlayerDropdown.jsx`. These were created
in 11-D specifically to unify picker appearance. A second custom select component
anywhere in setup UI is a violation of this pattern.

### H-7: Name display convention — always first + last, no collision detection
The final convention (established post-11-D) is: always show first name (larger,
darker) + last name (smaller, lighter) unconditionally. `resolveDisplayNames` was
removed from most consumers after this decision. Do not reintroduce collision-aware
logic or first-name-only display without explicit owner approval.

### H-8: `GAME_CONFIGS` is static — `betType` is never stored in round state
`betType` is a UI dispatch concept that lives only in the static `GAME_CONFIGS`
constant in `NewRoundPage.jsx` (created in 11-I.1). It must never appear in
`gameOpts`, `activeRound`, or any persisted state. The game key (e.g. `'Match'`,
`'Skins'`) implies the allowed betting models — they do not need to be stored.
Adding `betType` to `gameOpts` is a contract violation.

### H-9: Nassau terminology is retired from all user-facing surfaces
As of 11-I, the word "Nassau" must not appear in any UI label, button, toggle,
game tile, or payout display. The behavior formerly called "Nassau" is exposed as
Front/Back/Overall bet fields. Code comments may retain the word for historical
clarity. Do not reintroduce "Nassau" as a UI term without explicit owner approval.

### H-10: NOL dot selector — `subsetIdxs` is authoritative, never parse `nolDotGame` value
`nolDotGame` state value can be a single-game string (`'Skins'`), a match ID
(`'Match:m_123'`), or a fingerprint string (`'1,2,3'`) when games share a subset.
`ScorecardPage` always derives `effectiveMinCourseHcp` and `nonParticipantIdxs` from
`opt.subsetIdxs` — never by parsing or inspecting the value string beyond identity
comparison (`o.value === nolDotGame`). Do not add value-string parsing logic anywhere.

### H-11: Center nav button from setup tab triggers `handleStart`, not a direct tab switch
As of 11-K, `handleCenterTap` in `App.jsx` calls `startTriggerRef.current?.()` when
`inProgress && tab === 'new-round'`. This runs the full round re-assembly (same as
"Start Scoring"), committing any game config changes to `activeRound` before the
scorecard mounts. The ref is kept current via a no-dep-array `useEffect` in
`NewRoundPage`. Do not change this back to a direct `setTab('scorecard')` call —
doing so breaks the NOL pill reset and reverts the `manualPresses` preservation fix.

### H-12: Stableford `opts.scoring` field — do not use as `grossNetNOL` fallback
As of 11-L, `gameOpts.Stableford.scoring` holds the team hole-scoring rule
(`'cumulative'` | `'bestball'`), not a handicap mode value. The generic fallback chain
`o.grossNetNOL ?? o.scoring ?? default` used by all other games must **not** be applied
to Stableford — it would corrupt `grossNetNOL` to `'cumulative'` whenever team mode is
active. `Stableford: 'net'` is explicitly listed in `GNL_DEFAULTS` in both
`NewRoundPage.allOpts` and `App.jsx getActiveRound` to short-circuit the fallback.
`payouts.js` and `StablefordTable` read `mode` as `grossNetNOL ?? 'net'` only (no
`scoring` fallback). Do not reintroduce `?? o.scoring` for Stableford at any read site.

### H-13: `'X'` is a valid score value — do not sanitize it away
`scores[h][i]` may contain `'X'` (player picked up). The score normalization guard
that sanitizes invalid values to `''` must explicitly pass `'X'` through as valid.
Sanitizing `'X'` to `''` silently converts a deliberate pickup into a missing score,
breaking payout calculations. `'X'` is never stored as `'7X'` — the computed gross
value is derived at render time via `xGrossScore()`. Do not persist display strings.

### H-14: System keyboard must never appear during score entry
`ScoreKeypad.jsx` is the sole score entry mechanism throughout the app. The
hidden-input / `.focus()` pattern in `ZoomModal.jsx` is retired as of 13-B. Any
code path that calls `.focus()` on a hidden input for score entry is a contract
violation. Do not reintroduce native `<input>` focus for score cells.

### H-15: `parseInt('X')` returns NaN — always check for `'X'` before parseInt
Any function that accepts a raw score from `scores[h][i]` must check `raw === 'X'`
before calling `parseInt(raw)`. `parseInt('X')` returns `NaN`, which silently
corrupts all downstream comparisons and totals. This applies to display tables
(`NinesTable`, `MatchNassauTable`) as well as engine functions. Both were fixed
in 13-B; ScoreGrid `grossTotal`/`netTotal` half-totals were fixed in 13-C.3 Phase
2B (same bug pattern). Do not regress this.

### H-16: `kpValue` is always seeded `''` — first digit always replaces committed score
When `openKeypadOnCell`, `kpAdvanceCell`, `kpRetreatCell`, or `handleKpNavigate`
sets a new active cell, `kpValue` is always initialized to `''`. The keypad treats
every cell activation as a fresh entry — the first digit replaces whatever committed
score is in the cell. Seeding `kpValue` from the committed score causes the
"15 bug" (digit appends to existing score and clamps to 15). Do not change this.

### H-17: ZoomModal is a pure display component — no keyboard machinery
`ZoomModal` contains no hidden input, no `.focus()` calls, no advance/retreat timer,
and no `onKeyDown` handler. Score entry flows entirely through ScoreGrid's keypad
state via the `onCellTap` prop. The active cell border is driven by the `activeKpCell`
prop. The `cardRef` prop attaches ScoreGrid's `zoomCardRef` to the card div so the
global `touchend` dismiss handler exempts touches inside ZoomModal. Do not add
keyboard focus logic or internal active-cell state back to ZoomModal.

### H-18: `zoomCardRef` must remain in dismiss handler exemption list
ScoreGrid's global `touchend` dismiss handler (which clears `activeKpCell`) exempts
three targets: `INPUT` elements, `kpContainerRef` (the keypad), and `zoomCardRef`
(the ZoomModal card). Removing `zoomCardRef` from this list causes tapping any
ZoomModal cell to immediately clear `activeKpCell` — the keypad closes on every
cell tap. Do not remove this exemption.

### H-19: DotsPopup saves/restores `activeKpCell` — do not bypass this
When a long-press fires, `startLongPress` saves `activeKpCellRef.current` to
`savedKpCellRef` and clears `activeKpCell` (hides keypad). When DotsPopup closes,
`onClose` restores from `savedKpCellRef`. This is how the keypad reappears on the
correct cell after DotsPopup without requiring the user to tap again. `activeKpCellRef`
is a ref mirror of `activeKpCell` state (updated via `useEffect`) — it always holds
the current value inside the `setTimeout` closure. Do not read `activeKpCell` state
directly inside `startLongPress`'s timer callback — the closure would capture a stale
value.

### H-20: `roundStartHole` / `roundNumHoles` — derive end hole, never store it
`activeRound` stores `roundStartHole` (0-based, default 0) and `roundNumHoles` (default
18). `roundEndHole = roundStartHole + roundNumHoles - 1` must always be derived at
the call site — never stored. Storing `roundEndHole` directly is a contract violation
(PartialGameContract invariant #17). Callers must apply `?? 0` / `?? 18` defaults at
read time since legacy records have `undefined` for both fields. The scores array is
always 18 slots regardless of round length — `roundStartHole`/`roundNumHoles` control
display and compute scope, not the array shape.

### H-21: Any new field added to `fromActiveRound`/`toActiveRound` must also go in `toSetupState`
`toSetupState` is the path by which a saved historical round is restored into
`NewRoundPage`'s init state on reload. If a field is present in `fromActiveRound`
and `toActiveRound` but absent from `toSetupState`, the field will silently reset
to its default when a round is reloaded for editing — a data-loss bug with no error.
Discovered in 13-C.2: `manual_presses` was missing from `toSetupState`, causing press
configurations to be lost on reload. `round_start_hole`/`round_num_holes` also required
explicit restoration. Rule: whenever a new field is added to `fromActiveRound`, add it
to `toSetupState` in the same change. See `App_Data_Model_Contract.md` invariant #16.

### H-22: ESC (Adjusted Gross Score) is only shown for full 18-hole rounds
`TotalsCard` omits the ESC sub-line when `roundStartHole !== 0` or `roundNumHoles !== 18`.
The engine `escTotal()` always iterates all 18 holes — on partial rounds this would show
a misleading value (and would include stale out-of-round scores for reloaded historical
rounds). Per PartialGameContract §1A.8 and GHIN requirements, ESC is only meaningful for
full 9 or 18-hole submissions. Don't show ESC for partial rounds; let players compute
their own. If `isFullRound = (rsh === 0 && rnh === 18)` is false, render nothing.

### H-23: Draft-string pattern for numeric form inputs — clamp on blur, not on keystroke
When a numeric input field needs validation/clamping (e.g. round length pickers), use
the draft-string pattern: maintain a separate `draft` state string decoupled from the
committed numeric state. `onChange` updates the draft string. `onFocus` clears the draft
to `''` (replaces on first keystroke). `onBlur` validates the draft and either commits
it or reverts to the prior committed value. Do NOT clamp on every keystroke — that
causes mid-typing snaps (e.g. typing "12" snaps to min after typing "1"). Invalid
entries (NaN, zero, out-of-range) should revert to prior value, not clamp to min.

### H-24: iOS input baseline shift — wrap `<input>` in flex-centered outer div
For numeric inputs in form UI, an `<input>` element will visually shift vertically
on iOS Safari when it transitions between empty and populated states during editing
(the browser changes internal baseline positioning between cursor-mode and text-mode).
Fix: wrap the `<input>` in an outer `<div>` that owns the visible box styling
(fixed height, border, background, `display:flex`, `alignItems:center`,
`justifyContent:center`). The inner `<input>` has no border, transparent background,
and is naturally sized by its content. This decouples the visible box dimensions from
the browser's internal text-baseline quirks. Same pattern as `ScoreGrid.renderCell`
(introduced in 13-B.1 to fix the cell sizing issue). Applied to Round Length inputs
in 13-C.2. Do not use `<input>` as its own visible box in form fields where iOS
baseline shift could occur.

### H-25: Verify imports for every new identifier — `grep -c` counts call sites only
When adding a new helper function call to a file, especially when refactoring or
extracting code across files, do not rely on `grep -c "newSymbol"` to verify the
edit is correct. The grep counts call sites; it does not verify that the symbol
resolves at runtime. A call to an unimported symbol throws `ReferenceError` only
when the call site executes — not at parse time, not at module load. This means
a file can pass syntax checks, brace balance, and grep-based completeness checks
yet still throw at runtime in a code path that wasn't exercised during validation.

The 13-C.6 device-test fixes uncovered this when `resolverUtils.js` called
`isNassauMatch(md)` without the matching import. The function ran fine in tests
that didn't hit the Match branch; once tested with an active Match game, the
resolver opened, threw `ReferenceError`, and silently aborted mid-execution.

Verification rule: for every new identifier added inside a file, explicitly
verify it appears in the file's `import {…}` block. Either grep the import
block specifically (`sed -n '/^import/,/^[^ ]/p' file.js | grep newSymbol`)
or include it in the staging-validation step.

### H-26: `toSetupState` emits camelCase for new fields — `NewRoundPage.handleStart` must read camelCase
`roundLib.toSetupState` returns a setup-state shape that uses camelCase for
fields newer than the original v1 schema (e.g. `earlyDepartureOpts`,
`earlyEndOpts`, `lastCompletedHole`, `gameRanges`, `roundStartHole`,
`roundNumHoles`). It retains snake_case only for legacy fields like
`dot_entries` and `manual_presses` that pre-date the camelCase convention.
`NewRoundPage.handleStart` reads `initSrc` when reconstructing `activeRound`
for Back→Setup→Forward navigation. Reading a new field in snake_case from
`initSrc` silently returns `undefined`. Rule: when `handleStart` reads any
field newer than the v1 schema from `initSrc`, the key must be camelCase.
Verify against `toSetupState`'s actual return-object literal in `roundLib.js`.
See PartialGameContract invariant 23 and App_Data_Model_Contract §9 / invariant 18.

### H-27: Carry-forward state must derive from saved `earlyDepartureOpts`, not in-memory chain refs
The resolver chain controller (now in `useDepartureResolver.js`) keeps a
`confirmedEventsRef` that tracks the current chain's confirmations — used ONLY
for the group-stop write decision at chain-end (§5.4.4). It is NOT a valid source
for carry-forward state. Carry-forward MUST be derived from
`activeRound.earlyDepartureOpts` filtered to entries with
`eventOrder < currentEvent.eventOrder` and sorted by `eventOrder` ascending.
Reasoning: the in-memory ref is cleared at chain end. A subsequent reactive chain
sourcing from it would see empty carry-forward and re-prompt for already-resolved
games. Surfaced and fixed in 13-C.7. See PartialGameContract invariant 24.

### H-28: Every score-aggregating component must apply the display-side departure guardrail
`payouts.js` applies `applyDepartureGuardrail` engine-side, but every game
table (`SkinsTable`, `StrokePlayTable`, `StablefordTable`, `NinesTable`,
`SixesTable`, `MatchNassauTable`, `DotsTable`) calls `games.js` /
`handicap.js` engine helpers DIRECTLY for live mid-round display, bypassing
`payouts.js`. Without a display-side mirror, mid-round game tables show stale
post-departure score contributions even though the engine would correctly
ignore them. The display-side mirror lives in `scorecardUtils.js` as
`applyDepartureGuardrailToScores` and `applyDepartureGuardrailToDotEntries`,
and MUST be applied at the top of each game table's component body before
any aggregation. `TotalsCard` (called from `ScoreGrid` and `RoundSummaryModal`)
also requires the guardrail. `roundUtils.js computePerMatchPayouts` and
`buildShareHtml` carry inline copies — they cannot import from `scorecardUtils.js`
without a circular dependency on `components/ui`. Both helpers no-op when
`earlyDepartureOpts` is empty (byte-identical pre-13-C.7 behavior). Adding
a new score-aggregating component imposes a contract obligation on the author
to wire the guardrail. See PartialGameContract §11.9 and invariant 21
(amended). Surfaced and fixed in 13-C.7.

### H-29: `useDepartureResolver` hook owns all departure chain state — do not split across files
As of 13-D, the departure resolver chain state machine lives entirely in
`useDepartureResolver.js`. `ScorecardPage.jsx` destructures the hook's return
value and wires it to UI — it owns no departure chain logic directly (exception:
`useImperativeHandle` wires `triggerReactiveResolver` to the page ref for
`App.jsx` to call). Any future change to departure chain behavior (new event
types, new resolution options, new modal flows) goes into `useDepartureResolver.js`
exclusively. Do not re-introduce departure chain state into `ScorecardPage.jsx`.
The `confirmedEventsRef` / `pendingEventsRef` / `chainContextRef` refs live in
the hook and must not be mirrored in `ScorecardPage`.

### H-30: `PayoutDisplay.jsx` is the single source of truth for payout display sub-components
As of 13-E.5, `DotsColTable`, `SubHeader`, `PayRow`, `splitGameHeader`, `fmtMoney`,
and `PayoutsSection` live exclusively in `pages/PayoutDisplay.jsx`. Neither
`ResultsPage.jsx` nor `RoundSummaryModal.jsx` may define local equivalents of these
symbols. Pre-extraction implementations are preserved as commented blocks in both
consumers (marked `// 13-E.5 PRE-EXTRACTION`) for revert during the planned 15-C
ResultsPage visual rework — do not delete those commented blocks until 15-C confirms
they are no longer needed. Any future change to payout display behavior (new game
shape, new decoration style, new columnar layout) goes into `PayoutDisplay.jsx`
exclusively and takes effect in both surfaces automatically.

### H-31: `defaultMatch`/`makeMatchId` are intentionally duplicated in `GamesCard.jsx`
As of 13-E.7, `GamesCard.jsx` contains local copies of `defaultMatch` and `makeMatchId`
for the "+ Add another Match" button. The authoritative copies remain in `NewRoundPage.jsx`
at module scope (used by `toggleGame` when Match is first enabled). The duplication was
chosen over import-coupling `GamesCard` back to `NewRoundPage` (circular) or extracting
to a third file (over-engineering for two call sites). If the `defaultMatch` shape ever
changes (new field, different default value), **both copies must be updated together**.
The local copy in `GamesCard.jsx` is annotated with a comment pointing to this rule.

### H-32: Popup backdrop must disable `onClick` while keypad is active for its fields
When a `GameRangePopup` (or any popup containing keypad-activating fields) uses a
`pointerEvents: none` lockout window on the keypad, phantom clicks from the activating
tap pass through the keypad and hit the backdrop. If the backdrop has `onClick={onClose}`,
the popup closes immediately after the keypad opens. Fix: `onClick={keypadActive ? undefined : onClose}`.
The `keypadActive` check compares `activeFieldId` to the popup's own field IDs.
Also: never put a CSS `transition` on `marginBottom` when lifting a popup above the keypad
— animation causes click-target races where iOS dispatches `click` to whatever element
is at the touchstart coords after layout has shifted.

### H-33: Plus-CH indicator must be checked before `dotMode === 'gross'` bail
In `ReadOnlyScorecard.hcpDots` and `shareUtils.hcpStrokesHtml`, the `+` indicator check
(`ch < 0 && rank > 18 - Math.abs(ch)`) must run BEFORE any early return on
`dotMode === 'gross'` or `!dotMode`. The indicator expresses a structural USGA fact
(strokes given back), not a display preference. If the bail is first, gross-mode rounds
silently suppress all `+` indicators. `shareUtils` never had the bail; `ReadOnlyScorecard`
had it in the wrong order — that was the C5 bug.

### H-34: Plus-CH strokes are given back on the EASIEST holes (highest stroke index)
Per USGA Rule of Handicapping, a plus handicapper gives back strokes starting from the
hole with the highest stroke index (easiest). The correct condition is
`hcps[h] > 18 - Math.abs(ch)` — NOT `hcps[h] <= Math.abs(ch)` (which marks the
hardest holes). For CH = -5, the indicator fires on SI 14, 15, 16, 17, 18. The original
v1.7 spec had this inverted; corrected in v1.8. Do not revert to the `<=` condition.

### H-35: React 18 attaches touch listeners as passive — `e.preventDefault()` in `onTouchEnd` is silently ignored
React 18 binds touch event listeners with `passive: true` by default, which silently
ignores `e.preventDefault()` calls. The intended-to-suppress synthetic click on iOS
fires anyway ~300ms after touchend, double-firing tap handlers. Symptom in 13-G:
score-entry cell sometimes auto-advanced by two cells. Fix pattern: use a
`touchHandledRef = useRef(0)` timestamp set in `onTouchEnd`; in `onClick` bail when
`Date.now() - touchHandledRef.current < 600`. Do not rely on `preventDefault()` in
React touch handlers. Live in `ScoreGrid.jsx` interactive cell handler.

### H-36: Women's SI must be interleaved using the same odd/even rank algorithm as men's
`handicapsWomen` is stored per-nine as local 1–9 rankings. Building the 18-hole
women's SI by `nines.flatMap(n => n.handicapsWomen)` is WRONG — it produces 1–9
twice. Correct combined SI must use the same interleaving as `buildLayout`: front
holes get odd ranks (1, 3, 5, ...) and back holes get even ranks (2, 4, 6, ...)
based on local rank. `buildGenderLayout` in `engine/handicap.js` is the canonical
implementation; `ReadOnlyScorecard` had the flat-flatMap bug pre-13-G and was
corrected. Anywhere a combined women's SI array is needed, use the same odd/even
interleave — never raw flatMap.

### H-37: Engine signature changes require auditing every call site by function name
When changing an engine function signature (adding/dropping a parameter), grep
for every engine function name across the entire codebase — never rely on
text-pattern grep of related helpers. Session 13-G.2 dropped the `hcps`
parameter from 9 engine functions; the initial audit grep'd for
`scoreForMode`/`xGrossScore` text matches and missed 5 higher-level engine
call sites: `SkinsTable.calcSkinsHole`, `roundUtils.runMatchNassau`,
`resolverUtils.runMatchNassau`, `resolverUtils.runSixesSegment`,
`MatchNassauTable.runMatchNassau`, `SixesTable.runSixesSegment` (×2). Symptoms
were silent (empty Skins grid on scorecard) and catastrophic (blank-screen
crash on history reload because `hcps` array landed in the `matchDef` slot).
Pattern for future signature changes: grep by function name across all
`*.js`/`*.jsx`. Use `runMatchNassau\b|runSixesSegment\b|calcSkins\b|...`
patterns covering every engine function being changed. Verify the result list
matches the file count expected from the import graph.

---

## Open Items

Active open work and small carry-over items that don't yet warrant their own
session entry. Larger backlog and deferred items live in BUILD_PLAN.md
(Open Session Plan, Items Requiring Contract Work, Pending Decisions, Deferred /
Deprioritized).

### Sprint 13 — carry-over

- **Partial-round history-reload retest** — load a full 18-hole round, reload into
  `NewRoundPage`, shorten to 9 holes, confirm all three range-aware table components
  trim correctly and the engine computes only over 9 holes. Carried over from 13-C.3
  Phase 2B. Priority: Medium.
- **Dead `Btn` import in `HistoryPage.jsx`** — `Btn` is imported from `ui.jsx` but
  never referenced in the body. Predates 13-E.3; left in place during the verbatim
  extraction. Pick up in 15-F cleanup pass. Priority: Low.

---

## Document Index

Contract version pins below verified against each contract's actual version
header (April 2026 audit).

### Current contracts and core docs

| Document | Version | Purpose |
|---|---|---|
| `ARCHITECTURE_FOUNDATIONS.md` | — | Mental models, layer system, the "why" |
| `App_Data_Model_Contract.md` | v3.7 | State schema, storage keys, mutation rules; v3.7 (13-G.2) §5.3 Player schema gains `siArray: number[18]` — per-player stroke index, required at round-start, built via `buildPlayerSI`, not serialized. v3.6 (13-C.8) §10.1 `computePerMatchPayouts` updated — two new trailing args (`earlyEndOpts` positional 12, `lastCompletedHole` positional 13); full resolution pipeline per match; return shape gains `decoration`; `buildShareHtml` filter widened; §11 invariant 19 (per-match Option A policy). v3.5 (13-C.7) §9 `roundLib` round-trip rules; `migrateRecord` `eventOrder` backfill; `handleStart` preservation rule; §10 `computePerMatchPayouts` shape. v3.4 (13-C.7 / v2.0) §5.12 departure fields cross-reference. v3.3 (13-C.3) §5.1 `gameRanges`; §10 `buildPayoutArgs` shape. |
| `Round_Lifecycle_Contract.md` | v2.2 | Setup→score→save flow, activeRound lifecycle; v2.2 (13-C.7) §3.4 Back→Setup→Forward preservation; §7 departure fields; §8 round-trip preservation + camelCase table; §12 invariants 23–24. v2.1 (13-C.7 / v2.0) §4.5 `earlyEndOpts`. v2.0 (13-C.3) §7 `gameRanges`. v1.9 (13-C.2) Results always tappable; round length fields. |
| `Handicap_Contract.md` | v2.0 | USGA math, `scoreForMode`, `escTotal`, `DEFAULT_STAB`; v2.0 (13-G.2) §2.5 caller responsibility for `siArray`; §2.8 NEW `buildPlayerSI(player, layout)` — per-player SI from gender + layout; §5.0 NEW engine stroke-index source rule — engines read `players[pi].siArray[h]`, `hcps` parameter dropped from all 9 engine functions; `xGrossScore`/`escTotal` accept per-player `siArray`; invariant 21 NEW. v1.9 (13-G) §2.1 gender-aware par; §2.5 `groupCourseHandicaps` gender-aware tee + optional `nines` arg; §2.7 NEW `buildGenderLayout`; §5.16.1 plus-CH uses per-player SI; §8 G-4 missing-women's-SI warning; invariants 18–20. v1.8 (13-F implementation) §5.16.1 trigger condition corrected to `hcps[h] > 18 - Math.abs(ch)` (USGA: strokes back on easiest holes); §5.16.2 plus-CH check must precede dotMode bail. v1.7 (13-F contract) §5.16 plus-CH cell indicator. |
| `Payout_Contract.md` | v1.13 | `computePayouts` entry point, `subsetMin` pattern; v1.13 (13-C.8) §3.2 Sixes columnar; §7.3 Match per-instance + retired combined; §7.6 Sixes columnar format. v1.12 (13-C.3) generalized BreakdownEntry shape. v1.11 §4.4 X score handling. |
| `Nassau_Match_Contract.md` | v3.0 | Nassau/Match Play rules, press system, engine API; v3.0 (13-F) §16.4 MatchCard Total↔Nassau carry-forward rule. v2.9 (13-C.3) partial-range + `runMatchNassau` `range` arg. v2.8 §5.6 match instance label. |
| `Sixes_Contract.md` | v1.11 | Sixes team rotation, hole scoring, press system; v1.11 (13-E) §11 setup-UI heading updated to reference `GameConfigSixes.jsx` (panel file) — dispatcher unchanged. v1.10 (13-C.3) §3.6 clarification + §3.7 partial-range. |
| `Skins_Contract.md` | v1.8 | Skins carryover, subset behavior, departure handling; v1.8 (13-C.7) §3.2 per-hole eligibility partition; §3.3 engine guardrail; invariants 13–14. v1.7 (13-C.3) partial-range + gameRanges resolution. |
| `Stableford_Contract.md` | v1.7 | Stableford points table, `betMode`, team scoring; v1.7 (13-E) §11 setup-UI references updated to `GameConfigStableford.jsx` (panel file) — dispatcher unchanged. v1.6 (13-C.3) §3.7 partial-range, §5.3/§5.7 colHeaders. |
| `Nines_Contract.md` | v1.6 | Nines point table, `betMode`, blitz rule, 3-player constraint; v1.6 (13-E) §11 setup-UI references updated to `GameConfigNines.jsx` (panel file); `validateGameRange` canonical home now `GameConfigShared.jsx` (re-exported from `GameConfig.jsx`). v1.5 (13-C.3) §3.7 partial-range, §5.4 colHeaders. |
| `Stroke_Play_Contract.md` | v1.7 | Stroke play `betMode`, `strokePlayPlayers` subset, `calcStrokePlay`; v1.7 (13-C.3) split-pot tie + §3.7 partial-range + §5.8/§5.9 columnar emission. |
| `Dots_Contract.md` | v2.5 | Dots/Junk: `DOTS_DEF`, specials, mutual exclusivity, team payout; v2.5 (13-E) §11 heading updated — setup UI now lives in `GameConfigDots.jsx` (panel file) with `CustomDotAdder` and `DotRow` private to that file; container dispatcher in `GameConfig.jsx` unchanged. v2.4 (13-C.3) §7.5 columnar shape generalization. |
| `PartialGameContract.md` | v2.2 AUTHORITATIVE | Partial round, predetermined ranges, early departure; v2.2 (13-E.4) §8.2 step 3 header copy edge case: "left before hole N" when departureHole < roundStartHole. v2.1 (13-C.7) documentation amendment: §4.5 round-trip mandate; §5.4.5 carry-forward source-of-truth; §5.5 share image `–` rule; §11.4 display vs engine status; §11.9 dual-implementation guardrail; invariants 21, 23, 24. v2.0 (13-C.7) MAJOR REWRITE — sequenced-event model. v1.10 (13-C.6) departure semantics, undo gesture, format detection. v1.5 (13-C.2) round length UI. |
| `ScoreKeypad_Contract.md` | v2.4 AUTHORITATIVE | Custom keypad: universal system-keyboard replacement; five modes; page-level ownership pattern (§10); v2.4 (13-F) zIndex 1100; `noPlus` prop; empty-seed select-to-overwrite; `readOnly`+`onFocus` field pattern; 250ms pointerEvents lockout; popup §10.8 requirements; `onChange(newKpVal, newKpPlus)`. v2.3 (13-F contract) five modes; §10; invariants 13–20. |
| `UI_Component_Contract.md` | v1.5 | `ui.jsx` tokens, all components, `style` prop pattern; v1.5 (13-F) §4.7 BetInput `isActive`/`placeholder` props; corrected `readOnly`+`onFocus` activation; §4.10 BetSection `activeFieldId` threading. v1.4 (13-F contract) §4.7 keypad activation; §4.10 carry-forward. v1.3 §4.9 `ShareOrientationPicker`. |
| `Universal_Contract_Template.md` | v1.0 AUTHORITATIVE SKELETON | Template every game contract must conform to. |

### Process / planning docs

| Document | Purpose |
|---|---|
| `BUILD_PLAN.md` | Authoritative session history, completed sessions table, open session plan, deferred items, decision log. |
| `APP_STATE_SUMMARY.md` (this file) | Lean status, gotchas (H-1…H-36), open items, document index. |
| `Session_Intro_Template.md` | Boilerplate prompt for starting a fresh chat session. |
| `Session_Closing_Maintenance_Template.md` | Step-by-step closing-session checklist for BP and ASS maintenance. |
| `NewRoundPage_Design_Spec.md` | 11-H output: full NewRoundPage setup UI design spec. **13-E note:** Wolf extension point (line ~583) now reads "a new panel file `GameConfigWolf.jsx` plus a dispatcher branch in `GameConfig.jsx`" rather than a single new branch. **13-E.7 note:** The three card body sections (Course, Players, Games) now live in `pages/new-round/CourseCard.jsx`, `PlayersCard.jsx`, `GamesCard.jsx`; the Design Spec's component patterns still apply but the implementation files have moved. |
| `Resolver_UI_Spec.md` | v1.4 — implementation-level spec for early-departure resolver. v1.4 (13-E.4) `roundStartHole` prop; "left before hole N" header copy rule when departureHole < roundStartHole. v1.3 (13-C.8) `parentGameKey`, `lockedTo` prop, Team-Dots parent linkage. v1.2 (13-C.7) carry-forward source-of-truth; sequencer controller notes. v1.1 (13-C.7 / v2.0) `departedPlayerName: string`; game-family option matrix; Reorder Departures. v1.0 (13-C.5) initial prop interfaces and clinch detection. |

### Superseded / historical

| Document | Status | Notes |
|---|---|---|
| `Early_Departure_Contract.md` | v1.0 DRAFT — superseded | Superseded by `PartialGameContract.md` in 13-C. Retained for historical reference. |
| `Late_Arrival_Contract.md` | v1.0 DRAFT — superseded | Superseded by `PartialGameContract.md` in 13-C. Retained for historical reference. |
| `Dots_Contract_v2_0.md`, `Dots_Contract_v2_1.md` | Stale duplicates | `Dots_Contract.md` is current at v2.5. **Housekeeping:** remove these two legacy files from the project knowledge base when convenient. |
