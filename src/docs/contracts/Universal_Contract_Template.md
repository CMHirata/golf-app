# Universal Contract Template (UCT)

_Version 1.0 — April 2026_
_Status: AUTHORITATIVE SKELETON — fill in all `[specify]` / `___` placeholders when writing a game contract._
_Every game contract in this project must conform to this template. Every section of this template must be addressed. If a section does not apply to a game, state explicitly why and write "N/A — [reason]"._
_If code conflicts with a contract, the contract wins and the code must be corrected._

---

## How to Use This Template

1. Copy this file and rename it `{GameName}_Contract.md`.
2. Fill every `[specify]` and `___` placeholder.
3. Write "N/A — [reason]" for any section that genuinely does not apply.
4. Do **not** delete guidance notes (italicized blocks). They explain why each field exists.
5. Mark implementation gaps (§ on Known Gaps) at the bottom if anything in the contract is not yet coded.
6. Cross-reference the App Data Model Contract, Payout Contract, and Handicap Contract wherever called out.
7. Bump the version number on every meaningful change.

---

## §0. Contract Header

```
# [Game Name] Contract

_Version [X.Y] — [Month Year]_
_Supersedes [Game Name] Contract vX.Y-1._
_Changes: [one-line summary of what changed]_
_Status: DRAFT | AUTHORITATIVE_
_All implementation must conform to this contract._
_If code conflicts with this contract, the contract wins._
```

**Engine file(s):** `___` _(e.g. `games.js`, `payouts.js`)_
**Table component:** `___` _(e.g. `SkinsTable.jsx`)_
**Payout logic location:** `___` _(e.g. `payouts.js §Skins section`)_
**Cross-references:** `___` _(list all contracts this one depends on)_

> _Guidance: The header uniquely identifies the contract version and its authoritative status. "Authoritative" means the contract governs; "Draft" means it is under review. Never ship code against a Draft contract. Cross-references must be complete — if this game depends on the Handicap Contract, list it here._

---

## §1. Overview and Game Identity

### §1.1 Plain-language description

[2–4 sentences: what the game is, what golfers are betting on, what makes it distinct from other games in the app.]

### §1.2 Game key (activeGames entry)

The string identifier in `activeGames[]` for this game is: `'___'`

> _Guidance: This must match exactly what is stored in `activeRound.activeGames`, used in `payouts.js` conditional blocks, and displayed in game config UI. A mismatch here causes silent non-payout — the game is active but no payout block fires. Check `ALL_GAMES` in `games.js` for the canonical list._

### §1.3 Format variants

| Variant | Description | Configured by |
|---|---|---|
| [variant name] | [description] | [field name in gameOpts or matchDef] |

> _Guidance: List every top-level variant the game supports (e.g. Nassau has "Individual" and "Team"; Skins has "perSkin" and "pot"; Stableford has "nassau" and "perpoint"). If the game has only one format, write "Single format — no variants." Variants that share engine logic but differ in payout must both be listed._

---

## §2. Eligibility and Players

### §2.1 Valid player counts

| Player count | Valid? | Notes |
|---|---|---|
| 2 | [yes/no/conditional] | [notes] |
| 3 | [yes/no/conditional] | [notes] |
| 4 | [yes/no/conditional] | [notes] |
| 5+ | [yes/no/conditional] | [notes] |

Minimum required: `___`
Maximum allowed: `___` _(or "no maximum")_

> _Guidance: "Conditional" means valid only with certain options (e.g. Nines requires exactly 3). State hard requirements enforced by `NewRoundPage` and soft requirements the engine silently handles. A guard in `NewRoundPage` that is not documented here will eventually be removed by an AI. Specify it explicitly._

### §2.2 Subset support

Does this game support a player subset (fewer than all active players)? `[yes / no / deferred]`

If yes:
- **State field:** `activeRound.[fieldName]` — type: `number[]` (player indices); `[]` = all players
- **`buildPayoutArgs` key:** `[fieldName]`
- **Engine parameter name:** `[paramName]` _(may differ from state field name — document both)_
- **Selection UI:** [where/how subset is chosen — NewRoundPage, at round start, mid-round, etc.]
- **Subset is fixed at:** [round creation / segment start / other]
- **Changing subset mid-round:** [defined behavior / undefined behavior — state which]

If no: "N/A — all active players always participate."

> _Guidance: Subset field names differ between layers by design (e.g. `skinsPlayers` in state vs `skinPlayerIdxs` in engine). Document both. Changing a subset mid-round is usually undefined behavior — say so explicitly so no one adds a mid-round picker thinking it's safe._

### §2.3 Multi-instance support

Can multiple instances of this game run simultaneously in the same round? `[yes / no]`

If yes: [describe how instances are distinguished — e.g. match IDs, array position, etc.]

> _Guidance: Nassau/Match supports multiple matches per round (each has a unique `matchDef.id`). Skins does not — there is exactly one Skins game per round. Getting this wrong causes payout logic to merge or duplicate results._

### §2.4 Team structure

Does this game involve teams? `[yes / no]`

If yes:
- **Team size:** `___` players per team
- **Number of teams:** `___`
- **Team selection:** [user-chosen / auto-computed / rotation / fixed]
- **Team storage field:** `activeRound.[fieldName]`
- **Auto-computation rule:** [exact algorithm if auto-computed, e.g. lexicographic pair enumeration]
- **Team membership changes:** [fixed for whole round / rotates per segment / other]

> _Guidance: Auto-computation rules must be deterministic and stated exactly (see Sixes Contract §2.2 for lexicographic pair enumeration). If two implementations use different tie-breaking logic for auto-pairing, they will produce different segment-3 teams on the same input. "First unused pair in lexicographic order" is not vague — write it that way._

---

## §3. Scoring

### §3.1 Scoring modes supported

| Mode | Supported | Notes |
|---|---|---|
| `gross` | [yes/no] | |
| `net` | [yes/no] | |
| `netofflow` | [yes/no] | |

> _Guidance: List all three modes explicitly. If a mode is excluded intentionally (e.g. Specials excludes `netofflow`), explain why — or a future developer will add it. See Handicap Contract for mode definitions._

### §3.2 Score comparison unit

What is the atomic unit that determines a winner? [one of: per-hole score / total score / point total / team best-ball / other]

Tie condition: [exact definition — e.g. "equal scores = tied hole", "equal point totals = split payout"]

> _Guidance: Nassau is per-hole, Stroke Play is total score, Stableford is point total. Getting this wrong means the wrong engine function is called. Be precise about what "best" means in context._

### §3.3 Team scoring rule (if teams)

For team formats: how is the team's score derived from individual player scores?

`[best ball (min score) / second ball / average / sum / other]`

> _Guidance: Sixes uses best-ball (min) for team score. If the rule is "best ball," state it explicitly — don't assume the reader knows. The second-ball tiebreak in Sixes is a separate rule that applies after best-ball ties; document them as distinct steps._

### §3.4 Handicap application

| Aspect | Value |
|---|---|
| Function used | `scoreForMode(gross, courseHcp, rank, minCourseHcp, mode)` |
| `courseHcps` source | `activeRound.courseHcps[playerIdx]` (computed at round start, never recomputed in UI) |
| `minCourseHcp` scope | [full-field / subset-only] |
| `subsetMin()` required? | [yes — specify which subset / no] |
| Strokes applied | [per-hole via stroke index / total handicap divided / other] |
| `hcps[]` meaning | Stroke index per hole (1 = hardest, 18 = easiest) |

> _Guidance: `minCourseHcp` scope is the most common source of NOL bugs. If the game has a player subset and supports `netofflow`, `subsetMin()` is required and must be called in the `computePayouts` game block — not in `buildPayoutArgs`. See Payout Contract §4.3 and Handicap Contract §5 for the universal invariant. "Full-field" means all active players; "subset-only" means only the participating subset._

### §3.5 Incomplete hole / missing score behavior

What happens when a hole has missing scores?

- **Single-player missing score:** [stop / skip / partial result]
- **Engine return value for incomplete hole:** [null / partial object / other]
- **Loop behavior:** [break on first null / skip hole and continue / other]
- **`thru` value for incomplete segments:** [reflects only played holes / other]
- **Bets with `thru === 0`:** [skip — no payout / other]
- **Cross-game rule reference:** Authoritative cross-game rule is in Payout Contract §9 (incomplete round policy)

> _Guidance: Inconsistent incomplete-hole behavior between games is a primary source of bugs. All games should stop at the first unplayed hole and return `null` for that hole. Skipping holes is almost always wrong. Document exactly what the engine returns when input is incomplete. A bet with `thru === 0` must never produce a payout._

### §3.6 Segment relevance

| Segment | Relevant to this game? | Notes |
|---|---|---|
| Front 9 (holes 0–8) | [yes/no/sometimes] | |
| Back 9 (holes 9–17) | [yes/no/sometimes] | |
| Full 18 (holes 0–17) | [yes/no/sometimes] | |
| Other segments | [describe] | |

> _Guidance: Nassau uses all three; Skins treats the round as a continuous sequence with no segment splits; Sixes uses three 6-hole segments. State which segments matter for scoring, which for betting, and whether they differ._

---

## §4. Betting Structure

### §4.1 Bet type

`[flat per-hole / flat per-segment / Nassau (three independent segments) / pool / point-based / other]`

### §4.2 Bet configuration fields

| Field | Storage location | Type | Default | Description |
|---|---|---|---|---|
| `bet` | `activeRound.gameOpts.[GameName].bet` | number | 0 | [describe what this dollar amount means] |
| [other fields] | | | | |

> _Guidance: "What this dollar amount means" must be unambiguous. In Skins `perSkin` mode, `bet` is per-player per skin (not total). In Nassau, `betFront` is what the winning side collects from the losing side per player pairing. Wrong interpretation = wrong payout. In multi-instance games (Nassau), bet amounts live on the matchDef, not in gameOpts._

### §4.3 Press support

Does this game support presses? `[yes — manual only / yes — auto only / yes — both / no]`

If yes, complete all subsections below. If no, write "N/A" and skip to §4.4.

#### §4.3a Press scope

Presses operate within: `[segment / full round / other]`

Press storage key format: `'[GameKey]:[segment identifier]'`
Example key: `'___'`
Storage location: `activeRound.manualPresses['[key]']`
Value type: `number[]` — sorted ascending, 0-based hole indices, no duplicates

> _Guidance: Key format must be unique across all games in the same round. Nassau uses `'Match:{matchId}:{Front|Back|Overall}'`. Sixes uses `'Sixes:seg{0|1|2}'`. A key collision silently shares press arrays between different game segments._

#### §4.3b Press hierarchy model

`[flat array of start-hole indices / nested / other]`

Hierarchy interpretation:
- `arr[0]` → Press 1 starts after hole `arr[0]`
- `arr[1]` → Press 2 (on Press 1) starts after hole `arr[1]`
- Cascade delete rule: removing depth N removes all entries at depth N and beyond

Maximum press depth: `[unlimited / N / other]`

> _Guidance: All games with presses use the flat sorted array model. Press 2 is a press on Press 1, not a sibling of Press 1. This is not intuitive — say it explicitly._

#### §4.3c Auto-press

Auto-press supported: `[yes / no]`

If yes:
- **Trigger condition:** [e.g. "player/team is down by threshold in that segment"]
- **Threshold config field:** `activeRound.gameOpts.[GameName].[field]` or `matchDef.[field]`
- **Threshold values:** `[none / '1'–'5' / integer / other]`
- **Fires once per:** [hole per segment / segment / other]
- **Guard conditions:** [e.g. "no existing press at this hole", "segment not yet complete"]
- **Watches:** [which match level — deepest/all/other]

> _Guidance: Auto-press must be deterministic — same inputs, same trigger. It must have a clear "already fired" guard to prevent duplicate presses. Nassau watches the deepest press level; Sixes watches the deepest match level. State exactly which level is watched._

#### §4.3d Manual press interaction surface

`[PressModal is the sole interaction surface / other]`

PressModal behavior for this game:
- Tap un-pressed hole → [action]
- Tap pressed hole → [action]
- Chip holdability rule: [when is a press chip holdable — long-press to open PressModal]

> _Guidance: Copy the Nassau press UI contract pattern if using PressModal. If a game has a different UI for presses, document it here. "PressModal is the sole interaction surface" means no inline press controls exist — an AI won't accidentally add them._

#### §4.3e Presses beyond `thru`

Manual press entries with a start hole index ≥ last scored hole in the segment:
`[ignored during engine evaluation / other]`

> _Guidance: This prevents stale press entries from affecting a completed segment's result. Always "ignored during engine evaluation" — the engine reads only played holes._

### §4.4 Tiebreak rules

| Situation | Tiebreak config field | Value `'none'` behavior | Value `'half'` behavior | Other values |
|---|---|---|---|---|
| [Segment / hole / total] tied | `[field name]` | [result] | [result] | [list other values and behavior] |

> _Guidance: Nassau has `tiebreak: 'none' | 'second' | 'half'` on each matchDef. Sixes has `tiebreak: 'none' | 'second'` with a second-ball tiebreaker within a hole. "None" almost always means "tie stands, no payout." Document each possible value — an undocumented value is a silent bug waiting to happen._

### §4.5 Carryover (if applicable)

Does this game support bet or point carryover across holes/segments? `[yes / no / N/A]`

If yes:
- **What carries:** [pot value / skin count / other]
- **Trigger for carry:** [tied hole / tied segment / other]
- **Carry resolution:** [next sole winner / end of round / other]
- **Unresolved carry at round end:** [lost / redistributed / other]
- **Config field:** `activeRound.gameOpts.[GameName].[field]`

> _Guidance: Skins carryover is the canonical example. "Unresolved carry at round end = lost" is the correct answer for Skins — it is enforced by the engine loop structure, not a special case. Document it explicitly anyway because the alternative (redistributing to last winner) is a plausible wrong implementation._

---

## §5. Payout Rules

### §5.1 Payout structure type

`[winner-take-all / proportional to points / per-skin pool / point-differential / per-player-per-pairing / other]`

### §5.2 Zero-sum proof

State the formula that guarantees all payouts across participating players sum to zero:

```
[formula or verbal proof]
```

> _Guidance: Every game block's local `gb` must sum to zero before merging into `bank`. State the proof. For Skins perSkin: "each skin transfers `bet × (subsetSize - 1)` from losers to winner — losers pay `bet` each, winner nets `bet × (subsetSize - 1)`, sum = 0." For Nassau: "winner collects `betAmount` from loser — one side pays, one side receives the same amount." If you cannot write this proof, the payout formula is likely wrong._

### §5.3 Per-game payout formula

[Describe the exact payout calculation in plain language and/or pseudocode.]

```js
// pseudocode or actual formula
```

> _Guidance: Be precise enough that two independent developers reading this produce identical code. "Winner gets paid" is not precise. "Winner collects `betAmount` from each other participating player; each loser pays `betAmount`; `payWinner(name, players, bet, gb)` executes this" is precise._

### §5.4 Multi-level payout (presses)

If presses are active, how does each press level settle?

`[independently at same bet rate as parent / at different rate / other]`

Press payout independence: `[press results never affect base match result / other]`

> _Guidance: All games with presses settle each press independently at the same bet rate. "The press bet is the same amount as the base segment bet" is a universal rule. Document it here so it's clear no per-press bet configuration exists._

### §5.5 Incomplete segment / incomplete round payout

- **Segments not fully scored:** [pay based on `thru` result / no payout / other]
- **`thru === 0` segments:** must not produce a payout (universal rule — Payout Contract §9)
- **Interim results (partial rounds):** [display-only / actionable / other]

> _Guidance: "Pay based on `thru` result" is the default: you pay what was earned through the last scored hole. A bet where `thru === 0` (no holes scored) must never move money. Document this even if it seems obvious — it is violated by silent code bugs._

### §5.6 Tie at payout

If the round ends in a tie at the game or segment level:

| Tiebreak config | Dollar outcome |
|---|---|
| `'none'` | [no payout / bet stands / other] |
| `'half'` | [each side wins half the bet amount] |
| `'second'` | [secondary tiebreaker applies — describe] |

> _Guidance: Do not conflate "tied hole during play" (which has its own rule under §4.4) with "tied final result at payout" (which is this section). Both must be documented. In Nassau: tied Overall segment with `tiebreak: 'none'` means no money moves for that segment._

### §5.7 `payWinner` helper usage

Does this game use `payWinner()` from `payouts.js`? `[yes / no]`

If yes: `payWinner(winnerName, participatingPlayers, bet, gb)` — the `participatingPlayers` array passed must be `[specify: full players array / subset only]`.

> _Guidance: `payWinner` must never be called when two or more players share the winning score. The caller is responsible for confirming a sole winner before calling. Passing the full player array when only a subset participates causes non-participants to make or receive payments._

---

## §6. Engine API

### §6.1 Primary engine function(s)

For each engine function this game exposes:

```js
functionName(
  param1,    // type — description
  param2,    // type — description
  ...
)
// Returns:
{
  field1: type,  // description
  field2: type,  // description
}
```

> _Guidance: Copy the exact function signature from `games.js`. If parameters have been renamed between state layer, `buildPayoutArgs` layer, and engine layer, document all three names. Silent parameter mismatch (wrong argument order) produces wrong results without an error._

### §6.2 Caller responsibilities

What must the caller provide / guarantee before calling the engine function?

| Responsibility | Who enforces it |
|---|---|
| [e.g. press arrays sorted ascending] | [NewRoundPage / PressModal / engine validates / caller] |
| [e.g. exactly N players in subset] | [NewRoundPage guard] |
| [e.g. scores are integers or ''] | [ScoreGrid] |

> _Guidance: Nassau engine: "The engine assumes each press array is already valid: sorted ascending, no duplicates, all indices within segment hole range. `PressModal` is the sole write path and must enforce these invariants at write time. The engine does not normalize its inputs." This is the gold-standard statement. Mirror this pattern for every game._

### §6.3 Return value shape

```js
// Full return shape with types
{
  field: type,  // description; what null means; what 0 means vs absent
}
```

Stable API contract: `[yes — consumers depend on this shape / no — internal only]`

> _Guidance: Mark the return shape as a stable contract if any table component or display utility imports and pattern-matches it. A shape change requires coordinated updates to all consumers and a contract version bump. Skins `calcSkins` return shape is a stable contract._

### §6.4 Calling convention

- **Who calls this function:** `[ScorecardPage.jsx / scorecardUtils.js / specific table component / payouts.js]`
- **Called how often per render:** `[once per round / once per segment / once per match / other]`
- **Permitted direct engine calls in UI components:** `[list here, or "none — all calls are via props"]`

> _Guidance: See App Data Model Contract §4 for the authoritative permitted-calls list. If this game adds a new permitted direct engine call, it must be added to that list. "Table components receive all data as props and never call engine functions" is the ideal state. Exceptions must be explicitly justified._

---

## §7. UI / Display

### §7.1 Table component

Component name: `___`
File location: `___`

Header comment: does this file begin with a "render-only, no game logic" comment? `[yes / no — add it]`

### §7.2 Props received

| Prop | Type | Source (who computes/passes it) |
|---|---|---|
| `scores` | `Array[18][N]` | `ScorecardPage` |
| `players` | `Player[]` | `ScorecardPage` |
| [other props] | | |

> _Guidance: Props flow from `ScorecardPage` (state owner) down to table components. If a table component needs data that is not in its props, compute it in the engine or `scorecardUtils.js` and pass it down — do not add computation to the component._

### §7.3 Display segments and layout

Describe what the table looks like: [per-hole rows / segment summary rows / per-player columns / mixed]

Front/Back split: `[yes — two sub-tables / no — single continuous table]`

> _Guidance: Skins renders a continuous per-hole table. Nassau renders per-segment blocks with press sub-rows. Sixes renders three 6-hole segment blocks. The layout affects how missing scores and ties are displayed._

### §7.4 Cell rendering rules

| Value / state | Display |
|---|---|
| Missing score | `[·` or `—` or blank] |
| Tie | `[–` or `AS` or amber highlight] |
| Winner | [describe — chip / color / text] |
| No result | [describe] |

### §7.5 Color and style tokens

| Visual state | Token | Value |
|---|---|---|
| Winner / positive | `G` | green |
| Warning / tie | `AMB` / `AMBBG` | amber |
| Negative / losing | `RED` | red |
| [other] | | |

> _Guidance: Use only design tokens from `ui.jsx`. No hardcoded colors in table components. See the UI Component Contract for the full token list._

### §7.6 Totals and summary display

- **Per-hole totals:** [describe — shown per player per half / not shown]
- **Running totals:** [shown live / end-of-segment only / not shown]
- **PlayerChips / summary badges:** [describe what is shown]

### §7.7 scorecardUtils.js display helpers (if any)

| Function | Category | Purpose |
|---|---|---|
| `[functionName]` | [1 — pure formatter / 2 — derived state builder] | [description] |

> _Guidance: Category 1 functions take primitives and return display strings — no engine dependency. Category 2 functions call engine functions and interpret output for display. A Category 2 function must never reimplement engine logic — if its output would change when engine rules change, the logic belongs in the engine._

---

## §8. Configuration Schema (`gameOpts.[GameName]`)

Full schema of `activeRound.gameOpts.[GameName]`:

```js
{
  // All fields with types, defaults, and descriptions
  field: type,  // default: value — description
}
```

**Backward compatibility rules:**
- If a field may be absent in stored data (pre-dates this field), what default does the engine use? `[specify per field]`
- Are any legacy field names read for compatibility? `[list them]`

> _Guidance: Backward compatibility is critical — any player who saved a round before a schema change must not see corrupted payouts. Nassau supports `autoPress`/`autoPressN` as legacy fields. Document all legacy field handling explicitly. "Default to X when absent" must be stated for every optional field._

### §8.1 `buildPayoutArgs` fields required by this game

| Field | Source in `activeRound` | Notes |
|---|---|---|
| `activeGames` must include | `'[GameName]'` | |
| [other fields] | | |

> _Guidance: Every field consumed by the game's block in `computePayouts()` must be present in `buildPayoutArgs()`. Missing a field causes silent wrong payouts, not an error. See Payout Contract §4.2 checklist for the full procedure when adding a new game._

---

## §9. Validation Rules (NewRoundPage)

List every guard / validation rule enforced at round setup:

| Rule | Where enforced | Error shown to user |
|---|---|---|
| [e.g. exactly 4 players required] | NewRoundPage | [error message or banner] |
| [e.g. subset must have at least 2 players] | NewRoundPage | |
| [e.g. team A and team B must be distinct] | NewRoundPage | |

> _Guidance: Engine functions may assume valid input (they do not self-validate). All input validation is the responsibility of `NewRoundPage`. If a guard is not here, it may not exist — specify it even if you believe it is "obvious."_

---

## §10. Press UI Contract (if presses apply)

> _Skip this section entirely if §4.3 = "no presses." Write "N/A — no press support."_

### §10.1 Interaction surface

`[PressModal is the sole interaction surface / other]`

### §10.2 PressModal wiring

- `mpKey` format passed to PressModal: `'___'`
- Example: `'___'`
- Who passes `mpKey`: `[ScoreGrid / table component / other]`

### §10.3 Chip display rules

- Press chips rendered by: `[table component directly / SegmentChipColumns pattern]`
- Chip holdability rule: [describe — when can user long-press a chip to open PressModal]

### §10.4 Press array normalization

Where is the press array normalized (sorted ascending, duplicates removed)?
`[PressModal at write time / engine at read time / both]`

> _Guidance: Normalization must happen at write time in PressModal, not at engine read time. The engine assumes valid input. If PressModal normalizes incorrectly, the engine will compute wrong press results silently._

---

## §11. Derived Values — Must Not Be Stored

The following values are always recomputed on demand and must never be written to `activeRound` or history records:

| Value | Computed by |
|---|---|
| [e.g. hole winners] | `[engine function]` |
| [e.g. match lead] | `[engine function]` |
| [e.g. payout amounts] | `computePayouts()` |

> _Guidance: Caching computed values in state creates stale-state bugs. The only exception is `breakdown` and `bank` from `computePayouts()`, which are written to `activeRound` as display caches before navigating to ResultsPage — they are never used as engine inputs._

---

## §12. Architecture Boundary

This contract is implemented across three layers. Each layer has a strict role. Violating these boundaries is a contract violation.

| Layer | Files | Role |
|---|---|---|
| Engine | `games.js`, `payouts.js` | Computes all scoring outcomes. Source of truth. |
| Display logic | `scorecardUtils.js` | Interprets engine output for display. No scoring math. |
| UI | `[TableComponent].jsx`, `ScoreGrid.jsx`, `ScorecardPage.jsx` | Renders data. Handles user input. No game logic. |

### §12.1 Layer rules for this game

- All [game-specific outcome type, e.g. "hole winners, segment results, press outcomes"] originate from `[engineFunction()]` in `games.js`
- `scorecardUtils.js` may [what it may do] but may not [what is prohibited]
- UI components receive computed data via props; permitted direct engine calls are limited to: `[list or "none"]`
- [Game-specific outcome type, e.g. "Payout math"] must not appear in any UI component

### §12.2 Display-layer constraints

**Permitted in `scorecardUtils.js`:**
- [list permitted functions]

**Prohibited in `scorecardUtils.js`:**
- Any function that produces a scoring result independently
- Any reimplementation of [game-specific logic]

---

## §13. Invariants

List every condition that must hold at all times. Engine functions may assume these hold as preconditions; validation layers enforce them.

1. [invariant statement]
2. [invariant statement]
3. ...

> _Guidance: Nassau lists 9 invariants. Skins lists 12. More invariants is better — they define the valid state space. Common invariants across all games:_
> - _Payout net values across all participating players sum to 0._
> - _Score values are positive integers or `''`. No other values are valid._
> - _Hole indices are 0-based (0–17)._
> - _Engine functions are pure and deterministic: same inputs always produce same outputs._
> - _Press arrays are sorted ascending with no duplicates._
> - _Bets with `thru === 0` produce no payout._
> - _Subset player indices are stable for the duration of a round. Changing mid-round is undefined behavior._

---

## §14. Known Gaps and Open Items

| # | Severity | Description | Blocking? |
|---|---|---|---|
| G-1 | [Critical/High/Medium/Low] | [description] | [yes/no] |

Severity definitions:
- **Critical** — produces incorrect payouts or corrupts data
- **High** — displays incorrect values or blocks a user action
- **Medium** — missing feature; workaround exists
- **Low** — cosmetic or non-functional

> _Guidance: Every known gap must be here. "Known gaps" includes: features specified in this contract but not yet implemented, display bugs, incomplete payout handling, and deferred features. Mark gaps closed with ~~strikethrough~~ + "FIXED ✅" when resolved. Do not delete them — the closed list is the change history._

---

## §15. Examples

Provide at least two worked examples covering:
1. A complete happy-path scenario (all holes scored, clear winner)
2. A tie or edge case (tied segment, carry, incomplete round, etc.)

### §15.1 [Example 1 title]

```
Input: [describe setup]
Expected output: [describe result]
Computation:
  [show the arithmetic step by step]
```

### §15.2 [Example 2 title — tie or edge case]

```
Input: [describe setup]
Expected output: [describe result]
Computation:
  [show the arithmetic step by step]
```

> _Guidance: Examples are executable regression tests for the contract reviewer. If the engine produces a result that differs from an example, there is a bug. Each example must be precise enough to code a unit test from. Nassau Contract §8 examples are the gold standard._

---

## §16. Final Rule

If implementation behavior conflicts with this contract, call out the conflict. The implementation must be corrected. This document defines the truth.

---

## Template Validation Checklist

Before marking a contract as AUTHORITATIVE, verify all of the following:

- [ ] Every `[specify]` and `___` placeholder has been filled or replaced with "N/A — [reason]"
- [ ] §2.2 subset field documents both the state name and the engine parameter name
- [ ] §3.4 specifies whether `subsetMin()` is required and for which subset
- [ ] §4.2 documents what the `bet` dollar amount represents (per-player-per-event vs. total vs. other)
- [ ] §4.3 is complete if presses are supported, or explicitly marked N/A
- [ ] §5.2 provides a zero-sum proof
- [ ] §6.1 engine function signature matches actual code in `games.js`
- [ ] §6.4 specifies who calls the engine function and from which layer
- [ ] §8.1 lists all fields that must be present in `buildPayoutArgs`
- [ ] §9 documents every guard enforced in `NewRoundPage`
- [ ] §13 invariants include the universal invariants (zero-sum, pure function, no mid-round subset changes)
- [ ] §14 Known Gaps is not empty (write "None known" if truly clean)
- [ ] §15 examples are complete and arithmetically verified
- [ ] Cross-references to Handicap Contract, Payout Contract, App Data Model Contract are accurate
- [ ] Contract is added to the Document Index in `APP_STATE_SUMMARY.md`

---

## UCT Coverage Map

_This section maps each UCT section to the existing contracts it was derived from. Use it to verify the UCT is complete: every field in every existing contract must appear somewhere in this map._

| UCT Section | Nassau_Match_Contract.md | Sixes_Contract.md | Skins_Contract.md |
|---|---|---|---|
| §0 Header | §header | §header | §header |
| §1.1 Overview | §1 Core Structure | §1 Overview | §1 Overview |
| §1.2 Game key | — (implied by activeGames) | — | — |
| §1.3 Format variants | §1.1 (individual/team) | — (single format) | §2 (perSkin/pot) |
| §2.1 Player counts | §1.1 (2 for individual, 4+ for team) | §1 (exactly 4) | implicit (2+) |
| §2.2 Subset support | N/A | §1 (5-player forward §14) | §2, §3, §4, §8 |
| §2.3 Multi-instance | §1.1 (multiple matches per round) | N/A (one game) | N/A |
| §2.4 Team structure | §1.1, §8.2 | §2 (rotation) | N/A |
| §3.1 Scoring modes | §2 | §6.2 (via scoring field) | §3 |
| §3.2 Score comparison unit | §2.4 | §3 (best ball) | §4 (per-hole min) |
| §3.3 Team scoring rule | §2.4 (best of team) | §3 (best ball) | N/A |
| §3.4 Handicap application | §2.2–2.3 | §6.2 | §3 |
| §3.5 Missing score behavior | §9.6 | §3.5 | §4.2 (null return) |
| §3.6 Segment relevance | §1.3 | §2.1 | N/A (continuous) |
| §4.1 Bet type | §1.2 (Nassau = three segments) | §4.1 | §7 (perSkin/pot) |
| §4.2 Bet config fields | matchDef.betFront/Back/Overall | gameOpts.Sixes.bet | gameOpts.Skins.bet |
| §4.3 Press support | §4–§6 | §5 | N/A |
| §4.4 Tiebreak rules | §3.4, §9.5 | §3.4, §10.4 | N/A (no tiebreak) |
| §4.5 Carryover | N/A | N/A | §5 |
| §5.1 Payout structure type | per-player-per-pairing | per-player-per-winner | pool / per-skin |
| §5.2 Zero-sum proof | §8 (implied) | §4.1 (2 win, 2 lose) | §7.1–7.2 |
| §5.3 Payout formula | §8 | §4.1 | §7.1–7.2 |
| §5.4 Multi-level payout | §8.3 | §4.2 | N/A |
| §5.5 Incomplete segment | §9.6 | §3.5, §4.1 | §5.3 |
| §5.6 Tie at payout | §9.5 | §3.4 | §5.4 |
| §5.7 payWinner usage | §8.1 (implied) | §4.1 (explicit formula) | §7.1 (per-skin math) |
| §6.1 Engine function(s) | §10.1 | §2.3, §5.6 | §4.1, §4.2 |
| §6.2 Caller responsibilities | §10.1 (press array validity) | §12 (invariants) | §4.2 (param notes) |
| §6.3 Return value shape | §10.1 | §5.6 | §4.2 (Row shape) |
| §6.4 Calling convention | §10.2 | — (implied) | — (implied) |
| §7.1 Table component | §11 | §7 | §6 |
| §7.2 Props received | §11 | §7 | §6.1 |
| §7.3 Display layout | §11 (per-segment) | §7 (3 segments) | §6 (per-hole) |
| §7.4 Cell rendering | §3.3 (display conventions) | §7.2 | §6.2 |
| §7.5 Color tokens | §12 display | §7.2 | §6.2 |
| §7.6 Totals display | — | §7.1 | §6.3 |
| §7.7 scorecardUtils helpers | §12 display | — | — |
| §8 Config schema | matchDef shape §10.1 | gameOpts.Sixes §2 | gameOpts.Skins §2 |
| §8.1 buildPayoutArgs fields | §10 (implied) | §8 (implied) | §8 |
| §9 Validation rules | — (implied) | §9 | — (implied) |
| §10 Press UI contract | §5–§6 | §5.6–§8 | N/A |
| §11 Derived values | §7 | §12 (determinism) | — |
| §12 Architecture boundary | §11 | §12 | — (implied) |
| §13 Invariants | §13 | §12 | §10 |
| §14 Known gaps | §12/§14 | §8, §9 | §9 |
| §15 Examples | §8 (payout examples) | §10 | §7.1–7.2 |
