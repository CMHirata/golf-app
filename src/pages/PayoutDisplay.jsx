// ─── pages/PayoutDisplay.jsx ──────────────────────────────────────────────────
//
// ✅ Self-checked (15-C): Visual refresh — each game section rendered in a
// card with border/shadow. Cleaner typography, tighter spacing. No data or
// structure changes. All exports and component signatures unchanged.
//
// ✅ Self-checked (13-E.5): Verified DotsColTable renders fmtMoney consistently
// (no fmtCol alias); SubHeader component form used throughout; all game sections
// always render (no zero-net suppression); columnar match branch present;
// RSM visual style for totals + "By game" heading; pre-extraction code preserved
// in consumers as commented blocks for revert.
//
// Shared payout display subsystem — consumed by ResultsPage and RoundSummaryModal.
//
// Exports:
//   PayoutsSection   — top-level component; receives { bank, breakdown, matchPayouts }
//   DotsColTable     — columnar table renderer; receives { entry }
//   SubHeader        — section sub-header with optional decoration line
//   PayRow           — single player payout row
//   splitGameHeader  — splits 'Game Name — decoration' into { name, decoration }
//   fmtMoney         — formats a dollar delta as '+$N.NN' / '-$N.NN' / '$0'

import { RED } from '../components/ui.jsx';
import { cleanGameName } from '../services/roundUtils.js';

const G = '#1a472a';

// ── fmtMoney ──────────────────────────────────────────────────────────────────
export function fmtMoney(v) {
  return v > 0 ? `+$${Math.abs(v).toFixed(2)}` : v < 0 ? `-$${Math.abs(v).toFixed(2)}` : '$0';
}

// ── splitGameHeader ───────────────────────────────────────────────────────────
export function splitGameHeader(gameStr) {
  const idx = (gameStr || '').indexOf(' — ');
  if (idx < 0) return { name: gameStr, decoration: null };
  return { name: gameStr.slice(0, idx), decoration: gameStr.slice(idx + 3) };
}

// ── SubHeader ─────────────────────────────────────────────────────────────────
export function SubHeader({ children, decoration }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#444', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{children}</div>
      {decoration && (
        <div style={{ fontSize: 9, fontStyle: 'italic', color: '#999', marginTop: 1 }}>
          {decoration}
        </div>
      )}
    </div>
  );
}

// ── PayRow ────────────────────────────────────────────────────────────────────
export function PayRow({ name, net }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12,
      padding: '5px 0', borderBottom: '1px solid #f4f4f4' }}>
      <span style={{ color: '#555' }}>{name}</span>
      <span style={{ fontWeight: 700, color: net > 0 ? '#27ae60' : net < 0 ? RED : '#888' }}>{fmtMoney(net)}</span>
    </div>
  );
}

// ── DotsColTable ──────────────────────────────────────────────────────────────
export function DotsColTable({ entry }) {
  if (!entry?.colHeaders?.length || !entry?.rows?.length) return null;
  const headers = entry.colHeaders;
  const rows    = entry.rows;
  const colClr  = v => v > 0 ? '#27ae60' : v < 0 ? RED : '#888';
  const isTot   = (i) => i === headers.length - 1;
  const COL_W   = 52;
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11,
                    marginTop: 2, tableLayout: 'fixed' }}>
      <colgroup>
        <col/>
        {headers.map((_, i) => <col key={i} style={{ width: COL_W }}/>)}
      </colgroup>
      <thead>
        <tr>
          <td style={{ padding: '2px 0', color: '#aaa', fontSize: 10 }}></td>
          {headers.map((h, i) => (
            <td key={i} style={{ padding: '2px 4px',
                                  textAlign: isTot(i) ? 'right' : 'center',
                                  color: '#aaa',
                                  fontSize: 10, fontWeight: isTot(i) ? 700 : 500,
                                  borderBottom: '1px solid #f0f0f0',
                                  whiteSpace: 'nowrap' }}>
              {h}
            </td>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri} style={{ borderBottom: '1px solid #f8f8f8' }}>
            <td style={{ padding: '3px 0', color: '#555', fontSize: 11,
                         overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.name}
            </td>
            {(r.matchCols || []).map((v, ci) => (
              <td key={ci} style={{ padding: '3px 4px',
                                     textAlign: isTot(ci) ? 'right' : 'center',
                                     fontWeight: isTot(ci) ? 700 : 600,
                                     color: colClr(v), fontSize: isTot(ci) ? 12 : 11,
                                     whiteSpace: 'nowrap' }}>
                {fmtMoney(v)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── GameCard ──────────────────────────────────────────────────────────────────
// Card wrapper for each game section.
function GameCard({ children }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      padding: '12px 14px',
      marginBottom: 10,
      boxShadow: '0 1px 4px rgba(0,0,0,.07)',
      border: '1.5px solid #e8f0e8',
    }}>
      {children}
    </div>
  );
}

// ── PayoutsSection ────────────────────────────────────────────────────────────
export function PayoutsSection({ bank, breakdown, matchPayouts }) {
  if (!bank || !Object.keys(bank).length) {
    return (
      <div style={{ fontSize: 12, color: '#aaa', padding: '8px 0', textAlign: 'center' }}>
        No payout data available.
      </div>
    );
  }

  // Payout_Contract §7.3 + §3.2: filter per-match columnar entries from
  // breakdown[] — matchPayouts[] renders them separately above.
  const otherEntries = (breakdown || []).filter(e =>
    e.game !== '🥊 Match / Nassau' &&
    e.game !== 'Match / Nassau' &&
    !String(e.game || '').startsWith('🥊 Match ')
  );

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>By Game</div>

      {/* Per-match payouts */}
      {(matchPayouts || []).map((match, mi) => {
        if (match.colHeaders) {
          return (
            <GameCard key={`match_${mi}`}>
              <SubHeader decoration={match.decoration}>{match.label}</SubHeader>
              <DotsColTable entry={match}/>
            </GameCard>
          );
        }
        const nonZero = (match.rows || []).filter(r => r.net !== 0);
        return (
          <GameCard key={`match_${mi}`}>
            <SubHeader decoration={match.decoration}>{match.label}</SubHeader>
            {nonZero.length === 0
              ? <div style={{ fontSize: 11, color: '#999', padding: '2px 0' }}>Tie — no payout</div>
              : nonZero.map((r, i) => <PayRow key={i} name={r.name} net={r.net}/>)
            }
          </GameCard>
        );
      })}

      {/* Other games */}
      {otherEntries.map((entry, ei) => {
        const { name: gameName, decoration } = splitGameHeader(cleanGameName(entry.game));
        if (entry.colHeaders) {
          return (
            <GameCard key={`game_${ei}`}>
              <SubHeader decoration={decoration}>{gameName}</SubHeader>
              <DotsColTable entry={entry}/>
            </GameCard>
          );
        }
        const rows = (entry.rows || []).filter(r => r.net != null && r.net !== 0);
        return (
          <GameCard key={`game_${ei}`}>
            <SubHeader decoration={decoration}>{gameName}</SubHeader>
            {rows.length === 0
              ? <div style={{ fontSize: 11, color: '#999', padding: '2px 0' }}>Tie — no payout</div>
              : rows.map((r, i) => <PayRow key={i} name={r.name} net={r.net}/>)
            }
          </GameCard>
        );
      })}
    </div>
  );
}
