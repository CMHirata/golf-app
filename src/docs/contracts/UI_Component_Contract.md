# UI Component Contract

_Version 1.7 — May 2026_
_Supersedes: v1.6_
_Changes in v1.7 (15-G): §3.1 — two new score-indicator tokens added: `BIRDIE_COLOR` (`'#1a6b3a'`) and `BOGEY_COLOR` (`'#c0392b'`). §3.6 NEW — score indicator token rules. §4 ScoreGrid sub-section NEW (§4.11) — birdie/bogey indicator overlay rendering rules for ScoreGrid score cells. §12 NEW — ScorecardPage ScoreGrid pin behavior: sticky positioning, toggle UI location, localStorage key, invariants._
_Changes in v1.6 (15-E.1): §10 NEW — `RangePicker.jsx` documented as a shared component sibling to `ui.jsx`. Owner of two localStorage keys: `moneyListRange` (Home page Money List filter) and `historyRange` (History page round filter); both keys share the same shape (see `App_Data_Model_Contract.md` §1.1). Exports: `RANGE_OPTS`, `loadRangePref(key)`, `saveRangePref(pref, key)`, `filterByRange`, `rangeLabel`, `RangePickerRow`, `ML_KEY`, `HISTORY_KEY`. Used by both `HomePage` (Money List filter) and `HistoryPage` (round filter); single source of truth for range options and filter logic; both pages maintain independent filter state._
_Changes in v1.5 (13-F implementation tested): §4.7 `BetInput` — `placeholder` prop documented; `isActive` prop added (2px green border + GA background when keypad is editing this field); keypad activation flow corrected to use `<input readOnly inputMode="none">` with `onFocus`+`e.target.blur()` (more reliable iOS keyboard suppression than the originally-specified `inputMode="none"` div tap target); `onActivate` 6-arg signature noted; select-to-overwrite pattern clarified (handled at page level via empty kpValue seed, not in the field). §4.10 `BetSection` — `onActivate`, `betSectionId`, and `activeFieldId` props documented; threading requirement spelled out: pages must pass `activeFieldId={setupKp?.fieldId}` through every level (GamesCard → GameConfig → panel → BetSection → BetInput, and MatchCard → BetSection)._
_Changes in v1.4 (13-F): §4.7 `BetInput` — `onActivate`/`fieldId` props added for custom keypad activation; value display format updated (whole dollar `$5` vs cents `$5.50`); `inputMode="none"` behavior when keypad active. §4.10 NEW — `BetSection` bet-mode carry-forward rule documented: single→FBT pre-populates all three fields from current single value; FBT→single retains total; prior inconsistency between Match and other games corrected at all call sites._
_Changes in v1.3: §4.9 NEW — `ShareOrientationPicker` component added._
_Status: AUTHORITATIVE — contract complete; §4.7/§4.10 implementation pending session 13-F._
_All implementation must conform to this contract._
_If code conflicts with this contract, the contract wins._

---

**Primary file:** `src/components/ui.jsx`

**Cross-references:**
- `ARCHITECTURE_FOUNDATIONS.md` §2 — three-layer model; permitted direct engine calls in UI
- `ARCHITECTURE_FOUNDATIONS.md` §3 — state ownership; props-down pattern
- `App_Data_Model_Contract.md` §4 — authoritative list of permitted direct engine calls in UI components
- `Handicap_Contract.md` §3 — `strokesForMode`, `chp` semantics (used by `PopDots`)

---

## §1. Purpose and Scope

`ui.jsx` is the single source of truth for all shared UI primitives in
the app. It exports design tokens, layout components, form inputs, and
two utility formatters. Every page and table component imports from
this file. No other file may define its own versions of these
primitives.

This contract documents:

- All design tokens (color constants and their semantic roles)
- Every exported symbol — components, utilities, and the global CSS string
- Props, variants, default values, and the `style` override pattern
- The no-external-CSS rule
- Dark mode status
- Known gaps and inconsistencies

This contract does **not** cover game-table layout patterns, scorecard
grid styles, or per-page design decisions. Those are owned by their
respective component files.

---

## §2. Architectural Position

`ui.jsx` lives in `src/components/` and belongs to the UI layer. It is
a shared primitive library — not a page, not an engine file, and not a
service. The following rules govern what may and may not live here.

### §2.1 What belongs in `ui.jsx`

- Design tokens (color constants)
- Reusable layout and input components used by two or more pages
- The `GLOBAL_CSS` reset string
- Utility formatters that are (a) purely presentational, (b) not
  scorecard-specific, and (c) used by multiple pages

**Hard rule:** `ui.jsx` must not accumulate domain-specific logic
beyond primitive input normalization and presentational formatting.
Any function that interprets game state, scoring results, or round
data does not belong here regardless of how small it is. This rule
exists to prevent gradual architectural drift — the UI layer must
remain a rendering primitive, not a logic layer.

### §2.2 What does not belong in `ui.jsx`

- Game scoring logic of any kind
- State management or React hooks beyond what is required for
  self-contained display (none are currently used)
- Scorecard-specific formatters — those belong in `scorecardUtils.js`
- Page-specific layout components used by only one file

### §2.3 Engine import exception and utility scope rule

`ui.jsx` imports `strokesForMode` and `chp` from `engine/handicap.js`
for use by `PopDots`. This is the only engine import in this file and
is explicitly permitted by `ARCHITECTURE_FOUNDATIONS.md` §2:

> "Permitted exceptions are limited to direct display-only arithmetic
> transformations with no game rules involved — for example,
> `strokesForMode()` to derive a net score for display, or
> `strokesForMode()` for handicap dot counts."

No other component in `ui.jsx` may import from the engine layer. Any
future component added to this file that requires engine logic must
be validated against the permitted-calls list in
`App_Data_Model_Contract.md` §4 before the import is added.

**Utility scope rule:** Utilities in `ui.jsx` must not depend on or
interpret application state, scores, or engine-derived values. A
utility that requires knowledge of game rules, player data, or round
state does not belong in this file.

### §2.4 No-external-CSS rule

All styles in this file are inline JavaScript objects passed to the
`style` prop of native HTML elements. No CSS classes, no CSS modules,
no CSS-in-JS libraries (e.g. styled-components, Emotion), and no
Tailwind are used anywhere in this application. This rule is
app-wide, not limited to `ui.jsx`.

The sole exception is `GLOBAL_CSS` (§6), which is a minimal string of
browser-normalization rules injected once at the app root. It does not
style any component.

---

## §3. Design Tokens

All tokens are named exports from `ui.jsx`. They are plain string
constants — no theme object, no nested structure.

### §3.1 Color token table

| Export | Value | Semantic role |
|---|---|---|
| `G` | `'#1a472a'` | Primary brand green. Used for active states, headings, filled buttons, toggle-on, dots, and all primary interactive elements. |
| `GA` | `'#e8f5ec'` | Green tint — the darker of the two green washes. Used for container backgrounds, highlighted cards, and table header fills where medium emphasis is needed. |
| `GB` | `'#f2faf4'` | Green wash — the lighter of the two green washes. Used for low-emphasis backgrounds, alternating row fills, and subtle surface differentiation. |
| `RED` | `'#c0392b'` | Danger red. Used for destructive actions (`Btn` `danger` variant) and negative result indicators. |
| `AMB` | `'#b7770d'` | Amber — warning/attention. Used for the `Btn` `amber` variant and caution states. |
| `AMBBG` | `'#fff8e1'` | Amber background tint. Intended as the surface color to pair with `AMB` text. Not currently used by any component in this file (see §9 G-3). |
| `BIRDIE_COLOR` | `'#1a6b3a'` | Score indicator green — stroke color for birdie (single circle) and eagle (double circle) overlays on ScoreGrid cells. Distinct from `G` to allow independent tuning of indicator vs interactive-element green. |
| `BOGEY_COLOR` | `'#c0392b'` | Score indicator red — stroke color for bogey (single square) and double-bogey-or-worse (double square) overlays on ScoreGrid cells. Shares value with `RED`; declared as a separate token so indicator usage is semantically distinct from destructive-action usage and can be tuned independently. |

### §3.2 Token usage rule

All files in the app must import color tokens from `ui.jsx` rather
than hardcoding hex values. A hardcoded hex that matches a token value
is non-conforming. This rule ensures that a single change to a token
in `ui.jsx` propagates everywhere.

### §3.3 What is not tokenized

The following style values are hardcoded inline in each component and
are **not** currently declared as named tokens:

- Border radius: `8` (inputs, buttons), `10` (toggles), `16` (cards)
- Font sizes: `11`, `12`, `13`, `14`, `15`
- Standard padding values
- Shadow: `'0 1px 5px rgba(0,0,0,.07)'` (Card)
- Standard gap and margin values

This is a known gap (§9 G-1). These values are consistent across
components but undocumented. **Token formalization is intentionally
deferred** pending a planned UX design engagement that will establish
the app's visual design system. Until that work is complete, new
components must match existing implicit values exactly — do not
introduce new magic numbers that deviate from the values listed above.

### §3.4 Font family

The app's root font family is declared in `App.jsx`'s root `<div>`
style as `"'DM Sans','Helvetica Neue',sans-serif"`. All components in
`ui.jsx` use `fontFamily: 'inherit'` to inherit this value. No
component declares its own font stack.

### §3.5 Dark mode

Dark mode is **not implemented**. The token set is light-mode only.
No dark-mode variants exist for any token. This is an intentional
deferment, not a gap to be fixed. If dark mode is added in the future,
a parallel token set must be introduced and this contract updated.

### §3.6 Score indicator tokens (v1.7)

`BIRDIE_COLOR` and `BOGEY_COLOR` are used exclusively for the stroke-only
circle/square overlays on ScoreGrid score cells (see §4.11). Rules:

- Both tokens are stroke color only. No fill is applied — the cell background
  shows through the shape interior, keeping the score number readable.
- Stroke width for all indicators: `1.5px`.
- Double-indicator offset (eagle / double-bogey-or-worse): second shape inset
  `3px` from the first (i.e. the inner shape is 3px smaller on each side).
- No other component in the app may use these tokens for non-indicator
  purposes. Their semantic scope is score-relative-to-par display only.

---

## §4. Components

All components are named exports. All accept a `style` prop (type:
plain object, default: `{}`) that is spread over the component's own
inline styles, allowing callers to override style properties subject
to the constraints in §7. **Exception:** `SH`, `Tog`, and `PopDots`
do not accept a `style` prop (see §9 G-2).

All components use `fontFamily: 'inherit'` on any rendered text
element that accepts the property.

---

### §4.1 `Btn` — Button

**Signature:**
```js
Btn({ children, onClick, variant, small, style, disabled })
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | ReactNode | — | Button label content |
| `onClick` | function | — | Click handler |
| `variant` | string | `'primary'` | Controls background and text color — see variant table below |
| `small` | boolean | `false` | Reduces padding and font size |
| `style` | object | `{}` | Caller style overrides — see §7 for constraints |
| `disabled` | boolean | `false` | Disables interaction — see disabled rules below |

**Variant table:**

| `variant` value | Background | Text color | Border |
|---|---|---|---|
| `'primary'` | `G` | `#fff` | none |
| `'danger'` | `RED` | `#fff` | none |
| `'outline'` | transparent | `G` | `1.5px solid G` |
| `'amber'` | `AMB` | `#fff` | none |
| `'ghost'` | `#f0f0f0` | `#444` | none |

> **Unrecognized variant fallback:** Any unrecognized `variant` value
> silently renders with `'ghost'` styling. No error is thrown.

**Size table:**

| `small` | Padding | Font size |
|---|---|---|
| `false` (default) | `9px 18px` | `14px` |
| `true` | `5px 11px` | `12px` |

**Disabled rules:**
- When `disabled` is `true`, **`onClick` must not fire under any
  circumstance.** This guarantee must hold even if the implementation
  changes (e.g. element type is swapped, handler is wrapped). The
  native `disabled` attribute on `<button>` is the current enforcement
  mechanism; any future refactor must preserve this guarantee explicitly.
- When `disabled` is `true`, the component's `background` (`#ccc`) and
  `cursor` (`not-allowed`) styles take precedence over the caller's
  `style` prop. These properties must not be overrideable by callers.
  This is enforced by the explicit conditional spread applied after the
  caller style: `...(disabled ? { background: '#ccc', cursor: 'not-allowed' } : {})`.

**Transition:** All style properties animate with `transition: all .15s`.

---

### §4.2 `Inp` — Text Input

**Signature:**
```js
Inp({ value, onChange, placeholder, style, type, onKeyDown, fRef })
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `value` | string \| number | — | Controlled value. `null` and `undefined` both render as `''` |
| `onChange` | function | — | Called with `e.target.value` as a **string** on every change |
| `placeholder` | string | — | Placeholder text |
| `style` | object | `{}` | Caller style overrides — see §7 for constraints |
| `type` | string | `'text'` | Native input `type` attribute |
| `onKeyDown` | function | — | Native `keydown` handler; passed through as-is |
| `fRef` | React ref | — | Forwarded to the underlying `<input>` via the `ref` prop. Used by callers that need programmatic focus (e.g. `ScoreGrid` keyboard advance logic) |

**`onChange` string emission rule:** `onChange` always emits a string
(the raw value of `e.target.value`). It never parses or converts the
value. Callers that need numeric behavior are responsible for parsing
the emitted string themselves. This is a frequent source of subtle
bugs — callers must not assume the emitted value is a number even when
`type="number"` is passed.

**Default styles:** `border: 1px solid #ddd`, `borderRadius: 8`,
`padding: 8px 11px`, `fontSize: 14`, `background: #fff`, `color: #222`,
`width: 100%`, `boxSizing: border-box`, `outline: none`.

**Value normalization:** `value ?? ''` ensures the input is never
uncontrolled when `null` or `undefined` is passed.

---

### §4.3 `Sel` — Select Dropdown

**Signature:**
```js
Sel({ value, onChange, options, style })
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `value` | string | — | Controlled value. `null` and `undefined` both render as `''` |
| `onChange` | function | — | Called with `e.target.value` (string) on every change |
| `options` | `OptionShape[]` | — | Array of option descriptors — see below |
| `style` | object | `{}` | Caller style overrides — see §7 for constraints |

**`OptionShape`:**
```js
{ value: string, label: string, disabled?: boolean }
```
The `disabled` field is optional. When `true`, the option is rendered
but not selectable (native `<option disabled>`).

**Empty-state requirement:** When the controlled `value` can be empty,
`null`, or `undefined` at any point, the caller must include an option
with `value: ''` in the `options` array. Omitting this option when the
value resolves to `''` causes a React mismatch warning and inconsistent
selection display.

**Default styles:** `border: 1px solid #ddd`, `borderRadius: 8`,
`padding: 7px 9px`, `fontSize: 13`, `background: #fff`.

**Value normalization:** `value ?? ''` — same null-safety pattern as `Inp`.

---

### §4.4 `Tog` — Toggle Switch

**Signature:**
```js
Tog({ checked, onChange, label, small })
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `checked` | boolean | — | Controlled on/off state |
| `onChange` | function | — | Called with the new boolean value (`!checked`) on click |
| `label` | string | — | Optional text label rendered to the right of the switch |
| `small` | boolean | `false` | Renders a smaller toggle — see size table below |

**Click behavior:** Clicking anywhere on the toggle track or on the
label text fires `onChange(!checked)`. Both targets trigger the same
handler. Keyboard interaction (e.g. Space/Enter to toggle) is not
currently implemented — the app is mobile-first and touch-driven.

**Size table:**

| `small` | Track width | Track height | Thumb size | Label font size |
|---|---|---|---|---|
| `false` (default) | `34px` | `19px` | `15px` | `13px` |
| `true` | `28px` | `16px` | `12px` | `11px` |

**Color:** Track is `G` when `checked`, `#ccc` when unchecked. Thumb
is always `#fff`. Both animate with `transition: background .2s` (track)
and `transition: left .2s` (thumb).

**No `style` prop.** `Tog` does not accept a `style` override prop.
See §9 G-2.

**Controlled only.** `Tog` holds no persistent internal state.
`checked` and `onChange` are both required in practice (no default for
`checked`).

---

### §4.5 `Card` — Surface Container

**Signature:**
```js
Card({ children, style })
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | ReactNode | — | Any content |
| `style` | object | `{}` | Caller style overrides — see §7 for constraints |

**Default styles:** `background: #fff`, `borderRadius: 16`,
`padding: 18px`, `marginBottom: 14px`,
`boxShadow: 0 1px 5px rgba(0,0,0,.07)`.

`Card` is a pure layout wrapper. It has no knowledge of its contents.
Any spacing, typography, or color changes inside a `Card` are the
caller's responsibility.

---

### §4.6 `SH` — Section Heading

**Signature:**
```js
SH({ children })
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | ReactNode | — | Heading text |

**Default styles:** `fontWeight: 700`, `fontSize: 15`, `color: G`,
`marginBottom: 8px`.

**No `style` prop.** `SH` does not accept a `style` override prop.
See §9 G-2. Callers that need a heading with different styling must
render their own `<div>` directly.

---

### §4.7 `BetInput` — Numeric Bet Amount Field

**Signature:**
```js
BetInput({ value, onChange, style, placeholder, onActivate, fieldId, isActive })
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `value` | number | — | Controlled numeric value |
| `onChange` | function | — | Called with a `number` (never a string) on every valid change |
| `style` | object | `undefined` | Caller style overrides, spread last |
| `placeholder` | string | `'$'` | Placeholder shown when `value === 0` |
| `onActivate` | function | `undefined` | If provided, fires custom-keypad activation. Called with `(fieldId, seed, false, 'currency', onChange, onCommit)`. The 6-arg signature matches §10.2 of `ScoreKeypad_Contract.md`. If absent, falls back to native input behavior |
| `fieldId` | string | `undefined` | Stable identifier for this field instance; used to compare against the page's active fieldId for the `isActive` visual state |
| `isActive` | boolean | `false` | When `true`, renders the field with a 2px green border and light-green background — visual indicator that the keypad is currently editing this field |

**Default styles:** `width: 60px`, `border: 1px solid #ddd` (or 2px green when `isActive`),
`borderRadius: 8`, `padding: 7px 10px` (or 6px 9px when `isActive` to compensate
for the thicker border), `fontSize: 13`, `textAlign: center`.

**Keypad activation (13-F):** When `onActivate` is provided, the field renders
as `<input readOnly inputMode="none">`. On `onFocus`, the field calls
`e.target.blur()` to immediately drop focus, then fires `onActivate(...)`. The
owning page activates the setup keypad in `'currency'` mode. The native iOS
keyboard is suppressed reliably by the `readOnly` attribute.

When `onActivate` is absent (no prop passed), the field falls back to the
legacy behavior: `type="text"` with `inputMode="decimal"`.

**Active visual state (13-F):** When `isActive === true`, the field renders
with a 2px green border (`G`) and light-green background (`GA`). The page
computes `isActive` by comparing its `setupKp?.fieldId` to the field's own
`fieldId`. See `BetSection` §4.10 for how `activeFieldId` is threaded.

**Value display rule:**
- `value === 0` → renders as `''` (empty, shows placeholder)
- `value` is a whole number (no fractional part) → renders as `$5` (no cents)
- `value` has a non-zero fractional part → renders as `$5.50` (two decimal places, trailing zero added)

**Select-to-overwrite UX:** When the field is activated with an existing value
and the user types the first digit, the new digit replaces the old value
entirely (e.g. `$5` → tap → type `4` → `$4`, not `$54`). This is achieved at
the page level (parent always seeds `kpValue: ''` per `ScoreKeypad_Contract.md`
§10.6); the field itself does not implement select-to-overwrite logic.

**Transient invalid state (legacy mode only):** When operating without
`onActivate`, invalid characters are allowed temporarily during typing.
On blur, the field normalizes. In keypad mode, the keypad enforces
valid characters at input time — no transient invalid state.

**`onChange` contract:** `onChange` is always called with a `number`,
never a string. Callers must store the result as a number.

**Max value:** `999` (three digits before decimal). Values above this
are not supported by the `'currency'` keypad mode.

---

### §4.8 `PopDots` — Handicap Stroke Dots

**Signature:**
```js
PopDots({ ghin, hcpRank, minGhin, mode })
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `ghin` | number | — | Player's GHIN handicap index |
| `hcpRank` | number | — | The hole's handicap rank (1–18, where 1 = hardest) |
| `minGhin` | number | — | The minimum GHIN in the relevant player group (used for NOL calculations) |
| `mode` | string | `'net'` | Scoring mode: `'gross'`, `'net'`, or `'netofflow'`. Defaults to `'net'` when absent or falsy |

**Behavior:** Renders a row of small filled circles (3×3px, color `G`)
in the bottom-right corner of a score cell, showing how many strokes
the player receives on that hole under the active scoring mode. Returns
`null` when stroke count is zero or negative — renders nothing.

**GHIN consistency rule:** The `ghin` value passed to `PopDots` must
be the same value used to derive `courseHcps` in the active round. Do
not pass a modified, overridden, or independently sourced GHIN value.
A mismatched value causes the dot count to disagree with the handicap
strokes applied by the engine, producing a confusing and incorrect display.

**Engine dependency:** Calls `strokesForMode(chp(ghin), hcpRank, minGhin, mode)`
from `engine/handicap.js`. This is the only engine call in `ui.jsx`
and is explicitly permitted (see §2.3).

**Positioning:** Absolutely positioned (`position: absolute, bottom: 2, right: 2`).
The caller's container must be `position: relative` for dots to appear
correctly.

**No `style` prop.** `PopDots` does not accept a `style` override.
Its size and position are fixed.

---

### §4.9 `ShareOrientationPicker` — Share Image Orientation Modal

```js
ShareOrientationPicker({ onPick, onDismiss })
```

A bottom-sheet modal that asks the user to choose between Portrait and
Landscape before a share image is built. Rendered as a fixed overlay
above all other content (z-index 200).

**Props:**

| Prop | Type | Description |
|---|---|---|
| `onPick` | `(orientation: 'portrait' \| 'landscape') => void` | Called when user taps an orientation button |
| `onDismiss` | `() => void` | Called when user taps the backdrop |

**Behavior:**
- Renders a semi-transparent black backdrop (`rgba(0,0,0,0.45)`) that fills the viewport
- The sheet slides up from the bottom with rounded top corners (`border-radius: 18px 18px 0 0`)
- Two equal-width buttons: Portrait (left) and Landscape (right), each with an inline SVG icon, label, and subtitle
- Tapping a button calls `onPick(orientation)` — the caller is responsible for dismissing the picker (typically by toggling `showOrienPick` state)
- Tapping the backdrop calls `onDismiss` without triggering a share
- `e.stopPropagation()` prevents sheet taps from bubbling to the backdrop

**No `style` prop.** Layout and color are fixed to match the app design system (`G` token for borders and text).

**Usage pattern** — all three share surfaces use identical state + handler pattern:

```js
const [showOrienPick, setShowOrienPick] = useState(false);

const handleShare = () => setShowOrienPick(true);

const handleShareWithOrientation = async (orientation) => {
  setShowOrienPick(false);
  setShareStatus('building');
  // ... build and share
};

// In render:
{showOrienPick && (
  <ShareOrientationPicker
    onPick={handleShareWithOrientation}
    onDismiss={() => setShowOrienPick(false)}
  />
)}
```

**Share surfaces:** `ResultsPage`, `HistoryPage`, `RoundSummaryModal`.
All three import `ShareOrientationPicker` from `ui.jsx`.

---

### §4.10 `BetSection` — Universal Bet Layout with Mode Carry-Forward

_Added 13-F. Previously undocumented; behavior partially specified in
`GameConfigShared.jsx` comments only._

**Location:** `GameConfigShared.jsx` (exported). Re-exported from `GameConfig.jsx`
for callers outside `tables/`.

**Signature:**
```js
BetSection({
  modes, mode, onModeChange,
  values, onValueChange,
  pressable, pressValues, onPressChange,
  extraField,
  onActivate,        // 13-F: optional — page-level keypad activation callback
  betSectionId,      // 13-F: optional — stable prefix for unique field IDs
  activeFieldId,     // 13-F: optional — page's currently active fieldId for isActive visual
})
```

**Keypad threading (13-F):** When `onActivate` is provided, every contained
`BetInput` is rendered with `onActivate={onActivate}` and a unique
`fieldId={`${betSectionId}_${field}`}` (e.g. `match_abc123_front`,
`stableford_single`). Each `BetInput` also receives `isActive` computed as
`activeFieldId === fid(field)`. The page must thread `activeFieldId={setupKp?.fieldId}`
all the way down through `GamesCard` → `GameConfig` → individual panel files
(`GameConfigStrokePlay`, `GameConfigNines`, etc.) → `BetSection` → `BetInput`,
and through `MatchCard` → `BetSection` for match cards.

**Bet mode carry-forward rule (13-F):**

When the user switches from a single-field mode (e.g. `'total'`, `'perpoint'`)
to a multi-field mode (e.g. `'nassau'`, `'segments'`), all three FBT fields
(Front, Back, Total) are pre-populated with the current single-field value.

When the user switches from a multi-field mode back to a single-field mode,
the single field retains the `values.total` value (the Total/Overall field).
The Front and Back fields are cleared on the owning component's next state update
(they are not shown in single mode, so their stored values go to 0 or are ignored).

**Implementation:** `BetSection` receives an `onModeChange` callback from the
caller. The **caller** is responsible for implementing the carry-forward — not
`BetSection` itself. When `onModeChange(newMode)` fires:

- Caller detects the direction of switch (single→FBT or FBT→single)
- Single→FBT: caller sets all three FBT field values to the current single value
- FBT→single: caller keeps the total value; sets front and back to 0

**Affected callers and carry-forward behavior:**

| Caller | Single→FBT carry | FBT→single carry |
|---|---|---|
| `MatchCard` (Nassau↔Total) | `betOverall` → `betFront`, `betBack`, `betOverall` | `betOverall` kept; `betFront`/`betBack` → 0 |
| `GameConfigStrokePlay` (Total↔F/B/T) | `bet` → `betF`, `betB`, `bet18` | `bet18` kept; `betF`/`betB` → 0 |
| `GameConfigNines` (PerPoint↔F/B/T) | `bet` → `betF`, `betB`, `bet18` | `bet18` kept; `betF`/`betB` → 0 |
| `GameConfigStableford` (PerPoint/Total↔F/B/T) | `bet` → `betF`, `betB`, `bet18` | `bet18` kept |

**Prior inconsistency (pre-13-F):** Nines already implemented carry-forward
via `values={{ single: bet, front: opts.betF ?? bet, ... }}` — the `?? bet`
fallback populated FBT fields from the single value at render time. Match did
not implement this; switching Total→Nassau left Front and Back blank.
This contract standardizes the behavior across all callers.

**`values` prop shape:**
```js
{
  single: number,  // used when mode is single-field
  front:  number,  // used when mode is FBT
  back:   number,
  total:  number,
}
```

**`onValueChange` callback:** `(field: 'single'|'front'|'back'|'total', value: number) => void`

---

These are pure functions, not components. They live in `ui.jsx` because
they are presentational, have no scorecard dependency, and are used
across multiple non-scorecard pages. Per §2.3, utilities here must not
depend on or interpret application state, scores, or engine-derived
values.

### §4.11 ScoreGrid Score-Cell Indicator Overlay (v1.7)

**Purpose:** PGA-broadcast-style par-relative indicators rendered as
stroke-only SVG overlays on active ScoreGrid score cells. Indicators
convey score relative to par at a glance without replacing or
repositioning the score number.

**Indicator level table:**

| Condition | Indicator |
|---|---|
| Score ≤ par − 2 (eagle or better) | Double circle (outer + inner, `BIRDIE_COLOR`) |
| Score = par − 1 (birdie) | Single circle (`BIRDIE_COLOR`) |
| Score = par (par) | None |
| Score = par + 1 (bogey) | Single square (`BOGEY_COLOR`) |
| Score ≥ par + 2 (double-bogey or worse) | Double square (outer + inner, `BOGEY_COLOR`) |

**Visibility rules — indicator is ABSENT when any of the following are true:**

1. The cell is an out-of-round cell (gray `–` cell, `!inRound(h)`)
2. The cell is a departed-player lock cell (`dep && h > dep.departureHole`)
3. The score value is empty (`''`) or null/undefined
4. The score value is `'X'` (pick-up/unfinished hole)
5. `pars[h]` is falsy (missing or zero) — no par to compare against

**Score used:** gross score (`scores[h][pi]` as integer). Net/handicap
adjustment is not applied to indicator calculation. This matches the
current gross-only first-cut decision; future sessions may make this
configurable.

**Rendering approach:** The indicator is an absolutely-positioned SVG
element inside the existing `<div style={{ position: 'relative' }}>` 
wrapper that already surrounds each score cell. The SVG is `position:
absolute; inset: 0; width: 100%; height: 100%; pointerEvents: none`
so it overlays the cell without intercepting taps.

**Shape geometry:**
- Single circle: `cx/cy` at cell center, `r` set to fit just inside
  the cell boundary with ~1px inset from each edge.
- Double circle: outer circle as above; inner circle with radius
  reduced by 3px.
- Single square: `<rect>` with ~1px inset from each edge, `rx/ry: 2`
  for slight rounding.
- Double square: outer rect as above; inner rect inset an additional 3px.
- Stroke width: `1.5` for all shapes. No fill (`fill: none`).
- Colors: `BIRDIE_COLOR` for circles; `BOGEY_COLOR` for squares.

**Helper location:** A `parRelative(score, par)` pure function must be
added to `scorecardUtils.js` (Category 1 — pure formatter, no engine
dependency). Returns `'eagle'`, `'birdie'`, `'par'`, `'bogey'`, or
`'double_bogey'`. `ScoreGrid` calls this helper to determine which
indicator (if any) to render. The helper itself must not be in `ui.jsx`
(it is scorecard-specific, per §2.2).

**What must NOT change:**
- Score number display, position, font size, or color
- Cell tap targets and long-press behavior
- DotBadge and PopDots overlay positions
- Cell background color logic (`isX` amber, active green border)
- `display: block` on score inputs (H-2)

---

These are pure functions, not components. They live in `ui.jsx` because
they are presentational, have no scorecard dependency, and are used
across multiple non-scorecard pages. Per §2.3, utilities here must not
depend on or interpret application state, scores, or engine-derived
values.

### §5.1 `fmtDollar`

```js
fmtDollar(v: number) → string
```

Formats a dollar amount as a signed string.

| Input | Output |
|---|---|
| positive number | `'+$X.XX'` |
| negative number | `'-$X.XX'` |
| zero | `'$0'` |

Always uses two decimal places for non-zero values. Uses `Math.abs`
for the magnitude so the sign is always the leading character.

**Rounding caveat:** Uses standard JavaScript floating-point
arithmetic. Results are subject to standard JS rounding behavior
(e.g. `1.005` may round to `1.00`). This function is not suitable for
financial-grade precision — it is a display formatter only. Payout
calculations are performed by the engine; this function only formats
the result for display.

### §5.2 `fmtDate`

```js
fmtDate(dateStr: string) → string
```

Converts an ISO date string (`'YYYY-MM-DD'`) to a locale-style display
string (`'M/D/YYYY'`) without timezone shift.

**Behavior:** Splits on `'-'` and reconstructs using `parseInt` to
strip leading zeros from month and day. Returns the original string
unchanged if it does not contain exactly three parts separated by
`'-'`. Returns `''` for falsy input.

| Input | Output |
|---|---|
| `'2026-04-11'` | `'4/11/2026'` |
| `'2026-12-01'` | `'12/1/2026'` |
| `''` / `null` / `undefined` | `''` |
| malformed string | original string |

**Malformed input caveat:** No date validation is performed beyond
structure checking (three parts separated by `'-'`). A string like
`'2026-99-99'` passes the split check and will display as
`'99/99/2026'`. The function does not validate month or day ranges.
Callers are responsible for ensuring well-formed ISO date strings are
passed.

**Rationale for timezone-safe approach:** Using `new Date(dateStr)`
would shift dates by the local UTC offset on some devices, causing
off-by-one date display errors. Parsing manually avoids this.

---

## §6. `GLOBAL_CSS`

```js
export const GLOBAL_CSS: string
```

A template-literal string of CSS rules injected once at the app root
via `<style>{GLOBAL_CSS}</style>` inside `App.jsx`'s render output.

**Purpose:** Browser normalization only. Contains no component styles.

**Current rules:**

| Rule | Purpose |
|---|---|
| `* { box-sizing: border-box; }` | Ensures padding is included in element dimensions everywhere |
| `* { -webkit-tap-highlight-color: transparent; }` | Removes the blue flash on tap in mobile WebKit browsers |
| `input[type="number"] spinner suppression` | Hides the browser's built-in increment/decrement arrows on number inputs (WebKit) |
| `body { touch-action: pan-y; }` | Prevents horizontal swipe gestures from interfering with vertical scrolling on touch devices |
| `body { overscroll-behavior: none; }` | Prevents pull-to-refresh and bounce scrolling |
| `table { table-layout: fixed; }` | Forces all tables to fixed-width column layout for consistent scorecard grid rendering. **This rule applies globally to every table in the app.** Any future table that requires auto or dynamic column sizing must explicitly override `table-layout` in its own inline styles. |

**Injection rule:** `GLOBAL_CSS` must be injected exactly once, in
`App.jsx`. It must not be injected in any page or component. Multiple
injections would produce duplicate rules with no functional harm, but
it is non-conforming.

**Modification rule:** Changes to `GLOBAL_CSS` affect the entire app.
Any modification must be reviewed for unintended side effects across
all pages and table components before being applied.

---

## §7. The `style` Override Pattern

All components that accept a `style` prop spread it over their own
default styles, giving the caller override authority. The exact spread
position varies by component to protect semantically critical
properties:

```js
// Standard pattern — caller wins on all non-protected properties
style={{ ...defaultStyles, ...style }}

// Required pattern for Btn — disabled state properties are protected
style={{ ...defaultStyles, ...style, ...(disabled ? { background: '#ccc', cursor: 'not-allowed' } : {}) }}
```

**Two constraints apply to all callers using `style` overrides:**

1. **Token rule:** Any color value in a `style` override must use a
   token imported from `ui.jsx` (§3.1). Hardcoded hex values that
   match or approximate token values are non-conforming.

2. **Semantic protection rule:** Caller `style` must not override
   interaction-critical or semantically meaningful styles. Specifically:
   - Do not override `background` or `cursor` on a disabled `Btn`
     (these are enforced at the component level per §4.1 and §9 G-5)
   - Do not override `background` or `color` on `Btn` in ways that
     make one variant visually indistinguishable from another
   - Do not override visibility-affecting properties (`display: none`,
     `opacity: 0`, `visibility: hidden`) on interactive controls

**Components with `style` prop:** `Btn`, `Inp`, `Sel`, `Card`, `BetInput`

**Components without `style` prop:** `Tog`, `SH`, `PopDots`
See §9 G-2 for the known gap on `Tog` and `SH`.

---

## §8. Invariants

1. **Single source of truth:** All shared UI primitives live in `ui.jsx`. No page or component file may define its own version of `Btn`, `Inp`, `Sel`, `Tog`, `Card`, `SH`, `BetInput`, or `PopDots`.
2. **Token import rule:** Any file using a color that matches a token value must import that token from `ui.jsx`. Hardcoded hex duplicates of token values are non-conforming.
3. **No external CSS:** All component styles are inline JS objects. No CSS library, CSS module, or class-based styling is used anywhere in the app.
4. **`fontFamily: 'inherit'`:** Every component that renders text uses `fontFamily: 'inherit'`. No component declares its own font stack.
5. **`style` spread observes constraints:** In every component that accepts a `style` prop, caller overrides are subject to the token rule and semantic protection rule defined in §7. Disabled state properties in `Btn` are never overrideable by callers.
6. **`GLOBAL_CSS` injected once:** `GLOBAL_CSS` is injected in `App.jsx` only. Never in a page or component.
7. **`BetInput.onChange` receives a number:** The `onChange` callback for `BetInput` is always called with a `number`. Callers must not treat the argument as a string.
8. **`PopDots` container must be `position: relative`:** Any caller rendering `PopDots` must ensure its immediate container is `position: relative` or the dots will escape the cell boundary.
9. **No persistent internal state in form components:** `Btn`, `Inp`, `Sel`, `Tog`, `BetInput` are all fully controlled components. None holds persistent internal state. Components may perform input normalization logic (as `BetInput` does) but must not store state that outlives a single render cycle. The caller owns all values.
10. **`null`/`undefined` value safety:** `Inp` and `Sel` both normalize `null` and `undefined` values to `''` via `value ?? ''`. Callers may pass either without causing an uncontrolled-component React warning.
11. **Unrecognized `Btn` variant falls back to `'ghost'`:** Any unrecognized value passed as `variant` silently renders with ghost styling (`#f0f0f0` background, `#444` text). No error is thrown. This fallback must be preserved in any future refactor of `Btn`.
12. **`Btn` disabled blocks all interaction:** When `disabled` is `true`, `onClick` must not fire under any circumstance. This is a behavioral guarantee, not an implementation detail. Any refactor that could allow `onClick` to fire on a disabled button is non-conforming.
13. **No domain logic in `ui.jsx`:** No function or component in this file may interpret game state, scoring results, round data, or player data. `ui.jsx` is a rendering primitive, not a logic layer.

---

## §9. Known Gaps and Open Items

| # | Severity | Description |
|---|---|---|
| G-1 | Low | No spacing, typography, or border-radius tokens are declared. Values like `borderRadius: 8`, `fontSize: 13`, and `padding: 18` are hardcoded inline in each component. Token formalization is intentionally deferred pending a planned UX design engagement. Until that work is complete, new components must match existing implicit values exactly — do not introduce new magic numbers that deviate from the values in §3.3. |
| G-2 | Low | `Tog` and `SH` do not accept a `style` override prop, inconsistent with all other components. Callers that need a custom-styled heading or toggle must render their own elements directly. Fix: add `style = {}` prop and spread it last (subject to §7 constraints) in both components. |
| G-3 | Low | `AMBBG` (`'#fff8e1'`) is declared as a token but is not confirmed used by any component in `ui.jsx`. It is available for import by page files that need an amber surface color. If confirmed unused across the entire app, it should be removed in a future cleanup pass. |
| G-4 | Low | `GA` and `GB` lack a formally documented semantic distinction beyond their values. §3.1 of this contract is now the authoritative guide. All future usage must follow the roles defined there. |
| G-5 | ✅ CLOSED | In `Btn`, the caller `style` prop was previously spread last over all styles, allowing callers to override `background` and `cursor` even when `disabled` was `true`. Fixed in session 11-E: disabled background and cursor are now applied via an explicit conditional spread after the caller `style` spread — `{ ...defaultStyles, ...style, ...(disabled ? { background: '#ccc', cursor: 'not-allowed' } : {}) }`. Confirmed on device. |

---

## §10. Other shared components in `src/components/`

This contract is primarily scoped to `ui.jsx`. The components below are
sibling modules in the same directory and are documented here for
discoverability. Detailed prop docs may live alongside their source.

### §10.1 `RangePicker.jsx` (15-E.1)

**Purpose:** Shared date-range filter UI used by `HomePage` (Money List)
and `HistoryPage` (round filter). Single source of truth for range
options, filter logic, and the custom date wheel picker.

**Owner of:** `moneyListRange` and `historyRange` localStorage keys (see
`App_Data_Model_Contract.md` §1.1 and §1.2). Each consumer page owns
one key; the two pages maintain independent filter state.

**Exports:**

| Export | Type | Purpose |
|---|---|---|
| `RANGE_OPTS` | `{v, l}[]` | The five range options: `7days`, `mtd`, `ytd`, `all`, `custom` |
| `ML_KEY` | string | `'moneyListRange'` — Home page key |
| `HISTORY_KEY` | string | `'historyRange'` — History page key |
| `loadRangePref(key)` | function | Reads pref from localStorage at `key`; default `{ range: 'ytd', customStart: null, customEnd: null }`. Defaults `key` to `ML_KEY` for back-compat. |
| `saveRangePref(pref, key)` | function | Writes pref to localStorage at `key`. Defaults `key` to `ML_KEY`. |
| `filterByRange(items, pref)` | function | Filters an array of `{date}` objects by pref; returns full array for `'all'` or unset custom |
| `rangeLabel(pref)` | function | Human-readable label for the pref pill (e.g. `'YTD'` or `'Mar 15, 2025 – May 7, 2026'`) |
| `RangePickerRow` | component | Drop-in pill grid + custom date wheel pickers; props `{ rangePref, onRangePrefChange }` |

**Internal-only (not exported):** `DateChipPicker`, `ScrollWheel`,
`daysInMonth`, `todayParts`, `jan1Parts`, `MONTHS`, `ITEM_H`.

**Rules:**
- No file outside `RangePicker.jsx` reads or writes `localStorage`
  keys `'moneyListRange'` or `'historyRange'` directly. All access goes
  through `loadRangePref(key)` / `saveRangePref(pref, key)`.
- `HistoryPage.applyImport` is the one exception: it writes both keys
  directly when applying a backup, by design — the import is restoring
  saved values, not generating them.
- Consumer pages each pass their own key (`ML_KEY` or `HISTORY_KEY`)
  to `loadRangePref` / `saveRangePref` and pass `rangePref` /
  `onRangePrefChange` to `RangePickerRow`. The component itself is
  key-agnostic.
- New range options or filter logic changes are made in this file only.
  Both consumer pages pick up changes automatically.

**Style consistency:** The pill grid pattern (`repeat(5, 1fr)` grid,
green-filled active state, `borderRadius: 20`) is replicated by
`CoursesPage.jsx` add buttons (Search / Scan Card / Manual). Future
top-of-page action rows should follow the same pattern.

---


---

## §12. ScorecardPage ScoreGrid Pin Behavior (v1.7)

### §12.1 Purpose

The pin toggle lets users keep the ScoreGrid visible at the top of
ScorecardPage while scrolling down through the game tables below.
When pinned, the ScoreGrid becomes a sticky element that stays in
view; when unpinned, page scrolling is unchanged from pre-15-G
behavior.

### §12.2 Scroll container

The page scroll container is the root `<div style={{ minHeight: '100vh' }}>` 
in `ScorecardPage` — the page itself scrolls (no inner scroll wrapper). 
This is a pre-existing invariant that must not change. The sticky header 
(green bar with logo/course name) already uses `position: sticky; top: 0; 
zIndex: 10`. The pinned ScoreGrid wrapper uses `position: sticky; top: 
<stickyHeaderHeight>px` so it sits directly below the header.

### §12.3 Sticky header height

The sticky header height is **73px** (measured from live source: 
`padding: '8px 16px 7px'` with logo height 58px + padding ≈ 73px). 
This value is declared as a named constant `STICKY_HEADER_H = 73` in 
`ScorecardPage.jsx`. If the header height changes in a future session, 
update this constant — do not hardcode the numeric value at the sticky 
wrapper.

### §12.4 Pin preference persistence

- localStorage key: `'pinScoreGrid'` (see `App_Data_Model_Contract.md` §1 and §1.3)
- Shape: JSON boolean (`true` / `false`)
- Default when absent or unreadable: `false` (unpinned)
- Read once on mount via `useState(() => ...)` initializer
- Written on every toggle via `localStorage.setItem`
- No shared helper required — plain `localStorage.getItem` / `setItem`

### §12.5 Toggle UI location

The pin toggle is a small icon button rendered in two locations matching
the zoom button placement:

- **Portrait:** Inside `ScoreGrid`'s `renderHalf` header row, next to
  `ZoomBtn`. `ScoreGrid` receives two new props: `pinned: boolean` and
  `onPinToggle: () => void`. `ScorecardPage` owns state and storage;
  ScoreGrid renders the button only.
- **Landscape:** Inside `ScorecardPage`'s existing landscape dot-control /
  zoom button rows, immediately adjacent to the zoom SVG button(s).

**Icon:** A pushpin SVG (📌 shape) — green-filled when pinned, outlined
(stroke-only, same green) when unpinned. Size: 24×24px, matching the 
zoom button footprint.

### §12.6 Pin mode invariants

The following must hold regardless of pin state:

1. ScoreGrid renders identically in both pinned and unpinned states —
   only its CSS positioning context changes.
2. Game tables below the grid scroll normally beneath the pinned grid.
3. Landscape mode is unaffected — `isLandscape` detection remains the
   single source of truth in `ScorecardPage` (H-4).
4. ZoomModal behavior is unchanged — pin state has no effect on zoom
   open/close or the hidden input architecture (H-12).
5. The `range` prop passed to game table components is unaffected (H-26).
6. Bottom clearance padding (`paddingBottom`) accounts for the pinned
   grid so content below it is not hidden behind it. No explicit
   additional padding is needed — the pinned ScoreGrid is in document
   flow and game tables naturally sit below it.
7. ScoreGrid correctly renders partial-round column layout (9-hole
   ranges) in both pinned and unpinned states — sticky positioning
   does not affect the grid's internal layout.

### §12.7 Props added to ScoreGrid

| Prop | Type | Default | Description |
|---|---|---|---|
| `pinned` | boolean | `false` | When true, ScoreGrid renders the pin icon as filled/active |
| `onPinToggle` | function | `undefined` | Called when pin icon tapped; ScorecardPage toggles state and writes localStorage |

These props are display/callback only. ScoreGrid does not read or write
localStorage directly.

---

## §11. Final Rule

If implementation behavior conflicts with this contract, call out the
conflict. The implementation must be corrected. This document defines
the truth.
