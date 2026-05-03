# Partial Game Contract

_Version 2.2 AUTHORITATIVE — April 2026_
_Status: AUTHORITATIVE — 13-C.2 device-confirmed complete; 13-C.3 Phase 1 + Phase 2A device-confirmed complete; 13-C.5 spec planning complete; 13-C.6 build delivered AND device-test confirmed; 13-C.7 contract amendment (v2.0) delivered, build delivered, device-test confirmed including bug fixes captured in v2.1 amendment; 13-E.4 header copy edge case documented in v2.2._

_Changes in v2.2 (13-E.4): §8.2 step 3 — resolver header copy edge case documented. When `departureHole < roundStartHole` (i.e. the player long-pressed X on the round's first hole, producing `departureHole = roundStartHole - 1`), the resolver sheet header reads "[Name] left before hole [roundStartHole + 1]" rather than the standard "[Name] left after hole [departureHole + 1]". This preserves the "[Name] left [preposition] hole [N]" structural parallel. The "before" form covers two concrete cases: (a) full 18-hole round, long-press X on hole 1 → `departureHole = -1 < roundStartHole = 0`; (b) back-9 round (`roundStartHole = 9`), long-press X on hole 10 → `departureHole = 8 < 9`. A new optional prop `roundStartHole` (default `0`) is threaded from `ScorecardPage` into `DepartureResolverSheet` to enable this logic. See Resolver_UI_Spec.md v1.4 §2.1 for the full prop contract. No storage shape change; no engine change. Surfaced during 13-E.4 device testing and fixed at owner direction._

_Changes in v2.1 (13-C.7, post-device-test): No semantic changes to v2.0; this is a documentation amendment that captures lessons from the 13-C.7 build experience and tightens specs that proved underspecified. Specifically:_

_(1) **Engine departure data guardrail — dual implementation.** Invariant 21 (introduced in v2.0) required `payouts.js` to ignore scores past `departureHole`. Device testing surfaced that game tables (`SkinsTable`, `StrokePlayTable`, `StablefordTable`, `NinesTable`, `SixesTable`, `MatchNassauTable`, `DotsTable`) bypass `payouts.js` and call engine helpers directly, so they need their own copy of the guardrail. v2.1 codifies the dual-implementation pattern: engine-side guardrail in `payouts.js` + display-side mirror in `scorecardUtils.js` (`applyDepartureGuardrailToScores`, `applyDepartureGuardrailToDotEntries`). All seven game tables MUST apply the display-side guardrail before any engine helper call. See §11 amended and §12.2._

_(2) **Round-trip preservation of group-stop metadata.** `earlyDepartureOpts` round-trip through `roundLib`'s three converters was specified in v1.x. `earlyEndOpts` and `lastCompletedHole` were not — they were added by the resolver chain's group-stop write rule (§5.4.4) but never required to round-trip through `fromActiveRound` / `toActiveRound` / `toSetupState`. Device testing showed Back→Setup→Forward navigation silently dropped these fields. v2.1 makes round-trip mandatory for all three (See §4.5 amended.) Plus: `NewRoundPage.handleStart` MUST preserve these fields when reconstructing `activeRound` from setup state (camelCase keys per `toSetupState`'s emission). New invariant 23._

_(3) **Carry-forward state source-of-truth.** §5.4.5 specified the skip-when-current rule but did not state where carry-forward state comes from. Implementation initially derived it from in-memory chain refs that get cleared between chains; this caused proactive resolutions from chain N to vanish from carry-forward in chain N+1. v2.1 makes the source-of-truth explicit: carry-forward MUST be derived from saved `earlyDepartureOpts` (filtered by `eventOrder < currentEvent.eventOrder`), never from in-memory state. New invariant 24._

_(4) **Share image scorecard `–` rule.** §5.5 listed the table of contexts where past-departure holes render as `–`. Implementation discovered the share-image scorecard (hand-built HTML in `roundUtils.js buildShareHtml`) is a separate render path from `ReadOnlyScorecard` and was not covered. v2.1 adds an explicit row to the §5.5 table and requires share-image row totals to also exclude past-departure cells. See §12.1 amended._

_(5) **`continue` resolution: display vs engine status.** v2.0 §11.4 specified the universal pool-family `continue` engine pre-processing. Device testing of 13-C.7 lifted Skins-specific display-side `continue` partition forward (so SkinsTable correctly shows reduced-subset contestation per hole), but the engine-side `continue` partition for non-Skins pool games (Stroke Play, Stableford-individual, Dots) is deferred to 13-C.8. v2.1 adds explicit display vs engine status notes to §11.4._

_(6) **Session plan cleanup.** v2.0 introduced `13-C.7.5` (planning sub-phase) and `13-C.7.6` (build sub-phase) labels. These were ad-hoc — the actual session was 13-C.7 throughout. v2.1 collapses them back into the single `13-C.7` row in §1.3._

_All v2.0 storage continues to load correctly under v2.1 (no storage-shape change). The `eventOrder` field, the `earlyDepartureOpts` shape, and the resolution token vocabulary are unchanged from v2.0. v2.1 is purely an interpretive / disambiguating amendment._

_Changes in v2.0 (13-C.7): MAJOR REWRITE of the early-departure flow based on device-test feedback from 13-C.7 plumbing-level pass. Three structural changes:_

_(1) **Sequenced-event model.** Every departure is its own resolver event, processed in chronological order (by `lastScored` ascending). When N players depart at different holes, N separate resolver sheets fire one after another. Each event consumes carry-forward state from prior events: games already abandoned are not re-asked, games already ended are not re-asked, games where the player departing was already excluded are not shown. The single-combined-sheet model from v1.10/v1.11 (one sheet covering multiple departed players via comma-list header) is REMOVED — every resolver sheet shows ONE departed player. Applies to BOTH proactive entry (long-press X chain across multiple holes) and reactive entry (Results → tap with multiple unresolved events fires a sequence). The §9.5 "multiple departed players" subsection is REMOVED entirely._

_(2) **Per-game-family resolution rules.** Match-family games (Match/Nassau, Sixes, Nines, Stableford-team) get options `abandon` and `end_at_k` only — when one player on a head-to-head or fixed-team game departs, the segment ends. Pool-family games (Skins, Stableford-individual, Stroke Play, Dots, Specials) get all four options: `abandon`, `end_at_k`, `exclude_player` (rendered as "Drop player" in the UI), and `continue`. Default for Match-family is `end_at_k`; default for Pool-family is `continue`. The `continue` option in v2.0 applies universally to pool-family games (was Skins/Dots only in v1.10); when a player departs and the user picks `continue`, results-to-date including the departing player are kept, and the game continues for remaining players from `departureHole + 1` onward via segment-partition pre-processing in `payouts.js`._

_(3) **Out-of-order detection + skip-when-current rule.** Proactive entry (long-press X) detects when a long-press is being entered on a hole BEFORE an existing departure (e.g., user marks A departed at hole 15, then long-presses X on B at hole 11). When detected, a "Reorder Departures" modal appears explaining the conflict and offering a one-tap reorder. On confirm: clear `earlyDepartureOpts` for all events with `departureHole > newEvent.departureHole`, fire the new event's resolver first, then re-fire each previously-cleared event in `lastScored` ascending order. Cleared events open fresh — no pre-population of prior selections. (See §8.5 / §8.6.) Skip-when-current rule: at Results → tap, events whose `earlyDepartureOpts[pi]` is already complete with respect to prior carry-forward are skipped — no re-prompt._

_Net effect on §9.4/§9.5 from v1.11: §9.4 reverts to single-name header ("[Name] left after hole [departureHole + 1]"); §9.5 is REMOVED entirely. The `DepartureResolverSheet` component prop migration is specified in `Resolver_UI_Spec.md` §2.1 v1.1: the canonical prop is `departedPlayerName: string` (singular); the v1.0 plural form `departedPlayerNames: string[]` is retained as a deprecated alias for backward-compat with 13-C.6 storage shape. The v1.11 amendment was a wording correction within the v1.x model; v2.0 supersedes both v1.10 and v1.11 by replacing the model itself._

_All v1.x stored data (`earlyDepartureOpts` records) loads correctly under v2.0. Records have no `eventOrder` field; the reader derives event order at read-time by sorting entries on `departureHole` ascending. No data migration needed. See §13 Backward Compatibility._

_Changes in v1.10 (13-C.6, device-test wrap-up): batched amendment
covering all behavior changes uncovered during device testing. (1) §4.5
+ §8.2 step 3 — `departureHole` semantics clarified: when the user
long-presses X on hole h, hole h is the FIRST LOCKED hole, not the last
played hole. The player's last playable hole is h-1, so the resolver
receives `departureHole = h - 1`. The locked-cell render check (`cell_h
> departureHole`) then locks h itself and all later holes. Edge case:
long-press on hole 0 → `departureHole = -1`, all 18 holes lock,
resolver still opens — represents "departed before any hole was played"
(player no-show after round started); allowed without special-casing.
(2) §8.4 — undo gesture relocated. Was: "tap a locked '–' cell"; is
now: "long-press (~500ms) the dimmed player name td." Locked '–' cells
are fully inert (no listeners, no cursor, no tap response). Hint text
"hold name to resume" appears under the dimmed name in both portrait
and landscape arms of the scorecard grid. The OS-styled `window.confirm`
is replaced by an in-app styled modal with title "Resume scoring for
[Name]?" and Cancel / Yes-resume buttons, matching the depart-confirm
modal in ScoreGrid for visual consistency. (3) §10.1 + §10.2 (resolver
UI) — terminology pass: "Overall" renamed to "Total" universally
across all game families (Match, Stableford, Stroke Play, Nines).
Storage keys (`segKey: 'overall'`) preserved unchanged for backward
compatibility — only display labels changed. (4) §10.1 (resolver
UI) — Match format detection added. Nassau matches (with `betFront >
0` or `betBack > 0`) render Front / Back / Total rows. Total matches
(neither F nor B bet) render only the Total row, with all manual
presses parented under it. The previous behavior rendered all three
buckets even for Total matches, which was wrong because the F/B
buckets carry no bet (engine returns them populated for downstream
display purposes unrelated to bet structure). (5) §10 — pill label
wrapping permitted. Long top-level pill labels ("Continue without
departed", "Remove [LongName]") now wrap to a second line with
vertical centering rather than truncating with an ellipsis. Equal
width preserved via `flex: 1 1 0`. Affects Skins (3 pills) and Dots
(up to 4 pills) primarily.  No engine-side changes in this amendment
(`payouts.js` and `games.js` untouched throughout) — all changes are
in the display layer (`resolverUtils.js`, `ScoreGrid.jsx`,
`ScorecardPage.jsx`, `GameResolutionRow.jsx`)._
_Changes in v1.9 (13-C.6, post-fix): §8.2 step 1 — long-press X no longer
writes a score for the departure hole. Previous text said "Score 'X' is
saved immediately to scores[h][i] before the sheet appears. Player picked
up on this hole regardless of departure decision." This conflated two
distinct user intents: long-pressing X is a departure-intent gesture
("I'm leaving"), not a score-entry gesture ("I picked up on this hole").
A player who long-presses to invoke departure may not have played that
hole at all. The amended rule: the long-press is a pure trigger; no score
is written; the user enters the hole's score normally afterward if
relevant. Step 2 button labels updated to "Cancel" / "Yes, [Name] is
leaving" (was "Just this hole" / "Yes, [Name] is leaving"); the dismissal
button now means "this was a mistap" rather than "save X but don't mark
departed." §8.4 (undoing) — amended language to remove the no-longer-
applicable reference to a "previously-recorded 'X' at the departure hole"
preserved on undo; with the §8.2 amendment, no such X exists. Score
preservation rule on undo is unchanged in spirit: scores at and after
departureHole are untouched by undo (typically blank for h > departureHole
since locked cells didn't allow entry; typically also blank for the
departure hole itself if the user didn't enter one)._
_Changes in v1.8 (13-C.6): §6.1 — `exclude_player` minimum-remaining-players
rule corrected from "3 or more" to "2 or more" (Stableford individual,
Stroke Play, Dots). The previous 3+ rule had no per-game justification —
those games are well-defined at 2 players (Stroke Play is total strokes vs
total strokes; Stableford individual is total points vs total points; Dots
is per-hole independent earnings). The actual floor is "at least 2 players
remain after removal" — i.e., a 2-player game where one departs cannot
offer `exclude_player` because the resulting 1-player game is degenerate.
The "if exactly 2 players and one departs, not shown" sub-bullet rephrased
as "if exactly 1 player remains after removal, not shown" — same threshold,
clearer wording. Hard-engine-constraint exclusions for Match (end the
match), Stableford team (broken team), Nines (hard 3-player), Sixes (hard
4-player) unchanged. No engine-side changes — the engine already accepts
any valid subset; this is purely a UI option-availability rule._
_Changes in v1.7 (13-C.5): §1.3 — 13-C.5 row marked ✅ complete with
cross-reference. §6.3, §10.1, §10.2, §11.8 — not-started press
treatment corrected. A press with a trigger hole beyond `departureHole`
(or `lastCompletedHole`) does not exist as a bet (the segment ended before
the press could begin) and is omitted from the resolver sheet entirely —
not rendered as an auto-Abandoned row. §15 — D-3 (multiple departed players
resolver layout) and D-5 (Scenario A+B combined flow) marked ✅ closed,
both handled inline in `Resolver_UI_Spec.md` §6.1 and §6.2. §16 — Known
Gaps G-1, G-2, G-3, G-4 marked ✅ closed with one-line cross-references
to `Resolver_UI_Spec.md`._
_Changes in v1.6 (13-C.3): §3.6 (new) — Universal Front/Back/Total midpoint rule
covering Match / Nassau, Stroke Play (segments), Stableford individual + team
(segments), and Nines (segments). Single `splitRangeByMidpoint` helper in
`payouts.js`; `runMatchNassau` and `calcTeamStablefordTotal` accept optional
`range` arg. §12.1 — cross-reference to invariant #15(b) for read-only
contexts. §14 invariant #13 — relaxed (was: "games.js never modified by
partial-round features"; now: same except for two surgical `range`-param
additions on `runMatchNassau` and `calcTeamStablefordTotal`; short-circuit
guarantees byte-identity when range absent or `{ 0, 17 }`). §14 invariant #15
— split into #15(a) live ScoreGrid (gray cells) vs #15(b) read-only displays
(`–` rendering); implementation-status footnote added covering
`buildShareImage` non-conformance (deferred). §15 — D-10 added (uneven Sixes
deferred)._
_Changes in v1.5: §1A.2 — UI updated from "Start hole + Number of holes" to "Start hole +
End hole"; validation logic updated; auto-populate and preserve-End rules documented; invalid
entry revert rule documented. §1A.5 — rendering clarified: Front 9 / Back 9 sections always
render full 9 columns when any hole in that half is in the round; out-of-round columns within
rendered sections display as gray non-interactive score cells with no character; Par and M.Hcp
rows always show real values. §1A.8 (new) — TotalsCard round-scoped behavior and ESC omission
rule. §14.15 — updated to reflect gray-cell implementation (no em-dash in score cells).
§15 — wrap-around rounds added as deferred item D-9. Session 13-C.2 marked complete in §1.3._

---

**Primary files:**
`App.jsx`, `ScorecardPage.jsx`, `ScoreGrid.jsx`, `NewRoundPage.jsx`, `GameConfig.jsx`,
`payouts.js`, `roundLib.js`, `roundUtils.js`, `RoundSummaryModal.jsx`

**Files explicitly NOT modified by this contract:**
`games.js`, `handicap.js` — engine functions are range-unaware and departure-unaware by design.
See §11.1 (Engine Firewall).

**Contract amendments required when this contract reaches AUTHORITATIVE:**
- `Sixes_Contract.md` — segment length generalized from hardcoded 6 to `rangeLength / 3`
- `Round_Lifecycle_Contract.md` — §4.5–4.7 superseded by this contract
- `App_Data_Model_Contract.md` — new fields in §5 (`roundStartHole`, `roundNumHoles`,
  `gameRanges`, `earlyDepartureOpts`, `playerJoinHoles`); `buildPayoutArgs` shape in §10

**Cross-references:**
- `App_Data_Model_Contract.md` §5 — `activeRound` blob (new fields added here)
- `Payout_Contract.md` §2 — `computePayouts` entry point
- `Round_Lifecycle_Contract.md` §4 — round lifecycle (§4.5–4.7 superseded by this contract)
- `ScoreKeypad_Contract.md` §5 — long-press X triggers departure resolver
- `Nassau_Match_Contract.md` — Match segment and press definitions
- `Sixes_Contract.md` — Sixes segment definitions (segment length amendment required)
- `Nines_Contract.md` — Nines bet modes
- All other game contracts — per-game behavior

---

## §1. Core Concept — Game Ranges

### §1.1 Every game has a hole range

Every active game in a round has an effective hole range `[startHole, endHole]`
(both 0-based inclusive). The engine computes the game only over this range.

**Default:** `startHole = 0`, `endHole = 17` (full 18 holes).

A non-default range arises from one of three sources:

| Source | When known | startHole | endHole |
|---|---|---|---|
| **Predetermined range** | At round setup | Any hole | Any hole ≤ 17 |
| **Mid-round game start** | When game/player is added | > 0 | 17 (or predetermined) |
| **Early departure** | At runtime (player leaves or group stops) | 0 (or predetermined start) | Discovered at runtime |

All three sources write to the same data model fields (§4). The engine
is range-agnostic — it always receives pre-processed inputs trimmed to
the effective range. See §11.1.

### §1.2 Build order

These features share the same engine foundation and must be built in order:

1. **Round length** — `roundStartHole` + `roundNumHoles` establish the round boundary;
   all other features depend on this baseline
2. **Predetermined game ranges** — per-game overrides within the round boundary
3. **Mid-round game start** — known at add-time; extends range concept to non-zero starts
4. **Early departure** — runtime-discovered end hole; resolver UI on top of engine foundation

No feature in this list may be implemented before the prior feature's engine
support is complete and confirmed on device.

### §1.3 Session plan

| Session | Type | Content |
|---|---|---|
| **13-C** | Planning + Contract | Full walkthrough; `PartialGameContract.md` drafted and approved |
| **13-C.2** | Build ✅ | Round length — `roundStartHole` + `roundNumHoles` fields, NewRoundPage pickers (Start + End hole), ScoreGrid column count with gray out-of-round cells, Results → always tappable, TotalsCard round-scoped totals, game range defaults |
| **13-C.3** | Build ✅ | Predetermined game ranges — `gameRanges` data model, `payouts.js` pre-processing layer, `GameConfig` range picker UI, game table column trimming, `buildPayoutArgs` changes |
| **13-C.4** | Build | Mid-round game start — `playerJoinHoles`, eligibility logic, Nines rotation, Sixes dynamic segments, Nassau midpoint |
| **13-C.5** | Planning ✅ | Resolver UI design — see `Resolver_UI_Spec.md`. G-1 through G-4 closed. |
| **13-C.6** | Build ✅ | Early departure proactive entry — long-press X flow, `DepartureResolverSheet`, locked cells, undo |
| **13-C.7** | Build ✅ | Early departure reactive entry — Results → gate, classification logic. Includes mid-session v2.0 contract amendment (sequenced-event model, per-game-family options, Reorder Departures, skip-when-current; supersedes v1.10/v1.11 multi-name resolver model) and full v2.0 build: sequencer controller, `ReorderDeparturesModal`, per-family option matrix, `DepartureResolverSheet` prop migration, engine departure data guardrail (dual implementation: payouts.js + scorecardUtils.js mirrors), Skins-specific `continue` partition lifted forward from 13-C.8. v2.1 documentation amendment delivered post-device-test. |
| **13-C.8** | Build | Engine departure handling for non-Skins pool-family games in `payouts.js` — `continue` segment partition for Stroke Play, Stableford-individual, Dots; `exclude_player` retroactive removal for all pool-family games; `end_at_k` per-segment Pay/Abandon engine wiring; `RoundSummaryModal` resolution-display ribbon |

---

## §1A. Round Length

### §1A.1 Concept

Every round has a defined length — a start hole and a number of holes to play.
This is set at round setup and establishes the boundary for all game ranges,
completion detection, and ScoreGrid display.

**Default:** Start hole 1, 18 holes (`roundStartHole = 0`, `roundNumHoles = 18`).

**Examples:**
- Standard round: start hole 1, 18 holes
- Front 9 only: start hole 1, 9 holes
- Back 9 only: start hole 10, 9 holes
- Partial round: start hole 1, 12 holes
- Mid-course start: start hole 4, 9 holes

### §1A.2 UI — round length pickers

Two fields in `NewRoundPage`, placed inside the Course card below the course
picker and Front 9 / Back 9 selectors:
- **Start hole:** numeric entry, 1–18 (displayed 1-based; stored 0-based as `roundStartHole`)
- **End hole:** numeric entry, displayed 1-based (stored as `roundNumHoles = endHole - roundStartHole`)

**Validation:**
- Start hole: 1–18
- End hole: `startHole + 2` through 18 (enforces minimum 3-hole round, maximum ends at hole 18)
- Invalid entries revert to the previously committed value — no clamping to min/max

**Auto-populate behavior:** When the user changes Start hole, End hole auto-populates
to 18 (play to the last hole of the course). If End hole is still valid under the new
Start hole (i.e. `endHole >= newStart + 3`, 1-based, enforcing the 3-hole minimum),
End hole is preserved instead of resetting. Only when the new Start would make the
current End invalid is End bumped up to the new minimum (`newStart + 3`, 1-based).

**Input UX:** Both fields clear on focus so the next keystroke replaces the value.
Blur commits the value. Mid-typing does not trigger any validation or clamping.

**Storage:** `roundStartHole` (0-based) and `roundNumHoles` are the stored fields.
The UI converts: `roundNumHoles = endHole - roundStartHole`. The End hole value
is always derived at read time and never stored directly. Both fields default to
`undefined` if absent in a record; callers apply `?? 0` / `?? 18` at read time
(§1A.7 backward compat).

### §1A.3 Derived value

`roundEndHole = roundStartHole + roundNumHoles - 1` (0-based).
This is always derived and never stored.

### §1A.4 Effect on game ranges

All game ranges default to `[roundStartHole, roundEndHole]`. Per-game overrides
(§2) must satisfy `game.startHole >= roundStartHole` and
`game.endHole <= roundEndHole`. A game range can never extend beyond the round.

### §1A.5 Effect on ScoreGrid

ScoreGrid always renders the familiar **Front 9 / Back 9** layout. A section
is rendered whenever the round contains at least one hole in that half:

- **Front 9 section** renders if `roundStartHole <= 8` (round touches any of holes 1–9)
- **Back 9 section** renders if `roundEndHole >= 9` (round touches any of holes 10–18)
- When only one section is rendered (e.g. a front-9-only round), the other section is omitted entirely

Within each rendered section, **all 9 columns are always displayed.** Columns whose
holes fall outside the round boundary are rendered as **gray, non-interactive score cells**
with no character content. The column header, par row, and M.Hcp row continue to display
real values even for out-of-round columns — only score cells are grayed.

**Totals** in the section Total column reflect only in-round holes. For a round spanning
holes 4–15, the Front 9 Total shows the sum of holes 4–9 only; the Back 9 Total shows
holes 10–15 only.

**ZoomModal** follows the same boundary: only in-round holes are interactive; out-of-round
holes adjacent to the center cell render as placeholder tiles.

**Landscape:** Same rules apply. Single-half rounds (front-9-only or back-9-only) use a
compact natural table width rather than full viewport width.

**Cell navigation** (`kpAdvanceCell`, `kpRetreatCell`, `firstEmptyHole`) is bounded by
`[roundStartHole, roundEndHole]`. Navigation cannot advance past `roundEndHole` or retreat
before `roundStartHole`.

### §1A.6 Effect on Results →

Results → is always tappable — including mid-round, where it shows current
standings based on holes scored so far.

Classification of "Complete" is relative to `roundEndHole`:
- A player is **Complete** when they have a non-empty score on every hole from
  `roundStartHole` through `roundEndHole`.
- A player is **Early departure** when they have scores through some hole `k`
  (where `roundStartHole <= k < roundEndHole`), then all empty after `k`.
- A player has **Missing scores** when they have scattered empty holes within
  `[roundStartHole, roundEndHole]`.

When all players are Complete (through `roundEndHole`), Results → computes
payouts normally — no resolver needed, even if the round was shorter than 18 holes.

### §1A.7 Backward compatibility

`roundStartHole` absent → 0 (hole 1).
`roundNumHoles` absent → 18.
Old saved rounds load correctly with full 18-hole behavior.

Both fields are stored as `undefined` when absent from a history record. All callers
apply `?? 0` / `?? 18` at read time rather than storing defaults. `toSetupState` must
also restore both fields so that reloading a saved partial round into NewRoundPage
preserves the original round length in the pickers.

### §1A.8 TotalsCard behavior

`TotalsCard` (the "Round Totals" card on the scorecard) reflects only in-round holes:

- **Par total** shown in the top-right badge = sum of pars for `[roundStartHole, roundEndHole]` only
- **Gross total** per player = sum of scores for `[roundStartHole, roundEndHole]` only
- **ESC (Adjusted Gross Score)** is shown only for full 18-hole rounds (`roundStartHole = 0`,
  `roundNumHoles = 18`). For partial rounds, ESC is omitted entirely. GHIN requires a
  specific 9- or 18-hole format for official ESC posting; a partial-round value would be
  misleading. Players should compute their own ESC for GHIN posting after partial rounds.

**Landscape width:** In landscape orientation, when only one half (Front 9 or Back 9) is
rendered, the TotalsCard is width-constrained to match the compact scoregrid width.
Game tables below TotalsCard remain full-width until 13-C.3 column-trimming lands.

---

## §2. Predetermined Game Ranges

### §2.1 Overview

At round setup (`NewRoundPage`), the user may optionally configure a game to
cover a hole range shorter than the round length. All games default to the
full round range `[roundStartHole, roundEndHole]` (§1A.4). Per-game ranges
are restrictions within the round — they can be shorter but never longer.

Examples (assuming a standard 18-hole round starting hole 1):
- Match covering only front 9: `startHole = 0, endHole = 8`
- Stableford covering holes 1–12: `startHole = 0, endHole = 11`
- Skins covering back 9 only: `startHole = 9, endHole = 17`
- 9-hole Sixes / "Threes" (within a 9-hole round): inherits `[0, 8]` by default

The range is set once at setup and does not change during the round
(unless subsequently modified by early departure).

### §2.2 UI — range picker

An optional "Start hole" and "End hole" picker is available in `GameConfig`
for each game. Both default to the round's start and end holes respectively.
If left at defaults, no entry is written to `gameRanges` — the game uses the
round range automatically.

Validation rules:
- `game.startHole >= roundStartHole`
- `game.endHole <= roundEndHole`
- `game.startHole < game.endHole`
- Minimum range: 3 holes (`game.endHole - game.startHole >= 2`)
- Range must satisfy the game's structural requirements (see §6 per-game rules and §16 G-4)

### §2.3 Engine behavior

`payouts.js` pre-processes scores and inputs to the effective range before
calling any engine function. The engine functions in `games.js` receive
only the holes within `[startHole, endHole]` and are unaware a range exists.
See §11.1.

### §2.4 Display — ScoreGrid, ZoomModal, game tables, round summaries

**ScoreGrid and ZoomModal:** Show exactly `roundNumHoles` columns starting
at `roundStartHole`. Holes outside the round are not shown. Score entry is
not restricted within the round — all holes in `[roundStartHole, roundEndHole]`
are always scoreable. Per-game ranges are not visually distinguished in the
score entry grid — the grid is a scoring surface, not a game display surface.

**Game tables (in-round and RoundSummaryModal):** Each game table renders
only the columns for holes within its `[startHole, endHole]` range. Holes
outside the range are not shown — the table is trimmed to the game's range.
Column headers, totals columns, and all row data reflect the trimmed range.

**ReadOnlyScorecard (RoundSummaryModal and share image):** Shows `–` for
holes outside any player's effective range. See §5.5 for the full `–`
display rule.

---

## §3. Mid-Round Game Start

### §3.1 Overview

A game may be added after hole 1 has been played. The game's `startHole`
is the current hole at the time the game is added. All scoring before
`startHole` is ignored for this game.

### §3.2 Player eligibility

All players in the round at the time the game is added are eligible
participants. The universal eligibility rule: a player participates in
a game only for holes where both the player and the game are active.

Effective hole range for any player `i` in any game:
```
playerGameStart = max(game.startHole, player.joinHole ?? 0)
playerGameEnd   = min(game.endHole,   player.departureHole ?? roundEndHole)
```

### §3.3 Data model

`playerJoinHoles: { [playerIdx]: number }` — 0-based hole index where each
late-arriving player joined. Absent or 0 = joined at hole 0.

Set in `NewRoundPage` when a player is added mid-round. Preserved through
`fromActiveRound` / `toActiveRound`.

### §3.4 Nines fresh-start rotation

When Nines starts on a hole other than 0, the point rotation begins fresh
from that hole. The rotation is not influenced by prior holes.

### §3.5 Sixes dynamic segment alignment

Sixes always has exactly **three equal segments**. Segment length is
determined by the game's range:

```
rangeLength  = endHole - startHole + 1
segLength    = rangeLength / 3          // must be a whole number — see §16 G-4
Segment 0:   startHole               to  startHole + segLength - 1
Segment 1:   startHole + segLength   to  startHole + (segLength * 2) - 1
Segment 2:   startHole + (segLength * 2)  to  endHole
```

For a standard full round: `rangeLength = 18`, `segLength = 6`
(holes 0–5, 6–11, 12–17 — the existing "Sixes" behavior, unchanged).

For a 9-hole round: `rangeLength = 9`, `segLength = 3`
(holes 0–2, 3–5, 6–8 — "Threes").

**Amendment note:** `Sixes_Contract.md` must be amended to replace the
hardcoded 6-hole segment length with this dynamic formula. The existing
engine behavior for full 18-hole rounds is unchanged — `segLength = 6`
remains the standard case.

### §3.6 Universal Front/Back/Total midpoint rule

This rule applies to **all games** that split a range into Front, Back, and
Total segments: Match / Nassau, Stroke Play (segments), Stableford individual
(segments), Stableford team (segments), and Nines (segments). For a game with
an effective range `[startHole, endHole]`:

```
totalHoles = endHole - startHole + 1
midHole    = startHole + floor(totalHoles / 2)
Front:     startHole  to  midHole - 1
Back:      midHole    to  endHole
Total:     startHole  to  endHole
```

Back gets the extra hole on odd-length ranges. For the default full round
`[0, 17]` this yields Front=`[0..8]`, Back=`[9..17]`, Total=`[0..17]` —
byte-identical to the pre-13-C.3 hardcoded arrays (invariant #13.b — the
games.js short-circuit when `range` is absent or equal to `{ 0, 17 }`).

**Where implemented:**
- `payouts.js::splitRangeByMidpoint(startHole, endHole)` — single authoritative
  helper returning `{ front, back, all }` hole-index arrays. Used directly by
  Stroke Play, Stableford individual, and Nines segment logic.
- `games.js::runMatchNassau` — derives F/B/T internally when the optional
  `range` argument is non-default.
- `games.js::calcTeamStablefordTotal` — derives `midHole` internally when
  the optional `range` argument is non-default.

---

## §4. Data Model

### §4.1 New fields in `activeRound`

```js
activeRound: {
  // NEW — round-level length definition
  // Absent = start hole 0, 18 holes (full round, backward compatible)
  roundStartHole: number | undefined,   // 0-based, default 0
  roundNumHoles:  number | undefined,   // default 18
  // roundEndHole = roundStartHole + roundNumHoles - 1 (derived, never stored)

  // NEW — game-level range overrides within the round boundary
  // Absent = all games use [roundStartHole, roundEndHole]
  gameRanges: {
    [gameKey: string]: {
      startHole: number,   // 0-based; >= roundStartHole
      endHole:   number,   // 0-based; <= roundEndHole
    }
  } | undefined,

  // Per-player departure data. v2.0: each entry has an `eventOrder` field
  // (0-based) defining chronological position among all departure events
  // in the round. Used by the sequenced-event resolver chain (§9) and by
  // carry-forward state replay (§5.4.2). v1.x records without `eventOrder`
  // load correctly — the reader derives `eventOrder` at read-time by
  // sorting entries on `departureHole` ascending. No data migration
  // needed; see §13.
  // Absent = no departures.
  earlyDepartureOpts: {
    [playerIdx: number]: {
      departureHole:   number,        // 0-based — last hole this player actually scored
      eventOrder:      number,        // v2.0: 0-based chronological index among events
      gameResolutions: {
        [gameKey: string]: SegmentedResolution
      }
    }
  } | undefined,

  // EXISTING — unchanged semantics; now also set by departure resolver
  // Set for Scenario B (all players stop early)
  lastCompletedHole: number | undefined,   // 0-based, default 17
  earlyEndOpts: {
    [gameKey: string]: SegmentedResolution
  } | undefined,

  // NEW — per-player join holes (mid-round arrivals)
  playerJoinHoles: {
    [playerIdx: number]: number   // 0-based hole index where player joined
  } | undefined,
}
```

### §4.2 SegmentedResolution type

```js
type GameResolution =
  | 'abandon'          // $0 for all — game is voided
  | 'end_at_k'         // compute over holes played; departed player included
  | 'exclude_player'   // remove departed player retroactively from startHole
                       // (v2.0: rendered as "Drop player" in resolver UI;
                       // token name preserved at data-model layer for
                       // backward compatibility with v1.x stored records
                       // and engine dispatch logic)
  | 'continue'         // remaining players continue; pre-departure results
                       // (including departing player) are kept; game
                       // continues from departureHole + 1 onward for
                       // remaining players. v2.0: applies universally to
                       // pool-family games (Skins, Stableford-individual,
                       // Stroke Play, Dots, Specials). v1.10 limited this
                       // to Skins/Dots only.

type SegmentedResolution = {
  topLevel: GameResolution,

  // Independent Pay/Abandon per segment — only present when topLevel = 'end_at_k'
  // and game has segment structure. Default 'pay' for all.
  segments?: {
    front?:   'pay' | 'abandon',
    back?:    'pay' | 'abandon',
    overall?: 'pay' | 'abandon',
    // Sixes only (seg0/seg1/seg2 regardless of segment length):
    seg0?:    'pay' | 'abandon',
    seg1?:    'pay' | 'abandon',
    seg2?:    'pay' | 'abandon',
  },

  // Independent Pay/Abandon per press — keyed by press trigger hole (0-based).
  // Only present when topLevel = 'end_at_k' and game has presses.
  // Default 'pay'. Not-started presses automatically 'abandon' (not stored).
  presses?: {
    [triggerHole: number]: 'pay' | 'abandon'
  }
}
```

**Press independence rule:** Every press is an independent bet with its own
Pay/Abandon toggle. A press may be in progress while its parent segment is
closed, or vice versa. No automatic inheritance between a press and its
parent segment.

### §4.3 `gameKey` rules

Keys in `gameRanges`, `earlyEndOpts`, and `earlyDepartureOpts.gameResolutions`
must exactly match `activeGames[]` entries. For multi-instance Match,
key = `matchDef.id`. Identical to the existing `earlyEndOpts` key rule.

### §4.4 `buildPayoutArgs` changes

New fields added to `buildPayoutArgs` output in `roundUtils.js`:
```js
{
  roundStartHole:      ar.roundStartHole      ?? 0,
  roundNumHoles:       ar.roundNumHoles       ?? 18,
  // roundEndHole derived: roundStartHole + roundNumHoles - 1
  gameRanges:          ar.gameRanges          ?? {},
  earlyDepartureOpts:  ar.earlyDepartureOpts  ?? {},
  playerJoinHoles:     ar.playerJoinHoles     ?? {},
  // lastCompletedHole and earlyEndOpts already present (existing)
}
```

### §4.5 `roundLib` changes

`fromActiveRound` must include `roundStartHole`, `roundNumHoles`, `gameRanges`,
`earlyDepartureOpts`, `earlyEndOpts`, `lastCompletedHole`, and
`playerJoinHoles` in the history record.

`toActiveRound` must restore all of them, defaulting to `undefined` if
absent in old records — backward compatible (§1A.7 defaults apply).

`toSetupState` must restore `earlyDepartureOpts`, `earlyEndOpts`, and
`lastCompletedHole` in **camelCase** (not snake_case). NewRoundPage's
`handleStart` MUST read these fields from `initSrc` (the setup-state
shape) using camelCase keys, and MUST include them in the `roundState`
written to `activeRound` when `playerLineupUnchanged` (mirroring the
existing preservation pattern for `scores` / `dotEntries` /
`manualPresses`). Without this preservation, the user navigating
Back→Setup→Forward (a common gesture mid-round) would silently lose
all locked-cell displays and resolution decisions. (Round-trip
invariant 23.)

The full round-trip surface is therefore:

| Field | activeRound | history record (snake_case) | setupState (camelCase) |
|---|---|---|---|
| `earlyDepartureOpts` | required | `early_departure_opts` | `earlyDepartureOpts` |
| `earlyEndOpts` | required | `early_end_opts` | `earlyEndOpts` |
| `lastCompletedHole` | required | `last_completed_hole` | `lastCompletedHole` |

The history-record migration `migrateRecord` MUST backfill `eventOrder`
on legacy records lacking this field — sorted by `departureHole`
ascending, tie-broken by `playerIdx` ascending (§13). This applies only
to history records loaded via `roundLib.list()`; live `activeRound`
consumers re-derive `eventOrder` at consumption time per the project's
established "derive at read, never trust storage" pattern (cf.
`restoreDotDefs`, `restoreAutoWhen`).

**`departureHole` semantics:** within `earlyDepartureOpts[i]`, the
`departureHole` field is **0-based and represents the player's last
playable hole** — equivalently, `departureHole + 1` is the FIRST hole
that locks (`–` displays). The locked-cell render check is `cell_h >
departureHole`. So a player who long-presses X on hole index 7 (1-based:
hole 8) gets `departureHole = 6`, meaning hole 7 (1-based: hole 8) and
all later holes lock. Edge case: long-press on hole index 0 (1-based:
hole 1) → `departureHole = -1`, all 18 holes lock — represents
"departed before any hole was played." This semantics is consistent
with the `evalClinchStatus` and `evalCompletionStatus` helpers in
`resolverUtils.js` which both treat `departureHole` as the
already-played boundary.

---

## §5. Detection and Classification (Early Departure)

### §5.1 When departure is detected

Two entry points:

**Entry point 1 — Long-press X (proactive — Scenario A only):**
User long-presses X on a score cell during scoring — signals that specific
player is done for the round, not just picking up on this hole. See §8.
This entry point handles one player leaving; it does not end the round
for everyone.

**Entry point 2 — Results → tap (proactive and reactive — all scenarios):**
Results → is always tappable. When tapped mid-round it shows current standings.
When scores are incomplete relative to `roundEndHole`, the classification logic
runs (§5.2) and the resolver appears if needed. This is both the proactive
"end round now for everyone" gesture (Scenario B) and the reactive entry point
for any departure scenario. See §9.

### §5.2 Classifying players at Results →

When Results transition is attempted and scores are incomplete, each player
is classified as:

| Class | Definition |
|---|---|
| **Complete** | Has a non-empty score on every hole from `roundStartHole` through `roundEndHole` |
| **Early departure** | Has scores through hole `k`, then all empty after `k` (contiguous trailing block) |
| **Missing scores** | Has at least one empty hole NOT in a contiguous trailing block |

**`roundEndHole`:** The expected last hole of the round = `roundStartHole + roundNumHoles - 1`.
This is the authoritative completion boundary.

**`highWaterMark`:** Highest hole index (within the round) where any player has
a non-empty score. Used to detect where a Scenario B group stopped — not used
to define "complete."

**Classification logic:**
```
roundEndHole = roundStartHole + roundNumHoles - 1

For each player i:
  lastScored[i]    = max hole h in [roundStartHole, roundEndHole]
                     where scores[h][i] is non-empty (real or X)
                     (-1 if no scores exist)
  trailingEmpty[i] = all holes from lastScored[i]+1 through roundEndHole are empty

  if lastScored[i] === roundEndHole    → Complete
  elif trailingEmpty[i] === true        → Early departure (left after lastScored[i])
  else                                  → Missing scores
```

### §5.3 Routing based on classification

In v2.0 the routing is **per-event sequenced**, not scenario-based as a
single sheet. The classifier produces a list of unresolved departure
events (one per player classified as Early departure whose
`earlyDepartureOpts` entry is not already current — see §5.4.5). Events
are sorted by `lastScored` ascending; the resolver fires once per event
in order. Each event consumes the carry-forward state from prior events.

| Situation | App behavior |
|---|---|
| All players Complete | Normal Results flow — no resolver |
| Any player has Missing scores | Block Results — list which holes. No resolver. |
| Mix of Missing scores and Early departure | Block with Missing scores error. Must fix first. |
| One or more players Early departure (any holes), rest Complete | Sequenced resolver chain — one event per departed player, sorted ascending by `lastScored`. Each event applies carry-forward from prior events. |
| All players Early departure (any holes — same or different) | Sequenced resolver chain for all players. The LAST event in the chain (highest `lastScored`) additionally writes `lastCompletedHole` and `earlyEndOpts` to capture the group-stop semantic — see §5.4. |

The single-combined-sheet "Scenario A vs Scenario B" routing from v1.10 /
v1.11 is REMOVED. Both scenarios now route through the same sequenced-
event chain. The Scenario A vs Scenario B distinction is preserved at
the data-model layer (whether `lastCompletedHole` / `earlyEndOpts` are
written) but is no longer a resolver-UI decision point.

### §5.4 Sequenced events and carry-forward state

In v2.0 the resolver fires once per departure event in chronological order.
Each event opens with carry-forward state from prior events that filters
which games are shown and constrains which options are available. This
section formalizes the event sequence model.

#### §5.4.1 Event sequence

Every player classified as Early departure (per §5.2) produces a
**departure event** keyed on `departureHole`. Events are processed in
ascending `departureHole` order. The chronological position of an event
is its `eventOrder` (0-based).

`eventOrder` is persisted on `earlyDepartureOpts[pi].eventOrder` so the
sequence can be reconstructed deterministically when a saved round is
reloaded. v1.x records lacking this field have it derived at read-time
by sorting on `departureHole` ascending (per §13).

If two players have the same `departureHole`, ordering between them is
implementation-defined but stable — typically by player index ascending.
Carry-forward state is identical regardless because they share the same
`departureHole`, so per-event resolver content does not depend on the
tiebreak choice.

#### §5.4.2 Carry-forward state

For each event N, the resolver sheet opens with **carry-forward state**
computed from events 0..N-1. Carry-forward state describes which games
have been resolved (and how) by prior departures, and which player
subsets are currently active in each game.

```js
type CarryForwardState = {
  [gameKey: string]: GameCarryForward
}

type GameCarryForward =
  | { status: 'unresolved',     atEvent: null }
  | { status: 'abandoned',      atEvent: number }
  | { status: 'ended_at_k',     atEvent: number, atHole: number }
  | { status: 'continuing',     atEvent: number, currentSubset: number[] }
  | { status: 'excluded_player', atEvent: number, excludedIdxs: number[] }
```

State semantics:
- `unresolved` — game has not been resolved yet. Resolver shows it
  normally with all per-family options (§6.1).
- `abandoned` — a prior event resolved this game with `topLevel:
  'abandon'`. The game is finished; subsequent events do not re-ask.
- `ended_at_k` — a prior event resolved this game with `topLevel:
  'end_at_k'`. The game is finished at `atHole`; subsequent events
  do not re-ask.
- `continuing` — a prior event resolved this game with `topLevel:
  'continue'`. The game is still active for `currentSubset` of players
  (the original participant set minus all players removed by prior
  `continue` or `exclude_player` events, in order). Subsequent events
  see this game IF the departing player is in `currentSubset`; the
  resolver options and computations are scoped to `currentSubset`.
- `excluded_player` — a prior event resolved this game with `topLevel:
  'exclude_player'`. The departed player at that prior event was
  retroactively removed from `startHole`; the game continues for the
  remaining players. Subsequent events see this game IF the departing
  player is not in `excludedIdxs`.

Cascading: if event N picks `continue` on a game that was already
`continuing` from event N-1, the new state becomes `continuing` with
`currentSubset` further reduced by event N's departing player, and
`atEvent` updated to N.

#### §5.4.3 Effect on resolver display per event

For each game `gameKey` that the departing player participated in, the
resolver applies these display rules based on carry-forward status:

| Carry-forward status | Behavior in this event's resolver |
|---|---|
| `unresolved` | Show normally. All applicable per-family options available (§6.1). |
| `abandoned` | HIDE — game is already finished. Nothing to ask. |
| `ended_at_k` | HIDE — game is already finished. Nothing to ask. |
| `continuing` AND departing player ∈ `currentSubset` | Show with subset scoped to `currentSubset`. Options computed per §6.1; `continue` here means "continue with `currentSubset` minus the departing player." |
| `continuing` AND departing player ∉ `currentSubset` | HIDE — the departing player was already removed from this game by a prior event. |
| `excluded_player` AND departing player ∈ `excludedIdxs` | HIDE — already removed. |
| `excluded_player` AND departing player ∉ `excludedIdxs` | Show normally, treating `excludedIdxs` as if those players never participated. |

If after applying these rules the resolver has zero games to show, the
sheet does NOT open for this event. The event auto-confirms with an
empty `gameResolutions` map. `earlyDepartureOpts[pi]` is still written
(carrying `departureHole`, `eventOrder`, and an empty `gameResolutions`)
so the chronological record is preserved. The sequencer immediately
advances to the next event.

#### §5.4.4 Group-stop write rule

After the LAST event in the chain (the one with the highest `eventOrder`)
is confirmed, the sequencer applies the group-stop write rule:

If every player in `activeRound.activePlayers` is classified as Early
departure (i.e., no player reached `roundEndHole`), the LAST event's
confirm action ALSO writes:

- `lastCompletedHole` = `highWaterMark` (the highest `lastScored` of
  any player — equivalently, the `departureHole` of the last event)
- `earlyEndOpts` = the `gameResolutions` map confirmed at the LAST event

If at least one player IS Complete (reached `roundEndHole`), neither
`lastCompletedHole` nor `earlyEndOpts` is written, regardless of how
many other players departed early. The round ran to completion for at
least one player.

This rule replaces the v1.10 / v1.11 "Scenario A vs Scenario B" UI
distinction. In v2.0, both scenarios use the same per-event sequenced
chain; the only data-model difference is whether these two fields are
written at the chain's end.

See §14 invariant 20 for the full invariant statement.

#### §5.4.5 Skip-when-current rule

When the resolver chain is being assembled (proactively after a single
new departure, or reactively at Results → tap), each candidate event is
checked for skipping:

1. Compute carry-forward state from events 0..N-1.
2. Apply §5.4.3 to determine which games would be shown to this event.
3. Check `earlyDepartureOpts[pi]`:
   - If absent: event is **unresolved** — fire the resolver.
   - If present, check that `gameResolutions` contains a resolution for
     every game that would be shown AND no game would be shown that
     lacks a resolution → event is **current** — skip.
   - Otherwise: event is **stale** (e.g., a new game was started since
     the prior resolution, or a prior carry-forward changed which
     games apply) — fire the resolver. On confirm, the existing
     `earlyDepartureOpts[pi]` is overwritten with the new resolutions.

If ALL events in the chain are current, no resolver fires. The transition
to Results is direct. This is the common case after a saved round is
reloaded — all departures already have complete resolutions, so reopening
Results just shows results.

The skip rule also applies during proactive Reorder Departures execution
(§8.6): re-fired cleared events are checked against current state at
re-fire time. Per the locked design decision, prior selections from
cleared events are NOT preserved during reorder — `initialResolutions`
is computed fresh from `makeDefaultResolution` against the rebuilt
carry-forward state. The skip rule therefore does not save the user
re-confirmation work during reorder; it only saves work for events that
were not cleared.

**Carry-forward source-of-truth rule (v2.1, MANDATORY).** When computing
carry-forward state for any event in the chain, the source of truth is
**`activeRound.earlyDepartureOpts`** filtered to entries where
`eventOrder < currentEvent.eventOrder`. The implementation MUST NOT
derive carry-forward from any in-memory chain reference (e.g., a
`confirmedEventsRef` array tracking only the current chain's
confirmations). Reasoning: in-memory chain refs are cleared at the end
of each chain, so a chain N+1 (typically a reactive Results→ chain
following a prior proactive long-press X chain) would see an empty
carry-forward and fail to filter games that were already abandoned or
ended in chain N. `earlyDepartureOpts` is written incrementally (in
the resolver-confirm handler and again in `finishChain`'s group-stop
write) and persists across chains, making it the only correct source.
Every event's carry-forward is therefore reconstructed from saved
state at chain-fire time. (See §14 invariant 24.)

This rule applies identically to single-event chains: the sole event's
carry-forward is empty (no events with `eventOrder < 0`), and the
`evalCarryForward` helper returns an empty map — no special-casing
needed.

### §5.5 `–` display rule for unplayed holes

The `–` character is the authoritative display value for any hole a player
did not play. It is distinct from:
- A real score (numeric) — player played the hole
- `X` — player played the hole but picked up (ball in hand)
- Blank — score not yet entered (data entry in progress)

`–` is displayed in the following cases:

| Case | Where shown |
|---|---|
| Hole after `departureHole` for a departed player | ScoreGrid (locked cell), ReadOnlyScorecard, game tables, **share image scorecard (v2.1)** |
| Hole after `lastCompletedHole` for any player (Scenario B) | ReadOnlyScorecard, game tables, share image scorecard |
| Hole outside a game's `[startHole, endHole]` range for any player | Game tables and round summaries only (not ScoreGrid) |
| Hole before a player's `joinHole` (late arrival) | ReadOnlyScorecard, game tables |

**Share image scorecard (v2.1):** `roundUtils.js buildShareHtml` renders
its own scorecard via hand-built HTML (separate from `ReadOnlyScorecard`).
This render path MUST also display `–` for any cell where `h >
earlyDepartureOpts[pi].departureHole`, in muted gray (`color: #ccc`,
`background: #f8f8f8`) matching `ReadOnlyScorecard`'s out-of-round and
past-departure cell treatment. Row-total computations in the share
image (per-half totals in portrait, F9/B9 totals in landscape) MUST
exclude past-departure cells from the sum.

**ScoreGrid and ZoomModal never display `–` for out-of-range holes** —
those holes are always available for score entry regardless of any game's range.

---

## §6. Per-Game Option Availability

### §6.1 Option matrix (v2.0 — per-game-family)

In v2.0, options available per game are determined by the game's **family**:

- **Match-family** (head-to-head or fixed-team games): `abandon`, `end_at_k`. Default: `end_at_k`.
- **Pool-family** (independent-player or reducible-pool games): `abandon`, `end_at_k`, `exclude_player`, `continue`. Default: `continue`.

| Game | Family | abandon | end_at_k | exclude_player | continue | Default | Segment pills | Press pills |
|---|---|---|---|---|---|---|---|---|
| Match / Nassau | Match | ✓ | ✓ | ✗ | ✗ | end_at_k | Front/Back/Total | Per press (independent) |
| Sixes | Match | ✓ | ✓ | ✗ | ✗ | end_at_k | Seg0/Seg1/Seg2 | Per press (independent) |
| Nines | Match | ✓ | ✓ | ✗ | ✗ | end_at_k | F/B/T if segments mode | N/A |
| Stableford (team) | Match | ✓ | ✓ | ✗ | ✗ | end_at_k | F/B/T if segments mode | N/A |
| Skins ($ per hole) | Pool | ✓ | ✓ | ✓ * | ✓ | continue | None | N/A |
| Skins (pot) | Pool | ✓ | ✓ | ✓ * | ✓ | continue | None | N/A |
| Stableford (individual) | Pool | ✓ | ✓ | ✓ * | ✓ | continue | F/B/T if segments mode | N/A |
| Stroke Play | Pool | ✓ | ✓ | ✓ * | ✓ | continue | F/B/T if segments mode | N/A |
| Dots | Pool | ✓ | ✓ | ✓ * | ✓ | continue | None | N/A |
| Specials | Pool | ✓ | ✓ | ✓ * | ✓ | continue | None | N/A |

**Family rationale.**

- **Match-family** games are head-to-head (Match/Nassau, 1v1) or fixed-team
  (Sixes 2v2, Nines 3-way, Stableford-team team-vs-team) where the game's
  structure depends on a fixed participant count. When any participant
  departs, the game cannot continue with reduced players in a meaningful
  way, so the only sensible options are `abandon` or `end_at_k`. Sixes
  specifically requires exactly 4 players for the 2v2 rotation; any
  departure ends the game (per Q3.1 in 13-C.7 / v2.0 design discussion).
- **Pool-family** games are scored independently per player (Stableford-
  individual, Stroke Play, Skins, Dots, Specials) — the game produces
  meaningful results for any subset of remaining players. All four
  options are valid: `abandon` voids the game, `end_at_k` ends and pays
  based on results to date, `exclude_player` retroactively removes the
  departed player, `continue` keeps results-to-date and lets the game
  keep going for the remainder.

**`exclude_player` availability rules (marked *):**
- Only valid when 2 or more players remain in the game after removal.
  If exactly 1 player remains, `exclude_player` is not shown (no
  meaningful pool game with one player).
- Rendered in the resolver UI as **"Drop player"** (token name preserved
  at the data-model layer for backward-compat).

**`exclude_player` behavior:**
Full retroactive recompute from `startHole` as if the departed player was
never in the game. The departed player's entry is removed from the game's
player subset in `activeRound` before `computePayouts` runs. The engine
receives a clean, complete subset and is unaware any player was removed.

**`continue` behavior (v2.0 — universal pool-family):**
Results earned through `departureHole` (including by the departing
player) are LOCKED IN as part of the game's accumulated total. The game
continues for remaining players from `departureHole + 1` onward. The
departing player keeps any pre-departure earnings (e.g., skins won, dots
earned) but participates in nothing post-departure. The engine pre-
processing layer in `payouts.js` handles this by computing the game in
two segments: `[startHole, departureHole]` with the full original player
subset, and `[departureHole + 1, endHole]` with the reduced subset.

**v1.10-vs-v2.0 changes:**
- `continue` was Skins/Dots only in v1.10; v2.0 extends it to all
  pool-family games per Q3.2.
- `exclude_player` minimum-remaining rule was 3+ in v1.7 and earlier,
  corrected to 2+ in v1.8. Unchanged in v2.0.
- Match-family / Pool-family terminology is new in v2.0 (was implicit
  in v1.10's per-game enumeration).

### §6.2 Segment pill availability

Segment pills (per-bet Pay/Abandon) are shown only when:
- The top-level resolution is `end_at_k`
- The game has a segment structure (F/B/T or Sixes segments)

Default for all segment pills: **Pay**. User may flip individual segments to Abandon.

### §6.3 Press pill availability

Press pills (per-press Pay/Abandon) are shown only when:
- The top-level resolution is `end_at_k`
- The game has active presses (Match or Sixes with autopress or manual presses)

Each press is an **independent row** with its own Pay/Abandon toggle.
A press's status (Closed / In-progress) is shown alongside its toggle.
Default: **Pay** for Closed and In-progress presses.

Presses with trigger holes beyond `departureHole` (or `lastCompletedHole`)
do not exist as bets — the segment ended before the press could begin —
and are omitted from the resolver sheet entirely. See `Resolver_UI_Spec.md`
§2.4(b) for the rationale.

---

## §7. Game Family Rules

### §7.1 Clinch-segment family: Match and Sixes

A bet (segment or press) is **closed** when one side has mathematically
clinched it — the result cannot change regardless of remaining holes.

**Closed definition:**
Any segment or press of `n` holes is closed when one side has won `h`
  holes such that `h > n - h` — they lead by more holes than their
  opponent has remaining holes to win (standard dormie + 1 rule).
  This applies uniformly to segments of any length:
  - Match Front / Back (9 holes): closed at 5 holes won
  - Match Overall (18 holes): closed at 10 holes won (or dormie + 1)
  - Sixes segment, 6 holes: closed at 4 holes won
  - Sixes segment, 3 holes ("Threes"): closed at 2 holes won
  - Any press: evaluated independently on its own hole range

**Top-level choices for Match and Sixes:**
1. `abandon` — $0 all around
2. `end_at_k` "Pay closed bets only" — closed bets pay full value;
   in-progress and not-started bets → $0 automatically
3. `end_at_k` "Pay closed + in-progress bets" — closed bets pay full value;
   in-progress bets pay to current leader after last played hole; user may
   override individual bets via segment and press pills

**UI representation:**
"Pay closed bets only" and "Pay closed + in-progress bets" are presented
as two distinct top-level pill options — both map to `end_at_k` internally
with different segment/press defaults.

If "Pay closed + in-progress" is selected:
- Segment pills appear: Front, Back, Overall (Match) or Seg0/Seg1/Seg2
  (Sixes) — status badge (Closed ✓ / In progress) + Pay/Abandon toggle
- Press pills appear below: each press as an independent row — status badge
  (Closed ✓ / In progress / Not started) + Pay/Abandon toggle
- All default Pay; user flips individual bets to Abandon as desired

### §7.2 Completion-segment family: Nines, Stableford (segments), Stroke Play (segments)

A segment is **complete** when all holes in the segment have been played.
No clinch mechanic applies — all holes must be played for "complete" status.

- Front half complete: all holes from `startHole` through `midHole - 1` played
  (where `midHole = startHole + floor(rangeLength / 2)` per §3.6)
- Back half complete: all holes from `midHole` through `endHole` played
- Overall complete: `lastPlayedHole >= endHole`

**Nines `perSpread` mode:** No segments — single Pay/Abandon decision
over all played holes.

**Top-level choices:**
1. `abandon` — $0
2. `end_at_k` — compute through last played hole

If `end_at_k` selected, segment pills appear showing status (Complete /
Partial) and Pay/Abandon toggle. Default: Pay for all.

**Partial segment payout rule:** A partial segment pays to the current leader
after the last played hole in that segment's range. The engine math is
identical for complete and partial segments — Pay/Abandon is the user's
decision, not a computed outcome.

### §7.3 Hole-by-hole family: Skins and Dots

No segments. Each hole is independent.

**Skins — $ per hole:**
- `end_at_k`: departed player exits pool at `departureHole`; holes k+1
  onward played among remaining players at the original per-hole rate
- `continue`: same — departed player exits pool for k+1 onward; remaining
  players continue at the same per-hole rate

**Skins — pot:**
- `end_at_k`: pot closes at `departureHole`; settled over holes 0 through k
- `continue`: departed player stays in pot with X scores for remaining holes;
  X always loses; pot settles at `endHole`; departed player contributes to
  pot for remaining holes but wins nothing on them

**Dots:**
- `end_at_k`: departed player's dot entries frozen at `departureHole`;
  payout settled through hole k
- `continue`: remaining players continue earning/owing dots; departed
  player's frozen entries through hole k stand; no new dots after departure

**Top-level choices for Skins and Dots:**
1. `abandon` — $0
2. `end_at_k` — settle through departure hole
3. `continue` — remaining players continue

---

## §8. Long-Press X → Departure Resolver (Proactive Entry)

### §8.1 Trigger

User long-presses X in `ScoreKeypad` for player `i` on hole `h`.

### §8.2 Behavior sequence

1. **No score is written for hole `h`.** The long-press is a pure
   departure-intent gesture, not a score-entry gesture. `scores[h][i]`
   remains whatever it was before the long-press (typically `''`). The
   user enters the hole's score normally afterward if relevant. (See v1.9
   change-log for the rationale behind this rule.)
2. Confirmation prompt appears:
   > "Is [PlayerName] done for the round?"
   Two buttons: **"Cancel"** (dismiss — no further action; hole's score
   remains unchanged; no departure recorded) and **"Yes, [Name] is leaving"**
   (open full per-game resolver).
3. If "Yes": full resolver sheet (§10) appears with `departureHole = h - 1`
   for player `i`. Hole `h` itself is the FIRST locked hole — the player
   did not play it, and the resolver carries the player's last playable
   hole (`h - 1`) as the boundary. Edge case: long-press on hole 0 →
   `departureHole = -1`, all 18 holes lock, sheet still opens (departed
   before any hole was played). **Header copy rule (v2.2):** the resolver
   sheet header reads "[Name] left after hole [departureHole + 1]" in all
   normal cases. When `departureHole < roundStartHole` — i.e. the player
   departed before completing any in-range hole — the header instead reads
   "[Name] left before hole [roundStartHole + 1]". This applies to long-
   press X on the round's first hole in any range: full round
   (`departureHole = -1 < roundStartHole = 0`) or partial round (e.g.
   back-9 round, long-press X on hole 10 → `departureHole = 8 <
   roundStartHole = 9`). Implementation: `DepartureResolverSheet` accepts
   an optional `roundStartHole` prop (default `0`) from `ScorecardPage`.
   See Resolver_UI_Spec.md v1.4 §2.1.
4. On resolver confirm: `earlyDepartureOpts` written to `activeRound`.
   Round continues for other players. Departed player's cells for hole
   `h` and all subsequent holes are locked (display `–`, no input).
5. When "Results →" is tapped later, `payouts.js` uses `earlyDepartureOpts`
   to compute payouts correctly per the resolver decisions.

### §8.3 Post-departure scorecard behavior

After a player is marked as departed:
- Score cells for holes greater than `departureHole` (i.e. hole `h` and
  later, where `h` was the long-press hole) show `–` (gray tinted, fully
  inert — no listeners, no cursor, no tap response)
- The player's name `<td>` in the scorecard grid is visually dimmed
  (color `#999`, opacity 0.55) in both portrait Front/Back halves and
  landscape grid; the dimmed name is the LONG-PRESS TARGET for the undo
  gesture (see §8.4)
- A small hint "hold name to resume" renders in tiny gray text directly
  underneath the dimmed name when in departure state. The hint clarifies
  the gesture target (since the long-press is on the name, not the
  cells) and disappears on undo
- Stored `scores[h][pi]` values for `h >= h_longpress` are NOT
  modified — the visual `–` is rendered by the cell, not stored. If the
  user had entered a score for hole `h` before invoking departure, that
  score is preserved in storage but hidden behind the `–` until undo
- Player still appears in game tables in `RoundSummaryModal`; results
  through `departureHole` shown; subsequent holes show `–`

### §8.4 Undoing a departure

User long-presses (~500ms) the dimmed player name `<td>` in the score
grid. (Locked `–` cells are inert and do not participate in this
gesture; this prevents accidental undo from incidental cell taps and
matches the location of the "hold name to resume" hint underneath the
name.) On long-press fire, an in-app styled modal appears (matching
the visual style of the depart-confirm modal in `ScoreGrid.jsx`) with:

> Title: "Resume scoring for [Name]?"
> Subtitle: "[Name] was marked as departed. Resuming will unlock their
> remaining holes."
> Buttons: **Cancel** (close, no action) / **Yes, resume**

Confirming removes player from `earlyDepartureOpts` and unlocks their
cells; the hint text disappears; name un-dims. Scores at and after
`departureHole` are unchanged by undo (per §8.3 they were never modified
by the departure flow in the first place).

### §8.5 Out-of-order detection (NEW v2.0)

When the user long-presses X on hole `h` for player `B`, the app checks
whether any other player has an `earlyDepartureOpts` entry with
`departureHole >= h - 1`. If yes, the new event would be chronologically
EARLIER than an already-recorded event — out of order.

The "Reorder Departures" modal appears BEFORE the depart-confirm prompt
(§8.2 step 2). Modal copy:

> **⚠ Earlier departure detected**
>
> [B] is leaving at hole [h], which is earlier than [A]'s recorded
> departure at hole [A_dep + 1]. This requires reconfirming all choices.
>
> **[ Cancel ]   [ Reorder Departures ]**

(`A_dep + 1` is the 1-based display of A's `departureHole`. If multiple
players have later departures, the modal mentions the earliest of them.
Phrasing adapts naturally for two or more later events: "earlier than
[A]'s and [C]'s recorded departures at holes [A_dep + 1] and [C_dep + 1]".)

**Cancel:** Modal closes. `scores[h][B]` is unchanged (no score was
written; per §8.2 step 1 long-press X writes nothing). No departure is
recorded. The user remains on the scorecard.

**Reorder Departures:** Proceed to §8.6.

### §8.6 Reorder Departures execution (NEW v2.0)

On Reorder Departures confirm:

1. Identify all "later" events: every `earlyDepartureOpts` entry with
   `departureHole >= h - 1` where `h` is the new event's long-press
   hole. (`h - 1` is the new event's `departureHole` per §8.2 step 3.)
2. Clear `earlyDepartureOpts[pi]` for every later event. Each cleared
   player's locked cells unlock; their dimmed name un-dims; their stored
   `scores` values are unaffected (per §8.3).
3. Open the new event's depart-confirm prompt (§8.2 step 2 — "Is [B]
   done for the round?"). The user can still Cancel here without saving;
   if they Cancel at this point, the cleared events remain cleared (the
   user has effectively undone all departures by canceling — equivalent
   to long-press undo on each name in turn).
4. On "Yes, [B] is leaving": fire the resolver sheet for B's event with
   carry-forward state from any events earlier than B's `departureHole`
   that are still on file (which is none in the typical case — but the
   chain is correct if more complex sequences exist).
5. On B's resolver confirm, write `earlyDepartureOpts[B]`. Then iterate
   through the cleared events in `lastScored` ascending order, firing
   the resolver sheet for each. Each resolver opens FRESH —
   `initialResolutions` is computed from `makeDefaultResolution` per
   game, applying the per-game-family default (§6.1) and the carry-
   forward state from prior events in this chain. Prior selections from
   the cleared events are NOT pre-populated; the user re-enters all
   choices.
6. After all events confirm, the round state is consistent — every
   departed player has a fresh `earlyDepartureOpts[pi]` entry derived
   under the correct chronological order.

**Why no pre-population.** The cleared events were entered when the
chain state was different (e.g., B's later-departure assumed pool games
continued through B's hole; with the new earlier event, pool games may
have ended or reduced subset earlier). Pre-populating prior selections
would either silently drop now-invalid choices or surface confusing UI
hints. The simpler model: clear and replay. Per the v2.0 design
discussion (Q3.3b): "reordering would clear A's initial resolutions, so
B's resolution to continue skins game with remaining players would mean
skins continues for A, C and D. Then for A's later departure, user can
select continue for C & D which means A continued to participate after
B's departure."

**Cancel during the cleared-event resolver chain.** If the user cancels
B's event after entering the new event but before completing the chain,
the in-progress event is dropped. The earlier already-confirmed events
in the chain remain on file. The state is still consistent — partial
chain just means the user stopped before all events were processed and
can resume later (proactively or reactively at Results → time).

### §8.7 Proactive sequenced chain (NEW v2.0)

The previously rare case where a single user gesture creates multiple
new departure events is the Reorder Departures path (§8.6). All other
proactive entry paths fire a single resolver event for the single
player the user just long-pressed on. The sequenced chain is therefore
primarily a reactive-entry concept (§9.3) — the proactive chain logic
in §8.6 is a special case where reordering generates a temporary chain.

---

## §9. Results → Gated Resolver (Reactive Entry)

### §9.1 Trigger

User taps "Results →" with one or more departed players whose
`earlyDepartureOpts` entry is not yet on file (or is on file but not
consistent with the current carry-forward state — see §5.4.5).

### §9.2 Classification

App classifies each player per §5.2. If any player has Missing scores,
Results is blocked with error listing which holes. No resolver shown.
User must return to scorecard and enter missing scores.

### §9.3 Sequenced resolver chain

In v2.0, a single user gesture (Results → tap) may need to fire multiple
resolver sheets — one per unresolved departure event. The chain:

1. Compute the sorted list of "Early departure" players from §5.2.
   Sort by `lastScored` ascending. Players with multiple events at the
   same hole sort stably by player index.
2. Walk the list. For each player `pi`:
   - Apply §5.4.5 skip-when-current rule. If `earlyDepartureOpts[pi]`
     is on file and consistent with carry-forward state from prior
     events in this chain, skip — no resolver, no state change.
   - Otherwise fire the resolver sheet for `pi`. The sheet opens with
     header "[Name] left after hole [departureHole + 1]" (1-based).
     `buildResolverGameRows` is called with carry-forward state from
     prior events: games already abandoned, ended, or excluded for
     `pi` are not shown; remaining games show options per §6.1 with
     defaults from §6.1 and carry-forward subset adjustments.
3. On each sheet's confirm, write `earlyDepartureOpts[pi]` and proceed
   to the next event in the chain.
4. On any sheet's cancel, abort the chain. Already-confirmed events
   remain on file; un-confirmed events are not written. User returns
   to scorecard. They can re-tap Results → later to resume.
5. After the last event confirms, transition to Results page.

**Group-stop side effect:** If every player in `activeRound.activePlayers`
is classified as Early departure (Scenario B per §5.4), the LAST event
in the chain (highest `lastScored`) additionally writes
`lastCompletedHole = highWaterMark` and `earlyEndOpts` derived from
that event's `gameResolutions`. Other events in the chain do not write
these fields. If even one player reaches `roundEndHole` (Scenario A),
`lastCompletedHole` and `earlyEndOpts` are not written.

### §9.4 Sheet header (single-name, v2.0)

Resolver sheet header always names exactly ONE player:

> "[Name] left after hole [departureHole + 1]"

(1-based display.) The multi-name comma-list header from v1.11 is
REMOVED — every sheet shows one player at a time. The
`DepartureResolverSheet` component prop interface is governed by
`Resolver_UI_Spec.md` §2.1 v1.1: the canonical prop is
`departedPlayerName: string` (singular); the v1.0 plural form
`departedPlayerNames: string[]` is retained as a deprecated alias for
backward-compat with 13-C.6 storage shape. When the deprecated alias is
provided, the sheet uses index `[0]` and emits a console warning.

### §9.5 [REMOVED — was multiple departed players in v1.10/v1.11]

The §9.5 of v1.10 ("resolver shows each player's situation as a
separate stacked section with a divider between them") and the §9.5
of v1.11 ("single combined sheet handles all of them via comma-list
header") are BOTH removed in v2.0. Multi-player departure scenarios
are now handled by the sequenced resolver chain (§9.3), with one
sheet per player processed in chronological order.

---

## §10. Resolver Sheet UI

### §10.1 Sheet structure

Bottom sheet modal. Scrollable if content exceeds screen height.
Cancel returns to scorecard unchanged. Confirm writes all fields and
proceeds (in a sequenced chain — see §9.3 — confirm advances to the
next event in the chain rather than directly to Results).

Top-level pill labels permit text wrapping when long ("Continue with
remaining", "Drop [LongName]") rather than truncating with an ellipsis.
Equal pill width preserved via `flex: 1 1 0`; vertical centering keeps
short and long pills aligned in the same row.

Match format affects which segment rows are rendered. Nassau matches
(`betFront > 0` or `betBack > 0`, detected via `isNassauMatch(matchDef)`)
render Front / Back / Total rows. Total matches (neither F nor B bet)
render only the Total row, with all manual presses parented under it.
The user-facing label is "Total" in both contexts; the storage key
remains `'overall'` for backward compatibility with already-saved
gameResolutions.

```
┌─────────────────────────────────────────────┐
│  Dave left after hole 12                    │  ← single-name header (v2.0)
│  How should each game be resolved?          │
│                                             │
│  ── Skins ─────────────────────────────── │
│  [Abandon] [End at hole 13] [Continue *]   │  * = pool default (v2.0)
│  [Drop Dave]                                │
│                                             │
│  ── Match A: Dave vs Alice (Nassau) ─────  │
│  [Abandon] [End at hole 13 *]              │  * = match default; expanded:
│    Front 9   Closed ✓      [Pay] [Abandon] │
│    Back 9    In progress   [Pay] [Abandon] │
│    Total     In progress   [Pay] [Abandon] │
│    Press 1   Closed ✓      [Pay] [Abandon] │
│    Press 2   In progress   [Pay] [Abandon] │
│                                             │
│  ── Nines ──────────────────────────────  │
│  [Abandon] [End at hole 13 *]              │  * = match default
│    Front 9   Complete      [Pay] [Abandon] │
│    Back 9    Partial       [Pay] [Abandon] │
│    Total     Partial       [Pay] [Abandon] │
│                                             │
│  ── Stableford (individual) ────────────  │
│  [Abandon] [End at hole 13] [Continue *]   │  * = pool default (v2.0)
│  [Drop Dave]                                │
│                                             │
│  ── Stroke Play ────────────────────────  │
│  [Abandon] [End at hole 13] [Continue *]   │  * = pool default (v2.0)
│  [Drop Dave]                                │
│                                             │
│  ── Dots ───────────────────────────────  │
│  [Abandon] [End at hole 13] [Continue *]   │  * = pool default
│  [Drop Dave]                                │
│                                             │
│  [     Cancel     ]  [     Confirm     ]   │
└─────────────────────────────────────────────┘
```

The `*` markers in this ASCII denote the default selection per §6.1 —
NOT a UI element rendered to the user. Match-family games default to
`end_at_k`; Pool-family games default to `continue` (v2.0). User can
flip selections; defaults are pre-applied via `makeDefaultResolution`.

The "[Drop Dave]" pill is the v2.0 UI label for `exclude_player`. The
data-model token name is preserved per §4.2.

Note: "Overall" was the term used in v1.9 and earlier. In v1.10 it was
universally renamed to "Total" across all game families for terminology
consistency — "Overall" is awkward for a Total-format Match where there
is no Front/Back to be an "overall of." Storage keys (segKey: 'overall')
preserved unchanged for backward compatibility with already-saved
gameResolutions.

### §10.2 Default selections (v2.0)

Top-level defaults are PER GAME FAMILY (see §6.1):
- **Match-family** (Match/Nassau, Sixes, Nines, Stableford-team):
  default = `end_at_k` ("Pay closed + in-progress")
- **Pool-family** (Skins, Stableford-individual, Stroke Play, Dots,
  Specials): default = `continue`

Segment pills (when shown — only with `end_at_k`): Pay for all
(complete and partial).

Press pills: Pay for Closed and In-progress. Not-started presses are
omitted from the sheet (see §6.3); they do not appear as rows at all.

Defaults are applied by `makeDefaultResolution(gameRow)` per game
based on the game's family classification and segment structure. The
function MUST be updated in 13-C.7 / v2.0 to honor the v2.0 per-family
defaults (was unified `end_at_k` default in v1.10).

### §10.3 Game rows shown

In v2.0 the game rows shown follow the sequenced-event model:
- For each event in the chain, only games the departed player
  participated in are shown.
- Within those games, carry-forward state from prior events further
  filters the list: games already abandoned by an earlier event are
  not shown; games where this player was already excluded by an
  earlier event's `exclude_player` are not shown; games already ended
  by an earlier event with `end_at_k` are not shown for the new event
  (the game ended before this player's departure).
- The v1.10 distinction "Scenario A: only games departed player
  participated in / Scenario B: all active games" is REMOVED. All
  events follow the same per-event game-row rule.

### §10.4 Reusable components

- `BetPillRow` — single row: label + status badge + Pay/Abandon toggle.
  Used for both segments and presses. Status values: Complete / Partial /
  Closed / In-progress / Not-started.
- `GameResolutionRow` — top-level game row: game label + top-level option
  pills + expandable `BetPillRow` list below when `end_at_k` selected.
- `DepartureResolverSheet` — full bottom sheet; composes `GameResolutionRow`
  instances; handles confirm/cancel; scrollable. v2.0 prop migration:
  canonical prop is `departedPlayerName: string` (singular per
  `Resolver_UI_Spec` §2.1 v1.1); v1.0 plural form `departedPlayerNames:
  string[]` retained as deprecated alias. The sheet always renders a
  single departed player.
- `ReorderDeparturesModal` (NEW v2.0 — built in 13-C.7 / v2.0) —
  styled in-app modal matching the depart-confirm modal pattern.
  Buttons: Cancel / Reorder Departures. Body copy per §8.5.

---

## §11. Engine Behavior

### §11.1 Engine firewall — `games.js` and `handicap.js` are never modified

**`games.js` and `handicap.js` are not touched by partial-round features.**

This is a hard architectural rule that protects existing full-round
functionality from any risk of regression.

All range logic, departure handling, and subset pre-processing lives
exclusively in `payouts.js` as a **pre-processing step above the engine
call sites**. The engine functions in `games.js` always receive clean,
complete inputs and are unaware that any range or departure logic exists.

**When `roundStartHole = 0`, `roundNumHoles = 18` (full-round defaults), and no departures exist, the pre-processing step is a complete no-op.** Full rounds pass through unchanged. This is the guarantee that existing functionality is safe.

**Pre-processing responsibilities (all in `payouts.js`):**
- Trim scores array to `[startHole, endHole]` before engine call
- Apply `exclude_player` subset removal before engine call
- Evaluate segment and press closed/complete/in-progress status
- Apply per-segment and per-press Pay/Abandon decisions to engine output
- Skip game block entirely for `abandon` resolution

### §11.2 `abandon` resolution

`payouts.js` skips the game block. Engine function is never called.
All players receive $0 for this game.

### §11.3 `end_at_k` resolution

`payouts.js` trims scores to `[startHole, departureHole]` (Scenario A)
or `[startHole, lastCompletedHole]` (Scenario B) before calling the engine.
Per-segment and per-press Pay/Abandon decisions are applied to the engine
output — abandoned bets produce $0 regardless of result.

### §11.4 `continue` resolution (Pool-family games — universal in v2.0)

In v2.0 the `continue` token applies to all pool-family games: Skins,
Stableford-individual, Stroke Play, Dots, and Specials. v1.10 limited
this to Skins and Dots only.

**Engine pre-processing in `payouts.js`:** the game is computed in two
segments:
1. `[startHole, departureHole]` — full original player subset (all
   players who participated up to the departure point). Pre-departure
   results are computed normally and recorded.
2. `[departureHole + 1, endHole]` — reduced subset (departed player
   removed). Post-departure results are computed under the reduced
   subset and recorded as separate per-segment results.

For Skins specifically, this means skins won pre-departure go to
whoever won them (including potentially the departed player); skins
won post-departure go to the remaining-subset winner. For Dots, dots
earned pre-departure are kept; dots earned post-departure go to the
reduced subset. For Stableford-individual / Stroke Play, the segment
totals are computed independently and the user receives both segment
outputs in their breakdown.

**Implementation status (v2.1, post-13-C.7 device test):**

| Game | Display side (`<Game>Table.jsx`) | Engine side (`payouts.js`) |
|---|---|---|
| Skins | ✅ implemented in 13-C.7 (per-hole eligible-subset partition in `SkinsTable.jsx`) | ⏳ deferred to 13-C.8 |
| Stableford-individual | ⏳ deferred to 13-C.8 | ⏳ deferred to 13-C.8 |
| Stroke Play | ⏳ deferred to 13-C.8 | ⏳ deferred to 13-C.8 |
| Dots | ⏳ deferred to 13-C.8 (entries past `departureHole` are guarded out per invariant 21, but `continue` pre-departure-credit / post-departure-reduced-subset partition is not yet implemented in `DotsTable.jsx`) | ⏳ deferred to 13-C.8 |
| Specials | ⏳ deferred to 13-C.8 | ⏳ deferred to 13-C.8 |

For pool-family games where `continue` is not yet implemented,
selecting `continue` in the resolver records the resolution token but
the rendered output looks like `end_at_k` (game results stop at the
departure hole). No data loss — the resolution is preserved for 13-C.8
to honor when engine support lands. The user-facing wording in the
resolver sheet still describes `continue` accurately ("results to date
are kept; game continues for remaining players"); only the engine
output lags.

The "X always loses" invariant from v1.10 (which was the mechanism for
Skins/Dots `continue` under the pre-existing model where departed
players' X scores stood) is no longer the primary mechanism in v2.0 —
the segment partition handles the post-departure subset cleanly. X
continues to be a valid score per ScoreKeypad_Contract §4.5 but is not
relied on for the `continue` logic. (Stored scores past `departureHole`
for the departed player are ignored by the engine pre-processor under
invariant 21 — see §14.)

### §11.5 `exclude_player` resolution

`payouts.js` removes the departed player from the game's player subset
before calling the engine. The engine receives a complete, valid subset
and is unaware any player was removed. Recompute covers all holes from
`startHole` through `endHole` — fully retroactive from the game's start.

### §11.6 Segment status evaluation — clinch-segment family

For Match and Sixes, `payouts.js` evaluates each segment and press for
closed status before applying Pay/Abandon decisions.

Closed = one side leads by more holes won than holes remaining in that
bet's range (dormie + 1). Each press is evaluated independently.

A closed bet with Pay selected pays its full value.
An in-progress bet with Pay selected pays to the current leader after the
last played hole in its range.

### §11.7 Segment status evaluation — completion-segment family

For Nines, Stableford (segments), Stroke Play (segments):
Complete = all holes in segment played. Partial = some played, some not.

Both complete and partial segments pay to the current leader of their range
when Pay is selected. The engine math is identical — Pay/Abandon is the
user's decision, not a computed outcome.

### §11.8 Press behavior

A press with trigger hole beyond `departureHole` (or `lastCompletedHole`)
does not exist as a bet — the segment ended before the press could begin.
It produces $0 automatically and is omitted from the resolver sheet
entirely.

A press with trigger hole within the effective range is evaluated
independently as Closed or In-progress with its own Pay/Abandon toggle.
A press's status is never derived from or constrained by its parent segment.

### §11.9 Engine departure data guardrail — dual implementation (v2.1)

Per invariant 21, scores stored at `scores[h][pi]` for any hole `h >
earlyDepartureOpts[pi].departureHole` MUST be ignored by all scoring
computations regardless of how they ended up in storage (e.g.,
auto-saved before a long-press X gesture, imported from legacy data,
or written by a co-scorer on a different device before sync). The same
rule applies to dot entries keyed by `${h}_${pi}_${dotId}` in
`dotEntries`.

This invariant is enforced by **two parallel implementations** that
must remain in semantic agreement:

| Site | Helper | Applied by | Reason |
|---|---|---|---|
| Engine pipeline | `applyDepartureGuardrail` (inline in `payouts.js`) | `payouts.js` `computePayouts` | Sole pre-processing step before any `games.js` engine call invoked through `payouts.js` |
| Display pipeline | `applyDepartureGuardrailToScores`, `applyDepartureGuardrailToDotEntries` (in `scorecardUtils.js`) | All seven game tables, `TotalsCard`, `roundUtils.js computePerMatchPayouts`, `roundUtils.js buildShareHtml` | Game tables and round summary helpers call `games.js` / `handicap.js` engine helpers DIRECTLY (bypassing `payouts.js`) for live mid-round display. Without a display-side mirror, mid-round game tables would show stale post-departure score contributions. |

**Rule:** the moment a component reads `scores[h][pi]` for any
aggregation purpose, it MUST first apply the display-side guardrail
(or be downstream of a caller that did). This applies to:

- `SkinsTable.jsx`, `StrokePlayTable.jsx`, `StablefordTable.jsx`,
  `NinesTable.jsx`, `SixesTable.jsx`, `MatchNassauTable.jsx` — apply
  `applyDepartureGuardrailToScores` at the top of the component body
  before any aggregation
- `DotsTable.jsx` — apply `applyDepartureGuardrailToDotEntries` to
  `dotEntries` at the top of the component body
- `TotalsCard.jsx` — apply `applyDepartureGuardrailToScores` before
  computing `grossTotal`
- `roundUtils.js computePerMatchPayouts` — applies an inline copy of
  the guardrail at function entry (no scorecardUtils import to avoid
  circular dependency on `components/ui`)
- `roundUtils.js buildShareHtml` — destructures `earlyDepartureOpts`
  from `ar` and forwards to all embedded table renders; per-half row
  totals in the hand-built scorecard apply the `isPastDeparture(h, pi)`
  predicate inline before summing

**Both helpers MUST be no-ops** when `earlyDepartureOpts` is empty or
absent — the full-round-with-no-departures case must be byte-identical
to pre-13-C.6 rendering. (Tested by ensuring no `early*` reads appear
on the hot path when the input is empty.)

The two implementations must remain in semantic lockstep. If invariant
21's interpretation ever changes (e.g., to honor an `endHole` cap for
non-departed players), both sites must be updated together. Adding a
new game table or a new score-aggregating helper to the codebase
imposes a contract obligation on the author to apply the guardrail in
the new component.

---

## §12. RoundSummaryModal and Share Image

### §12.1 Scorecard display

`ReadOnlyScorecard` (RoundSummaryModal on-screen path) AND the
hand-built scorecard inside `roundUtils.js buildShareHtml` (share-image
path) BOTH show `–` for any hole a given player did not play in the
summarized round:

- **Out-of-round holes** — any hole outside `[roundStartHole, roundEndHole]`.
  Applies to all players identically. Governed by invariant #15(b) — the
  read-only context rule (amended 13-C.3). Live ScoreGrid handles these
  differently per #15(a).
- **Player-specific unplayed holes** — per §5.5:
  - Holes after `lastCompletedHole` (Scenario B)
  - Departed players' holes after their `departureHole` (Scenario A)
  - Holes outside any player's effective range

Round-scoped score totals (F9/B9/Tot) sum only in-round holes; par totals
reflect full 9-hole halves so the printed card layout stays familiar.

### §12.2 Game tables

Each game table renders only columns for holes within its `[startHole, endHole]`
range (§2.4). No structural changes to table components are needed beyond
range-aware column rendering.

A small note below each affected game table is recommended (deferred to
polish session): "Computed over holes 1–[k]" or "Round ended after hole [k]."

**Engine departure data guardrail (v2.1, MANDATORY):** every game
table accepts `earlyDepartureOpts` as a prop (default `{}`) and applies
the appropriate display-side guardrail at the top of the component
body before any aggregation. Specifically:

- `SkinsTable.jsx`, `StrokePlayTable.jsx`, `StablefordTable.jsx`,
  `NinesTable.jsx`, `SixesTable.jsx`, `MatchNassauTable.jsx` — call
  `applyDepartureGuardrailToScores(scores, earlyDepartureOpts,
  players.length)` and reassign `scores`
- `DotsTable.jsx` — call `applyDepartureGuardrailToDotEntries(
  dotEntries, earlyDepartureOpts)` and reassign `dotEntries`

Both helpers live in `scorecardUtils.js` and are no-ops when
`earlyDepartureOpts` is empty. See §11.9 for the dual-implementation
contract.

`ScoreGrid.jsx` and `RoundSummaryModal.jsx` MUST forward
`earlyDepartureOpts` as a prop to every game table they render.
`roundUtils.js buildShareHtml` (share image) MUST destructure
`earlyDepartureOpts` from `ar` and forward it to each `renderToStaticMarkup`
call for the seven game-table components.

---

## §13. Backward Compatibility

All new fields default gracefully when absent:
- `roundStartHole` absent → 0 (start at hole 1)
- `roundNumHoles` absent → 18 (full round)
- `gameRanges` absent → all games use `[roundStartHole, roundEndHole]`
- `earlyDepartureOpts` absent → no departures (normal behavior)
- `earlyDepartureOpts[pi].eventOrder` absent (v1.x records loaded under
  v2.0) → derived at read-time by sorting `earlyDepartureOpts` entries
  on `departureHole` ascending and assigning 0-based indices. No data
  migration needed; v1.x records load identically before and after the
  v2.0 reader change.
- `earlyEndOpts` absent → all games pay out (existing invariant preserved)
- `lastCompletedHole` absent → `roundEndHole` (existing invariant preserved)
- `playerJoinHoles` absent → all players joined at `roundStartHole`

Old saved rounds with none of these fields load and compute correctly.
The engine firewall (§11.1) guarantees full rounds are unaffected.

---

## §14. Invariants

1. A player classified as "Missing scores" never triggers the departure
   resolver. Scattered empty holes are always a data entry problem.
2. `earlyDepartureOpts[i].departureHole` is the last hole the departed
   player actually scored (real or X). It is never a future hole.
3. After a player is marked as departed, their post-departure cells are
   locked. The engine never receives non-empty scores for post-departure holes.
4. Every press is an independent bet with its own Pay/Abandon toggle.
   A press may be open while its parent segment is closed, or vice versa.
   No press inherits its decision from a parent segment.
5. **(v2.0 update)** "X always loses" invariant (ScoreKeypad_Contract
   §4.5) is no longer the primary mechanism for `continue` resolution
   under v2.0. Pool-family `continue` is implemented via segment
   partition in `payouts.js` pre-processing (see §11.4). X continues to
   be a valid score per ScoreKeypad_Contract §4.5 and is preserved end-
   to-end. The invariant that departed players' post-departure scores
   are ignored by the engine (regardless of stored value) is now
   invariant 21 below.
6. Zero-sum payout invariant holds for all games after departure resolution.
7. **(v2.0 update)** Sixes: Match-family per §6.1. Only `abandon` or
   `end_at_k`. Sixes requires exactly 4 players. Range must be divisible
   by 3. Any departure ends the game (per Q3.1 in 13-C.7 / v2.0 design).
8. **(v2.0 update)** Nines: Match-family per §6.1. Only `abandon` or
   `end_at_k`. Nines requires exactly 3 players. Any departure ends the
   game.
9. **(v2.0 update)** `fromActiveRound` / `toActiveRound` faithfully
   round-trip `roundStartHole`, `roundNumHoles`, `gameRanges`,
   `earlyDepartureOpts` (including `eventOrder` field per v2.0),
   `lastCompletedHole`, `earlyEndOpts`, and `playerJoinHoles`.
10. The reactive resolver (Results → gate) and proactive resolver
    (long-press X) produce identical `activeRound` state. Path differs;
    outcome is the same.
11. Engine range `[startHole, endHole]` is always valid:
    `roundStartHole <= startHole < endHole <= roundEndHole`.
12. `playerGameStart = max(game.startHole, player.joinHole ?? roundStartHole)`.
    `playerGameEnd   = min(game.endHole,   player.departureHole ?? roundEndHole)`.
    These are the authoritative effective ranges per player per game.
13. **`games.js` and `handicap.js` engine firewall (relaxed 13-C.3).**
    - (a) `handicap.js` is never modified by partial-round features.
    - (b) `games.js` is never modified by partial-round features **except**
      for two surgical additions: `runMatchNassau` and `calcTeamStablefordTotal`
      each accept one optional trailing `range = { startHole, endHole }`
      argument whose sole purpose is deriving the §3.6 F/B/T midpoint
      internally. When `range` is absent or equal to `{ 0, 17 }`, both
      functions produce byte-identical output to pre-13-C.3 behavior.
      No other engine function accepts range-awareness.
    - (c) All other range logic — trimming, per-game range resolution,
      segment enumeration — lives in `payouts.js` pre-processing layer.
      When `startHole = 0`, `endHole = 17`, and no departures exist, the
      pre-processing layer is a complete no-op.
14. **(v2.0 update)** `exclude_player` is never offered when fewer than
    2 players would remain in the game after removal, and is restricted
    to pool-family games per §6.1 (Skins, Stableford-individual, Stroke
    Play, Dots, Specials). It is not offered for Match-family games
    (Match/Nassau, Sixes, Nines, Stableford-team). Note: the v1.7 and
    earlier 3+ floor was corrected to 2+ in v1.8.
15. **Out-of-round cell display — two contexts (amended 13-C.3).**
    - (a) **Live ScoreGrid (interactive scoring).** Out-of-round score cells
      are **gray and non-interactive**. They display no character content
      (no `–`, no blank, no value). The column header, Par row, and M.Hcp
      row still display their real values in out-of-round columns — only
      the score cell rows are grayed. This applies to both portrait and
      landscape ScoreGrid layouts. Rationale: during live scoring a gray
      cell communicates "not part of this round" unambiguously; a `–`
      could be read as "not yet scored" and invite interaction.
    - (b) **Read-only displays (RoundSummaryModal, History, share image).**
      Out-of-round score cells render `–` in a muted gray cell. Rationale:
      in a retrospective view the user's mental model is "looking back at
      a round," so `–` reads naturally as "this hole was not played."
      Round-scoped totals (F9/B9/Tot) in read-only displays sum only
      in-round holes; par totals reflect full 9-hole halves so the
      printed card stays familiar.
      > **Implementation status (13-C.3 Phase 2A):** RoundSummaryModal
      > and History (which renders via RoundSummaryModal) conform.
      > **Share image (`buildShareImage` in `roundUtils.js`) does NOT
      > yet conform** — it uses module-level `FRONT`/`BACK` constants
      > and ignores `roundStartHole`/`roundEndHole`/`gameRanges`. This
      > is a known deferred polish item (see BUILD_PLAN deferred /
      > deprioritized list). Until fixed, share images of partial rounds
      > render all 18 holes without the `–` treatment specified here.
    - (c) The `–` character is also used for holes a player did not play
      in a departure or resolved-round context (§5.5). The two uses are
      contextually distinguishable from surrounding cells (out-of-round
      affects every player's row identically; departure affects a single
      player's post-departure holes).
16. Sixes segment length = `(endHole - startHole + 1) / 3`. For a full
    18-hole round this equals 6 (existing behavior unchanged).
17. `roundEndHole` is always derived: `roundStartHole + roundNumHoles - 1`.
    It is never stored. All completion checks use this derived value.
18. A game range can never extend beyond the round:
    `game.startHole >= roundStartHole` and `game.endHole <= roundEndHole`.
19. **(NEW v2.0)** Departure events are processed in chronological order.
    `eventOrder` is assigned by sorting on `departureHole` ascending. The
    carry-forward state at event N is the cumulative state of events 0
    through N-1. Resolver UI for event N reflects post-carry-forward
    options and game inclusions per §6.1 and §10.3.
20. **(NEW v2.0)** Group-stop side-effect (Scenario B): if every player
    in `activeRound.activePlayers` is classified as Early departure, the
    LAST event in the chain (highest `lastScored`, equivalently highest
    `eventOrder`) writes `lastCompletedHole = highWaterMark` and
    `earlyEndOpts = lastEventGameResolutions` in addition to its own
    `earlyDepartureOpts[pi]`. No other event in the chain writes these
    fields. If `earlyEndOpts` is set, no `earlyDepartureOpts` entry has
    `departureHole > lastCompletedHole`.
21. **(NEW v2.0; v2.1 amended)** Engine departure data guardrail —
    dual implementation. Any score stored at `scores[h][pi]` for `h >
    earlyDepartureOpts[pi].departureHole` is ignored at compute time
    by both the engine pipeline AND every display-side aggregator,
    regardless of value (numeric, X, or empty). The engine-side
    enforcement lives inline in `payouts.js`. The display-side mirror
    lives in `scorecardUtils.js` (`applyDepartureGuardrailToScores`,
    `applyDepartureGuardrailToDotEntries`) and is applied by every
    game table, `TotalsCard`, `roundUtils.js computePerMatchPayouts`,
    and `roundUtils.js buildShareHtml`. Per §8.3, stored scores past
    the long-press hole are preserved (display-only lock); this
    invariant prevents that preserved data from affecting any computed
    or rendered output. See §11.9 for the dual-implementation contract.
22. **(NEW v2.0)** Reorder Departures detection trigger. When a long-
    press X attempts to record a new departure event with
    `departureHole < max(existing earlyDepartureOpts[*].departureHole)`,
    the Reorder Departures modal (§8.5) is shown. Cancel preserves all
    existing state. Confirm triggers the §8.6 clear-and-replay sequence.
23. **(NEW v2.1)** Round-trip preservation of departure metadata. The
    three fields `earlyDepartureOpts`, `earlyEndOpts`, and
    `lastCompletedHole` MUST round-trip faithfully through all four
    state representations:
    1. `activeRound` blob (camelCase, in localStorage as JSON)
    2. History record (snake_case, in localStorage list)
    3. Setup state (camelCase, returned from `roundLib.toSetupState`)
    4. Share-image input (`ar.earlyDepartureOpts` destructured)
    The three converters `fromActiveRound`, `toActiveRound`, and
    `toSetupState` MUST handle all three fields. Additionally, the
    `NewRoundPage.handleStart` reconstruction path MUST preserve the
    fields when `playerLineupUnchanged` is true and a Back→Setup→Forward
    navigation is in progress, reading them from `initSrc` using
    camelCase keys (matching `toSetupState`'s emission). Without this
    end-to-end round-trip, departure state silently drops when the
    user navigates Back→Setup mid-round, regressing all locked-cell
    displays and resolution decisions. Surfaced and fixed in 13-C.7
    device test.
24. **(NEW v2.1)** Carry-forward source-of-truth. The carry-forward
    state passed to `buildResolverGameRows` for any event MUST be
    derived from `activeRound.earlyDepartureOpts` filtered to entries
    where `eventOrder < currentEvent.eventOrder` and sorted by
    `eventOrder` ascending. The implementation MUST NOT source
    carry-forward from any in-memory chain reference (e.g.,
    `confirmedEventsRef`) that is cleared between chains. Reasoning: a
    proactive long-press X chain (chain N) writes its resolutions to
    `earlyDepartureOpts` and then clears its in-memory ref. If a
    subsequent reactive Results→ chain (chain N+1) sources from the
    in-memory ref, it sees no carry-forward and re-prompts for games
    that chain N already abandoned or ended. `earlyDepartureOpts` is
    the only correct source. Surfaced and fixed in 13-C.7 device test.

---

## §15. Open Items and Deferred Features

| # | Description | Deferred to |
|---|---|---|
| ~~D-1~~ | "Continue as new game" spawn for Stableford individual and Stroke Play — ✅ **CLOSED** (13-C.7 / v2.0): no game spawn needed. v2.0 implements `continue` for ALL pool-family games via segment partition in `payouts.js` pre-processing per §11.4. The pre-departure and post-departure segments are computed under different player subsets within the same game instance — no second game instance is spawned. This delivers the same user-facing semantic as "continue as new game" without the multi-instance complexity. Display-side `continue` partition shipped for Skins in 13-C.7; engine-side and other pool-family display-side deferred to 13-C.8 per §11.4 status table. | 13-C.8 finishes engine + non-Skins display |
| D-2 | Skins $ per hole dynamic pool size per hole under `continue` | 13-C.8 implementation |
| ~~D-3~~ | Multiple departed players resolver layout — ✅ **CLOSED** twice. (13-C.5: handled inline in `Resolver_UI_Spec.md` §6.1 — `departedPlayerNames` is `string[]`; comma-list rendering for `length >= 2`.) (13-C.7 / v2.0 SUPERSEDED close-out: the multi-name-sheet model from v1.10/v1.11 is REMOVED in v2.0. Multi-player departure scenarios are handled by the sequenced resolver chain — one sheet per player, processed in `eventOrder` ascending. Each sheet displays exactly one departed player. See §9.3 + §10.) Device-test confirmed in 13-C.7. | Closed |
| D-4 | "Computed over holes 1–k" note in game tables | Polish session |
| ~~D-5~~ | Scenario A + B combined resolver flow — ✅ **CLOSED** twice. (13-C.5: handled inline in `Resolver_UI_Spec.md` §6.2 — combined case routes through Scenario B logic with `lastCompletedHole` set to lowest `lastScored`.) (13-C.7 / v2.0 SUPERSEDED close-out: the Scenario A+B combined concept is collapsed in v2.0. The sequenced model handles both naturally: events fire in chronological order regardless of whether some, all, or none of the players reach `roundEndHole`. The group-stop side-effect — writing `lastCompletedHole` and `earlyEndOpts` — is fired by the LAST event in the chain only when no player reached `roundEndHole`. See §5.4.4.) Device-test confirmed in 13-C.7. | Closed |
| D-6 | Team Match shorthand play (1v2 after departure) | Future contract amendment |
| D-7 | Mid-round game range picker for in-progress rounds | Sprint after 13-C.4 |
| D-8 | Stableford team `exclude_player` — shorthanded team handling | Future contract amendment |
| D-9 | **Wrap-around rounds** — starting on hole 15 and playing through to hole 5. Considered during 13-C.2. Owner determined use case is rare enough to not justify the cross-layer complexity: new "round sequence" concept in §1A, sequence-based cell navigation, `payouts.js` pre-processing for wrapped score arrays, Sixes/Nassau segment boundary handling. Current validation blocks wrap-around; relaxing it requires a §1A contract amendment. Revisit if real-world demand emerges. | Future session |
| D-10 | **Uneven Sixes segments.** Sixes segment length is derived dynamically as `floor((endHole - startHole + 1) / 3)`, and the range validator enforces divisibility by 3 (`GameConfig.validateGameRange`). This means a 10-hole range is rejected even though a reasonable interpretation would be three 3-hole segments plus one extra hole absorbed into the last segment. Owner decision 13-C.3: validator stays strict. Support for uneven segments would require contract-level decisions about which segment absorbs the remainder, how the chip labels read (still "Front 6 / Middle 6 / Last 6"?), and how the engine's `runSixesSegment` handles non-uniform segment sizes. | Future session |
| D-11 | **Non-Skins pool-family `continue` display partition.** SkinsTable applies the per-hole eligible-subset partition in 13-C.7. StrokePlayTable, StablefordTable, NinesTable (single-game pool form), and DotsTable do NOT yet partition pre/post-departure subsets — they currently render as if `continue` were `end_at_k`. The resolution token is preserved in storage; only the display lags. | 13-C.8 |
| D-12 | **Engine `continue` partition for non-Skins pool-family games.** `payouts.js` does not yet implement the two-segment partition described in §11.4 for Stroke Play, Stableford-individual, Dots, or Specials. The resolution token is honored via the engine departure data guardrail (post-departure scores are zeroed out), which produces the same numerical output as `end_at_k` for these games. Full segment-partition with reduced-subset post-departure recompute is 13-C.8 work. | 13-C.8 |
| D-13 | **`exclude_player` retroactive removal for non-Skins games.** Per §11.5, `exclude_player` should retroactively remove the player from the entire game range. Skins display partition supports this in 13-C.7; engine and other pool-family games do not. | 13-C.8 |
| D-14 | **`RoundSummaryModal` resolution display ribbon.** When a round had departures, the round summary should display which resolution was picked for each game (e.g., "Skins: continue", "Stableford: end at hole 11"). Currently no such display exists. | 13-C.8 |

---

## §16. Known Gaps

| # | Severity | Description |
|---|---|---|
| ~~G-1~~ | ✅ **CLOSED** (13-C.5) | `payouts.js` pre-processing API — see `Resolver_UI_Spec.md` §4. |
| ~~G-2~~ | ✅ **CLOSED** (13-C.5) | `DepartureResolverSheet` / `GameResolutionRow` / `BetPillRow` component props — see `Resolver_UI_Spec.md` §2. |
| ~~G-3~~ | ✅ **CLOSED** (13-C.5) | Clinch detection algorithm for Match/Sixes — see `Resolver_UI_Spec.md` §3. Algorithm is provably equivalent to existing `games.js` closed-bet logic (Nassau §3.2 dormie+1 rule). |
| ~~G-4~~ | ✅ **CLOSED** (13-C.5) | Predetermined range minimum-hole validation rules — see `Resolver_UI_Spec.md` §5. |

---

## §17. Final Rule

If implementation behavior conflicts with this contract, call out the conflict.
The implementation must be corrected. This document defines the truth.
