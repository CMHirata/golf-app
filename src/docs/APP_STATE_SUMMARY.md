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

_None. Session 15-Bugs.6 fully complete and device-confirmed. **Next session: 16-A — Wolf (contract first)**._

---

## Current State

_Last refresh: June 2026 — Session 15-Bugs.6 complete and confirmed on device._

Session 15-Bugs.6 complete. `ManualCourseModal.jsx` now scrolls correctly when `ScoreKeypad` opens on the Rating/Slope & Yardage tab. Fix mirrors the 15-Bugs.3 pattern (H-48): `paddingBottom:300` applied to the modal card when `setupKp` is active, forcing the scroll container to be genuinely scrollable. `kpWasOpenRef` guards the `scrollTop = scrollHeight` call to fire only on the closed→open keypad transition — not on field-to-field switches while the keypad is already open (which caused a double-scroll / extra whitespace artifact). H-48 amended; H-51 added. Sprint 15 remains fully complete. Next: 16-A — Wolf (contract first).

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
segment. Do not recompute or re-randomize `teamAssignments` after round-start.

### H-14: `computeInsights` reads `filteredRounds` — not `roundLib`
`computeInsights` in `HomePage.jsx` iterates the already-filtered rounds array.
Do not pass `roundLib.list()` directly — it bypasses the active roster filter and
the date range filter, producing stale or wrong insight values.

### H-15: `PlayerPickerPopup` selection order is significant for Sixes
The order players are selected in `PlayerPickerPopup` determines their index in
`activePlayers`. Sixes team rotation is keyed to those indices via `sixesTeams`.
Do not sort or reorder `activePlders` after the picker closes.

### H-16: `roundLib` list order is insertion order — do not sort
`roundLib.list()` returns rounds in insertion (chronological) order.
`filteredRounds` preserves that order. Components that display rounds
(HistoryPage, HomePage) depend on this. Do not introduce a sort step.

### H-17: `ML_KEY` and `moneyListRange` are independent of `SK`
`ML_KEY` (`'moneyList'`) is a direct localStorage key, not part of `SK`.
`moneyListRange` is also a direct key. Both survive backup/restore via the
`settings` payload field. Do not add them to `SK`.

### H-18: `cleanGameName` strips emoji — do not display raw game config names
Raw game names from `GAME_CONFIGS` may contain emoji (e.g. "🏌️ Skins"). Always
pass through `cleanGameName()` before display. "Specials" normalizes to "Dots".

### H-19: `computeStreaks` requires at least 2 rounds
`computeStreaks` in `roundUtils.js` silently returns empty arrays on 0 or 1 rounds.
Always guard the call site with `filteredRounds.length >= 2` before calling.

### H-20: `fmtDollar` rounds to nearest cent — do not use for engine math
`fmtDollar` is display-only. Engine payout values are kept as raw numbers.
Never feed `fmtDollar` output back into arithmetic.

### H-21: `r.bank` is the authoritative net per-player payout map
`r.bank` (keyed by player index) is the single source of truth for net payouts.
`r.breakdown` is display metadata only. Do not derive net amounts from breakdown.

### H-22: `r.matches` array index ≠ player index
`r.matches` is a list of match result objects. The player indices inside each match
object are `teamA` / `teamB` arrays of global player indices. Do not use the
position in `r.matches` as a player index.

### H-23: ScoreGrid column widths are fixed — `COL_W` and `TOT_W` are constants
`COL_W` (score column width) and `TOT_W` (total column width) are defined in
`scorecardUtils.js`. All game tables must use these values for layout consistency.
Do not hardcode column widths in individual table components.

### H-24: `buildLeadState` returns a sparse object — not all holes are present
`buildLeadState(winFn, holes)` returns `{ [hole]: { lead, matchOver, holesLeft } }`.
Only holes where the winner function returns a non-null value are present.
Always use `.find()` or similar to locate the last scored hole — do not assume
`leadState[lastHole]` exists.

### H-25: Nassau engine front/back midpoint must match display layer
`runMatchNassau` accepts `{ startHole, endHole }` range. The display layer derives
`frontH` / `backH` from the same midpoint logic. If these diverge (e.g. a 9-hole
match where engine defaults to 0–17), press bets and display rows cover different
hole sets. Always pass `effStart`/`effEnd` to `runMatchNassau` from the display layer.

### H-26: `GameConfig` dispatcher pattern — do not add game logic to `GameConfig.jsx`
`GameConfig.jsx` is a pure dispatcher. It reads `betType` from `GAME_CONFIGS` and
renders the appropriate `GameConfig*.jsx` panel. All game-specific config UI lives
in the panel file. Shared sub-components (e.g. `PayStylePill`) live in
`GameConfigShared.jsx`. Do not add conditional game logic to the dispatcher.

### H-27: `SwipeableRow` gesture state lives in refs — zero setState during gesture
All gesture tracking (`startX`, `currentX`, `isDragging`, `animFrame`) is in
`useRef`. `setState` is only called on gesture end (snap open/close). Calling
`setState` during `onTouchMove` causes re-renders that break the 60fps swipe feel.

### H-28: `PartialGameContract` departure guardrail must be applied before engine calls
`applyDepartureGuardrailToScores()` filters scores past `departureHole` to `'X'`
before any engine function sees them. This must happen at the game-table level
(before `runMatch`, `runSixes`, etc.), not inside the engines themselves.
Missing this call causes departed players' post-departure holes to affect results.

### H-29: `earlyDepartureOpts` default is `{}` — never `null` or `undefined`
All game table components accept `earlyDepartureOpts` with a default of `{}`.
`applyDepartureGuardrailToScores` checks `opts.departureHole != null` before
filtering. Passing `null` causes a runtime error in the null-check.

### H-30: `resolveSegmentNames` deduplicates by first name — do not pass full names
`resolveSegmentNames(foursome)` compares first names for collision detection and
returns disambiguated display names. Always pass the full player objects (with
`.name`), not pre-extracted first names. Passing full "First Last" strings causes
the collision check to compare full names, not first names, missing same-first-name
collisions.

### H-31: `NewRoundPage` card sections are separate files — edit the right one
`NewRoundPage.jsx` renders three card bodies from imported components:
- Course card → `pages/new-round/NewRoundCourseCard.jsx`
- Players card → `pages/new-round/PlayersCard.jsx`
- Games card → `pages/new-round/GamesCard.jsx`
Do not edit `NewRoundPage.jsx` for card-body UI changes — the card bodies are not
inline in that file.

### H-32: iOS `visualViewport` resize fires before layout settles — debounce required
On iOS Safari, `visualViewport` `'resize'` fires immediately when the software
keyboard appears, before the layout viewport has adjusted. Reading `window.innerHeight`
or `visualViewport.height` synchronously in the handler returns stale values.
Use a `setTimeout(fn, 50)` debounce inside the resize handler before reading
viewport dimensions.

### H-33: `KpField` in `ManualCourseModal` uses `readOnly` + blur to suppress keyboard
`KpField` is a text input that opens `ScoreKeypad` instead of the system keyboard.
It uses `readOnly={true}` and `onFocus={e => e.target.blur()}` to prevent the system
keyboard from appearing. Do not remove `readOnly` — it is required for iOS keyboard
suppression, not just a UI hint.

### H-34: `ScoreKeypad` `zIndex` must exceed modal `zIndex`
`ScoreKeypad` renders at `zIndex: 1100`. Any modal that uses `ScoreKeypad` must
render at a lower z-index (e.g. `zIndex: 1000`). If a modal renders at 1100 or
higher, the keypad will appear behind it and be non-interactive.

### H-35: `useIsLandscape` hook — single import, do not inline
`useIsLandscape` is extracted to `src/hooks/useIsLandscape.js`. It is the canonical
landscape detector. Do not inline `window.matchMedia('(orientation: landscape)')`
elsewhere. The hook handles the `resize` listener and cleanup.

### H-36: `groupCourseHandicaps` — always pass `players` array with `gender` field
`groupCourseHandicaps` uses `players[i].gender` to determine whether to use men's
or women's tee data for course handicap computation. If `gender` is missing or
`undefined`, the function silently falls back to men's tees. Always ensure
`activePlayers` entries carry `gender` from the player library record.

### H-37: `siArray` is attached at round-start by `buildPlayerSI` — never mutate it
`siArray` is a frozen 18-element array attached to each `activePlayers[i]` entry
at round-start. It encodes the full SI allocation for that player's tee and gender.
Never mutate `siArray` mid-round. If tee or gender changes, a new round must be
started — there is no migration path for in-progress rounds.

### H-38: `RangePicker` `loadRangePref` / `saveRangePref` require a storage key arg
Both functions accept a `key` parameter (e.g. `'moneyListRange'` or `'historyRange'`).
Do not call them without a key — the default is `undefined`, which writes to
`localStorage.getItem(undefined)` and produces silent data corruption.

### H-39: `ManualCourseModal` save is blocked on SI validation errors — check `siErrors`
`ManualCourseModal` maintains a `siErrors` state object. The Save button is disabled
when `Object.values(siErrors).some(Boolean)`. If SI validation logic changes, always
verify that `siErrors` is updated correctly for all nine configurations (1-nine,
2-nine with odd/even USGA rule, 3-nine with 1–9 per nine).

### H-40: ScoreKeypad double-fire on iOS — `touchHandledRef` timestamp guard on `onClick`
React 18 passive touch listeners cannot call `preventDefault()` to suppress the
synthetic `onClick` that fires ~300ms after `touchEnd`. The fix is a
`touchHandledRef` that records the timestamp of the last `touchEnd`; the `onClick`
handler no-ops if called within 600ms of that timestamp. Do not remove this guard —
without it, every digit tap registers twice on iOS.

### H-41: `pivotSegTot` / `pivotRoundTot` companion filtering uses `slice(2).join('_')`
Custom dot IDs have the form `c_timestamp`. The ID extraction pattern must use
`parts.slice(2).join('_')` (not `parts[2]`) to handle any timestamp that contains
underscores. Using `parts[2]` silently drops custom dot entries with multi-segment
IDs, breaking companion filtering and payout accumulation.

### H-42: `HistoryPage.applyImport` `f` field list must include `starred` and `inMoneyLists`
The conflict-resolution loop in `applyImport` rebuilds player records from a fixed
field list `f`. If `starred` or `inMoneyLists` are absent from `f`, conflicting
imports silently drop those fields for existing players. Both fields must appear in
`f` at both the conflict-detection site (~line 158) and the conflict-resolution
site (~line 199).

### H-43: Female course handicap on 3-nine courses — filter to active nines only
`groupCourseHandicaps` and `computePlayerCH` in `NewRoundPage.jsx` sum `parsWomen`
across the nines passed in. On a 3-nine course, `course.nines` has three entries.
Always filter to `activeNines` (front + back only) before passing to these functions.
Passing all three nines produces a wildly wrong `womensPar` (e.g. 108 instead of 72
at Sahalee). Pattern:
```js
const activeNines = (course?.nines || []).filter(n => n.name === frontNine || n.name === backNine);
```
Use `activeNines` at both the `computePlayerCH` internal par sum and the
`groupCourseHandicaps` call in `handleStart`. Surfaced and fixed in 15-Bugs.1.

### H-44: `payStyle` fork must be added to ALL betMode branches, including `'perpoint'`
When adding a new payout option (like `payStyle`) to a game engine block, every `betMode` branch needs the fork — not just `'total'` and `'segments'`. In 15-J, the `'perpoint'` branches in both Stableford and Nines were initially missed because the existing pairwise-differential logic happened to be the correct "Pay Up" behavior but silently ignored `payStyle:'paywinner'`. Always audit every branch of the affected payout block when adding a new option field.

### H-45: Sixes `randomizeTeams` must enumerate pairings from real player indices, not positions
`sixesTeams` stores global player indices (e.g. 0, 2, 3, 1 — whatever order the
players appear in the `players` array). A randomize function that hardcodes `[0,1,2,3]`
as array positions will produce correct-looking assignments but will silently violate
the unique-pairing constraint when players are not in identity order. Always derive
the 3 valid pairings from `players.map((_, i) => i)` and pick two distinct ones.
The uniqueness check must mirror the `usedPairs` / `priorTeammates` logic in the
manual picker — not a simplified heuristic. Surfaced and fixed in 15-K.

### H-46: `overflow:hidden` on any ancestor of `PlayerAvatar` kills photo rendering on iOS Safari
iOS Safari does not render `<img>` elements inside a subtree that has `overflow:hidden`
combined with `border-radius` anywhere in the ancestor chain. This manifests as a
blank white square — the img element is present in the DOM, has correct `src`, correct
dimensions, and `complete:true`, but paints nothing. The fix: never put
`overflow:hidden` on a container that is an ancestor of `PlayerAvatar`. Use
`overflow:hidden` only on the `<img>` element's immediate parent if needed, or use
`border-radius` directly on the `<img>` itself for circular cropping instead.
Confirmed via Safari Web Inspector console testing in 15-L.

### H-47: `<img>` inside SVG foreignObject does not reliably render on iOS Safari
When `drawImage` is called on a canvas with an SVG data URI that contains
`<foreignObject>` with `<img>` tags, iOS Safari does not decode the images before
painting — they render as blank. This is an unfixable iOS Safari limitation.
The workaround used in `shareUtils.js`: render the foreignObject HTML with initial
circles only (no `<img>` tags for photos), then draw photos directly onto the canvas
after the foreignObject renders using the 2D canvas API (`ctx.arc` + `ctx.clip` +
`ctx.drawImage`). Avatar positions are located via `data-avatar-id` attributes on the
initial-circle divs in the probe element. Do not revert to `<img>` tags inside
foreignObject HTML for photos.

### H-48: ScoreKeypad physically covers bottom of fixed modal sheets — use paddingBottom + scrollTop on open transition only
`ScoreKeypad` is `position:fixed, bottom:0` with `zIndex:1100`. It renders on top of
any modal sheet (e.g. the Edit Player sheet, `zIndex:1000`). Because the keypad is
outside the modal's DOM subtree and does not affect the layout viewport,
`scrollIntoView()` on the sheet's scroll container has no effect — the sheet content
is not actually overflowing; it is simply hidden behind the keypad. The correct fix:
(1) add `paddingBottom:300` to the sheet's scroll container when the keypad is active
(reverts to normal when inactive) — this forces `scrollHeight > clientHeight`, making
the container genuinely scrollable; (2) in a `useEffect` on the keypad's active field
ID, wait 50ms then set `scrollTop = scrollHeight` on the container ref — the delay
lets the padding render first. **Critical:** guard the scroll with a ref (`kpWasOpenRef`)
so it only fires on the closed→open transition. If it fires on every `fieldId` change
(i.e. tapping field-to-field while the keypad is already open), the modal double-scrolls
and exposes extra whitespace that does not reset until the keypad is dismissed. Do not
attempt `visualViewport` listeners or `scrollIntoView` for this class of problem. Proven
pattern used in `PlayersPage.jsx` (15-Bugs.3) and `ManualCourseModal.jsx` (15-Bugs.6).

### H-49: Sixes color anchor must use `sixesTeams[0]` team composition — not raw player index
`SixesTable` assigns "blue side" vs "red/yellow side" colors to hole chips, Total
cells, and segment headers based on which team a player belongs to. The anchor must
be `sixesTeams[0].a` and `sixesTeams[0].b` — the two players who form team A in
segment 0 (holes 1–6). Using raw player indices (0+1 = blue, 2+3 = red) fails when
segment-0 team A pairs index 0 with index 3 (e.g. Tom + Greg), because index 3
would be incorrectly colored red. The correct pattern:
```js
const makeIsBluePlayer = (seg0team) => {
  const blueSet = new Set([seg0team.a, seg0team.b]);
  return (pi) => blueSet.has(pi);
};
const isBluePlayer = makeIsBluePlayer(sixesTeams[0]);
```
Instantiate inside the component after `sixesTeams[0]` is available. Surfaced and
fixed in 15-Bugs.4.

### H-50: `siValidSet` must not enforce odd/even per nine index — courses vary
`ManualCourseModal`'s original `siValidSet(nineCount, nineIdx)` returned odd values
`[1,3,5…17]` for nine 0 and even `[2,4,6…18]` for nine 1 on 2-nine courses. Courses
where the front nine carries even SI values (e.g. Snohomish GC: `[6,16,2,8,10,4,12,18,14]`)
caused every `<select>` to snap to its first valid option — all displaying 1 (front)
or 2 (back). Fix: both nines in a 2-nine course offer all 18 values; `dupIndices`
validation is the sole correctness gate. Do not re-introduce odd/even option-list
filtering on the dropdowns. Surfaced and fixed in 15-Bugs.5.

### H-51: ScoreKeypad scroll-to-bottom must only fire on closed→open transition — use `kpWasOpenRef`
When a modal uses `ScoreKeypad` and scrolls to `scrollHeight` on keypad activation,
the scroll `useEffect` must be guarded so it only fires when the keypad transitions
from closed to open — not when the user taps a different field while the keypad is
already open. Without this guard, each field tap re-fires the scroll, pushing the
modal further down and exposing extra whitespace that does not reset until the keypad
is dismissed. Pattern:
```js
const kpWasOpenRef = useRef(false);
useEffect(() => {
  const wasOpen = kpWasOpenRef.current;
  kpWasOpenRef.current = !!setupKp;
  if (!setupKp || wasOpen) return;  // only fire on closed→open
  const t = setTimeout(() => {
    if (containerRef.current)
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, 50);
  return () => clearTimeout(t);
}, [setupKp?.fieldId]);
```
Dependency is `setupKp?.fieldId` (so it fires on each new field activation), but
the `wasOpen` guard suppresses it unless the keypad was previously closed. Surfaced
and fixed in 15-Bugs.6.

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
| `App_Data_Model_Contract.md` | v4.1 | State schema, storage keys, mutation rules. v3.7 (13-G.2): Player schema gains `siArray`. v3.8 (15-E.1): §1 — app-preference localStorage keys documented. §1.1 NEW — range pref shape. §1.2 NEW — backup payload `settings` field. Course schema gains `nineComboNames?: string[]` (14-A). `website` field removed (14-B). Player library record has `starred?` and `inMoneyLists?` fields (15-E §5.3). §5.5 Nines betMode updated to `'perpoint' \| 'total' \| 'segments'` (15-I). v3.9 (15-J): `payStyle` added to Stroke Play, Stableford, Nines, Dots gameOpts schemas; `dotsMode` added to Dots schema. v4.0 (15-L): `photo?` added to player library record schema (§5.3); library-only, never copied to `activePlayers` snapshot. §1.1 amended (15-N): `range` union gains `'30days'` and `'365days'`; `'mtd'` removed from active options. v4.1 (15-O): §5.2 — course library record schema added; `starred?: boolean` field documented (library-only, absent = false, sorts above non-starred). |
| `Round_Lifecycle_Contract.md` | v2.3 | Setup→score→save flow, activeRound lifecycle. v2.3 (15-E.1): §5.2 — auto-export payload now carries top-level `settings` field; cross-references App_Data_Model §1.2. |
| `Handicap_Contract.md` | v2.0 | USGA math, `buildPlayerSI`, engine SI source rule |
| `Payout_Contract.md` | v1.13 | `computePayouts` entry point, `subsetMin` pattern |
| `Nassau_Match_Contract.md` | v3.0 | Nassau/Match Play rules, press system, engine API |
| `Sixes_Contract.md` | v1.11 | Sixes team rotation, hole scoring, press system |
| `Skins_Contract.md` | v1.8 | Skins carryover, subset behavior, departure handling |
| `Stableford_Contract.md` | v1.8 | Stableford points table, `betMode`, team scoring. v1.8 (15-J): `payStyle` field added (default `'paywinner'`; individual mode only); `'perpoint'` UI label renamed "Point Spread". |
| `Nines_Contract.md` | v1.8 | Nines point table, `betMode`, blitz rule, 3-player constraint. v1.7 (15-I): `'total'` betMode added. v1.8 (15-J): `payStyle` field added (default `'payup'`); `'perpoint'` UI label renamed "Point Spread". |
| `Stroke_Play_Contract.md` | v1.8 | Stroke play `betMode`, `strokePlayPlayers` subset. v1.8 (15-J): `payStyle` field added (default `'paywinner'`). |
| `Dots_Contract.md` | v2.6 | Dots/Junk: `DOTS_DEF`, specials, mutual exclusivity, team payout. v2.6 (15-J): `dotsMode: 'spread' \| 'total'` contracted (was UI-only gap); `'total'` engine branch implemented; `payStyle` field added (default `'payup'`); "Spread" UI label renamed "Point Spread". |
| `PartialGameContract.md` | v2.2 AUTHORITATIVE | Partial round, predetermined ranges, early departure |
| `ScoreKeypad_Contract.md` | v2.4 AUTHORITATIVE | Custom keypad: universal system-keyboard replacement |
| `UI_Component_Contract.md` | v1.7 | `ui.jsx` tokens, all components, `style` prop pattern. v1.6 (15-E.1): §10 NEW — `RangePicker.jsx` shared component documented. v1.7 (15-G): §3.6 NEW — `BIRDIE_COLOR` and `BOGEY_COLOR` tokens. §4.11 NEW — ScoreGrid score-cell indicator overlay rules (eagle/birdie/par/bogey/double-bogey). §10 amended (15-N): 6 pill options documented (Week/Month/Year/YTD/All/Custom); `'30days'` and `'365days'` range values added; MTD removed. |
| `Universal_Contract_Template.md` | v1.0 AUTHORITATIVE SKELETON | Template every game contract must conform to |

### Process / planning docs

| Document | Purpose |
|---|---|
| `BUILD_PLAN.md` | Authoritative session history, completed sessions table, open session plan, deferred items, decision log |
| `APP_STATE_SUMMARY.md` (this file) | Lean status, gotchas (H-1…H-51), open items, document index |
| `Session_Intro_Template.md` | Boilerplate prompt for starting a fresh chat session |
| `Session_Closing_Maintenance_Template.md` | Step-by-step closing-session checklist for BP and ASS maintenance |
| `NewRoundPage_Design_Spec.md` | 11-H output: full NewRoundPage setup UI design spec. 13-E.7: three card body sections now in `pages/new-round/NewRoundCourseCard.jsx`, `PlayersCard.jsx`, `GamesCard.jsx` |
| `Resolver_UI_Spec.md` | v1.4 — implementation-level spec for early-departure resolver |

### Superseded / historical

| Document | Status | Notes |
|---|---|---|
| `Early_Departure_Contract.md` | v1.0 DRAFT — superseded | Superseded by `PartialGameContract.md` in 13-C |
| `Late_Arrival_Contract.md` | v1.0 DRAFT — superseded | Superseded by `PartialGameContract.md` in 13-C |
| `Dots_Contract_v2_0.md`, `Dots_Contract_v2_1.md` | Stale duplicates | `Dots_Contract.md` is current at v2.6. Remove from project knowledge base when convenient. |
