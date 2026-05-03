# Resolver UI Spec

_Version 1.4 — April 2026 — Session 13-E.4_

_Changes in v1.4 (13-E.4):_
_§2.1 — new optional prop `roundStartHole?: number` (default `0`) added to `DepartureResolverSheet`. Header copy rule updated: when `departureHole < roundStartHole`, the header reads "[Name] left before hole [roundStartHole + 1]" (preposition "before") instead of "[Name] left after hole [departureHole + 1]" (preposition "after"). This covers long-press X on the round's first hole (e.g. hole 1 of an 18-hole round → `departureHole = -1`; hole 10 of a back-9 round → `departureHole = 8 < roundStartHole = 9`). Default of `0` preserves byte-identical behavior at all existing call sites that do not pass the prop. Callers using partial round ranges (`roundStartHole > 0`) should pass the prop to produce accurate copy. Surfaced during 13-E.4 device testing; fix folded in at owner direction despite being out of original scope._

_Changes in v1.3 (13-C.8.1):_
_§2.1 `GameRow` type — new optional field `parentGameKey: string | null`. Set on Dots/Specials rows when the game is in team mode locked to a parent team game. Value is `'Sixes'` when `teamMode === 'Sixes'`; the matchDef.id when `teamMode.startsWith('Match:')`. Absent on all other game rows._
_§2.2 `GameResolutionRow` — two changes: (1) Expanded body rendering rule corrected from flat to interleaved: each segment row is immediately followed by its own press rows (matched via `press.parentSeg === seg.segKey`). Orphan presses (no matching segment — defensive) render in a tail bucket after all segments. (2) New optional `lockedTo: { topLevel, reason } | null` prop. When set, only the matching top-level pill is interactive; all others render disabled. A small italic note beneath the pill row shows `lockedTo.reason`._
_§2.6 NEW — Team-Dots parent linkage. When a Dots GameRow has `parentGameKey` set, `DepartureResolverSheet` computes a `lockedTo` value from the parent's draft `topLevel` and passes it to the Dots `GameResolutionRow`. Parent `end_at_k` → child locked to `end_at_k`. Parent `abandon` → child locked to `abandon`. Parent `continue` or unset → no lock. The lock is enforced reactively (auto-sync `useEffect` in the sheet) and on Confirm (locked value committed regardless of user interaction with the child row)._

_Changes in v1.2 (13-C.7, post-build amendment): aligned with
`PartialGameContract.md` v2.1 amendments. §6.6 Sequencer controller
amended to require carry-forward state derivation from saved
`earlyDepartureOpts` (not in-memory chain ref) per PartialGameContract
v2.1 invariant 24. §7 Build session pointers updated to reflect actual
13-C.7 build outputs (sequencer wired in `ScorecardPage.jsx` not
`App.jsx`; Skins-specific `continue` partition lifted forward; engine
departure data guardrail dual-implementation). Session-label cleanup —
references to `13-C.7.5` / `13-C.7.6` collapsed to `13-C.7`.

✅ Self-checked v1.1 (13-C.7): updated for `PartialGameContract.md` v2.0
sequenced-event model. §2.1 prop interface amended — `departedPlayerName:
string` is now the canonical singular-name prop; `departedPlayerNames:
string[]` retained as a deprecated alias for backward-compat with 13-C.6
storage shape. §6.1 (D-3) re-closed under v2.0 with the sequenced model.
§6.2 (D-5) re-closed similarly. New §6.4 game-family option matrix
(mirror of PartialGameContract §6.1). New §6.5 Reorder Departures modal
spec. New §6.6 Sequencer controller spec — orchestrates the per-event
resolver chain.

✅ Self-checked v1.0 (13-C.5): verified each of §2 (G-2), §3 (G-3), §4 (G-1),
§5 (G-4) closes its assigned Known Gap with concrete, implementable detail;
algorithm reduces to numeric boundary tests; prop tables are complete with
no TBD entries; engine firewall (`PartialGameContract.md` §14 invariant #13)
is preserved (no new engine arguments proposed beyond the two existing
exceptions in #13.b); all cross-references resolve to existing contract
sections; worked examples are internally consistent with the algorithm they
illustrate.

---

## §1. Scope & Cross-References

### §1.1 What this spec closes

This spec is the planning deliverable of session 13-C.5. It closes the four
Known Gaps in `PartialGameContract.md` §16:

| Gap | Section here | Subject |
|---|---|---|
| G-1 | §4 | `payouts.js` pre-processing API for departure-aware resolution |
| G-2 | §2 | Component prop interfaces — `DepartureResolverSheet`, `GameResolutionRow`, `BetPillRow` |
| G-3 | §3 | Clinch detection algorithm for Match and Sixes |
| G-4 | §5 | Predetermined range minimum-hole validation rules |

### §1.2 Source-of-truth precedence

`PartialGameContract.md` is the authoritative contract for partial-round
behavior. This spec is the *implementation-level detail* the build sessions
13-C.6, 13-C.7, and 13-C.8 will consume. Where this spec adds clarification or
detail, it does so without amending the contract's high-level rules. The two
exceptions are minor amendments in §6.3 / §10.1 / §10.2 / §11.8 of
`PartialGameContract.md` regarding the not-started press row treatment, which
this session resolves and which are applied as surgical str_replace edits at
session wrap.

If implementation behavior conflicts with this spec, the spec must be
amended to match the contract's intent or the contract amended to match the
implementation reality. The build sessions are not free to silently diverge.

### §1.3 Build sessions consuming this spec

| Session | Consumes |
|---|---|
| 13-C.6 (Proactive Entry) | §2 (all components), §5 (validation if relevant in scoring entry) |
| 13-C.7 (Reactive Entry) | §2 (all components), §5.5 (round-length-change interaction) |
| 13-C.8 (Engine Departure Handling) | §3 (clinch algorithm), §4 (pre-processing API) |

---

## §2. Component Props Interfaces — closes G-2

Three components compose the early-departure resolver UI. They live in
`pages/scorecard/` (or `pages/`, owner discretion at build time). All three
follow the existing `UI_Component_Contract.md` style conventions (inline
JS-object styles, `ui.jsx` tokens, no external CSS).

### §2.1 `DepartureResolverSheet`

The bottom-sheet modal. Composes `GameResolutionRow` instances. Owns its own
draft selection state internally (see §2.4(a)).

**v1.1 amendment (13-C.7):** the prop `departedPlayerNames: string[]` from
v1.0 is RENAMED to `departedPlayerName: string` (singular). The v2.0 model
fires one resolver sheet per departure event, each showing exactly ONE
departed player. The plural `departedPlayerNames: string[]` form is retained
as a deprecated alias for backward-compat with 13-C.6 storage shape — when
the prop is provided as an array, the sheet uses `[0]` as the single name
and ignores additional entries with a console warning. The `scenario` prop
becomes optional; per `PartialGameContract` v2.0 the Scenario A vs Scenario
B distinction is no longer a UI decision (both scenarios use the same
single-name sheet — the group-stop side-effect for Scenario B is applied by
the sequencer per §6.6, not by this component).

**Signature (v1.1 / v1.4):**

```js
DepartureResolverSheet({
  open,
  departedPlayerName,             // v2.0 canonical singular form
  // departedPlayerNames,         // v1.0 deprecated alias — accepted for compat
  departureHole,
  games,
  initialResolutions,
  onConfirm,
  onCancel,
  // scenario,                    // v2.0: optional, no longer drives UI behavior
  roundStartHole,                 // v1.4: optional, default 0 — for header copy edge case
})
```

**Props:**

| Prop | Type | Required | Description |
|---|---|---|---|
| `open` | boolean | yes | Modal visibility. Sheet renders nothing when `false`. |
| `departedPlayerName` | string | yes | Name of the single departed player for THIS resolver event. v1.0 plural prop `departedPlayerNames: string[]` is accepted as fallback (using index `[0]`); `length > 1` is invalid in v2.0. |
| `departureHole` | number | yes | 0-based last hole this departed player scored. Header displays as 1-based. When `departureHole >= roundStartHole`: `"[Name] left after hole [departureHole + 1]"`. When `departureHole < roundStartHole` (player departed before any in-range hole was completed): `"[Name] left before hole [roundStartHole + 1]"`. See header copy rule below. |
| `roundStartHole` | number | no | 0-based index of the round's first hole. Default `0`. Used only for header copy: determines the "before / after" preposition when `departureHole` precedes the range start. Callers using partial round ranges should pass this prop; callers of full 18-hole rounds may omit it (default `0` is correct). |
| `games` | `GameRow[]` | yes | Pre-computed list of games to display, with per-game segment and press status already evaluated. The list is filtered by the sequencer per `PartialGameContract` §5.4.3 (carry-forward state) before being passed to the sheet — games hidden by carry-forward are not in `games[]`. See `GameRow` shape below. |
| `initialResolutions` | `{ [gameKey]: SegmentedResolution }` | yes | Initial draft state. Defaults to per-family defaults per `PartialGameContract` §6.1 / §10.2. The sheet's internal state is seeded from this object on each open. |
| `onConfirm` | `(resolutions: { [gameKey]: SegmentedResolution }) => void` | yes | Fires once when user taps Confirm. Receives the final committed resolution map. The parent (sequencer per §6.6) is responsible for writing this into `activeRound.earlyDepartureOpts[pi]` and advancing to the next event in the chain. |
| `onCancel` | `() => void` | yes | Fires when user taps Cancel, taps the backdrop, or presses ESC. Parent (sequencer) should abort the chain — confirmed events stay on file; un-confirmed events are not written. |
| `scenario` (deprecated) | `'A' \| 'B'` | no | v1.0 prop. v2.0: ignored; both scenarios route through the same sheet shape. Retained for backward-compat with existing call sites; will be removed in a future amendment. |

**`GameRow` shape (input):**

```js
type GameRow = {
  gameKey:    string,            // matches activeGames[] entry; for multi-instance Match this is matchDef.id
  label:      string,            // display label, e.g. '🥊 Match A: Dave vs Alice'
  family:     'clinch' | 'completion' | 'holeByHole',
                                 // §7 game-family classification — drives top-level pill set
  topLevelOptions: TopLevelOption[],
                                 // resolved per game and per game-family per
                                 // PartialGameContract §6.1 v2.0:
                                 // Match-family: ['abandon', 'end_at_k']
                                 // Pool-family: ['abandon', 'end_at_k', 'continue', 'exclude_player']
  segments?:  SegmentRow[],      // present for clinch + completion families; absent for holeByHole
  presses?:   PressRow[],        // present only for clinch family with active presses
  parentGameKey?: string | null, // 13-C.8.1: set on Dots/Specials rows in team mode.
                                 // Value is the parent team game's key:
                                 //   'Sixes'           when gameOpts.Dots.teamMode === 'Sixes'
                                 //   matchDef.id       when teamMode.startsWith('Match:')
                                 // null / absent on all other game rows.
                                 // Used by DepartureResolverSheet to compute the
                                 // lockedTo prop for the Dots GameResolutionRow (§2.6).
}

type TopLevelOption = {
  value: 'abandon' | 'end_at_k' | 'continue' | 'exclude_player',
                                 // v2.0: simplified to 4 canonical tokens
                                 // (v1.0 had 'end_at_k_closed_only' + 'end_at_k_closed_and_open'
                                 // separate; v2.0 uses one 'end_at_k' token with per-segment
                                 // Pay/Abandon pills exposing the same expressivity)
  label: string,                 // 'Abandon' | 'End at hole 13' | 'Continue' | 'Drop Dave'
                                 // Note: 'exclude_player' renders as 'Drop [Name]' in v2.0
                                 // (was 'Remove [Name]' in v1.0). Token name preserved at
                                 // data-model layer.
}

type SegmentRow = {
  segKey:    string,             // 'front' | 'back' | 'overall' | 'seg0' | 'seg1' | 'seg2'
  label:     string,             // display: 'Front 9', 'Back 9', 'Total', 'Front 6', 'Middle 6', 'Last 6'
  status:    'closed' | 'in_progress' | 'complete' | 'partial',
                                 // 'closed' / 'in_progress' for clinch family
                                 // 'complete' / 'partial' for completion family
                                 // v2.0: complete-with-tie segments are 'closed' or 'complete'
                                 // (NOT 'in_progress' / 'partial') — see PartialGameContract §11.6
                                 // and Resolver_UI_Spec §3.4 v1.1 amendment
}

type PressRow = {
  pressKey:  string,             // unique within game, e.g. 'Match:m_xxx:Front:press[0]'
  label:     string,             // 'Press 1', 'Press 2', etc.
  parentSeg: string,             // segKey of the segment this press lives in
  status:    'closed' | 'in_progress',
                                 // never 'not_started' — see §2.4(b)
}
```

**Rendering contract (v1.1):**

- Renders nothing when `open === false`.
- When `open === true`, renders a fixed-position bottom sheet over the
  scorecard. Backdrop is semi-transparent, tap-to-cancel.
- Header (v2.0 single-name, v1.4 preposition rule): when `departureHole >= roundStartHole`: `"{departedPlayerName} left after hole {departureHole + 1}"`. When `departureHole < roundStartHole` (player departed before any in-range hole): `"{departedPlayerName} left before hole {roundStartHole + 1}"`. The v1.0 multi-name comma-list rendering is REMOVED — the sheet always shows exactly one player. (When called with
  the deprecated `departedPlayerNames: string[]` alias of length > 1,
  the sheet uses index `[0]` and emits a console warning.)
- Subhead: `"How should each game be resolved?"`.
- Body: scrollable. One `GameResolutionRow` per entry in `games[]`, in the
  order provided (parent decides ordering — typically `activeGames` order).
- Footer: pinned `[Cancel] [Confirm]` button row. Confirm is `Btn primary`,
  Cancel is `Btn` secondary variant.
- Sheet height: max 90vh; body scrolls if content exceeds available space.
  Footer remains pinned at bottom.
- The sheet is purely presentational once seeded — it composes
  `GameResolutionRow` instances and routes their change events into its own
  internal `draft` state.

**Internal state:**

```js
const [draft, setDraft] = useState(initialResolutions)
```

Re-seeded from `initialResolutions` whenever `open` transitions from `false`
to `true`. Discarded on Cancel; emitted on Confirm.

**Event flow:**

- A `GameResolutionRow` change event fires `onChange(gameKey, partialResolution)`.
- The sheet merges the partial into `draft[gameKey]` via `setDraft`.
- On Confirm, `onConfirm(draft)` fires. Parent writes the result and closes.
- On Cancel, `onCancel()` fires. Parent closes the sheet; `draft` is
  garbage-collected on unmount.

**Accessibility:**

- ESC key closes the sheet (calls `onCancel`).
- Backdrop tap closes the sheet (calls `onCancel`).
- Initial focus moves to the first interactive control inside the sheet on
  open (the first top-level pill of the first game row).
- Focus is trapped inside the sheet while open (focus cannot escape to the
  scorecard underneath).
- Focus returns to the element that opened the sheet on close (long-press X
  cell or Results → button, depending on entry path).

**Usage example (v1.1 — single-event sheet driven by sequencer per §6.6):**

```jsx
// Sequencer state — one current event in flight at a time.
const [resolverOpen, setResolverOpen]               = useState(false)
const [resolverGames, setResolverGames]             = useState([])
const [resolverDepartureHole, setResolverDepartureHole] = useState(0)
const [resolverDepartedName, setResolverDepartedName]   = useState('')
const [resolverPlayerIdx, setResolverPlayerIdx]     = useState(null)
const [resolverInitial, setResolverInitial]         = useState({})
// Pending event queue — sequencer advances through these.
const [pendingEvents, setPendingEvents] = useState([])

// ... when sequencer fires next event:
//   - compute carry-forward state from already-confirmed events
//   - build games[] filtered per PartialGameContract §5.4.3
//   - compute initialResolutions from per-family defaults (§6.4)
//   - set state and open the sheet ...

<DepartureResolverSheet
  open={resolverOpen}
  departedPlayerName={resolverDepartedName}
  departureHole={resolverDepartureHole}
  games={resolverGames}
  initialResolutions={resolverInitial}
  onConfirm={(resolutions) => {
    // Write earlyDepartureOpts[resolverPlayerIdx] with eventOrder.
    commitDepartureResolution(resolverPlayerIdx, resolverDepartureHole, resolutions)
    setResolverOpen(false)
    // Advance to next event in the chain, or apply group-stop write rule
    // (§5.4.4) and transition to Results if no more events.
    advanceSequencer()
  }}
  onCancel={() => {
    // Abort the chain. Already-confirmed events remain on file.
    setResolverOpen(false)
    setPendingEvents([])
  }}
/>
```

**v1.0 usage example (deprecated — for reference only):**

The v1.0 multi-name shape used `departedPlayerNames: string[]` and
`scenario: 'A' | 'B'` props. This code path is no longer the canonical
shape but is still accepted by the v1.1 sheet for backward-compat. v1.1
implementations should use the `departedPlayerName: string` (singular)
and omit `scenario` per the example above.

---

### §2.2 `GameResolutionRow`

One row per game in the sheet. Renders the game label, top-level pill set,
and (when expanded) the per-segment and per-press `BetPillRow` lists.

**Signature:**

```js
GameResolutionRow({
  gameRow,
  resolution,
  onChange,
})
```

**Props:**

| Prop | Type | Required | Description |
|---|---|---|---|
| `gameRow` | `GameRow` | yes | Game metadata as defined in §2.1. |
| `resolution` | `SegmentedResolution` | yes | Current draft resolution for this game. Owned by the parent sheet. |
| `onChange` | `(gameKey: string, partial: Partial<SegmentedResolution>) => void` | yes | Fires when any pill in this row is toggled. Passes the partial update; parent merges into draft. |
| `lockedTo` | `{ topLevel: string, reason: string } \| null` | no | 13-C.8.1: when set, only the top-level pill matching `lockedTo.topLevel` is interactive. All other top-level pills render disabled (greyed out, `aria-disabled`, `pointer-events: none`). A small italic note reading `lockedTo.reason` appears beneath the pill row. Expansion logic uses the locked value. Used by DepartureResolverSheet for team Dots locked to a parent team game (§2.6). |

**`SegmentedResolution` shape (recap from PartialGameContract §4.2):**

```js
type SegmentedResolution = {
  topLevel: 'abandon' | 'end_at_k' | 'continue' | 'exclude_player',
  topLevelVariant?: 'closed_only' | 'closed_and_open',
                                 // clinch family only — disambiguates the two end_at_k variants
  segments?: { [segKey: string]: 'pay' | 'abandon' },
  presses?:  { [pressKey: string]: 'pay' | 'abandon' },
}
```

> **Note on `topLevelVariant`:** `PartialGameContract.md` §7.1 describes "Pay
> closed bets only" and "Pay closed + in-progress bets" as two distinct UI
> options that both map to `end_at_k` internally with different segment/press
> defaults. This spec adds an explicit `topLevelVariant` field to the
> resolution to make the user's intent unambiguous to the pre-processing
> layer (§4.4 derives default `'pay' | 'abandon'` per segment from this
> variant). The variant is `'closed_only'` (default presses to Abandon for
> in-progress; Pay for closed) or `'closed_and_open'` (default Pay for both
> closed and in-progress, user may flip individual rows). The variant field
> is only meaningful when `topLevel === 'end_at_k'` and `family === 'clinch'`.

**Rendering contract:**

- Top: section divider line + game `label` from `gameRow`.
- Top-level pill row: one pill per `gameRow.topLevelOptions`. Selected pill
  is filled green (`G`); unselected pills are outlined. Tapping a pill
  changes `resolution.topLevel` (and `topLevelVariant` for clinch family).
- Expansion logic:
  - Clinch family + `end_at_k` selected with variant `'closed_and_open'`:
    expand both segment rows and press rows.
  - Clinch family + `end_at_k` selected with variant `'closed_only'`:
    expand neither — segment and press defaults are derived automatically
    by §4.4 (closed → Pay, in-progress → Abandon, all per-pill controls
    hidden because the user already chose the policy at top level).
  - Completion family + `end_at_k` selected: expand segment rows.
  - Hole-by-hole family: never expands (no segments, no presses).
  - Any family + `abandon` / `continue` / `exclude_player` selected: never
    expands.
- Expanded body: rendered in interleaved order — for each `SegmentRow` in `gameRow.segments`, the segment `BetPillRow` renders immediately followed by all `PressRow` entries whose `parentSeg === seg.segKey` (each indented one step). Press rows with no matching segment (orphan — defensive; should not occur for rows built by `resolverUtils.buildResolverGameRows`) render in a tail bucket after all segments, also indented. The flat rendering order (all segments first, all presses after) specified in v1.1–v1.2 is **corrected** by this amendment. The visual result is: Front segment → Front Press 1 → Front Press 2 → Back segment → Back Press 1 → Overall segment.

**Event flow:**

- Top-level pill tap → `onChange(gameKey, { topLevel: 'end_at_k',
  topLevelVariant: 'closed_and_open' })`. The component does not itself
  reset segment / press selections when top-level changes — the parent
  sheet (or the §4.4 default-derivation step) is responsible for that. In
  practice, switching top level discards prior segment/press picks because
  the UI doesn't display them.
- Per-segment pill toggle → `onChange(gameKey, { segments: { [segKey]:
  'abandon' } })`. Note: the partial includes only the changed segment;
  parent merges into the existing `resolution.segments`.
- Per-press pill toggle → `onChange(gameKey, { presses: { [pressKey]:
  'abandon' } })`. Same merging behavior.

**Accessibility:**

- Each pill is a focusable, tappable `Btn`-style element with appropriate
  `role="button"` and `aria-pressed` reflecting current selection.
- The expansion of segment / press rows does not move focus.

**Usage example:**

```jsx
<GameResolutionRow
  gameRow={{
    gameKey: 'Match:m_abc',
    label: '🥊 Match A: Dave vs Alice',
    family: 'clinch',
    topLevelOptions: [
      { value: 'abandon', label: 'Abandon' },
      { value: 'end_at_k_closed_only', label: 'Pay closed' },
      { value: 'end_at_k_closed_and_open', label: 'Pay closed + open' },
    ],
    segments: [
      { segKey: 'front', label: 'Front 9', status: 'closed' },
      { segKey: 'back',  label: 'Back 9',  status: 'in_progress' },
      { segKey: 'overall', label: 'Overall', status: 'in_progress' },
    ],
    presses: [
      { pressKey: 'Match:m_abc:Front:press[0]', label: 'Press 1', parentSeg: 'front', status: 'closed' },
      { pressKey: 'Match:m_abc:Back:press[0]',  label: 'Press 1', parentSeg: 'back',  status: 'in_progress' },
    ],
  }}
  resolution={resolutionForMatchA}
  onChange={(gameKey, partial) => mergePartial(gameKey, partial)}
/>
```

---

### §2.3 `BetPillRow`

The atomic row for a single segment or press. Renders label + status badge +
Pay/Abandon pill toggle.

**Signature:**

```js
BetPillRow({
  label,
  status,
  decision,
  onChange,
  indented,
})
```

**Props:**

| Prop | Type | Required | Default | Description |
|---|---|---|---|---|
| `label` | string | yes | — | Display label, e.g. `'Front 9'`, `'Press 1'`. |
| `status` | `'closed' \| 'in_progress' \| 'complete' \| 'partial'` | yes | — | Status badge content. Drives badge color/label per the table below. |
| `decision` | `'pay' \| 'abandon'` | yes | — | Currently selected pill. |
| `onChange` | `(decision: 'pay' \| 'abandon') => void` | yes | — | Fires on pill tap. |
| `indented` | boolean | no | `false` | When true, applies a left margin (~16px) to visually nest the row under its parent segment. Used for press rows. |

**Status badge convention:**

| Status | Badge text | Badge color |
|---|---|---|
| `closed` | `Closed ✓` | `G` (green primary) |
| `in_progress` | `In progress` | neutral gray |
| `complete` | `Complete` | `G` |
| `partial` | `Partial` | neutral gray |

**Rendering contract:**

- Single horizontal row with three regions: label (left), status badge
  (middle), `[Pay] [Abandon]` pill pair (right).
- The pill pair is a two-button toggle. The selected pill is filled green
  (`G`); the unselected pill is outlined.
- `indented === true` shifts the entire row right by ~16px to nest visually
  under the segment row above it.

**Accessibility:**

- Each pill is focusable and exposes `aria-pressed`.
- Status badge has a `role="status"` annotation for screen readers.

**Usage example:**

```jsx
<BetPillRow
  label="Front 9"
  status="closed"
  decision="pay"
  onChange={(d) => updateSegment('front', d)}
/>
<BetPillRow
  label="Press 1"
  status="in_progress"
  decision="abandon"
  onChange={(d) => updatePress('Match:m_abc:Front:press[0]', d)}
  indented
/>
```

---

### §2.4 Resolved UX decisions (owner-approved)

These three decisions were surfaced and resolved during the 13-C.5 planning
session. They are listed here for traceability and to lock the design before
build sessions begin.

**(a) Sheet owns draft state; parent receives a single `onConfirm` event.**

`DepartureResolverSheet` owns its draft selection state internally via
`useState(initialResolutions)`. Per-pill toggles update internal state only.
The parent (`ScorecardPage` / `ResultsPage` depending on entry path) does
**not** receive incremental change events. On Confirm, a single
`onConfirm(resolutions)` event fires with the committed shape; the parent
writes it into `activeRound.earlyDepartureOpts.gameResolutions`. On Cancel,
the draft is discarded and `activeRound` is unchanged.

**Why this is consistent with the architecture:** App Data Model Contract §3
states that `ScorecardPage.jsx` is the state owner — but specifically of
**`activeRound` state**, the persisted round data. Resolver draft state is
transient UI-modal scratch state that exists only between sheet open and
sheet close; it is not `activeRound` state, and Cancel guarantees it never
becomes `activeRound` state. This is the same pattern as `PressModal` (which
holds its own draft press configuration internally and only commits via
`onConfirm`) and `DotsPopup`.

**(b) Not-started presses are not rendered in the sheet.**

A press whose trigger hole is greater than `departureHole` (Scenario A) or
`lastCompletedHole` (Scenario B) is **not a bet** — there are no holes left
in the segment for it to score over. The user has nothing to decide about
it because it never had a chance to run. Such presses are filtered out by
the §4.4 segment status evaluator before the `GameRow.presses[]` array is
constructed, and therefore never reach the resolver sheet.

This applies to both manual presses (entries in `manualPresses` for a
trigger hole > `departureHole`) and auto-presses that would have triggered
on a hole > `departureHole` had the round continued.

The two press states that **do** appear in the sheet are `closed` and
`in_progress`. There is no third "not started" state in `PressRow.status`.

> **Contract amendment:** This resolves an ambiguity in
> `PartialGameContract.md` §6.3, §10.1, §10.2, and §11.8, which previously
> described not-started presses as appearing in the sheet with an
> automatically-Abandoned status and no toggle. The owner-approved
> resolution is that they are omitted entirely. Surgical str_replace edits
> to those four sections of the contract are applied at session 13-C.5
> wrap.

**(c) Team Match departure ends the match — resolved like any other Match.**

When one player on a 2v2 team Match departs, the match is resolved using
the same top-level options available to every Match: `abandon`,
`end_at_k_closed_only`, or `end_at_k_closed_and_open`. The resolver sheet
displays the match row identically to a non-departure team match (label
`'🥊 Match A: Team 1 vs Team 2'`); the per-segment and per-press pill grid
is identical.

There is no shorthanded play, no per-player breakdown row, and no
team-shorthanded indicator. The sheet header already names the departed
player(s); no additional per-row indicator is needed.

This decision means PartialGameContract D-6 ("Team Match shorthand play
(1v2 after departure)") in §15 remains deferred indefinitely — the
shorthanded-play scoring question doesn't arise because the user always
ends the match (via `abandon` or `end_at_k`) rather than continuing it.

---

### §2.5 Accessibility summary

- Modal traps focus inside itself while open.
- Initial focus on first interactive control (first game's first top-level
  pill).
- Focus returns to the originating element on close.
- ESC closes (Cancel).
- Backdrop tap closes (Cancel).
- All pills expose `aria-pressed`. Status badges have `role="status"`.

---

### §2.6 Component file ownership

These three components were created in 13-C.6 / 13-C.7:

- `pages/scorecard/DepartureResolverSheet.jsx`
- `pages/scorecard/GameResolutionRow.jsx`
- `pages/scorecard/BetPillRow.jsx`

### §2.7 Team-Dots parent linkage (13-C.8.1)

When `gameOpts.Dots.teamMode` points at a parent team game (Sixes or a team Match),
the Dots game row carries `parentGameKey` (§2.1). `DepartureResolverSheet` uses this
to enforce a one-way resolution lock:

**Lock rule:**

| Parent draft `topLevel` | Dots `lockedTo` | Effect |
|---|---|---|
| `'end_at_k'` | `{ topLevel: 'end_at_k', reason: 'Locked to <parentLabel> — ends at hole X' }` | Only `end_at_k` pill interactive on Dots row |
| `'abandon'` | `{ topLevel: 'abandon', reason: 'Locked to <parentLabel> — parent abandoned' }` | Only `abandon` pill interactive on Dots row |
| `'continue'` | `null` | Dots row fully unlocked; user may pick any option |
| unset / no parent | `null` | No lock |

**Implementation:** `DepartureResolverSheet` computes `lockedTo` via a
`computeLockedToFromParent(parentResolution, parentLabel, departureHole)` helper
(where `parentResolution` is the parent's current draft `SegmentedResolution`,
`parentLabel` is the parent's display label, and `departureHole` is the current
event's hole for the "ends at hole X" suffix). A `useEffect` watches the full draft
and auto-syncs the Dots row's `topLevel` to match the locked value whenever the parent
changes, preventing the draft from reaching `onConfirm` in an inconsistent state.
`lookupParentLabel(games, parentGameKey)` resolves the parent's display label from
the `games[]` array using `parentGameKey` as the lookup key.

**Rationale:** `payouts.js` already enforces this rule at compute time — when the
parent (Sixes / team Match) ends at hole X, the Dots range is capped at the same
hole; when the parent abandons, Dots abandons too. The resolver UI lock surfaces
this constraint to the user visually and prevents confusion when a resolver shows
the Dots row locked to an already-determined outcome.

**Deferred:** when `topLevel === 'continue'` is selected for Dots while the parent
chose `end_at_k`, the intent is "convert team Dots to individual Dots from the next
hole onward." This conversion mechanic is deferred (BUILD_PLAN D-15). Until it ships,
a `continue` Dots resolution with an `end_at_k` parent is treated by the engine as
"Dots ends with parent" — the parent's end-hole caps the Dots range.

---

## §3. Clinch Detection Algorithm — Match & Sixes — closes G-3

### §3.1 State definitions

A bet (segment or press) in the clinch-segment family (Match, Sixes) is in
exactly one of three states at the moment of departure:

| State | Boundary condition |
|---|---|
| `closed` | One side leads by more holes won than there are holes remaining in the bet's range, evaluated at `departureHole`. Mathematically: `\|holesWonA − holesWonB\| > holesRemaining`. |
| `in_progress` | The bet started before or on `departureHole` AND is not closed. The bet has at least one played hole. |
| `not_started` | The bet's `startHole > departureHole`. Internal state only — never appears in the resolver sheet (per §2.4(b)). |

`holesRemaining` is the number of holes in the bet's range that come strictly
after `departureHole`:

```
holesRemaining = max(0, betEndHole − departureHole)
```

Where `betEndHole` is the last hole in the bet's range (e.g., hole 8 for a
Match Front segment on a full round, hole 17 for a Match Overall segment, or
the last hole of a press's parent segment). Indices are 0-based.

> **Note on dormie + 1:** The boundary condition `|lead| > holesRemaining`
> is the standard dormie + 1 rule restated in arithmetic form: a side that
> leads by exactly `holesRemaining` is "dormie" (cannot lose but could still
> tie); a side that leads by `holesRemaining + 1` or more is "closed"
> (mathematically cannot be caught). This matches `Nassau_Match_Contract.md`
> §3.2 and `PartialGameContract.md` §7.1 verbatim.

### §3.2 Per-bet input shape

The clinch evaluator operates on one bet at a time. Input:

```js
type BetEvaluationInput = {
  // Bet identity
  betKind:    'segment' | 'press',
  segKey:     'front' | 'back' | 'overall' | 'seg0' | 'seg1' | 'seg2',
  pressKey?:  string,         // present iff betKind === 'press'

  // Bet hole range (0-based, inclusive)
  betStartHole: number,       // for segments: segment's first hole; for presses: trigger hole + 1
  betEndHole:   number,       // last hole of the parent segment

  // Departure context
  departureHole: number,      // 0-based last hole the departed player(s) scored

  // Side win counts at departureHole
  holesWonSideA: number,      // holes won by side A within [betStartHole, departureHole]
  holesWonSideB: number,      // holes won by side B within [betStartHole, departureHole]
}
```

The `holesWon*` counts are derived from the engine output by the §4.4
status evaluator. The clinch evaluator itself does not call the engine — it
consumes already-computed hole-win counts.

### §3.3 Per-bet output shape

```js
type BetStatus = {
  betKind:    'segment' | 'press',
  segKey:     string,
  pressKey?:  string,
  status:     'closed' | 'in_progress',
                             // 'not_started' is filtered out at the
                             // GameRow construction step (§2.4(b)) and
                             // does not appear in this output
  leader:     'A' | 'B' | null,   // null if status === 'in_progress' and lead === 0
  lead:       number,        // |holesWonSideA - holesWonSideB|; always non-negative
}
```

The `leader` field tells `payouts.js` who wins the bet under a `Pay`
decision. For `closed` bets the leader is unambiguous (clinched). For
`in_progress` bets the leader is the side currently ahead at
`departureHole`; if `lead === 0` (all-square at departure), `leader` is
`null` and `payouts.js` applies the existing Match all-square tie rule
(`Nassau_Match_Contract.md` §9.5).

### §3.4 Algorithm

```js
function evaluateBetStatus(input) {
  const { betStartHole, betEndHole, departureHole,
          holesWonSideA, holesWonSideB } = input

  // Bet starts after departure → not_started; filtered at GameRow stage,
  // but the evaluator returns the sentinel for completeness
  if (betStartHole > departureHole) {
    return { ...input, status: 'not_started', leader: null, lead: 0 }
  }

  const lead           = Math.abs(holesWonSideA - holesWonSideB)
  const holesRemaining = Math.max(0, betEndHole - departureHole)

  const status = (lead > holesRemaining) ? 'closed' : 'in_progress'

  let leader = null
  if (holesWonSideA > holesWonSideB) leader = 'A'
  else if (holesWonSideB > holesWonSideA) leader = 'B'

  return { ...input, status, leader, lead }
}
```

The function is pure, deterministic, and does no engine work. It lives in
`payouts.js` as part of the pre-processing layer (§4.4), not in the engine.

### §3.5 Alignment with existing engine logic

The closure rule above is identical to:

- `Nassau_Match_Contract.md` §3.2: *"A match closes when the leader's
  margin exceeds the number of holes remaining."*
- `PartialGameContract.md` §7.1 (Clinch-segment family): *"A bet (segment
  or press) is closed when one side has mathematically clinched it… won `h`
  holes such that `h > n − h` — they lead by more holes than their opponent
  has remaining holes to win."*
- `PartialGameContract.md` §11.6 (Segment status evaluation — clinch-segment
  family): *"Closed = one side leads by more holes won than holes remaining
  in that bet's range (dormie + 1)."*

`runMatchNassau` in `games.js` produces a `bet.status` display string
(`"3&2"`, `"2UP thru 9"`) that already encodes whether the match is closed
— but that display string is intentionally not the source of truth for
this algorithm. The clinch evaluator computes the boolean `closed` state
from the same inputs (`p1w`, `p2w`, segment range) using the same rule, so
the result is provably equivalent. This avoids string parsing of engine
output and keeps the §11.1 engine firewall intact.

For Sixes, `runSixesSegment` (or `calcSixesSegment` until the function is
added — see Sixes Contract §5.6) produces `MatchResult.lead` and `.thru` per
match level. The same evaluator applies: `lead = abs(abw − cdw)`,
`holesRemaining = segmentEndHole − departureHole`, `closed iff lead >
holesRemaining`.

The evaluator is run *per bet* — once for each segment of each Match
instance, and once for each press at each depth in each segment. Sixes
follows the same per-segment, per-press loop.

> **No engine change is proposed.** The §14 invariant #13 firewall is
> preserved: the algorithm runs entirely in `payouts.js` pre-processing,
> consuming engine output (`p1w`, `p2w`, `lead`, `thru`) without modifying
> any engine function. The two existing exceptions in #13.b (the optional
> `range` argument on `runMatchNassau` and `calcTeamStablefordTotal`) are
> the only engine-side touchpoints; this spec does not extend them.

### §3.6 Worked examples

**Example 1 — Match Front clinched at dormie + 1 mid-front.**

Setup: 18-hole round; Match `m_abc` between Dave (p1) and Alice (p2);
`betFront = $5`. Dave wins holes 1, 3, 5, 6, 7. Alice wins holes 2, 4. After
hole 7, Dave leads 5–2 = 3UP. Dave departs after hole 7 (`departureHole = 6`,
0-based).

Front segment range: `[0, 8]` (holes 1–9, 0-based 0–8).

```
betStartHole   = 0
betEndHole     = 8
departureHole  = 6
holesWonSideA  = 5  (Dave)
holesWonSideB  = 2  (Alice)

lead           = |5 - 2| = 3
holesRemaining = max(0, 8 - 6) = 2

closed?        = (3 > 2) → TRUE
status         = 'closed'
leader         = 'A' (Dave)
```

Result: Front segment is `closed` with Dave leading. Under default
`end_at_k_closed_and_open` Pay decision, payouts.js charges Alice $5 and
credits Dave $5 for the Front segment.

**Example 2 — Match Overall in progress, no clinch.**

Same round, same departure at hole 7. Across 7 played holes Dave has won 5,
Alice has won 2.

Overall segment range: `[0, 17]`.

```
betStartHole   = 0
betEndHole     = 17
departureHole  = 6
holesWonSideA  = 5
holesWonSideB  = 2

lead           = 3
holesRemaining = max(0, 17 - 6) = 11

closed?        = (3 > 11) → FALSE
status         = 'in_progress'
leader         = 'A' (Dave)
lead           = 3
```

Result: Overall segment is `in_progress`, Dave leading by 3. Default Pay
decision pays Dave the Overall bet amount (current-leader rule per
`PartialGameContract.md` §11.6 last paragraph). User can flip to Abandon
via the Overall row's pill toggle.

**Example 3 — Press not started (filtered before resolver).**

Same round, same departure at hole 7. A manual press exists for the Front
segment at trigger hole 7 — meaning press 1 would start at hole 8 (0-based).

```
betStartHole = 7   (trigger hole + 1 = 7, 0-based hole 8)
                   actually trigger = 7, start = 7 + 1? Let's resolve:
                   manualPresses entry [7] means "press starts after hole 7"
                   which is hole 8 (0-based hole 7 → next hole is index 7).
                   For this example, treat betStartHole = 7 (the next hole
                   after the trigger, 0-based).
departureHole = 6

betStartHole > departureHole → 7 > 6 → TRUE
→ not_started
```

This press is filtered out by the §4.4 evaluator before `GameRow.presses[]`
is constructed. It does not appear in the resolver sheet. Its bet amount
contributes $0 to the payout (no decision needed because the bet did not
exist in any meaningful sense — the segment ended before the press could
begin). See §2.4(b) for the rationale.

**Example 4 — Sixes seg2 clinched on partial-range round (Sixes Contract §3.7).**

Setup: 12-hole round (`roundStartHole = 0, roundNumHoles = 12`). Sixes
range = entire round. `totalHoles = 12, segLen = 4`. Three segments:
`seg0 = [0,3], seg1 = [4,7], seg2 = [8,11]`.

A player departs after hole 10 (`departureHole = 9`, 0-based). Within seg2
(holes 8–11) two holes have been played (8 and 9). Team A won both.

```
betStartHole   = 8
betEndHole     = 11
departureHole  = 9
holesWonSideA  = 2
holesWonSideB  = 0

lead           = 2
holesRemaining = max(0, 11 - 9) = 2

closed?        = (2 > 2) → FALSE
status         = 'in_progress'
leader         = 'A'
lead           = 2
```

Result: seg2 is `in_progress`, Team A leads by 2 (dormie). Default Pay
decision pays Team A the seg2 bet (current-leader rule). User can flip to
Abandon. If a third hole had been played and Team A had won it (3–0 with 1
remaining), `lead = 3 > holesRemaining = 1` and the segment would be
`closed`.

---

## §4. `payouts.js` Pre-Processing API — closes G-1

### §4.1 Layer position and engine firewall reaffirmation

The pre-processing layer sits between `buildPayoutArgs` (which produces the
unmodified `args` blob from `activeRound`) and the per-game engine call
sites inside `computePayouts`. Its responsibilities:

1. Resolve the effective hole range for each game (§4.2).
2. Trim score arrays to that range (§4.2).
3. Apply player-subset removal for `exclude_player` resolution (§4.2).
4. Evaluate per-segment / per-press status using the §3 clinch algorithm
   for the clinch family, or per-segment completion for the completion
   family (§4.4).
5. Call the engine.
6. Mutate the engine output's per-segment / per-press payouts to zero out
   `'abandon'` decisions (§4.5).

> **Engine firewall reaffirmed:** No new engine arguments are proposed in
> this spec. The two exceptions in `PartialGameContract.md` §14 invariant
> #13.b (`runMatchNassau` and `calcTeamStablefordTotal` accepting an
> optional `range` argument for §3.6 midpoint derivation) remain the only
> range-aware engine functions. All other range, departure, and resolution
> logic lives in `payouts.js`.

### §4.2 Score-trimming and subset primitives

Three primitive helpers operate on `scores`:

#### `trimScoresToRange(scores, startHole, endHole) → trimmedScores`

**Already exists** in `payouts.js` (introduced in 13-C.3 Phase 2A). Returns
a new 18-row array where rows outside `[startHole, endHole]` are replaced
with empty rows (one entry per player, all `''`). Does not mutate the
input. The shape is preserved (always 18 rows, always `players.length`
entries per row) so engine functions that iterate `0..17` see no
difference except that out-of-range rows look unscored.

Idempotency: `trimScoresToRange(trimScoresToRange(s, a, b), a, b) ===
trimScoresToRange(s, a, b)` (deep-equal).

#### `trimScoresToHole(scores, playerIdx, lastHole) → trimmedScores` *(new)*

Returns a new 18-row array where, for the specified `playerIdx`, scores at
holes strictly greater than `lastHole` are replaced with `''`. All other
players' scores are preserved. Does not mutate the input.

Used to enforce `PartialGameContract.md` §14 invariant #3 ("the engine
never receives non-empty scores for post-departure holes") at the
pre-processing boundary, regardless of what is stored in `activeRound`.
Stored post-departure scores should already be `''` per the data model, but
this primitive provides defense in depth — if a stale or speculative score
exists, it is filtered out before reaching the engine.

Signature:

```js
function trimScoresToHole(scores, playerIdx, lastHole) {
  return scores.map((row, h) =>
    h > lastHole
      ? row.map((v, i) => (i === playerIdx ? '' : v))
      : row.slice()
  )
}
```

Idempotency: applying with the same `(playerIdx, lastHole)` twice yields
the same result.

When multiple players have departed, the primitive is composed by chaining
calls (one per departed player), each with that player's `departureHole`.

#### `excludePlayerSubset(subsetIdxs, excludePlayerIdx) → newSubsetIdxs` *(new)*

Returns a new array with `excludePlayerIdx` removed. If `subsetIdxs` is the
empty array (which means "all players" by convention — see Payout Contract
§4.1), returns the explicit list of all-player indices except
`excludePlayerIdx`.

Used by the §4.3 dispatcher when a game's resolution is `exclude_player`.
The resulting subset is passed to the engine in place of the original; the
engine sees a complete, valid subset and is unaware any player was removed
(per `PartialGameContract.md` §11.5).

Signature:

```js
function excludePlayerSubset(subsetIdxs, excludePlayerIdx, allPlayersLength) {
  if (!subsetIdxs?.length) {
    // [] = "all players"; expand and remove
    return Array.from({ length: allPlayersLength }, (_, i) => i)
                .filter(i => i !== excludePlayerIdx)
  }
  return subsetIdxs.filter(i => i !== excludePlayerIdx)
}
```

### §4.3 Per-game resolution dispatcher

For each game block in `computePayouts`, the dispatcher applies the
resolution before the engine call:

```js
function applyResolution(gameKey, baseArgs, resolution, ctx) {
  // resolution is the SegmentedResolution from earlyDepartureOpts.gameResolutions
  // baseArgs is the engine call arg bundle for this game
  // ctx contains: departureHole, departedPlayerIdxs, gameRange, allPlayersLength

  switch (resolution.topLevel) {
    case 'abandon':
      // Skip engine call entirely; return null to signal "no payout this game"
      return null

    case 'continue':
      // Skins / Dots only. Pass scores through endHole unchanged.
      // Departed players' post-departure cells contain X (per ScoreKeypad
      // Contract §4.5 "X always loses"); engine handles the rest.
      return baseArgs

    case 'exclude_player': {
      // Stableford ind / Stroke Play / Dots only (per §6.1 of PartialGameContract).
      // Remove departed player from the subset; keep full hole range.
      const newSubset = ctx.departedPlayerIdxs.reduce(
        (acc, idx) => excludePlayerSubset(acc, idx, ctx.allPlayersLength),
        baseArgs.subsetIdxs
      )
      return { ...baseArgs, subsetIdxs: newSubset }
    }

    case 'end_at_k': {
      // Trim each departed player's post-departure scores; the game range
      // is unchanged (the segment status evaluator and the segment
      // pay/abandon decisions handle the partial-segment logic).
      const trimmed = ctx.departedPlayerIdxs.reduce(
        (s, idx) => trimScoresToHole(s, idx, ctx.departureHole),
        baseArgs.scores
      )
      return { ...baseArgs, scores: trimmed }
    }

    default:
      throw new Error(`Unknown resolution.topLevel: ${resolution.topLevel}`)
  }
}
```

The dispatcher returns either a transformed `baseArgs` (to be passed to the
engine) or `null` (to skip the game entirely). The caller in
`computePayouts` checks for `null` and emits an empty breakdown entry — or
no entry at all — for that game.

### §4.4 Segment status evaluator

After the engine call, for clinch-family games (Match, Sixes), the
evaluator runs over the engine's output to classify each segment and press:

```js
function evaluateGameStatuses(engineOutput, gameRow, ctx) {
  // engineOutput is the per-game engine result
  //   - Match: { front: [...], back: [...], overall: [...] }
  //   - Sixes: array of segments, each with array of match levels
  // Returns a map of segKey/pressKey → BetStatus (per §3.3)

  const statuses = {}

  for (const segKey of segmentKeysForGame(gameRow)) {
    const segOutput = engineOutput[segKey]  // bets array
    const baseBet   = segOutput[0]          // index 0 = main bet for segment
    statuses[segKey] = evaluateBetStatus({
      betKind:       'segment',
      segKey,
      betStartHole:  segmentStartHole(segKey, ctx),
      betEndHole:    segmentEndHole(segKey, ctx),
      departureHole: ctx.departureHole,
      holesWonSideA: baseBet.p1w ?? baseBet.aw ?? 0,
      holesWonSideB: baseBet.p2w ?? baseBet.cdw ?? 0,
    })

    // Press bets within this segment
    for (let depth = 1; depth < segOutput.length; depth++) {
      const pressBet = segOutput[depth]
      const pressKey = formatPressKey(gameRow.gameKey, segKey, depth - 1)
      statuses[pressKey] = evaluateBetStatus({
        betKind:       'press',
        segKey,
        pressKey,
        betStartHole:  pressBet.startHole,
        betEndHole:    segmentEndHole(segKey, ctx),
        departureHole: ctx.departureHole,
        holesWonSideA: pressBet.p1w ?? pressBet.aw ?? 0,
        holesWonSideB: pressBet.p2w ?? pressBet.cdw ?? 0,
      })
    }
  }

  return statuses
}
```

For the completion-segment family (Nines, Stableford segments, Stroke Play
segments), the evaluator computes `complete` vs `partial` instead:

```js
function evaluateCompletionSegment(segKey, ctx) {
  const segEndHole = segmentEndHole(segKey, ctx)
  return ctx.lastPlayedHole >= segEndHole
    ? { segKey, status: 'complete' }
    : { segKey, status: 'partial' }
}
```

Where `lastPlayedHole = departureHole` (Scenario A) or `lastCompletedHole`
(Scenario B), per `PartialGameContract.md` §7.2.

The status maps produced by these evaluators feed the §2 component prop
construction (the `GameRow` object) and the §4.5 abandon-zeroing step.

**Default decision derivation from `topLevelVariant`:**

When `topLevel === 'end_at_k'` and `topLevelVariant === 'closed_only'`, the
default Pay/Abandon decisions are derived automatically without expanding
the per-segment / per-press UI:

| Status | Default decision under `closed_only` |
|---|---|
| `closed` | `'pay'` |
| `in_progress` | `'abandon'` |

When `topLevelVariant === 'closed_and_open'`, all segments and presses
default to `'pay'`, and the user may flip individual rows to `'abandon'`.

For the completion family (no variant), all segments default to `'pay'`
(complete and partial) per `PartialGameContract.md` §11.7.

### §4.5 Output integration — abandon zeroing

`Pay` / `Abandon` decisions take effect by **mutating the per-segment and
per-press payouts in the engine output** before they are accumulated into
the global `bank` and `breakdown[]`. The engine call itself is range-aware
(via the trimmed scores from §4.3) but is unaware of the user's
Pay/Abandon decisions; those decisions are applied to engine output in
post-processing.

**Why post-engine zeroing rather than per-segment skip:**

- The engine remains range-only-aware, satisfying invariant #13.b. No new
  engine arguments are introduced.
- The Pay/Abandon decision is a payout policy, not a scoring rule.
  Post-engine application keeps policy logic in `payouts.js` where it
  belongs.
- The breakdown construction is simpler — engine produces the canonical
  matchCols / per-segment numbers, and the abandon-zero step zeroes the
  correct cells without re-running the engine per segment.

**Implementation pattern (clinch family example for Match):**

```js
// After runMatchNassau call, for each segment + press:
const statuses = evaluateGameStatuses(engineOutput, gameRow, ctx)

for (const [segKey, segStatus] of segmentEntries(statuses)) {
  const decision = resolution.segments?.[segKey] ??
                   defaultDecisionFromVariant(segStatus.status, resolution.topLevelVariant)
  if (decision === 'abandon') {
    // Zero out the segment's main bet contribution to gb (the per-game bank)
    zeroSegmentBet(gb, engineOutput, segKey, gameRow, matchDef)
  }
}

// Same pattern for presses: keyed by pressKey; default from variant; zero on abandon.
```

**Interaction with columnar breakdown shape:**

For columnar entries (`Payout_Contract.md` §3.2), abandon-zeroing means the
corresponding column in `matchCols[]` is set to 0 for every row in the
breakdown, and the per-row total in the last column is recomputed as the
sum of the (possibly zeroed) preceding columns.

For flat entries (Skins, Sixes), abandon-zeroing zeros the relevant
contribution to each row's `net`. The breakdown rows' `net` field is
recomputed as the sum of the per-segment / per-press contributions after
zeroing.

**Zero-sum invariant preservation:**

After all abandon-zeroing is applied for a given game, `Σ gb[name] === 0`
must still hold (per `PartialGameContract.md` §14 invariant #6). Because
the abandon mechanism zeros symmetric pay/loss pairs (every $X paid was
$X collected), this invariant is preserved automatically.

### §4.6 Order of operations

For each game block in `computePayouts`:

```
1. Resolve effective game range:
   range = rangeFor(gameKey, gameRanges, roundStartHole, roundEndHole)

2. Resolve resolution from earlyDepartureOpts.gameResolutions[gameKey]
   (default = no departure → no resolution applied)

3. Apply resolution dispatcher (§4.3):
   - abandon         → return null, skip game
   - continue        → no score transformation; pass through
   - exclude_player  → remove player from subset
   - end_at_k        → trimScoresToHole per departed player

4. Trim scores to game range:
   scores' = trimScoresToRange(scoresAfterStep3, range.startHole, range.endHole)

5. Call engine with transformed args
6. Run segment status evaluator (§4.4) on engine output
7. Apply Pay/Abandon decisions per segment and press (§4.5)
8. Accumulate per-row contributions into gb and breakdown[]
9. Merge gb into global bank
```

> Step 4 (game-range trim) runs *after* the per-player departure trim in
> step 3 because game-range trim is uniform across all players, while
> departure trim is per-player. Composing in either order yields the same
> result (both are deterministic filters over the score grid), but
> applying departure first is conceptually clearer: "trim the player's
> tail, then trim everyone to the game's window."

### §4.7 Per-game dispatch table

The table below lists, for each game, which resolutions are valid (per
`PartialGameContract.md` §6.1) and what input transformation each applies.
Build session 13-C.8 implements this table directly.

| Game | `abandon` | `end_at_k` | `continue` | `exclude_player` |
|---|---|---|---|---|
| Match | skip game | trimScoresToHole(departed, k) | n/a | n/a |
| Skins (perSkin) | skip game | trimScoresToHole(departed, k) | pass through (X loses) | n/a |
| Skins (pot) | skip game | trimScoresToHole(departed, k) | pass through (X loses) | n/a |
| Stableford ind | skip game | trimScoresToHole(departed, k) | n/a | excludePlayerSubset(stablefordPlayers, departed) |
| Stableford team | skip game | trimScoresToHole(departed, k) | n/a | n/a |
| Nines | skip game | trimScoresToHole(departed, k) | n/a | n/a |
| Sixes | skip game | trimScoresToHole(departed, k) | n/a | n/a |
| Stroke Play | skip game | trimScoresToHole(departed, k) | n/a | excludePlayerSubset(strokePlayPlayers, departed) |
| Dots | skip game | trimScoresToHole(departed, k) | pass through (no new dots after k) | excludePlayerSubset(dotsPlayers, departed) |

For all `end_at_k` rows, the segment status evaluator (§4.4) runs after the
engine call and the §4.5 abandon-zeroing applies the user's per-segment
and per-press Pay/Abandon decisions.

For `continue` (Skins and Dots): the departed player's X scores for
post-departure holes flow through unchanged; "X always loses"
(`ScoreKeypad_Contract.md` §4.5) handles the result naturally — no special
engine logic required, no segment evaluator needed (these games have no
segments).

For `exclude_player`: full retroactive recompute over the game's range
with the departed player removed. The engine receives a clean, complete
subset and is unaware any player was removed.

---

## §5. Predetermined Range Minimum-Hole Validation — closes G-4

### §5.1 Per-game minimum-hole rules and rationale

Each game has a minimum-holes-per-range constraint:

| Game | Minimum holes | Divisibility | Rationale |
|---|---|---|---|
| Nines | 6 | none | Nines settles per F/B/T per `Nines_Contract.md` §5.4. Each half (F or B) needs at least 2 holes for the points totals to be meaningful. With only 4 holes, a 2-hole front and 2-hole back is the minimum sensible configuration; 6 holes ensures at least 3 holes per half. The 6-hole minimum is below the practical threshold for most rounds but enforces a non-degenerate F/B partition. |
| Sixes | 9 | totalHoles % 3 === 0 | Sixes derives three segments via `segLen = totalHoles / 3` per `Sixes_Contract.md` §3.7. Each segment needs at least 2 holes (a 1-hole segment cannot resolve a team rotation); `segLen >= 2` requires `totalHoles >= 6`, but the divisibility-by-3 constraint (D-10 deferred) bumps the floor to 9 (3 segments × 3 holes minimum). The 9-hole minimum and divisibility constraint together ensure the engine `runSixesSegment` receives uniform, non-degenerate segments. |
| Match | 3 | none | A Match needs enough holes to be playable. 3 is the practical lower bound — fewer than 3 holes makes the press hierarchy meaningless and the segment partition (Front/Back/Overall) degenerate. |
| Skins | 3 | none | Skins works at any hole count; 3 is a uniform floor for "this is a real game, not a single hole bet." |
| Stableford | 3 | none | Same as Skins. With segments mode, each F/B half needs at least 2 holes for points totals to be meaningful — 3 holes total enforces a non-degenerate split (e.g., 2-front 1-back or 1-front 2-back). |
| Stroke Play | 3 | none | Same as Stableford. |
| Dots | 3 | none | Dots can work at any hole count; 3 is the uniform floor. |

The 3-hole minimum for "all other games" is the universal floor: a 1-hole
or 2-hole bet is a one-off side bet, not a side game, and the app does not
support this configuration.

### §5.2 Validator location

`GameConfig.validateGameRange(gameKey, range, roundStartHole, roundEndHole)
→ { valid: boolean, error?: string }`

Lives in `GameConfig.jsx` (the per-game config component used in
`NewRoundPage`). Pure function; no engine call. Receives the proposed
`{ startHole, endHole }` and returns either `{ valid: true }` or `{ valid:
false, error: 'message' }`.

> **No engine code change is required for G-4.** Validation lives entirely
> in the NewRoundPage / GameConfig UI layer. The engine functions in
> `games.js` continue to assume their inputs satisfy the range constraints
> documented per game.

### §5.3 Error message text

| Failure | Message |
|---|---|
| Nines below 6 holes | `Nines requires at least 6 holes (currently {n}).` |
| Sixes below 9 holes | `Sixes requires at least 9 holes (currently {n}).` |
| Sixes not divisible by 3 | `Sixes range must be divisible by 3 holes (currently {n}). Try {nDown} or {nUp}.` |
| Other game below 3 holes | `{Game name} requires at least 3 holes (currently {n}).` |
| Range exceeds round bounds | `Range cannot extend beyond the round (holes {1bStart}–{1bEnd}).` |

The `{nDown}` / `{nUp}` suggestions for Sixes round to the nearest valid
divisible-by-3 length, suggesting both directions where they fall within
the round.

### §5.4 UX behavior

- Inline error message shown directly below the range pickers in the
  per-game config card. Color: `RED` (per `UI_Component_Contract.md` §3.1).
- The error appears as soon as the user closes both pickers (or as soon as
  one picker is committed and the resulting range is invalid).
- **Save is blocked.** The form's primary "Start Round" / "Save" button is
  disabled while any game has an invalid range. The button's disabled state
  shows a tooltip-equivalent message: `Fix range errors to continue.`
- **No auto-clamp on user input.** The validator does not silently snap the
  user's pickers to the nearest valid range — it reports the error and
  blocks Save. Auto-clamping would mask the user's intent and is rejected
  per the same reasoning as the H-23 draft-string pattern (no mid-typing
  snap; numeric inputs revert on blur or report error).

### §5.5 Round-length-change interaction

When the user shortens or modifies the round length (`roundStartHole` /
`roundNumHoles` change in NewRoundPage), every game's existing range is
re-validated against the new bounds:

1. **Range entirely within new round bounds, satisfies game minimum:** Range
   is preserved unchanged.
2. **Range partially or fully outside new round bounds:** Range is
   auto-cleared (set to `{ startHole: roundStartHole, endHole:
   roundEndHole }` — the full round). An inline note appears: `Range reset
   to round bounds.`
3. **Range within new round bounds but falls below game minimum:** Range is
   auto-cleared as in case 2 (game inherits the full new round range). Same
   inline note: `Range reset to round bounds — previous range is too short
   for {Game name}.`
4. **New round itself violates a game's minimum** (e.g., user shortens
   round to 4 holes and Sixes is active): The game's range is auto-cleared
   as in case 3, but the validator continues to report the failure
   (`Sixes requires at least 9 holes`). The user must either lengthen the
   round or remove Sixes from the round to proceed. Save is blocked.

**Why auto-clear instead of auto-clamp:** auto-clamp ("snap to the nearest
valid range") risks producing a range the user did not intend (e.g.,
clamping a [4, 12] range to [4, 12] passes through, but a [4, 7] Nines
range under a round shortened to 9 holes would clamp how, exactly?). Auto-
clear has a single defined behavior — fall back to "full round" — and the
inline note makes the change visible.

The user can then re-enter a custom range that satisfies the game's
minimum, or accept the full-round default.

---

## §6. Out-of-Scope Notes / Cross-Reference

### §6.1 D-3 — Multiple departed players resolver layout (re-closed v1.1)

**v1.0 close-out (13-C.5):** Handled inline in §2.1: `departedPlayerNames` is
`string[]` (not `string`), and the header text format ("Dave and Alice left
after hole 13") supports comma-list rendering for `length >= 2`.

**v1.1 close-out (13-C.7) — SUPERSEDES v1.0 close-out:** The multi-name
combined sheet is REMOVED in `PartialGameContract` v2.0. Multiple departed
players are handled by the **sequenced resolver chain** — one sheet per
player processed in `eventOrder` ascending. Each sheet's prop is
`departedPlayerName: string` (singular). The plural array form is retained
as deprecated alias only for backward-compat with 13-C.6 storage shape.
See §2.1 v1.1 amendment, §6.6 sequencer controller, and `PartialGameContract`
§9.3 / §9.4.

### §6.2 D-5 — Scenario A + B combined resolver flow (re-closed v1.1)

**v1.0 close-out (13-C.5):** Handled inline in §2.1: `scenario` is `'A' |
'B'`. The combined case is presented as Scenario B with all active games
shown.

**v1.1 close-out (13-C.7) — SUPERSEDES v1.0 close-out:** The Scenario A
vs Scenario B distinction is collapsed in `PartialGameContract` v2.0. Both
scenarios use the same single-name sheet shape; the only difference is
whether the LAST event in the chain triggers the group-stop write
(`lastCompletedHole` + `earlyEndOpts`). The sequencer (§6.6) handles this
side-effect — the sheet itself is unaware of the scenario distinction.
The `scenario` prop is now optional and ignored (retained for back-compat).
See `PartialGameContract` §5.4.4.

### §6.3 `playerJoinHoles` consumption

Deferred indefinitely per the 13-C.4 deferral. The data-model spec for
`playerJoinHoles` remains in `PartialGameContract.md` §3 / §4.1 / §13 as
future-facing spec. This implementation spec does not reserve a pipeline
slot for `playerJoinHoles` consumption — if 13-C.4 is ever revived, this
spec will be amended at that time.

### §6.4 Game-family option matrix (NEW v1.1)

Mirrors `PartialGameContract` §6.1. The sequencer (§6.6) computes
`topLevelOptions` for each `GameRow` based on the game's family and the
current carry-forward state.

**Match-family games** (Match/Nassau, Sixes, Nines, Stableford-team):

```js
topLevelOptions = [
  { value: 'abandon',  label: 'Abandon' },
  { value: 'end_at_k', label: `End at hole ${departureHole + 1}` },
];
// Default: end_at_k
```

**Pool-family games** (Skins, Stableford-individual, Stroke Play, Dots,
Specials):

```js
topLevelOptions = [
  { value: 'abandon',        label: 'Abandon' },
  { value: 'end_at_k',       label: `End at hole ${departureHole + 1}` },
  { value: 'continue',       label: 'Continue' },
  { value: 'exclude_player', label: `Drop ${departedPlayerName}` },
];
// Default: continue
// exclude_player option only included if (currentSubset.length - 1) >= 2
// (after removing the departing player, at least 2 players must remain)
```

The label `Drop ${departedPlayerName}` is the v1.1 UI rendering of the
`exclude_player` data-model token. v1.0's "Remove [Name]" rendering is
deprecated.

### §6.5 Reorder Departures modal (NEW v1.1)

Specified in `PartialGameContract` §8.5. Visual layout and copy:

```
┌────────────────────────────────────────────┐
│  ⚠ Earlier departure detected              │
│                                            │
│  [B] is leaving at hole [h], which is      │
│  earlier than [A]'s recorded departure     │
│  at hole [A_dep + 1]. This requires        │
│  reconfirming all choices.                 │
│                                            │
│        [ Cancel ]   [ Reorder Departures ] │
└────────────────────────────────────────────┘
```

**Component:** `ReorderDeparturesModal` (new in 13-C.7 build).
Implementation matches the styled in-app modal pattern from
`ScoreGrid.jsx` / `ScorecardPage.jsx` (resume-from-departure modal,
delivered in 13-C.6) — same shell, same `Btn` styling, different copy.
NOT a native `window.confirm`.

**Props:**

```js
ReorderDeparturesModal({
  open,
  newPlayerName,         // [B] — the player whose long-press triggered this
  newHole,               // 1-based hole number for [h]
  conflictingPlayerName, // [A] — the player with the later existing departure
                         // If multiple later departures, the EARLIEST (lowest
                         // departureHole > h - 1) is named. Other later
                         // departures are not enumerated in copy.
  conflictingHole,       // 1-based hole number for [A_dep + 1]
  onCancel,              // tap Cancel or backdrop or ESC
  onConfirm,             // tap Reorder Departures
})
```

When `open === false`, renders nothing. When `open === true`, renders
fixed-position modal centered on screen with semi-transparent backdrop.
Cancel = no state change, modal closes. Reorder Departures = invokes
`onConfirm` which triggers the §6.6 sequencer's reorder execution.

### §6.6 Sequencer controller (NEW v1.1; v1.2 amended)

The **sequencer** is the application-layer controller that orchestrates
the per-event resolver chain. It is NOT a new component.

**Implementation location (v1.2, post-13-C.7 build):** the sequencer
lives in `pages/scorecard/ScorecardPage.jsx` (not `App.jsx` as v1.1
provisionally suggested). `ScorecardPage` already owns the active-round
state, the resolver sheet's open/close lifecycle, and the post-confirm
write to `earlyDepartureOpts`, so siting the sequencer there keeps the
chain logic adjacent to the data it mutates. App-level `handleGoResults`
delegates the chain trigger to `ScorecardPage` via a ref-callback rather
than driving the chain itself.

**Responsibilities:**

1. **Build the unresolved-event sequence** at Results → tap or after a
   proactive long-press X. Per `PartialGameContract` §9.3:
   - Compute classification per §5.2.
   - For each Early-departure player, evaluate skip-when-current per
     §5.4.5.
   - Collect unresolved events into a list sorted by `departureHole`
     ascending.

2. **Drive the sheet through the sequence.** For each event in order:
   - Compute carry-forward state from already-confirmed events
     `0..N-1` per §5.4.2 — **MANDATORY:** sourced from
     `activeRound.earlyDepartureOpts` filtered to entries where
     `eventOrder < currentEvent.eventOrder` and sorted by `eventOrder`
     ascending. **The implementation MUST NOT** source carry-forward
     from any in-memory chain reference (e.g., `confirmedEventsRef`)
     that is cleared between chains. See `PartialGameContract` v2.1
     invariant 24.
   - Build `games[]` filtered per §5.4.3.
   - Compute `topLevelOptions` per §6.4 for each game.
   - Compute `initialResolutions` from per-family defaults (§6.4) or
     existing `earlyDepartureOpts[pi].gameResolutions` if the event is
     stale.
   - Open the sheet with these props.
   - On `onConfirm`: write `earlyDepartureOpts[pi]` (with `eventOrder`)
     incrementally — **before** advancing to the next event, so the
     just-confirmed resolutions are visible to the next event's
     carry-forward derivation via the same saved-state path.
   - On `onCancel`: abort the chain. Already-confirmed events stay
     (their writes were incremental); unconfirmed events do not write.
     User returns to scorecard.

3. **Apply group-stop side-effect** (§5.4.4) after the LAST event
   confirms: if every player is Early departure (Scenario B), additionally
   write `lastCompletedHole = highWaterMark` and `earlyEndOpts =
   lastEventGameResolutions`. Otherwise (Scenario A), do not write these
   fields.

4. **Handle Reorder Departures** (§8.5 / §8.6):
   - Detect when a long-press X creates an out-of-order event.
   - Open `ReorderDeparturesModal` (§6.5).
   - On Confirm: clear later events; build a queue of cleared events; fire
     resolver for the new event first; then for each cleared event in
     `lastScored` ascending, fire resolver fresh (no pre-population).
     `initialResolutions` is computed from per-family defaults at each
     re-fire — prior selections from cleared events are NOT preserved.

**Implementation notes (v1.2, post-build):**

- The sequencer is implemented as a `useRef`-driven imperative controller
  in `ScorecardPage.jsx`: `pendingEventsRef` (events to fire),
  `confirmedEventsRef` (this chain's confirmations — used ONLY for the
  group-stop write decision, NOT for carry-forward derivation),
  `chainContextRef` (chain metadata). The `fireNextEvent()` /
  `buildEventState()` / `onConfirmResolution()` / `finishChain()` handlers
  drive the state machine.
- `buildEventState()` MUST source carry-forward from `activeRound.earlyDepartureOpts`
  per the bullet above. The implementation does so by reading
  `activeRound.earlyDepartureOpts`, filtering entries with
  `eventOrder < event.eventOrder`, sorting by `eventOrder`, and passing
  the resulting array to `evalCarryForward`. This pattern survives the
  `confirmedEventsRef = []` reset at the end of every chain.
- Reactive entry's `reactiveResolverTriggerRef` pattern from 13-C.7
  remains the entry point for App→ScorecardPage communication. App
  calls `triggerReactiveResolver()` on the ref; the ref handler runs
  classification, builds the sequence, and starts firing events. App
  does not see individual events.

---

## §7. Build Session Pointers

| Session | Implements | Status |
|---|---|---|
| **13-C.6** (Proactive Entry — long-press X → resolver) | §2 (all three components, file paths in §2.6); long-press X handler in `ScoreGrid.jsx` opens the sheet with `scenario='A'` and a single departed player; on Confirm writes `earlyDepartureOpts` and locks the player's post-departure cells per `PartialGameContract.md` §8. | ✅ delivered AND device-test confirmed |
| **13-C.7** (Reactive Entry + v2.0 amendment + v2.0 build) | §2 (sheet reuse); Results → tap handler in `ScorecardPage.jsx` runs §5.2 classification logic. Mid-session v2.0 contract amendment added the sequenced-event model, per-game-family option matrix, Reorder Departures, skip-when-current. v2.0 build delivered: §6.6 sequencer in `ScorecardPage.jsx` (NOT `App.jsx`), `ReorderDeparturesModal` (§6.5), per-family option matrix (§6.4), `DepartureResolverSheet` v1.1 prop migration (§2.1), engine departure data guardrail dual-implementation (`payouts.js` + `scorecardUtils.js`), Skins-specific display-side `continue` partition lifted forward from 13-C.8. v2.1 documentation amendment delivered post-device-test capturing build lessons (carry-forward source-of-truth, round-trip preservation of group-stop metadata, share image scorecard `–` rule). | ✅ delivered AND device-test confirmed |
| **13-C.8** (Engine departure handling for non-Skins pool-family games) | §3 (clinch detection algorithm), §4 (full pre-processing API); modifies `payouts.js` only — no engine changes. Includes engine-side `continue` segment partition for Stroke Play, Stableford-individual, Dots; `exclude_player` retroactive removal for non-Skins pool-family; `end_at_k` per-segment Pay/Abandon engine wiring; non-Skins display-side `continue` partition; `RoundSummaryModal` resolution-display ribbon. | ⏳ deferred |

For 13-C.6 and 13-C.7, the helper functions that build the `GameRow[]`
array passed to the sheet are an implementation detail of the build
session — likely a new `buildResolverGameRows(activeRound, ctx)` function
in `pages/scorecard/resolverUtils.js` (delivered in 13-C.6) or a similar
utility. For 13-C.7, that helper is extended to consume carry-forward
state per `PartialGameContract` §5.4.2 and produce per-event filtered
game lists per §5.4.3. This spec does not constrain that helper's
signature; it constrains only the component prop interfaces (§2),
engine-side pre-processing API (§4), and the sequencer's responsibilities
(§6.6).

---

## §8. Final Rule

If implementation behavior conflicts with this spec, call out the
conflict. The spec is amended (with owner approval) or the implementation
is corrected. This document is the authoritative implementation-level
detail for sessions 13-C.6, 13-C.7, and 13-C.8 within the bounds set by
`PartialGameContract.md`.
