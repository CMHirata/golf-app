# Skins Contract — v1.8

**Status:** Authoritative
**Engine file:** `games.js` (`calcSkinsHole`, `calcSkins`)
**Table component:** `SkinsTable.jsx`
**Payout logic:** `payouts.js` §Skins section
**Cross-references:** App Data Model Contract §5.5, Payout Contract §7.2, Handicap Contract §5, **PartialGameContract.md §11.4 / §11.9**

_Changes in v1.8 (13-C.7, post-device-test): departure handling. §3.2 (new) — Skins-specific `continue` partition: when a player departs and the user picks `continue` for Skins, holes past the departure are contested only by the remaining-subset of players who haven't yet departed. Display-side partition shipped in `SkinsTable.jsx` per `PartialGameContract.md` §11.4 implementation status table; engine-side partition deferred to 13-C.8. §3.3 (new) — engine departure data guardrail: scores stored at `scores[h][pi]` for `h > earlyDepartureOpts[pi].departureHole` are ignored regardless of value (numeric, X, or empty), per PartialGameContract §11.9 / §14 invariant 21. `SkinsTable.jsx` applies `applyDepartureGuardrailToScores` from `scorecardUtils.js` at the top of the component body before any aggregation. §6.1 (amended) — per-hole eligibility partition under `continue` documented; subset filtering for `continue` is per-hole (not whole-game) and changes mid-game as players depart. §10 — invariant 9 amended to allow per-hole subset variation under `continue`; invariants 13 and 14 added covering the engine departure data guardrail and the per-hole eligibility partition rule._
_Changes in v1.7 (13-C.3 Phase 2A): §3.1 (new) — partial-range Skins specification.
Documents `gameRanges['Skins']` resolution, `trimScoresToRange` pre-processing,
carryover semantics within custom range, no-skin-awards-for-out-of-range
guarantee. No engine changes — implementation is entirely in `payouts.js`
pre-processing layer (PartialGameContract invariant #13.c)._
_Changes in v1.6: `gameOpts.Skins.scoring` renamed to `gameOpts.Skins.grossNetNOL` throughout. §2 field table and §8 buildPayoutArgs table updated._
_Changes in v1.5: §2 — `carryover` type changed from `'yes'|'no'` string to `boolean`; default `true`. UI label mapping documented. Engine read site updated. `SkinsTable.jsx` read site updated. Migration shim documented in App_Data_Model_Contract.md §7.1._
_Changes in v1.4: G-3 closed — NOL+subset fix implemented in `payouts.js` Skins block via
`subsetMin()` helper (Payout Contract §4.3). §3 NOL+subset rule updated to reflect fix
location. §8 `minCHcp` row updated. §9 G-3 marked closed._

---

## 1. Overview

Skins is a per-hole competition where the player with the sole best score on
a hole wins a "skin." If two or more players tie for best score, no skin is
awarded on that hole. With carryover enabled, tied holes accumulate value
that is awarded on the next hole with a sole winner. The player who wins the
most skins wins the most money.

Two payout modes are supported: **`perSkin`** (each player contributes a
fixed amount per skin won by anyone) and **`pot`** (fixed buy-in split by
skins won). See §7 for full payout logic for each mode.

---

## 2. Configuration (`gameOpts.Skins`)

| Field | Type | Default | Description |
|---|---|---|---|
| `mode` | `'perSkin'`\|`'pot'` | `'perSkin'` | Payout mode — see §7 |
| `bet` | `number` | `0` | $ per player per skin (`perSkin`) or $ per player buy-in (`pot`) |
| `grossNetNOL` | `'gross'`\|`'net'`\|`'netofflow'` | `'net'` | Handicap scoring mode |
| `carryover` | `boolean` | `true` | `true` = tied holes carry value forward; `false` = tied holes void. UI label: "Carryover" / "No Carryover". Legacy string values `'yes'`→`true`, `'no'`→`false` handled by migration shim and engine read site. |

**`mode` field backward compatibility:** Existing rounds in localStorage
that pre-date the `mode` field will have it absent. The payout layer must
default `mode` to `'perSkin'` when absent — this preserves all existing
payout behavior, as the legacy formula is equivalent to `perSkin`.

**`bet` interpretation by mode:**
- `perSkin` — `bet` is the per-player contribution per skin. Each skin is
  therefore worth `bet × subsetSize`. Total money in play varies with the
  number of skins awarded.
- `pot` — `bet` is each participating player's fixed buy-in. Total pot =
  `bet × subsetSize`. The pot is divided by total awarded skins to derive
  each skin's unit value.

Both modes represent equal-contribution systems: in `perSkin`, players
contribute per skin; in `pot`, players contribute once at the start.

**Subset field:** `skinsPlayers` (top-level on `activeRound`, not nested
inside `gameOpts.Skins`) — array of player indices participating in Skins.
Empty array or absent means all players participate.

`skinsPlayers` is fixed at round creation and must not change for the
duration of the round. Changing the subset mid-round is undefined behavior.

---

## 3. Scoring Mode

Skins supports all three standard scoring modes via `scoreForMode`:

- **`gross`** — raw stroke count; no handicap adjustment
- **`net`** — stroke count minus handicap strokes (standard net)
- **`netofflow`** — net off the field low; subtracts the minimum course
  handicap of all participating players

There are no Skins-specific handicap wrinkles beyond what `scoreForMode`
already handles. The handicap inputs passed to `calcSkins` are the same
`courseHcps` and `minCourseHcp` used by all other games.

**NOL + subset rule:** When `skinPlayerIdxs` is non-empty and scoring mode
is `'netofflow'`, the `minCourseHcp` passed to `calcSkins` must be the
minimum course handicap of the subset players only. This is enforced inside
`computePayouts` in `payouts.js` via the `subsetMin()` helper (Payout
Contract §4.3) — it is not the responsibility of `buildPayoutArgs`.

> ✅ **G-3 CLOSED:** `payouts.js` Skins block now computes `skinsMin =
> subsetMin(cHcps, idxs, minCHcp, scoringMode)` and passes `skinsMin` to
> `calcSkins`. Full-field `minCHcp` is no longer used when a subset is active
> and mode is `netofflow`.

### 3.1 Partial-range Skins (13-C.3 Phase 2A)

When a Skins game has a custom range (`gameRanges['Skins']` is set) or the
round itself is shorter than 18 holes, hole evaluation is restricted to the
effective range `[startHole, endHole]`. Out-of-range holes contribute no
skin opportunity and no carryover.

**Implementation:** `payouts.js` Skins block resolves the per-game range via
`gameRange('Skins')`, then iterates the engine over only those holes. Score
arrays are pre-trimmed via `trimScoresToRange` so any logic that internally
loops 0..17 still produces correct results — out-of-range holes appear as
empty (no winner, no carry).

**Carryover within a custom range:** Skins carryover semantics are unchanged
within the effective range. A tied first hole within the range carries to
the next in-range hole. The final hole of the range is treated as the
"final-hole tie rule" anchor (§5.4) — there is no carryover beyond
`endHole` regardless of whether holes exist after it in the round.

**No skin awards for out-of-range holes.** Even if a player has scores on
holes outside the Skins range (e.g. they were entered for another game),
those holes do not contribute to Skins payouts. This is a pre-processing
guarantee, not a runtime check inside `calcSkins`.

### 3.2 Early-departure partition — `continue` resolution (13-C.7)

When a player departs early and the user selects `continue` in the
resolver sheet (PartialGameContract.md §11.4), Skins continues for the
remaining subset of players from `departureHole + 1` onward. Skins won
pre-departure (where the departed player participated) are kept as-is
in the breakdown; skins won post-departure are contested only by the
remaining-subset (the departed player is excluded from the per-hole
sole-best evaluation).

**Per-hole eligibility partition:** for each hole `h` in the Skins
range, the active player subset is computed as the original
`skinsPlayerIdxs` minus any player `pi` with
`earlyDepartureOpts[pi]?.departureHole < h` AND
`earlyDepartureOpts[pi]?.gameResolutions?.Skins?.topLevel === 'continue'`.
Players whose Skins resolution is `abandon` or `end_at_k` cause Skins
to drop out entirely from hole `departureHole + 1` onward (game ends
or is abandoned per the standard rules); players whose resolution is
`exclude_player` are removed retroactively from the entire Skins range.
Only `continue` triggers the per-hole eligibility partition.

**Implementation status (v1.8):**

| Site | Status |
|---|---|
| `SkinsTable.jsx` (display) | ✅ implemented in 13-C.7. Per-hole eligible-subset partition computed inline; share image scorecard inherits via the table render. |
| `payouts.js` Skins block (engine) | ⏳ deferred to 13-C.8. Currently the engine departure data guardrail (§3.3) zeroes out post-departure scores, which produces output equivalent to `end_at_k` for the engine pipeline. The `continue` partition with reduced-subset post-departure recompute lands in 13-C.8. |

The display-side and engine-side outputs will agree once 13-C.8 ships.
Until then, mid-round `SkinsTable.jsx` shows the correct `continue`
partition; the saved-round payouts breakdown will look like
`end_at_k` — they converge after 13-C.8.

### 3.3 Engine departure data guardrail (13-C.7)

Per PartialGameContract.md §11.9 / §14 invariant 21, any score stored at
`scores[h][pi]` for hole `h > earlyDepartureOpts[pi].departureHole` is
ignored at compute time regardless of value (numeric, X, or empty),
regardless of how it ended up in storage (auto-saved before a long-press
X gesture, imported from legacy data, etc.).

**`SkinsTable.jsx` MUST apply `applyDepartureGuardrailToScores` from
`scorecardUtils.js` at the top of the component body before any
aggregation.** When `earlyDepartureOpts` is empty or absent, the
guardrail is a no-op — byte-identical to pre-13-C.7 rendering.

The engine pipeline (`payouts.js`) applies its own inline copy of the
same guardrail per the dual-implementation rule. Both sites must remain
in semantic lockstep.

---

## 4. Engine API

### 4.1 `calcSkinsHole`

```js
calcSkinsHole(h, scores, players, hcps, mode, courseHcps, minCourseHcp, skinPlayerIdxs)
→ { tied: boolean, wiIdx: number|null } | null
```

- `h` — 0-based hole index (0–17)
- `skinPlayerIdxs` — array of player indices to include; empty/absent = all players
- Score completeness is evaluated against `skinPlayerIdxs` only. A missing
  score for a non-subset player has no effect on this hole's result.
- Returns `null` if and only if any **subset** player has no score on hole
  `h`. If all subset players have scores, a result object is always returned.
- Returns `{ tied: true, wiIdx: null }` when two or more subset players
  share the minimum score
- Returns `{ tied: false, wiIdx: <playerIndex> }` when exactly one subset
  player has the minimum score

### 4.2 `calcSkins`

```js
calcSkins(scores, players, hcps, mode, carryover, courseHcps, minCourseHcp, skinPlayerIdxs)
→ { rows: Row[], totals: { [playerName]: number } }
```

**Parameters:**

| Param | Type | Notes |
|---|---|---|
| `scores` | `scores[hole][playerIdx]` | Raw stroke counts |
| `players` | `Player[]` | Full player array |
| `hcps` | `number[]` | Per-hole handicap stroke indices (1–18) |
| `mode` | scoring mode string | `'gross'`\|`'net'`\|`'netofflow'` |
| `carryover` | `boolean` | `true` = accumulate ties; `false` = ties void |
| `courseHcps` | `number[]` | Course handicap per player (signed integers) |
| `minCourseHcp` | `number` | Minimum course handicap across **subset** players (see §3) |
| `skinPlayerIdxs` | `number[]` | Subset indices; empty = all |

**Naming note:** `skinPlayerIdxs` (engine parameter) is derived from
`activeRound.skinsPlayers` (state field) by `buildPayoutArgs`. These are
different names at different layers by design — `skinsPlayers` is the state
schema name; `skinPlayerIdxs` is the engine boundary name.

**Row shape (stable API contract):**

```js
// Tied hole
{ h: number, tied: true, carry: number }
// carry = number of skins accumulated so far (including this hole)
// carry is always 0 when carryover === false

// Won hole
{ h: number, wiIdx: number, value: number }
// value = 1 (no carryover) or 1 + accumulated carry (with carryover)
// carry resets to 0 after a won hole; next tied hole increments from 0
```

The `rows` output shape is a stable contract between `calcSkins` and all
consumers (including `SkinsTable`). Any change to this shape requires
coordinated updates to all consumers and a contract version bump.

**`totals`** — object keyed by `player.name`, value = total **awarded**
skins won. Initialized to `0` for every player in the full `players` array,
including non-subset players. Non-subset players must always remain at `0`
and must be excluded from payout calculations (see §10, Invariant 2).

Unawarded skins (from tied holes or unresolved carry) are never reflected
in `totals`. Payout calculations must use `totals` exclusively — tied holes
and unresolved carry have no monetary value and must not be included in any
payout computation.

---

## 5. Carryover Rules

### 5.1 Normal carryover (`carryover: true`)

When a hole is tied:
- No skin is awarded
- The `carry` counter increments by 1
- The row records `{ tied: true, carry: <current_carry> }`

When a subsequent hole has a sole winner:
- The winner receives `1 + carry` skins
- `carry` resets to 0
- The row records `{ wiIdx, value: 1 + carry }`

Carry accumulates indefinitely across consecutive tied holes.

### 5.2 No carryover (`carryover: false`)

When a hole is tied:
- No skin is awarded and no value carries forward
- `carry` is never incremented; it stays 0 for the entire round
- Row records `{ tied: true, carry: 0 }`

When a hole has a sole winner:
- The winner receives exactly 1 skin (value is always 1)

### 5.3 Incomplete rounds and carry loss

`calcSkins` iterates holes 0–17 and calls `calcSkinsHole` each iteration.
If `calcSkinsHole` returns `null` (any subset player missing a score), the
loop breaks immediately.

Any carry accumulated up to the break point is lost — it is never awarded
to any player's `totals`. This applies in both cases:

- **Full round, final hole tied** (hole 17 produces a tied result): carry
  entering hole 17 plus hole 17's own increment are both lost.
- **Incomplete round, last entered hole tied** (e.g., hole 11 tied, hole
  12 not yet entered): accumulated carry is void even though subsequent
  holes are unplayed.

In both cases the behavior is identical and intentional: carry that reaches
the end of scored holes without a sole winner is voided.

### 5.4 Final-hole tie rule

If the last scored hole results in a tie (regardless of accumulated carry),
no skin is awarded. Any carry value that reached that hole is lost — it is
not redistributed and does not appear in `totals`. This rule applies
identically under both `perSkin` and `pot` modes.

**This is enforced by the engine loop itself:** the tied row is appended,
the loop ends, and no winning row is ever appended for that carry. `totals`
is derived only from rows where `wiIdx != null`, so the lost carry
correctly contributes `0` to all players.

> ✅ **Code vs. intent:** The final-hole void logic is correctly implemented
> by the loop structure in `calcSkins`. No special final-hole correction is
> needed in the engine or payout layer.

---

## 6. Display — `SkinsTable`

### 6.1 Subset filtering — FIXED ✅

`SkinsTable` accepts a `skinsPlayerIdxs` prop. When non-empty, only the
players at those indices are rendered as table rows and included in the
`PlayerChips` summary. The `players` prop remains the full player array
for index lookups. Filtering is purely a display concern.

`calcSkinsHole` is called with the `skinPlayerIdxs` arg so hole results
reflect only subset player scores.

**v1.8 (13-C.7) amendment — per-hole eligibility under `continue`:** when
a player departs and their Skins resolution is `continue`, the table's
per-hole call to `calcSkinsHole` MUST receive a per-hole-derived
`skinPlayerIdxs` reflecting which players are still active at that hole,
not the static `skinsPlayerIdxs` prop. The static prop defines the
original game subset; the dynamic per-hole subset = `skinsPlayerIdxs` ∩
`{pi : pi has not departed by hole h, OR pi's Skins resolution is not 'continue'}`.
For holes ≤ `departureHole` for any departed player with `continue`,
that player IS still in the subset (they participated). For holes >
`departureHole` for that player, they are excluded. See §3.2 for the
full partition spec.

This also means the `PlayerChips` summary renders different active sets
across the round; the chip for a `continue`-departed player still appears
(showing skins won pre-departure) but does not contribute to post-
departure hole evaluations.

### 6.2 Cell rendering

| Value | Display |
|---|---|
| `null` (no score) | `·` (dim dot) |
| `'tie'` | `–` (grey dash) |
| `0` (no skin) | `·` (light dot) |
| `1` (skin, no carry) | Filled chip, normal background |
| `>1` (skin with carry) | Filled chip, darker background (`#c4aaf0`) |

Column header: `"Skins"`
Badge: `"<ScoringLabel> · Carry on"` or `"<ScoringLabel> · Carry off"`
Footer note: `"Number = skins on that hole · darker = carryover · – = tied"`

### 6.3 Totals

`PlayerChips` at the bottom shows total awarded skins won per player across
all 18 holes. The chip with the most skins is highlighted as the leader.

Per-half totals (front 9, back 9) are shown in the rightmost column of
each half-table.

---

## 7. Payout

Payout calculations must be based exclusively on awarded skins (`totals`).
Tied holes and unresolved carry have no monetary value and must not be
included in any payout computation under either mode.

In `perSkin` mode, `bet` is the per-player contribution per skin. Each
skin is therefore worth `bet × subsetSize`.

### 7.1 Mode: `perSkin`

Each player contributes `bet` per skin won by anyone in the subset.
Each skin is worth `bet × subsetSize` to the winner.

```
totalAwardedSkins = sum of totals[p.name] across all subset players

if totalAwardedSkins === 0:
  net[p] = 0 for all players   // no skins awarded; no exchange

else:
  skinValue = bet × subsetSize
  pp        = totalAwardedSkins × bet   // each player's total contribution
  gross[p]  = totals[p.name] × skinValue
  net[p]    = gross[p] - pp
```

**Zero-sum check:**
```
sum(net[p]) = sum(totals[p] × bet × subsetSize) - subsetSize × (totalAwardedSkins × bet)
            = totalAwardedSkins × bet × subsetSize - totalAwardedSkins × bet × subsetSize
            = 0  ✓
```

**Example:** 4 players, `bet = $1`, player A wins 5 skins of 8 total:
```
skinValue = $1 × 4 = $4
pp        = 8 × $1 = $8
gross[A]  = 5 × $4 = $20
net[A]    = $20 - $8 = +$12
```

### 7.2 Mode: `pot`

Each player contributes a fixed buy-in of `bet`. The total pot is fixed
regardless of how many skins are awarded.

```
pot               = bet × subsetSize
totalAwardedSkins = sum of totals[p.name] across all subset players

if totalAwardedSkins === 0:
  net[p] = 0 for all players   // pot effectively returned; no exchange

else:
  skinUnitValue = pot / totalAwardedSkins
  gross[p]      = totals[p.name] × skinUnitValue
  pp            = bet           // each player's fixed buy-in
  net[p]        = gross[p] - pp
```

**Zero-sum check (non-zero skins case):**
```
sum(net[p]) = sum(totals[p] × skinUnitValue) - subsetSize × bet
            = totalAwardedSkins × (pot / totalAwardedSkins) - pot
            = pot - pot
            = 0  ✓
```

**Zero-skin case:** If `totalAwardedSkins === 0` (all holes tied or no holes
scored), no payouts occur and all players' net is `0`. The pot is effectively
returned — no money exchanges hands. This preserves the zero-sum invariant.

### 7.3 No-payout conditions (both modes)

- `bet === 0` → no money moves; breakdown rows still shown with `$0`
- `totalAwardedSkins === 0` → no payout; breakdown rows still shown

### 7.4 Breakdown row format

```js
{
  name:   p.name,
  detail: `${totals[p.name]} skins`,
  net:    gb[p.name] || 0,
}
```

Rows sorted descending by `net`. All subset players appear (including those
with 0 skins). Non-subset players do not appear.

### 7.5 Fractional payouts

Both modes may produce fractional dollar amounts (e.g., `$1.67`). These are
not rounded — fractional payouts are correct and accepted, consistent with
Payout Contract §5.0.

---

## 8. `buildPayoutArgs` fields

The following fields must be present in the args object passed to
`computePayouts` for Skins to function:

| Field | Source | Notes |
|---|---|---|
| `activeGames` | Must include `'Skins'` | |
| `gameOpts.Skins.mode` | Setup config | Defaults to `'perSkin'` when absent |
| `gameOpts.Skins.bet` | Setup config | Per-player contribution per skin (`perSkin`) or per-player buy-in (`pot`) |
| `gameOpts.Skins.grossNetNOL` | Setup config | |
| `gameOpts.Skins.carryover` | Setup config | Boolean as of v1.5. Engine read site: `gameOpts.Skins?.carryover === false ? false : true` — handles `true`, `false`, legacy `'yes'`/`'no'`, and absent. `SkinsTable.jsx` read site: `opts?.carryover !== false`. |
| `skinsPlayers` | `activeRound.skinsPlayers` | Passed as `skinPlayerIdxs` to engine |
| `scores` | `activeRound.scores` | |
| `players` | `activeRound.players` | |
| `hcps` | Course hole handicap indices | |
| `cHcps` | Pre-computed course handicaps per player | |
| `minCHcp` | Computed inside `payouts.js` Skins block via `subsetMin(cHcps, idxs, minCHcp, scoringMode)` — subset minimum when NOL+subset active, full-field minimum otherwise | ✅ Fixed — Payout Contract §4.3 |

---

## 9. Known Gaps and Open Items

| # | Severity | Description |
|---|---|---|
| ~~G-1~~ | ~~Medium~~ | ~~`SkinsTable` does not filter rows by `skinsPlayers` subset~~ — **FIXED ✅** |
| ~~G-2~~ | ~~Medium~~ | ~~`SkinsTable` calls `calcSkinsHole` without passing `skinPlayerIdxs`~~ — **FIXED ✅** |
| ~~G-3~~ | ~~Medium~~ | ~~NOL + subset: `buildPayoutArgs` derives `minCourseHcp` from all players~~ — **FIXED ✅** via `subsetMin()` in `payouts.js` Skins block |

---

## 10. Invariants

1. `calcSkins` always returns `totals` with an entry for every player in
   the full `players` array (not just subset players), initialized to `0`.
2. Non-subset players must always have `totals[name] === 0` and must be
   excluded from all payout calculations. Iterating `totals` directly in
   the payout layer without filtering to the subset is a contract violation.
3. Carry can only increase on tied holes and resets to `0` after a won hole.
   The sequence is: win → `carry = 0`; next tied hole → `carry = 1`.
4. When `carryover === false`, all tied rows must have `carry === 0` for
   the entire round.
5. Carry accumulated past the last scored hole is always `0` in `totals`
   (lost, not redistributed). This applies to both incomplete rounds and
   final-hole ties.
6. `rows` length equals the number of holes with complete scores for all
   subset players (stops at first hole with any subset player missing a score).
7. Sum of all `totals` values equals sum of all `r.value` across won rows
   (`totalAwardedSkins`).
8. Payout net values across all subset players sum to `0` under both modes.
9. **(amended v1.8 / 13-C.7)** `skinPlayerIdxs` is fixed for the
    duration of a round at the **engine API call boundary** —
    `calcSkinsHole` and `calcSkins` are called with a single static
    subset for legacy / non-departure rounds. Under v2.0 of
    `PartialGameContract`, when one or more players' Skins resolution
    is `continue`, the `SkinsTable.jsx` display layer derives a
    per-hole subset and calls `calcSkinsHole` per hole with that
    derived subset (§6.1 / §3.2). The engine itself remains stateless
    across calls; the per-hole subset variation is entirely a
    display-layer concern. Engine `payouts.js` integration of the
    per-hole subset partition is 13-C.8 work.
10. In `pot` mode, `totalAwardedSkins === 0` results in zero net for all
    players. The pot is never redistributed when no skins are awarded.
11. Payout calculations use `totals` (awarded skins) exclusively. Unawarded
    carry and tied holes have no monetary value and must not appear in any
    payout computation under either mode.
12. In `perSkin` mode, each skin is worth `bet × subsetSize`. Each player's
    total contribution is `totalAwardedSkins × bet` regardless of how many
    skins they personally won.
13. **(NEW v1.8 / 13-C.7)** Engine departure data guardrail. Any score
    stored at `scores[h][pi]` for `h > earlyDepartureOpts[pi].departureHole`
    is ignored by `SkinsTable.jsx` and `payouts.js` Skins block at
    compute time, regardless of value. `SkinsTable.jsx` MUST apply
    `applyDepartureGuardrailToScores` from `scorecardUtils.js` at the
    top of the component body before any aggregation. See §3.3 and
    PartialGameContract §11.9 / invariant 21.
14. **(NEW v1.8 / 13-C.7)** Per-hole eligibility partition for
    `continue`. When `earlyDepartureOpts[pi].gameResolutions.Skins.topLevel
    === 'continue'` for some player `pi`, `SkinsTable.jsx`'s call to
    `calcSkinsHole` for hole `h > earlyDepartureOpts[pi].departureHole`
    MUST exclude `pi` from the subset. For `h <= earlyDepartureOpts[pi].departureHole`,
    `pi` remains in the subset. This rule applies independently per
    departed-with-`continue` player; the per-hole subset is the
    intersection of all such per-player active sets. See §3.2 / §6.1.

---

## X Score Behavior

_Added session 13-B. See `ScoreKeypad_Contract.md` §4.5–§4.6 for the full "X always loses" invariant._

- A player with `'X'` on a hole cannot win a skin, regardless of other players' scores.
- If all participating players have `'X'` on the same hole, the hole is tied (skin carries per the carryover setting).
- Implementation: `calcSkinsHole` excludes X players from the min calculation by filtering them out. All-X returns `{ tied: true, wiIdx: null }`.
