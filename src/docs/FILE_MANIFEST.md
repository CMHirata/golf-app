# The Card — File Manifest
_May 2026_

---

## Project root

index.html — app HTML entry point
package.json — dependencies and build/deploy scripts
vite.config.js — Vite build config

public/_redirects — Cloudflare Pages routing rules
public/sw.js — service worker

worker/worker.js — Cloudflare Worker (active deployed version)
worker/wrangler.toml — Worker deploy config

---

## src/

src/App.jsx — app shell, nav, round lifecycle, landscape wrapper
src/main.jsx — Vite entry point

src/components/BottomNav.jsx — bottom navigation bar
src/components/NavIcons.jsx — nav icon SVGs
src/components/RangePicker.jsx — shared range filter; owns moneyListRange + historyRange localStorage keys
src/components/ReadOnlyScorecard.jsx — read-only scorecard for round summary modal
src/components/SwipeableRow.jsx — generic swipe-to-edit/delete row (Players, Courses)
src/components/ui.jsx — design tokens and shared UI primitives

src/constants/layout.js — layout constants (nav/action bar heights)

src/engine/games.js — all scoring logic (pure functions)
src/engine/handicap.js — USGA handicap math, buildPlayerSI
src/engine/payouts.js — computePayouts entry point, payout aggregation
src/engine/engine_test.js — engine unit tests
src/engine/regression_test.mjs — regression test suite

src/hooks/useIsLandscape.js — single source for landscape detection

src/pages/CourseCard.jsx — read-only course detail card
src/pages/CourseMergeModal.jsx — course import conflict/merge UI
src/pages/CourseSearchModal.jsx — AI-powered course search modal
src/pages/CoursesPage.jsx — course library page
src/pages/HistoryPage.jsx — round history page
src/pages/HomePage.jsx — home page (Money List, quick actions)
src/pages/ImportModals.jsx — shared import modal wrappers
src/pages/ManualCourseModal.jsx — manual course entry/edit modal
src/pages/MatchCard.jsx — match configuration card
src/pages/NewRoundPage.jsx — round setup page (3-card layout)
src/pages/PayoutDisplay.jsx — payout display sub-components (DotsColTable, SubHeader, PayRow, etc.)
src/pages/PhotoImportModal.jsx — scorecard photo import (OCR / AI Assistant)
src/pages/PlayerDropdown.jsx — player dropdown selector
src/pages/PlayerPickerPopup.jsx — player picker popup
src/pages/PlayersPage.jsx — player library page
src/pages/ResultsPage.jsx — round results and save
src/pages/RoundSummaryModal.jsx — round summary modal shell
src/pages/ScorecardPage.jsx — state owner for live round
src/pages/ScoreKeypad.jsx — universal custom keypad

src/pages/history/HistoryIcons.jsx — icon SVGs for history page
src/pages/history/SwipeableRoundRow.jsx — history swipe row with round-action callbacks

src/pages/new-round/GamesCard.jsx — games configuration card
src/pages/new-round/NewRoundCourseCard.jsx — course selection card
src/pages/new-round/NewRoundHelpers.jsx — shared helpers: defaultMatch, makeMatchId, fmtHcp, validateBet
src/pages/new-round/PlayersCard.jsx — players configuration card

src/pages/scorecard/BetPillRow.jsx — bet amount pill row
src/pages/scorecard/DepartPromptModal.jsx — early departure prompt modal
src/pages/scorecard/DepartureResolverSheet.jsx — per-player departure resolver sheet
src/pages/scorecard/DotsPopup.jsx — dots/junk entry popup
src/pages/scorecard/GameResolutionRow.jsx — single game resolution row in resolver
src/pages/scorecard/GameSection.jsx — game section wrapper in scorecard
src/pages/scorecard/PressModal.jsx — press trigger modal
src/pages/scorecard/ReorderDeparturesModal.jsx — reorder departure queue modal
src/pages/scorecard/resolverUtils.js — buildResolutionOptions, applyClinchDetection
src/pages/scorecard/scorecardUtils.js — display formatters and derived state builders
src/pages/scorecard/ScoreGrid.jsx — hole-by-hole score grid (input + rendering)
src/pages/scorecard/TotalsCard.jsx — score totals card
src/pages/scorecard/useDepartureResolver.js — departure chain state hook
src/pages/scorecard/ZoomModal.jsx — score cell zoom/edit modal

src/pages/tables/DotsTable.jsx — dots/junk game table (render-only)
src/pages/tables/GameConfig.jsx — game config dispatcher
src/pages/tables/GameConfigDots.jsx — dots config panel
src/pages/tables/GameConfigNines.jsx — nines config panel
src/pages/tables/GameConfigShared.jsx — shared config sub-components
src/pages/tables/GameConfigSixes.jsx — sixes config panel
src/pages/tables/GameConfigSkins.jsx — skins config panel
src/pages/tables/GameConfigStableford.jsx — stableford config panel
src/pages/tables/GameConfigStrokePlay.jsx — stroke play config panel
src/pages/tables/MatchNassauTable.jsx — match/nassau game table (render-only)
src/pages/tables/NinesTable.jsx — nines game table (render-only)
src/pages/tables/SixesTable.jsx — sixes game table (render-only)
src/pages/tables/SkinsTable.jsx — skins game table (render-only)
src/pages/tables/StablefordTable.jsx — stableford game table (render-only)
src/pages/tables/StrokePlayTable.jsx — stroke play game table (render-only)

src/services/courseLib.js — course library CRUD and schema
src/services/exportUtils.js — auto-export trigger, backup payload builder
src/services/playerLib.js — player library CRUD and schema
src/services/roundLib.js — schema conversion: fromActiveRound / toActiveRound / toSetupState / migrateRecord
src/services/roundUtils.js — buildPayoutArgs, computePerMatchPayouts
src/services/shareUtils.js — buildShareHtml, buildShareImage, triggerRoundShare
src/services/storage.js — SK constants, makeId, localStorage helpers
