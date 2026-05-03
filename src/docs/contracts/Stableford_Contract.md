# Stableford Contract

_Version 1.7 — April 2026_
_Supersedes: Stableford Contract v1.6._
_Changes in v1.7 (13-E): Setup UI references updated to reflect the `GameConfig.jsx` 7-file split. The Stableford config panel now lives in `GameConfigStableford.jsx` (panel file). Shared sub-components referenced (`TeamPickerPair`, `BetSection`, `PlayerSubsetDropdown`) are imported by the panel from `GameConfigShared.jsx`. §9.4 team-mode UI guards table location column updated to reference panel file — behavior unchanged. Pure reorganization — no behavior change. See `BUILD_PLAN.md` Architectural Decision #26._
_Changes in v1.6 (13-C.3 Phase 2A):
§3.7 (new) — partial-range note: F/B/T derived via PartialGameContract §3.6 midpoint when `gameRanges['Stableford']` is set or round is shorter than 18 holes; team mode's engine call to `calcTeamStablefordTotal` passes the optional `range` argument.
§5.3 — segments-mode individual payout formula updated: `paySegStab` now returns a per-name delta map for column emission. Columnar breakdown emission documented (`colHeaders: ['Front', 'Back', 'Total', 'Game Total']`, `matchCols: [f, b, o, f+b+o]`).
§5.7 — segments-mode team payout formula updated: `payTeamSeg` now returns a per-name delta map. Columnar breakdown emission documented; both teammates on the winning side receive identical column values per §4.7 head-to-head rule.
No engine API or invariant changes. The `calcTeamStablefordTotal` `range` argument is documented in PartialGameContract §3.6 / §14 invariant #13.b._
_Changes in v1.5: §1.3 — `'total'` added as third explicit `betMode` value (replaces unnamed else-branch; split-pot semantics). §2.4, §2.5 — team format support. §3.3 — team scoring rule (`'cumulative'`/`'bestball'`). §3.5 — condor key `'4'` added (default 6 pts); clamp expanded to `[-3, 4]`. §4.4–§4.7, §5.6, §5.7 — team bet modes, tiebreak, payout formulas. **Correction in v1.5:** §4.4, §4.7, §5.6, §5.7, §15.5, §15.6 — team settlement is per-player at full rate (not ½ share); teammates always receive identical payouts. §6.3 — `calcTeamStablefordTotal` spec. §7.2, §7.9 — team display. §8.1, §8.2 — schema. §9.4 — UI guards. §13 invariants 17–21. §14 G-3. `App_Data_Model_Contract.md` → v3.1._
_Status: AUTHORITATIVE_
_All implementation must conform to this contract._
_If code conflicts with this contract, the contract wins._

---

**Engine file(s):** `engine/games.js`, `engine/payouts.js`, `engine/handicap.js`
**Table component:** `pages/tables/StablefordTable.jsx`
**Payout logic location:** `payouts.js` — Stableford block (search `activeGames.includes('Stableford')`)
**Cross-references:**
- `Handicap_Contract.md` §6 — `stabPts`, `DEFAULT_STAB`, scoring modes
- `Handicap_Contract.md` §5 — NOL+subset invariant; `subsetMin()` pattern
- `Payout_Contract.md` §4.3 — `subsetMin()` universal implementation rule
- `Payout_Contract.md` §7.4 — Stableford payout block spec
- `App_Data_Model_Contract.md` §5.5 — `gameOpts.Stableford` schema (v3.1)
- `App_Data_Model_Contract.md` §5.8 — `stablefordPlayers` field
- `App_Data_Model_Contract.md` §10 — `buildPayoutArgs` synchronization rule

---

## §1. Overview and Game Identity

### §1.1 Plain-language description

Stableford is a points-based scoring format. Each player earns points on every hole
based on how their score compares to par (after handicap adjustment). Higher points
are better. The game accumulates points across 18 holes and settles at the end of
the round according to the configured payout mode. Three payout modes are available:
per-point (pairwise point-differential, default), total (highest points wins, tied
winners split pot), and F/B/T (three independent segment bets). Unlike Match Play,
no hole-by-hole settlement occurs — only end-of-round payout.

Two formats are supported: **individual** (default) and **team** (two fixed two-player
teams competing for the full 18 holes).

### §1.2 Game key (activeGames entry)

The string identifier in `activeGames[]` for this game is: `'Stableford'`

This must match exactly what is stored in `activeRound.activeGames`, used in the
`computePayouts()` conditional block, and displayed in game config UI. A mismatch
causes silent non-payout.

### §1.3 Format variants

| Variant | UI label | Stored `betMode` | Description | Configured by |
|---|---|---|---|---|
| `'perpoint'` | Per Point | `'perpoint'` | Pairwise point-differential payouts; `bet` moves per point of differential across all unordered player pairs (individual) or the single team pair (team). **Default.** | `gameOpts.Stableford.betMode` |
| `'total'` | Total | `'total'` | Highest 18-hole point total wins; losers each pay `bet`; tied winners split the pot equally. All tied = push. | `gameOpts.Stableford.betMode` |
| `'segments'` | F/B/T | `'segments'` | Three independent segments (F9, B9, 18-hole); highest points per segment wins `bet` (or per-segment override); tied winners split; all tied = push. | `gameOpts.Stableford.betMode` |

Default variant: **`'perpoint'`**.

> **Engine fallback chain:** `opts.betMode ?? opts.stabBetMode ?? 'perpoint'`
>
> **Legacy values retired from UI:** `'nassau'` → `'segments'`; `'single'` → `'perpoint'`
> (migration shim in `roundLib`). Any stored value other than `'perpoint'`, `'total'`,
> or `'segments'` falls to `'total'` behavior as the default else-branch.
>
> **Previous else-branch:** The unnamed else-branch previously implemented sole-winner
> semantics (one winner takes all). This is replaced by the explicit `'total'` mode
> with split-pot semantics. Legacy rounds hitting the else-branch had values migrated
> to `'perpoint'` or `'segments'` by the existing `roundLib` shim — no stored round
> should reach the else-branch with real data.

---

## §2. Eligibility and Players

### §2.1 Valid player counts

| Player count | Individual valid? | Team valid? | Notes |
|---|---|---|---|
| 2 | Yes | No | `perpoint` produces one pairwise comparison |
| 3 | Yes | No | Subset picker shown |
| 4+ | Yes | Yes | Team requires exactly 4 (2 per team) |

Minimum for individual: 2 players in the subset.
Minimum for team: exactly 4 players in the round (2 per team).
Maximum: no hard maximum for individual (practical limit = active players in round).

> **Subset picker trigger:** `PlayerSubsetChips` rendered only when `players.length > 2`
> and `format === 'individual'`. With exactly 2 players there is no picker. In team
> mode the subset picker is always hidden — see §2.5.

### §2.2 Subset support

Yes — Stableford supports a player subset **in individual mode only**.

- **State field:** `activeRound.stablefordPlayers` — type: `number[]`; `[]` = all players
- **History record field:** `stableford_players`
- **`buildPayoutArgs` key:** `stablefordPlayers`
- **Engine parameter name:** `stabIdxs` (derived inside `computePayouts()`)
- **Selection UI:** `PlayerSubsetChips` in `NewRoundPage`, shown only when
  `players.length > 2` and `format === 'individual'`
- **Subset is fixed at:** Round creation (setup screen)

**Subset resolution in engine (individual mode):**
```js
const stabIdxs = stablefordPlayers?.length
  ? stablefordPlayers
  : players.map((_, i) => i);
```

### §2.3 Multi-instance support

No. There is exactly one Stableford game per round. The `activeGames` array may
contain `'Stableford'` at most once. The payout block fires once.

### §2.4 Team structure

Stableford supports an optional team format, enabled by `gameOpts.Stableford.format === 'team'`.
In team mode the game is played between two fixed two-player teams (Team A and Team B)
for the full 18 holes. All individual per-hole point calculations via `stabPts` remain
unchanged — the team scoring rule is a post-calculation aggregation step.

**Player count:** Exactly 4 players required in team mode (2 per team). If fewer than
4 players are in the round, the Teams option is unavailable in the UI. Engine behavior
with fewer players is undefined.

**Team assignment:** `gameOpts.Stableford.teamA` and `gameOpts.Stableford.teamB` — each
an array of exactly 2 player indices referencing `activePlayers`.

### §2.5 Subset interaction in team mode

In team mode, the four team players define the full participant set. `stablefordPlayers`
is **ignored** — the payout engine derives the participant set as `teamA ∪ teamB`. The
subset picker (`PlayerSubsetChips`) must not be rendered when `format === 'team'`.

In individual mode (`format === 'individual'` or absent), `stablefordPlayers` behaves
exactly as §2.2 — no change.

**Migration fallback:** Rounds with no `format` field treat `format` as `'individual'`.
Engine reads `opts.format ?? 'individual'`. No migration shim needed.

---

## §3. Scoring

### §3.1 Scoring modes

Three modes supported, configured via `gameOpts.Stableford.grossNetNOL`:

| Mode | Description |
|---|---|
| `'net'` | Each player's gross score reduced by per-hole stroke allocation. Default. |
| `'gross'` | Raw scores, no handicap adjustment. |
| `'netofflow'` | Strokes relative to lowest course handicap in the Stableford participant set. |

Default: `'net'`.

### §3.2 Score comparison unit

Points per hole, accumulated across holes. Comparison is always by total point
accumulation — never by hole-by-hole result or direct score comparison.

### §3.3 Team scoring rule

Configured via `gameOpts.Stableford.scoring`. Two values:

| Value | UI label | Description |
|---|---|---|
| `'cumulative'` | Cumulative | Team score per hole = **sum** of both teammates' individual Stableford points. **Default.** |
| `'bestball'` | Best Ball | Team score per hole = **better** of the two teammates' individual Stableford points. |

Per-hole individual points are always computed first via `stabPts` (with full handicap
application per §3.4), then aggregated per the scoring rule. Handicap is applied at
the individual level only — the scoring rule operates on already-computed `stabPts` values.

**Field fallback:** `opts.scoring ?? 'cumulative'`

**UI:** Scoring rule dropdown shown in team mode only, at the bottom of the Stableford
settings tile. Same pattern as Sixes / Match scoring dropdown.

**Field is ignored in individual mode.**

### §3.4 Handicap application

Per-hole net score computed by `scoreForMode(gross, courseHcp, rank, minCourseHcp, mode)`
inside `stabPts`. See Handicap Contract §6.

**NOL+subset rule:** When `mode === 'netofflow'`, the `minCourseHcp` reference value must
be the minimum course handicap among the participant set only:
- Individual mode: Stableford subset (`stabIdxs`)
- Team mode: `teamA ∪ teamB`

```js
const stabMin = subsetMin(cHcps, participantIdxs, minCHcp, mode);
```

See Payout Contract §4.3 and Handicap Contract §5. ✅ Implemented in payout engine.

### §3.5 Points table

Points per hole determined by `stabPts(gross, par, courseHcp, rank, minCourseHcp, mode, stabTable)`
in `handicap.js`.

The lookup key is `d = clamp(par − net, −3, 4)` where positive `d` = under par (good).

**Sign convention (counterintuitive — read carefully):**
Because `d = par − net`, a _positive_ key means under par and a _negative_ key means
over par. Key `'4'` = condor (4 under par) = 6 points. Key `'-3'` = triple bogey
or worse = 0 points.

**Clamp is asymmetric:** Lower bound `-3`, upper bound `4`. There is no key `'-4'`.
Scores worse than triple bogey are clamped to `-3`. Scores better than condor (5+ under)
are clamped to `4`.

**`DEFAULT_STAB`** (from `handicap.js`):

| Key (`d = par − net`) | Score relative to par | Default points |
|---|---|---|
| `'4'` | Condor / 4 under | 6 |
| `'3'` | Albatross / 3 under | 5 |
| `'2'` | Eagle / 2 under | 4 |
| `'1'` | Birdie / 1 under | 3 |
| `'0'` | Par | 2 |
| `'-1'` | Bogey | 1 |
| `'-2'` | Double bogey | 0 |
| `'-3'` | Triple bogey or worse | 0 |

```js
export const DEFAULT_STAB = { '-3':0, '-2':0, '-1':1, '0':2, '1':3, '2':4, '3':5, '4':6 };
```

> **Warning — storage direction:** More-negative keys represent _worse_ scores.
> Key `'-3'` = triple bogey = 0 pts. Key `'4'` = condor = 6 pts. The implementation
> is correct. Do not reorder or invert keys.

**Ace scoring:** An ace (hole-in-one, gross = 1) scores based on the hole's par:
- Par 3: `d = 3−1 = 2` → eagle → 4 pts (default)
- Par 4: `d = 4−1 = 3` → albatross → 5 pts (default)
- Par 5: `d = 5−1 = 4` → condor → 6 pts (default)

No special-casing needed — `stabPts` handles aces correctly through par context.

**Condor scoring:** A condor (gross = par − 4) yields `d = 4` → 6 pts (default). A
true condor on a par 5 (hole-in-one) and a condor on a par 6 both score identically.
Scores 5+ under par (e.g. hole-in-one on a par 6) are clamped to `d = 4`.

**Custom table:** `gameOpts.Stableford.stabTable` — an object with any subset of string
keys `'-3'` through `'4'`. `null` means use `DEFAULT_STAB`. Missing keys return 0.
Configurable per-round in `NewRoundPage`. All 8 rows (condor through worse) are
individually customizable.

Keys outside the range `'-3'` to `'4'` are silently ignored — `d` is always clamped
before lookup, so out-of-range keys can never be reached and should not be stored.

```js
const t = stabTable || DEFAULT_STAB;
return t[String(d)] ?? 0;
```

### §3.6 Missing score behavior

If `gross` is falsy (0, null, undefined, empty string), `stabPts` returns `null`.
`calcStablefordTotal` treats `null` as 0 via the `?? 0` guard:

```js
return sum + (g ? stabPts(...) ?? 0 : 0);
```

A missing score on any hole contributes 0 points.

### §3.7 Segment relevance

| Segment | Holes (0-based, full round) | Used in |
|---|---|---|
| Front 9 | 0–8 | `'segments'` mode F9 bet; display sub-table |
| Back 9 | 9–17 | `'segments'` mode B9 bet; display sub-table |
| Full 18 | 0–17 | All payout modes; display chip bar totals |

**13-C.3 — Non-standard ranges.** When the game has a custom range
(`gameRanges['Stableford']` is set) or the round is shorter than 18 holes,
Front/Back/Full segments are derived from the effective range via
PartialGameContract §3.6 (universal F/B/T midpoint rule).

- **Individual mode** — the F/B/Full split is performed in `payouts.js`
  via the shared `splitRangeByMidpoint(startHole, endHole)` helper, which
  returns `{ front, back, all }` hole-index arrays. These are passed to
  `calcStablefordTotal(...holes)` via the final `holes` argument. The
  engine itself (`calcStablefordTotal`) remains range-unaware — it just
  iterates whatever holes the caller provides.
- **Team mode** — the F/B split is performed inside the engine by
  `calcTeamStablefordTotal`, which accepts an optional `range` argument
  and derives `midHole` internally. The caller passes the full range's
  `holes` array plus the `range` object. Invariant #13.b of
  PartialGameContract governs this surgical engine exception.

For the default full round `[0, 17]`, both paths produce the segment
table above — byte-identical to pre-13-C.3 behavior.

---

## §4. Betting and Payout Structure

### §4.1 Bet type

One `bet` amount, whose meaning varies by payout mode:

- **`'total'` mode:** `bet` = dollars paid by each loser to the winner pool. Tied winners
  split the pot equally. All tied = push (no payout).
- **`'segments'` mode:** `bet` = default dollars paid by each loser to the winner(s) of
  each segment. Per-segment overrides `betF` (F9), `betB` (B9), `bet18` (18-hole) take
  precedence when set; each falls back to `bet` if `0` or absent. Tied winners within a
  segment split that segment's pot; all tied on a segment = push.
- **`'perpoint'` mode:** `bet` = dollars per point of differential paid between each
  unordered pair. Zero differential = no movement.

### §4.2 Bet config fields

All stored in `gameOpts.Stableford`:

| Field | Type | Default | Description |
|---|---|---|---|
| `bet` | `number` | `0` | Dollar unit per active payout mode; segments per-segment fallback |
| `grossNetNOL` | `'net'`\|`'gross'`\|`'netofflow'` | `'net'` | Scoring mode |
| `betMode` | `'perpoint'`\|`'total'`\|`'segments'` | `'perpoint'` | Payout mode. Engine reads: `betMode ?? stabBetMode ?? 'perpoint'` |
| `stabTable` | `object\|null` | `null` | Custom points table (keys `'-3'`–`'4'`); null = DEFAULT_STAB |
| `betF` | `number` | `0` | Segments F9 override; falls back to `bet` if `0` or absent |
| `betB` | `number` | `0` | Segments B9 override; falls back to `bet` if `0` or absent |
| `bet18` | `number` | `0` | Segments 18-hole override; falls back to `bet` if `0` or absent |
| `format` | `'individual'`\|`'team'` | `'individual'` | Format. Read as: `opts.format ?? 'individual'` |
| `teamA` | `number[]` | `[]` | 2 player indices; team mode only |
| `teamB` | `number[]` | `[]` | 2 player indices; team mode only |
| `scoring` | `'cumulative'`\|`'bestball'` | `'cumulative'` | Team hole-scoring rule. Read as: `opts.scoring ?? 'cumulative'`. Ignored in individual mode. |

> `betF`, `betB`, `bet18` are only meaningful in `'segments'` mode. In other modes they are ignored by the engine.

### §4.3 Press support

N/A — Stableford does not support presses.

### §4.4 Team bet modes

In team mode, all three `betMode` values are supported. Semantics are identical to
individual mode but applied to **team totals** rather than individual totals. Each
player on the winning team receives the full per-mode amount independently; each
player on the losing team pays the full per-mode amount independently. Teammates
always have identical payouts because they share the same team score.

**`'total'` team mode:** Team with the highest 18-hole total wins. Since there are
exactly two teams, a tie = push (no losers → no payout). Each winner receives `bet`;
each loser pays `bet`.

**`'perpoint'` team mode:** Team A total vs Team B total across 18 holes. Each winner
receives `diff × bet`; each loser pays `diff × bet`. Tie = no movement.

**`'segments'` team mode:** Three independent segments (F9, B9, 18-hole). On each
segment won, each player on the winning team receives `segBet`; each player on the
losing team pays `segBet`. Two teams only → tied segment = push.

### §4.5 Tiebreak rule

**Push on all ties in all modes.** Tied players/teams at the top of any segment or
18-hole total share winner status and split the pot from losers. If all players/teams
tie (no losers), no payout occurs. No sudden-death or back-nine tiebreak is applied.

### §4.6 Zero-sum proof (individual modes)

**`'total'`:** `losers.length × bet` paid out; `winners.length × share =
winners.length × (losers.length × bet / winners.length) = losers.length × bet` received.
Net = 0. ✓

**`'perpoint'`:** Every dollar credited to player i is debited from player j. Net per
pair = 0. Sum over all pairs = 0. ✓

**`'segments'`:** Each segment: winning players receive from losers; tied = ±$0. Three
independent segments → total sum = 0. ✓

### §4.7 Zero-sum proof (team modes)

**`'total'`:** 2 winners each +`bet`, 2 losers each −`bet`. Sum = +2×bet − 2×bet = 0. ✓

**`'perpoint'`:** 2 winners each +`diff×bet`, 2 losers each −`diff×bet`. Sum = 0. ✓

**`'segments'`:** Each segment: 2 winners each +`segBet`, 2 losers each −`segBet`. Sum per
segment = 0. Three independent segments → total sum = 0. ✓

### §4.8 Carryover

N/A — no carryover mechanism in Stableford.

---

## §5. Payout Formulas

### §5.1 Payout structure type

- `'segments'` mode: per-player, per-segment, split among tied winners (three segments)
- `'total'` mode: per-player, split-pot among tied winners (one 18-hole settlement)
- `'perpoint'` mode: per-player-pair, proportional to point differential

### §5.2 Zero-sum proof — see §4.6 and §4.7.

### §5.3 `'segments'` mode payout formula (individual)

Three segments evaluated independently: F9 (`ptsF`), B9 (`ptsB`), 18-hole (`pts`).

Per-segment bets: `stabBetF = betF || bet`, `stabBetB = betB || bet`, `stabBet18 = bet18 || bet`.

For each segment:
1. Find the high score among subset players for that segment's field.
2. Co-winners = all players sharing the high score.
3. If co-winners < total subset players (losers exist): each loser pays `segBet`;
   pot split equally among co-winners.
4. If all players share the high score: no payout (push).

```js
// 13-C.3 Phase 2A: returns a per-name delta map so the caller can emit
// per-segment column values on the Results breakdown (see column emission
// note below). Accumulation into `gb` is unchanged from the prior version.
const paySegStab = (arr, field, segBet) => {
  const segDelta = {};
  arr.forEach(r => (segDelta[r.name] = 0));
  if (segBet <= 0) return segDelta;
  const maxVal = Math.max(...arr.map(r => r[field]));
  const winners = arr.filter(r => r[field] === maxVal);
  const losers  = arr.filter(r => r[field] < maxVal);
  if (losers.length === 0) return segDelta; // all tied — push
  const pot   = losers.length * segBet;
  const share = pot / winners.length;
  losers.forEach(r  => { gb[r.name] -= segBet; segDelta[r.name] -= segBet; });
  winners.forEach(r => { gb[r.name] += share;  segDelta[r.name] += share;  });
  return segDelta;
};
const fDelta = paySegStab(pts18, 'ptsF', stabBetF);
const bDelta = paySegStab(pts18, 'ptsB', stabBetB);
const oDelta = paySegStab(pts18, 'pts',  stabBet18);
```

> **Previously fixed bug note:** An earlier version used `sorted[0]?.[field] > sorted[1]?.[field]`
> (sole-winner guard) and always read `.pts` for all three segments. Both are corrected
> in the formula above. Do not revert.

**Columnar breakdown emission (13-C.3 Phase 2A):** In `'segments'` mode, the
breakdown entry pushed by `payouts.js` includes `colHeaders: ['Front', 'Back',
'Total', 'Game Total']` and per-row `matchCols: [f, b, o, f + b + o]` so the
Results page renders a single-line columnar layout per player. See Payout
Contract §3.2 for the canonical shape and §7.4 for the full breakdown
emission code. `'perpoint'` and `'total'` modes continue to emit the flat
shape (`{ name, detail, net }`).

### §5.4 `'total'` mode payout formula (individual)

```js
const maxPts = Math.max(...stabPs.map(p => p.pts));
const winners = stabPs.filter(p => p.pts === maxPts);
const losers  = stabPs.filter(p => p.pts < maxPts);
if (losers.length === 0) return; // all tied — push
const pot   = losers.length * bet;
const share = pot / winners.length;
losers.forEach(p  => { gb[p.name] -= bet; });
winners.forEach(p => { gb[p.name] += share; });
```

### §5.5 `'perpoint'` mode payout formula (individual — unchanged)

Evaluate all unordered pairs `(i, j)` where `i < j`:

```js
const diff = ranked[i].pts - ranked[j].pts;
if (diff > 0) {
  gb[ranked[i].name] += diff * bet;
  gb[ranked[j].name] -= diff * bet;
}
```

Zero differential = no movement.

### §5.6 Individual settlement within team

Payout amounts in `bank` are per player. Each team member pays or receives the **full
per-mode amount** independently — teammates always receive identical payouts because
they share the same team score. There is no splitting or pooling within a team.

Example: Team A wins `'total'` mode, `bet = $10`.
- Team A Player 1: +$10, Team A Player 2: +$10
- Team B Player 1: −$10, Team B Player 2: −$10
- Sum = $0. ✓

This differs from Sixes and team Match formats, where teammates split the team-level
movement. In Stableford team mode each player settles independently at the full rate.

### §5.7 Team payout formulas

**`'total'` team:**
```js
const totA = calcTeamStablefordTotal(..., teamA, scoring, ALL18).pts;
const totB = calcTeamStablefordTotal(..., teamB, scoring, ALL18).pts;
if (totA === totB) return; // push
const [winners, losers] = totA > totB ? [teamA, teamB] : [teamB, teamA];
winners.forEach(pi => { gb[players[pi].name] += bet; });
losers.forEach(pi  => { gb[players[pi].name] -= bet; });
```

**`'perpoint'` team:**
```js
const diff = Math.abs(totA - totB);
if (diff === 0) return;
const perPlayer = diff * bet;
const [winners, losers] = totA > totB ? [teamA, teamB] : [teamB, teamA];
winners.forEach(pi => { gb[players[pi].name] += perPlayer; });
losers.forEach(pi  => { gb[players[pi].name] -= perPlayer; });
```

**`'segments'` team:**
Each player pays/receives the full `segBet` per segment won/lost.

```js
// 13-C.3 Phase 2A: returns a per-name delta map for column emission.
// Accumulation into `gb` is unchanged.
const payTeamSeg = (totA, totB, segBet) => {
  const segDelta = {};
  [...teamA, ...teamB].forEach(pi => (segDelta[players[pi].name] = 0));
  if (segBet <= 0 || totA === totB) return segDelta; // push on tie
  const [winners, losers] = totA > totB ? [teamA, teamB] : [teamB, teamA];
  winners.forEach(pi => { gb[players[pi].name] += segBet; segDelta[players[pi].name] += segBet; });
  losers.forEach(pi  => { gb[players[pi].name] -= segBet; segDelta[players[pi].name] -= segBet; });
  return segDelta;
};
const rA = teamTots(teamA, ALL18);
const rB = teamTots(teamB, ALL18);
const fDelta = payTeamSeg(rA.ptsF, rB.ptsF, stabBetF);
const bDelta = payTeamSeg(rA.ptsB, rB.ptsB, stabBetB);
const oDelta = payTeamSeg(rA.pts,  rB.pts,  stabBet18);
```

**Columnar breakdown emission (13-C.3 Phase 2A):** Same as individual
`'segments'` mode (§5.3) — `colHeaders: ['Front', 'Back', 'Total', 'Game
Total']`, one row per teammate showing that teammate's segment-by-segment
contribution. Since both teammates on the winning side receive the full
`segBet` (per §4.7 head-to-head rule), their columns will show identical
values; same on the losing side. See Payout Contract §3.2 / §7.4.

### §5.8 Incomplete round behavior

No segment-completeness guard in any payout mode. Payout always based on accumulated
points through whatever holes have been scored. An unplayed hole contributes 0 points.
This matches the general "pay on accumulated results" policy (see Payout Contract §9).

---

## §6. Engine API

### §6.1 Engine function signatures

**Per-hole points — `handicap.js`:**
```js
stabPts(gross, par, courseHcp, rank, minCourseHcp, mode, stabTable)
  → number | null
```

**Individual segment/18-hole total — `games.js`:**
```js
calcStablefordTotal(scores, pi, pars, hcps, courseHcp, minCourseHcp, mode, stabTable, holes)
  → number
```

| Param | Type | Description |
|---|---|---|
| `scores` | `number[][]` | `scores[hole][playerIndex]` |
| `pi` | `number` | Player index |
| `pars` | `number[18]` | Par per hole |
| `hcps` | `number[18]` | Stroke index per hole |
| `courseHcp` | `number` | Player's signed course handicap |
| `minCourseHcp` | `number` | Participant set minimum course handicap |
| `mode` | `string` | Scoring mode |
| `stabTable` | `object\|null` | Point table |
| `holes` | `number[]` | 0-based hole indices to sum |

Returns: `number` — total points across specified holes (missing scores = 0).

### §6.2 Caller responsibilities

- Caller must pass `minCourseHcp` as the subset/team minimum (`subsetMin()` result),
  not the full-field minimum, when mode is `'netofflow'`.
- Caller must pass a valid `stabTable` object or `null`.
- Engine does not validate inputs.

### §6.3 Team Stableford engine function

**`calcTeamStablefordTotal`** — `games.js`, exported pure function.

```js
calcTeamStablefordTotal(
  scores,        // number[][] — scores[hole][playerIndex]
  pars,          // number[18]
  hcps,          // number[18] — stroke index per hole
  courseHcps,    // number[]   — full array of course handicaps
  minCourseHcp,  // number     — participant set minimum (teamA ∪ teamB)
  mode,          // string     — grossNetNOL value
  stabTable,     // object|null
  teamIdxs,      // number[]   — exactly 2 player indices
  scoring,       // 'cumulative' | 'bestball'
  holes          // number[]   — hole indices to sum
) → { pts, ptsF, ptsB }
```

**Returns:** `{ pts, ptsF, ptsB }` — team totals for 18h, F9, B9.

**Algorithm:**
1. For each hole h in `holes`, compute per-player points:
   - `p0pts = stabPts(scores[h][teamIdxs[0]], pars[h], courseHcps[teamIdxs[0]], hcps[h], minCourseHcp, mode, stabTable) ?? 0`
   - `p1pts = stabPts(scores[h][teamIdxs[1]], pars[h], courseHcps[teamIdxs[1]], hcps[h], minCourseHcp, mode, stabTable) ?? 0`
   - `null` treated as 0.
2. Apply scoring rule:
   - `'cumulative'`: `holePts = p0pts + p1pts`
   - `'bestball'`: `holePts = Math.max(p0pts, p1pts)`
3. Accumulate:
   - `ptsF` = sum over holes 0–8
   - `ptsB` = sum over holes 9–17
   - `pts`  = ptsF + ptsB

**`minCourseHcp`** for NOL mode must be computed from `teamA ∪ teamB` indices only
(§3.4 subset invariant — team players are the participant set in team mode).

**Callers:** `computePayouts()` in `payouts.js` only.

### §6.4 Calling convention

| Caller | Layer | Function called | Purpose |
|---|---|---|---|
| `payouts.js` (Stableford block) | Engine | `calcStablefordTotal`, `calcTeamStablefordTotal` | Compute totals for payout |
| `StablefordTable.jsx` | UI (permitted direct call) | `stabPts` | Per-hole display only |

`StablefordTable.jsx` calling `stabPts` directly is a **permitted direct engine call**
per App Data Model Contract §4.

---

## §7. Display Component

### §7.1 Table component

`pages/tables/StablefordTable.jsx`

Begins with the standard render-only header:
```js
// RENDER ONLY — no business logic in this file.
// No scoring calculations. No match state computation.
// All logic must come from engine/ or scorecardUtils.js
```

### §7.2 Props received

| Prop | Type | Required | Description |
|---|---|---|---|
| `players` | `Player[]` | Yes | All active players (not pre-filtered to subset) |
| `scores` | `number[][]` | Yes | `scores[hole][playerIndex]` |
| `pars` | `number[18]` | Yes | Par per hole |
| `hcps` | `number[18]` | Yes | Stroke index per hole |
| `opts` | `object` | Yes | `gameOpts.Stableford` — includes `grossNetNOL`, `stabTable`, `format`, `teamA`, `teamB`, `scoring` |
| `courseHcps` | `number[]` | Yes | Course handicap per player (full array) |
| `minCourseHcp` | `number` | Yes | Full-field minimum (component derives its own `displayMin`) |
| `stablefordPlayers` | `number[]` | Yes | Subset indices; `[]` = all players (individual mode only) |

### §7.3 Individual mode display layout

```
GameSection "Stableford" [badge: scoringLabel(mode)]
  HalfLabel "Front 9"
  GameTable  (holes 0–8, colHeader "F9", subset rows only)
  TableDivider
  HalfLabel "Back 9"
  GameTable  (holes 9–17, colHeader "B9", subset rows only)
  TableDivider
  PlayerChips (subset players, 18-hole totals)
  ColNote "4+ = condor+ · 3 = birdie · 2 = par · 1 = bogey · 0 = double+"
```

### §7.4 Cell rendering

Each cell shows the points value for that player on that hole:
- Missing score (null from `stabPts`): renders as `'·'` (center dot)
- Integer points: renders as the number

### §7.5 Color tokens

| Condition | Color | Meaning |
|---|---|---|
| `v === null` | `'#ccc'` | No score entered |
| `v >= 3` | `'#27ae60'` (green) | Birdie or better |
| `v === 0` | `RED` from `ui.jsx` | Double bogey or worse |
| `v === 1` or `v === 2` | `'#555'` (grey) | Bogey or par |

Font weight: bold (`700`) when `v >= 3`; otherwise `400`.

### §7.6 Totals display (individual mode)

`PlayerChips` footer shows 18-hole point totals for subset players only.
Player with highest total receives `leaderBg/leaderColor` styling. Sub-label: `"pts"`.

### §7.7 NOL display baseline

`displayMin` computed inside `StablefordTable` from the participant set:
- Individual mode: from `stablefordPlayers` subset
- Team mode: from `teamA ∪ teamB`

```js
const displayMin = (mode === 'netofflow' && activeIdxs.length)
  ? Math.min(...activeIdxs.map(i => courseHcps[i]))
  : minCourseHcp;
```

### §7.8 scorecardUtils helpers

`scoringLabel(mode)` — called for the `GameSection` badge text.

### §7.9 Team mode display layout

When `opts.format === 'team'`:

```
GameSection "Stableford" [badge: scoringLabel(mode)] [badge: scoring rule]
  HalfLabel "Front 9"
  GameTable  (holes 0–8 — per-player points for all 4 team players)
  TeamTotalRow "Team A" (F9 team total)
  TeamTotalRow "Team B" (F9 team total)
  TableDivider
  HalfLabel "Back 9"
  GameTable  (holes 9–17 — per-player points for all 4 team players)
  TeamTotalRow "Team A" (B9 team total)
  TeamTotalRow "Team B" (B9 team total)
  TableDivider
  TeamChips (Team A total | Team B total)
```

Team totals displayed per §6.3 algorithm using `stabPts` directly (permitted UI call).
Scoring rule badge: `'Cumulative'` or `'Best Ball'` matching `opts.scoring`.
Team player names derived from `teamA`/`teamB` indices into `players[]`.
Team A / Team B labels consistent with `MatchNassauTable` / `SixesTable` visual pattern.

---

## §8. Configuration Schema

### §8.1 `gameOpts.Stableford` shape

```js
gameOpts.Stableford = {
  bet:         number,                              // default 0
  grossNetNOL: 'net' | 'gross' | 'netofflow',      // default 'net'
  betMode:     'perpoint' | 'total' | 'segments',  // default 'perpoint'
                                                    // engine reads: betMode ?? stabBetMode ?? 'perpoint'
  stabTable:   object | null,                       // null = DEFAULT_STAB; keys '-3' through '4'
  betF:        number,                              // segments F9 override; 0/absent → bet
  betB:        number,                              // segments B9 override; 0/absent → bet
  bet18:       number,                              // segments 18h override; 0/absent → bet
  format:      'individual' | 'team',               // default 'individual'; read as opts.format ?? 'individual'
  teamA:       number[],                            // 2 player indices; [] when individual
  teamB:       number[],                            // 2 player indices; [] when individual
  scoring:     'cumulative' | 'bestball',           // default 'cumulative'; read as opts.scoring ?? 'cumulative'
                                                    // ignored in individual mode
}
```

### §8.2 `activeRound` fields

| Field | Type | Location | Notes |
|---|---|---|---|
| `gameOpts.Stableford` | object | `activeRound.gameOpts` | See §8.1 |
| `stablefordPlayers` | `number[]` | `activeRound` top-level | `[]` = all players; ignored in team mode |

### §8.3 `buildPayoutArgs` fields consumed by Stableford block

```js
{
  players,             // activePlayers array
  pars,                // number[18]
  hcps,                // number[18]
  scores,              // number[][]
  activeGames,         // must include 'Stableford'
  gameOpts,            // .Stableford sub-object consumed — now includes format/teamA/teamB/scoring
  stablefordPlayers,   // subset indices; [] = all; ignored when format === 'team'
  courseHcps,          // number[] — full array; stabMin derived internally
  minCourseHcp,        // full-field min; subsetMin() applied internally
}
```

No new top-level `buildPayoutArgs` fields needed — `teamA`/`teamB`/`format`/`scoring`
are all read from `gameOpts.Stableford` directly.

### §8.4 History record fields

| History field | `activeRound` source | `roundLib` function |
|---|---|---|
| `stableford_players` | `stablefordPlayers` | `fromActiveRound`, `toActiveRound`, `toSetupState` |
| `game_opts` blob | `gameOpts` (includes Stableford team fields) | all three |

All team fields (`format`, `teamA`, `teamB`, `scoring`) travel inside the `game_opts`
blob — no new top-level history fields needed.

---

## §9. Validation Rules (NewRoundPage)

### §9.1 Individual mode guards

| Guard | Where | Behavior |
|---|---|---|
| Subset picker shown only when `players.length > 2` and `format === 'individual'` | `NewRoundPage` | `PlayerSubsetChips` not rendered otherwise |
| `betMode` default | `NewRoundPage` | Falls back to `'perpoint'` if not set |
| Custom `stabTable` inputs | `NewRoundPage` | `parseInt` + `!isNaN` + `>= 0` validation per key; non-integers rejected |
| "Reset defaults" button | `NewRoundPage` | Restores `DEFAULT_STAB` spread (all 8 keys `'-3'` through `'4'`) |

### §9.2 `stabTable` key range

The custom points table UI exposes 8 input rows (from `'4'` condor down to `'-3'` worse).
All 8 keys are individually customizable. Default values on reset: `{ '-3':0, '-2':0, '-1':1, '0':2, '1':3, '2':4, '3':5, '4':6 }`.

### §9.3 `betMode` UI options

Three explicit options exposed in UI:

| UI label | Stored value |
|---|---|
| Per Point | `'perpoint'` |
| Total | `'total'` |
| F/B/T | `'segments'` |

### §9.4 Team mode UI guards

| Guard | Location | Rule |
|---|---|---|
| Teams requires 4 players | `NewRoundPage` | Teams option disabled when `players.length < 4` |
| Team picker in team mode | `NewRoundPage` / `GameConfigStableford.jsx` | `TeamPickerPair` rendered when `format === 'team'` |
| Subset picker hidden in team mode | `NewRoundPage` | `PlayerSubsetChips` not rendered when `format === 'team'` |
| Scoring rule dropdown | `GameConfigStableford.jsx` | Shown in team mode only; `'cumulative'` (default) / `'bestball'`; bottom of tile, same pattern as Sixes/Match |
| Start blocked on incomplete teams | `NewRoundPage` | Blocked if `format === 'team'` and either team has fewer than 2 players |

---

## §10. Press UI Contract

N/A — Stableford does not support presses. No `PressModal` involvement.
No `manualPresses` keys are created or read for Stableford.

---

## §11. Derived Values — Must Not Be Stored

| Value | Computed by |
|---|---|
| Per-hole Stableford points | `stabPts()` in `handicap.js` |
| Individual segment/18h totals | `calcStablefordTotal()` in `games.js` |
| Team segment/18h totals | `calcTeamStablefordTotal()` in `games.js` |
| Payout amounts (`gb` → `bank`) | `computePayouts()` in `payouts.js` |
| `stabMin` (payout NOL baseline) | `subsetMin()` inside `computePayouts()` |
| `displayMin` (display NOL baseline) | inline computation inside `StablefordTable` |

None of the above may be written to `activeRound` or history records.

---

## §12. Architecture Boundary

| Layer | Files | Role |
|---|---|---|
| Engine | `handicap.js`, `games.js`, `payouts.js` | All point and payout computation. Source of truth. |
| Display logic | `scorecardUtils.js` | `scoringLabel()` for badge text only. |
| UI | `StablefordTable.jsx`, `ScoreGrid.jsx` | Renders data; `stabPts` direct call permitted. |

### §12.1 Layer rules

- All Stableford point values originate from `stabPts()` in `handicap.js`.
- `calcStablefordTotal()` accumulates individual points by calling `stabPts` per hole.
- `calcTeamStablefordTotal()` accumulates team points by calling `stabPts` per player per hole, then aggregating.
- `computePayouts()` is the payout engine — calls both total functions per player/team/segment.
- `StablefordTable.jsx` may call `stabPts` directly for per-hole display. This is the only permitted direct engine call from the UI layer for this game.
- Payout math must not appear in any UI component.

---

## §13. Invariants

1. **Zero-sum:** Payout net values across all Stableford participants sum to zero for each mode. (Proof in §4.6–§4.7.)
2. **Pure functions:** `stabPts`, `calcStablefordTotal`, `calcTeamStablefordTotal`, and the Stableford block in `computePayouts` are pure and deterministic.
3. **Missing score = 0 points:** A falsy gross score produces `null` from `stabPts`, treated as 0 by all callers.
4. **`d` clamped to `[−3, 4]`:** Scores worse than triple bogey clamped to −3; scores better than condor (5+ under) clamped to 4.
5. **Subset indices stable:** `stablefordPlayers` indices must not change during an active round.
6. **`stabMin` ≤ every participant's `courseHcp`:** By construction of `subsetMin()`.
7. **`stabTable` keys are strings `'-3'` through `'4'`:** Lookup uses `String(d)`. Numeric keys will not match. Custom tables must use string keys. Keys outside this range are unreachable.
8. **`bet === 0` suppresses payout:** All mode blocks guard on `bet > 0`.
9. **`stablefordPlayers` persisted correctly:** All three `roundLib` functions handle `stableford_players`. ✅
10. **Non-participants appear in `bank` at 0:** Players not in the participant set are never charged or credited.
11. **`computePayouts()` is called from `App.jsx` only.**
12. **Single instance only:** `'Stableford'` appears at most once in `activeGames[]`.
13. **`displayMin` matches `stabMin`:** `StablefordTable` uses the same subset/team-min logic as `payouts.js`.
14. **Engine assumes participant set immutability:** `calcStablefordTotal`, `calcTeamStablefordTotal`, and the payout block assume the participant set is constant for the round.
15. **Display layer must not compute totals or rankings independently:** `StablefordTable` may call `stabPts` for per-hole display values only. All ranking logic originates from the engine.
16. **`buildPayoutArgs` synchronization:** All fields consumed by the Stableford payout block must be present in `buildPayoutArgs`. Team fields travel via `gameOpts.Stableford` — no new top-level keys needed. See App Data Model Contract §10.
17. **Team mode requires exactly 4 participants:** `teamA.length === 2 && teamB.length === 2`. Engine behavior with fewer is undefined; UI guard enforces before round start.
18. **`teamA ∩ teamB = ∅`:** No player may appear on both teams. Enforced by `TeamPickerPair`.
19. **`stablefordPlayers` is ignored in team mode:** Payout engine uses `[...teamA, ...teamB]` as participant set.
20. **Individual per-hole points computed first in team mode:** The scoring rule aggregates already-computed `stabPts` values. It does not alter handicap application.
21. **Team `bank` entries at full per-mode rate:** Each team member pays/receives the full `bet` (or `diff×bet` or `segBet`) independently. Teammates always have identical payouts. Zero-sum maintained.

---

## §14. Known Gaps and Open Items

| # | Severity | Description | Status |
|---|---|---|---|
| ~~G-1~~ | ~~Medium~~ | ~~`nassauMode` field — dead code~~ | ✅ **CLOSED** |
| ~~G-2~~ | ~~Low~~ | ~~`StablefordTable` display uses full-field `minCourseHcp`, not subset-adjusted `stabMin`~~ | ✅ **CLOSED** |
| G-3 | Low | `StablefordTable` team display mode not yet implemented | Open — session 11-L Phase 2 |

---

## §15. Examples

### §15.1 Segments mode — 4 players, F9 sole winner, B9 tie, 18-hole tie

```
Setup: Alice, Bob, Carol, Dave (all in subset)
  bet=$5, betMode='segments', grossNetNOL='net'

Segment totals:   F9    B9   18
  Alice:          19    16   35
  Bob:            17    18   35
  Carol:          17    18   35
  Dave:           15    14   29

F9: Alice(19) sole high → pot=3×$5=$15 → Alice+$15, Bob−$5, Carol−$5, Dave−$5
B9: Bob(18)=Carol(18) tie, both > rest → pot=2×$5=$10 → Bob+$5, Carol+$5, Alice−$5, Dave−$5
18: Alice=Bob=Carol(35) tie, Dave loses → pot=1×$5=$5 → Alice+$1.67, Bob+$1.67, Carol+$1.67, Dave−$5

Final: Alice+$11.67, Bob+$1.67, Carol+$1.67, Dave−$15  |  Sum=$0 ✓
```

### §15.2 Per-point mode — 3 players

```
Setup: Alice(38 pts), Bob(33 pts), Carol(30 pts)
  bet=$2, betMode='perpoint'

Alice vs Bob:   diff=5 → Alice+$10, Bob−$10
Alice vs Carol: diff=8 → Alice+$16, Carol−$16
Bob vs Carol:   diff=3 → Bob+$6, Carol−$6

Final: Alice+$26, Bob−$4, Carol−$22  |  Sum=$0 ✓
```

### §15.3 Total mode — split pot

```
Alice(38), Bob(38), Carol(30), Dave(28) — betMode='total', bet=$5

Winners: Alice, Bob (tied high). Losers: Carol, Dave.
Pot = 2×$5=$10. Share = $10/2=$5 each.
Alice+$5, Bob+$5, Carol−$5, Dave−$5  |  Sum=$0 ✓
```

### §15.4 Per-hole points — stabPts examples

```
Hole: par 4, mode='net', courseHcp=12, hcp rank=5 → player gets 1 stroke → net=gross−1

gross=1 (ace/condor): net=0 → d=4−0=4  → 6 pts (condor)
gross=2 (albatross):  net=1 → d=4−1=3  → 5 pts
gross=3 (eagle):      net=2 → d=4−2=2  → 4 pts
gross=4 (birdie):     net=3 → d=4−3=1  → 3 pts
gross=5 (par):        net=4 → d=4−4=0  → 2 pts
gross=6 (bogey):      net=5 → d=4−5=−1 → 1 pt
gross=7 (double):     net=6 → d=4−6=−2 → 0 pts
gross=9:              net=8 → d=−4 → clamped to −3 → 0 pts
gross=0 (missing):          → stabPts returns null → treated as 0
```

### §15.5 Team perpoint — cumulative scoring

```
Alice(idx 0) + Bob(idx 1) = Team A; Carol(idx 2) + Dave(idx 3) = Team B
betMode='perpoint', scoring='cumulative', bet=$2, grossNetNOL='net'

18h individual totals: Alice 28, Bob 22 → Team A: 50
                       Carol 25, Dave 21 → Team B: 46
diff = 4 → each winner receives diff×bet = 4×$2 = $8; each loser pays $8
Alice+$8, Bob+$8, Carol−$8, Dave−$8  |  Sum=$0 ✓
```

### §15.6 Team segments — bestball scoring

```
Alice + Bob = Team A; Carol + Dave = Team B
betMode='segments', scoring='bestball', bet=$5

Best-ball team totals:   F9  B9  18
  Team A:                20  19  39
  Team B:                18  20  38

F9:  A(20)>B(18) → each A player +$5, each B player −$5
B9:  B(20)>A(19) → each B player +$5, each A player −$5
18h: A(39)>B(38) → each A player +$5, each B player −$5

Final: Alice+$5, Bob+$5, Carol−$5, Dave−$5  |  Sum=$0 ✓
```

### §15.7 Team total — tie push

```
Alice + Bob = Team A (combined 18h: 44 pts)
Carol + Dave = Team B (combined 18h: 44 pts)
betMode='total', bet=$10

Teams tied → push → no payout  |  Sum=$0 ✓
```

---

## §16. Final Rule

If implementation behavior conflicts with this contract, call out the conflict.
The implementation must be corrected. This document defines the truth.

---

## Template Validation Checklist

- [x] Every placeholder filled or N/A'd
- [x] §2.2 documents both state field name and engine parameter name
- [x] §3.4 specifies `subsetMin()` requirement — both payout and display
- [x] §4.2 documents `bet` meaning per mode
- [x] §4.3 explicitly N/A (no press support)
- [x] §4.6–§4.7 zero-sum proof for all modes (individual and team)
- [x] §6.1 engine function signatures match actual code
- [x] §6.3 `calcTeamStablefordTotal` fully specified
- [x] §6.4 specifies callers and layers
- [x] §8.3 lists all `buildPayoutArgs` fields consumed
- [x] §9 documents all UI guards including team mode
- [x] §13 invariants include universal invariants + team invariants 17–21
- [x] §14 Known Gaps — G-1 and G-2 closed ✅; G-3 open
- [x] §15 examples arithmetically verified
- [x] Cross-references accurate
- [x] `DEFAULT_STAB` includes condor key `'4'`: 6 pts
- [x] Clamp documented as `[-3, 4]` asymmetric

---

## X Score Behavior

_Added session 13-B. See `ScoreKeypad_Contract.md` §4.5–§4.6 for the full invariant._

- **Net mode:** X = net double bogey = 0 Stableford points. `xGrossScore()` minus strokes = par + 2, which yields 0 pts in the standard Stableford table.
- **Gross mode:** xGross value is applied directly to the Stableford points table.
- Implementation: `calcStablefordTotal` and `calcTeamStablefordTotal` substitute `xGrossScore()` for `'X'` before the points lookup.
- **Display table (`StablefordTable.scoreHole`):** Must check `raw === 'X'` before `parseInt`. If X, substitute `xGrossScore(h, courseHcps[pi], hcps, pars)` as the gross value and pass it to `stabPts` normally. Do not use `parseInt(raw)` directly on a raw score value — `parseInt('X')` = `NaN`, which evaluates as falsy and causes X holes to score 0 pts rather than the correct Stableford value.
