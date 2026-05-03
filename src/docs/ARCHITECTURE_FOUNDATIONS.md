# Golf Scorekeeper — Architecture Foundations

_This document explains the mental models, design decisions, and layer
boundaries of the Golf Scorekeeper app. It is the "why" behind the
contracts. Read this once to orient yourself; consult the contracts for
authoritative rules._

_Last updated: April 2026_

---

## 1. What This App Does

The Golf Scorekeeper tracks live scoring, side-game bets, and payouts
for a group of golfers playing a single round. It runs entirely in the
browser with no server — all data lives in localStorage. At the end of a
round the app computes who owes whom money across up to 7 simultaneous
games, then saves the result to a history ledger.

The complexity comes from the games themselves. Nassau/Match Play alone
involves three independent segments, a press hierarchy that can nest
multiple levels deep, per-segment auto-press triggers, team and
individual formats, and three scoring modes. Multiply that by 7 games
and you have a system that must be precise, testable, and maintainable.

---

## 2. The Three-Layer Mental Model

Every piece of code in this app belongs to exactly one of three layers.
Understanding this model is the most important thing a new contributor
can know.

```
┌─────────────────────────────────────────────────┐
│                   ENGINE LAYER                   │
│  games.js · payouts.js · handicap.js             │
│  Pure functions. No React. No side effects.      │
│  These compute the truth.                        │
└───────────────────────┬─────────────────────────┘
                        │ engine output
                        ▼
┌─────────────────────────────────────────────────┐
│              DISPLAY LOGIC LAYER                 │
│  scorecardUtils.js                               │
│  Interprets engine output for display.           │
│  Never recomputes what the engine already knows. │
└───────────────────────┬─────────────────────────┘
                        │ display-ready data
                        ▼
┌─────────────────────────────────────────────────┐
│                   UI LAYER                       │
│  ScorecardPage · scorecard/* · tables/*          │
│  Renders data. Handles user input.               │
│  Contains no scoring logic.                      │
└─────────────────────────────────────────────────┘
```

### The engine layer computes truth

`games.js`, `payouts.js`, and `handicap.js` are pure JavaScript
functions with zero React dependencies. Given the same inputs they
always produce the same outputs. They know nothing about how results
are displayed. This makes them independently testable and safe to
reason about.

**Example:** `runMatchNassau()` in `games.js` takes scores, player
definitions, and a match definition, and returns the complete hole-by-
hole result for all three segments (front, back, overall) plus any
presses. It does not know what color to display the lead state in.

See game-specific contracts for exact engine rules and API signatures.

### The display logic layer interprets

`scorecardUtils.js` bridges engine outputs and the UI. It has two
categories of functions:

**Pure formatters** — take primitive values, return display strings.
No engine dependency. Example: `fmtLead(3, false, 4)` → `"3UP"`.

**Derived state builders** — call engine functions and assemble
display-ready data structures. They interpret; they never reimplement.
Example: `buildLeadState()` calls the engine's hole-winner function
and assembles a per-hole lead map for the table components to render.

The critical rule: if a function in `scorecardUtils.js` is doing
arithmetic that produces a scoring result, that arithmetic belongs in
the engine instead.

**Heuristic:** If changing the engine's rules would change the output
of a function in `scorecardUtils.js`, that function does not belong
in `scorecardUtils.js` — it belongs in the engine.

**Boundary warning:** `scorecardUtils.js` is not a general utility
file. It exists only for display-related transformations. Business
logic must not accumulate here over time. When in doubt, the engine
is the right home.

### The UI layer renders

Table components (`MatchNassauTable`, `SixesTable`, etc.) receive all
data as props. They render it. They do not compute it. Each file begins
with a header comment stating this explicitly. If a component needs a
value that isn't in its props, the correct response is to compute that
value in the engine or scorecardUtils and pass it down — not to add
logic to the component.

**UI components must not call engine functions directly.** Permitted exceptions are limited to direct display-only arithmetic transformations with no game rules involved — for example, `scoreForMode()` to derive a net score for display, or `strokesForMode()` for handicap dot counts. The complete authoritative list of permitted direct engine calls in UI components is maintained in the App Data Model Contract §4. All other engine calls occur in `ScorecardPage.jsx` (the state owner) or in `scorecardUtils.js` Category 2 functions. Results flow down to components via props only.

---

## 3. State Ownership

The app has one active round at a time. All live-round state lives in a
single `activeRound` blob, which is persisted to localStorage on every
change. `ScorecardPage.jsx` owns this state. It passes slices of it
down to child components as props.

### What gets stored vs. what gets computed

A core principle of the architecture: **derived values are never
stored.** Match status, hole winners, press outcomes, and payout amounts
are always computed fresh from the raw inputs (scores + match definitions
+ press trigger holes). This eliminates an entire class of bugs where
stored and computed values diverge.

What IS stored:
- Raw hole scores (the 18 × N scores array)
- Which games are active and their bet amounts
- Match definitions (players, scoring mode, bet amounts)
- Press trigger holes (the hole index after which each press begins)
- Specials entries (manually logged + auto-marked)

What is NOT stored:
- Match lead/status
- Hole winners
- Press outcomes
- Payout amounts

Payouts are computed fresh by `computePayouts()` each time the user
navigates to Results. They are written to `activeRound` temporarily
for display and then persisted to the history record at save time —
but they are always derived values, never authoritative state. The
engine recomputes them from raw scores on every call; the stored values
are a convenience cache only.

### Mutation discipline

Each area of state has exactly one place where it is mutated:

| State | Setter | Who calls it |
|---|---|---|
| Hole scores | `setScores` | ScoreGrid (via cell input) |
| Manual presses | `setManualPresses` | PressModal (via onConfirm/onRemove) |
| Specials entries | `setSpecEntries` | SpecialsPopup (via save) |

Child components must never call state setters directly. All mutations
are initiated by `ScorecardPage.jsx`. Child components request
mutations through callback props (e.g. `onConfirm`, `onRemove`) which
internally trigger the appropriate setter. This keeps all mutation
control centralized and auditable.

---

## 4. The Press Hierarchy

Presses are one of the most complex parts of the app and deserve their
own explanation.

A press is a new, independent match that starts at a specific hole and
runs to the end of its segment. Presses can be nested — a press on the
base match can itself be pressed, creating a press-of-press.

The hierarchy is encoded in a flat sorted array. For a given match
segment (e.g. `"Match:abc123:Front"`), the `manualPresses` value is
an array of hole indices: `[3, 6]`. This means:
- Press 1 starts after hole 3 (depth 0 → the press on the base match)
- Press 2 starts after hole 6 (depth 1 → the press on Press 1)

The engine reconstructs the full hierarchy from this array. The UI
enforces one press per level: adding a press at depth N discards any
existing entry at depth N and beyond (cascade remove).

The `PressModal` is the sole UI surface for press interactions. There
are no delete buttons — removing a press is done by tapping an already-
pressed hole in the modal grid, which removes it and all its children.

---

## 5. Persistence Model

All data is stored in browser localStorage. There is no server, no
database, no authentication.

### Storage keys (defined in `storage.js`)

| Key | Contains |
|---|---|
| `golf_players_v4` | Player library |
| `golf_courses_v4` | Course library |
| `golf_rounds_v4` | Completed round history |
| `golf_active_v4` | Live active round blob |
| `golf_round_setup_v4` | NewRoundPage form state (draft) |

### The activeRound lifecycle

```
NewRoundPage (setup)
    ↓ handleStartRound()
activeRound written to localStorage
    ↓ user plays the round
ScorecardPage reads/writes activeRound on every change
    ↓ handleGoResults()
computePayouts() runs; breakdown written to activeRound
    ↓ handleSaveRound()
roundLib.fromActiveRound() converts to history record
History record written to golf_rounds_v4
activeRound cleared
```

### Schema conversions (all in roundLib.js)

- `fromActiveRound(ar)` — converts live blob to history record for saving
- `toActiveRound(r)` — converts history record back to live blob (for editing a saved round)
- `toSetupState(r)` — converts history record to NewRoundPage init state (for reloading setup)
- `migrateRecord(r)` — upgrades legacy records to current schema on read (non-destructive)

---

## 6. Handicap System

Course handicaps are computed once at round start using USGA math
(`groupCourseHandicaps()` in `handicap.js`) and stored in the
`activeRound` blob. They are then passed as parameters to all engine
functions that need them. No component or utility computes handicap
strokes independently.

The three scoring modes available throughout the app:
- **Gross** — raw scores, no handicap adjustment
- **Net** — each player's score reduced by their stroke allocation on each hole
- **Net Off Low** — all players receive strokes relative to the lowest
  handicap in the group (the lowest-handicap player plays scratch)

---

## 7. The Specials System

Specials are bonus scoring events (closest to pin, longest drive,
birdies, eagles, aces, etc.). They are configured per-round in
NewRoundPage and tracked hole-by-hole in `specEntries`.

Auto-marking: certain specials (birdie, eagle, ace) are auto-marked
when a qualifying score is entered. The auto-mark condition is stored
as a function (`autoWhen`) on each special definition. **Critical:**
JavaScript functions are stripped by JSON serialization, so after any
localStorage round-trip, `restoreAutoWhen(specials)` must be called
before using specials. This re-attaches the functions from the canonical
`SPECIALS_DEF` in `engine/games.js`. `restoreAutoWhen` is exported
from `pages/scorecard/scorecardUtils.js`.

---

## 8. Adding a New Game

When adding a new game format, the contributor must:

1. Add the game name to `ALL_GAMES` in `games.js`
2. Write the game's scoring logic as a pure function in `games.js`
3. Add the payout calculation to `computePayouts()` in `payouts.js`
4. Add the setup UI (Players → Handicap → Bets) in `NewRoundPage.jsx`
5. Create a new table component in `tables/` (render-only, header comment required)
6. Wire the table into `ScoreGrid.jsx`'s game-table block (not `ScorecardPage.jsx`)
7. Add `fromActiveRound` / `toActiveRound` / `toSetupState` fields to `roundLib.js`
8. Update `buildPayoutArgs()` in `App.jsx` with any new fields the engine needs
9. Write (or expand) the game's contract document

See the App Data Model Contract §10 for the `buildPayoutArgs`
synchronization rule — failing to update it is a contract violation.

---

## 9. Working With AI Tools

This codebase is actively developed with AI assistance. The architecture
is specifically designed to make AI-generated changes safe:

- **Contracts are the authoritative source of rules.** If an AI
  produces code that conflicts with a contract, the contract wins and
  the code must be corrected.
- **The engine layer is the safest place for AI to write code.** Pure
  functions with no side effects are easy to verify and test.
  Files: `engine/games.js`, `engine/payouts.js`, `engine/handicap.js`.
- **Table components and scorecard utilities are the second safest.**
  Files in `pages/tables/` are render-only with a no-logic header comment.
  Files in `pages/scorecard/` contain only grid rendering, input handlers,
  formatters, and display helpers. Both layers constrain what an AI can
  plausibly add incorrectly.
- **`ScorecardPage.jsx` is now minimal (~85 lines) and very safe.** It
  only holds state, persists it, and passes props to `ScoreGrid`.
- **`ScoreGrid.jsx` and `App.jsx` are the most complex.** `ScoreGrid`
  owns input handling and keyboard advance logic; `App.jsx` owns the
  round lifecycle. Both should be changed carefully and reviewed against
  the App Data Model Contract.
- **Always update `APP_STATE_SUMMARY.md`** at the end of a session to
  capture what changed. This is the handoff document between sessions.

---

## 10. Document Hierarchy

| Document | Purpose | Update when |
|---|---|---|
| `ARCHITECTURE_FOUNDATIONS.md` (this file) | Mental models, the why | Architecture changes |
| `App_Data_Model_Contract.md` | State schema, mutation rules | Fields added/changed |
| `Nassau_Match_Contract.md` | Nassau/Match rules | Game rules change |
| _(other game contracts)_ | Per-game rules | Game rules change |
| `APP_STATE_SUMMARY.md` | Current state, open items | Every session |

Contracts are the source of truth. This document explains them.
`APP_STATE_SUMMARY.md` tracks what's currently implemented.
