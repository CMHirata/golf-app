# The Card — Master Build Plan

_Last updated: May 2026 — 15-Bugs.2 complete and confirmed on device. Save-gate departure fix + Nines decoration string fixes. Next session: **15-Bugs.3 — Nines Total Bet Mode**._
_Maintained in this chat as the authoritative sequence and history of all build sessions._
_The APP_STATE_SUMMARY.md in the project knowledge base is the authoritative record of_
_what is implemented. This file is the authoritative record of what was planned, why,_
_and in what order — including items that shifted, were skipped, reinstated, or renumbered._

---

## Critical Rules

1. **Every session starts with a full read of `APP_STATE_SUMMARY.md`.** Do not write code before reading the current state.
2. **Contracts are authoritative over code.** If implementation conflicts with a contract, the contract wins.
3. **Session designations are owner-assigned.** Do not invent session numbers.
4. **No session is "closed" until it is confirmed on device.** "Delivered" ≠ "Closed."
5. **One question at a time.** Never stack multiple open decisions in a single message.
6. **No stream-of-consciousness.** Diagnostic first, code second, confirmation last.
7. **Always use the canonical app URL: `https://the-card-1qm.pages.dev`** — not the hash deployment URLs (e.g. `941b83c0.the-card-1qm.pages.dev`). Hash URLs are frozen deployment snapshots and never update.

---

## Numbering History

- **11-I** split into **11-I.1** (Players card + contracts + shared components) and **11-I.2** (game config UI rebuild) — sub-session dot notation; both treated as separate BP rows.
- **14-E** (Import conflict UX overhaul) completed out of order during Sprint 13. Logged under Sprint 13 in Completed Sessions.
- **14-A** scope vastly exceeded original plan (simple API swap → full OCR infrastructure build). Split into **14-A** (closed May 2026) and **14-A.2** (Mistral OCR continuation, requires real WiFi). See 14-A.2 open session entry.
- **14-B** scope significantly exceeded plan — originally "CourseImportReviewModal new component"; became full ManualCourseModal redesign + import flow wiring + extensive iOS keypad debugging.
- **14-C.bugs** (Open Session Plan designation) → corrected to **14-bugs.1** at session start per owner. Non-sequential designation; logged here for traceability.
- **15-E** scope significantly exceeded original plan — original spec covered swipe-to-delete, star toggle, money toggle on Players page only. Expanded to include: shared `SwipeableRow` component (refactoring CoursesPage swipe at the same time), Money List moved from History to Home page, YTD Leader removed, cumulative winnings removed from History page, starred avatar treatment in PlayerPickerPopup, `new-round/CourseCard.jsx` renamed to `NewRoundCourseCard.jsx` to resolve naming collision.
- **15-C** scope significantly exceeded original plan — original spec was "pre-extraction commented blocks cleanup"; became full Payouts page redesign (rename, chips, settle up tile, game cards).
- **15-Bugs.1** non-sequential designation per owner. Bug-fix session for female course handicap on 3-nine courses.
- **15-Bugs.2** non-sequential designation per owner. Bug-fix session for save-gate departure exemption and Nines decoration string.

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
| 13-C.3 | Predetermined game ranges: Phase 1 contract amendments + Phase 2A engine + plumbing + Phase 2B game-table visual range trimming | — | Confirmed on device |
| 13-C.4 | Deferred — mid-round game start (late arrival) confirmed too rare to justify cost | — | Deferred |
| 13-C.5 | Departure resolver UI Phase 1: `DepartureResolverSheet`, per-game option matrix, clinch detection | — | Confirmed on device |
| 13-C.6 | Departure resolver UI Phase 2: undo gesture, format detection, departure semantics | — | Confirmed on device |
| 13-C.7 | Departure resolver Phase 3 + PartialGameContract v2.0 (sequenced-event model, Reorder Departures) + v2.1 amendment + cleanup | — | Confirmed on device |
| 13-C.8 | Match/Nassau per-instance breakdown (Option A) + Sixes columnar shape + departure decoration strings | — | Confirmed on device |
| 13-C.bugs | Post-13-C.8 bug-fix consolidation session | — | Confirmed on device |
| 13-D | Planning session — backlog restructure, sprint reprioritization + `useDepartureResolver.js` extraction bonus | — | Confirmed on device |
| 14-E | Import conflict UX overhaul (completed out of order during Sprint 13) | — | Confirmed on device |
| 13-E | `GameConfig.jsx` (1,292 lines) split into 7-file dispatcher + Shared + 6 panel files. Circular import resolved via `GameConfigShared`. Architectural pattern (dispatcher + Shared) added as Decision #26. Four game contracts amended. | — | Confirmed on device |
| 13-E.2 | `App.jsx` slim-down (530→321 lines). Four extractions: `NavIcons.jsx`, `BottomNav.jsx`, `exportUtils.js`, `useIsLandscape.js`. | — | Confirmed on device |
| 13-E.3 | `HistoryPage.jsx` slim-down (736→482 lines). Two extractions: `SwipeableRoundRow.jsx`, `HistoryIcons.jsx`. | — | Confirmed on device |
| 13-E.4 | `ScoreGrid.jsx` depart-prompt extraction + Skins regression fix + resolver header copy edge case. `PartialGameContract.md` → v2.2, `Resolver_UI_Spec.md` → v1.4. | — | Confirmed on device |
| 13-E.5 | `PayoutDisplay.jsx` shared extraction. | — | Confirmed on device |
| 13-E.6 | `roundUtils.js` → `shareUtils.js` extraction (933 lines). | — | Confirmed on device |
| 13-E.7 | `NewRoundPage.jsx` 3-card extraction (1414→765 lines). Four new files. H-31 added. | — | Confirmed on device |
| 13-E.8 | `RoundSummaryModal.jsx` → `ReadOnlyScorecard.jsx` extraction. Closes 13-E.x series. | — | Confirmed on device |
| 13-F (contract) | Universal keypad expansion + plus-CH indicator — contract-only. Four contracts amended. | — | Contract only — no device test needed |
| 13-F | Universal keypad implementation. Scope significantly exceeded plan — extensive iOS-specific debugging. H-32 through H-35 added. Contracts updated to v2.4/v1.8/v1.5. | — | Confirmed on device |
| 13-G | Female handicap bug fix — gender-aware course handicap + stroke-allocation display. `Handicap_Contract.md` v1.9. H-36 added. | — | Confirmed on device |
| 13-G.2 | Engine gender-blind SI refactor — per-player `siArray`, `hcps` dropped from all 9 engine functions. `Handicap_Contract.md` v2.0, `App_Data_Model_Contract.md` v3.7. H-37 added. | — | Confirmed on device |
| 14-A | Sprint 14 photo import — full OCR infrastructure build. AI Assistant path confirmed on device. Auto Scan functional with known limitations. `courseLib.js` schema gains `nineComboNames`. `CourseCard.jsx` hole numbering + combo yardages. Deploy migrated from Netlify to Cloudflare Pages + Workers. Scope significantly exceeded plan — see detailed 14-A notes below. | — | Confirmed on device — AI Assistant path. Auto Scan in development. |
| 14-B | ManualCourseModal full redesign: compact M/W inline grid for Par & Handicap, table layout for Rating/Slope & Yardage, USGA SI validation (odd/even per nine, duplicate detection, save-block), `KpField` component for system-keyboard-free entry, discard confirmation overlay, tap-outside lock, modal shrinks when keypad open, background scroll lock. `PhotoImportModal.jsx`: `finish()` → Review & Save flow via `ManualCourseModal` with `initialData`, duplicate tee name consolidation. `CourseCard.jsx` + `courseLib.js`: website field removed. Scope significantly exceeded plan. H-39 added. | — | Confirmed on device |
| 14-bugs.1 | Custom dot bugs: `parts[2]` key-split bug caused custom dot IDs (`c_timestamp`) to be silently dropped in payout accumulation and team companion logic across `payouts.js`, `ScoreGrid.jsx`, `DotsTable.jsx`, `DotsPopup.jsx`. Fixed with `parts.slice(2).join('_')` at all 6 id-extraction sites. `pivotSegTot`/`pivotRoundTot` companion-filtering fix. ScoreKeypad double-fire: React 18 passive listeners silently ignored `preventDefault()` in `onTouchEnd`, causing `onClick` to fire ~300ms later on every digit/backspace tap. Fixed with `touchHandledRef` timestamp guard on `onClick`; `onMouseUp` removed. H-40 added. | — | Confirmed on device |
| 15-E | Players page enhancements. Shared `SwipeableRow` component (ported from `SwipeableRoundRow` mechanics — yellow edit strip, red delete, full-swipe overlay). `CoursesPage` refactored to use `SwipeableRow`. Star/favourite toggle on player rows — starred players sort to top of `playerLib.list()` and all player pickers. Per-player `inMoneyLists` toggle. Cumulative Winnings removed from History page. Money List added to Home page (roster-filtered, `inMoneyLists`-filtered). YTD Leader widget removed from Home page. Starred avatar treatment in `PlayerPickerPopup` (pale yellow star watermark behind initial, disappears on selection). `new-round/CourseCard.jsx` renamed `NewRoundCourseCard.jsx` to resolve naming collision with `pages/CourseCard.jsx`. `App_Data_Model_Contract.md` §5.3 amended — `starred` and `inMoneyLists` library-record fields. Scope significantly exceeded plan. | — | Confirmed on device |
| 15-F | Dead import cleanup. Removed dead `Btn` import from `HistoryPage.jsx`; removed dead `GA` import from `HomePage.jsx`. Two surgical `str_replace` edits. | — | Confirmed on device |
| 15-E.1 | Money List visual overhaul (Option D layout: position number + initials avatar + name + amount; left accent bar in app green/red/grey; no winner highlight; no round counters). Custom date wheel picker (iOS-style three-column scroll wheel: month/day/year) replacing native `<input type="date">`. New shared `components/RangePicker.jsx` extracts all range logic — owns two localStorage keys (`moneyListRange` for Home, `historyRange` for History) so the two pages maintain independent filter state. Range options: 7 Days, MTD, YTD, All Time, Custom (equal-width pill grid). Settings persisted through backup/restore via new top-level `settings` field in export payload. Player conflict-detection field-list fix (`starred`, `inMoneyLists` added to `f` field list at both detection and resolution sites in `HistoryPage.applyImport`). `CoursesPage` add-button row updated to match Money List pill style (Search / Scan Card / Manual all filled green). Contracts amended: `App_Data_Model_Contract.md` v3.8 (§1 storage keys, §1.1 range pref shape, §1.2 backup payload settings field), `Round_Lifecycle_Contract.md` v2.3 (§5.2 settings cross-reference), `UI_Component_Contract.md` v1.6 (§10 NEW — `RangePicker.jsx` documented). Scope significantly exceeded plan. | App_Data_Model v3.8, Round_Lifecycle v2.3, UI_Component v1.6 | Confirmed on device |
| 15-G | Birdie/bogey/eagle/double-bogey par-relative indicators on ScoreGrid score cells, ReadOnlyScorecard (round summary modal), and share image (`shareUtils.js`). `parRelative()` helper added to `scorecardUtils.js`. `BIRDIE_COLOR` and `BOGEY_COLOR` tokens added to `ui.jsx`. Indicators: eagle = double circle, birdie = single circle, par = none, bogey = single square, double-bogey-or-worse = double square. Stroke-only outlines, gross score vs par, suppressed on empty/locked/missing-par cells. Share image uses CSS borders (not SVG) due to foreignObject limitation; number centered via absolute `top:53%/left:50%` anchor. ScoreGrid pin feature deferred — see Deferred table. `UI_Component_Contract.md` v1.7 (§3.6 new tokens, §4.11 NEW indicator overlay rules). Scope significantly exceeded plan — extended to 15-G.2 to cover ReadOnlyScorecard and shareUtils. | UI_Component v1.7 | Confirmed on device |
| 15-C | Payouts page redesign. "Results" renamed to "Payouts" throughout (`ResultsPage.jsx` header, `ScorecardPage.jsx` button). Player chips: vertical stack (initial circle / first name / last name / net amount), sorted win-to-loss, all players in one row, first+last initials in circle. Settle Up tile with transfer SVG icon: greedy debt-simplification algorithm (fewest transactions). "Total — All Games" section removed. Per-game sections refreshed as white cards with border/shadow on light-green page background. No contract changes. Scope significantly exceeded original plan. | — | Confirmed on device |
| 15-B | Game table display consistency pass. Removed all per-game legend/help text (`ColNote` lines) from `NinesTable`, `SkinsTable`, `StablefordTable`, `StrokePlayTable`, and the scorecard-level dots hint from `ScoreGrid`. Stripped extra info from game tile upper-right badges — Gross/Net only across all tables; added missing Gross/Net badge to `DotsTable`. Column header standardization: "Skins"→"Total" (`SkinsTable`), "F"/"B"→"Total" (`StablefordTable`), "Status"→"Total" (`SixesTable`, `MatchNassauTable`). "Front 9"/"Back 9"→"Front"/"Back" in `MatchNassauTable`, `DotsTable`, and `ScoreGrid` half labels. Removed Dots pivot winner highlight. Removed dead `frontLabel`/`backLabel` prop from `ScoreGrid` (variables retained in `ScorecardPage` for toolbar display). | — | Confirmed on device |
| 15-Bugs.1 | Female course handicap fix on 3-nine courses. `groupCourseHandicaps` and `computePlayerCH` in `NewRoundPage.jsx` were summing `parsWomen` across all nines in `course.nines` instead of only the two active nines, producing a wildly wrong `womensPar` (e.g. 108 instead of 72 at Sahalee). Fixed by filtering to `activeNines` (front + back only) at both call sites. Two surgical `str_replace` edits to `NewRoundPage.jsx` only. H-43 added. | — | Confirmed on device |
| 15-Bugs.2 | Save-gate exempts post-departure holes for departed players (`ResultsPage.jsx`). Nines Nassau decoration string fixes: unresolved segments default to `'abandon'`, zero-bet segments excluded from label, capitalize "Ended"/"Paid", period separator, trailing period. Changes to `payouts.js`, `roundUtils.js`, `ResultsPage.jsx`. | — | Confirmed on device |
| 15-A | Display polish pass. Player chips moved out of dark green header into `#ddeedd` band beneath it, matching share image style (white card chips, first/last name stacked, HI/CH). Course name smart line-break on ` - ` in `RoundSummaryModal` header. `ReadOnlyScorecard` half-row labels simplified to `'Front'`/`'Back'` (nine names removed). `shareUtils` half-table labels same; `ninesLabel` gated to 27-hole courses only (was firing for all multi-nine courses). History game pills: `'Match / Nassau'` displays as `'Match'` in `SwipeableRoundRow`. No contract changes. | — | Confirmed on device |

---

### 14-A Detailed Session Notes

**Originally planned:** Simple swap of `aiParseScorecard()` from Anthropic to Gemini 2.0 Flash + localStorage key flow. Single session.

**What actually happened:** Full multi-month OCR infrastructure build. Six architectural approaches attempted. Documented exhaustively so 14-A.2 does not repeat old ground.

#### Infrastructure

- **Cloudflare Pages** — app at `https://the-card-1qm.pages.dev` (**canonical URL — always use this, never hash URLs**)
- **Cloudflare Worker** — `scorecard-parser` at `https://scorecard-parser.thecard.workers.dev`
- **Worker secrets:** `GEMINI_API_KEY` and `MISTRAL_API_KEY` (prefix `llx-p8`) set via `wrangler secret put`
- **Deploy commands:**
  ```bash
  git add . && git commit -m "message" && git push
  ```
- **Key files in `/home/claude/work/`:**
  - `worker_clean.js` — Gemini coordinate + HTML table version (last deployed Auto Scan state)
  - `worker_mistral.js` — Mistral OCR version (partially working, **untested on real WiFi**)

#### OCR approaches tried (do not re-attempt without reading this)

| Approach | Result | Why abandoned |
|---|---|---|
| Anthropic/Claude vision | Rejected pre-session | Unreliable on dense grids |
| Gemini inline base64 + JSON schema | Failed | JSON schema causes null values + hallucination; Netlify 10s timeout |
| Gemini Files API + JSON schema | Failed | Schema enforcement still causes nulls |
| **Gemini Files API + transcription CSV (BREAKTHROUGH)** | Best Gemini result | No JSON schema — model transcribes, JS structures. Got "all numbers correct" on Waiehu |
| Gemini coordinate panel attention | Partial improvement | Pass 1 returns `[ymin,xmin,ymax,xmax]` bounding boxes; Pass 2 focuses per panel. Helped structure, didn't eliminate all errors |
| Gemini HTML table output | Mixed | Fixed some HCP swaps, introduced new par errors |
| **Mistral OCR** | Untested on real WiFi | Native HTML table output, $0.002/page. Tables returned as `[tbl-0.html](tbl-0.html)` placeholders — fix is to iterate `page.tables[]` array of `{id, content}` objects. Code written, airplane WiFi too slow to test. **14-A.2 picks up here.** |

#### Current Gemini Auto Scan limitations (known, not worth fixing before Mistral test)

- **Par/HCP value swaps undetectable** — adjacent values (e.g. holes 8/9 women's HCP 15↔9) have same sum and same unique set; math validator cannot detect
- **Fircrest timeout** — 6 tees × per-panel calls exceeds 120s client timeout
- **Course name** — sometimes reads city/venue name instead of full course name

#### What the math validator catches

- Par sum mismatch vs printed OUT/IN totals → fires Pass 3 par re-read
- HCP non-uniqueness → fires Pass 3 HCP re-read

#### AI Assistant import path (CONFIRMED ON DEVICE — primary reliable path)

1. User taps "AI Assistant" tab → import prompt auto-copied to clipboard silently
2. Step 1: "Open Gemini" button → `https://gemini.google.com`
3. Step 2: Long-press textarea → iOS "Paste" → JSON populates → "Import JSON" button appears → taps it
4. Uses existing conflict/merge review flow (14-E)

Import prompt (`IMPORT_PROMPT` constant in `PhotoImportModal.jsx`) supports:
- 18-hole (2 nines) and 27-hole (3 nines) courses
- `parsWomen` for holes where women's par differs (card notation `5/4` = women 5, men 4)
- `handicapsWomen` if separate women's HCP row exists
- Combo tees (e.g. `Blue/White`) with or without women's ratings
- `nineComboNames` for 27-hole courses — the three 18-hole combination labels in card order

#### Schema changes (14-A)

- `courseLib.js` schema comment: `nineComboNames?: string[]` — optional, 27-hole courses only. Three 18-hole combo labels in card order (e.g. `['South/North','North/East','East/South']`). Used by `CourseCard.jsx` for yardage display.
- `CourseCard.jsx`: hole numbers now 1-9 per nine (not 1-27). 27-hole tee table shows three 18-hole combo yardages (e.g. `7007 / 6973 / 6976`) with labels from `nineComboNames` when present, falling back to first-letter abbreviations.

#### Client-side image preprocessing (`PhotoImportModal.jsx`)

Grayscale conversion + contrast boost (factor 1.5) + sharpening kernel applied via canvas before upload. All client-side.

#### 14-A.2 pickup instructions

**Goal:** Test Mistral OCR table parsing and evaluate vs Gemini approach.

**Starting point:** `worker/worker_mistral.js`. The critical fix already in place:
```js
let markdown = (data.pages || []).map(p => {
  let text = p.markdown || '';
  const tables = p.tables || [];  // array of {id, content} — NOT a dict
  for (const table of tables) {
    const placeholder = `[${table.id}](${table.id})`;
    text = text.replace(placeholder, table.content || '');
  }
  return text;
}).join('\n\n');
```

**Test sequence:**
1. Copy `worker_mistral.js` to `worker/worker.js`
2. `wrangler secret put MISTRAL_API_KEY` (key prefix `llx-p8` — Christopher has it)
3. `cd worker && wrangler deploy && cd ..`
4. Test Waiehu first — check Worker logs for `Page 0 keys`, `Page 0 tables type`, `First table content preview`
5. If tables parse: test Fircrest (the timeout card for Gemini — Mistral should be faster)
6. If Mistral works well: make it primary, keep Gemini for metadata (course name, location, ratings)
7. If Mistral fails: accept current Gemini + AI Assistant state; build 14-B and move on

**Known Mistral behavior:**
- Model: `mistral-ocr-latest`
- Endpoint: `POST https://api.mistral.ai/v1/ocr`
- Auth: `Bearer ${MISTRAL_API_KEY}`
- Request: `{ model, document: { type: 'image_url', image_url: 'data:mediaType;base64,b64' }, table_format: 'html' }`
- Response: `{ pages: [{ markdown, tables: [{id, content}], ... }] }`
- Tables are NOT inline in markdown — they are placeholders that must be replaced with `table.content`

---

## Known Bugs

| Bug | Severity | Discovered | Notes |
|---|---|---|---|
| — | — | — | No known bugs. |

---

## Open Session Plan

> **Next session: 15-Bugs.3 — Nines Total Bet Mode.** 15-Bugs.2 complete. Sprint 15 remaining sessions may be tackled in any order. 14-A.2 (Mistral OCR) remains gated on real WiFi.

---

### Sprint 14 — Scorecard Photo Import

_14-A complete. 14-B complete. 14-bugs.1 complete. AI Assistant + Review & Save flow confirmed on device._

**14-A.2: Mistral OCR Continuation** *(requires real WiFi — do not attempt on airplane)*
- Test Mistral OCR table parsing with `page.tables[]` array fix
- Evaluate vs Gemini coordinate approach on Waiehu, Fircrest, Sahalee
- If accurate: integrate as primary Auto Scan path; Gemini handles metadata only
- If inaccurate: document findings, close 14-A.2, rely on AI Assistant + 14-B correction grid
- Files: `worker/worker.js` (swap in `worker_mistral.js`)
- Priority: High (gated on real WiFi)
- Requires: Mistral API key (Christopher has it, prefix `llx-p8`)

**14-C: Photo Guidance + UI Polish** *(fold into next available session)*
- Review photo slot labels and instruction copy.
- Files: `PhotoImportModal.jsx`
- Priority: Low — 14-B already cleaned up labels to "Front" / "Back"

---

### Sprint 15 — Display Polish + Features

_15-A, 15-B, 15-Bugs.1, 15-C, 15-E, 15-E.1, 15-F, and 15-G complete and confirmed on device — see Completed Sessions table above. Next session: 15-D._

**15-D: Save Game Settings as Defaults**
- Save last-used game configuration as default for next round.
- Priority: Medium

**15-H: Verify iCloud Export Naming**
- Priority: Low

---

### Sprint 16 — New Game Formats

_All Sprint 16 sessions are contract-first._

**16-A: Wolf** *(contract first)* — extension point preserved in `GAME_CONFIGS`.

**16-B+: Other formats** — High/Low, Bingo Bango Bongo, etc.

---

## Items Requiring Contract Work

| Item | Contract | Notes |
|---|---|---|
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
| GPT-4o for scorecard photo OCR (superseded) | 13-D | Claude vision unreliable. Superseded by Gemini decision. |
| Codebase extraction before feature work | 13-D | 13-E refactor pass before Sprint 14+ |
| Dispatcher + Shared file pattern for multi-game UI splits | 13-E | Canonical pattern for splitting files with shared sub-components |
| `PayoutDisplay.jsx` is the single source of truth for payout display | 13-E.5 | `DotsColTable`, `SubHeader`, `PayRow`, `splitGameHeader`, `fmtMoney`, `PayoutsSection` |
| Shared `NewRoundHelpers.jsx` for module-scope form helpers | 13-E.7 | Single source imported by `NewRoundPage`, `CourseCard`, `PlayersCard` |
| `readOnly`+`onFocus`+`e.target.blur()` for iOS keyboard suppression | 13-F | More reliable than `<div>` tap targets |
| Empty kpValue seed for select-to-overwrite | 13-F | Parent seeds `kpValue: ''`; simpler than `isSeeded`/`freshRef` |
| Plus-CH indicator uses USGA rule: `hcps[h] > 18 - Math.abs(ch)` | 13-F | Strokes given back on EASIEST holes |
| `groupCourseHandicaps` gains optional `nines` arg for gender-aware par | 13-G | Female players use women's tee data when present |
| Per-player `siArray: number[18]` attached at round-start | 13-G.2 | Engines gender-blind — read `players[pi].siArray[h]`. `hcps` dropped from all 9 engine functions. |
| Gemini 2.0 Flash for scorecard photo OCR | Sprint 14 planning | Tied with GPT-4o at 100% accuracy on app fields; chosen on cost (~25× cheaper) and latency. |
| API key storage = Option B (localStorage prompt) for build phase | Sprint 14 planning | Zero infrastructure; key never in bundle. Option C proxy deferred to production hardening. |
| On-device OCR (Tesseract.js) rejected | Sprint 14 planning | Not an offline use case; character recognizer not a table parser; WASM too heavy. |
| Engine signature changes require auditing every call site by function name | 13-G.2 | Always grep by function name across `*.js`/`*.jsx`. Captured as H-37. |
| iOS double-cell-advance fix: `touchHandledRef` timestamp guard | 13-G | React 18 passive touch listeners; synthetic click suppressed within 600ms of touchend. |
| Cloudflare Pages + Workers for scorecard parsing | 14-A | Netlify 10s timeout too short for multi-pass OCR. Cloudflare Worker has no hard wall-clock timeout. |
| Transcription-first CSV for Gemini OCR | 14-A | Stop asking model to structure; ask it to transcribe. JS does all structuring. Key breakthrough. |
| AI Assistant import path as primary reliable path | 14-A | User copies prompt → Gemini chat → paste JSON back. Works flawlessly. Primary until Auto Scan perfected. |
| `nineComboNames` field for 27-hole courses | 14-A | Optional `string[]` on course object. Stores 18-hole combo labels in card order. `CourseCard.jsx` uses for yardage display. |
| Hole numbers display 1-9 per nine (not 1-27) | 14-A | `CourseCard.jsx` uses `h+1` not `ni*9+h+1`. Every nine numbered 1-9 independently. |
| Mistral OCR as next candidate for Auto Scan | 14-A | $0.002/page, native HTML tables, simple REST API. Partially integrated. Follow up in 14-A.2 on real WiFi. |
| Always use canonical Cloudflare URL | 14-A | `https://the-card-1qm.pages.dev` always points to latest deploy. Hash URLs (e.g. `941b83c0.the-card-1qm.pages.dev`) are frozen snapshots — never use them for testing. |
| CourseImportReviewModal replaced by Review & Save via ManualCourseModal | 14-B | Dedicated review grid scrapped — consistent UI, less code. `finish()` in PhotoImportModal opens ManualCourseModal pre-populated via `initialData`. |
| Website field removed from course schema UI | 14-B | Removed from ManualCourseModal, CourseCard, courseLib prompt/merge. Existing localStorage data with `website` field silently ignored. |
| SI validation: 2-nine courses use USGA odd/even rule; 1 or 3+ nines use 1–9 | 14-B | Front nine: odd 1–17. Back nine: even 2–18. 27-hole: each nine 1–9 independently. Save blocked on duplicates. |
| Tee Boxes card layout preserved as commented code | 14-B | `TeeRow` component kept in `ManualCourseModal.jsx` as commented-out Tees 1 option for potential future settings menu. |
| `SwipeableRow` gesture mechanics port from `SwipeableRoundRow` | 15-E | All swipe gesture tracking in refs (zero setState during gesture). `snapClose` called before action callbacks. Full-swipe threshold = 80% of row width. Edit strip = pale yellow `#fff9e6`, delete = `#c0392b`. |
| Money List on Home page; cumulative winnings removed from History | 15-E | Home page shows roster-filtered, `inMoneyLists`-filtered cumulative winnings. History page shows rounds only. |
| `starred` and `inMoneyLists` are library-only fields — never in `activePlayers` | 15-E | Engines never see these fields. `App_Data_Model_Contract.md` §5.3 amended. |
| `new-round/CourseCard.jsx` renamed to `NewRoundCourseCard.jsx` | 15-E | Resolves naming collision with `pages/CourseCard.jsx` (read-only detail card). Two distinct components, now distinct names. |
| Shared `RangePicker.jsx` is single source of truth for range filters | 15-E.1 | Both Home page Money List and History page round filter import from `components/RangePicker.jsx`. Range options, filter logic, custom date wheel picker live in one file. New range options or filter changes are made once and pick up in both consumers automatically. |
| Home and History maintain independent date filter state | 15-E.1 | Two distinct localStorage keys (`moneyListRange`, `historyRange`) sharing the same shape. `loadRangePref(key)` and `saveRangePref(pref, key)` accept the key as a parameter; consumer pages pass their own. Both keys survive backup/restore via the new `settings` payload field. |
| Backup payload `settings` field for app-level preferences | 15-E.1 | Top-level `settings` field on the export JSON carries app preferences (currently `moneyListRange` and `historyRange`). `HistoryPage.handleImportFile` preserves it through to `applyImport`, which writes each present key to localStorage. Settings overwrite silently — not subject to the player/course conflict prompt. Future preference keys follow the same pattern. |
| App-preference localStorage keys are direct strings, not part of `SK` | 15-E.1 | `SK` is reserved for entity data (players, courses, rounds, active round, setup draft). UI preference keys (`moneyListRange`, `historyRange`) are direct string literals owned by the component that uses them. Documented in `App_Data_Model_Contract.md` §1. |
| iOS-style scroll wheel for custom date picker | 15-E.1 | Three independent scroll columns (month/day/year) using CSS `scroll-snap-type: y mandatory` and `scroll-snap-align: center`. Selection highlight band is semi-transparent with green borders so the centered text is fully readable. Top/bottom fades stop short of the selected row to avoid obscuring it. |
| Money List visual: position + initials + name + amount, left accent bar | 15-E.1 | Each row has a 4px left accent bar colored green (positive) / red (negative) / grey (zero) — colorblind-safe contrast. No winner highlight, no round counters. Place number muted (12px, grey, weight 700). Name flex-grows; amount right-aligned. |
| Player import conflict field-list includes `starred` and `inMoneyLists` | 15-E.1 | `HistoryPage.applyImport` previously rebuilt player records using a fixed five-field list (`name, gender, ghin, email, phone`), silently dropping `starred` and `inMoneyLists` on any conflicting import. Both fields added to the `f` list at conflict-detection (line ~158) and conflict-resolution (line ~199) sites. Brand-new players (no conflict) were already correct. |
| Payouts page: player chips vertical stack, first+last initials, sorted win-to-loss | 15-C | Circle / first name / last name / net amount stacked vertically. All players in one row. Amounts always align because name is always two lines. |
| Payouts page: greedy debt-simplification for Settle Up tile | 15-C | `buildSettlements(bank)` sorts debtors/creditors by magnitude, matches greedily for fewest transactions. |
| "Total — All Games" section removed from Payouts page | 15-C | Redundant with player chips which already show each player's net. |
| ScoreGrid half labels simplified to Front/Back | 15-B | `frontLabel`/`backLabel` props removed from `ScoreGrid` — dead after label simplification. Variables retained in `ScorecardPage` for toolbar nine-name display. |
| Female CH on 3-nine courses: filter to active nines before summing womensPar | 15-Bugs.1 | `course.nines` must be filtered to the active front + back nines before summing parsWomen for the womensPar used in courseHandicap(). Summing all nines produces wildly wrong par (e.g. 108 instead of 72 at Sahalee). Fixed at both call sites in `NewRoundPage.jsx`. Captured as H-43. |

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
| Mid-round Round Summary access gating | Deferred | Revisit when partial-round UX fully complete |
| "Overall" → "Total" full internal rename | Deferred | Risky rename, low user impact; requires migration shim |
| Pinch-zoom with snap-back on scorecard | Deferred | Risk of breaking touch handling in ScoreGrid |
| Sponsor/staking mechanic for non-betting player | Deferred | Contract-first; non-trivial engine work; narrow use case |
| Lock/pin scorecard toggle | Deferred | Contract-first; revisit when scorecard UX fully stable |
| API key / Face ID security gate | Deferred | Personal-use PWA; not worth complexity for current distribution |
| API key proxy migration (Option C — Netlify Function) | Deferred | Option B chosen for build phase. Surgical migration deferred to production hardening. Only `aiCall()` in `courseLib.js` changes. |
| Replace PNG logos with SVG | Deferred | When designer provides SVG files |
| Handicap multiplier | Deferred | Contract-first; revisit when demand clear |
| D-15: Team Dots → Individual Dots after parent ends | Deferred | Complex; wait for real demand |
| Multi-instance for non-Match games | Deferred | Major scope; no current need |
| Wrap-around rounds | Deferred indefinitely | Rare use case; major cross-layer complexity |
| 13-C.4 Mid-Round Game Start (late arrival) | Deferred | Owner confirmed too rare to justify cost |
| Bingo Bango Bongo, Vegas, Round Robin, Snake, Rabbit/Flags/String | Deferred | Lower priority game formats |
| Uneven team matches (1v2) | Deferred | Structural complexity; wait for demand |
| MatchNassauTable column headers for non-zero-start matches | Deferred | Polish — post-13-E |
| "Computed over holes 1–k" notes in game table footers | Deferred | Polish — post-13-E |
| Game range indicator in game table headers | Deferred | Polish — post-13-E |
| Stroke Play §14 G-2 `effMin` not received from `subsetMin()` | Deferred | Architectural inconsistency only; results correct |
| Auto Scan accuracy to production quality | Deferred to 14-A.2 | Gemini coordinate approach has known limitations. Mistral OCR is next candidate. Test on real WiFi in 14-A.2. |
| starred players auto-selected in New Round | Deferred | Out of scope for 15-E; log for future sprint if demand arises |
| ScoreGrid sticky/pin to top of ScorecardPage | Deferred — optional | ScoreGrid takes significant vertical space; pinning may not be worth the screen cost. Revisit if user demand arises. Contract pattern documented in 15-G planning. |
