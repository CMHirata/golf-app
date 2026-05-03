// ─── services/storage.js ──────────────────────────────────────────────────────
// Shared primitives: localStorage wrapper, storage keys, ID generator.
// Nothing domain-specific lives here — import playerLib, courseLib, or
// roundLib directly for entity operations.

export const SK = {
  players:     'golf_players_v4',
  courses:     'golf_courses_v4',
  rounds:      'golf_rounds_v4',
  autosave:    'golf_auto_v4',
  activeRound: 'golf_active_v4',
  roundSetup:  'golf_round_setup_v4',
  geminiKey:   'golf_gemini_key_v4',
};

export const ls = {
  get: k => {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; }
    catch { return null; }
  },
  set: (k, v) => {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
  },
  del: k => {
    try { localStorage.removeItem(k); } catch {}
  },
};

// Stable prefixed ID: "p_1714000000000_a3f2", "c_...", "r_..."
export function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}
