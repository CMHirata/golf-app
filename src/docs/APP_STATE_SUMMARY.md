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

_None. Session 15-Bugs.1 fully complete and device-confirmed. **Next session: 15-A — Display Polish**._

---

## Current State

_Last refresh: May 2026 — Session 15-Bugs.1 complete and confirmed on device._

Session 15-Bugs.1 complete. Fixed female course handicap calculation on 3-nine courses. `computePlayerCH` and the `groupCourseHandicaps` call in `NewRoundPage.jsx` were passing all of `course.nines` when summing `parsWomen` for `womensPar`, overcounting par by one full nine (e.g. 108 instead of 72 at Sahalee). Fixed by deriving `activeNines` filtered to the active front + back nines at both call sites. Two surgical `str_replace` edits to `NewRoundPage.jsx` only. No engine changes. No contract changes.

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

### H-5: `specEntries` keys encode hole + player index
`specEntries` is a flat object keyed by `"${holeIdx}_${playerIdx}_${specialId}"`.
Never key by player name — names change and collide.

### H-6: Press array is sorted and sparse — never dense
`manualPresses["Match:id:Segment"]` is a sorted array of hole indices. It may
have gaps. The engine reconstructs the hierarchy from sorted position, not from
array indices. Do not normalize to a dense array.

### H-7: `computePayouts` is always called fresh — never cache its result in state
Payouts are derived values. `computePayouts()` is called from `ResultsPage` on each
render. Do not store payout results in `activeRound` as authoritative data.

### H-8: `fromActiveRound` / `toActiveRound` must stay in sync
Both conversion functions in `roundLib.js` must handle every field in `activeRound`.
When a new field is added to `activeRound`, both functions must be updated together,
or round-trip serialization silently drops the new field.

### H-9: `buildPayoutArgs` in `App.jsx` must stay in sync with engine contracts
`buildPayoutArgs()` assembles the arguments passed to `computePayouts()`. Every
field listed in each game contract's `computePayouts` input spec must appear here.
See App Data Model Contract §10 (synchronization rule).

### H-10: `siArray` on `activePlayers` entries is the sole SI source for engines
Since 13-G.2, every `activePlayers[i]` has a `siArray: number[18]` attached at
round-start. Engine functions read `players[pi].siArray[h]` directly. The old
`hcps` parameter has been removed from all 9 engine function signatures. Do not
re-introduce `hcps` as an engine parameter.

### H-11: `scoringMode` vs `grossNetNOL` — field names
The player-level field is `grossNetNOL` (renamed in 11-I.3). The match-level field
is `scoring` (also renamed in 11-I.3, from `tiebreak`). Do not revert to old names.

### H-12: `ZoomModal` uses hidden `<input>` for iOS keyboard suppression
`ZoomModal.jsx` renders a hidden `<input readOnly onFocus={e => e.target.blur()}>`
to absorb the iOS focus event without opening the system keyboard. Do not replace
this with a `<div>` — div tap targets do not reliably suppress the keyboard on iOS.

### H-13: Sixes rotation depends on `teamAssignments` in `activeRound`
`teamAssignments` is set once at round-start and must persist across saves/reloads.
The rotation logic in `runSixesSegment` derives team composition from this array per
hole. Do not re-derive `teamAssignments` from scores — it must be the stored value.

### H-14: `NinesTable` renders 3-player only — 4-player Nines is not implemented
The Nines engine handles only 3 players. `NinesTable` enforces this with a guard.
Do not attempt to generalize without a contract amendment first.

### H-15: Match/Nassau uses `matchId` as the stable identity key
Each match has a `matchId` generated at setup time. This key is used throughout
`manualPresses`, `specEntries` (for match-scoped specials), and payout accumulation.
Do not use array index as match identity — it shifts when matches are added/removed.

### H-16: `earlyEndOpts` lives in `activeRound` — never in component state
Early departure options are stored in `activeRound.earlyEndOpts` and persist across
app restores. Component state is derived from this value at mount. Do not lift
departure state into React component state where it would be lost on app reload.

### H-17: `lastCompletedHole` is 0-indexed
`activeRound.lastCompletedHole` is a 0-based hole index (0 = hole 1 completed).
Display logic must add 1 for human-readable output. Engine functions receive it
as-is. Do not normalize to 1-based at storage time.

### H-18: `DepartureResolverSheet` is per-player, never combined
The sequenced-event model (PartialGameContract v2.0) requires one resolver sheet
per departing player, shown in departure order. Never combine multiple players into
a single sheet. The v1.x combined-sheet model has been removed.

### H-19: `resolverUtils.js` is the sole source of resolver option logic
`buildResolutionOptions()` and `applyClinchDetection()` live in `resolverUtils.js`.
Do not inline resolver option logic into `DepartureResolverSheet` or `useDepartureResolver`.

### H-20: Reorder Departures modal mutates `earlyEndOpts` order in place
`ReorderDeparturesModal` reorders the departure queue by writing a new sorted
`earlyEndOpts` array to `activeRound`. The resolver sheet always processes
`earlyEndOpts[0]` (the first unresolved entry). Do not cache the queue order in
component state.

### H-21: `PayoutDisplay.jsx` owns all payout display sub-components
`DotsColTable`, `SubHeader`, `PayRow`, `splitGameHeader`, `fmtMoney`, `PayoutsSection`
are defined only in `PayoutDisplay.jsx`. Do not re-inline these sub-components in
`ResultsPage.jsx` or `RoundSummaryModal.jsx`. Pre-extraction commented blocks in
those files were confirmed unneeded in 15-C and may be removed.

### H-22: `useIsLandscape` hook — single import from `hooks/useIsLandscape.js`
Landscape detection logic lives exclusively in `hooks/useIsLandscape.js`. Do not
copy the resize listener into component files. Import the hook.

### H-23: `SwipeableRoundRow` and `SwipeableRow` are separate components
`SwipeableRoundRow` (in `pages/history/`) is the history-specific swipe row with
round-action callbacks. `SwipeableRow` (in `components/`) is the generic swipe row
used by `PlayersPage` and `CoursesPage`. They share the same gesture mechanics
(H-41) but have different prop interfaces. Do not merge them.

### H-24: `NewRoundHelpers.jsx` module-scope helpers — single import
`defaultMatch`, `makeMatchId`, `fmtHcp`, `validateBet` are defined in
`NewRoundHelpers.jsx` and imported by `NewRoundPage`, `GamesCard`, `PlayersCard`.
Exception: `GamesCard.jsx` has a local `defaultMatch`/`makeMatchId` copy for the
"+ Add another Match" button (H-31). All other consumers import from `NewRoundHelpers`.

### H-25: `applyDepartureGuardrailToScores` must be called before score aggregation
The departure guardrail zeroes out scores for holes a departed player did not play.
`payouts.js` applies it engine-side. Every display-side score aggregator
(`TotalsCard`, game table components, share utilities) must also call it before
summing scores. Skipping it allows departed-player scores to pollute totals silently.

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
live exclusively in `pages/PayoutDisplay.jsx`. Do not re-inline in any consumer file.

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

### H-41: `SwipeableRow` gesture mechanics — all tracking state in refs, zero setState during gesture
`SwipeableRow` (and `SwipeableRoundRow`) use direct DOM style manipulation during
touch gestures — never `setState`. The sliding div is updated via `slideRef.current.style.transform`
only. React state (`snapOffset`) is written once at touchend for the snap position.
`snapClose()` must be called before any action callback (edit/delete) — calling the
action first causes a re-render that replaces event handler references mid-gesture.
Do not refactor to use `useState` for live offset tracking — it breaks on iOS Safari.

### H-42: When adding a field to an entity record, audit the import field-list
`HistoryPage.applyImport` rebuilds player records using a fixed string array of
field names (`f = ['name', 'gender', 'ghin', 'email', 'phone', 'starred', 'inMoneyLists']`)
at two sites: conflict-detection (line ~158) and conflict-resolution (line ~199).
Any field added to the player record schema must be added to this array at both
sites or it will be silently dropped when the user imports a backup containing a
conflicting record. Brand-new (non-conflicting) records are written verbatim and
are not affected. The same audit applies if the course or round schema gains a
similar import-time field-list filter in the future. Surfaced and fixed in 15-E.1.

### H-43: Filter `course.nines` to active nines before summing `womensPar`
`groupCourseHandicaps` and `computePlayerCH` in `NewRoundPage.jsx` accept a `nines`
array for gender-aware par. This array MUST be filtered to only the active front and
back nines before being passed — never pass the full `course.nines`. On 3-nine
courses, passing all nines overcounts par by one nine (e.g. 108 instead of 72),
producing a wildly wrong course handicap for female players. Pattern:
```js
const activeNines = (course?.nines || []).filter(n => n.name === frontNine || n.name === backNine);
```
Use `activeNines` at both the `computePlayerCH` internal par sum and the
`groupCourseHandicaps` call in `handleStart`. Surfaced and fixed in 15-Bugs.1.

---

## Open Items

### Sprint 13 — carry-over

- **Partial-round history-reload retest** — load a full 18-hole round, reload into
  `NewRoundPage`, shorten to 9 holes, confirm all three range-aware table components
  trim correctly and the engine computes only over 9 holes. Carried over from 13-C.3
  Phase 2B. Priority: Medium.

### Sprint 14 — carry-over

- **14-A.2 Mistral OCR** — Requires real WiFi. See BUILD_PLAN 14-A detailed notes for
  exact pickup instructions. Priority: High (gated on connectivity).
- **CourseCard.jsx display changes** — Hole numbering (1-9 per nine) and 27-hole combo
  yardages shipped but not formally device-confirmed on a 27-hole course import.
  Confirm with Sahalee import in 14-A.2 or 14-B. Priority: Low.

### Sprint 15 — carry-over

- **Starred players auto-selection in New Round** — starred players surface at top of picker but are not auto-selected. Deferred; log for future sprint if demand arises.

---

## Document Index

Contract version pins below verified against each contract's actual version header.

### Current contracts and core docs

| Document | Version | Purpose |
|---|---|---|
| `ARCHITECTURE_FOUNDATIONS.md` | — | Mental models, layer system, the "why" |
| `App_Data_Model_Contract.md` | v3.8 | State schema, storage keys, mutation rules. v3.7 (13-G.2): Player schema gains `siArray`. v3.8 (15-E.1): §1 — app-preference localStorage keys (`moneyListRange`, `historyRange`) documented as direct-string exception to SK-only rule. §1.1 NEW — range pref shape. §1.2 NEW — backup payload `settings` field (carries app preferences through export/import). Course schema gains `nineComboNames?: string[]` (14-A). `website` field removed (14-B). Player library record has `starred?` and `inMoneyLists?` fields (15-E §5.3). |
| `Round_Lifecycle_Contract.md` | v2.3 | Setup→score→save flow, activeRound lifecycle. v2.3 (15-E.1): §5.2 — auto-export payload now carries top-level `settings` field; cross-references App_Data_Model §1.2. |
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
| `UI_Component_Contract.md` | v1.7 | `ui.jsx` tokens, all components, `style` prop pattern. v1.6 (15-E.1): §10 NEW — `RangePicker.jsx` shared component documented. v1.7 (15-G): §3.6 NEW — `BIRDIE_COLOR` and `BOGEY_COLOR` tokens. §4.11 NEW — ScoreGrid score-cell indicator overlay rules (eagle/birdie/par/bogey/double-bogey). |
| `Universal_Contract_Template.md` | v1.0 AUTHORITATIVE SKELETON | Template every game contract must conform to |

### Process / planning docs

| Document | Purpose |
|---|---|
| `BUILD_PLAN.md` | Authoritative session history, completed sessions table, open session plan, deferred items, decision log |
| `APP_STATE_SUMMARY.md` (this file) | Lean status, gotchas (H-1…H-43), open items, document index |
| `Session_Intro_Template.md` | Boilerplate prompt for starting a fresh chat session |
| `Session_Closing_Maintenance_Template.md` | Step-by-step closing-session checklist for BP and ASS maintenance |
| `NewRoundPage_Design_Spec.md` | 11-H output: full NewRoundPage setup UI design spec. 13-E.7: three card body sections now in `pages/new-round/NewRoundCourseCard.jsx`, `PlayersCard.jsx`, `GamesCard.jsx` |
| `Resolver_UI_Spec.md` | v1.4 — implementation-level spec for early-departure resolver |

### Superseded / historical

| Document | Status | Notes |
|---|---|---|
| `Early_Departure_Contract.md` | v1.0 DRAFT — superseded | Superseded by `PartialGameContract.md` in 13-C |
| `Late_Arrival_Contract.md` | v1.0 DRAFT — superseded | Superseded by `PartialGameContract.md` in 13-C |
| `Dots_Contract_v2_0.md`, `Dots_Contract_v2_1.md` | Stale duplicates | `Dots_Contract.md` is current at v2.5. Remove from project knowledge base when convenient. |
