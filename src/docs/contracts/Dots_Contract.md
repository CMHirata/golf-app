# Dots Contract

_Version 2.5 — April 2026_
_Supersedes: Dots Contract v2.4._
_Changes in v2.5 (13-E): §11 Setup UI heading and references updated. The Dots config panel was extracted from the monolithic `GameConfig.jsx` into `GameConfigDots.jsx` as part of the 13-E dispatcher + Shared file split. `CustomDotAdder` and `DotRow` are now private to `GameConfigDots.jsx` (no longer named exports). The dispatcher `GameConfig.jsx` re-exports shared sub-components (`BetSection`, `PlayerSubsetDropdown`, `PRESS_OPTS`, etc.) from `GameConfigShared.jsx`, so consumers of those names see no API change. Pure reorganization — no behavior change. See `BUILD_PLAN.md` Architectural Decision #26 for the dispatcher + Shared pattern._
_Changes in v2.4 (13-C.3 Phase 2A): §7.5 — generalization note added. `colHeaders` and `matchCols` are no longer Dots-team-mode-specific extensions; the same fields are now emitted by Stroke Play (segments), Stableford (segments — both individual and team), Nines (nassau), and per-match `matchPayouts[]` in Match / Nassau. Canonical shape definition cross-referenced to **Payout Contract §3.2**. Dots-team-mode column labels (Match A/B/C) and row population remain Dots-specific (§7.7); the columnar wire format is shared. Detection rule (`!!entry.colHeaders`) is unchanged from the original Dots-specific design._
_Changes in v2.3: Session 11-M — Team mode payout fix + team-aware DotsTable layout._
_• §1.3 teamMode valid values table updated: `'Match'` → `'Match:{matchId}'` (already_
_  implemented in 11-J; contract now catches up)._
_• §7.6 NEW — Team payout exclusion rule. Pairwise settlement loop is now team-aware._
_  Sixes source: settlement is per-segment; same-team pairs skip settlement for that_
_  segment's dots only. Match source: same-team pairs skip settlement for all 18 holes._
_  Individual mode loop is completely unchanged. `indivDots` accumulation unchanged._
_• §7.7 NEW — Per-match payout breakdown columns. Sixes: Match A/B/C columns + Total._
_  Match source: Match + Total columns. Plain dot count only — no detail string._
_• §7.4 Zero-sum proof updated for partner-exclusion payout._
_• §10.5 NEW — DotsTable team-mode layout spec. Sixes: three Match A/B/C grid blocks_
_  (replaces F9/B9); pivot summary gains A/B/C sub-columns per player. Match source:_
_  F9/B9 blocks unchanged with team label above; pivot gains Team A/Team B header_
_  columns with player-name sub-columns. Individual mode unchanged (§10.6)._
_• §15.6, §15.7 NEW — Team mode payout and table examples._
_Changes in v2.2: `gameOpts.Dots.scoring` renamed to `gameOpts.Dots.grossNetNOL` throughout. Valid values remain `'gross'|'net'` only — `'netofflow'` exclusion unchanged. §3.1, §3.2, §3.3, §8.1, §8.3, §10.4.2 updated._
_Changes in v2.1: Sprint 11-B — Scoring model corrections + UI refinements._
_• §4.1 DOTS_DEF updated — eagle corrected from `par-g >= 2` to `par-g === 2` (exact);_
_  albatross (`par-g === 3`) and condor (`par-g >= 4`, disabled by default) added as_
_  discrete scoring specials. Scoring specials are mutually exclusive per hole per player —_
_  only the highest-priority fires. Priority: ace > condor > albatross > eagle > birdie._
_  `SCORING_SPECIAL_PRIORITY` array in `ScoreGrid.jsx` enforces this._
_• §4.2 `value` field: `kp` name corrected from `KP (par 3s)` to `KP`. Migration shim_
_  added to `roundLib.migrateRecord` for saved rounds with old KP name._
_• §5.2 DotsPopup interaction model updated — tap tile = increment (multi-count rows);_
_  tap count badge = decrement. No minus button. Auto rows show non-interactive locked_
_  tile, no "auto" badge label. All rows same fixed height (44px). Hint shown at bottom_
_  when multi-count dots present: "Tap tile to add · tap count to reduce"._
_• §10.1 DotsTable: wrapped in `GameSection` tile matching other game tables. Summary_
_  section redesigned as pivot table (dot types as rows, players as columns, only rows_
_  where ≥1 player earned dots, totals row with leader highlight). F9/B9 subtotals_
_  scoped to their respective 9 holes only._
_• §10.3 autoMark updated — (a) mutual exclusivity: priority selection across scoring_
_  specials; (b) clears on empty/deleted score (was: only fired on valid score);_
_  (c) re-runs on scoring mode change (`dotsScoringMode` useEffect in ScoreGrid)._
_• §10.4 DotBadge: display gated on `dotsGameActive` — badges do not show when Dots_
_  game is inactive. Cell background highlight removed (PALE_YELLOW token banked)._
_• §11 Setup UI: `×N` multiplier format replaces `$ val` label. Game subtitle updated_
_  to "Specials, Junk". Custom dot edit/delete via swipe-left. `DotRow` extracted as_
_  component (hooks-in-map violation fix)._
_• §12 `restoreDotDefs`: `value` migration step documented._
_• §14 G-10 closed (App_Data_Model_Contract v2.5 updated). G-13 closed (DotsTable built)._
_  New gap: G-14 — Dots subset picker (5-player), blocked pending Sixes 5-player work._
_Status: AUTHORITATIVE_
_All implementation must conform to this contract._
_If code conflicts with this contract, the contract wins._

---

## §0. Rename Reference

This section is the authoritative mapping from old "Specials" identifiers to
new "Dots" identifiers. All implementation must use the new names. Migration
shims in `roundLib.migrateRecord` handle backward compatibility for saved rounds.

| Old identifier | New identifier | Layer |
|---|---|---|
| `'Specials'` (activeGames key) | `'Dots'` | Engine / state |
| `SPECIALS_DEF` | `DOTS_DEF` | `engine/games.js` |
| `getSpecialsPartner` | `getDotsPartner` | `engine/games.js` |
| `specialsPlayers` | `dotsPlayers` | `activeRound` state field |
| `specials[]` | `dots[]` | `activeRound` state field |
| `specEntries` | `dotEntries` | `activeRound` state field |
| `specials_players` | `dots_players` | History record field |
| `specials` | `dots` | History record field |
| `spec_entries` | `dot_entries` | History record field |
| `gameOpts.Specials` | `gameOpts.Dots` | `activeRound` state field |
| `SpecialsCard.jsx` | Deleted | Component (removed) |
| `SpecialsPopup.jsx` | `DotsPopup.jsx` | Component |
| `SpecialsTable.jsx` | `DotsTable.jsx` | Component (new) |
| `Specials_Contract.md` | `Dots_Contract.md` | Document |
| `restoreAutoWhen` | `restoreDotDefs` | `scorecardUtils.js` |
| `'🏅 Specials'` | `'🏅 Dots'` | Payout breakdown label |
| `indivPts` (payout block) | `indivDots` | `payouts.js` local variable |
| `sp.pts` | `sp.value` | All `DotDef` read sites |
| `"Specials"` (UI labels) | `"Dots"` | All user-facing text |
| `team_special_for` (companion key segment) | `team_dot_for` | `dotEntries` key strings |

**Migration shims required in `roundLib.migrateRecord`:**
- `activeGames`: map `'Specials'` → `'Dots'`
- `gameOpts`: move `gameOpts.Specials` → `gameOpts.Dots` if present
- `specialsPlayers` → `dotsPlayers`
- `specials` → `dots`
- `specEntries` → `dotEntries`
- History record fields: `specials_players` → `dots_players`,
  `specials` → `dots`, `spec_entries` → `dot_entries`
- `DotDef.pts` → `DotDef.value` (handled by `restoreDotDefs` at read time;
  also normalised in `migrateRecord` for permanence)
- Companion key segment rename: iterate all `dot_entries` keys and replace
  `team_special_for` → `team_dot_for` in any key containing that segment:

```js
// In migrateRecord, after dotEntries field rename:
if (record.dot_entries) {
  const migrated = {};
  Object.entries(record.dot_entries).forEach(([key, v]) => {
    migrated[key.replace('team_special_for', 'team_dot_for')] = v;
  });
  record.dot_entries = migrated;
}
```

**Parsing sites:** All 5 files that parse `dotEntries` keys detect companion
keys via `parts[2] === 'team'`. This check is **unchanged** — `parts[2]` is
still `'team'` in `"h_pi_team_dot_for_earnerPi"`. Only the key construction
strings change from `team_special_for` → `team_dot_for`.

**Files requiring key construction string update (5 total):**
- `payouts.js` — companion key construction in Dots payout block
- `DotsPopup.jsx` — `compKey` construction in `writeCompanion`
- `DotsTable.jsx` — companion key parsing in cell value computation (new file,
  born with correct name)
- `ScoreGrid.jsx` — `compKey` construction in `autoMark` companion block
- `NewRoundPage.jsx` — companion key iteration in `deleteCustom`

**Shim removal:** Once all saved rounds have been migrated and re-exported
(see Round Lifecycle Contract §8 bulk migration), shims may be removed from
`migrateRecord`. The clean build is then deployed and re-imported rounds
(already in new format) load without shims.

---

**Engine file(s):** `engine/games.js`, `engine/payouts.js`
**Display components:** `pages/tables/DotsTable.jsx` (new), `pages/scorecard/DotsPopup.jsx`
**Removed component:** `pages/tables/SpecialsCard.jsx` — deleted in Sprint 11
**Scorecard wiring:** `pages/scorecard/ScoreGrid.jsx` — `autoMark`, long-press
  popup trigger, compact dot-count indicator
**Setup UI:** `pages/NewRoundPage.jsx` — Dots config section
**Utility:** `pages/scorecard/scorecardUtils.js` — `restoreDotDefs`
**Cross-references:**
- `Handicap_Contract.md` §4 — `scoreForMode`, scoring modes
- `Payout_Contract.md` §7.7 — Dots payout block spec; NOL exclusion rationale
- `App_Data_Model_Contract.md` §5.x — `gameOpts.Dots`, `dots`, `dotEntries`,
  `dotsPlayers` fields (must be updated for v2.0 — see G-10)
- `App_Data_Model_Contract.md` §10 — `buildPayoutArgs` synchronization rule
- `Sixes_Contract.md` §3 — team rotation logic; `getDotsPartner` dependency
- `ARCHITECTURE_FOUNDATIONS.md` §7 — Dots system overview; `restoreDotDefs` gotcha

---

## §1. Overview and Game Identity

### §1.1 Plain-language description

Dots (also called "Junk" or "Specials") is a **per-achievement, dot-based bonus
game** that runs in parallel alongside any other active games. Players earn dots
for specific hole-level accomplishments — aces, eagles, birdies, sandies, polies,
closest-to-pin, chippies, or any custom achievement defined by the user.

Each dot type has a **dollar value per occurrence** (`value` field on the dot
definition). Dots and dollar value are intentionally decoupled in the
user-facing display: the results view shows dot counts only; the payout view
shows dollar amounts. Users never see an intermediate "points" abstraction.

Some dots may be earned multiple times on a single hole (e.g. a double sandy,
or carrying over multiple KPs). Others are inherently single-occurrence per hole
(birdies, polies, chippies). Each dot definition carries a `multi` flag that
controls whether the popup offers a counter or a simple toggle.

Dots accumulate across 18 holes. At end-of-round, every unordered pair of
participating players settles based on their dot-total differential: the
higher-earner collects `|diff| × bet` from the lower-earner for each dot
type's value contribution. This is identical in structure to the Stableford
and Nines `perpoint` payout mechanic.

**Display architecture:**

- **Live scorecard:** A compact dot-count indicator shows each participating
  player's running total raw dot count. Input via long-press popup is unchanged.
- **Game table (`DotsTable`):** A hole-by-hole grid (players as rows, holes as
  columns) showing total dots earned per player per hole. Cells are tappable
  to reveal dot type breakdown. A summary section below the grid shows
  per-player dot counts by type.
- **Payout screen:** Dollar amounts per player. Dot counts not shown here.

Dots supports two participation modes:

- **Individual mode** (default): each player earns dots for their own
  achievements only.
- **Team mode**: when a player earns dots on a hole, their current teammate
  automatically earns Team dots equal to the total count of non-team dots
  the earner earned on that hole. Teams are derived from another active team
  game (Sixes rotation, team Match/Nassau, etc.). Dot counts accumulate
  individually; payout uses the same pairwise differential formula.

Dots has no hole-by-hole settlement. Everything resolves at end-of-round.
Dots has no press mechanic.

### §1.2 Game key (activeGames entry)

The string identifier in `activeGames[]` for this game is: `'Dots'`

This must match exactly what is stored in `activeRound.activeGames`, used
in the `computePayouts()` conditional block, and displayed in game config UI.
A mismatch causes silent non-payout.

**Migration:** Rounds saved before v2.0 store `'Specials'` in `activeGames`.
`roundLib.migrateRecord` maps `'Specials'` → `'Dots'` on read. See §0.

### §1.3 Format variants

Dots has one payout mechanic (pairwise differential) and two participation modes:

| Mode | Description | Configured by |
|---|---|---|
| Individual | Each player earns dots independently | `gameOpts.Dots.teamMode === 'none'` (or absent) |
| Team | Teammate auto-earns one "Team" dot when partner earns any dot; teams sourced from a named team game | `gameOpts.Dots.teamMode` = game key string (e.g. `'Sixes'`, `'Match'`) |

Default: individual mode (`teamMode` absent or `'none'`).

---

## §2. Eligibility and Players

### §2.1 Valid player counts

| Player count | Valid? | Notes |
|---|---|---|
| 1 | Yes (trivially) | No opponents — no payout movement, but no engine error |
| 2 | Yes | One pairwise comparison |
| 3+ | Yes | All unordered pairs settle |

No minimum or maximum enforced by the engine. The payout block fires for any
non-empty participating player set.

### §2.2 Subset support

Yes — Dots operates on an optional subset of player indices.

- **State field:** `activeRound.dotsPlayers` — type: `number[]`; `[]` means
  **all active players participate** (not "no players").
- **History record field:** `dots_players` — mapped by `roundLib.fromActiveRound`
- **`buildPayoutArgs` key:** `dotsPlayers` — passed as top-level field
- **Engine usage:** resolved in payout block as
  `dtIdxs = dotsPlayers?.length ? dotsPlayers : players.map((_, i) => i)`

**Subset picker trigger:** `PlayerSubsetChips` is rendered in NewRoundPage when
`players.length > 2` AND `teamMode === 'none'` (or absent). In team mode, all
players must participate — see §2.3.

**Subset affects:**
- Which players appear in `DotsTable` rows
- Which players are eligible for the long-press dots popup in `ScoreGrid`
- Which players trigger `autoMark` on score entry in `ScoreGrid`
- Which players participate in end-of-round payout settlement
- Which players appear in the compact scorecard dot-count indicator

**Subset is fixed at:** Round creation (setup screen). Changing subset
mid-round is undefined behavior.

### §2.3 Team mode — subset constraint

When `teamMode` is any value other than `'none'`:

- **All team-game participants must be in the Dots subset.** The general
  subset picker is hidden.
- **`dotsPlayers` is auto-set** when the user selects a team mode in the
  setup UI. It is populated with exactly the indices of the players
  participating in the source team game:
  - `teamMode = 'Sixes'`: indices derived from `sixesTeams[0]` and `sixesTeams[1]`
    — the four players `[t0.a, t0.b, t1.a, t1.b]` deduplicated and sorted.
    If either team pair is not yet configured (null), falls back to `[]` (all players).
  - `teamMode = 'Match'`: indices derived from the first team-format matchDef —
    `[...teamA, ...teamB]` deduplicated and sorted.
    If no team match exists, falls back to `[]`.
- **`dotsPlayers` is cleared** (set to `[]`, meaning all players) when the
  user returns to `teamMode = 'none'`.
- Non-participating players must not appear in `DotsTable`, must not be
  eligible for the dots popup, and must not participate in payout settlement.
  This is enforced via subset filtering in `DotsTable`, `ScoreGrid.startLongPress`,
  and `ScoreGrid.autoMark`.

### §2.4 Multi-instance support

No. There is exactly one Dots game per round. `activeGames` may contain
`'Dots'` at most once. The payout block fires once.

### §2.5 Team mode source games

`gameOpts.Dots.teamMode` holds the key of the team game whose team assignments
drive partner lookup. Valid values:

| Value | Meaning |
|---|---|
| `'none'` (or absent) | Individual mode — no team partner auto-earn |
| `'Sixes'` | Teams follow Sixes 3×6 rotation via `getDotsPartner` |
| `'Match:{matchId}'` | Teams follow the team Match identified by `matchId`; `teamA`/`teamB` fixed for all 18 holes |
| _(future team games)_ | Any team game added in the future is eligible if it provides a partner-lookup path |

**`teamMode` format note:** The value `'Match:{matchId}'` was finalised in
session 11-J (`App_Data_Model_Contract.md` v3.0 §5.5). Code that reads
`teamSource` must use `teamSource.startsWith('Match:')` to detect Match
mode, and `teamSource.slice(6)` to extract the `matchId`. The legacy value
`'Match'` (without ID) is handled by the migration shim in
`roundLib.migrateRecord`.

**UI rule:** The team mode selector in NewRoundPage must enumerate only
team-format games that are currently active in the round:
- `'Sixes'` appears only if `activeGames.includes('Sixes')`.
- `'Match:{matchId}'` options appear only if `activeGames.includes('Match / Nassau')` AND at
  least one `matchDef` in `matches[]` has `format === 'team'`; one option per
  qualifying match, labelled by array-index letter (Match A, Match B, …).
- If no qualifying team games are active, the selector is hidden and Dots
  operates in individual mode only.
- The selector must default to `'none'` if the previously stored `teamMode`
  value refers to a game that is no longer active.

---

## §3. Scoring

### §3.1 Scoring modes supported

| Mode | Supported | Scope |
|---|---|---|
| `gross` | Yes | Auto-mark detection threshold only (default) |
| `net` | Yes | Auto-mark detection threshold only |
| `netofflow` | **No** | Intentionally excluded — see §3.2 |

`gameOpts.Dots.grossNetNOL` controls **only the score value used for auto-mark
threshold detection** (birdie/eagle/ace in `ScoreGrid.autoMark` and
`DotsPopup.suggest`). It has **no effect on payout math** — payout is always
dot-count-based regardless of scoring mode.

### §3.2 NOL exclusion rationale

`'netofflow'` is intentionally excluded from `grossNetNOL` because auto-mark
detection is a per-hole achievement test (`"did this player make a birdie?"`)
that compares a single score against par. Net-off-low strokes require the
group minimum handicap as a reference point, making the detection threshold
vary across players in a way that is unintuitive and rarely meaningful for
dots purposes. Any stored value other than `'net'` is treated as `'gross'`
(defensive fallback).

### §3.3 Score used for auto-mark

When `grossNetNOL === 'net'`:
```
effectiveScore = scoreForMode(gross, courseHcps[pi], hcps[h], minCourseHcp, 'net')
```
This is computed in both `ScoreGrid.autoMark` and `DotsPopup.suggest`
identically. See Handicap Contract §4.1 for `scoreForMode` definition.

When `grossNetNOL === 'gross'` (or any other value): `effectiveScore = gross`.

### §3.4 Handicap application to payout

None. Payout is purely dot-count-based. Course handicaps and scoring mode have
no effect on the dollar settlement calculation.

---

## §4. Dot Definitions

### §4.1 DOTS_DEF — canonical list

`DOTS_DEF` in `engine/games.js` is the single source of truth for all
built-in dot types. It is an ordered array of dot definition objects.
`SPECIALS_DEF` is a backward-compat alias pointing to `DOTS_DEF`.

| # | id | name | value | enabled | auto | multi | autoWhen |
|---|---|---|---|---|---|---|---|
| 1 | `ace` | Ace | 5 | yes | yes | no | `g === 1` |
| 2 | `condor` | Condor | 5 | **no** | yes | no | `par - g >= 4` |
| 3 | `albatross` | Albatross | 4 | yes | yes | no | `par - g === 3` |
| 4 | `eagle` | Eagle | 3 | yes | yes | no | `par - g === 2` |
| 5 | `birdie` | Birdie | 1 | yes | yes | no | `par - g === 1` |
| 6 | `sandy` | Sandy | 1 | yes | no | **yes** | — |
| 7 | `polie` | Polie | 1 | yes | no | no | — |
| 8 | `kp` | KP | 1 | yes | no | **yes** | — |
| 9 | `chippie` | Chippie | 1 | yes | no | no | — |
| 10 | `team` | Team | 1 | yes | no | **yes** | — |

**Scoring specials are mutually exclusive per hole per player:**
Ace, condor, albatross, eagle, and birdie are in competition — only the
highest-priority one fires per hole per player. Priority order (highest first):
`ace > condor > albatross > eagle > birdie`. This is enforced in
`ScoreGrid.autoMark` via the `SCORING_SPECIAL_PRIORITY` array and a
first-match selection. Examples:
- Hole-in-one on par 3 (`g=1, par=3`): ace fires; eagle and birdie do not.
- Score of 2 on par 5 (`par-g=3`): albatross fires; eagle and birdie do not.
- Score of 3 on par 5 (`par-g=2`): eagle fires; birdie does not.
- Score of 4 on par 5 (`par-g=1`): birdie fires only.

**Condor is disabled by default** (`enabled: false`). It can be enabled
in the Dots setup screen like any other dot.

**`value` field semantics:** Dollar value per dot occurrence. An eagle is worth
$3 per dot; one eagle earned = 1 dot × $3 = $3 payout contribution. The user
sees "1 dot" on the results table; the payout screen derives $3 from
`dotCount × value`. These two numbers are intentionally shown on separate
screens to avoid confusion.

**`multi` rationale:**
- `sandy` — double sandy (two bunkers) is a common variant
- `kp` — carryover rule means a player can hold multiple KPs simultaneously
- `team` — a partner can receive multiple Team dots on one hole (one per
  non-team dot the earner earned on that hole)
- All scoring specials (ace/condor/albatross/eagle/birdie) are always
  single-occurrence per hole due to mutual exclusivity rule above

The `team` dot (entry #10) is auto-awarded to a teammate when team mode is
active. It is visible in `DotsTable` when team mode is active and at least
one player has a Team count > 0. It is hidden from the popup and from the
setup dots list — it is engine-managed, not user-configurable.

### §4.2 Dot definition object shape

```js
{
  id:       string,      // unique identifier; built-ins use short names; custom use 'c_${timestamp}'
  name:     string,      // display name
  value:    number,      // dollar value per dot occurrence; 1–10 for all dots (built-in and custom)
  enabled:  boolean,     // whether this dot type is active for the current round
  auto:     boolean,     // whether auto-mark is supported (ace/eagle/birdie only)
  multi:    boolean,     // whether multiple can be earned on a single hole
  autoWhen: function,    // (effectiveScore, par) => boolean; present only on auto dots
                         // STRIPPED BY JSON — must be restored via restoreDotDefs()
}
```

**`value` field notes:**
- Renamed from `pts` in v2.0. All read sites must use `sp.value`, not `sp.pts`.
- Backward compatibility: `restoreDotDefs` migrates `pts → value` for rounds
  saved before v2.0. See §12 for the full migration rule.
- Custom dots: set by the user via the "$ value per dot" input in the
  custom dot adder; defaults to `1`.

**`multi` field notes:**
- Present on all built-in dots (see §4.1 table).
- Custom dots: set by the user via "Allow multiples per hole" toggle;
  defaults to `true`.
- If absent on an old round (pre-v1.1), `restoreDotDefs` restores it from
  `DOTS_DEF` for built-ins, or defaults to `true` for custom dots.

### §4.3 Per-round `dots[]` list

At round setup, a copy of `DOTS_DEF` is made (with `autoWhen` functions
intact at that moment) and stored as `activeRound.dots`. The user may:
- Toggle individual dots enabled/disabled
- Edit `value` for any dot (1–10)
- Add custom dots (see §4.4)
- Delete custom dots (see §4.4)

Built-in dots (`id` does not start with `c_`) may have `enabled` and
`value` edited but may **not** be deleted from the list.

### §4.4 Custom dots

Custom dots are user-created entries appended to the `dots[]` list.

**Identification:** `id` starts with `'c_'` (e.g. `'c_1714000000000'`).

**Creation UI:** A text input + value input + "Allow multiples" toggle + "Add"
button below the dots list in NewRoundPage. Custom dots are always
`auto: false`. The "Allow multiples" toggle defaults to `true`.

**Value constraint:** 1–10, same as built-in dots.

**`multi` field:** Set by the user at creation time. Defaults to `true` if
absent (backward compatibility for pre-v1.1 custom dots).

**Edit:** Any custom dot may have its `name`, `value`, and `multi` edited
in the setup UI. A pencil/edit affordance is shown for custom dots only.

**Delete:** Any custom dot may be deleted from the setup UI. A trash/delete
affordance is shown for custom dots only.

**Delete scope:** Deletion removes the dot from the current setup state
(`golf_round_setup_v5`). If a round is already in progress:
- The dot is removed from `activeRound.dots`.
- Any existing `dotEntries` keyed to that dot's `id` are **not** retroactively
  scrubbed. They are ignored at payout time (`ens.find` returns `undefined`).
- Forward-looking: the dot will not appear in future round setups.

**Persistence:** Custom dots persist in `golf_round_setup_v5` between sessions.
They appear pre-loaded in the next round's setup.

**Export/import:** The `dots[]` array is part of the round record and travels
with it through export/import. `restoreDotDefs` correctly handles custom dots —
no `autoWhen` is attached (always `auto: false`). `multi` defaults to `true`
if absent.

### §4.5 Multi-count rules

The `multi` flag controls popup interaction and has no effect on payout math
(payout always multiplies `value × count`).

| `multi` | Popup behaviour | Entry value |
|---|---|---|
| `false` | Tap row = toggle (0 or 1). No counter shown. | `1` or absent |
| `true` | Tap label/badge = increment count. `−` button decrements. Count badge shows current value. | integer ≥ 1, or absent |

**Auto dots** (`auto: true`) are always single-occurrence per hole
(`multi: false`) and are write-only from the popup — they show when earned
but have no toggle or decrement control. Users cannot manually remove an
auto-marked dot.

**Auto overrides multi:** When `sp.auto === true`, the popup always renders
the locked row type regardless of the stored `multi` value. See §13 invariant 15.

---

## §5. dotEntries — the Earnings Ledger

### §5.1 Key format and value

`dotEntries` is a flat object stored in `activeRound.dotEntries`. Each entry
records how many times a dot type was earned by one player on one hole.

**Standard entry key:**
```
"${holeIndex}_${playerIndex}_${dotId}"
```
Example: `"4_2_kp"` — player 2 earned a KP on hole 4 (0-based).
Example: `"4_2_kp"` with value `2` — player 2 earned two KPs on hole 4.

**Team companion entry key:**
```
"${holeIndex}_${partnerIndex}_team_dot_for_${earnerIndex}"
```
Example: `"4_3_team_dot_for_2"` — written when player 2 earns dots
on hole 4 and player 3 is the teammate.

**Detection:** All parsing sites identify companion keys via `parts[2] === 'team'`
after splitting on `'_'`. This check is stable — `parts[2]` is `'team'` in both
the old `team_special_for` and new `team_dot_for` formats. Old keys stored in
saved rounds are migrated by `roundLib.migrateRecord` on first read. See §0.

**Entry value:** A **positive integer** (count). Absent key = not earned.
There is no `false` value and no `0` value — entries at 0 are deleted.

**Backward compatibility:** Old rounds (pre-v1.1) stored `true` instead of
an integer. All code that reads entry values must use the `entryCount` helper:

```js
const entryCount = v => typeof v === 'number' ? v : (v === true ? 1 : 0);
```

This helper is defined locally in `payouts.js`, `DotsPopup.jsx`,
`DotsTable.jsx`, and `ScoreGrid.jsx`. It is not exported from a shared
module (intentional — each file needs it independently for clarity).

**Key format immutability:** All parsing code relies on fixed positional
segments: `parts[0]` = hole index, `parts[1]` = player index, `parts[2]`
= id start (either a dot id or `'team'` for companion keys). The key
format **must not change** without updating every parsing site simultaneously.
See §13 invariant 14.

### §5.2 Entry creation

**Manual via DotsPopup:** User long-presses a score cell → popup opens.
Three row types depending on dot definition. All rows have fixed height (44px).

1. **Auto dots** (`sp.auto === true`): Displayed as earned (locked green tile)
   when `autoWhen` fires. Not shown when not earned. Non-interactive — users
   cannot manually toggle or decrement. No "auto" badge label.

2. **Multi-count dots** (`sp.multi === true`, `sp.auto === false`): Tapping
   the tile row increments the count. A count badge on the right shows the
   current value (0 when not earned, green when > 0). Tapping the count badge
   decrements. Reaching 0 removes the entry.
   Hint shown at bottom when any multi-count dots are present:
   _"Tap tile to add · tap count to reduce"_

3. **Single-count dots** (`sp.multi === false`, `sp.auto === false`): Tap
   the tile row to toggle between earned (count = 1) and not earned (absent).

**Row layout (all types):** Dot name followed immediately by `×N` multiplier
in smaller subdued type (e.g. "Birdie ×1"). No dollar value shown in popup.
No radial button indicator. Earned tiles highlighted with green background and border.

The `team` dot is hidden from the popup entirely — it is engine-managed.

**Auto-mark:** `ScoreGrid.autoMark` fires when a score is entered **or deleted**.
For scoring specials (ace/condor/albatross/eagle/birdie): mutual exclusivity
enforced — only the highest-priority qualifying special fires; all others are
cleared. For non-scoring auto dots: each fires independently. All auto entries
are cleared when the score cell is empty. Only players in `dotsPlayers` trigger
auto-mark.

**Auto-mark on scoring mode change:** A `useEffect` in `ScoreGrid` watches
`gameOpts.Dots.grossNetNOL` and re-runs `autoMark` for all scored cells when
the mode changes (gross ↔ net). This ensures badges stay accurate when the
user changes scoring mode in setup without re-entering scores.

**Disabled dots:** A dot toggled off (enabled: false) mid-round is treated
identically to a deleted dot at both display and payout time. Existing
`dotEntries` for a disabled dot are not scrubbed — they are ignored because
`ens = dots.filter(s => s.enabled)` excludes them.

**Team companion write:** When team mode is active and any entry changes,
the companion entry is recomputed and written atomically. See §5.3.

### §5.3 Team companion entry — count and anti-circular rule

When team mode is active, after **any** change to a player's entries on a hole
(increment, decrement, toggle, or auto-mark), the companion entry is fully
recomputed and set atomically:

```js
function calcCompanionCount(hole, pi, entries, ens) {
  let total = 0;
  Object.entries(entries).forEach(([key, v]) => {
    const cnt = entryCount(v);
    if (!cnt) return;
    const parts = key.split('_');
    if (parseInt(parts[0]) !== hole || parseInt(parts[1]) !== pi) return;
    if (parts[2] === 'team') return;  // exclude team entries — anti-circular
    const sp = ens.find(s => s.id === parts[2]);
    if (sp) total += cnt;
  });
  return total;
}
```

The companion key is set to this total (or deleted if total = 0):
```js
const compKey = `${hole}_${partnerIdx}_team_dot_for_${pi}`;
if (newCount > 0) entries[compKey] = newCount; else delete entries[compKey];
```

**Anti-circular rule:** Companion count computed from **non-team entries only**.
This prevents circular accumulation when both teammates earn dots on the same hole.

**Payout accumulation:** Companion entry keys split to `id = 'team'` which
matches the `'team'` entry in `DOTS_DEF` (value: 1). Accumulation:
`indivDots[pi] += 1 * count`.

**Deletion recompute (G-12, closed):** When a custom dot is deleted via
`deleteCustom` in `NewRoundPage`, companion entries in `activeRound.dotEntries`
are immediately recomputed. See full spec in prior version; behavior unchanged.

### §5.4 Entry removal

- **Multi-count:** Tapping `−` at count 1 removes the entry. At count > 1
  decrements. Companion recomputed per §5.3.
- **Single-count:** Tapping the row when on removes the entry. Companion
  recomputed per §5.3.
- **Auto dots:** No removal path from the popup. Entries are cleared only
  when `autoMark` re-evaluates and the condition no longer fires.

---

## §6. Dot Accumulation

### §6.1 Individual dots per player

```js
const entryCount = v => typeof v === 'number' ? v : (v === true ? 1 : 0);

const indivDots = players.map(() => 0);
Object.entries(dotEntries || {}).forEach(([key, v]) => {
  const cnt = entryCount(v);
  if (!cnt) return;
  const parts = key.split('_');
  const pi    = parseInt(parts[1]);
  // Companion key: "h_pi_team_dot_for_X" → id = 'team'
  // Standard key:  "h_pi_someId"          → id = parts[2]
  const id    = parts[2] === 'team' ? 'team' : parts[2];
  const sp    = ens.find(s => s.id === id);
  if (sp && players[pi]) indivDots[pi] += sp.value * cnt;
});
```

Companion entries have `id = 'team'` which matches the `'team'` entry in
`DOTS_DEF` (value: 1). The count value is the integer stored by
`calcCompanionCount` — so if a player received 3 team dots on a hole,
`indivDots[pi] += 1 * 3`.

### §6.2 Accumulation scope

`indivDots` is indexed over all round players (length = `players.length`),
not just subset players. Subset filtering happens at payout settlement time.

**Non-subset player accumulation:** In team mode, a player not in `dotsPlayers`
may still receive companion entries. Their `indivDots` will be non-zero but
they are excluded from the payout settlement loop (`dtIdxs` filter). These
are phantom accumulations with no financial effect. See v1.3 for full rationale.

---

## §7. Payout

### §7.1 Bet unit

`gameOpts.Dots.bet` — dollars per dot of differential. Type: `number`.
Default: `0`.

When `bet === 0`, payout math still executes but no money moves. `breakdown`
is still pushed with `net: 0` for all players.

### §7.2 Payout formula — pairwise differential (individual mode)

When `isTeamMode === false`, for every unordered pair `(i, j)` where `i < j`
and both `i` and `j` are in `dtIdxs`:

```
diff = indivDots[i] − indivDots[j]
if diff > 0:  gb[players[i].name] += diff * bet
              gb[players[j].name] -= diff * bet
if diff < 0:  gb[players[j].name] += |diff| * bet
              gb[players[i].name] -= |diff| * bet
if diff == 0: no movement
```

**Example** (4 players, `bet = $1/dot`):

```
Setup: Individual mode, bet = $1/dot
Alice: 2 birdies (value=$1) + 1 sandy (value=$1) = 5 indivDots
Bob:   1 eagle (value=$3) = 3 indivDots
Carol: 0
Dan:   1 ace (value=$5) + 1 birdie (value=$1) + 1 sandy (value=$1) = 7 indivDots

Dan vs Alice:   diff=2 → Dan +$2,   Alice -$2
Dan vs Bob:     diff=4 → Dan +$4,   Bob   -$4
Dan vs Carol:   diff=7 → Dan +$7,   Carol -$7
Alice vs Bob:   diff=2 → Alice +$2, Bob   -$2
Alice vs Carol: diff=5 → Alice +$5, Carol -$5
Bob vs Carol:   diff=3 → Bob   +$3, Carol -$3

Final: Dan +$13, Alice +$5, Bob -$3, Carol -$15. Sum = $0 ✓
```

### §7.3 indivDots accumulation — unchanged in all modes

The accumulation pass that builds `indivDots` is **identical in individual and
team modes**. It iterates all `dotEntries` and sums value-weighted counts per
player:

```js
const indivDots = players.map(() => 0);
Object.entries(dotEntries || {}).forEach(([key, v]) => {
  const cnt  = entryCount(v);
  if (!cnt) return;
  const parts = key.split('_');
  const pi    = parseInt(parts[1]);
  const id    = parts[2] === 'team' ? 'team' : parts[2];
  const sp    = ens.find(s => s.id === id);
  if (sp && players[pi]) indivDots[pi] += (sp.value ?? sp.pts ?? 1) * cnt;
});
```

Team mode changes **only the pairwise settlement loop** (§7.6), never the
accumulation pass. This invariant must not be broken.

### §7.4 Zero-sum proof

**Individual mode:** For each pair (i, j): contribution = `+diff − diff = 0`.
Sum over all pairs = 0. ✓

**Sixes team mode (partner exclusion):** For each Sixes segment, settlement
runs only over opponent pairs for that segment. For each such pair the
per-segment differential is `+segDiff − segDiff = 0`. Summing three segments
of zero-sum contributions = 0. Partner pairs contribute nothing (skipped).
Total sum = 0. ✓

**Match team mode (partner exclusion):** The loop runs only over cross-team
pairs. For each cross-team pair the contribution is `+diff − diff = 0`. Partner
pairs (same team) are skipped entirely. Total sum = 0. ✓

### §7.5 Breakdown format

```js
{
  game: '🏅 Dots',
  colHeaders: colHeaders,   // string[] — see §7.7; absent in individual mode
  rows: dtPlayers.map((p, ii) => ({
    name:      p.name,
    detail:    '',           // always empty — dot counts belong in DotsTable
    net:       gb[p.name] || 0,
    matchCols: [...],        // number[] — see §7.7; absent in individual mode
  })).sort((a, b) => b.net - a.net),
}
```

The `detail` field is always an empty string in all modes. Dot counts belong
in `DotsTable`, not the payout breakdown.

**Dots-specific `colHeaders` / `matchCols` usage:** In team mode, Dots emits
the columnar shape — `colHeaders: ['Match A', 'Match B', 'Match C', 'Total']`
(3-match team mode) or `['Match', 'Total']` (single-match team mode). In
individual mode, both fields are absent (not set to `null` or `[]`).

**Note (13-C.3 Phase 2A — generalization):** `colHeaders` and `matchCols` are
no longer Dots-team-mode-specific extensions. The same fields are now emitted
by Stroke Play (segments mode), Stableford (segments mode, both individual
and team), Nines (Nassau/segments mode), and per-match `matchPayouts[]` in
Match / Nassau. The canonical shape definition lives in
**Payout Contract §3.2**. Dots-team-mode column labels and row population
remain Dots-specific (§7.7), but the columnar wire format is shared.

Display consumers detect columnar entries via `!!entry.colHeaders` (the
detection rule is also unchanged from the original Dots-specific design).

### §7.6 Team payout exclusion rule (NEW — v2.3)

When `isTeamMode === true`, the pairwise settlement loop is team-aware.
**`indivDots` accumulation is unchanged** (§7.3). Only the settlement loop
changes.

#### §7.6.1 Sixes source (`teamSource === 'Sixes'`)

Settlement is computed **per Sixes segment**. The three segments are:

| Segment | Holes (0-based) | Label |
|---|---|---|
| Seg 0 | 0–5 | Match A |
| Seg 1 | 6–11 | Match B |
| Seg 2 | 12–17 | Match C |

**Step 1 — compute `segDots[pi][seg]`:**

For each player `pi` in `dtIdxs` and each segment `seg ∈ {0,1,2}`:
iterate `dotEntries` and sum value-weighted counts where
`parseInt(parts[0])` falls within the segment's hole range
(`seg*6` through `seg*6+5` inclusive):

```js
const SEG_HOLES = [[0,1,2,3,4,5],[6,7,8,9,10,11],[12,13,14,15,16,17]];
const segDots = players.map(() => [0, 0, 0]);   // [pi][seg]
Object.entries(dotEntries || {}).forEach(([key, v]) => {
  const cnt   = entryCount(v); if (!cnt) return;
  const parts = key.split('_');
  const pi    = parseInt(parts[1]);
  const id    = parts[2] === 'team' ? 'team' : parts[2];
  const sp    = ens.find(s => s.id === id);
  if (!sp || !players[pi]) return;
  const h     = parseInt(parts[0]);
  const seg   = sixesSegForHole(h);
  segDots[pi][seg] += (sp.value ?? sp.pts ?? 1) * cnt;
});
```

**Step 2 — settle per segment, accumulate into `gb` and `gbSeg`:**

Two accumulators run in parallel:
- `gb` — the overall net per player (used for `bank` and `row.net`)
- `gbSeg[seg]` — per-segment net per player (used for `matchCols` in §7.7.1)

```js
const gbSeg = [initBank(players), initBank(players), initBank(players)];

for (let seg = 0; seg < 3; seg++) {
  for (let ii = 0; ii < dtIdxs.length; ii++) {
    for (let jj = ii + 1; jj < dtIdxs.length; jj++) {
      const ei = dtIdxs[ii], ej = dtIdxs[jj];
      if (!players[ei] || !players[ej]) continue;
      // Skip if partners in this segment
      if (getDotsPartner(ei, seg, sixesTeams, players) === ej) continue;
      const diff = segDots[ei][seg] - segDots[ej][seg];
      if (diff > 0) {
        gb[players[ei].name]        += diff * dolPt;
        gb[players[ej].name]        -= diff * dolPt;
        gbSeg[seg][players[ei].name] += diff * dolPt;
        gbSeg[seg][players[ej].name] -= diff * dolPt;
      } else if (diff < 0) {
        gb[players[ej].name]        += (-diff) * dolPt;
        gb[players[ei].name]        -= (-diff) * dolPt;
        gbSeg[seg][players[ej].name] += (-diff) * dolPt;
        gbSeg[seg][players[ei].name] -= (-diff) * dolPt;
      }
    }
  }
}
```

`gbSeg[seg]` contains every player key (initialised to 0 by `initBank`), so
reads like `gbSeg[0][players[ei].name]` are always safe.

**Important:** Two players who are partners in one segment but opponents in
another will settle for the other segment(s) only. With a standard 4-player
Sixes rotation every pair is partners in exactly one segment and opponents
in the other two.

**Implementation note:** `getDotsPartner` is the renamed export of
`getSpecialsPartner` from `games.js`. Both names remain valid during
migration; prefer `getDotsPartner`.

#### §7.6.2 Match source (`teamSource.startsWith('Match:')`)

The team assignment is fixed for all 18 holes. Partner relationship does not
change per hole or segment.

1. For each unordered pair `(ei, ej)` in `dtIdxs`:
   - Call `getMatchTeamPartner(ei, matches)`.
   - If the result equals `ej`: **skip** — they are partners; no settlement.
   - Otherwise: apply the standard differential using full-round
     `indivDots[ei]` and `indivDots[ej]`:
     ```
     diff = indivDots[ei] − indivDots[ej]
     apply differential as in §7.2; accumulate into gb only (no gbSeg)
     ```

**Note on `matchId`:** The value `teamSource.slice(6)` extracts the `matchId`
from the stored `teamMode` string. The current implementation of
`getMatchTeamPartner(piNum, matches)` in `games.js` finds the **first
team-format match** in `matches[]` and does not accept a `matchId` parameter.
This is correct in practice because only one match can serve as the Dots team
source at a time (enforced by the single `teamMode` field). The `matchId` is
not passed to `getMatchTeamPartner` — no extraction is needed in Phase 2
code. If `getMatchTeamPartner` is upgraded in future to accept a `matchId`,
the extraction point is `teamSource.slice(6)`.

#### §7.6.3 Individual mode

When `isTeamMode === false`, the loop runs exactly as specified in §7.2.
No partner lookup is performed. No per-segment split occurs.

### §7.7 Per-match payout breakdown columns (NEW — v2.3)

The Dots payout breakdown uses a columnar layout — players on the vertical
axis, match columns on the horizontal axis — when `isTeamMode === true`.

#### §7.7.1 Sixes source

Column headers: `['Match A', 'Match B', 'Match C', 'Total']`

Per-player column values (array of 4 numbers):
```
[gbSeg[0][p.name] || 0,
 gbSeg[1][p.name] || 0,
 gbSeg[2][p.name] || 0,
 gb[p.name] || 0]
```

These are stored as `matchCols` on each row object and `colHeaders` on the
breakdown entry:

```js
const colHeaders = ['Match A', 'Match B', 'Match C', 'Total'];
breakdown.push({
  game: '🏅 Dots',
  colHeaders,
  rows: dtPlayers.map((p, ii) => {
    const pi = dtIdxs[ii];
    return {
      name:      p.name,
      detail:    '',
      net:       gb[p.name] || 0,
      matchCols: [
        gbSeg[0][p.name] || 0,
        gbSeg[1][p.name] || 0,
        gbSeg[2][p.name] || 0,
        gb[p.name] || 0,
      ],
    };
  }).sort((a, b) => b.net - a.net),
});
```

Example rendered output:
```
           Match A   Match B   Match C   Total
Chris        +$4      −$2       +$8      +$10
Dave         +$4      +$2       −$4       +$2
Greg         −$4      −$2       −$4      −$10
Jay          −$4      +$2        $0       −$2
```

#### §7.7.2 Match source

Column headers: `['Match', 'Total']`

Per-player column values (array of 2 numbers, both equal to `gb[p.name]`):
```js
const colHeaders = ['Match', 'Total'];
// matchCols: [net, net]  — same value in both columns
matchCols: [gb[p.name] || 0, gb[p.name] || 0]
```

Example rendered output:
```
           Match    Total
Chris       +$15    +$15
Dave        −$8     −$8
Greg        −$12    −$12
Jay         +$5     +$5
```

#### §7.7.3 Individual mode

`colHeaders` and `matchCols` are **not set** on breakdown entries or rows.
Display consumers detect individual mode by checking
`!entry.colHeaders`. The existing flat `{ name, detail, net }` row format
is unchanged and rendered as before.

#### §7.7.4 Display consumers

Both `ResultsPage.jsx` and `RoundSummaryModal.jsx` must be updated to
render the columnar layout when `entry.colHeaders` is present on a Dots
breakdown entry. The columnar table replaces the existing flat `PayRow`
list for that entry. Both files are in scope for session 11-M Phase 2.

**Columnar render spec:**
- Players on vertical axis (one row per player)
- Columns from `entry.colHeaders` on horizontal axis
- Cell values from `row.matchCols[colIndex]`
- Positive values: green; negative: red; zero: muted
- Total column (last column) rendered with slightly heavier weight
- Zero-net players still shown (net = $0 displayed as `$0` in muted colour)
- Sort order: by `row.net` descending (same as existing)

---

## §8. State Schema

### §8.1 `gameOpts.Dots`

| Field | Type | Default | Description |
|---|---|---|---|
| `bet` | `number` | `0` | Dollars per dot of differential |
| `teamMode` | `string` | `'none'` | Source team game key, or `'none'` for individual |
| `grossNetNOL` | `'gross'` \| `'net'` | `'gross'` | Auto-mark threshold mode only |

> **Migration notes:**
> - Old rounds store `gameOpts.Specials` — `migrateRecord` moves it to `gameOpts.Dots`.
> - Prior versions stored `teamScoring: boolean` instead of `teamMode: string`.
>   When reading a round with `teamScoring: true` and no `teamMode`, treat as
>   `teamMode: 'Sixes'`. When `teamScoring: false` or absent, treat as `teamMode: 'none'`.

### §8.2 `activeRound` top-level fields

| Field | Type | Default | Description |
|---|---|---|---|
| `dots` | `DotDef[]` | `DOTS_DEF.map(s=>({...s}))` | Per-round dot definitions; custom dots appended |
| `dotEntries` | `object` | `{}` | Flat earnings ledger; keys as §5.1 |
| `dotsPlayers` | `number[]` | `[]` | Participating player indices; `[]` = all |

### §8.3 `buildPayoutArgs` fields consumed

| Field | Source | Notes |
|---|---|---|
| `dotsPlayers` | `activeRound.dotsPlayers` | Subset indices |
| `dots` | `activeRound.dots` | Dot definitions (with value) |
| `dotEntries` | `activeRound.dotEntries` | Earnings ledger |
| `gameOpts.Dots` | `activeRound.gameOpts.Dots` | `bet`, `teamMode`, `grossNetNOL` |
| `sixesTeams` | `activeRound.sixesTeams` | Required when `teamMode === 'Sixes'` |
| `matches` | `activeRound.matches` | Required when `teamMode === 'Match'` |
| `players` | `activeRound.activePlayers` | Full player list |

---

## §9. Engine Functions

### §9.1 No dedicated engine function

Dots has no standalone engine function. All logic lives in the `payouts.js`
Dots block directly.

### §9.2 Helper functions used

| Function | File | Purpose |
|---|---|---|
| `getDotsPartner(pi, segIdx, sixesTeams, players)` | `games.js` | Returns partner index for Sixes-sourced team mode |
| `getMatchTeamPartner(pi, matches)` | `games.js` | Returns partner index for Match-sourced team mode |
| `sixesSegForHole(h)` | `games.js` | Returns segment index (0/1/2) for hole index (0-based) |
| `scoreForMode(g, courseHcp, hcpRank, minCourseHcp, mode)` | `handicap.js` | Auto-mark net score computation |
| `restoreDotDefs(dots)` | `scorecardUtils.js` | Re-attaches `autoWhen`, restores `multi`, migrates `pts → value` after JSON round-trip |

### §9.3 Partner lookup — Match team mode

`getMatchTeamPartner(piNum, matches)` is implemented in `games.js`. Behavior
unchanged from v1.3. Returns `-1` if no team match exists or `piNum` not found.

---

## §10. Display Layer

### §10.1 Scorecard — Compact Dot-Count Indicator

The live scorecard shows a compact per-player dot-count indicator in place of
the former `SpecialsCard` / `DotsCard` embedded table.

**Location:** Below the score grid, above any other game tables. Rendered
inside `ScoreGrid.jsx` when `activeGames.includes('Dots')`.

**Content:** One chip or badge per participating player showing their running
total **raw dot count** for the round. Total = sum of all `entryCount(v)`
values across all `dotEntries` for that player, regardless of dot type.
Does **not** weight by `value` — this is a raw occurrence count.

**Format example:**
```
Alice ●3   Bob ●1   Carol ●0
```

**Interaction:** None. Read-only. The long-press popup handles all input.

**Update:** Re-renders whenever `dotEntries` changes.

### §10.2 DotsTable

`DotsTable.jsx` is a new component in `pages/tables/` rendering the full
Dots results as a hole-by-hole grid, following the player-as-rows convention
used by all other game tables.

#### §10.2.1 Primary grid — hole-by-hole dot counts

**Rows:** One row per participating player (subset or all).
**Columns:** Holes 1–18.
**Portrait layout:** Split into two sub-tables: holes 1–9 (front) and 10–18
(back), stacked vertically — same pattern as `SkinsTable`, `NinesTable`, etc.
**Landscape layout:** Single 18-hole table.

**Cell value:** Total raw dot count for that player on that hole:

```
cellValue(h, pi) = Σ entryCount(dotEntries[`${h}_${pi}_${id}`])
                  for all standard keys matching hole h and player pi
                + Σ entryCount(dotEntries[`${h}_${pi}_team_dot_for_*`])
                  for all companion keys matching hole h and player pi
```

**Cell display:**
- `0` or no entries: `—` (em dash), unstyled
- `> 0`: integer count, bold, highlighted (green accent)

**Totals column:** Sum of all hole cell values per player. Column label: "Dots".

**Totals row:** Sum of all player dot counts per hole. Row label: "Total".

#### §10.2.2 Cell tap — dot type breakdown tooltip

Tapping a non-zero cell opens an inline tooltip showing dot types and counts
for that player on that hole.

**Tooltip content:** One entry per dot type earned, name + count if > 1.
Examples:
- `Birdie` (single)
- `Sandy ×2` (multi-count)
- `Birdie · Sandy ×2` (multiple types)
- `KP ×3` (carryover)
- `Team` or `Team ×2` (companion dots, listed last)

**Dot types listed** in the order they appear in `dots[]`. Team companion
dots listed last, labeled "Team".

**Dismissal:** Tap anywhere outside tooltip, or tap the cell again.

**Implementation:** Tooltip state is local to `DotsTable` — a single `useState`
holding `{hole, pi}` or `null`. No prop drilling required.

**Empty cells:** No tap handler on `—` cells.

#### §10.2.3 Dot-type pivot summary

Below the primary grid, a pivot table summarising dot counts by type.

**Layout:** One large chip/tile spanning the full width of the `DotsTable`
component. Players as columns (horizontal axis, first name only to save space),
dot types as rows (vertical axis). Only dot types where at least one
participating player earned a dot during the round are shown as rows —
zero-earned types are omitted entirely.

**Totals row:** Below all dot-type rows, a "Dots" row shows each player's
total raw dot count. The player with the highest total is highlighted.

**Format:**
```
Type    | Alice | Tom | Dave
--------|-------|-----|-----
Birdie  |   1   |  1  |  1
KP      |   ·   |  ·  |  1
Chippie |   ·   |  ·  |  1
--------|-------|-----|-----
Dots    |   1   |  1  |  3 ← leader highlighted
```

**Empty cells:** Shown as `·` (not `—`) for visual lightness.

**Column scope:** Only participating players (subset).
**Row scope:** Only dot types earned by at least one player.

#### §10.2.4 Placement

`DotsTable` is rendered in the game tables section of `ScoreGrid.jsx`
wrapped in a `GameSection` tile, matching the visual treatment of all
other game tables (`SkinsTable`, `NinesTable`, etc.). It is **not**
rendered on the scorecard above the score grid.

`TableDivider` separates the grid from the pivot summary within the tile.
8px top padding above the pivot ensures the divider line is visible.

### §10.3 DotsPopup

Long-press popup for manual dot entry and auto-mark review. See §5.2 for
the full interaction specification.

**Trigger gate:** Popup opens only for players in `dotsPlayers` (or all
players if `[]`). Implemented via subset guard in `ScoreGrid.startLongPress`.

**Three row types** (see §5.2 for full spec):
1. **Auto dots** (`sp.auto === true`): Locked green tile shown only when earned.
   Non-interactive. No "auto" badge label.
2. **Multi-count** (`sp.multi === true`, `sp.auto === false`): Tap tile =
   increment. Tap count badge = decrement. Count badge on right shows value.
3. **Single-count** (`sp.multi === false`, `sp.auto === false`): Tap tile
   to toggle.

**Row layout:** `[dot name] [×N multiplier]` — name and multiplier adjacent,
multiplier in smaller subdued text. No dollar value shown. No radial button.
All rows fixed height 44px for visual consistency.

**`team` dot:** Hidden from popup entirely.

**Companion recompute:** After every increment, decrement, or toggle,
`calcCompanionCount` is called and companion key set/deleted (§5.3).

### §10.4 ScoreGrid — autoMark

`autoMark(h, pi, g)` runs after every score entry or deletion.

**Mutual exclusivity (v2.1):** For scoring specials (ace/condor/albatross/eagle/
birdie), only the highest-priority qualifying special fires. All lower-priority
scoring specials are cleared regardless of their own `autoWhen` result. Priority
is enforced via `SCORING_SPECIAL_PRIORITY = ['ace', 'condor', 'albatross',
'eagle', 'birdie']` — the first match wins, all others are deleted.

**Clear on empty score (v2.1):** When `g` is falsy (empty, 0, or `''`), all
auto entries for that player on that hole are deleted. This handles score
deletion (backspace) correctly — auto-dots clear when the score is removed.

**Key invariants:** Writes integer `1` only. Idempotent. Functional updater
pattern (`setDotEntries(prev => ...)`). Partner guard enforced (see §13
invariant 17). All unchanged from v1.3 — see prior version for full spec.

#### §10.4.1 Retroactive scan on Dots activation

When `dotsGameActive` (`activeGames.includes('Dots')`) transitions to `true`,
a `useEffect` re-scans all scored cells and calls `autoMark` for each.
Safe due to idempotency; manual entries unaffected. See v2.0 for full spec.

#### §10.4.2 Re-scan on scoring mode change

A second `useEffect` in `ScoreGrid` watches `dotsScoringMode` (derived from
`gameOpts.Dots.grossNetNOL` or `gameOpts.Specials.scoring`). When this changes,
it re-runs `autoMark` for all scored cells. This ensures birdie/eagle/ace
badges update immediately when the user switches between gross and net scoring
in setup, without requiring score re-entry.

#### §10.4.1 Retroactive scan on Dots activation

**Problem:** `autoMark` fires only on score entry. If Dots is activated
after scores are already entered (e.g. the user adds Dots mid-round via the
setup screen), all previously entered scores are never scanned and auto-dots
(birdie, eagle, ace) are silently missed.

**Solution:** A `useEffect` in `ScoreGrid` watches
`activeGames.includes('Dots')`. When this transitions to `true`, it
iterates all 18 holes × all participating players and calls `autoMark`
for every cell that has a score entered.

```js
useEffect(() => {
  if (!activeGames.includes('Dots')) return;
  const dtIdxs = dotsPlayers?.length ? dotsPlayers : players.map((_, i) => i);
  for (let h = 0; h < 18; h++) {
    dtIdxs.forEach(pi => {
      const g = parseInt(scores[h]?.[pi]);
      if (g) autoMark(h, pi, g);
    });
  }
}, [activeGames.includes('Dots')]); // eslint-disable-line react-hooks/exhaustive-deps
```

**Safety:** `autoMark` is idempotent — running it on a hole that was already
correctly marked produces identical state. Manual dot entries (sandy, polie,
KP, etc.) are completely unaffected because `autoMark` only writes or deletes
keys for `auto: true` dot types. Multi-count manual entries are never touched.

**Remount behavior:** If `ScoreGrid` remounts while Dots is already active
(e.g. navigating away and back to the scorecard), the effect re-fires and
re-scans all holes. This is safe due to idempotency — the re-scan produces
no change to correct state. The minor redundant work is accepted in exchange
for implementation simplicity.

**Dependency note:** The effect dependency is the boolean result of
`activeGames.includes('Dots')`, not the `activeGames` array reference.
This fires only when Dots is toggled on or off, not on every render.

### §10.5 DotsTable — team mode layout (NEW — v2.3)

When `isTeamMode === true`, `DotsTable` renders a team-aware layout that
replaces the standard individual layout. The layout differs by `teamSource`.

#### §10.5.1 Sixes source — three Match A/B/C grid blocks

The standard F9/B9 portrait split is replaced by **three 6-hole segment
blocks**, one per Sixes segment, labelled Match A, Match B, Match C.

**Block structure (each of three):**

- **Label row:** `"Match A · holes 1–6 · [TeamA p1]/[TeamA p2] vs [TeamB p1]/[TeamB p2]"`
  Team pairing derived from `getDotsPartner` for that segment. Player names
  shown as first name only to fit the label.
- **Grid:** 6 hole columns for that segment (1-indexed display: holes 1–6,
  7–12, 13–18). Player rows for all `dtIdxs` players. Cell values = raw dot
  count for that player on that hole (`cellCount(h, pi)`). Zero cells show `·`.
- **Totals column:** Labelled `A`, `B`, or `C` respectively. Shows sum of
  that player's dot counts across the 6 holes of that segment.
- **Total row:** `"Total"` label. Sum of all player dot counts per hole.
  Totals column shows segment grand total.

**Portrait and landscape:** Three blocks rendered vertically in both
orientations. The segment structure is the primary visual unit in Sixes team
mode; collapsing to a single 18-hole table would lose team context.

**Pivot summary (bottom):**

The existing dot-type pivot gains **A/B/C sub-columns** nested under each
player name column:

- **Header row 1:** Player first names, each spanning 3 sub-columns.
  A visible vertical divider separates each player group.
- **Header row 2:** `A`, `B`, `C` under each player.
- **Body rows:** One per active dot type (same filter: ≥1 player earned ≥1
  dot of this type across the round). Cell value = count of that dot type
  earned by that player in that segment's holes only.
- **Dots totals row:** Per-player per-segment raw dot totals. Leader
  highlighting applies: highest value in each sub-column group is highlighted.
- **No overall total column** — consistent with existing individual pivot.

#### §10.5.2 Match source — F9/B9 blocks with team label + team pivot

**Top section — grid blocks:**

The existing F9/B9 portrait split is **preserved**. A single team label is
prepended above the Front 9 block:

```
"Team Match · [TeamA p1]/[TeamA p2]  vs  [TeamB p1]/[TeamB p2]"
```

Player names derived from the match identified by `teamSource.slice(6)`.
The F9 and B9 grid blocks are otherwise identical to individual mode.

**Landscape:** Existing single 18-hole table preserved, team label shown above.

**Pivot summary (bottom):**

The pivot is restructured with **Team A / Team B as top-level header columns**
and player names as sub-columns:

- **Header row 1:** `Team A` spanning TeamA player count; `Team B` spanning
  TeamB player count. Visible vertical divider between teams.
- **Header row 2:** First name of each player under their team header.
- **Body rows:** One per active dot type. Cell value = total dots of that type
  earned by that player across all 18 holes (same as individual mode).
- **Dots totals row:** Per-player raw dot totals for all 18 holes. Leader
  highlighting unchanged.
- **No per-segment sub-columns** — teams are fixed all 18 holes; no segment
  breakdown exists.
- **No overall total column** — consistent with existing pivot.

#### §10.5.3 Helper functions used by DotsTable team layout

| Function | File | Used for |
|---|---|---|
| `getDotsPartner(pi, seg, sixesTeams, players)` | `games.js` | Team pairing label per segment (Sixes) |
| `getMatchTeamPartner(pi, matches)` | `games.js` | Team A / Team B membership (Match) |
| `sixesSegForHole(h)` | `games.js` | Map hole index → segment for per-segment cell counts |

These are display-only calls in `DotsTable`. They produce no payout values.

#### §10.5.4 DotsTable prop signature update (NEW — v2.3)

`DotsTable` requires two new props to support team mode rendering:

```js
export function DotsTable({
  players, dots, dotEntries, gameOpts, dotsPlayers, isLandscape,
  sixesTeams,   // NEW — required for Sixes team mode layout
  matches,      // NEW — required for Match team mode layout
})
```

Both props are optional at the component level (team mode layout renders
only when `isTeamMode === true` and the relevant prop is non-null). Both
call sites must be updated to pass these props:

**`ScoreGrid.jsx`** (already receives `matches` and `sixesTeams` as props):
```jsx
<DotsTable
  players={players} dots={dots} dotEntries={dotEntries}
  gameOpts={gameOpts} dotsPlayers={dotsPlayers}
  isLandscape={isLandscape}
  sixesTeams={sixesTeams}
  matches={matches}
/>
```

**`RoundSummaryModal.jsx`** (already destructures `matches` and `sixesTeams`
from `ar`):
```jsx
<DotsTable
  players={players} dots={dots} dotEntries={dotEntries}
  sixesTeams={sixesTeams} matches={matches}
  gameOpts={gameOpts} dotsPlayers={dotsPlayers}
/>
```

Both call sites are in scope for session 11-M Phase 2.

### §10.6 DotsTable — individual mode unchanged (NEW — v2.3)

When `isTeamMode === false`, `DotsTable` renders **exactly as it did before
v2.3**. No changes to the individual code path. The F9/B9 portrait layout,
18-hole landscape layout, and flat pivot summary (player columns, no
sub-columns) are all preserved. This section is stated explicitly to prevent
accidental modification of the individual path during team mode implementation.

---

## §11. Setup UI (GameConfigDots.jsx)

_Heading updated in v2.5 (13-E). The Dots config panel lives in `GameConfigDots.jsx` (panel file in the dispatcher + Shared split). `CustomDotAdder` and `DotRow` are private to that file. The dispatcher `GameConfig.jsx` routes `game === 'Dots'` to this panel. `BetSection` and `PlayerSubsetDropdown` referenced below are imported by the panel from `GameConfigShared.jsx`._

### §11.1 Config section structure

The Dots config section in `GameConfigDots.jsx` renders when `game === 'Dots'`:

1. **Player subset picker** (`PlayerSubsetChips`) — shown when
   `players.length > 2 && teamMode === 'none'`.

2. **Options card:**
   - **Team mode selector** — individual / Sixes / Match (eligibility per §2.5).
   - **Scoring dropdown** — `'Gross'` / `'Net'`. Label: "Auto-mark threshold".

3. **Bets card:** `$ per dot` — `BetInput` component.

4. **Dots to Track card:**
   - One row per dot in `dots[]` (excluding `team`).
   - Each row: enable toggle, dot name, `×N` multiplier input (1–10, select-all on focus).
   - Built-in dots: enable/value editable; name not editable; not deletable.
   - Custom dots: swipe-left to reveal Edit (pale yellow, `#fff9e6`) and Delete (red)
     buttons. Edit opens inline name + value inputs.
   - The `team` dot row is hidden (engine-managed, not user-configurable).
   - `CustomDotAdder` component below the list.

**Game subtitle:** "Specials, Junk" shown next to the Dots toggle in the game list.

### §11.2 Custom dot adder

Text input (name) + `×N` multiplier input (1–10, default 1, select-all on focus) +
"Allow multiples per hole" toggle (default on) + "Add" button. On add:
```js
{ id: `c_${Date.now()}`, name: name.trim(), value, enabled: true, auto: false, multi }
```
Appended to `dots` state.

### §11.3 Custom dot edit

Swipe-left on any custom dot row reveals Edit and Delete buttons (matches
`HistoryPage` swipe pattern). Edit opens inline name + value inputs within
the row. Changes confirmed on blur or Enter; cancelled on Escape.

Note: `DotRow` is extracted as a standalone React component (not an inline
map callback) to comply with React hooks rules — swipe state (`useState`,
`useRef`) must live at component level, not inside a `.map()` callback.

### §11.4 Custom dot delete

Swipe-left → Delete button removes the dot from `dots` state. Additionally
reads `activeRound.dotEntries` from `ls.get(SK.activeRound)`, recomputes
all companion entries using the updated dots list, and writes corrected
`dotEntries` back. Standard entries for the deleted dot are not scrubbed —
silently ignored at payout. See §5.3 for full recompute spec.

### §11.3 Custom dot edit

In-line edit via pencil icon. Name and value inputs pre-filled. Confirmed on
blur or Enter. Stored back to `dots` state.

### §11.4 Custom dot delete

Trash icon removes dot from `dots` state. If round in progress, companion
entries in `activeRound.dotEntries` are immediately recomputed via `ls`. See §5.3.

---

## §12. The `restoreDotDefs` Gotcha

**Problem:** JavaScript functions cannot be serialized to JSON. Every
`localStorage` round-trip strips `autoWhen` from all auto dots (ace, eagle,
birdie). Additionally, `multi` may be absent on old rounds (pre-v1.1),
and `value` may be absent on rounds saved before v2.0 (stored as `pts`).

**Solution:** `restoreDotDefs(dots)` in `scorecardUtils.js` (renamed from
`restoreAutoWhen`):

```js
export function restoreDotDefs(dots) {
  if (!dots?.length) return dots;
  return dots.map(sp => {
    const def = DOTS_DEF.find(d => d.id === sp.id);
    let restored = sp;
    // 1. Re-attach autoWhen for auto dots
    if (def?.autoWhen && !sp.autoWhen)
      restored = { ...restored, autoWhen: def.autoWhen };
    // 2. Restore multi if absent
    if (restored.multi === undefined)
      restored = { ...restored, multi: def ? (def.multi ?? false) : true };
    // 3. v2.0 migration: pts → value
    if (restored.value === undefined) {
      const fallback = restored.pts ?? (def ? def.value : 1);
      restored = { ...restored, value: fallback };
    }
    return restored;
  });
}
```

**Where it must be called:**
- `DotsTable.jsx` — top of component
- `DotsPopup.jsx` — top of component
- `ScoreGrid.jsx` — inside `autoMark` callback, before iterating dots

**All callers must be updated** from `restoreAutoWhen` → `restoreDotDefs`
and `SPECIALS_DEF` → `DOTS_DEF` import references.

---

## §13. Invariants

1. **Zero-sum:** Sum of all `gb` values = 0.
2. **Pure function:** Payout block has no side effects.
3. **No dots created at payout:** `indivDots` reads only from `dotEntries`.
4. **`restoreDotDefs` before any `autoWhen` use.**
5. **Payout only counts enabled dots:** `ens = dots.filter(s => s.enabled)`.
6. **Entry values are positive integers or absent.**
7. **Payout uses `entryCount` and `sp.value`:** `indivDots[pi] += sp.value * entryCount(v)`. Never `sp.pts`.
8. **Anti-circular companion rule:** Companion count from non-team entries only.
9. **Companion is a single key per earner per hole.**
10. **Subset immutability:** `dotsPlayers` set at round creation; must not change mid-round.
11. **Team mode requires full participation.**
12. **No NOL in payout.**
13. **Custom dots use `c_` prefix.**
14. **Key format is immutable post-migration:** The `dotEntries` key format
    (`"h_pi_id"` for standard entries; `"h_pi_team_dot_for_earnerPi"` for
    companions) must not change without simultaneously updating every
    construction and parsing site: `payouts.js`, `DotsPopup.jsx`,
    `DotsTable.jsx`, `ScoreGrid.jsx`, and `NewRoundPage.jsx` (`deleteCustom`).
    Detection logic (`parts[2] === 'team'`) is stable across the
    `team_special_for` → `team_dot_for` rename and must not be altered.
15. **`auto: true` overrides `multi` unconditionally.**
16. **Functional updater pattern for companion writes.**
17. **Partner guard:** `getDotsPartner()` or `getMatchTeamPartner()` returning
    `-1` must never result in a companion key being written.
18. **DotsTable cell value = total raw dot count:** Cell value for (hole h,
    player pi) is the sum of `entryCount(v)` across all `dotEntries` keys
    matching that hole and player — regardless of dot type or `value` weighting.
    The payout screen is the only place `value` weighting produces dollar amounts.

---

## §14. Known Gaps

| ID | Priority | Description | In code? |
|---|---|---|---|
| ~~G-10~~ | ~~Low~~ | ~~`App_Data_Model_Contract.md` not updated for v2.0 rename.~~ | ✅ **CLOSED** — `App_Data_Model_Contract.md` v2.5 updated in Sprint 11-B |
| ~~G-13~~ | ~~High~~ | ~~`DotsTable` not yet built. `SpecialsCard` still in use.~~ | ✅ **CLOSED** — `DotsTable.jsx` built in Sprint 11; `SpecialsCard.jsx` deleted |
| G-14 | Medium | **Dots subset picker (5-player).** When a round has 5 players, the subset picker is blocked. Pending Sixes 5-player work — same underlying infrastructure needed. | No |

---

## §15. Examples

### §15.1 Individual mode — 4 players, complete round

```
Setup: Alice, Bob, Carol, Dan  |  bet = $1/dot, teamMode = 'none'

Dots earned:
  Alice: 2 birdies (value=$1) + 1 sandy (value=$1) → indivDots=5
  Bob:   1 eagle (value=$3)                         → indivDots=3
  Carol: none                                        → indivDots=0
  Dan:   1 ace (value=$5) + 1 birdie + 1 sandy      → indivDots=7

dotEntries:
  "3_0_birdie"=1, "11_0_birdie"=1, "7_0_sandy"=1
  "5_1_eagle"=1
  "2_3_ace"=1, "14_3_birdie"=1, "16_3_sandy"=1

DotsTable:
  Alice: H4=1, H8=1, H12=1 | Total: 3 dots
  Bob:   H6=1               | Total: 1 dot
  Carol: all —              | Total: 0 dots
  Dan:   H3=1, H15=1, H17=1 | Total: 3 dots

Tap H6/Bob → tooltip: "Eagle"
Tap H3/Dan → tooltip: "Ace"

Payout detail: Alice "5 dots", Bob "3 dots", Carol "0 dots", Dan "7 dots"
Final: Dan +$13, Alice +$5, Bob -$3, Carol -$15. Sum=$0 ✓
```

### §15.2 Multi-count — double KP on hole 6

```
Alice taps KP row twice → dotEntries["6_0_kp"] = 2
DotsTable: H7/Alice = 2 (bold, highlighted)
Tap cell → tooltip: "KP ×2"
indivDots[0] += 1 * 2 = 2 dot-value units from this hole.
```

### §15.3 Team mode — anti-circular companion (Sixes, hole 4)

```
Alice(0) + Bob(1) teammates, Carol(2) + Dan(3) teammates. teamMode='Sixes'

Hole 4: Alice earns birdie + polie (2 non-team dots).
        Bob earns sandy (1 non-team dot).

After Alice: dotEntries["4_0_birdie"]=1, ["4_0_polie"]=1
  calcCompanionCount(4,0,...) = 2 → dotEntries["4_1_team_dot_for_0"]=2

After Bob: dotEntries["4_1_sandy"]=1
  calcCompanionCount(4,1,...) = 1 → dotEntries["4_0_team_dot_for_1"]=1

DotsTable: H4/Alice=3, H4/Bob=3
Tap H4/Alice → "Birdie · Polie · Team"
Tap H4/Bob   → "Sandy · Team ×2"
No circular accumulation. ✓
```

### §15.4 Backward compatibility — round saved under v1.3

```
Saved round dots[] (stored as specials[]) contains:
  { id:'eagle', name:'Eagle', pts:3, enabled:true, auto:true, multi:false }

migrateRecord: specials → dots, specEntries → dotEntries,
  specialsPlayers → dotsPlayers, gameOpts.Specials → gameOpts.Dots,
  activeGames: 'Specials' → 'Dots'

restoreDotDefs:
  eagle: value===undefined → value = pts = 3. autoWhen re-attached.

After migration: all sp.value reads correct. ✓
```

### §15.5 Custom dot — round-trip and deletion

```
User adds "Scramble Save" (id='c_1714000000', value=2, multi=true).
User earns two on hole 7: dotEntries["7_1_c_1714000000"] = 2
indivDots[1] += 2 * 2 = 4 dot-value units.

User later deletes "Scramble Save":
  → removed from dots[]
  → dotEntries["7_1_c_1714000000"]=2 remains but ignored at payout. ✓
```

### §15.6 Sixes team mode — partner exclusion payout

```
Setup: Alice(0)+Bob(1) vs Carol(2)+Dan(3) in Seg 0 (Match A, holes 0–5)
       Alice(0)+Carol(2) vs Bob(1)+Dan(3) in Seg 1 (Match B, holes 6–11)
       Alice(0)+Dan(3) vs Bob(1)+Carol(2) in Seg 2 (Match C, holes 12–17)
bet = $1/dot

Dots earned (value-weighted, indivDots):
  Alice: 7 (all holes)   Bob: 6 (all holes)
  Carol: 3 (all holes)   Dan: 5 (all holes)

Per-segment dot totals (segDots):
         Seg 0  Seg 1  Seg 2
  Alice:   4      1      2
  Bob:     3      2      1
  Carol:   1      1      1
  Dan:     1      1      3

Settlement — Seg 0 (Match A):
  Partners: Alice+Bob (skip), Carol+Dan (skip)
  Opponents: Alice vs Carol: diff=3 → Alice +$3, Carol -$3
             Alice vs Dan:   diff=3 → Alice +$3, Dan   -$3
             Bob   vs Carol: diff=2 → Bob   +$2, Carol -$2
             Bob   vs Dan:   diff=2 → Bob   +$2, Dan   -$2

Settlement — Seg 1 (Match B):
  Partners: Alice+Carol (skip), Bob+Dan (skip)
  Opponents: Alice vs Bob:  diff=-1 → Bob   +$1, Alice -$1
             Alice vs Dan:  diff=0  → no movement
             Bob   vs Carol: diff=1 → Bob   +$1, Carol -$1
             Carol vs Dan:  diff=0  → no movement

Settlement — Seg 2 (Match C):
  Partners: Alice+Dan (skip), Bob+Carol (skip)
  Opponents: Alice vs Bob:   diff=1  → Alice +$1, Bob   -$1
             Alice vs Carol: diff=1  → Alice +$1, Carol -$1
             Bob   vs Dan:   diff=-2 → Dan   +$2, Bob   -$2
             Carol vs Dan:   diff=-2 → Dan   +$2, Carol -$2

Final gb: Alice +$6, Bob +$3, Carol -$9, Dan -$1. Sum = 0 ✓

Payout breakdown columns:
           Match A   Match B   Match C   Total
Alice        +$6      −$1       +$2      +$7
Bob          +$4      +$2       −$3      +$3
Carol        −$5      −$1       −$3      −$9
Dan          −$5       $0       +$4      −$1
Sum           $0       $0        $0       $0  ✓
```

Note: `indivDots` are the full-round values (Alice=7, etc.) used in the
`segDetail` helper and DotsTable totals, but the settlement uses `segDots`
per-segment values. These are different — `indivDots` is the full-round total;
`segDots[pi][seg]` is that player's contribution from that segment's holes only.

### §15.7 Match team mode — fixed partner exclusion payout

```
Setup: Alice(0)+Bob(1) = Team A  vs  Carol(2)+Dan(3) = Team B
       teamSource = 'Match:m_abc123'  (fixed for all 18 holes)
bet = $1/dot

indivDots (all 18 holes):
  Alice: 11   Bob: 6   Carol: 2   Dan: 9

Settlement:
  Alice vs Bob:   partners (same team) → SKIP
  Carol vs Dan:   partners (same team) → SKIP
  Alice vs Carol: cross-team, diff=9 → Alice +$9,  Carol -$9
  Alice vs Dan:   cross-team, diff=2 → Alice +$2,  Dan   -$2
  Bob   vs Carol: cross-team, diff=4 → Bob   +$4,  Carol -$4
  Bob   vs Dan:   cross-team, diff=-3 → Dan  +$3,  Bob   -$3

Final: Alice +$11, Bob +$1, Carol −$13, Dan +$1. Sum = 0 ✓

Payout breakdown columns:
           Match    Total
Alice       +$11    +$11
Bob          +$1     +$1
Carol       −$13    −$13
Dan          +$1     +$1
Sum           $0      $0  ✓

DotsTable pivot (bottom):
           Team A          |  Team B
           Alice   Bob     |  Carol   Dan
Birdie       2      ·      |   ·       1
Sandy        ·      ·      |   ·       1
Polie        3      ·      |   ·       1
KP           ·      1      |   ·       3
Chippie      1      ·      |   ·       1
Team         5      5      |   2       2
Dots        11      6      |   2       9
```

---

## §16. Final Rule

If implementation behavior conflicts with this contract, call out the conflict.
The implementation must be corrected. This document defines the truth.
