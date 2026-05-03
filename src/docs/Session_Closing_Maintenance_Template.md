# Session Closing — BP & ASS Maintenance Instructions

_Paste this into a session as work wraps up, before requesting updated BP and ASS files. The intent is to prevent the two documents from drifting back into the messy state they were in before the April 2026 audit._

---

We're closing this session. Before you produce updated `BUILD_PLAN.md` and `APP_STATE_SUMMARY.md` files, internalize and follow these maintenance rules. Each document has a specific role; do not blur the boundary between them.

## What each document is for

**`BUILD_PLAN.md` (BP)** is the chronological record. It owns:
- Critical rules and architectural decisions (these are durable and rarely change)
- Numbering history (every collision, split, restructure, sub-session)
- Completed Sessions table (every closed session, in chronological order)
- Open Session Plan (the *recommended execution order* for what's left)
- Items Requiring Contract Work (active needs only — no struck-through completed rows)
- Decision Log (Pending + Confirmed)
- Deferred / Deprioritized

**`APP_STATE_SUMMARY.md` (ASS)** is the lean current-state record. It owns:
- Update policy (the discipline checklist)
- Work in Flight (one or two paragraphs max — usually "None" between sessions)
- Current State (one paragraph describing where the codebase is *right now*)
- Tech Stack (small, stable)
- Implementation Gotchas H-1 through H-N (durable trip-wires the AI must not re-break)
- Open Items (small carry-over notes, *not* a bug tracker)
- Document Index (with subsections: Current / Process / Superseded)

ASS is **not** a session journal. It does not stack `_Last updated_` paragraphs. Session history lives in BP only.

## Closing-the-session checklist

When closing this session, walk these in order:

### Step 1 — Confirm session designation
The owner provides the session designation (e.g. "13-C.5"). Do not invent one. If the owner has not specified it, stop and ask.

### Step 2 — Update BP Completed Sessions table
- Add a new row at the end of the Completed Sessions table for the session that just closed
- Use the canonical status notation: `Confirmed on device` (or with a qualifier like `Confirmed on device — <specific note>` only when there's genuinely useful added context)
- Do NOT use variants like "All confirmed", "Confirmed", "Complete", or "All confirmed on device" — these were normalized in the audit and should not regress
- If the session is planning/contract-only with no code, use `Planning + contract only — no device test needed` or `Contract only — no device test needed`

### Step 3 — Strip the closed session from BP Open Session Plan
- Find the now-completed session in the Open Session Plan and **delete the entire block**
- If multiple sessions in the same sprint section are now complete, replace them with a single breadcrumb line: `_Sessions X, Y, Z complete and confirmed on device — see Completed Sessions table above. Next session: <next>._`
- The Open Session Plan should only contain genuinely-still-open work. A session marked `✅ COMPLETE` inside the Open Session Plan is a contradiction — strip it.

### Step 4 — Update BP top banner
The top banner is one line, not a session report. Format:
```
_Last updated: <month year> — <one-sentence status>. Next session: **<id> — <name>**._
```
Do not let the banner accumulate paragraphs. The session detail belongs in the Completed Sessions row, not in the banner.

### Step 5 — Update BP Open Session Plan banner
The Open Session Plan opens with a `>` blockquote pointing at the next session. Update its session reference:
```
> **Next session: <id> — <name>.** <one-line context about which sprint sections are deferred/medium/active.>
```

### Step 6 — Update Numbering History if applicable
If this session involved a split, sub-session, restructure, or non-sequential numbering decision, add a bullet to Numbering History. Otherwise skip.

### Step 7 — Update BP Decision Log
- If this session **resolved** a Pending decision: move that row from the Pending table to the Confirmed table, with the actual decision in the Decision column
- If this session **created** a new pending decision: add a row to the Pending table
- If a confirmed decision became architectural (cross-cutting, durable): also add it to Key Architectural Decisions (the Decision Log keeps the row for traceability)

### Step 8 — Update BP Items Requiring Contract Work
- If this session completed a row in this table: **delete the row entirely** (do not strikethrough). The Completed Sessions row is the trace.
- If a new contract amendment is needed for an upcoming session: add a row

### Step 9 — Update ASS Work in Flight
After the session closes successfully, this should usually read:
```
_None. Session <id> fully complete and device-confirmed. **Next session: <id> — <name>**._
```
If the session ended with work-in-progress that didn't fully close, describe that briefly here (one or two sentences, not a paragraph).

### Step 10 — Refresh ASS Current State
This is **one paragraph** describing the current state of the codebase as of right now. Replace the previous Current State paragraph entirely; do not append. Mention what just shipped if it changed the baseline meaningfully. Do not stack session reports.

The "Last refresh:" line above the paragraph is updated to reference the most recent session.

### Step 11 — Refresh ASS Document Index versions
For every contract that was amended in this session:
- Read the contract file's actual version header (do not infer from session notes)
- Update the version pin in the Document Index
- Add a brief note about what changed in the purpose column (keep the prior versions' notes too, condensed if needed)

If a contract was newly created or marked authoritative this session, add or update its row.

### Step 12 — Add a new H-gotcha if the session uncovered a durable trip-wire
H-gotchas are added when the session uncovered a non-obvious failure mode that the AI must not re-break. If nothing of that nature came up, skip this step. Only add a new H-gotcha when:
- The bug was subtle and re-discoverable
- Future code changes could re-introduce it
- The fix would not be obvious from reading the code alone

Number them sequentially (H-25, H-26, etc.). Do not insert new ones in the middle of the existing list.

### Step 13 — Update ASS Open Items
- If this session **closed** a tracked open item: remove the line entirely (no strikethrough)
- If this session **uncovered** new open work that doesn't yet warrant a session entry: add a brief bullet under the right sprint subsection
- Open Items are short bullets with priority — they are not session-detail blocks. If the description grows past two lines, link to BP instead

### Step 14 — Cross-check both files for consistency
Before finalizing, verify:
- Both files agree on what the next session is (use the canonical phrasing **Next session: <id> — <name>**)
- Both files agree on the most recently closed session
- BP top banner, BP Open Session Plan banner, BP Sprint section breadcrumb, ASS Work in Flight, and ASS Current State all point at the same "next" session
- No completed session appears in any "open" or "pending" list anywhere
- No strikethrough rows have been introduced in any active table

### Step 15 — Output full updated files
Output complete updated `BUILD_PLAN.md` and `APP_STATE_SUMMARY.md` files (or clear diffs) ready to copy/upload back. After updating, copy the new files into project knowledge.

---

## Anti-patterns to avoid

These are the failure modes that drifted the documents into a mess before the April 2026 audit. Do not regress.

- **Don't stack `_Last updated_` paragraphs in ASS.** ASS is not a journal. Update the Current State paragraph in place.
- **Don't leave completed sessions in the Open Session Plan.** A session marked ✅ COMPLETE inside the Open Session Plan is a contradiction. Strip it on closure.
- **Don't use strikethrough for completed rows in active tables.** Delete them. The Completed Sessions row is the historical trace.
- **Don't pad BP top banner with session report content.** It's one line. Detail belongs in the Completed Sessions row.
- **Don't mix Sprint and Session terminology.** "Sprint 13" is a sprint. "13-C.3" is a session. "Sprint 13-C.3" doesn't parse — use "Session 13-C.3" or "the 13-C.3 sub-session".
- **Don't duplicate session detail across both files.** If BP has the row, ASS should point at it (one line), not restate it.
- **Don't pin a contract version from memory or session notes.** Read the actual contract file's version header.
- **Don't invent session designations.** Owner-assigned only.
- **Don't use notation variants for "Confirmed on device."** That's the canonical form.
- **Don't add a row to the Pending Decisions table if the decision is already confirmed.** Add to Confirmed. (The previous Pending Decisions table had 6 of 7 confirmed rows; that's a smell.)

---

## When in doubt

Audit before fixing. If you notice anything in either document that contradicts these rules — even something not directly related to the current session — flag it to the owner before silently committing the change. Scope creep is visible, not hidden.

If the work this session significantly exceeded the originally planned scope, the Notes column in the Completed Sessions row should say so explicitly: `Confirmed on device. Scope significantly exceeded plan.`

If the session designation is ambiguous (e.g. work spanned what would normally be two sessions), stop and ask the owner whether to log as one row or split into two.
