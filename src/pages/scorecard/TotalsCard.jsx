// ─── scorecard/TotalsCard.jsx ─────────────────────────────────────────────────
// ✅ Self-checked (13-G.2): grossTotal and escTotal now read per-player SI via
// siFor(pi) helper, which prefers players[pi].siArray and falls back to the
// round-shared hcps for legacy reloads. Total math stays identical for all-
// male rounds (siArray === hcps); women's totals now use women's SI for X
// score / ESC cap.
//
// RENDER ONLY — no business logic in this file.
// Displays gross and ESC (Adjusted Gross Score) round totals for all players.
// Receives all data as props; performs no scoring calculations.
//
// ESC = Adjusted Gross Score for GHIN posting (USGA World Handicap System).
// Per-hole cap: par + 2 + hdcpStrokesFromCourseHcp(courseHcp, rank).
// Always shown regardless of the scoring mode used for active games.
//
// 13-C.2: Accepts optional roundStartHole / roundNumHoles. When these are
// non-default, Par and Gross totals reflect only the holes in the round.
// Defaults (0, 18) preserve full 18-hole behavior.
//
// ESC is only shown for full 18-hole rounds. Partial rounds have no well-
// defined ESC value (GHIN requires 9 or 18 holes with specific formulas),
// so rather than display a misleading engine-computed value, we omit ESC
// entirely on partial rounds. Players can compute their own for GHIN posting.

import { escTotal, xGrossScore } from '../../engine/handicap.js';
import { G } from '../../components/ui.jsx';
import { applyDepartureGuardrailToScores } from './scorecardUtils.js';

export function TotalsCard({
  players, pars, scores, courseHcps, hcps,
  roundStartHole = 0, roundNumHoles = 18,
  // 13-C.7.6: Engine departure data guardrail (PartialGameContract §14
  // invariant 21). Filters scores past departureHole before totaling so
  // departed players show their actual played-through total, not a sum
  // that includes any stale post-departure cells.
  earlyDepartureOpts = {},
}) {
  // 13-C.7.6: Apply guardrail before totaling.
  scores = applyDepartureGuardrailToScores(scores, earlyDepartureOpts, players.length);

  // 13-C.2: Build the in-round hole array. For defaults (0, 18) this is [0..17]
  // — identical to the prior ALL18 behavior.
  const rsh = roundStartHole ?? 0;
  const rnh = roundNumHoles  ?? 18;
  const roundHoles = Array.from({ length: rnh }, (_, i) => rsh + i);
  const isFullRound = rsh === 0 && rnh === 18;

  const parTotal   = roundHoles.reduce((s, h) => s + (pars[h] || 0), 0);
  // X scores contribute their computed xGross value (par+2+strokes) — §7.2
  // 13-G.2: xGrossScore reads players[pi].siArray (per-player SI). Fallback
  // to round-shared hcps protects against pre-13-G.2 reloaded rounds where
  // siArray may be absent on activePlayers entries.
  const siFor = pi => (Array.isArray(players[pi]?.siArray) ? players[pi].siArray : hcps);
  const grossTotal = pi => roundHoles.reduce((s, h) => {
    const raw = scores[h]?.[pi];
    if (raw === 'X') return s + xGrossScore(h, courseHcps[pi], siFor(pi), pars);
    return s + (parseInt(raw) || 0);
  }, 0);

  const n = players.length;

  return (
    <div style={{ marginBottom: 14, background: '#fff', borderRadius: 12, border: '1px solid #e0ece0', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px 5px' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: G }}>Round Totals</span>
        <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 8, background: '#e0ece0', color: G }}>Par {parTotal}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)`, gap: 6, padding: '4px 8px 8px' }}>
        {players.map((p, pi) => {
          const gt  = grossTotal(pi);
          // 13-C.2: ESC only shown for full 18-hole rounds. On partial rounds
          // there is no well-defined GHIN-postable ESC; the engine's escTotal
          // iterates all 18 holes which would include stale out-of-round
          // scores on reloaded historical rounds. Rather than show a
          // misleading value, omit ESC entirely and let the player compute
          // their own for GHIN posting.
          const esc = isFullRound ? escTotal(scores, pi, pars, siFor(pi), courseHcps[pi]) : null;
          const hasScores = gt > 0;
          const parts = (p?.name || '').trim().split(/\s+/);
          const first = parts[0] || '?';
          const last  = parts.length >= 2 ? parts[parts.length - 1] : '';
          return (
            <div key={pi} style={{ textAlign: 'center', borderRadius: 8, padding: '6px 4px', background: '#f5fbf5', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: G, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{first}</div>
              {last && <div style={{ fontSize: 10, fontWeight: 400, color: G, opacity: 0.6, lineHeight: 1.2, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{last}</div>}
              {hasScores ? (
                <>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#222', lineHeight: 1.1 }}>{gt}</div>
                  {isFullRound && <div style={{ fontSize: 10, color: '#888' }}>({esc} ESC)</div>}
                </>
              ) : (
                <div style={{ fontSize: 13, color: '#ccc' }}>—</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
