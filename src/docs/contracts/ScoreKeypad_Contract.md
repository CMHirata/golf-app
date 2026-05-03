# ScoreKeypad Contract

_Version 2.4 AUTHORITATIVE — April 2026_
_Supersedes v2.3._
_Changes in v2.4 (13-F implementation tested): Implementation discovered amendments
needed to the v2.3 spec. (1) zIndex raised from 300 to 1100 — must render above
PlayerModal (zIndex 1000) and GameRangePopup (zIndex 400). §1.2 and §2.2 amended.
(2) `isSeeded` prop concept removed — replaced by "parent always seeds kpValue empty"
pattern. The field's persistent value stays visible in the field display; first digit
overwrites naturally because the field's onChange callback recomputes the field value
from the running buffer (e.g. kpVal '7' → playerHIs[p.id] = '0.7' overwriting old 5.4).
§6 modes amended. §10.6 (new). (3) `noPlus` prop added — suppresses `+` button in
handicap-decimal/handicap-int modes, showing `Done` instead. Used by ManualCourseModal
(course rating/slope/yardage are never negative). §2.1 props updated; §6.4 amended.
(4) 250ms `pointerEvents: none` lockout after keypad mount — swallows phantom click
from the activating tap that would otherwise land on a keypad button after the layout
shift (popup lift). §2.2 amended; §10.7 (new). (5) Field activation pattern: `<div>`
tap targets replaced by `<input readOnly inputMode="none">` with `onFocus` handler
that calls `e.target.blur()` then fires `onActivate`. More reliable iOS keyboard
suppression than div tap targets. §10 amended. (6) Dismiss handler exempts
keypad-activating fields — when tap target is `<input>` with `readOnly` and
`getAttribute('inputmode') === 'none'`, dismiss is skipped so field-to-field switching
within the same popup doesn't close the keypad. §10.4 amended. (7) `onChange` callback
signature changed to `(newKpVal, newKpPlus)` — receivers detect plus-toggle and update
the persistent field value with correct sign on every digit/toggle. §10.2 amended.
(8) `activateSetupKp` second arg (seed value) is ignored by parent; parent always sets
`kpValue: ''`. §10.2 amended. (9) Popup containers (e.g. GameRangePopup) must add
`onMouseDown`/`onTouchStart` `e.stopPropagation()` to their card div, AND disable their
backdrop close handler while the keypad is active (`onClick={keypadActive ? undefined :
onClose}`) — otherwise the phantom click from the field tap lands on the backdrop
(visible because keypad has pointerEvents:none for 250ms) and closes the popup. §10.8 (new)._
_Changes in v2.3 (13-F): Universal keypad expansion — ScoreKeypad now replaces
the iOS system keyboard for ALL numeric inputs throughout the app, not just score
entry. §1.1 purpose expanded. §1.2 architecture expanded: one ScoreKeypad instance
per owning page; page owns keypad state; fields fire onActivate upward. §1.3 scope
expanded. §2.1 `mode` prop added; `kpPlus` boolean for handicap sign toggle. §2.3
score-mode digit behavior annotated as mode-specific. §6 completely rewritten —
full spec for all five modes (score, currency, handicap-decimal, handicap-int,
integer). §8 invariants 13–20 added. §9 G-4 added (plus-CH indicator — see
Handicap_Contract.md §5.16). §10 new section: page-level keypad ownership pattern._
_Changes in v2.2 (13-B.2): §3.4 ZoomModal integration rewritten to match final
13-B.1 implementation — `zoomOpen` removed from prop list (visibility controlled
by conditional render, not a ZoomModal prop); `longPressFired` guard documented;
`cardRef`/`zoomCardRef` relationship clarified. §3.5 dismiss handler updated —
INPUT exception retained for forward-compat but noted as currently dead code since
score cells are divs. §3.6 ZoomModal open/close rewritten — `openZoomOnHole(h)` was
never implemented; `openZoom` uses `firstEmptyHole()`; cell activation is a separate
`useEffect` on `[zoomOpen]`, not inline. §3.8 (new) — `savedKpCellRef`,
`activeKpCellRef`, and `longPressFired` ref patterns documented._
_Status: AUTHORITATIVE — contract complete; implementation pending session 13-F._
_If code conflicts with this contract, the contract wins._

---

**Engine file(s):** `games.js`, `payouts.js`, `handicap.js`
**UI components:** `ScoreKeypad.jsx`, `ScoreGrid.jsx` (modified), `ZoomModal.jsx` (modified),
  `NewRoundPage.jsx` (modified), `PlayersPage.jsx` (modified), `ManualCourseModal.jsx` (modified),
  `GameConfigShared.jsx` (modified), `ReadOnlyScorecard.jsx` (modified), `shareUtils.js` (modified)
**Payout logic location:** No payout logic in keypad. Engine receives `'X'` as a raw score value.
**Cross-references:**
- `App_Data_Model_Contract.md` §5 — `scores[h][i]` valid values (amended by ScoreKeypad v2.2)
- `Round_Lifecycle_Contract.md` §12.3 — score normalization invariant (amended by ScoreKeypad v2.2)
- `Handicap_Contract.md` §3 — ESC calculation (amended by ScoreKeypad v2.2)
- `Handicap_Contract.md` §5.16 — plus-CH cell indicator (new in 13-F; keypad not involved but same display surfaces)
- `Payout_Contract.md` §2 — engine interpretation of X scores (amended by ScoreKeypad v2.2)
- All game contracts — "X always loses" rule (each amended by ScoreKeypad v2.2)
- `UI_Component_Contract.md` §4.7 — `BetInput` keypad activation; §4.10 `BetSection` carry-forward rule

---

## §1. Overview

### §1.1 Purpose

`ScoreKeypad` is a custom in-app numeric keypad that **universally replaces the
iOS system keyboard** for all numeric input throughout the app — score entry,
bet amounts, handicap indices, course ratings, slopes, yardages, and stroke
indices. The system keyboard is never invoked for any numeric field in the app.

In score mode (existing behavior), the keypad additionally provides:
- **X** — player picked up their ball (see §4)
- **Long-press X** — player is leaving the round or a game (see §5)

### §1.2 Architecture

`ScoreKeypad` is a **single shared component** (`ScoreKeypad.jsx`) imported by
any page that needs numeric input. There is **one ScoreKeypad instance per
owning page**, rendered as a fixed-bottom overlay at `zIndex: 1100`. Pages own
their own keypad state; individual fields are tap targets that fire an
`onActivate` callback upward.

**Page-level ownership pattern (see §10 for full spec):**
- The owning page holds `setupKpState: { fieldId, kpValue, kpPlus, mode } | null`
- Page also holds `setupKpCbsRef: { onChange, onCommit }` — a ref so callbacks never go stale
- Individual fields render as `<input readOnly inputMode="none">` to suppress the iOS system keyboard
- On field focus, the field calls `e.target.blur()` then fires its `onActivate(fieldId, seed, kpPlus, mode, onChange, onCommit)` prop
- The page's `activateSetupKp` ignores the seed and sets `kpValue: ''` (select-to-overwrite UX); the field's persistent value stays visible in the field display, and the first digit replaces it because the field's `onChange` callback recomputes from the running buffer
- `ScoreKeypad.onChange` fires live updates as `(newKpVal, newKpPlus)`; receivers update the persistent field value
- A global `touchstart`/`mousedown` listener on the page dismisses the keypad when tapping outside both the keypad container and any keypad-activating field (`tagName === 'INPUT' && readOnly && getAttribute('inputmode') === 'none'`)

**Score entry (existing — ScoreGrid):**
- `ScoreGrid` owns all score keypad state: `activeKpCell`, `kpValue`, advance/retreat timers
- `ScoreKeypad` is a pure controlled component — it receives `value` and fires callbacks; it owns no state
- ZoomModal integration unchanged (see §3.4)

**Z-index:** All keypad instances render at `zIndex: 1100` — above ZoomModal (`200`),
above nav bar (`50`), above PlayerModal (`1000`), above GameRangePopup (`400`),
above all other modals.

### §1.3 Scope

This contract covers:
1. The keypad component UI and behavior for all modes (§2, §6)
2. ScoreGrid keypad integration — score mode (§3)
3. ZoomModal integration (§3.4)
4. The `'X'` score type (§4)
5. The "X always loses" invariant across all games (§4.5)
6. Display table X handling (§7)
7. Non-score input mode specifications (§6)
8. Page-level keypad ownership pattern (§10)

---

## §2. Component Spec — `ScoreKeypad.jsx`

### §2.1 Props

```js
ScoreKeypad.propTypes = {
  containerRef:  PropTypes.object,              // ref attached to outer div for dismiss detection
  visible:       PropTypes.bool.isRequired,     // show/hide the keypad
  value:         PropTypes.string.isRequired,   // current in-progress buffer (always seeded empty by parent in non-score modes — see §10.6)
  kpPlus:        PropTypes.bool,                // handicap modes only — true = plus-handicap sign active
  onChange:      PropTypes.func.isRequired,     // (newVal: string) => void — parent then notifies registered field via setupKpCbsRef.current.onChange?.(newVal, kpPlus)
  onPlusToggle:  PropTypes.func,                // handicap modes only — () => void — parent toggles kpPlus and also notifies field's onChange with new sign
  onBackspace:   PropTypes.func.isRequired,     // () => void — parent slices kpValue and notifies field
  onCommit:      PropTypes.func,                // optional — () => void — fires on explicit Done tap (integer / noPlus modes) or dismiss
  onLongPressX:  PropTypes.func,                // score mode only — optional — () => void
  mode:          PropTypes.oneOf(['score', 'currency', 'handicap-decimal', 'handicap-int', 'integer']),
  noPlus:        PropTypes.bool,                // when true in handicap-* modes, suppress + button → show Done. Used for course rating/slope/yardage.
  // mode defaults to 'score' — all existing ScoreGrid call sites are byte-identical
}
```

**Mode summary:**

| `mode` | X/special key becomes | Auto-decimal | `+` toggle | Use case |
|---|---|---|---|---|
| `'score'` (default) | `X` | no | no | Score cells in ScoreGrid / ZoomModal |
| `'currency'` | `.` (decimal point) | no | no | Bet amount fields (`BetInput`) |
| `'handicap-decimal'` | `+` | yes (÷10) | yes | HI field in NewRound, GHIN field in Players |
| `'handicap-int'` | `+` | no | yes | CH field (integers, sign toggle) |
| `'integer'` | `Done` (commit) | no | no | Slope, yardage, stroke index, game range |

Removed from v2.0: `onConfirm`, `onNavigate`, `atFirst`, `atLast`.

### §2.2 Layout and Position

```
position: fixed
left: 0, right: 0, bottom: 0
zIndex: 1100
paddingBottom: calc(GAP + env(safe-area-inset-bottom))
pointerEvents: ready ? 'auto' : 'none'   // ← see below: 250ms mount lockout
```

**250ms pointer-events lockout (mount race fix):** On mount, ScoreKeypad
sets `ready = false` and runs `setTimeout(() => setReady(true), 250)`. The
outer div has `pointerEvents: ready ? 'auto' : 'none'`. This swallows the
phantom `click` synthesized by iOS at the touchstart coordinates of the tap
that opened the keypad — without this, after the popup card lifts (or the
keypad mounts in front of the user's finger position), iOS dispatches `click`
to whatever element is at those coords, which is now the keypad. The lockout
makes the keypad transparent to that phantom click. After 250ms, normal taps
work. (See §10.7.)

The keypad covers the nav bar (zIndex 300 > nav zIndex 50). Content above the
keypad is not obscured — the scorecard page has sufficient bottom clearance.

Button layout (4 rows × 3 columns, all equal width, ~56px tall per row):

```
┌───────────┬───────────┬───────────┐
│     1     │     2     │     3     │
├───────────┼───────────┼───────────┤
│     4     │     5     │     6     │
├───────────┼───────────┼───────────┤
│     7     │     8     │     9     │
├───────────┼───────────┼───────────┤
│     ⌫     │     0     │     X     │
└───────────┴───────────┴───────────┘
```

The navigation row (←/✓/→) was removed in v2.1 to reduce screen space usage.
Cell advancement is handled entirely by auto-advance timing.

**Colors:**
- Digit buttons (0–9): white bg, `#222` text
- `⌫` button: `#c8c8c8` bg, `#444` text, 22px
- Special button (bottom-right): color varies by mode — see §6 for per-mode label and color
  - `score` mode: `AMB` (amber) bg, `#fff` text, label `X` — transitions to `RED` at 300ms during long press
  - `currency` mode: `#c8c8c8` bg, `#444` text, label `.`
  - `handicap-decimal` / `handicap-int` modes: `G` (green) bg, `#fff` text, label `+`; when `kpPlus` is true, button is filled darker green to indicate active state
  - `integer` mode: `G` bg, `#fff` text, label `Done`
- Outer container: `#e0e0e0` bg, `1px solid #bbb` top border

### §2.3 Digit entry behavior

- Opening a cell always seeds `kpValue = ''` regardless of any existing committed
  score. The first digit tap always replaces, never appends.
- Digits append to `kpValue` (e.g. tap `'1'` → `'1'`, tap `'4'` → `'14'`).
- A third digit tap on a 2-digit value resets to that digit (e.g. `'14'` + tap
  `'8'` → `'8'`). No 3-digit values.
- `'X'` in `kpValue` is replaced by any digit tap.
- `onChange(newVal)` is called on every keystroke. ScoreGrid writes the score
  immediately and schedules auto-advance.

### §2.4 Auto-advance timing

ScoreGrid owns the advance timer, not `ScoreKeypad`. The timer rule:
- Value `'1'` only: wait 700ms (two-digit entry window), then advance.
- All other values (2–9, 0, X): advance immediately on `onChange`.

### §2.5 ⌫ (Backspace) behavior

`onBackspace()` is called and ScoreGrid applies this logic:
1. If `kpValue` is non-empty: remove last character from `kpValue`; write updated value to scores.
2. If `kpValue` is empty AND committed score is non-empty: clear the committed score (write `''`); stay on cell.
3. If `kpValue` is empty AND cell is already empty: retreat to prior cell.

This matches the original iOS keyboard backspace behavior exactly.

### §2.6 X button — single tap

1. `onChange('X')` fires immediately.
2. ScoreGrid writes `'X'` to scores and advances immediately (non-1 rule).
3. Cell renders as `"NX"` (see §4.3).

### §2.7 X button — long press

Long-press threshold: **600ms**. Visual warning at **300ms** (button turns RED).
On fire: calls `onLongPressX()`. Currently a stub: `alert('Early departure — coming soon')`.

---

## §3. ScoreGrid Integration

### §3.1 Keypad state owned by ScoreGrid

```
activeKpCell:   { h, pi } | null   — which cell has keypad focus
kpValue:        string             — in-progress value ('' on open/advance/retreat)
kpAdvanceTimer: ref                — advance timeout handle
kpContainerRef: ref                — attached to ScoreKeypad outer div
zoomCardRef:    ref                — attached to ZoomModal card div
```

### §3.2 `kpVisible`

```js
const kpVisible = canZoom && !!activeKpCell;
```

Keypad is shown whenever a cell is active, regardless of whether ZoomModal is open.

### §3.3 Score cell inputs

All score cells in `ScoreGrid` use `inputMode="none" readOnly`. On
`onTouchEnd` / `onFocus` / `onMouseDown`, they call `openKeypadOnCell(h, pi)`.
X cells render as styled divs showing `NX` — tapping them also calls
`openKeypadOnCell`.

### §3.4 ZoomModal integration

ScoreGrid passes the following props to ZoomModal:

| Prop | Value | Purpose |
|---|---|---|
| `activeKpCell` | `{ h, pi } \| null` | Drives green border on the active cell |
| `onCellTap` | `(h, pi) => void` | Called when user taps a cell; guarded by `longPressFired` (§3.8); routes to `openKeypadOnCell` |
| `cardRef` | `zoomCardRef` | ScoreGrid's `zoomCardRef` ref; attached to the ZoomModal card div so the dismiss handler (§3.5) exempts touches inside it |

**ZoomModal visibility** is controlled by conditional rendering in ScoreGrid:
```jsx
{zoomOpen && <ZoomModal ... />}
```
`zoomOpen` is ScoreGrid's own state — it is **not** a ZoomModal prop. ZoomModal is always mounted into a live render tree; it never receives a "visible" flag.

ZoomModal has no keyboard machinery, no hidden input, and no advance/retreat logic. On cell tap it calls `onCellTap(h, pi)` only. The keypad floats above ZoomModal at `zIndex 300` (ZoomModal is `zIndex 200`).

### §3.5 Dismiss handler

A `touchend` listener is active while `kpVisible`. It dismisses the keypad
(clears `activeKpCell`) unless the touch target is:
1. An `INPUT` element — retained for forward-compat; score cells are currently divs, so this branch is dead code
2. Inside `kpContainerRef` (the keypad itself)
3. Inside `zoomCardRef` (the ZoomModal card)

### §3.6 ZoomModal open/close

**`openZoom()`:** Calls `firstEmptyHole()` to determine the target hole, sets
`zoomHole`, then sets `zoomOpen = true`. Does NOT directly call `setActiveKpCell` —
that is deferred to a `useEffect` (see below).

**Cell activation on open:** A `useEffect` watching `[zoomOpen]` fires when
`zoomOpen` becomes true. It uses `setTimeout(0)` to defer `setActiveKpCell` by
one event-loop tick. This avoids the dismiss handler (which fires synchronously on
the same tap gesture) clearing the newly-set cell immediately.

**`closeZoom()`:** Sets `zoomOpen = false`, clears `activeKpCell`, clears `kpValue`.

**Note:** `openZoomOnHole(h)` was specified in v2.1 but was never implemented.
`openZoom()` always derives the target hole from `firstEmptyHole()`.

### §3.7 Hole advancement in ZoomModal

`kpAdvanceCell` and `kpRetreatCell` call `setZoomHole(nh/ph)` when `zoomOpen`
is true and the advance/retreat crosses a hole boundary. This keeps ZoomModal's
3-hole window centred on the currently-active hole.

### §3.8 Ref patterns — `savedKpCellRef`, `activeKpCellRef`, `longPressFired`

Three refs in ScoreGrid support correct keypad behavior across long-press and
DotsPopup interactions:

**`activeKpCellRef`** — always-current mirror of `activeKpCell` state, maintained
via `useEffect(() => { activeKpCellRef.current = activeKpCell; }, [activeKpCell])`.
Required because `startLongPress` uses a `setTimeout` closure that captures a
stale closure-time value of `activeKpCell` state. Always read `activeKpCellRef.current`
inside timer callbacks — never read `activeKpCell` directly from a closure.

**`savedKpCellRef`** — saves `activeKpCellRef.current` when a long-press fires, then
clears `activeKpCell` (hides the keypad while DotsPopup is open). When DotsPopup
closes, its `onClose` callback restores `activeKpCell` from `savedKpCellRef` and
clears the ref. This is how the keypad reappears on the correct cell after a dots
long-press without requiring the user to tap again.

**`longPressFired`** — a `useRef({})` dict keyed by `"${h}_${pi}"`. Set to `true`
when a long-press completes on a cell; reset to `false` when the touch starts on that
cell. The `onCellTap` wrapper passed to ZoomModal checks this flag and returns early
if it is true — preventing the finger-lift at the end of a long-press from
immediately re-opening the keypad on the cell that was just long-pressed.

---

## §4. The X Score Type

### §4.1 Storage

`scores[h][i]` valid values:
```
'' | positive integer string | 'X'
```

`'X'` is the canonical stored value. Display strings (e.g. `'7X'`) are never stored.

### §4.2 X gross value computation

```
xGross(h, i) = pars[h] + 2 + handicapStrokes(h, i)
```

Exported from `handicap.js` as:
```js
export function xGrossScore(holeIdx, courseHcp, hcps, pars)
```

### §4.3 Display of X scores

In ScoreGrid, ZoomModal, RoundSummaryModal, and share image:
- Render as numeric part + `X` suffix
- Numeric part: normal score color/weight
- `X` suffix: `AMB` (amber) color, `0.75–0.85em`, same weight
- Cell background: `#fffbe6` (light amber tint)

In TotalsCard: xGross value included numerically in gross total. No X annotation.

### §4.4 X and ESC

X is already ESC-capped by definition (`xGross = par + 2 + strokes = ESC max`).
`escTotal()` in `handicap.js` uses `xGrossScore()` directly for X holes.

### §4.5 "X always loses" invariant

A player with X loses to any player with a real score on that hole.
Two X players on the same hole tie each other.
This holds across all 7 games and all scoring modes.

### §4.6 Per-game X behavior

| Game | X behavior |
|------|-----------|
| Skins | X cannot win a skin. All-X → tied (skin carries per carryover setting). |
| Match / Nassau | X loses hole to any real score. X vs X → halved. |
| Nines | X comes in last place. Points distributed per §4.7. |
| Stableford | Net mode: X = 0 pts (net double bogey). Gross mode: xGross applied to pts table. |
| Sixes | X player's team uses partner's score as best-ball. Both partners X → lower xGross. |
| Stroke Play | X is not valid — player cannot pick up in stroke play (see §4.8). |
| Dots | X hole: no birdie/eagle/ace auto-mark for that player. |

### §4.7 Nines X points

Three-player field:
- 1 player X: X gets 1 pt (sole last); other two compete normally for 5/3.
- 2 players X: X players get 2 pts each (tie last); real score player gets 5 pts.
- All 3 X: 3 pts each (three-way tie).

Implementation: X players are given a sentinel value of `maxRealScore + 1` so
they sort after all real scores. All X players receive the same sentinel so they
tie each other. `ninesPts()` distributes points normally from this sorted order.

### §4.8 Stroke Play and X

X is not a valid score in Stroke Play — a player cannot pick up. The engine
skips X holes for Stroke Play calculations rather than substituting xGross.
The X button is not blocked in the UI (other games may be active simultaneously),
but Stroke Play treats X holes as unscored.

---

## §5. Long-Press X — Stub

`onLongPressX` is wired as a stub:
```js
onLongPressX={() => alert('Early departure — coming soon')}
```

Full resolver logic is specified in the Early Departure Contract and will be
wired in a dedicated session.

---

## §6. Non-Score Input Modes

`ScoreKeypad` supports five modes via the `mode` prop (default `'score'`).
Modes `'score'` is unchanged from v2.2 — all existing ScoreGrid call sites
receive byte-identical behavior. The four new modes cover setup inputs.

---

### §6.1 `'currency'` mode — Bet amount fields (`BetInput`)

**Where used:** All `BetInput` instances in `BetSection` across all game
config panels (NewRound setup) and `MatchCard`.

**X button:** Becomes `.` (decimal point). Tapping `.` when `kpValue`
already contains `.` is a no-op. Only one decimal point allowed.

**Digit behavior:** Digits append to `kpValue` as in score mode, with
these constraints:
- Maximum 3 digits before the decimal point (values up to `999`)
- Maximum 2 digits after the decimal point
- A third digit after the decimal is rejected (no-op)
- No 3-digit-before-decimal enforcement via reset (unlike score mode) — a
  fourth digit before the decimal is simply rejected

**Backspace:** Removes the last character from `kpValue` (same as score mode).

**Auto-advance:** None. Currency fields are standalone.

**Long-press on `.`:** No-op. No departure intent in setup context.

**`kpValue` seeding:** Seeded with the field's current numeric value as a
string on activation (e.g. field shows `5` → `kpValue = '5'`; field shows
`0` → `kpValue = ''`). Not seeded as `''` (unlike score mode).

**Commit:** On dismiss or field switch, `onCommit()` fires. The owning
page parses `kpValue` via `parseFloat(kpValue) || 0`, clamps to `[0, 999]`,
and calls `onChange(number)` on the active `BetInput`.

**Display:** `BetInput` displays the committed value per UI_Component_Contract
§4.7: `$5` for `5`, `$5.50` for `5.5`, `$0` for `0`. Cents shown only
when the value has a non-zero fractional part.

---

### §6.2 `'handicap-decimal'` mode — HI fields

**Where used:** `HIField` in `NewRoundHelpers.jsx` (NewRound setup); GHIN
field in `PlayerModal` in `PlayersPage.jsx`.

**Auto-decimal rule:** `kpValue` is always interpreted as an implied-decimal
string. The stored numeric value is always `kpValue / 10`:
- `'54'` → `5.4`
- `'5'` → `0.5`
- `''` → committed as `''` (field cleared)
- Maximum 3 digits (`'540'` → `54.0`) — a fourth digit is rejected

This eliminates the need for a `.` key. Users tap `5` `4` to enter `5.4`.

**X button:** Becomes `+`. Tapping `+` toggles `kpPlus` (parent state).
`kpPlus = true` means the value will be committed as a plus handicap.
The button renders with active styling when `kpPlus` is true.
Tapping `+` again toggles `kpPlus` back to `false`.

**`+` storage convention:** On commit, if `kpPlus` is true, the string
stored in `player.ghin` is prefixed with `+` (e.g. `'+5.4'`). `parseIndex`
in `handicap.js` handles all `+` prefix / `+` suffix / negative-float forms
correctly. The engine always stores plus handicaps as negative floats
internally — the `+` prefix is a display/storage convention only.

**Valid range:** `0.0` to `54.0` (one decimal place). The engine does not
validate this; the UI should warn but not block values outside this range.

**Backspace:** Removes the last digit from `kpValue`. Does not affect
`kpPlus` — `+` is toggled only by tapping `+`.

**Auto-advance:** None.

**`kpValue` seeding:** On activation, seeded from the field's current stored
value: strip the `+` prefix and multiply by 10 to recover the raw digit
string (e.g. field stores `'5.4'` → `kpValue = '54'`; `'+5.4'` → `kpValue
= '54'` with `kpPlus = true`; blank → `kpValue = ''`, `kpPlus = false`).

---

### §6.3 `'handicap-int'` mode — CH field

**Where used:** `CHField` in `NewRoundHelpers.jsx` (NewRound setup).

**Digit behavior:** Digits build `kpValue` as a plain integer string. No
auto-decimal. Maximum 2 digits (CH is typically 0–36; 3-digit CH values
are not supported by USGA rules). A third digit tap resets to that digit
(same rule as score mode).

**X button:** Becomes `+`. Tapping `+` toggles `kpPlus`. When `kpPlus`
is true, the committed value is negated before storage (e.g. `kpValue='5'`
+ `kpPlus=true` → CH stored as `-5`). The CH field renders a plus-CH as
`CH: +5` (no minus sign shown — same convention as HI display).

**Backspace:** Removes the last character from `kpValue`. Does not affect
`kpPlus`.

**Auto-advance:** None.

**`kpValue` seeding:** On activation, seeded from the field's current CH
integer. If `ch < 0` (plus CH), `kpValue = String(Math.abs(ch))` and
`kpPlus = true`. If `ch >= 0`, `kpValue = String(ch)` and `kpPlus = false`.
If no CH value, `kpValue = ''`, `kpPlus = false`.

---

### §6.4 `'integer'` mode — Slope, yardage, stroke index, game range

**Where used:** Slope M/W and yardage fields in `TeeRow` in
`ManualCourseModal.jsx`; stroke index fields in `NineEditor` in
`ManualCourseModal.jsx`; hole range fields in `GameRangePopup` in
`GameConfigShared.jsx`.

**Digit behavior:** Digits append to `kpValue`. Maximum length varies by
field — enforced by the owning component via `maxDigits` prop:
- Slope: 3 digits (55–155)
- Yardage: 4 digits (up to 9999)
- Stroke index: 1 digit (1–9 per nine)
- Game range: 2 digits (1–18)

**X button:** Becomes `Done`. Tapping `Done` calls `onCommit()` to finalize
the value and dismiss the keypad. No long-press behavior. Integer mode
implicitly behaves as `noPlus` regardless of the prop value.

**Backspace:** Removes the last character from `kpValue`.

**Auto-advance:** For stroke index cells only: after a valid single digit is
committed, the keypad auto-advances to the next stroke index cell (same row).
The owning `NineEditor` component manages cell order. All other integer fields
have no auto-advance.

**`kpValue` seeding:** On activation, the parent always seeds `kpValue: ''`
regardless of the field's current value. The field's persistent value remains
visible in the field display; the first digit replaces it via the field's
own `onChange` callback (see §10.6).

**Stroke index uniqueness constraint:** Each nine (9 holes) must have unique
stroke index values 1–9. Validation fires on `onCommit()`. If a duplicate
is detected, an inline error renders below the nine editor and the value is
not committed. Validation is per-nine (holes 1–9 of a nine are ranked 1–9
independently; `buildLayout` in `handicap.js` then interleaves into 1–18).

**Game range field specifics:** Two fields (Start hole, End hole), integers
1–18. Commit fires when the user taps Done or switches to the other field.
`validateGameRange` in `GameConfigShared.jsx` runs on commit — error shown
inline; field not committed if invalid. The hosting `GameRangePopup` must
follow the requirements in §10.8.

---

### §6.5 Dismissed-keypad behavior (non-score modes)

In all non-score modes, tapping outside the keypad (outside the keypad
container and outside the active field's tap area) fires `onCommit()` on
the currently active field, then dismisses the keypad. This mirrors how
`onBlur` worked on native inputs.

Switching from one field to another (tapping a different field while the
keypad is open) fires `onCommit()` on the outgoing field, then immediately
re-activates the keypad for the new field — the keypad does not visually
dismiss and re-appear.

---

## §7. Display Table X Handling

`NinesTable` and `MatchNassauTable` have their own display-layer scoring logic.
Both must handle `'X'` explicitly — `parseInt('X')` returns `NaN` and must
never be used as a score value.

- `NinesTable.holeData`: mirrors `calcNines` X logic — xFlags, allX branch,
  `maxReal + 1` sentinel for `ninesPts`.
- `MatchNassauTable.indivHoleWinner`: checks raw string for `'X'` before
  `parseInt`. X vs real → real wins. X vs X → halved (return `0`).
- `MatchNassauTable.teamHoleWinner`: X players use `Infinity` so they can never
  contribute the best-ball. `isFinite` guards on tiebreaker comparisons.

---

## §8. Invariants

1. `'X'` is the only non-numeric non-empty valid score value.
2. `xGrossScore()` always returns ≥ `par + 2`.
3. X always loses to a real score. X ties X. Holds across all 7 games.
4. `'X'` is never stored as `'NX'` — display strings are never persisted.
5. `ScoreKeypad` is a pure UI component with no engine calculations except
   `xGrossScore()` for display.
6. The system keyboard is never invoked for any numeric input anywhere in the app.
7. `'X'` is never sanitized to `''` during score normalization.
8. All four button rows use equal-width, equal-height buttons. No spanning.
9. The navigation row (←/✓/→) does not exist. Any future addition of a
   navigation row requires a contract amendment and owner approval.
10. `kpValue` is always seeded as `''` when opening, advancing, or retreating
    to any score cell. The first digit tap always replaces the committed score.
11. ZoomModal has no keyboard machinery. All score entry flows through
    ScoreGrid's keypad state.
12. The keypad is never suppressed when ZoomModal is open.
13. `mode` defaults to `'score'`. All existing ScoreGrid call sites that pass no
    `mode` prop receive byte-identical behavior.
14. In `'currency'` mode, the special button renders as `.` with neutral styling.
    Long-press fires no action.
15. In `'handicap-decimal'` and `'handicap-int'` modes, the special button
    renders as `+` with green styling. `kpPlus` toggles on each tap.
    Long-press fires no action.
16. In `'integer'` mode, the special button renders as `Done` with green
    styling. It fires `onCommit()` and has no long-press behavior.
17. `kpPlus` is owned by the page, not by `ScoreKeypad`. The component is
    always fully controlled — it reads `kpPlus` and fires `onPlusToggle`.
18. Currency values are always committed as numbers via `parseFloat || 0`,
    clamped to `[0, 999]`. The engine never receives a currency string.
19. Handicap values are always committed as strings to `player.ghin` using
    the `+` prefix convention for plus handicaps. `parseIndex` is the sole
    parser of this string downstream.
20. There is exactly one `ScoreKeypad` instance rendered per owning page.
    Multiple simultaneous keypads are architecturally forbidden.

---

## §9. Known Open Items

| # | Severity | Description |
|---|----------|-------------|
| G-1 | Medium | `onLongPressX` resolver — Early Departure session (stub only) |
| G-2 | Low | Score cell amber tint `#fffbe6` — confirmed on device |
| G-3 | Low | Bottom clearance: scorecard page padding does not yet account for keypad height; content may scroll under keypad at bottom of round |
| G-4 | — | Plus-CH cell indicator — specified in `Handicap_Contract.md` §5.16; implemented in session 13-F alongside keypad wiring |

---

## §10. Page-Level Keypad Ownership Pattern

This section specifies how pages other than `ScoreGrid` own and render the
setup keypad.

### §10.1 State shape

Each owning page holds two pieces of state:

```js
const [setupKp, setSetupKp] = useState(null);
// null = keypad hidden
// {
//   fieldId:  string,    // unique identifier for the active field
//   kpValue:  string,    // current in-progress digit buffer (always seeded '' on activation — see §10.6)
//   kpPlus:   boolean,   // handicap modes only — plus-sign toggle
//   mode:     string,    // one of the five mode values
// }

const setupKpRef    = useRef(null);                                // attached to ScoreKeypad outer div
const setupKpCbsRef = useRef({ onChange: null, onCommit: null });  // field's callbacks live in a ref, never stale
```

Callbacks are stored in a ref (not in `setupKp` state) so they cannot go stale
across re-renders.

### §10.2 Field activation

Each field that uses the custom keypad:

1. Renders as `<input type="text" inputMode="none" readOnly>` to suppress the iOS system keyboard while remaining a focusable, tappable target.
2. Accepts an `onActivate(fieldId, seed, kpPlus, mode, onChange, onCommit)` prop from the page (signature has 6 args; a deprecated 7th `isSeeded` arg is ignored).
3. On `onFocus`, calls `e.target.blur()` to immediately drop focus (preventing the keyboard from flashing), computes the seed, then fires `onActivate(...)`.

The page's `activateSetupKp` callback:

```js
const activateSetupKp = useCallback((fieldId, _seedIgnored, kpPlus, mode, onChange, onCommit) => {
  setupKpCbsRef.current = { onChange, onCommit };
  setSetupKp({ fieldId, kpValue: '', kpPlus, mode });
}, []);
```

The seed value is **deliberately ignored** — `kpValue` is always seeded `''`.
This is the select-to-overwrite pattern (see §10.6).

The field's own `onChange` callback signature is `(newKpVal: string, newKpPlus: boolean) => void`. Receivers should:
- Treat `newKpVal === ''` as a clear (the user backspaced the buffer empty)
- Use `newKpPlus` (when present) to determine sign for the persisted value (e.g. HI `+5.4` vs `5.4`)

### §10.3 Keypad rendering

The page renders `<ScoreKeypad>` conditionally. All `setSetupKp` updates must
use the functional setter form `setSetupKp(kp => ...)` to avoid stale closures
on `kpPlus`:

```jsx
{setupKp && (
  <ScoreKeypad
    containerRef={setupKpRef}
    visible={true}
    value={setupKp.kpValue}
    kpPlus={setupKp.kpPlus}
    mode={setupKp.mode}
    noPlus={setupKp.mode !== 'handicap-decimal' && setupKp.mode !== 'handicap-int'}
    onChange={val => {
      setSetupKp(kp => {
        if (!kp) return null;
        setupKpCbsRef.current.onChange?.(val, kp.kpPlus);
        return { ...kp, kpValue: val };
      });
    }}
    onPlusToggle={() => {
      setSetupKp(kp => {
        if (!kp) return null;
        const newPlus = !kp.kpPlus;
        setupKpCbsRef.current.onChange?.(kp.kpValue, newPlus);  // notify field of sign change
        return { ...kp, kpPlus: newPlus };
      });
    }}
    onBackspace={() => {
      setSetupKp(kp => {
        if (!kp) return null;
        const next = kp.kpValue.slice(0, -1);
        setupKpCbsRef.current.onChange?.(next, kp.kpPlus);
        return { ...kp, kpValue: next };
      });
    }}
    onCommit={() => {
      setupKpCbsRef.current.onCommit?.();
      setSetupKp(null);
    }}
  />
)}
```

Pages that don't need the `+` toggle anywhere (e.g. `ManualCourseModal` — course
data is never negative) pass `noPlus={true}` unconditionally.

### §10.4 Dismiss handler

A `touchstart` + `mousedown` listener pair is active while `setupKp !== null`.
It fires `onCommit()` and clears `setupKp` unless the touch target is:

1. Inside `setupKpRef` (the keypad itself), OR
2. Another keypad-activating field — detected by `tagName === 'INPUT'` AND
   `readOnly` AND `getAttribute('inputmode') === 'none'`. Use `getAttribute`
   (not `.inputMode` property) for cross-browser reliability.

```js
useEffect(() => {
  if (!setupKp) return;
  const handler = (e) => {
    if (setupKpRef.current && setupKpRef.current.contains(e.target)) return;
    const t = e.target;
    if (t && t.tagName === 'INPUT' && t.readOnly && t.getAttribute('inputmode') === 'none') return;
    setupKpCbsRef.current.onCommit?.();
    setSetupKp(null);
  };
  document.addEventListener('touchstart', handler);
  document.addEventListener('mousedown',  handler);
  return () => {
    document.removeEventListener('touchstart', handler);
    document.removeEventListener('mousedown',  handler);
  };
}, [setupKp]);
```

The exemption for keypad-activating fields lets the user tap from one field to
another (e.g. Start hole → End hole in `GameRangePopup`) without dismissing the
keypad mid-transition. The next field's `onFocus` will atomically replace
`setupKp` with the new field's state.

### §10.5 Pages that own a setup keypad

| Page | Keypad owner | Fields wired |
|---|---|---|
| `NewRoundPage.jsx` | `NewRoundPage` | `HIField`, `CHField`, all `BetInput` via `BetSection`, `GameRangePopup` start/end via panels |
| `PlayersPage.jsx` | `PlayersPage` | GHIN field in `PlayerModal` |
| `ManualCourseModal.jsx` | `ManualCourseModal` | Rating M/W (handicap-decimal + noPlus), Slope M/W (integer), Yardages (integer), Stroke index (integer) |
| `ScoreGrid.jsx` | `ScoreGrid` | Score cells (unchanged — existing pattern) |

`GameRangePopup` is rendered inside `NewRoundPage`'s render tree (via panel
files like `GameConfigStrokePlay`); it uses `NewRoundPage`'s keypad instance.

### §10.6 Select-to-overwrite via empty seed

The "first digit overwrites existing value" UX is achieved without any state
flag in `ScoreKeypad`. The mechanism:

1. The persistent field value (e.g. `playerHIs[p.id] = '5.4'`) is displayed in
   the field. When the user taps the field, this value remains visible.
2. The page's `activateSetupKp` ignores the field's seed and sets `kpValue: ''`.
   ScoreKeypad starts with an empty buffer.
3. The user types `7`. ScoreKeypad fires `onChange('7')`. The page updates
   `kpValue = '7'` and notifies the field's `onChange('7', false)`.
4. The field's `onChange` callback recomputes the persistent value from the
   buffer (e.g. `n = 7`, `abs = '0.7'`, `playerHIs[p.id] = '0.7'`). The old
   `5.4` is overwritten — no append.
5. The user types `2`. Buffer is now `'72'`. Field's onChange: `n = 72`,
   `abs = '7.2'`, `playerHIs[p.id] = '7.2'`. Continues normally.

This pattern is simpler and more reliable than the `isSeeded` flag concept
explored in earlier drafts, which relied on `useEffect`-based prop change
detection that was fragile across rapid field switches.

### §10.7 250ms pointer-events lockout

ScoreKeypad's outer div is rendered with `pointerEvents: ready ? 'auto' : 'none'`
where `ready` starts `false` and flips `true` after 250ms (see §2.2).

This solves an iOS-specific click-target race condition. When the user taps a
field that opens the keypad:

1. `touchstart` fires on the field
2. `touchend` fires; React updates state synchronously: `setupKp` set, popup
   card lifts up (if applicable), keypad mounts at the bottom
3. iOS dispatches a synthesized `click` at the original touchstart coordinates
4. Those coordinates are now over a keypad button (because the layout shifted)
5. Without the lockout, the click would fire `handleDigit` for that button

With `pointerEvents: 'none'` for 250ms, the click passes through the keypad
(but is absorbed by whatever the parent had behind it — see §10.8 for popup
implications). After 250ms, the user's intentional taps land normally.

### §10.8 Popup container requirements

When a keypad-activating field is rendered inside a popup container (e.g.
`GameRangePopup` for hole range entry), the popup must:

1. Render the popup card with `onMouseDown={e => e.stopPropagation()}` and
   `onTouchStart={e => e.stopPropagation()}` — prevents the page-level dismiss
   handler from firing on taps inside the popup.
2. Disable its backdrop close handler while the keypad is active for one of its
   own fields: `onClick={keypadActive ? undefined : onClose}`. Otherwise the
   phantom click that passes through the keypad (during the 250ms lockout) lands
   on the backdrop and closes the popup.
3. Lift the popup card above the keypad when the keypad is active for one of
   its fields (e.g. `marginBottom: keypadActive ? '260px' : 0`). No CSS
   `transition` on this property — animation creates additional click-target
   races during the layout shift.

