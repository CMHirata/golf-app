# Round Lifecycle Contract

_Version 2.3 — May 2026_
_Changes in v2.3 (15-E.1): §5.2 — auto-export payload now carries a top-level `settings` field with two app-preference keys (`moneyListRange`, `historyRange`). Cross-references `App_Data_Model_Contract.md` §1.2 for full payload shape and import-path requirements. No lifecycle changes — only documents existing v3.8 export field._
_Supersedes: v2.2._
_Changes in v2.2 (13-C.7, post-device-test): §3.4 — Back→Setup→Forward navigation preservation rule added: when a user navigates Back to Setup mid-round and then forward to Scorecard, `NewRoundPage.handleStart` MUST preserve `earlyDepartureOpts`, `earlyEndOpts`, and `lastCompletedHole` (read from `initSrc` using camelCase keys) into the reconstructed `activeRound`. Without this, all locked-cell displays and resolution decisions are silently lost. §7 — three departure fields added to required-fields table (`earlyDepartureOpts`, `earlyEndOpts`, `lastCompletedHole`). §8 — round-trip preservation rule strengthened: explicit table mapping camelCase ↔ snake_case for the three fields. §12 — invariants 23 and 24 added covering Back→Setup→Forward preservation and dual-implementation of the engine departure data guardrail. Surfaced and fixed in 13-C.7 device test._
_Changes in v2.1 (13-C.7 / v2.0): §4.5 — `earlyEndOpts` shape and write semantics defer to `PartialGameContract.md` v2.0 / §4.1 / §14 invariant 20. Two key updates: (1) the SHAPE of `earlyEndOpts` is `{ [gameKey]: SegmentedResolution }`, NOT the `'payout' | 'no_payout'` shape described in this contract's §4.5 step 3 — that shape predates the resolver work and was superseded by `PartialGameContract` §4.1. PartialGameContract is the source-of-truth. (2) The WRITE rule for `earlyEndOpts` and `lastCompletedHole` is governed by PartialGameContract §5.4.4 / §14 invariant 20: both fields are written ONLY by the LAST event in the sequenced resolver chain, AND ONLY when every player is classified Early-departure (no player reached `roundEndHole`). If at least one player is Complete, neither field is written even if other players departed. This contract's prior framing (Scenario A vs Scenario B as a UI decision) is collapsed in v2.0 — the per-event sequenced chain handles all cases. §4.5 retains the high-level "round may end before all 18 holes" lifecycle framing but defers shape and write rules to PartialGameContract. §4.6 Sixes early-end rule unchanged. §4.7 manual-press handling unchanged. Engine firewall unchanged. No code changes._
_Version 2.0 — April 2026_
_Supersedes: v1.9_
_Changes in v2.0 (13-C.3 Phase 2A): §7 — `gameRanges` field added to required
fields table. §12 (invariants) — invariant 22 added covering `gameRanges` round-trip
preservation across `fromActiveRound`/`toActiveRound`/`toSetupState`. No behavior
changes — documenting persistence guarantees that already exist in `roundLib`._
_Changes in v1.9 (13-C.2): §4.1 — Results → transition updated: Stroke Play incomplete
check removed from navigation gate (moved to save-time gate in ResultsPage); Results →
is always tappable per PartialGameContract §1A.6. §4.2 — Stroke Play incomplete check
updated: loop bounds now respect `roundStartHole`/`roundNumHoles`; check lives in
ResultsPage `getMissingScoresError`, not `handleGoResults`. §7 — `roundStartHole` and
`roundNumHoles` added to required fields table. §8 — field completeness rule updated:
`toSetupState` must restore `manual_presses` and round length fields; omission is a
contract violation. §12 — invariant 13 added: round length fields always present at
scoring entry._
_Changes in v1.2: Added single-instance concurrency disclaimer (§12.1);
tightened activeRound write prohibition during scoring phase (§3.3);
added score input normalization invariant (§12.3); added early-end +
retroactivity interaction clarification (§3.6); added `earlyEndOpts`
key-must-match-activeGames invariant (§4.5); clarified partial
`earlyEndOpts` per-game default (§4.5); added Path A activeRound
divergence note (§6.2); explicit full-reset scope on lineup change
(§2.6); added `manualPresses` structure validation invariant (§12.10)._
_Status: AUTHORITATIVE_
_All implementation must conform to this contract._
_If code conflicts with this contract, the contract wins._

---

**Primary files:**
`pages/App.jsx`, `pages/NewRoundPage.jsx`, `pages/ScorecardPage.jsx`,
`pages/ResultsPage.jsx`, `pages/HistoryPage.jsx`, `services/roundLib.js`,
`services/storage.js`

**Cross-references:**
- `App_Data_Model_Contract.md` §5 — `activeRound` blob schema
- `App_Data_Model_Contract.md` §8 — mutation rules
- `App_Data_Model_Contract.md` §9 — `roundLib` responsibilities
- `App_Data_Model_Contract.md` §10 — `buildPayoutArgs` synchronization
- `Handicap_Contract.md` §2 — course handicap calculation
- `Payout_Contract.md` §2 — `computePayouts` entry point
- Individual game contracts — early-end payout policy per game

---

## §1. Overview

A round moves through five phases in a defined sequence. Each phase has
a clear entry condition, exit condition, and set of permitted operations.
No phase may be skipped.

```
Setup → Scoring → Results → Saved (terminal)
          ↑            |
          └────────────┘  (back to scorecard from results)

History → Edit Setup  (metadata only, no scoring)
History → Re-score    (re-enters Scoring phase)
```

The `activeRound` blob in `SK.activeRound` is the single source of truth
for a round in progress. It is absent when no round is active. Its
presence or absence is the authoritative test for whether a round is
in progress (`inProgress = !!ls.get(SK.activeRound)`).

**Single-instance assumption:** This application assumes a single active
client instance at a time. Concurrent edits across multiple browser
tabs or devices are not supported and may result in last-write-wins
data loss. No coordination mechanism exists. Users should not open
the app in multiple tabs simultaneously during an active round.

---

## §2. Phase 1 — Setup

### §2.1 Entry condition

The user navigates to the New Round tab. No pre-existing state is
required. If a round is in progress, a "Round in progress — Resume"
banner is shown; setup can still be edited without disturbing the
active round.

### §2.2 Setup draft persistence

Setup form state is persisted to a local storage key (`SETUP_KEY`,
currently `golf_round_setup_v5`) on every change. This key is
**not** part of the `SK` constants — it is a private draft key owned
by `NewRoundPage`. Its sole purpose is to survive a page refresh.

**Rules:**
- Draft persistence is suppressed when `isReload` is true (editing a
  historical round). A historical round's data must never overwrite
  the new-round draft.
- The draft key is separate from `SK.activeRound`. Clearing the active
  round does not clear the draft.
- The draft schema may differ from the `activeRound` blob schema — it
  reflects form state, not round state.
- **Authority rule:** When an active round exists in `SK.activeRound`,
  `activeRound` governs all scoring continuity decisions. The draft
  is form state only and is ignored for continuity purposes. The
  draft and the active round may diverge (e.g. after a page refresh
  mid-round) — this is expected and not a bug.

### §2.3 Player setup

Players are selected from the player library. Each player row in setup
displays:

- Player name (truncated with ellipsis if too long; read-only, pulled
  from library)
- Tee selector (dropdown of tees available on the selected course;
  each player may select a different tee)
- HI field (Handicap Index — decimal; if populated, CH autofills and
  locks)
- CH field (Course Handicap — whole number; if manually populated with
  HI left blank, HI locks out; user may not populate both fields)

**HI / CH mutual exclusion rule:**
- If HI is entered → CH is computed from HI using the player's selected
  tee's rating and slope, rounded to a whole number, and the CH field
  is locked (read-only).
- If CH is entered directly (HI left blank) → HI field is locked out
  (disabled). The entered CH is used as-is; no calculation is performed.
- A player may not have both HI and CH manually populated simultaneously.
- The app updates the player library record with any HI change made in
  setup (same behavior as the legacy HI confirmation popup).

**Per-player tee rule:**
- Each player's course handicap is calculated using their own selected
  tee's rating and slope, not a shared tee.
- `courseHcps[i]` is derived from `activePlayers[i]`'s individual tee
  selection.
- `minCourseHcp` is the minimum across all players' computed course
  handicaps regardless of which tee each player chose.

**Player count constraints:**
- Minimum: 2 players
- Maximum: 5 players (soft cap; app is tested and supported for 2–5)
- Player order is significant. Index 0 = player 1. All subset pickers,
  match definitions, and team assignments use these indices. Reordering
  players after game configuration has begun may produce inconsistent
  state — the UI should warn if players are reordered after any
  game-specific configuration is set.

### §2.4 HI confirmation popup (REMOVED)

The `HIConfirmPopup` that previously appeared between setup and the
scorecard is eliminated. Handicap confirmation is handled inline in the
player setup section (§2.3). The `handleStart` → `setShowHIPrompt` →
`handleHIConfirm` flow is replaced by a direct `handleStart` →
`assembleRoundState` → `onStart` flow.

### §2.5 Validation before proceeding to scoring

The following must be checked when "Start Scoring" is tapped. If any
check fails, an alert is shown and the round does not start:

| Check | Rule |
|---|---|
| Player count | At least 2 players selected |
| Nines subset | If Nines active and 4+ players, exactly 3 must be selected in the Nines picker |
| Match configuration | If Match / Nassau active, at least one match must be defined with both player slots filled |
| Sixes + 5 players | If Sixes active and 5 players selected, round must not start until `sixesPlayers` picker is implemented (§14) |

The following are **not** blocking (permissive behavior, intentional):
- No course selected — layout defaults to `DEF_PARS` / `DEF_HCP` silently
- Sixes team slots partially filled — handled gracefully by engine
- Bet amounts left at zero — valid (tracking without money)

### §2.6 Score continuity on re-setup

When the user taps "Start Scoring" while an active round already exists
in `SK.activeRound`, score continuity depends on whether the player
lineup has changed.

**Player identity equality rule:** Two lineups are considered identical
if and only if they contain the same player IDs in the same order.
Player ID is the stable identifier from the player library (`p.id`).
Name changes, HI/CH updates, and tee changes do not affect identity —
a player who changes tee mid-round is still the same player and their
scores are preserved.

| Condition | Scores | Specials entries | Manual presses |
|---|---|---|---|
| Same player IDs, same order | Preserved | Preserved | Preserved ✅ |
| Any ID change or reorder | **Reset to empty** | **Reset to empty** | **Reset to empty** |

When a lineup change triggers a reset, all three mutable fields —
`scores`, `specEntries`, and `manualPresses` — are cleared together.
No partial reset is permitted.

**Implementation note (v1.6):** `manualPresses` preservation on lineup-unchanged
re-entry was previously aspirational — it was specified in this table but not
implemented in `NewRoundPage.handleStart`. Fixed in session 11-K:
`handleStart` now reads `existingAr2.manualPresses` and includes it in
`roundState` when `playerLineupUnchanged` is true, parallel to `scores` and
`dotEntries`.

**Warning requirement:** If the active round has any scores entered
(at least one non-empty cell) and the player lineup has changed, the
app must display a confirmation dialog:

> "Starting a new round will erase all current scores. Continue?"

The user must confirm before the active round is overwritten. If the
user cancels, setup remains open and the active round is untouched.

If the player lineup is unchanged (resume / bet-change scenario), no
warning is shown — scores are silently preserved.

### §2.7 `sixesPlayers` field

`sixesPlayers` is a planned but not yet implemented subset picker for
Sixes (relevant when a round has 5 players and only 4 play Sixes at a
time). The field must be included in `roundState` when assembling the
active round blob, defaulting to `[]`. Currently the picker UI does not
exist and `[]` is always the correct value for 4-player rounds (all
players participate). See §14 and §15 for the 5-player Sixes status.

---

## §3. Phase 2 — Scoring

### §3.1 Entry condition

An `activeRound` blob exists in `SK.activeRound`. `ScorecardPage` is
the active tab.

### §3.2 State ownership during scoring

`ScorecardPage.jsx` is the state owner for the scoring phase. It reads
the `activeRound` blob once on mount. Fields fall into two categories:

**Configuration fields** (read once from `ar`, never held in React state):
`activePlayers`, `pars`, `hcps`, `courseHcps`, `minCourseHcp`,
`activeGames`, `gameOpts`, `matches`, `sixesTeams`,
`strokePlayPlayers`, `skinsPlayers`, `stablefordPlayers`,
`ninesPlayers`, `specialsPlayers`, `specials`, `layout`

**Mutable fields** (held in React state, written back to localStorage):
`scores`, `specEntries`, `manualPresses`

Configuration fields do not change during the scoring phase. If the
user wants to change bets, tees, or player configuration, they must
return to Setup (Phase 1) via the "← Setup" button.

**Center button re-entry from setup tab (v1.6):** When the user navigates to
the New Round tab via "← Setup" and then taps the center logo button,
`handleStart` runs — a full Phase 1→2 transition that re-assembles
`activeRound` from the current setup form state. This is the only permitted
path for updating configuration fields while a round is in progress. The
scorecard never mutates configuration fields directly.

### §3.3 Persistence during scoring

A `useEffect` in `ScorecardPage` fires whenever `scores`, `specEntries`,
or `manualPresses` changes. It writes:

```js
saveActiveRound({ ...ar, scores, specEntries, manualPresses })
```

**Write prohibition:** During the scoring phase, only `ScorecardPage`
may write to `SK.activeRound` via this `useEffect`. No other component
or code path may write to `SK.activeRound` while the scorecard tab is
active. The two permitted external writes — History load and Setup
restart — are only valid when the user has navigated away from the
scoring phase via their defined flows (§6.1 and §2.6 respectively).
Any other write to `SK.activeRound` during the scoring phase is a
contract violation.

**Stale closure rule:** The `ar` snapshot used in the `useEffect` spread
must always reflect the latest persisted `activeRound`, not a stale
closure from mount time. Writes must merge only the three mutable
fields (`scores`, `specEntries`, `manualPresses`) into the current
persisted blob — not overwrite configuration fields from a stale
snapshot. If `ar` is captured at mount and configuration has since
changed (e.g. due to a concurrent edit), the mutable-field merge
must not silently restore stale configuration values.

### §3.4 Navigation during scoring

**"← Setup" button:** Returns to the New Round tab. The active round
is **not** cleared. Scores are safe. The user may return to the
scorecard at any time by tapping the center logo button in the nav bar.

**"Results →" button:** Triggers the Results transition (§4.1). Always
navigates to the Results page — including mid-round, where it shows
current standings based on scores entered so far. The Stroke Play
incomplete check is a save-time gate in ResultsPage (§4.2), not a
navigation gate.

**Bottom nav:** Always visible on all pages including Scorecard and
Results. The `FLOW_TABS` exclusion that previously hid the nav bar
during scoring and results has been removed (Session 6). The user may
freely navigate to any tab (Home, Players, Courses, History) from the
Scorecard without losing their round — the active round persists in
`SK.activeRound` and the center logo button returns them to the
Scorecard from anywhere.

**Center logo button behavior (v1.6):** The center button is context-aware
when a round is in progress:

| User's current tab | Center button action |
|---|---|
| Any tab except New Round | Navigate directly to Scorecard tab |
| New Round tab | Trigger `handleStart` — full round re-assembly, then navigate to Scorecard |

When on the New Round tab, the center button is functionally equivalent to
tapping "Start Scoring." This ensures any game config changes (scoring modes,
player subsets, bets, match settings) are committed to `activeRound` via the
standard `handleStart` path before the scorecard mounts. All score-continuity
rules (§2.6) apply: lineup-unchanged re-entry preserves scores, dot entries,
and manual presses; lineup change triggers a confirmation dialog and reset.

**Pinned action bar:** The `← Setup | Discard | Results →` row is a
`position: fixed` bar that sits flush on top of the nav bar, visible
at all times without scrolling. It does not scroll with page content.
The content area has a matching `paddingBottom` to ensure the last
game table row is not hidden behind the pinned bar.

**Back→Setup→Forward preservation (v2.2 / 13-C.7):** A user navigating
Back to Setup mid-round, making any change (or none) on Setup, then
forward to Scorecard via "Start Scoring" or the center logo button
triggers `NewRoundPage.handleStart` reconstruction of `activeRound`.
This handler MUST preserve **all three departure fields** through the
reconstruction:
- `earlyDepartureOpts` (per-player departure metadata)
- `earlyEndOpts` (group-stop game resolutions)
- `lastCompletedHole` (group-stop hole index)

Reading from `initSrc` (= `loadedRound` for History reload paths, =
in-flight setup state for Back→Setup mid-round paths), the handler
reads these fields using **camelCase keys** matching `toSetupState`'s
emission. The handler then includes them in the resulting `roundState`
when `playerLineupUnchanged` is true (mirroring the existing pattern
for `scores` / `dotEntries` / `manualPresses`). Lineup changes still
trigger a full reset of departure state along with scores per §2.6.

Without this preservation, the user navigating Back→Setup→Forward
mid-round silently loses all locked-cell displays (`–`) and resolution
decisions made via the resolver. (Invariant 23.)

### §3.5 `restoreAutoWhen` requirement

Before any code path that uses `specials.autoWhen` (auto-marking
birdies, eagles, aces), `restoreAutoWhen(specials)` must be called.
JavaScript functions are stripped by JSON serialization, so `autoWhen`
is always absent after a localStorage round-trip.

**Scope of this rule:** This requirement applies to any caller of
auto-mark logic, not only `ScoreGrid.jsx`. Any future component,
utility, or service that invokes specials auto-marking must call
`restoreAutoWhen` before doing so. Failure to call it produces silent
non-marking — no error will be thrown.

### §3.6 Subset changes during scoring

A player's participation in a game subset (`skinsPlayers`,
`stablefordPlayers`, `specialsPlayers`, etc.) may be changed by
returning to Setup and re-starting the round with the same player
lineup (scores preserved per §2.6).

**Retroactivity rule:** Subset changes apply retroactively to all
holes already played within the active hole range. The engine always
recomputes results from raw scores for all holes up to and including
`lastCompletedHole` (or hole 17 if no early end has been declared).
There is no stored per-hole eligibility state to reset. Adding a
player to a subset means the engine will include that player's scores
on every hole from hole 1 up to `lastCompletedHole`. Removing a player
from a subset means the engine will exclude that player from every hole
in that range, including holes already played. Holes beyond
`lastCompletedHole` remain excluded from all calculations regardless
of subset membership.

**Examples:**
- A player inadvertently excluded from Specials is added back at
  hole 10 in a full 18-hole round. The engine will award them any
  qualifying specials (birdies, eagles, etc.) on holes 1–9 that
  their scores qualify for — no manual backdating is required.
- A player removed from Skins at hole 7 will not appear in any
  hole's Skins calculation, including holes 1–6 already played.
- In a round ended early at hole 12, adding a player to Stableford
  applies retroactivity only to holes 1–12. Holes 13–18 are not
  computed regardless.

**Specials entries are not reset** when a subset changes. Existing
logged specials entries for players already in the subset remain
intact. The newly added player's specials entries are empty (no
entries were logged while they were excluded) — the engine will
auto-mark qualifying entries when scores are re-evaluated, but
manually logged specials (closest to pin, longest drive, etc.)
that occurred on past holes will not be retroactively created.
The user may log these manually via the specials popup if desired.

---

## §4. Phase 3 — Results

### §4.1 Transition from Scoring to Results

Triggered by `App.handleGoResults()`. Steps in order:

1. Read `activeRound` from `SK.activeRound`
2. Call `computePayouts(buildPayoutArgs(ar))`
3. Write `{ ...ar, breakdown: result.breakdown, bank: result.bank }`
   back to `SK.activeRound`
4. Navigate to the Results tab

**13-C.2 change:** The Stroke Play incomplete check was removed from this
transition. Results → is always tappable per PartialGameContract §1A.6,
including mid-round (shows current standings on scores entered so far).
The incomplete check is now a **save-time gate** in `ResultsPage` (§4.2).

If step 2 fails, navigation does not occur. The user stays on the scorecard
and sees an alert.

**Recomputation requirement:** `computePayouts` must run on every
transition to Results, regardless of whether `breakdown` or `bank`
are already present in `activeRound`. Cached values are never
displayed without first being refreshed. This ensures that score
changes made after a previous Results visit are always reflected.

### §4.2 Stroke Play incomplete check (save-time gate)

**13-C.2 change:** This check now lives in `ResultsPage.getMissingScoresError`
and gates the **Save** action, not Results → navigation.

If Stroke Play is an active game, all participating players must have a score
entered for all holes within `[roundStartHole, roundEndHole]` before the round
can be saved. If any in-round hole is missing, the Save button is disabled and
an error banner appears after the user taps Save.

**Loop bounds:** The check iterates `h` from `ar.roundStartHole ?? 0` to
`(ar.roundStartHole ?? 0) + (ar.roundNumHoles ?? 18) - 1` inclusive. Holes
outside the round are never checked — missing out-of-round scores do not block
saving. For full rounds (defaults), this is identical to the prior [0..17] scan.

**`X` scores:** `X` (player picked up) is treated as unscored for Stroke Play
purposes. The check uses explicit string equality (`=== 'X'`) — `parseInt('X')`
is banned per gotcha H-13.

**Early-end exception:** If the user has declared an early end (§4.5),
only holes within `roundStartHole` through `lastCompletedHole` need scores.

### §4.3 `breakdown` and `bank` are display caches

`breakdown` and `bank` written to `SK.activeRound` are convenience
caches for the Results page to display. They are not authoritative
state. `handleSaveRound` always recomputes payouts fresh before saving
(§5.1) — the cached values are never trusted for the final save.

### §4.4 Navigation during Results

**"← Back" button:** Returns to the Scorecard tab. The active round
is not modified.

**"Save Round" button:** Triggers the Save transition (§5.1).

### §4.5 Early round end

> **v2.1 amendment (13-C.7 / v2.0):** The shape and write semantics of
> `earlyEndOpts` and `lastCompletedHole` defer to
> `PartialGameContract.md` v2.0. Specifically:
> - `earlyEndOpts` is `{ [gameKey]: SegmentedResolution }`, NOT
>   `{ [gameKey]: 'payout' | 'no_payout' }` as described in the
>   historical content below. The `'payout' | 'no_payout'` shape
>   predates the resolver work and was superseded by
>   `PartialGameContract` §4.1.
> - `lastCompletedHole` and `earlyEndOpts` are written by the LAST
>   event in the sequenced resolver chain ONLY when every player is
>   Early-departure classified (no player reached `roundEndHole`). See
>   `PartialGameContract` §5.4.4 / §14 invariant 20.
> - The per-game decision UI is the resolver sheet
>   (`DepartureResolverSheet` per `Resolver_UI_Spec` §2.1 v1.1), not
>   a separate "Pay out / No payout" picker. The four resolution
>   options (`abandon`, `end_at_k`, `continue`, `exclude_player`) and
>   per-game-family availability are specified in `PartialGameContract`
>   §6.1 v2.0.
> - The Sixes early-end rule (§4.6 below) is partly superseded:
>   Sixes is a Match-family game in v2.0 and supports only `abandon`
>   or `end_at_k`; the §4.6 segment-by-segment payout table describes
>   one specific outcome of `end_at_k` resolution but is not the only
>   path. The user can also pick `abandon` for Sixes at any departure.
>
> The lifecycle framing in this section ("round may end before all 18
> holes") remains correct. The shape and write rules in the historical
> content below are obsolete; consult `PartialGameContract.md` for
> authoritative semantics.

A round may end before all 18 holes are complete. The user declares
an early end either explicitly (proactive long-press X gesture per
`PartialGameContract` §8) or implicitly (reactive — at Results → tap
with one or more players whose scoring did not reach `roundEndHole`,
per `PartialGameContract` §9). In either case, the resolver sheet
fires and writes per-event `earlyDepartureOpts[pi]` records.

If every player is Early-departure classified, the LAST event in the
sequenced chain ALSO writes `lastCompletedHole` and `earlyEndOpts` per
`PartialGameContract` §5.4.4. Otherwise (at least one player completed
the round), `lastCompletedHole` and `earlyEndOpts` are not written;
only `earlyDepartureOpts` for the departed players is recorded.

#### Historical content (v1.x — superseded by v2.1 amendment above)

> The content below describes the pre-v2.0 model where the user picked
> a binary "Pay out / No payout" decision per game when ending a round
> early. v2.0 replaces this with the four-token resolution model
> (`abandon`, `end_at_k`, `continue`, `exclude_player`) and the
> sequenced resolver chain. Retained here for historical traceability;
> implementations must follow the v2.0 spec.

**On declaring early end (PRE-v2.1 framing):**

1. The app records the last completed hole number in `activeRound`
   as `lastCompletedHole: number` (0-based hole index of the final
   hole played; `17` = full 18 holes).
2. The user is presented with a per-game decision for each active game:
   - **Pay out** — calculate payouts based on holes completed
   - **No payout** — game ends with no money changing hands

3. These decisions are stored in `activeRound.earlyEndOpts`:
   ```js
   earlyEndOpts: {
     'Match / Nassau': 'payout' | 'no_payout',
     'Skins':          'payout' | 'no_payout',
     'Sixes':          'payout' | 'no_payout',
     // ... one entry per active game
   }
   ```
   *(SUPERSEDED — actual shape is `{ [gameKey]: SegmentedResolution }`
   per `PartialGameContract` v2.0 §4.1.)*

4. The Sixes early-end rule is a special case (§4.6).

**`earlyEndOpts` key rule (still valid in v2.0):** Keys in `earlyEndOpts`
must exactly match the canonical game identifiers used in `activeGames[]`
and by `computePayouts` (e.g. `'Match / Nassau'`, `'Skins'`, `'Sixes'`)
or the `matchDef.id` for individual Match instances per
`PartialGameContract` §4.3. UI display labels must never be used as keys.
Any mismatch causes the affected game to silently fall back to the
default behavior (i.e., as if no entry existed for that game).

**`earlyEndOpts` default (UPDATED in v2.0):** Missing keys in
`earlyEndOpts` default to "as if `earlyEndOpts` were absent for that
game" — under v2.0 with `lastCompletedHole < roundEndHole` this means
the engine treats the game as ending at `lastCompletedHole` with all
segments at default `pay`. (PRE-v2.1 default was `'payout'` per the
historical model. Result is functionally identical for the common case
of "pay everything through the last completed hole.")

**Engine behavior when `lastCompletedHole < 17` (still valid in v2.0):**
The `payouts.js` pre-processing layer trims scores to
`[roundStartHole, lastCompletedHole]` before each engine call (per
`PartialGameContract` §11.3). Holes beyond `lastCompletedHole` are
treated as if they were never played — not as zeros.

### §4.6 Sixes early-end rule

Sixes is played in three 6-hole segments. When a round ends early,
Sixes pays out completed segments only. A segment is complete if its
final hole (holes 6, 12, and 18 respectively, 1-based) has been played.

| Last completed hole | Segments paid |
|---|---|
| 1–5 (holes 1–5) | None |
| 6–11 (holes 6–11) | Segment 1 only |
| 12–17 (holes 12–17) | Segments 1 and 2 only |
| 18 (full round) | All three segments |

This behavior applies even if `earlyEndOpts.Sixes === 'payout'`. The
user cannot force payout of an incomplete Sixes segment — partial
segment results are discarded. If the user selects `'no_payout'` for
Sixes, all segments are suppressed regardless of completion.

### §4.7 Early end and manual presses

Manual presses with trigger holes greater than `lastCompletedHole`
are ignored during payout computation. The engine must treat any
press entry in `manualPresses` whose hole index exceeds
`lastCompletedHole` as if it does not exist.

**Example:** A press is triggered on hole 16. The round ends at hole
14 (`lastCompletedHole = 13`, 0-based). That press is ignored — the
segment runs to its natural end at hole 14 without a press in effect.

This rule applies to all games that support manual presses
(Match / Nassau, Sixes). It does not affect auto-press triggers,
which are evaluated hole-by-hole and naturally stop at
`lastCompletedHole`.

---

## §5. Phase 4 — Save

### §5.1 Save flow

Triggered by `App.handleSaveRound()`. Steps in order:

1. Read `activeRound` from `SK.activeRound`
2. Recompute payouts fresh: `computePayouts(buildPayoutArgs(ar))`
3. Write updated `breakdown` and `bank` back to `activeRound`
4. Call `roundLib.saveFromActive(arToSave)`
   - If `ar.roundId` is set (editing a historical round), the existing
     history record is updated in-place
   - Otherwise a new history record is created
5. Clear `SK.activeRound` (`ls.del(SK.activeRound)`)
6. Trigger auto-export (§5.2)
7. Navigate to the History tab

After step 5, `inProgress` becomes false and the round is no longer
recoverable from the active round slot. It exists only in history.

### §5.2 Auto-export on save

Every time a round is saved (step 6 above), the app automatically
triggers a JSON export download. The export contains the full history
array (all saved rounds), not just the round being saved.

**Payload shape (v3.8):** Top-level `settings` field carries app
preferences. See `App_Data_Model_Contract.md` §1.2 for the full payload
shape and import-path requirements.

**File naming rule (applies to all exports — auto and manual):**
```
The Card YYYY-MM-DD HH-MM.json
```
Where the date and time reflect the moment of export (local time).
Example: `The Card 2026-04-11 14-32.json`

This naming convention applies to:
- Auto-export triggered by round save
- Manual export triggered from the History page
- Any future export surfaces

### §5.3 History record schema

`roundLib.fromActiveRound(ar)` converts the live blob to the history
record format. `roundLib.js` is the sole owner of this conversion —
no other file performs it. See `App_Data_Model_Contract.md` §9 for
the full field mapping.

---

## §6. Phase 5 — History and Edit

### §6.1 History record loading

From `HistoryPage`, the user can load any saved round. `App.handleLoadRound(r)` performs:

1. **Active round conflict check:** If `SK.activeRound` exists and
   contains any scored holes, the app must prompt:

   > "Loading this round will replace your round in progress. Continue?"

   The user must confirm before proceeding. If the user cancels,
   the History page remains active and the current round is untouched.
   If no active round exists, or the active round has no scores entered,
   the load proceeds without prompting.

2. `roundLib.toActiveRound(r)` → writes full `activeRound` blob to
   `SK.activeRound`
3. `roundLib.toSetupState(r)` → sets `loadedRoundSetup` in App state
4. Navigate to the New Round tab
5. `NewRoundPage` receives `loadedRound` prop → enters `isReload` mode

**Field completeness requirement:** `toActiveRound` and `toSetupState`
must round-trip every field in the active round blob faithfully. A
field present in `fromActiveRound` output must be restorable by
`toActiveRound`. Any field omitted from `toActiveRound` is silently
lost when editing a historical round. This is a contract violation.

### §6.2 Edit paths

Two edit paths are available from the reload view in `NewRoundPage`:

**Path A — Save Changes (metadata edit only):**
- Updates: date, tee selections, active games, game options, bet
  amounts, match definitions, all subset pickers, specials config
- Does not update: scores, specials entries, manual presses
- Calls: `roundLib.update(roundId, changes)`
- Returns to: History tab
- Use case: fixing a bet amount or game setting without re-scoring

**Important:** Path A updates the history record only. It does not
update `SK.activeRound`. If an active round blob exists for the same
record (loaded via `handleLoadRound`), it will diverge from the
history record after a Path A save until the round is reloaded.
This divergence is expected behavior — the active round blob is a
working copy and `SK.activeRound` is not authoritative until saved.

**Path B — Go to Scorecard (re-score):**
- Loads the full `activeRound` blob (already written by `handleLoadRound`)
- Navigates to Scorecard tab
- The round behaves identically to a new round in the scoring phase
- All scores from the history record are loaded and editable
- Saving follows the normal save flow (§5.1), which updates the existing
  record in-place because `ar.roundId` is set

### §6.3 Re-score abandonment

Abandoning a re-score session (navigating away without saving) leaves
the history record unchanged — the original saved data is not modified
until `handleSaveRound` completes. However, `SK.activeRound` retains
the partially re-scored data. The user can resume the re-score session
via the resume banner, or start a new round (which will trigger the
score-overwrite warning per §2.6 if scores are present).

The history record is the authoritative record until overwritten by
a completed save. `SK.activeRound` during a re-score session is a
working copy only.

### §6.4 `isReload` flag behavior

When `isReload` is true in `NewRoundPage`:
- Setup draft persistence to `SETUP_KEY` is suppressed
- The page header reads "Review & Edit Round" instead of "New Round"
- The start button reads "Re-score Round (resets scores) →"
- The editing historical round banner is shown with Path A and Path B
  buttons
- The normal "Round in progress — Resume" banner is not shown

---

### §6.5 Read-Only Round Summary View

A read-only visual summary of any historical round is accessible by
tapping a round row in `HistoryPage`. This path is **distinct from
editing** — it involves no `SK.activeRound` write and no navigation
to `NewRoundPage`.

**Implementation:** `pages/RoundSummaryModal.jsx`

**Data flow:**

1. `HistoryPage` passes the raw history record `r` as a prop to
   `RoundSummaryModal`.
2. The modal calls `roundLib.toActiveRound(r)` to reconstruct an
   activeRound-shaped blob. This is a read-only use — the blob is
   never written to `SK.activeRound`.
3. `buildPayoutArgs(ar)` (from `services/roundUtils.js`) assembles
   the engine argument object.
4. `computePayouts(buildPayoutArgs(ar))` produces fresh payout data.
   The stored `bank` / `breakdown` fields are used only as a fallback
   if the engine throws.
5. Per-match payouts are computed by calling `runMatchNassau` directly
   for each match and accumulating per-player net amounts. This is
   necessary because the engine's `breakdown` array aggregates all
   Match / Nassau matches into a single entry — it cannot be split
   after the fact. Do not attempt to split the aggregated breakdown
   entry; recompute per-match instead.

**Data integrity rule:** The same invariant from §6.1 applies here.
`toActiveRound` must only read from the stored snapshot — never from
the live course or player libraries. The history record is a time
capsule; its data must be used as-is regardless of any library changes
since the round was saved.

**Orientation behavior:**
- Portrait: scorecard shows Front 9 over Back 9; game tables show
  front-over-back halves (unchanged from the live scorecard layout).
- Landscape: the modal expands to full screen width; the scorecard
  shows all 18 holes in one row with F9/B9/Tot subtotals; game tables
  that use `GameTable` (Nines, Skins, Stableford, StrokePlay) show
  all 18 holes via the `landscape=true` prop; `MatchNassauTable` and
  `SixesTable` remain front-over-back (their internal press-chip
  rendering makes this non-trivial — deferred).

**Stroke Index labeling:** The scorecard shows gender-aware Stroke
Index rows derived from the stored course snapshot:
- All male or unknown → one "Stroke Index" row using men's handicaps
- All female + women's SI present in snapshot → "Stroke Index" using
  women's handicaps
- Mixed gender + women's SI present → "Stroke Index (M)" and
  "Stroke Index (W)" rows

**Read-only guarantee:** The modal renders no input elements. It
passes `setManualPresses={() => {}}` (a no-op) to any table component
that requires the setter prop. No mutation of any application state
occurs at any point during the summary view.

**Share (Session 4):** A "📤 Share Summary" button in the modal footer
renders the round as a PNG image and opens the iOS native share sheet.
The same share entry point is also present on `ResultsPage` (Share
button) and `HistoryPage` (swipe strip Share button). All three call
`triggerRoundShare` from `services/roundUtils.js`.

**Orientation picker:** Tapping any Share button opens a
`ShareOrientationPicker` bottom-sheet modal (see `UI_Component_Contract.md`
§4.9) asking the user to choose Portrait or Landscape before the image
is built. The picker is dismissed by the caller after an orientation is
selected or the backdrop is tapped.

Implementation rules that must not be broken:

1. **`buildShareImage(r, ar, bank, breakdown, matchPayouts, orientation)`**
   — exported from `services/roundUtils.js`. Accepts an `orientation`
   param (`'landscape'` | `'portrait'`, default `'landscape'`). Landscape
   builds a PNG blob at `FO_WIDTH = 740px`. Portrait builds a **PDF blob**
   via `jsPDF` at `FO_WIDTH_PORTRAIT = 390px` — single tall page sized
   to content height, no page breaks. Returns a `Promise<Blob>`.

2. **`triggerRoundShare(r, ar, bank, breakdown, matchPayouts, prebuiltBlob, orientation)`**
   — exported from `services/roundUtils.js`. Accepts a pre-built blob
   and calls `navigator.share({ files: [pngFile] })`. On desktop it
   downloads the PNG instead. The `orientation` param is accepted but
   only used if no `prebuiltBlob` is provided (fallback build path).

3. **iOS gesture chain — critical invariant:** `navigator.share()` on
   iOS Safari must be called with no prior `await` in the same gesture
   call stack. Callers must build the PNG first (`await buildShareImage`)
   then pass the blob to `triggerRoundShare` as `prebuiltBlob`. Do not
   restructure callers to `await` inside `triggerRoundShare` — iOS will
   silently reject the share.

4. **Requires HTTPS.** `navigator.canShare` and `navigator.share` are
   unavailable in insecure contexts (HTTP). The desktop fallback
   (PNG download) fires instead on HTTP.

5. **Recipient pre-fill is not possible** from a web app. The iOS
   Contacts API (`navigator.contacts`) is not implemented in Safari.
   Users type recipients manually; iOS autocompletes from their Contacts.

6. **Portrait layout:** When `orientation === 'portrait'`, output is a PDF
   (not PNG) via `jsPDF`. Page size = `[390px × measuredHeight]` — one
   continuous page. Scorecard splits into two stacked 9-hole tables
   (Front 9 above Back 9), each with a single "Tot" column. Nine names
   appear on a separate line below the course name (no dot separator).
   iOS PDF viewer opens at full width; user scrolls vertically.

7. **Handicap stroke dots in share image:** The share scorecard displays
   handicap stroke dots as 3×3px green circles rendered inline after each
   score, derived via `deriveShareDotMode(ar)` in `services/roundUtils.js`.
   Priority rules (active scoring games only — Dots game excluded):
   - Any game in `net` mode present → display `net` dots
   - All games `netofflow`, at least one full-field → display `netofflow`
     dots using global `minCourseHcp`
   - All games `netofflow` and all are subsets → display `netofflow` dots
     using the minimum subset `minCourseHcp` across all NOL games
   - All games `gross` → no dots displayed

8. **Handicap stroke dots in `ReadOnlyScorecard`:** The read-only
   scorecard in `RoundSummaryModal` also displays handicap stroke dots.
   `dotMode` is derived at the call site from active scoring games only
   (same priority as `deriveShareDotMode`; Dots game excluded). Dots are
   rendered as absolutely-positioned 3×3px green circles at the
   bottom-right of each score cell, matching `PopDots` in `ScoreGrid`.
   `courseHcps` and `minCourseHcp` must be passed as props.

9. **`SixesTable` prop name invariant:** Must always be passed as `opts`
   (not `gameOpts`). All call sites — `ScoreGrid`, `RoundSummaryModal`,
   and `roundUtils.buildShareHtml` — must use `opts={gameOpts?.Sixes}`.
   Passing the wrong prop name silently falls back to defaults, causing
   incorrect hole winners and scoring badge.

---

## §7. The `activeRound` Blob — Required Fields at Scoring Entry

Before the scoring phase begins, the `activeRound` blob written to
`SK.activeRound` must contain all of the following fields. Missing
fields cause silent failures in the engine or display layer.

| Field | Type | Source |
|---|---|---|
| `roundDate` | `string` (ISO) | Setup form |
| `roundStartHole` | `number \| undefined` | Setup form (round length picker). `undefined` on legacy records; callers apply `?? 0`. |
| `roundNumHoles` | `number \| undefined` | Setup form (round length picker). `undefined` on legacy records; callers apply `?? 18`. |
| `gameRanges` | `object \| undefined` | Per-game custom hole ranges (13-C.3). Keys: game name (`'Stroke Play'`, `'Skins'`, etc.) or `matchDef.id` for individual Match instances. Values: `{ startHole, endHole }`. Setup form (per-game range pill in `MatchCard` and `GameConfig`). `undefined` / `{}` on legacy records and full-round rounds. See App_Data_Model_Contract §5.1 and PartialGameContract §4.3. |
| `course` | `object \| null` | Course library |
| `frontNine` | `string` | Course nine selector |
| `backNine` | `string` | Course nine selector |
| `selectedTee` | `string` | Shared tee (legacy; may be empty in multi-tee rounds) |
| `layout` | `object \| null` | `buildLayout(course.nines, frontNine, backNine)` |
| `pars` | `number[18]` | Layout or `DEF_PARS` |
| `hcps` | `number[18]` | Layout or `DEF_HCP` |
| `activePlayers` | `object[]` | Player library + HI/CH from setup; each entry includes `selectedTee` |
| `courseHcps` | `number[]` | `groupCourseHandicaps()` per player using per-player tee |
| `minCourseHcp` | `number` | `minGroupHandicap(courseHcps)` |
| `activeGames` | `string[]` | Game toggles |
| `gameOpts` | `object` | Per-game options |
| `matches` | `object[]` | Match definitions (Nassau/Match) |
| `strokePlayPlayers` | `number[]` | Subset picker (`[]` = all) |
| `skinsPlayers` | `number[]` | Subset picker (`[]` = all) |
| `stablefordPlayers` | `number[]` | Subset picker (`[]` = all) |
| `ninesPlayers` | `number[]` | Subset picker (exactly 3 indices) |
| `sixesTeams` | `array[3]` | Team assignments |
| `sixesPlayers` | `number[]` | Subset picker (`[]` = all; deferred) |
| `specialsPlayers` | `number[]` | Subset picker (`[]` = all) |
| `specials` | `object[]` | Specials definitions |
| `specEntries` | `object` | Specials entry log (may be `{}`) |
| `manualPresses` | `object` | Press trigger holes (may be `{}`) |
| `scores` | `string[18][N]` | Score grid (may be all empty strings) |
| `earlyDepartureOpts` | `object \| undefined` | Per-player departure metadata (13-C.6 / 13-C.7). Keys are player indices; values are `{ departureHole, eventOrder, gameResolutions: { [gameKey]: SegmentedResolution } }`. `undefined` / `{}` on legacy records and rounds with no departures. See `PartialGameContract.md` §4.1. |
| `earlyEndOpts` | `object \| undefined` | Group-stop game resolutions (13-C.7). Keys are game names; values are `SegmentedResolution`. Written only by the LAST event in the sequenced resolver chain when every player is Early-departure. See `PartialGameContract.md` §5.4.4. |
| `lastCompletedHole` | `number \| undefined` | Group-stop hole index (13-C.7). The 0-based hole index of the highest-completed hole among any player. Written together with `earlyEndOpts` per §5.4.4. `undefined` on legacy records and rounds where at least one player reached `roundEndHole`; callers apply `?? roundEndHole`. |

`roundId` is absent for new rounds and set only when editing a
historical round.

---

## §8. `roundLib` Conversion Responsibilities

`roundLib.js` is the sole owner of all schema conversions. No other
file converts between the `activeRound` blob format and the history
record format.

| Function | Input → Output | Notes |
|---|---|---|
| `fromActiveRound(ar)` | live blob → history record | Called by `saveFromActive` |
| `toActiveRound(r)` | history record → live blob | Called by `handleLoadRound` |
| `toSetupState(r)` | history record → NewRoundPage init state | Called by `handleLoadRound` |
| `migrateRecord(r)` | legacy record → current schema | Called by `list()` and `toActiveRound` |
| `saveFromActive(ar)` | calls `fromActiveRound`; writes to `SK.rounds` | Update-or-insert based on `ar.roundId` |

**Field completeness rule:** Every field in `fromActiveRound` output
must have a corresponding read in `toActiveRound`. If a field is added
to `fromActiveRound`, it must be added to `toActiveRound` and
`toSetupState` in the same change. Omitting a field from `toActiveRound`
is a contract violation.

**`toSetupState` completeness rule (13-C.2 amendment):** `toSetupState`
must restore every field that `NewRoundPage` reads from `initSrc` on
reload. The following fields are explicitly required in `toSetupState`:
- All game-configuration fields (matches, player subsets, game opts, dots, etc.)
- `manual_presses` — was missing before 13-C.2; its absence caused press
  configurations to be silently lost when a saved round was reloaded for editing
- `round_start_hole`, `round_num_holes` — round length pickers must show the
  saved round's length, not the defaults, when reloading

**Rule:** Whenever a new field is added to `fromActiveRound` that
`NewRoundPage` reads from `initSrc`, it must also be added to `toSetupState`
in the same change. See `App_Data_Model_Contract.md` §9 and invariant 16.

**Audit requirement:** Whenever the `activeRound` blob schema changes
(fields added, renamed, or removed), the developer must audit all three
of `fromActiveRound`, `toActiveRound`, and `toSetupState` against the
§7 field table before the change is merged. The audit must confirm that
every field in §7 is present in all three functions.

**Departure metadata round-trip (v2.2 / 13-C.7):** The three departure
fields written by the resolver chain (or carried forward from
`activeRound` reconstruction) MUST round-trip faithfully through all
three converters. Per `App_Data_Model_Contract` §9 and PartialGameContract
§4.5:

| Field | activeRound (camelCase) | history record (snake_case) | setupState (camelCase) |
|---|---|---|---|
| `earlyDepartureOpts` | required | `early_departure_opts` | `earlyDepartureOpts` |
| `earlyEndOpts` | required | `early_end_opts` | `earlyEndOpts` |
| `lastCompletedHole` | required | `last_completed_hole` | `lastCompletedHole` |

Omitting any of these from any of the three converters silently drops
the field on save→reload or Back→Setup→Forward navigation. (Invariant 23.)

`migrateRecord` MUST backfill `eventOrder` on legacy
`earlyDepartureOpts[pi]` entries that lack the field (sorted by
`departureHole` ascending, tie-broken by `playerIdx` ascending).
Backfill is idempotent — entries already carrying `eventOrder` are not
disturbed.

---

## §9. App Navigation Model

### §9.1 Tab identifiers

| `tab` value | Page | In `FLOW_TABS`? |
|---|---|---|
| `'home'` | HomePage | No |
| `'players'` | PlayersPage | No |
| `'courses'` | CoursesPage | No |
| `'new-round'` | NewRoundPage | No |
| `'scorecard'` | ScorecardPage | **Yes** |
| `'results'` | ResultsPage | **Yes** |
| `'history'` | HistoryPage | No |

### §9.2 Nav bar visibility

The bottom nav bar is hidden when `FLOW_TABS.includes(tab)` is true.
This prevents the user from accidentally navigating away mid-round.
The in-page "← Setup" and "← Back" buttons are the only exit from
the flow tabs.

### §9.3 In-progress indicator

When `inProgress` is true (an active round exists in `SK.activeRound`):
- An orange dot appears on the "New Round" nav tab
- The HomePage shows a "Resume" banner
- The New Round page shows a "Round in progress — Resume" banner
  (unless `isReload` is true)

---

## §10. `buildPayoutArgs` Synchronization

`buildPayoutArgs(ar)` in `App.jsx` is the sole mapping from the
`activeRound` blob to the `computePayouts()` argument object. It must
be kept in sync with the `activeRound` blob schema. Any field consumed
by `computePayouts()` that is absent from `buildPayoutArgs` causes
silent incorrect payouts.

See `App_Data_Model_Contract.md` §10 for the current field list and
synchronization rule.

---

## §11. Per-Player Tee Support

### §11.1 Storage

Each player in `activePlayers` carries a `selectedTee` field identifying
which tee they played from. The shared `activeRound.selectedTee` field
is retained for backward compatibility but is not used for handicap
calculation when per-player tees are set.

### §11.2 Handicap calculation

`groupCourseHandicaps()` is called once at round assembly time. It
must use each player's individual tee's rating and slope, not a single
shared tee. The resulting `courseHcps[i]` reflects each player's own
tee selection.

### §11.3 Display

The scorecard header and results page show each player's tee name
alongside their name where space permits.

---

## §12. Invariants

These are always true. Any state that violates them is a bug.

1. The application assumes a single active client instance. Concurrent
   edits across multiple browser tabs or devices are not supported and
   may produce last-write-wins data loss.
2. All fields listed in §7 are present in `activeRound` before scoring
   begins. Missing fields are a setup assembly bug.
3. Score values in `scores[h][i]` are `''` (unscored), a valid positive
   integer string (e.g. `'4'`, `'10'`), or `'X'` (player picked up).
   Invalid values (non-numeric strings other than `'X'`, negatives,
   whitespace-only) must be sanitized to empty string before persistence.
   `'X'` is a valid canonical value and must never be sanitized to `''`.
   The engine substitutes `xGrossScore()` wherever a numeric value is
   required for a hole scored `'X'`.
4. `scores[h]` has exactly `activePlayers.length` entries for every
   hole `h` (enforced at assembly time via
   `Array.from({length:18}, () => new Array(n).fill(''))`).
5. The `useEffect` write in `ScorecardPage` merges only the three
   mutable fields into the current persisted blob. It must not
   overwrite configuration fields from a stale mount-time snapshot
   of `ar`.
6. `breakdown` and `bank` on `activeRound` are display caches only —
   never used as engine inputs.
7. `roundLib.saveFromActive` is the sole function that writes to
   `SK.rounds`. No other path creates or updates history records
   (except `roundLib.save` for import and `roundLib.update` for
   metadata-only edits).
8. `fromActiveRound` and `toActiveRound` are inverses: every field
   written by one is read by the other.
9. `isReload` mode suppresses setup draft persistence. A historical
   round's data never overwrites the new-round draft.
10. `manualPresses` entries must reference valid hole indices (0–17)
    only. Any entry with a hole index outside this range must be
    ignored by the engine. Player indices referenced in press
    definitions must be valid indices into `activePlayers`.
11. `computePayouts` is called at two points only: `handleGoResults`
    (preview) and `handleSaveRound` (authoritative). Both calls
    recompute fresh — cached values are never displayed or saved
    without first being refreshed. The save-time call is always
    the authoritative result.
12. Auto-export fires on every save. The exported file name follows the
    `The Card YYYY-MM-DD HH-MM.json` convention.
13. `lastCompletedHole` absent, `null`, `undefined`, or any value
    outside `0–17` is treated as `17` (full 18 holes). The engine
    must apply this normalization before using the value.
14. Abandoning a re-score session leaves the history record unchanged.
    `SK.activeRound` retains the working copy until explicitly cleared
    or overwritten. The history record is authoritative until a
    completed save overwrites it.
15. Player lineup equality for score-continuity purposes is determined
    by player ID only. Name, HI, CH, and tee changes do not affect
    continuity — scores are preserved when the same player IDs appear
    in the same order regardless of other attribute changes.
16. Any caller of specials auto-mark logic must call `restoreAutoWhen`
    before invoking it. This requirement is not limited to
    `ScoreGrid.jsx` — it applies to any current or future code path
    that triggers auto-marking.
17. Loading a historical round must prompt for confirmation if an
    active round with scores exists. Silent overwrite of a scored
    active round is a contract violation.
18. Subset changes (adding or removing a player from a game subset)
    apply retroactively to all holes already played within the active
    hole range (holes 0 through `lastCompletedHole`). Holes beyond
    that range remain excluded from all calculations regardless of
    subset membership. Manually logged specials for newly-added players
    on past holes must be entered by the user; auto-marked specials
    are recalculated automatically.
19. When a lineup change triggers a reset, all three mutable fields —
    `scores`, `specEntries`, and `manualPresses` — are cleared
    together. No partial reset is permitted.
20. During the scoring phase, only `ScorecardPage` may write to
    `SK.activeRound`. The two permitted external writes (History load
    via §6.1 and Setup restart via §2.6) are only valid after the user
    has navigated away from the scoring phase through their defined
    flows. Any other write during the scoring phase is a contract
    violation.
21. `roundStartHole` and `roundNumHoles` are always present in `activeRound`
    when a round is assembled by `handleStart` in `NewRoundPage`. Legacy records
    loaded via `toActiveRound` may have `undefined` for both — callers apply
    `?? 0` / `?? 18` at read time. `roundEndHole` is never stored; it is always
    derived as `roundStartHole + roundNumHoles - 1` at the call site.
    `toSetupState` must restore both fields so reloading a partial round preserves
    the original length in the pickers — omitting either field from `toSetupState`
    is a contract violation (see §8 field completeness rule).
22. **`gameRanges` round-trip preservation (13-C.3 Phase 2A).** When present on
    `activeRound`, `gameRanges` must round-trip cleanly through:
    (a) `roundLib.fromActiveRound` → history `game_ranges` snake-case field;
    (b) `roundLib.toActiveRound` → camelCase `gameRanges` on activeRound;
    (c) `roundLib.toSetupState` → `gameRanges` available on `initSrc` for
    `NewRoundPage` to seed its `useState`. Omitting `gameRanges` from any of
    these three layers is a contract violation. Empty `{}` (no per-game
    overrides) must persist as `{}`, not be elided to `undefined` — though
    consumers must accept either shape (default behavior is identical).
23. **(NEW v2.2)** Departure metadata round-trip preservation. The three
    fields `earlyDepartureOpts`, `earlyEndOpts`, and `lastCompletedHole`
    MUST round-trip faithfully through all four state representations:
    (a) `activeRound` blob (camelCase, in localStorage);
    (b) history record (snake_case, written by `fromActiveRound` and
    read by `toActiveRound`);
    (c) setup state (camelCase, returned from `toSetupState`);
    (d) `NewRoundPage.handleStart` reconstruction path — preserved in
    `roundState` when reconstructing from `initSrc` using camelCase
    keys.
    Omitting any field at any layer silently drops the field on
    save→reload or Back→Setup→Forward navigation, regressing all
    locked-cell displays and resolution decisions. See PartialGameContract
    §4.5 for the full round-trip table; this contract's §8 mirrors it
    for the lifecycle perspective.
24. **(NEW v2.2)** Engine departure data guardrail — dual implementation.
    The guardrail (PartialGameContract §11.9 / invariant 21) is enforced
    at TWO sites: (a) engine pipeline (`payouts.js applyDepartureGuardrail`,
    called from `computePayouts`); (b) display pipeline
    (`scorecardUtils.js applyDepartureGuardrailToScores` /
    `applyDepartureGuardrailToDotEntries`, called from every game table,
    `TotalsCard`, `roundUtils.js computePerMatchPayouts`, and
    `roundUtils.js buildShareHtml` (inline copies in the latter two)).
    Both sites MUST remain in semantic agreement.

---

## §13. Partial Round Support

Partial rounds (including 9-hole front, 9-hole back, and any subset of holes 1–18)
are implemented as of session 13-C.2. See `PartialGameContract.md` §1A for the
authoritative specification.

**Summary of implemented behavior:**
- Start hole and End hole pickers in NewRoundPage (inside Course card)
- `roundStartHole` (0-based) and `roundNumHoles` stored in activeRound blob
- ScoreGrid renders Front 9 / Back 9 layout with gray cells for out-of-round columns
- TotalsCard scoped to in-round holes; ESC omitted on partial rounds
- Results → always tappable (incomplete check is save-time gate only)
- All game table column trimming deferred to 13-C.3

This section previously contained a placeholder noting 9-hole rounds as a future
feature. That placeholder is superseded by `PartialGameContract.md` §1A (v1.5 AUTHORITATIVE).

---

## §14. 5-Player Round Support

The app supports up to 5 players. Most games handle 5 players either
natively or via subset pickers. The following notes apply:

- **Sixes:** Requires exactly 4 players per Sixes game. In a 5-player
  round, Sixes **must be disabled** in the game picker until the
  `sixesPlayers` subset picker UI is built. A 5-player round must
  not be allowed to start with Sixes active and `sixesPlayers` empty
  — the behavior is not undefined, it is prohibited. This validation
  check is listed in §2.5 and §15 G-5.
- **Nines:** Requires exactly 3 players. The subset picker is
  implemented. In a 3-player round, all 3 are auto-selected.
- **Specials:** Supports subset via `specialsPlayers`.
- **Match / Nassau:** Each match definition names its own players
  (individual) or teams. Any combination of players is valid.
- **Skins, Stableford, Stroke Play:** Subset pickers are implemented.

---

## §15. Known Gaps and Open Items

| # | Severity | Description |
|---|---|---|
| G-1 | High | `sixesPlayers` is missing from `roundState` assembly in `handleHIConfirm`. It is set in form state but not written into the blob passed to `onStart`. Fix: add `sixesPlayers` to the `roundState` object literal in `handleHIConfirm`. |
| G-2 | High | HI confirmation popup flow must be replaced with inline per-player HI/CH entry in the setup Players card (§2.3, §2.4). The `handleHIConfirm` function and `HIConfirmPopup` component are deprecated by this contract. |
| G-3 | High | Per-player tee selection is not yet implemented. All players currently share a single tee. `groupCourseHandicaps` must be updated to accept per-player tee data. |
| G-4 | High | Score-overwrite warning (§2.6) is not implemented. Starting a new round silently discards scores when the player lineup changes. |
| G-5 | High | Sixes must be disabled when 5 players are selected and `sixesPlayers` picker is not yet built (§14). Currently no such guard exists. |
| G-6 | Medium | Early-end flow (§4.5, §4.6, §4.7) is not yet implemented. `lastCompletedHole` and `earlyEndOpts` fields do not exist. The Stroke Play all-18-required check is the only current guard. |
| G-7 | Medium | Auto-export on save (§5.2) is not yet implemented. Manual export exists but does not follow the `The Card YYYY-MM-DD HH-MM.json` naming convention. |
| G-8 | Medium | History-load active round conflict check (§6.1) is not implemented. Loading a historical round currently overwrites any active round without warning. |
| G-9 | Medium | `sixesPlayers` subset picker UI is not yet built (5-player Sixes support deferred). |
| G-10 | Low | `roundId` is not set for new rounds at `handleStartRound` time — it is only set when loading a historical round. This is correct current behavior; documented here for clarity. |
| ~~G-11~~ | ✅ CLOSED | `manualPresses` was not included in `roundState` assembled by `handleStart`, so presses were silently lost on every "Start Scoring" tap even when the player lineup was unchanged. Fixed in session 11-K: `handleStart` now reads `existingAr2.manualPresses` and preserves it in `roundState` when `playerLineupUnchanged` is true, parallel to `scores` and `dotEntries`. |

---

## §16. Final Rule

If implementation behavior conflicts with this contract, call out the
conflict. The implementation must be corrected. This document defines
the truth.
