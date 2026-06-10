# Wolf Contract

_Version 1.0 — June 2026_
_Status: DRAFT — awaiting owner approval_
_Conforms to Universal_Contract_Template.md v1.0_

---

## §1 — Identity

**Game name:** Wolf  
**`gameType` string:** `'Wolf'`  
**Player count:** 4 exactly. Engine rejects any round with fewer or more than 4 active players. `GamesCard.jsx` must gate Wolf selection when player count ≠ 4.  
**Scoring input:** Hole scores (gross), adjusted per `grossNetNOL` setting.  
**Bet unit:** Points per hole; monetary value derived from `bet` × points.

---

## §2 — Game Concept

Each hole, one player is designated the Wolf (rotates by player index). After all players' scores are entered, the Wolf either:

1. **Partners** with one of the other three players — Wolf + partner vs. the remaining two. (1 point each way.)
2. **Goes Lone Wolf** — Wolf alone vs. all three others. (2 points each way.)
3. **Goes Blind Wolf** — Wolf commits to going alone before scores are entered. (3 points each way.)

The Wolf rotation and the per-hole pick are the sole inputs to point resolution. No press system. No betMode variants.

---

## §3 — Rotation and Setup

### 3.1 Wolf rotation

Wolf rotates through player indices 0–3 cyclically, one per hole:

```
hole 1 → wolfOrder[0]
hole 2 → wolfOrder[1]
hole 3 → wolfOrder[2]
hole 4 → wolfOrder[3]
hole 5 → wolfOrder[0]  (wraps)
...
```

`wolfOrder` is a permutation of `[0, 1, 2, 3]` set at round start. Default is `[0, 1, 2, 3]`. A custom order or randomized order may be set in game setup.

### 3.2 Setup config stored in `gameOpts.Wolf`

```js
{
  bet:        number,          // dollar value per point
  wolfOrder:  number[4],       // permutation of [0,1,2,3]; default [0,1,2,3]
  carryover:  boolean,         // true = tied holes carry; false = tied holes push
  grossNetNOL: 'gross' | 'net' | 'nol'
}
```

### 3.3 Setup UI — `GameConfigWolf.jsx`

- `bet` field (dollar amount per point).
- `grossNetNOL` selector (Gross / Net / Net Off Low).
- Carryover toggle.
- Wolf order panel: displays four player name slots in order. "Randomize" button shuffles the order. Players may also be dragged/reordered manually (or tapped to cycle — match the Sixes starting-player pattern in use at implementation time).

---

## §4 — Per-Hole Pick Storage

### 4.1 `wolfPicks` shape

`wolfPicks` is a plain object keyed by hole index (0-based):

```js
wolfPicks[holeIdx] = {
  wolfIdx:   number,        // player index of the Wolf this hole (from rotation)
  partnerIdx: number | null, // player index of chosen partner; null if loneWolf or blindWolf
  loneWolf:  boolean,       // true when Wolf goes alone after scores are entered
  blindWolf: boolean,       // true when Wolf commits alone before scores are entered
  pointValue: number        // 1 (partner), 2 (lone), or 3 (blind)
}
```

Rules:
- `blindWolf: true` → `loneWolf: false`, `partnerIdx: null`, `pointValue: 3`
- `loneWolf: true` → `blindWolf: false`, `partnerIdx: null`, `pointValue: 2`
- Both false → `partnerIdx` is a valid player index, `pointValue: 1`
- `blindWolf` and `loneWolf` are never both true simultaneously.

`wolfPicks` is stored in `activeRound` and round-trips through `fromActiveRound` / `toActiveRound` / `toSetupState`.

### 4.2 Pick popup — trigger and mechanic

The partner-selection popup fires once per hole on hole entry (same trigger pattern as score entry). It is the sole Wolf interaction per hole.

**Popup contents:**

Five buttons:
1. Player name (non-Wolf player A) — selects as partner
2. Player name (non-Wolf player B) — selects as partner
3. Player name (non-Wolf player C) — selects as partner
4. Go Lone Wolf — `loneWolf: true`
5. Go Blind Wolf — `blindWolf: true`

Header line shows: "Hole [N] — [WolfPlayerName] is Wolf"

Tapping any button writes the pick to `wolfPicks[holeIdx]` and dismisses the popup.

The popup may be re-opened for the current hole to change the pick before the round is saved. Picks for completed holes are locked (display only).

**Pick not yet made:** Until a pick is recorded for the current hole, point resolution for that hole is deferred (hole treated as incomplete for payout purposes).

---

## §5 — Point Resolution Engine

### 5.1 Function signature

```js
runWolf(scores, players, opts, wolfPicks)
```

Parameters:
- `scores`: `number[][]` — `scores[playerIdx][holeIdx]`, raw hole scores
- `players`: `activePlayers` array — each entry has `siArray` for net/NOL adjustment
- `opts`: `gameOpts.Wolf` — `{ bet, wolfOrder, carryover, grossNetNOL }`
- `wolfPicks`: per-hole pick object (§4.1)

Returns: `WolfResult` (§5.4)

### 5.2 Per-hole resolution

For each hole `h` (0-based):

1. Determine Wolf: `wolfIdx = opts.wolfOrder[h % 4]`
2. Look up `wolfPicks[h]`. If absent, skip hole (incomplete).
3. Determine teams:
   - Partner pick: Wolf team = `[wolfIdx, partnerIdx]`; opponent team = remaining two players
   - Lone or Blind Wolf: Wolf team = `[wolfIdx]`; opponent team = all three others
4. Compute effective score per player per `grossNetNOL` (gross = raw; net = raw − stroke allocation; NOL = net off low handicap).
5. Team score = sum of effective scores for team members.
6. Compare team scores:
   - Wolf team lower → Wolf team wins
   - Opponent team lower → opponent team wins
   - Equal → hole ties
7. On tie:
   - `carryover: false` → hole pushes; no points move; carry resets to 0
   - `carryover: true` → `carryPoints` accumulates: `carryPoints += pointValue` for this hole; no points move this hole
8. On win:
   - Points collected = `pick.pointValue + carryPoints`
   - Each losing player pays each winning player `(pick.pointValue + carryPoints)` × `bet`
   - `carryPoints` resets to 0

### 5.3 Pairwise payout

Payout is always pairwise: each losing player pays each winning player individually. There is no "pay winner" aggregation. No `payStyle` field.

Examples (bet = $1):
- Partner win (pointValue = 1, carryPoints = 0): Opponent A pays Wolf $1, Opponent A pays Partner $1, Opponent B pays Wolf $1, Opponent B pays Partner $1.
- Lone Wolf win (pointValue = 2): each of the 3 opponents pays Wolf $2.
- Blind Wolf win (pointValue = 3): each of the 3 opponents pays Wolf $3.
- Lone Wolf loss: Wolf pays each of the 3 opponents $2.
- Partner loss: Wolf pays Opponent A $1, Wolf pays Opponent B $1, Partner pays Opponent A $1, Partner pays Opponent B $1.

### 5.4 Return shape — `WolfResult`

```js
{
  holes: [                         // one entry per hole (all 18; incomplete holes present with resolved: false)
    {
      holeIdx:      number,
      wolfIdx:      number,
      partnerIdx:   number | null,
      loneWolf:     boolean,
      blindWolf:    boolean,
      pointValue:   number,
      carryPoints:  number,        // carry coming INTO this hole (before resolution)
      totalPoints:  number,        // pointValue + carryPoints (0 if unresolved)
      winningTeam:  number[] | null, // player indices; null if tie or unresolved
      losingTeam:   number[] | null,
      resolved:     boolean,       // false if pick absent or hole not yet scored
      tied:         boolean,
      deltas:       number[4]      // net point change per player this hole (positive = won, negative = lost)
    }
  ],
  cumulative:   number[4],         // running point totals per player index (after each hole)
  bank:         { [playerIdx]: number }  // net dollar amount per player (positive = owes, negative = owed) — populated by computePayouts, not runWolf
}
```

`runWolf` returns `holes` and `cumulative`. `bank` is assembled by `computePayouts`.

---

## §6 — Payout Integration

### 6.1 `computePayouts` branch

```js
case 'Wolf': {
  const result = runWolf(scores, players, gameOpts.Wolf, wolfPicks);
  // accumulate pairwise deltas into bank
  // populate r.breakdown entry
}
```

### 6.2 `buildPayoutArgs` additions (in `roundUtils.js`)

```js
wolfPicks:  ar.wolfPicks  ?? {},
```

`gameOpts.Wolf` is already present in the standard `gameOpts` pass-through.

### 6.3 `r.breakdown` entry shape

```js
{
  game:    'Wolf',
  lines:   string[],    // human-readable per-player summary lines
  net:     { [playerIdx]: number }
}
```

---

## §7 — Round Lifecycle

### 7.1 `activeRound` fields added

| Field | Type | Default | Notes |
|---|---|---|---|
| `wolfPicks` | `object` | `{}` | Keyed by hole index (0-based) |

`gameOpts.Wolf` (§3.2) is stored in the standard `activeRound.gameOpts` map under key `'Wolf'`.

### 7.2 `roundLib` round-trip

`fromActiveRound`: serialize `wolfPicks` as `wolf_picks` in history record.  
`toActiveRound`: deserialize `wolf_picks` → `wolfPicks`; default `{}` if absent.  
`toSetupState`: pass `wolfPicks` through as camelCase; default `{}` if absent.

### 7.3 Early departure

Handled via existing `PartialGameContract` departure-resolver flow. Settled holes are final. The in-progress hole at departure is handled per resolver logic. No Wolf-specific departure rules.

---

## §8 — WolfTable Display

### 8.1 Layout

Render-only component. No scoring logic. Receives all data as props.

**Props:**
```js
{
  scores:      number[][],
  players:     activePlayers[],
  opts:        gameOpts.Wolf,
  wolfPicks:   object,
  isLandscape: boolean
}
```

### 8.2 Columns

| Column | Content |
|---|---|
| Hole | Hole number (1-based) |
| Wolf | Player name chip (abbreviated) for the Wolf that hole |
| Pick | "w/ [Name]", "Lone", or "Blind" |
| Pts | Points at stake that hole (pointValue + carryPoints); greyed if unresolved |
| Winner | Chip showing winning side ("Wolf" / "Wolf + [Name]" / "Opponents"); empty if tied or unresolved |
| P1…P4 | Running point total per player; chip colored per current sign (positive = green, negative = red, zero = neutral) |

Holes not yet played render with empty Pick/Pts/Winner/running-total cells.  
Carry holes show accumulated carry value in the Pts cell with a visual indicator (e.g. asterisk or distinct color).

### 8.3 Display-state builder

`WolfTable` is fully render-only. It does not call engine functions directly. A Category 2 display-state builder in `scorecardUtils.js` calls `runWolf` and returns a `WolfResult`-shaped object. `ScorecardPage` calls the builder and passes the result to `WolfTable` as a prop. This is the same pattern used by `MatchNassauTable` and `SixesTable`.

---

## §9 — GamesCard Gating

Wolf must only be selectable when exactly 4 players are active. `GamesCard.jsx` disables the Wolf toggle and shows an inline note ("Wolf requires 4 players") when player count ≠ 4.

---

## §10 — Invariants

1. `wolfOrder` is always a permutation of `[0, 1, 2, 3]`. Engine must validate length = 4 and all indices present.
2. `blindWolf` and `loneWolf` are never both true for the same hole.
3. `partnerIdx` is always null when `loneWolf` or `blindWolf` is true; always a valid non-Wolf player index otherwise.
4. `pointValue` is always 1, 2, or 3. Engine derives it from pick flags; stored value is canonical.
5. `carryPoints` resets to 0 after any won hole. It never carries across a won hole.
6. Payout is always pairwise. No `payStyle` field exists on Wolf.
7. `runWolf` is a pure function. It never reads from localStorage or React state.
8. `WolfTable` contains no scoring logic. All display values derive from props.
9. Wolf is gated to 4-player rounds at the `GamesCard` level. Engine may additionally guard and return empty result for non-4-player input.
10. `wolfPicks` must round-trip through all three `roundLib` converters without data loss.

---

## §11 — Testing Checklist (Phase 2)

1. **Partner win** — enter scores where Wolf + partner beat the other two; confirm 1pt × bet flows correctly pairwise.
2. **Lone Wolf win** — Wolf goes alone and wins; confirm each opponent pays Wolf 2pt × bet.
3. **Blind Wolf win** — Wolf goes blind and wins; confirm each opponent pays Wolf 3pt × bet.
4. **Lone Wolf loss** — Wolf goes alone and loses; confirm Wolf pays each opponent 2pt × bet.
5. **Partner loss** — Wolf + partner lose; confirm each loser pays each winner 1pt × bet.
6. **Carryover off, tie** — hole ties with carryover disabled; confirm no points move, carryPoints stays 0.
7. **Carryover on, tie then win** — hole ties, next hole won; confirm winner collects combined points (base + carry).
8. **Carryover on, multiple ties** — two consecutive ties then a win; confirm all accumulated carry pays out.
9. **Rotation** — verify Wolf index follows `wolfOrder` cyclically across 18 holes.
10. **Custom wolfOrder** — set non-default order; confirm rotation honors it.
11. **Randomize button** — confirm produces a valid permutation of 4 indices; no duplicates.
12. **Popup locks on completed holes** — re-opening popup for a prior hole shows pick read-only.
13. **4-player gate** — add Wolf with 3 players in setup; confirm toggle disabled / note shown.
14. **Round-trip** — save round, reload via history; confirm `wolfPicks` and `gameOpts.Wolf` intact.
15. **Early departure** — one player departs mid-round; confirm settled holes finalized, resolver fires.
16. **No-regression** — open an existing non-Wolf round; confirm no console errors and all existing game tables render correctly.
