// ─── pages/PayoutDisplay.jsx ──────────────────────────────────────────────────
//
// ✅ Self-checked (13-E.5): Verified DotsColTable renders fmtMoney consistently
// (no fmtCol alias); SubHeader component form used throughout; all game sections
// always render (no zero-net suppression); columnar match branch present;
// RSM visual style for totals + "By game" heading; pre-extraction code preserved
// in consumers as commented blocks for revert.
//
// Shared payout display subsystem — consumed by ResultsPage and RoundSummaryModal.
// Eliminates ~250 lines of parallel implementation.
//
// Exports:
//   PayoutsSection   — top-level component; receives { bank, breakdown, matchPayouts }
//   DotsColTable     — columnar table renderer; receives { entry }
//   SubHeader        — section sub-header with optional decoration line
//   PayRow           — single player payout row
//   splitGameHeader  — splits 'Game Name — decoration' into { name, decoration }
//   fmtMoney         — formats a dollar delta as '+$N.NN' / '-$N.NN' / '$0'
//
// Visual style: RSM (plain-text totals, 'By game' div heading).
// ResultsPage's green-card totals are preserved as a commented block in that
// file for easy revert when ResultsPage gets its visual rework.
//
// Governing contracts:
//   Payout_Contract.md §3.2 — BreakdownEntry shapes (flat + columnar)
//   Payout_Contract.md §7.3 — matchPayouts[] shape + decoration field
//   Payout_Contract.md §7.6 — Sixes columnar shape
//   PartialGameContract.md §11.4 — display vs engine status; decoration rendering

import { RED } from '../components/ui.jsx';
import { cleanGameName } from '../services/roundUtils.js';

// ── fmtMoney ──────────────────────────────────────────────────────────────────
export function fmtMoney(v) {
  return v > 0 ? `+$${Math.abs(v).toFixed(2)}` : v < 0 ? `-$${Math.abs(v).toFixed(2)}` : '$0';
}

// ── splitGameHeader ───────────────────────────────────────────────────────────
// Payout_Contract §7.3 / §7.6: computePayouts appends ' — <decoration>' to the
// game string when a resolution applied. Split here so the decoration renders
// as a styled secondary line beneath the SubHeader.
export function splitGameHeader(gameStr) {
  const idx = (gameStr || '').indexOf(' — ');
  if (idx < 0) return { name: gameStr, decoration: null };
  return { name: gameStr.slice(0, idx), decoration: gameStr.slice(idx + 3) };
}

// ── SubHeader ─────────────────────────────────────────────────────────────────
// Payout_Contract §7.3: optional `decoration` prop renders a styled secondary
// line under the label (e.g. "ended at hole 11, paid Front only",
// "continued (Tom departed)", "drop player (Dave)").
const GAME_ICONS = {
function getGameIcon(label = '') {
  if (label.includes('Match')) return GAME_ICONS.Match;
  if (label.includes('Dots')) return GAME_ICONS.Dots;
  if (label.includes('Sixes')) return GAME_ICONS.Sixes;
  if (label.includes('Nines')) return GAME_ICONS.Nines;
  if (label.includes('Stableford')) return GAME_ICONS.Stableford;
  if (label.includes('Skins')) return GAME_ICONS.Skins;
  if (label.includes('Wolf')) return GAME_ICONS.Wolf;
  if (label.includes('Stroke')) return GAME_ICONS.Stroke;
  return null;
}

export function SubHeader({ children, decoration }) {
  return (
    <div
      style={{
        display:'flex',
        alignItems:'flex-start',
        gap:12,
        marginBottom:14,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          background: '#f3f8f4',
          border: '1px solid #e3eee5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {getGameIcon(children)}
      </div>

      <div style={{ minWidth:0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: '#1d1d1d',
            lineHeight: 1.1,
          }}
        >
          {children}
        </div>

        {decoration && (
          <div
            style={{
              marginTop: 4,
              fontSize: 11,
              color: '#889288',
              lineHeight: 1.35,
            }}
          >
            {decoration}
          </div>
        )}
      </div>
    </div>
  );
}

// ── PayRow ────────────────────────────────────────────────────────────────────
export function PayRow({ name, net }) {
  return (
    <div
      style={{
        display:'flex',
        alignItems:'center',
        justifyContent:'space-between',
        padding:'10px 0',
        borderTop:'1px solid #f1f3f1',
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: '#333',
        }}
      >
        {name}
      </div>

      <div
        style={{
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: net > 0 ? '#1f8f4e' : net < 0 ? RED : '#777',
        }}
      >
        {fmtMoney(net)}
      </div>
    </div>
  );
}

// ── DotsColTable ──────────────────────────────────────────────────────────────
// Payout_Contract §3.2: renders the columnar breakdown shape — used for Match
// (F/B/O/Total), Sixes (Front6/Middle6/Last6/Total), Stableford/Nines segments,
// and Team Dots. Detected by presence of entry.colHeaders on the breakdown entry.
// Last column is always the per-row total (right-aligned, bold, larger font).
export function DotsColTable({ entry }) {
  if (!entry?.colHeaders?.length || !entry?.rows?.length) return null;

  const headers = entry.colHeaders;
  const rows = entry.rows;

  const colClr = v =>
    v > 0 ? '#1f8f4e' : v < 0 ? RED : '#777';

  const isTot = i => i === headers.length - 1;

  return (
    <div
      style={{
        borderRadius: 14,
        overflow: 'hidden',
        border: '1px solid #edf2ed',
      }}
    >
      <table
        style={{
          width:'100%',
          border

// ── PayoutsSection ────────────────────────────────────────────────────────────
// Top-level payout display. RSM visual style throughout:
//   - Plain-text overall totals (small, left-aligned)
//   - 'By game' div heading
//   - All game sections always rendered (no zero-net suppression)
//   - 'Tie — no payout' when all rows net to zero
//   - Empty-state guard when bank is absent
//
// Props:
//   bank         { [playerName]: number }   — net dollar per player, all games
//   breakdown    BreakdownEntry[]           — per-game result rows
//   matchPayouts MatchPayoutEntry[]         — per-match columnar entries
export function PayoutsSection({ bank, breakdown, matchPayouts }) {
  if (!bank || !Object.keys(bank).length) {
    return (
      <div style={{ fontSize:12, color:'#aaa', padding:'8px 0', textAlign:'center' }}>
        No payout data available.
      </div>
    );
  }

  const sorted = Object.entries(bank).sort((a, b) => b[1] - a[1]);

  // Payout_Contract §7.3 + §3.2: filter breakdown[] entries whose game field
  // starts with '🥊 Match ' — these are per-match columnar entries emitted by
  // computePayouts under Option A. matchPayouts[] renders them separately above,
  // so filtering here prevents double-render. Legacy '🥊 Match / Nassau' flat
  // entry also filtered for backward-compat with older history records.
  const otherEntries = (breakdown || []).filter(e =>
    e.game !== '🥊 Match / Nassau' &&
    e.game !== 'Match / Nassau' &&
    !String(e.game || '').startsWith('🥊 Match ')
  );

  return (
    <>
      {/* Overall totals — RSM plain-text style */}
      <div style={{ fontSize:10, fontWeight:700, color:'#888', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.5px' }}>Total — All Games</div>
      {sorted.map(([name, v], i) => (
        <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:13,
          padding:'5px 0', borderBottom:'1px solid #f0f8f0' }}>
          <span style={{ fontWeight:500 }}>{name}</span>
          <span style={{ fontWeight:700, color: v>0?'#27ae60':v<0?RED:'#888' }}>{fmtMoney(v)}</span>
        </div>
      ))}

      <div style={{ marginTop:12 }}>
        <div style={{ fontSize:10, fontWeight:700, color:'#888', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.5px' }}>By Game</div>

        {/* Per-match payouts — Payout_Contract §7.3 */}
        {(matchPayouts || []).map((match, mi) => {
          // Payout_Contract §7.3: decoration field rendered as italic secondary
          // line when present (end_at_k / continue / exclude_player outcome).
          // Columnar matches (colHeaders present): render via DotsColTable.
          // Legacy flat matches (no colHeaders): render flat PayRow list.
          if (match.colHeaders) {
            return (
              <div key={`match_${mi}`} style={{ marginBottom:10 }}>
                <SubHeader decoration={match.decoration}>{match.label}</SubHeader>
                <DotsColTable entry={match}/>
              </div>
            );
          }
          const nonZero = (match.rows || []).filter(r => r.net !== 0);
          return (
            <div key={`match_${mi}`} style={{ marginBottom:10 }}>
              <SubHeader decoration={match.decoration}>{match.label}</SubHeader>
              {nonZero.length === 0
                ? <div style={{ fontSize:10, color:'#999', padding:'2px 0' }}>Tie — no payout</div>
                : nonZero.map((r, i) => <PayRow key={i} name={r.name} net={r.net}/>)
              }
            </div>
          );
        })}

        {/* Other games (Skins, Sixes, Stableford, Nines, Dots, Stroke Play) */}
        {otherEntries.map((entry, ei) => {
          const { name: gameName, decoration } = splitGameHeader(cleanGameName(entry.game));
          // Columnar shape: always render table; do not suppress on zero-net rows.
          if (entry.colHeaders) {
            return (
              <div key={`game_${ei}`} style={{ marginBottom:10 }}>
                <SubHeader decoration={decoration}>{gameName}</SubHeader>
                <DotsColTable entry={entry}/>
              </div>
            );
          }
          // Flat shape: filter to non-zero rows for the payout list, but always
          // render the section header so the user knows the game ran.
          const rows = (entry.rows || []).filter(r => r.net != null && r.net !== 0);
          return (
            <div key={`game_${ei}`} style={{ marginBottom:10 }}>
              <SubHeader decoration={decoration}>{gameName}</SubHeader>
              {rows.length === 0
                ? <div style={{ fontSize:10, color:'#999', padding:'2px 0' }}>Tie — no payout</div>
                : rows.map((r, i) => <PayRow key={i} name={r.name} net={r.net}/>)
              }
            </div>
          );
        })}
      </div>
    </>
  );
}
