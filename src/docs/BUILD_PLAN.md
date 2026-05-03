# The Card — Master Build Plan

_Last updated: April 2026 — 13-G.2 complete and confirmed on device. Sprint 14 planning resolved (provider = Gemini 2.0 Flash, key storage = B for build phase, Option C deferred). Next session: **14-A — Gemini photo parse engine swap + localStorage key flow**._
_Maintained in this chat as the authoritative sequence and history of all build sessions._
_The APP_STATE_SUMMARY.md in the project knowledge base is the authoritative record of_
_what is implemented. This file is the authoritative record of what was planned, why,_
_and in what order — including items that shifted, were skipped, reinstated, or renumbered._

---

## Critical Rules for All Future Sessions

1. **Contracts before code.** Any item marked "contract first" below must have a contract
   amendment approved before a single line of implementation code is written.

2. **Session naming is owner-assigned.** Claude must never auto-assign new session
   designations (e.g. creating "11-B" when it doesn't exist in this plan). Sub-tasks within
   a session are labeled as phases (Phase 1, Phase 2). New session rows in APP_STATE_SUMMARY.md
   are only added when the owner explicitly provides the designation.

3. **APP_STATE_SUMMARY.md is not a bug tracker.** Open items live there briefly while
   they wait for closure; once closed, they are removed (not struck through). The
   external spreadsheet is the master bug/feature tracker.

4. **Do not remove an item from ASS Open Items prematurely.** Removal requires
   owner-confirmed on-device closure of the underlying work.

5. **Derived values are never stored.** All derived state is computed from the activeRound blob.

6. **`restoreDotDefs()` is critical.** Must always be called before using dots from any
   serialized state. Was `restoreAutoWhen()` prior to Session 11-A rename.

7. **`betType` is a static config concept only.** It lives in the `GAME_CONFIGS` constant
   and must never be stored in `gameOpts`, `activeRound`, or any persisted state.
   Decision made in 11-G. Do not revisit without owner approval.

8. **Nassau terminology is retired from all user-facing surfaces.** The behavior is exposed
   as Front/Back/Overall segment bet fields. Decision made in 11-G. Do not reintroduce
   "Nassau" as a UI term without explicit owner approval.

---

## Key Architectural Decisions

These decisions should not be revisited without good reason:

1. **Contracts are authoritative over code.** When contract language and implementation
   conflict, contracts win. Code is updated to match.

2. **Write contracts before fixing engines.** The contract defines the spec the engine
   fix must conform to.

3. **Derived values are never stored.** All derived state computed from activeRound blob.

4. **Session naming is owner-assigned.** Claude never invents new session designations.

5. **Generic swipe component** extracted when adding swipe to Players/Courses (15-H),
   not before — avoid premature abstraction.

6. **Dots/Specials shim removal** only after owner confirms all saved rounds have been
   opened and re-exported. Do not rush this.

7. **Per-player tee selection (completed in 11-I.1).** If extended further, treat as
   high-risk and own a full session.

8. **Custom keypad replaces system keyboard (13-B).** `ScoreKeypad.jsx` is the sole
   score entry component throughout the app. The hidden-input / `.focus()` pattern used
   in ZoomModal is retired after 13-B. `'X'` is a valid score value (player picked up);
   it stores as `'X'`, displays as `"NX"` (N = ESC gross), and always loses to any real
   score. Confirmed decision: no system keyboard for score entry post-13-B.

9. **`'X'` score semantics (13-B).** X = player picked up. Gross value = `par + 2 +
   strokes` (full Net, never NOL). Already ESC-capped by definition. "X always loses to
   a real score; X ties X" is the universal invariant across all 7 games.

10. **Early departure via Results gateway (13-C).** There is no "End Round Early" button
    on the scorecard. Departure is declared either via long-press X on the keypad
    (proactive) or via the Results → transition gate (reactive). Contiguous trailing empty
    cells = early departure. Scattered gaps = missing scores (blocked, must enter).

11. **Departure resolver sequenced-event model (13-C.7).** One sheet per player; combined
    multi-player sheets are retired. The v1.x model is removed. See PartialGameContract v2.0.

12. **Match/Nassau breakdown per-instance (13-C.8 Option A).** Each match instance emits
    its own columnar breakdown row; the combined `'🥊 Match / Nassau'` flat entry is retired.

13. **GPT-4o for scorecard photo OCR (13-D).** Claude vision unreliable on dense printed
    cards. `aiParseScorecard()` will call OpenAI GPT-4o. `aiSearchCourses()` stays on Anthropic.

14. **Codebase extraction before feature work (13-D).** 13-E refactor pass immediately
    after 13-C.bugs, before Sprint 14+.

15. **Dispatcher + Shared file pattern for multi-game UI splits (13-E).** When a single
    file contains both shared sub-components and per-game UI bodies, split into: one
    `<Name>.jsx` thin dispatcher, one `<Name>Shared.jsx` for shared sub-components, and
    one `<Name><Game>.jsx` per game body. Panels import from Shared, never from the
    dispatcher. Established for `GameConfig.jsx` in 13-E. See Decision #26 in full.

16. **`PayoutDisplay.jsx` is the single source of truth for payout display (13-E.5).**
    `DotsColTable`, `SubHeader`, `PayRow`, `splitGameHeader`, `fmtMoney`, and
    `PayoutsSection` live exclusively in `pages/PayoutDisplay.jsx`. Neither
    `ResultsPage.jsx` nor `RoundSummaryModal.jsx` may define local equivalents.
    Pre-extraction code is preserved as commented blocks in both consumers for revert
    during the planned ResultsPage visual rework (15-C).

---

## Key Architectural Decisions (continued — full log)

17–26 are documented in the Decision Log (Confirmed Decisions table) below for
traceability. Decisions 1–16 above are the cross-cutting durable ones referenced most
often during sessions.

---

## Numbering History & Collision Notes

- **Sessions 1–9** were numbered sequentially as work progressed.
- **Sessions 11-B and 11-C** were auto-created by Claude mid-session during the Dots
  rework, colliding with planned future sessions. Corrected: all three phases collapsed
  into **11-A** in the ASS.
- **11-B** in this plan = Shared GameTable shell (deferred).
- **11-C** in this plan = Match/Nassau team hole display (completed).
- **11-D** in this plan = Fixed-width player name fields + PlayerDropdown (completed,
  scope exceeded plan).
- **11-E** in this plan = Disabled Btn fix + NOL label audit (completed).
- **11-G** was a planning-only session (no code). Downstream sessions renamed
  11-H, 11-I, 11-J, 11-K for cleanliness.
- **11-I split into 11-I.1, 11-I.2, 11-I.3** during execution. 11-I.1 (Players card +
  contracts) shipped on device first; 11-I.2 (game config UI rebuild) followed; 11-I.3
  (semantic field rename: `scoring` → `grossNetNOL`, AND `tiebreak` → `scoring`) was
  added later as a separate atomic rename.
- **11-M.1** is post-11-M follow-on bug fixes (SixesTable `opts`, ReadOnlyScorecard
  handicap dots, etc.) — split from 11-M proper because the bugs surfaced during
  on-device testing of 11-M's main work. Kept as a sub-session for traceability.
- **Sprint 13 restructured (April 2026).** Original 13-A (iCloud export) and 13-C
  (partial round stub) replaced with a focused sprint: 13-A = planning, 13-B = custom
  keypad, 13-C = early departure, 13-D = post-work planning + backlog restructure.
  iCloud export moved to Sprint 15. Sprint 13 is entirely dedicated to score entry,
  partial round lifecycle, and planning.
- **13-B split into 13-B, 13-B.1, 13-B.2.** 13-B = main keypad + X score work;
  13-B.1 = ZoomModal stabilization + pre-13 bug fixes (Bugs A/B/C) caught during
  device testing; 13-B.2 = contract-only correction to ScoreKeypad_Contract.md
  §3.4–§3.8 to match the 13-B.1 final implementation.
- **13-C split into 13-C (planning + contract), 13-C.2, 13-C.3 (with sub-phases 1, 2A,
  2B), then 13-C.4 onward.** The original sequence anticipated 13-C.2 through 13-C.7 as
  builds; the Phase 1 / Phase 2A / Phase 2B sub-numbering inside 13-C.3 emerged because
  the predetermined-game-ranges feature needed contract amendments (Phase 1) → engine +
  plumbing (Phase 2A) → game-table visual range trimming (Phase 2B) and the work spanned
  multiple chats. There is no 13-C.1 — that designation was unused. The 13-C planning
  session also superseded `Early_Departure_Contract.md` (v1.0 DRAFT) and
  `Late_Arrival_Contract.md` (v1.0 DRAFT) in their entirety; both are unified under
  `PartialGameContract.md`.
- **13-C.7 is a single session despite spanning multiple phases.** Mid-session, the v1.x
  multi-name combined-sheet model surfaced as ambiguous on device test. Owner approved a
  major contract amendment (PartialGameContract v1.10 → v2.0) introducing the sequenced-
  event model, per-game-family options, Reorder Departures, and skip-when-current. The
  entire arc — planning, v2.0 amendment, v2.0 build, device-test bug-fix passes, v2.1
  amendment, and code comment cleanup — is logged as a single 13-C.7 row.
- **13-C.bugs** is a named consolidated bug-fix session rather than a numbered sub-session.
  It accumulates bugs discovered after 13-C.8 delivery and is the catch-all for small
  fixes that don't warrant their own session.
- **13-D** is a planning session (no deployable code except the `useDepartureResolver`
  extraction bonus). Full backlog review, priority ranking, and sprint restructure. The
  extraction files (`useDepartureResolver.js`, updated `ScorecardPage.jsx`) are delivered
  but require device confirmation before the session is fully closed.
- **13-E split into 13-E (GameConfig) + 13-E.2 through 13-E.8 (remaining extractions).**
  Original 13-E was scoped narrowly to `GameConfig.jsx`. During the session, an audit
  surfaced six additional extraction candidates of similar scope. Rather than expanding
  13-E's surface, the candidates were sequenced as 13-E.2 through 13-E.8 sub-sessions
  to preserve token discipline (each in its own chat) and to keep test surfaces
  separable. The original 13-E delivers the `GameConfig.jsx` 7-file split and the
  associated game contract amendments; 13-E.2+ are pure code-move sessions with no
  contract amendments expected. Sub-numbering matches the existing pattern from 13-C.
- **Sprint 14 repurposed as Photo Import sprint.** Previous Sprint 14 polish sessions
  (cleanup, birdie/bogey, splash, iCloud) moved to Sprint 15. Sprint 14 is now dedicated
  entirely to scorecard photo import infrastructure.
- **14-E** (Import conflict UX overhaul) was completed out of order during Sprint 13 —
  retained at its original designation for historical accuracy.
- **Sprint 15** is the new home for display polish, UI features, and cleanup work
  previously labeled Sprint 12 / Sprint 14.
- **Sprint 16** is the new game formats sprint (Wolf, High/Low, etc.).
- **13-G split into 13-G + 13-G.2.** 13-G delivered gender-aware course handicap, dot allocation, plus-CH indicator, and W.Hcp display row. Engine-layer SI consumption (game scoring, match outcomes) was intentionally scoped out and queued as 13-G.2 — surfaced during 13-G device testing as a hole-17 match tie that should have been a Chris win. Sub-numbering matches the existing pattern from 13-C and 13-E.

---

## Completed Sessions

| Session | Summary | Items Closed | Status |
|---|---|---|---|
| 1 | Initial scaffold — React/Vite setup, localStorage, basic score grid | — | Confirmed on device |
| 2 | Handicap engine — `scoreForMode`, stroke allocation, ESC | — | Confirmed on device |
| 3 | Skins engine + SkinsTable live display | — | Confirmed on device |
| 4 | Match/Nassau engine + MatchNassauTable | — | Confirmed on device |
| 5 | Stableford + Nines engines + tables | — | Confirmed on device |
| 6 | Sixes engine + SixesTable | — | Confirmed on device |
| 7 | Dots/Specials engine, DotsTable, DotsPopup | — | Confirmed on device |
| 8 | Stroke Play engine + StrokePlayTable | — | Confirmed on device |
| 9 | Payout aggregation, ResultsPage, share sheet | — | Confirmed on device |
| 11-A | Dots rework (auto-mark, mutual exclusivity, team mode), player name display convention | A-1, A-2, A-3 | Confirmed on device |
| 11-C | Match/Nassau team hole display | B-1 | Confirmed on device |
| 11-D | Fixed-width player name fields + PlayerDropdown shared component | A-4, B-2 | Confirmed on device |
| 11-E | Disabled Btn fix + NOL label audit | C-1, C-2 | Confirmed on device |
| 11-F | HistoryPage swipe-delete + RoundSummaryModal | E-1, E-2 | Confirmed on device |
| 11-G | Planning session — `betType` static decision, Wolf deferral, Nassau terminology retirement | — | Planning + contract only — no device test needed |
| 11-H | NewRoundPage full redesign (3-card layout) | D-1 | Confirmed on device |
| 11-I.1 | Players card redesign + per-player tee selection + Handicap Contract | D-3, D-4 | Confirmed on device |
| 11-I.2 | Game config UI rebuild — all 7 game tiles redesigned | D-2 | Confirmed on device |
| 11-I.3 | Semantic field rename: `scoring` → `grossNetNOL`, `tiebreak` → `scoring` | — | Confirmed on device |
| 11-J | Course library + ManualCourseModal + CourseSearchModal (AI-powered) | — | Confirmed on device |
| 11-K | HistoryPage + history record schema + ResultsPage refinement | — | Confirmed on device |
| 11-L | Stroke Play engine + StrokePlayTable redesign | — | Confirmed on device |
| 11-M | Sixes engine rewrite + SixesTable redesign | — | Confirmed on device |
| 11-M.1 | Post-11-M bug fixes: SixesTable `opts`, ReadOnlyScorecard handicap dots | — | Confirmed on device |
| 13-A | Planning session — sprint restructure, contract audit, session sequencing | — | Planning + contract only — no device test needed |
| 13-B | Custom keypad (`ScoreKeypad.jsx`) + X score type + ZoomModal | — | Confirmed on device |
| 13-B.1 | ZoomModal stabilization + pre-13 bug fixes (Bugs A/B/C) | — | Confirmed on device |
| 13-B.2 | ScoreKeypad_Contract.md §3.4–§3.8 correction to match 13-B.1 implementation | — | Contract only — no device test needed |
| 13-C | Planning + contract session — PartialGameContract v1.0, departure model design | — | Planning + contract only — no device test needed |
| 13-C.2 | Round length fields (`roundStartHole` + `roundNumHoles`), NewRoundPage length UI, Results save-gate fix | — | Confirmed on device |
| 13-C.3 | Predetermined game ranges: Phase 1 contract amendments (PartialGameContract, Nassau_Match, Sixes, Skins, Stableford, Nines, Stroke Play) + Phase 2A engine + plumbing + Phase 2B game-table visual range trimming | — | Confirmed on device |
| 13-C.4 | Deferred — mid-round game start (late arrival) confirmed too rare to justify cost | — | Deferred |
| 13-C.5 | Departure resolver UI Phase 1: `DepartureResolverSheet`, per-game option matrix, clinch detection | — | Confirmed on device |
| 13-C.6 | Departure resolver UI Phase 2: undo gesture, format detection, departure semantics | — | Confirmed on device |
| 13-C.7 | Departure resolver Phase 3 + PartialGameContract v2.0 (sequenced-event model, Reorder Departures, skip-when-current) + v2.1 amendment + code cleanup | — | Confirmed on device |
| 13-C.8 | Match/Nassau per-instance breakdown (Option A) + Sixes columnar shape + departure decoration strings | — | Confirmed on device |
| 13-C.bugs | Post-13-C.8 bug-fix consolidation session | — | Confirmed on device |
| 13-D | Planning session — backlog restructure, sprint reprioritization + `useDepartureResolver.js` extraction bonus | — | Confirmed on device |
| 14-E | Import conflict UX overhaul (completed out of order during Sprint 13) | — | Confirmed on device |
| 13-E | `GameConfig.jsx` (1,292 lines) split into 7-file dispatcher + Shared pattern: `GameConfig.jsx` (~298 lines, dispatcher + re-exports), `GameConfigShared.jsx` (~359 lines: `BetSection`, `PlayerSubsetDropdown`, `GameRangePill`, `GameRangePopup`, `validateGameRange`, `PRESS_OPTS`), and six per-game panel files (`GameConfigStrokePlay`, `GameConfigSkins`, `GameConfigStableford`, `GameConfigNines`, `GameConfigSixes`, `GameConfigDots`). Circular import resolved via `GameConfigShared` — panels import from Shared, dispatcher imports panels and re-exports from Shared. `NewRoundPage` and `MatchCard` need zero import changes. Architectural pattern (dispatcher + Shared) added as Decision #26. Game contract setup-UI sections amended (Dots v2.5, Nines v1.6, Stableford v1.7, Sixes v1.11). NewRoundPage_Design_Spec Wolf extension point updated to reference the new panel-file convention. Skins display regression surfaced during testing — folded into 13-E.4 scope (likely pre-existing). | — | Confirmed on device |
| 13-E.2 | `App.jsx` slim-down (530 → 321 lines). Four extractions per Architectural Decision #23: `components/NavIcons.jsx` (five SVG icons + `SIDE_TABS` + `CENTER_FLOW_TABS`), `components/BottomNav.jsx` (bottom-nav `<nav>` block as a component receiving `tab`/`setTab`/`inProgress`/`centerActive`/`onCenterTap`/`navBarHeight`), `services/exportUtils.js` (`makeExportFilename` + `triggerExport`), `hooks/useIsLandscape.js` (deduped from App.jsx + `RoundSummaryModal.jsx`). H-4 preserved (ScorecardPage continues computing its own); H-11 preserved (App.jsx `handleCenterTap` still owns the `startTriggerRef` call; BottomNav delegates to the `onCenterTap` prop). RoundSummaryModal: surgical str_replace swapping local `useIsLandscape` for the shared import. `G` token import dropped from App.jsx (no longer used after `<nav>` extraction). New top-level `src/hooks/` directory established for cross-cutting hooks. | — | Confirmed on device |
| 13-E.3 | `HistoryPage.jsx` slim-down (736 → 482 lines). Two extractions per Architectural Decision #23: `pages/history/SwipeableRoundRow.jsx` (~243 lines — swipe row component, strip color constants `STRIP_SHARE`/`STRIP_EDIT`/`STRIP_DELETE`, and `REVEAL_W` constant) and `pages/history/HistoryIcons.jsx` (~70 lines — five named SVG icon exports). New `src/pages/history/` subdirectory established. H-1 swipe behavior (zero-setState-during-gesture, direct DOM transform updates) preserved verbatim per Architectural Decision #5 — generic swipe component deferred to 15-H when Players/Courses adopt swipe and there are two real call sites. In-flight discovery: the original `IconDownload` and `IconUpload` glyphs were reversed (download arrow on the Export button, upload arrow on the Import button) — replaced with circle-up / circle-down glyphs that read cleanly at the 14px button size. Component names retained so `HistoryPage.jsx` imports were not affected. Pre-existing dead import flagged for 15-F: `Btn` is imported from `ui.jsx` in `HistoryPage.jsx` but never referenced in the body (predates this session; left as-is per verbatim-move discipline). | — | Confirmed on device |
| 13-E.4 | `ScoreGrid.jsx` depart-prompt extraction + Skins empty-state regression fix + resolver header copy edge case. (1) Extracted inline depart-prompt JSX (~63 lines) from `ScoreGrid.jsx` into new `pages/scorecard/DepartPromptModal.jsx` — pure render given 4 props (`playerName`, `holeNumber`, `onCancel`, `onConfirm`); state (`departPrompt`) and both handlers remain in `ScoreGrid`. (2) Fixed Skins-only display regression: removed `if (!rows.length) return null` gate from `SkinsTable.jsx` so the `GameSection` header skeleton renders from round start, matching Stableford / Nines / Sixes empty-state pattern. H-28 guardrail (`applyDepartureGuardrailToScores`) unaffected. (3) Out-of-scope fix at owner direction: `DepartureResolverSheet` header copy produced "Chris left after hole 0" on long-press X on hole 1. Added optional `roundStartHole` prop (default `0`) to `DepartureResolverSheet`; threaded from `ScorecardPage`; when `departureHole < roundStartHole` header reads "left before hole [roundStartHole + 1]" — covers first hole of any range (full or partial round). `PartialGameContract.md` → v2.2, `Resolver_UI_Spec.md` → v1.4. | — | Confirmed on device |
| 13-E.6 | `roundUtils.js` → `shareUtils.js` extraction. Moved `buildShareHtml`, `buildShareImageForeignObject`, `buildSharePdf`, `buildShareImage`, `triggerRoundShare`, `downloadBlob`, `fmtMoney`, `fmtDate`, `xe`, `deriveShareDotMode`, the logo loader, and all share-only constants to new `services/shareUtils.js` (~933 lines). `cleanGameName` kept in `roundUtils.js` (general utility, imported by `PayoutDisplay.jsx` — not share-specific); `shareUtils.js` imports it from `roundUtils.js` (no circular dependency). Slimmed `roundUtils.js`: 1394 → 448 lines, retaining `buildPayoutArgs`, `computePerMatchPayouts`, `cleanGameName` only. Consumer import-path updates (str_replace only): `HistoryPage.jsx`, `ResultsPage.jsx`, `RoundSummaryModal.jsx`. `App.jsx` and `PayoutDisplay.jsx` unchanged. Inline `applyDepartureGuardrail` copy in `buildShareHtml` moved intact per PartialGameContract §11.9 / H-28. | — | Confirmed on device |
| 13-E.7 | `NewRoundPage.jsx` 3-card extraction. `NewRoundPage.jsx`: 1414 → 765 lines. Four new files: `pages/new-round/NewRoundHelpers.jsx` (~177 lines — `NineDropdown`, `TeeDropdown`, `HIField`, `CHField` extracted to shared file; Option B chosen over duplication to avoid divergence risk); `pages/new-round/CourseCard.jsx` (~222 lines); `pages/new-round/PlayersCard.jsx` (~141 lines); `pages/new-round/GamesCard.jsx` (~293 lines). All state, `useEffect`, `useCallback`, `useMemo`, all handlers (`handleStart`, `handleSaveEdits`, `handleResumeReload`, `handleCourseSelect`, `toggleGame`, `setOpt`, `setGameRange`, `computePlayerCH`), `roundLengthError`, `allOpts`, `activePlayers`, `layout`/`pars`/`hcps` derivations, and the page shell remain in `NewRoundPage.jsx`. `defaultMatch`/`makeMatchId` intentionally duplicated in `GamesCard.jsx` (local copy for the "+ Add another Match" button; authoritative copy stays in `NewRoundPage`). H-31 gotcha added. No contract amendments. | — | Confirmed on device |
| 13-E.5 | Shared `PayoutDisplay.jsx` extraction. Phase 1 mandatory diff revealed 6 divergences between `RoundSummaryModal.PayoutsSummary` and `ResultsPage.ResultsDisplay` (totals visual, match colHeaders branch, tie detection, tie text, empty-state guard, subHeader form). Owner resolved all 6: RSM visual style canonical; columnar branch added to both; all games always shown; `'Tie — no payout'` unified string; `SubHeader` component form; empty-state guard retained. Extracted `pages/PayoutDisplay.jsx` (~165 lines live code) containing `DotsColTable`, `SubHeader`, `PayRow`, `splitGameHeader`, `fmtMoney`, `PayoutsSection`. Both consumers updated: `ResultsPage.jsx` (451 → 431 lines) and `RoundSummaryModal.jsx` (839 → 814 lines). Pre-extraction code preserved as commented blocks in both consumers for revert during planned 15-C ResultsPage rework. Out-of-scope fix: payout section headings upgraded from plain-text to all-caps (`TOTAL — ALL GAMES`, `BY GAME`) with `letterSpacing: 0.5px` matching the `SectionLabel` pattern used elsewhere. No contract amendments — display-layer only. | — | Confirmed on device |
| 13-E.8 | `RoundSummaryModal.jsx` → `ReadOnlyScorecard.jsx` extraction. Extracted `ReadOnlyScorecard` component (~240 lines, original RSM lines 87–332) into new `components/ReadOnlyScorecard.jsx`. `RoundSummaryModal.jsx` slimmed 685 → ~449 lines (net of 13-E.2 hook dedup, 13-E.5 PayoutDisplay dedup, and this session). Both `–` rendering paths preserved byte-equivalent: out-of-round (`!inRound(h)`, PartialGameContract §12.1) and past-departure (`isPastDeparture`, §5.5). Handicap dot rendering (NOL/net modes), X-score display, womenSI computation, front/back named-nine labels, landscape/portrait split — all preserved verbatim. `isLandscape` received as prop (H-4). No contract amendments. Closes the 13-E.x sub-session series. | — | Confirmed on device |
| 13-F (contract) | Universal keypad expansion + plus-CH indicator — contract-only planning session. Four contracts amended: `ScoreKeypad_Contract.md` v2.2→v2.3 (§6 rewritten — five modes: score/currency/handicap-decimal/handicap-int/integer; §10 new page-level ownership pattern; §2.1 new props `mode`/`kpPlus`/`onPlusToggle`/`onCommit`; §8 invariants 13–20 added); `Handicap_Contract.md` v1.6→v1.7 (§5.16 new — plus-CH cell indicator spec covering trigger condition, four display surfaces, edge cases); `UI_Component_Contract.md` v1.3→v1.4 (§4.7 BetInput keypad activation + `$5`/`$5.50` display format; §4.10 new BetSection carry-forward rule); `Nassau_Match_Contract.md` v2.9→v3.0 (§16.4 new — MatchCard Total↔Nassau carry-forward). `13F_Change_Manifest.md` produced — 15 implementation items (A-1 through C-4) with file targets, contract references, and device testing checklist. Session intro for implementation chat produced. | — | Contract only — no device test needed |
| 13-F | Universal keypad implementation: replaced iOS system keyboard for all setup inputs (HI, CH, bet fields, course data, hole ranges); `ScoreKeypad` wired to `NewRoundPage`, `PlayersPage`, `ManualCourseModal`, all game panel files; plus-CH indicator (`+` in score cells for plus handicappers) on all four display surfaces. Scope significantly exceeded original plan — extensive device debugging required to resolve iOS-specific click-target races, phantom touches, popup lift animation races, and stale closure bugs. Key architectural findings: (1) `readOnly`+`onFocus`+`e.target.blur()` more reliable than `<div>` tap targets for iOS keyboard suppression; (2) empty kpValue seed gives select-to-overwrite without fragile `isSeeded` flag; (3) 250ms `pointerEvents:none` lockout on keypad mount absorbs phantom click; (4) popup backdrop must disable onClick while keypad active; (5) no CSS transitions on popup lift; (6) `getAttribute('inputmode')` not `.inputMode` property for cross-browser dismiss-handler exemption; (7) plus-CH condition is `hcps[h] > 18 - Math.abs(ch)` (USGA: strokes back on EASIEST holes) not `hcps[h] <= Math.abs(ch)`; (8) plus-CH check must precede `dotMode === 'gross'` bail. Contracts updated to v2.4/v1.8/v1.5. | A-1, B-1–B-38, C-1–C-6 | Confirmed on device |
| 13-G | Female handicap bug fix — gender-aware course handicap and stroke-allocation display. Contract-first session: `Handicap_Contract.md` v1.8 → v1.9 (§2.1 gender-aware par; §2.5 `groupCourseHandicaps` gender-aware tee + new optional `nines` arg; §2.7 NEW `buildGenderLayout`; §5.16.1 plus-CH uses per-player SI rank; §8 G-4 missing-women's-SI warning; invariants 18–20). Implementation: `engine/handicap.js` adds `buildGenderLayout` (women's par + SI arrays with proper interleaving) and gender-aware `groupCourseHandicaps`; `NewRoundPage.jsx` uses `buildGenderLayout`, gender-aware `computePlayerCH`, missing-women's-SI warning banner; `roundLib.js` round-trips `hcps_women`/`pars_women` and recomputes gender-aware courseHcps on legacy reload; `ScorecardPage.jsx` threads `hcpsWomen` prop; `ScoreGrid.jsx` gender-aware dot/plus rank, W.Hcp display row in both portrait and landscape, iOS click-suppression guard fix for double-cell-advance bug; `ZoomModal.jsx` gender-aware dot/plus rank; `ReadOnlyScorecard.jsx` proper interleaved womenSI, gender-aware hcpDots; `shareUtils.js` gender-aware `hcpStrokesHtml`. Engine-layer SI consumption (game scoring, match outcomes, etc.) intentionally scoped out and queued as 13-G.2. Owner discovered post-fix that match engine still uses men's SI — confirmed scoped correctly to 13-G.2. | — | Confirmed on device |
| 13-G.2 | Engine gender-aware stroke index. Contract-first: `Handicap_Contract.md` v1.9 → v2.0 (§2.5 caller responsibility for `siArray`; §2.8 NEW `buildPlayerSI(player, layout)`; §5.0 NEW engine stroke-index source rule — engines read `players[pi].siArray[h]`, never round-shared `hcps[h]`; invariant 21). `App_Data_Model_Contract.md` Player schema gains `siArray: number[18]`. Implementation: `engine/handicap.js` adds `buildPlayerSI` export, `xGrossScore`/`escTotal` accept per-player `siArray`. `engine/games.js` full rewrite — `hcps` parameter dropped from all 9 engine functions (`runMatch`, `runTeamMatch`, `runMatchNassau`, `runNassau`, `calcSkinsHole`/`calcSkins`, `calcNines`, `calcSixesSegment`/`runSixesSegment`, `calcStablefordTotal`/`calcTeamStablefordTotal`, `calcStrokePlay`); engines read `players[pi].siArray[h]` internally. `engine/payouts.js` 9 engine call sites updated. `pages/NewRoundPage.jsx` `handleStart` attaches `siArray = buildPlayerSI(p, layout)` to each player. `services/roundLib.js` `toActiveRound` rebuilds `siArray` defensively on reload (legacy records). `pages/scorecard/ScoreGrid.jsx`, `ZoomModal.jsx`, `TotalsCard.jsx`, `components/ReadOnlyScorecard.jsx`, `services/shareUtils.js`, `pages/scorecard/scorecardUtils.js` (no engine-layer changes — confirmed audit-clean), and the 6 game-table components (`MatchNassauTable`, `NinesTable`, `SixesTable`, `SkinsTable`, `StablefordTable`, `StrokePlayTable`) updated. Initial Phase 2 audit was incomplete — text-pattern grep on `scoreForMode`/`xGrossScore` missed 5 higher-level engine call sites (`SkinsTable.calcSkinsHole`, `roundUtils.runMatchNassau`, `resolverUtils.runMatchNassau`, `resolverUtils.runSixesSegment`, `MatchNassauTable.runMatchNassau`, `SixesTable.runSixesSegment` ×2). Symptom: empty Skins grid on scorecard page; blank-screen crash on history reload and round-summary modal. Fix pass updated all 5 stragglers; H-37 added to capture the audit lesson. Regression test added (`regression_test.mjs` — 6 tests including hole-17 mixed-group scenario; all passing). Confirmed on device. | — | Confirmed on device |

---

## Open Session Plan

> **Next session: 14-A — Gemini photo parse engine swap + localStorage key flow.** Sprint 13 fully complete and confirmed on device (sessions 13-A through 13-G.2). Sprint 14 = photo import (active). Sprint 15 = display polish + features. Sprint 16 = new game formats.

---

### Sprint 14 — Scorecard Photo Import

_Sprint 14 is dedicated entirely to course photo import infrastructure._

**14-A: Parse Engine Swap — Gemini 2.0 Flash + localStorage key flow** *(contract-first lite: spec the review screen before coding)*
- Rewrite `aiParseScorecard()` in `courseLib.js` to call Google Gemini 2.0 Flash vision API
  instead of Anthropic. Sprint 14 planning evaluation (Gemini vs GPT-4o, owner-run): both
  100% accurate on app-consumed fields (pars, stroke indices, tee names, ratings, slopes,
  nine-totals) on Sahalee + Fircrest cards. Both erred only on per-hole yardage allocation
  for combo tees — a card-design issue (triangle/dot notations vary by course) and not
  data the app currently consumes (`aiParseScorecard` prompt already excludes per-hole
  yardages). Gemini chosen on cost (~25× cheaper than GPT-4o per parse) and latency at
  tied accuracy.
- `aiSearchCourses()` remains on Anthropic — text-only, no vision, Claude adequate. Stays
  on its current code path within `aiCall()`. (If feasible to share `aiCall()` across
  providers without leaking provider details into call sites, do so; otherwise split.)
- Wire Gemini API key via Option B: one-time prompt at first parse, stored in localStorage
  under a new storage key (e.g. `golf_gemini_key_v4`). On parse: if key absent, show modal
  prompt; if present, read and use; if API rejects (401/403), invalidate stored key and
  re-prompt. New `Settings`-style entry-point not required for v1 — first-parse flow is
  sufficient.
- Single session: bundle the Gemini swap + key flow + error states + first-device test
  into 14-A. Splitting adds session overhead without reducing risk.
- Files: `courseLib.js`, `PhotoImportModal.jsx` (key prompt UI), `storage.js` (new
  storage key constant `SK.geminiKey`).
- Priority: High
- Requires: nothing — all decisions resolved in Sprint 14 planning.
- Defers: Option C (Netlify Function proxy) — see Deferred / Deprioritized below.

**14-B: Review / Correction Grid** *(after 14-A)*
- Build `CourseImportReviewModal.jsx` — editable per-hole grid (par, handicap, yardage
  per hole) displayed between parse result and save. Uncertain values flagged in amber.
  "Enter manually instead" escape hatch opens `ManualCourseModal` pre-populated with
  parsed values.
- Prompt engineering: add per-field confidence flags to the parse prompt so uncertain
  values are surfaced rather than silently guessed. (Provider-agnostic — same approach
  works with Gemini.)
- Files: new `CourseImportReviewModal.jsx`, `courseLib.js` (prompt amendment),
  `PhotoImportModal.jsx` (wire review step)
- Priority: High

**14-C: Photo Guidance + UI Polish** *(fold into 14-B if session capacity allows)*
- Add photo guidance tips in `PhotoImportModal`: "lay flat, shoot straight down, one
  nine per photo for 3-nine cards."
- Review photo slot labels and instruction copy for clarity.
- Files: `PhotoImportModal.jsx`
- Priority: Medium

---

### Sprint 15 — Display Polish + Features

_Sessions within Sprint 15 may be tackled in any order._

**15-A: Display Polish — Summary, History, Modals**
- Move player name tiles out of header on round summaries (`RoundSummaryModal.jsx`).
- Remove Match/Nassau label from history tiles (`HistoryPage.jsx`).
- Remove front/back label from summary/report headers; smart line-break on long course
  names at " - " (remove the dash in the process) — e.g. "PGA West - Nicklaus
  Tournament Course" breaks cleanly.
- Replace all remaining `window.confirm` / `window.alert` system dialogs with custom
  styled modals throughout the app (Discard round and any other remaining OS prompts).
- Files: `RoundSummaryModal.jsx`, `HistoryPage.jsx`, `roundUtils.js`, `ScorecardPage.jsx`
- Priority: Medium

**15-B: Game Table Display Consistency Pass**
- Audit all game tile chip/total labels across all games (e.g. "pts", "$") — decide
  once whether labels appear, apply uniformly.
- Audit player name chip display consistency across all game tables.
- D-2: "pts" label on Nines total chips (original item, now part of broader audit).
- Files: `NinesTable.jsx`, `SkinsTable.jsx`, `StablefordTable.jsx`, `SixesTable.jsx`,
  `MatchNassauTable.jsx`, `StrokePlayTable.jsx`, `DotsTable.jsx`, `ScoreGrid.jsx`
- Priority: Medium

**15-C: Results Page Refinement**
- General results page layout and presentation refinement pass. Pre-extraction
  `ResultsDisplay` code preserved in `ResultsPage.jsx` as commented block — revert
  or incorporate elements as needed during this session.
- Files: `ResultsPage.jsx`, `PayoutDisplay.jsx`
- Priority: Medium

**15-D: Save Game Settings as Defaults**
- A-5: Pre-fill NewRoundPage game config with last round's settings.
- Files: `NewRoundPage.jsx`, `roundLib.js`
- Priority: Medium

**15-E: Players / Courses Enhancements**
- G-1: Starred/favorite players float to top of player list and all pickers.
- G-2: Include/exclude players from leaderboard — filter one-off players off home
  screen money list.
- Swipe-left Edit/Delete on Players and Courses pages, matching HistoryPage pattern.
  Extract generic swipe component at same time (avoid third copy of HistoryPage logic).
- Files: `PlayersPage.jsx`, `CoursesPage.jsx`, `HomePage.jsx` + new generic swipe component
- Priority: Low (G-1, G-2), Low (swipe)

**15-F: Cleanup Pass**
- F-5: Remove legacy shims (confirm all saved rounds migrated before removing).
- F-6: Hint text review and cleanup.
- I-5: Delete dead `hooks.js`.
- H-1: Sahalee hole numbering 1–9 per nine + yardage total fix.
- History date range persistence across sessions.
- ScoreGrid legacy keyboard dead code cleanup (~60 lines: `advanceRef`, `handleKeyDown`,
  `handleScore`, `scheduleAdvance`, `cancelAdvance`, `pendingAdvance`).
- Dots auto-mark loop bounds fix (iterate `roundStartHole..roundEndHole`, not `0..17`).
- Files: misc
- Priority: Low

**15-G: Advanced Scorecard Options** *(contract first)*
- C-7: Birdie/bogey indicators — visual indicators (circle/square) on score cells.
  Amend `UI_Component_Contract.md`.
- Files: `ScoreGrid.jsx`, `ScorecardPage.jsx`
- Priority: Low

**15-H: Verify iCloud Export Naming**
- I-2: Confirm save-to-Files flow on iOS Safari behaves correctly with current naming
  convention (`The Card YYYY-MM-DD HH-MM.json`). Verification only; may require minor
  filename fix.
- In-app splash screen on cold load (~1.5s, logo on green).
- Files: `App.jsx`
- Priority: Low

---

### Sprint 16 — New Game Formats

_Each format requires its own contract session before any code._
_Wolf will not be added until the rest of the app is considered solid by the owner._

1. **Wolf** — rotating Wolf player; highest priority next format. `GAME_CONFIGS` in
   11-I preserves extension point for Wolf's doubling mechanic. `GameConfigWolf.jsx`
   extension point reserved in 13-E `GameConfig` split.
2. **High/Low** — low ball + high ball per hole.
3. **Banker (Quota)**, **Scotch/Greensomes**, **Chapman/Pinehurst**.
4. **Bingo Bango Bongo**, **Vegas**, **Round Robin**, **Snake**, **Rabbit/Flags/String** — deferred.
5. **Uneven team matches (1v2)** — deferred.

---

## Items Requiring Contract Work

| Item | Contract | Notes |
|---|---|---|
| 15-G: Birdie/bogey indicators | `UI_Component_Contract.md` | Amend before ScoreGrid changes |
| Sprint 16: Wolf | New `Wolf_Contract.md` | Full contract session before any code |
| Sprint 16: High/Low | New `HighLow_Contract.md` | Full contract session before any code |
| Sprint 16: other formats | New contracts per format | Full contract session each |

---

## Decision Log

### Pending Decisions

_None._

### Confirmed Decisions

| Decision | Session | Notes |
|---|---|---|
| Contracts are authoritative over code | 11-G | When contract and implementation conflict, contract wins |
| `betType` never stored in round state | 11-G | Static UI dispatch concept in `GAME_CONFIGS` only |
| Nassau terminology retired from UI | 11-G | Exposed as Front/Back/Overall segment bet fields |
| Wolf deferred until app is solid | 11-G | Extension point preserved in `GAME_CONFIGS` |
| Per-player tee selection | 11-I.1 | Completed; treat any extension as high-risk |
| `scoring` → `grossNetNOL` rename | 11-I.3 | Semantic field rename; all contracts updated |
| ScoreKeypad nav row removed | 13-B | Device testing confirmed too much screen space |
| Auto-advance timing: 700ms for `'1'`, immediate for others | 13-B | Cell advancement post-nav-row removal |
| `'X'` score semantics | 13-B | X = picked up; gross = par+2+strokes; always loses to real score |
| Round length stored as `roundStartHole` + `roundNumHoles` | 13-C.2 | `roundEndHole` always derived |
| Early departure via Results gateway only | 13-C | No "End Round Early" button on scorecard |
| Sequenced-event resolver model (v2.0) | 13-C.7 | One sheet per player, never combined; v1.x model REMOVED |
| Match/Nassau breakdown per-instance (Option A) | 13-C.8 | Each match emits its own columnar row; combined header retired |
| GPT-4o for scorecard photo OCR (superseded — see Gemini decision below) | 13-D | Claude vision unreliable on dense printed cards; GPT-4o 100% correct in one pass on Sahalee card. Decision was held by Sprint 14 planning evaluation; Gemini matched GPT-4o on app-consumed fields and won on cost/latency. |
| Codebase extraction before feature work | 13-D | 13-E refactor pass immediately after 13-C.bugs, before Sprint 14+ |
| Dispatcher + Shared file pattern for multi-game UI splits | 13-E | Established as the canonical pattern for splitting files containing both shared sub-components and per-game UI bodies. See Decision #26 / Architectural Decision #15. |
| 13-E remaining extractions sequenced as 13-E.2 through 13-E.8 sub-sessions | 13-E | Six additional extraction candidates surfaced during 13-E audit. Owner directed each be its own chat session rather than expanding 13-E's surface, to preserve token discipline and keep test surfaces separable. |
| `PayoutDisplay.jsx` is the single source of truth for payout display | 13-E.5 | `DotsColTable`, `SubHeader`, `PayRow`, `splitGameHeader`, `fmtMoney`, `PayoutsSection` live exclusively in `pages/PayoutDisplay.jsx`. Pre-extraction code preserved as commented blocks in consumers for 15-C revert. RSM visual style canonical for both surfaces. |
| Shared `NewRoundHelpers.jsx` for module-scope form helpers (Option B) | 13-E.7 | `NineDropdown`, `TeeDropdown`, `HIField`, `CHField` extracted to `pages/new-round/NewRoundHelpers.jsx` — single source of truth imported by `NewRoundPage`, `CourseCard`, `PlayersCard`. Option A (duplication) and Option C (render props) were rejected. |
| `readOnly`+`onFocus`+`e.target.blur()` for iOS keyboard suppression | 13-F | More reliable than `<div>` tap targets or `inputMode="none"` alone. `<div>` approach silently broke when files weren't all deployed. |
| Empty kpValue seed for select-to-overwrite | 13-F | Parent always seeds `kpValue: ''`; field's persistent value stays visible; first digit rewrites it via the field's own onChange callback. Simpler than the `isSeeded`/`freshRef` approach. |
| Plus-CH indicator uses USGA rule: `hcps[h] > 18 - Math.abs(ch)` | 13-F | Strokes given back on EASIEST holes (highest SI), not hardest. Original v1.7 spec had condition inverted. |
| `groupCourseHandicaps` gains optional `nines` arg for gender-aware par | 13-G | Female players use `tee.slopeW`/`tee.ratingW` and women's total par when present. Existing all-male callers unchanged when `nines` not passed. |
| Per-player `siArray: number[18]` attached at round-start | 13-G.2 | Engines are gender-blind — they read `players[pi].siArray[h]` unconditionally. `hcps` parameter dropped from all 9 engine functions. Single source of truth; new games added later are automatically gender-aware. Chosen over passing `hcps`+`hcpsWomen` to every engine. Implemented and confirmed in 13-G.2. |
| Gemini 2.0 Flash for scorecard photo OCR | Sprint 14 planning | Owner-run head-to-head test (Sahalee + Fircrest) showed Gemini and GPT-4o tied at 100% accuracy on app-consumed fields (pars, stroke indices, tee names, ratings, slopes, nine-totals). Both erred only on per-hole yardage allocation for combo tees — not data the app consumes. Gemini chosen on cost (~25× cheaper per parse) and lower latency at tied accuracy. Supersedes the 13-D GPT-4o decision. |
| API key storage = Option B (localStorage prompt) for build phase | Sprint 14 planning | Three options considered: A hardcode in bundle, B one-time prompt + localStorage, C Netlify Function proxy. Owner currently builds across multiple Netlify accounts (rotating to avoid free-tier build limits), making C impractical until app stabilizes on a single account for production deploy. B chosen as the build-phase default: zero infrastructure, key never in public bundle, key isolated to devices owner controls. C migration deferred — see Deferred / Deprioritized. |
| On-device OCR (Tesseract.js + structured extraction) rejected | Sprint 14 planning | Considered for offline parse capability. Rejected because: (1) scorecard import is setup-time, not on-course — offline isn't actually needed; (2) Tesseract is a character recognizer, not a table parser — reconstructing the scorecard grid spatially is the hard problem and is what vision LLMs solve implicitly; (3) ~10MB WASM payload for a feature used a handful of times in app lifetime; (4) deterministic post-OCR parsing is fragile on unfamiliar card layouts. Cloud vision (Gemini) wins on accuracy, cost, and complexity. |
| Engine signature changes require auditing every call site by function name, not by parameter text | 13-G.2 | Initial 13-G.2 audit grep'd for `scoreForMode`/`xGrossScore` text matches and missed 5 higher-level engine call sites (`calcSkinsHole`, `runMatchNassau` ×3, `runSixesSegment` ×2). Pattern for future signature changes — always grep by every engine function name across `*.js`/`*.jsx`. Captured as H-37. |
| iOS double-cell-advance fix: `touchHandledRef` timestamp guard | 13-G | React 18 attaches touch listeners as passive, silently ignoring `e.preventDefault()` in `onTouchEnd`. The synthetic click ~300ms later was firing in addition to the touch handler. Guard suppresses synthetic click within 600ms of touchend. |

---

## Deferred / Deprioritized

| Item | Priority | Reason deferred |
|---|---|---|
| 11-B: Shared GameTable shell | Low | Pattern already working; documentation value only |
| Dark mode | Deferred | Token structure ready in `ui.jsx`; low demand |
| Undo delete toast | Deferred | Low impact |
| Match scorecard rows collapse by default | Deferred | Low priority |
| CoursesPage GHIN/USGA API import | Deferred | External dependency; low priority |
| Scorecard gear icon options menu | Deferred | Design decision still open |
| Press modal live match status display | Deferred | Low priority UX enhancement |
| `buildShareImage` range-awareness | Deferred | Owner directed — revisit alongside 15-H |
| Mid-round Round Summary access gating | Deferred | Owner directed — revisit when partial-round UX fully complete |
| "Overall" → "Total" full internal rename | Deferred | Risky rename, low user impact; requires migration shim |
| Pinch-zoom with snap-back on scorecard | Deferred | Unusual UX pattern; risk of breaking touch handling in ScoreGrid |
| Sponsor/staking mechanic for non-betting player | Deferred | Contract-first; non-trivial engine work; narrow use case |
| Lock/pin scorecard toggle | Deferred | Contract-first; revisit when scorecard UX is fully stable |
| API key / Face ID security gate | Deferred | Personal-use PWA; not worth complexity for current distribution |
| API key proxy migration (Option C — Netlify Function) | Deferred | Sprint 14 planning resolved key storage as Option B (localStorage) for the build phase. Migration to a Netlify Function proxy (key held server-side, never in bundle or localStorage) deferred to a "production hardening" session before public deploy, when app stabilizes on a single Netlify account. Owner currently rotates Netlify accounts during development to manage free-tier build limits. Migration is surgical: only `aiCall()` in `courseLib.js` changes — endpoint swap, drop localStorage key read. Add the Netlify Function file. No data migration, no contract changes. |
| Replace PNG logos with SVG | Deferred | When designer provides SVG files |
| Handicap multiplier | Deferred | Contract-first (Handicap_Contract.md); revisit when demand clear |
| D-15: Team Dots → Individual Dots after parent ends | Deferred | Complex; wait for real demand |
| Multi-instance for non-Match games | Deferred | Major scope; no current need |
| Wrap-around rounds | Deferred indefinitely | Rare use case; major cross-layer complexity |
| 13-C.4 Mid-Round Game Start (late arrival) | Deferred | Owner confirmed use case too rare to justify cost |
| Bingo Bango Bongo, Vegas, Round Robin, Snake, Rabbit/Flags/String | Deferred | Lower priority game formats |
| Uneven team matches (1v2) | Deferred | Structural complexity; wait for demand |
| MatchNassauTable column headers for non-zero-start matches | Deferred | Polish — post-13-E |
| "Computed over holes 1–k" notes in game table footers | Deferred | Polish — post-13-E |
| Game range indicator in game table headers | Deferred | Polish — post-13-E |
| Stroke Play §14 G-2 `effMin` not received from `subsetMin()` | Deferred | Architectural inconsistency only; results correct |
