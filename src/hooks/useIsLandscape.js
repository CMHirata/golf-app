// ─── src/hooks/useIsLandscape.js ──────────────────────────────────────────────
// Cross-cutting React hook: returns true when window.innerWidth >
// window.innerHeight, listening on `resize` and `orientationchange`.
//
// Consumers: App.jsx (top-level layout maxWidth gate) and
// RoundSummaryModal.jsx (full-screen vs modal layout). Both files
// previously held byte-identical local copies; this is the deduplicated
// shared home.
//
// IMPORTANT (H-4): This hook deduplicates the App.jsx and RoundSummaryModal
// copies only. ScorecardPage.jsx still computes its own `isLandscape` and
// passes it down to ScoreGrid and the game tables — that single-source-of-
// truth pattern is intentional and is NOT served by this hook. Do not
// refactor ScorecardPage to consume this hook without an architectural
// review.
//
// Extracted verbatim from App.jsx and RoundSummaryModal.jsx in session
// 13-E.2. Pure reorganization — zero logic changes.
//
// ✅ Self-checked (13-E.2): Function body matches both prior copies
//   (App.jsx prior lines 366–375; RoundSummaryModal prior lines 68–79).
//   Initial value uses `typeof window !== 'undefined'` SSR guard from the
//   App.jsx copy; the RoundSummaryModal copy lacked the guard but never
//   ran outside a browser context. Adopting the safer guarded form is
//   strictly equivalent in the browser. Listener cleanup is identical.

import { useState, useEffect } from 'react';

export function useIsLandscape() {
  const [isLandscape, setIsLandscape] = useState(
    () => typeof window !== 'undefined' && window.innerWidth > window.innerHeight
  );
  useEffect(() => {
    const upd = () => setIsLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', upd);
    window.addEventListener('orientationchange', upd);
    return () => {
      window.removeEventListener('resize', upd);
      window.removeEventListener('orientationchange', upd);
    };
  }, []);
  return isLandscape;
}
