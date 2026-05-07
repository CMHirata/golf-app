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

_None. Session 14-bugs.1 fully complete and device-confirmed. **Next session: 15-E — Players Page Enhancements**._

---

## Current State

_Last refresh: May 2026 — Session 14-bugs.1 complete and confirmed on device._

Session 14-bugs.1 complete. Two bug fixes shipped. (1) Custom dot payout and team companion: `parts[2]` key-split on `dotEntries` keys broke custom dot IDs (`c_timestamp` format) — `parts[2]` returned `'c'` instead of the full id. Fixed with `parts.slice(2).join('_')` at all 6 id-extraction sites across `payouts.js`, `ScoreGrid.jsx`, `DotsTable.jsx`, and `DotsPopup.jsx`. Also fixed `pivotSegTot`/`pivotRoundTot` in `DotsTable.jsx` to exclude received companion entries from pivot totals. (2) ScoreKeypad double-fire: React 18 passive listeners silently ignored `e.preventDefault()` in `onTouchEnd`, allowing the synthetic `click` to fire ~300ms later and double-enter every digit/backspace tap. Fixed with `touchHandledRef` timestamp guard on `onClick`; `onMouseUp` removed. X button long-press machinery untouched. H-40 added.

---

## Tech Stack

- **React 18** (JSX, hooks) — no class components
- **Vite** — dev server and bundler
- **Pure CSS-in-JS** — all styles are inline JS objects; no external CSS libraries
- **localStorage** — sole persistence layer; no backend, no database
- **Cloudflare Pages** — app hosting (`https://the-card-1qm.pages.dev`)
- **Cloudflare Worker** — OCR parser (`scorecard-parser.thecard.workers.dev`)

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
`opts.scoring` in Stableford config means the Stableford scoring table variant
(e.g. `'standard'`, `'modified'`). It is NOT a `grossNetNOL` value. The two fields
share the name `scoring` in different contexts. Never use `opts.scoring` as a
`grossNetNOL` fallback in Stableford — it will silently apply the wrong logic.

### H-13: `roundLib.js` `buildPlayerSI` is the single source of truth for SI arrays
`buildPlayerSI` in `roundLib.js` (called at round-start in `roundUtils.js`) produces
each player's `siArray[0..17]`. Engines read `players[pi].siArray[h]` directly —
they do not re-derive SI from course data. Do not add SI derivation logic inside
engine files.

### H-14: System keyboard must never appear during score entry
All numeric inputs in the scorecard and setup flows must suppress the system keyboard.
Pattern: `<input readOnly inputMode="none" onFocus={e=>{e.target.blur(); activate();}}>`
Any `<input type="number">` or unfocused numeric field in a scoring context is a
violation. H-14 applies to ScoreGrid, TotalsCard, GameConfig panels, and
ManualCourseModal tee fields.

### H-15: `payouts.js` pre-processing layer is provably no-op for full rounds
The departure/range pre-processing in `payouts.js` must not change any output for
a standard full 18-hole round with no departures. Any change to this layer requires
verifying the no-op guarantee before merging.

### H-16: `games.js` and `handicap.js` are engine files — never modified for UI concerns
Engine files contain pure functions with no side effects. Display logic, departure
handling, and range clipping live in `payouts.js` (pre-processing) and
`scorecardUtils.js` (display). Exception: surgical `range` parameter additions to
`runMatchNassau`/`calcTeamStablefordTotal` approved in 13-C.3.

### H-17: `ScoreGrid.jsx` is the state owner for score entry — table components are render-only
Game table components (`MatchNassauTable`, `SkinsTable`, etc.) receive computed data
as props and render it. They contain no scoring logic, no state mutations, and no
direct localStorage access. All score mutations flow through `ScoreGrid`.

### H-18: Sixes `teamOrder` array drives all rotation logic — never derive rotation inline
`teamOrder[hole]` is the authoritative team assignment for each hole. All Sixes
display and engine logic reads from this array. Do not re-derive team rotation from
hole index arithmetic inline — it will diverge from the stored order.

### H-19: Press hierarchy must be maintained when adding new press types
Presses form a hierarchy: Round → Segment → Sub-segment. A press can only be
added at a level that exists and is active. `manualPresses` stores the raw press
events; derived press state is always recomputed from this array. Never store
derived press state.

### H-20: `PartialGameContract.md` is the single source of truth for departure handling
The departure model (v2.0+) uses a sequenced-event resolver. The v1.x "snapshot"
model is REMOVED. Do not re-introduce snapshot-based departure logic anywhere.
`useDepartureResolver.js` owns all departure chain state.

### H-21: `resolverUtils.js` contains pure functions only — no React, no state
`resolverUtils.js` is a pure-function module. Do not import React hooks or
component state into it. It may be called from both React components and plain JS.

### H-22: `DepartureResolverSheet` renders one sheet per departing player — never combined
One `DepartureResolverSheet` per departing player, always. The v1.x combined sheet
is removed. Combining departure sheets again would violate the sequenced-event model.

### H-23: `earlyDepartureOpts` and `earlyEndOpts` are the only departure signals to engines
Engines receive departure information exclusively through `earlyDepartureOpts` and
`earlyEndOpts` in the payout computation call. No departure state is passed through
`gameOpts` or player arrays. Adding departure signals anywhere else breaks the
engine firewall.

### H-24: iOS input baseline shift — wrap `<input>` in flex-centered outer div
On iOS, numeric `<input>` elements inside flex containers can exhibit a baseline
shift when focused or when value changes. Wrap in a `display:flex; alignItems:center`
outer div if vertical misalignment appears during editing.

### H-25: `applyDepartureGuardrailToScores` must be called before any score aggregation
Display-side score arrays must be filtered through `applyDepartureGuardrailToScores`
before totals, net scores, or any aggregate is computed. Missing this call causes
departed-player scores to pollute totals silently.

### H-26: Game table components receive `range` prop — never infer range from scores
Range-aware table components receive an explicit `range: {start, end}` prop.
They must not infer the active range by scanning for non-null scores. The prop
is authoritative.

### H-27: `nineComboNames` is optional — always guard with `?.` before use
`course.nineComboNames` is only present on 27-hole courses imported after 14-A.
All consumers must guard: `course.nineComboNames?.[i]`. Do not assume it exists.

### H-28: Every score-aggregating component must apply the display-side departure guardrail
`payouts.js` applies the guardrail engine-side, but every game table component,
`TotalsCard`, and share utilities must also call `applyDepartureGuardrailToScores`
before aggregating scores. Adding a new score-aggregating component requires wiring
the guardrail. See PartialGameContract §11.9 / App_Data_Model_Contract invariant 17.

### H-29: `useDepartureResolver` hook owns all departure chain state — do not split across files
All departure chain state lives in `useDepartureResolver.js`. `ScorecardPage.jsx`
wires the hook's return value to UI only. Do not re-introduce departure chain state
into `ScorecardPage.jsx`.

### H-30: `PayoutDisplay.jsx` is the single source of truth for payout display sub-components
`DotsColTable`, `SubHeader`, `PayRow`, `splitGameHeader`, `fmtMoney`, `PayoutsSection`
live exclusively in `pages/PayoutDisplay.jsx`. Pre-extraction commented blocks in
`ResultsPage.jsx` and `RoundSummaryModal.jsx` must remain until 15-C confirms they
are no longer needed.

### H-31: `defaultMatch`/`makeMatchId` are intentionally duplicated in `GamesCard.jsx`
Local copies exist for the "+ Add another Match" button. Authoritative copies remain
in `NewRoundPage.jsx`. If the `defaultMatch` shape ever changes, **both copies must
be updated together**. The local copy is annotated with a comment pointing to this rule.

### H-32: Popup backdrop must disable `onClick` while keypad is active for its fields
Pattern: `onClick={keypadActive ? undefined : onClose}`. Phantom clicks from the
activating tap pass through the keypad and hit the backdrop. Also: never put a CSS
`transition` on `marginBottom` when lifting a popup — animation causes click-target
races on iOS.

### H-33: Plus-CH indicator must be checked before `dotMode === 'gross'` bail
The `+` indicator check (`ch < 0 && rank > 18 - Math.abs(ch)`) must run BEFORE any
early return on `dotMode === 'gross'` or `!dotMode`. The indicator expresses a
structural USGA fact, not a display preference.

### H-34: Plus-CH strokes are given back on the EASIEST holes (highest stroke index)
Correct condition: `hcps[h] > 18 - Math.abs(ch)`. NOT `hcps[h] <= Math.abs(ch)`.
For CH = -5, the indicator fires on SI 14, 15, 16, 17, 18. Do not revert to `<=`.

### H-35: React 18 attaches touch listeners as passive — `e.preventDefault()` in `onTouchEnd` is silently ignored
React 18 passive touch listeners ignore `preventDefault()`. Synthetic click fires
~300ms after touchend. Fix pattern: `touchHandledRef = useRef(0)` set in `onTouchEnd`;
bail in `onClick` when `Date.now() - touchHandledRef.current < 600`.

### H-36: Women's SI must be interleaved using the same odd/even rank algorithm as men's
`handicapsWomen` is stored per-nine as local 1–9 rankings. Building the 18-hole
women's SI by `nines.flatMap(n => n.handicapsWomen)` is WRONG — it produces 1–9
twice. Use the same odd/even interleave as `buildLayout` / `buildGenderLayout`.
`ReadOnlyScorecard` had the flat-flatMap bug pre-13-G.

### H-37: Engine signature changes require auditing every call site by function name
When changing an engine function signature, grep for every engine function name across
all `*.js`/`*.jsx` — never rely on text-pattern grep of related helpers. In 13-G.2,
the initial audit missed 5 higher-level call sites, causing blank-screen crash on
history reload. Pattern: `runMatchNassau\b|runSixesSegment\b|calcSkins\b|...`

### H-38: Cloudflare Pages canonical URL — never use hash deployment URLs for testing
The canonical app URL is `https://the-card-1qm.pages.dev` — it always points to the
latest deployment. Hash deployment URLs (e.g. `941b83c0.the-card-1qm.pages.dev`) are
frozen deployment snapshots of a specific deploy and never update. Using a hash URL for testing
means you are always testing stale code. This caused significant wasted debugging time
in 14-A. Always open the canonical URL; clear browser cache before each test run.

### H-39: Modal backdrop scroll lock requires native non-passive touchmove listener
React's synthetic `onTouchMove` handler cannot call `e.preventDefault()` — React 18
attaches touch listeners as passive, so `preventDefault()` is silently ignored.
To prevent the page beneath a modal from scrolling, use a native event listener:
```js
useEffect(() => {
  const el = backdropRef.current;
  if (!el) return;
  const prevent = (e) => e.preventDefault();
  el.addEventListener('touchmove', prevent, { passive: false });
  return () => el.removeEventListener('touchmove', prevent);
}, []);
```
Do not use `onTouchMove={e => e.preventDefault()}` — it will not work on iOS.

### H-40: `dotEntries` key split — always use `parts.slice(2).join('_')` for dot id extraction
`dotEntries` keys have the shape `"${h}_${pi}_${dotId}"`. Custom dot ids contain
underscores (`c_1714000000000`), so `key.split('_')[2]` returns only `'c'` — not the
full id. Every site that extracts a dot id from a key must use
`parts.slice(2).join('_')` instead of `parts[2]`. The companion check
(`parts[2] === 'team'`) is safe because `'team'` never contains underscores.
Affected files: `payouts.js`, `ScoreGrid.jsx`, `DotsTable.jsx`, `DotsPopup.jsx`.

---

## Open Items

### Sprint 13 — carry-over

- **Partial-round history-reload retest** — load a full 18-hole round, reload into
  `NewRoundPage`, shorten to 9 holes, confirm all three range-aware table components
  trim correctly and the engine computes only over 9 holes. Carried over from 13-C.3
  Phase 2B. Priority: Medium.
- **Dead `Btn` import in `HistoryPage.jsx`** — `Btn` is imported from `ui.jsx` but
  never referenced in the body. Pick up in 15-F cleanup pass. Priority: Low.

### Sprint 14 — carry-over

- **14-A.2 Mistral OCR** — Requires real WiFi. See BUILD_PLAN 14-A detailed notes for
  exact pickup instructions. Priority: High (gated on connectivity).
- **CourseCard.jsx display changes** — Hole numbering (1-9 per nine) and 27-hole combo
  yardages shipped but not formally device-confirmed on a 27-hole course import.
  Confirm with Sahalee import in 14-A.2 or 14-B. Priority: Low.

---

## Document Index

Contract version pins below verified against each contract's actual version header.

### Current contracts and core docs

| Document | Version | Purpose |
|---|---|---|
| `ARCHITECTURE_FOUNDATIONS.md` | — | Mental models, layer system, the "why" |
| `App_Data_Model_Contract.md` | v3.7 | State schema, storage keys, mutation rules. v3.7 (13-G.2) Player schema gains `siArray`. Course schema in `courseLib.js` comment block gains optional `nineComboNames?: string[]` (14-A — 27-hole combo labels). `website` field removed from UI/prompt/merge (14-B). |
| `Round_Lifecycle_Contract.md` | v2.2 | Setup→score→save flow, activeRound lifecycle |
| `Handicap_Contract.md` | v2.0 | USGA math, `buildPlayerSI`, engine SI source rule |
| `Payout_Contract.md` | v1.13 | `computePayouts` entry point, `subsetMin` pattern |
| `Nassau_Match_Contract.md` | v3.0 | Nassau/Match Play rules, press system, engine API |
| `Sixes_Contract.md` | v1.11 | Sixes team rotation, hole scoring, press system |
| `Skins_Contract.md` | v1.8 | Skins carryover, subset behavior, departure handling |
| `Stableford_Contract.md` | v1.7 | Stableford points table, `betMode`, team scoring |
| `Nines_Contract.md` | v1.6 | Nines point table, `betMode`, blitz rule, 3-player constraint |
| `Stroke_Play_Contract.md` | v1.7 | Stroke play `betMode`, `strokePlayPlayers` subset |
| `Dots_Contract.md` | v2.5 | Dots/Junk: `DOTS_DEF`, specials, mutual exclusivity, team payout |
| `PartialGameContract.md` | v2.2 AUTHORITATIVE | Partial round, predetermined ranges, early departure |
| `ScoreKeypad_Contract.md` | v2.4 AUTHORITATIVE | Custom keypad: universal system-keyboard replacement |
| `UI_Component_Contract.md` | v1.5 | `ui.jsx` tokens, all components, `style` prop pattern |
| `Universal_Contract_Template.md` | v1.0 AUTHORITATIVE SKELETON | Template every game contract must conform to |

### Process / planning docs

| Document | Purpose |
|---|---|
| `BUILD_PLAN.md` | Authoritative session history, completed sessions table, open session plan, deferred items, decision log |
| `APP_STATE_SUMMARY.md` (this file) | Lean status, gotchas (H-1…H-39), open items, document index |
| `Session_Intro_Template.md` | Boilerplate prompt for starting a fresh chat session |
| `Session_Closing_Maintenance_Template.md` | Step-by-step closing-session checklist for BP and ASS maintenance |
| `NewRoundPage_Design_Spec.md` | 11-H output: full NewRoundPage setup UI design spec. 13-E.7: three card body sections now in `pages/new-round/CourseCard.jsx`, `PlayersCard.jsx`, `GamesCard.jsx` |
| `Resolver_UI_Spec.md` | v1.4 — implementation-level spec for early-departure resolver |

### Superseded / historical

| Document | Status | Notes |
|---|---|---|
| `Early_Departure_Contract.md` | v1.0 DRAFT — superseded | Superseded by `PartialGameContract.md` in 13-C |
| `Late_Arrival_Contract.md` | v1.0 DRAFT — superseded | Superseded by `PartialGameContract.md` in 13-C |
| `Dots_Contract_v2_0.md`, `Dots_Contract_v2_1.md` | Stale duplicates | `Dots_Contract.md` is current at v2.5. Remove from project knowledge base when convenient. |
