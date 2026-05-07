// ─── pages/HomePage.jsx ───────────────────────────────────────────────────────
//
// ✅ Self-checked: Money List filters by p.inMoneyLists ?? true (absent = included);
//    player name lookup falls back gracefully when a name in bank has no matching
//    library record (treats as included); fmtDollar used for consistent formatting;
//    YTD leader widget and Recent Rounds card removed per 15-E scope.

import { useMemo } from 'react';
import { ls, SK } from '../services/storage.js';
import { roundLib } from '../services/roundLib.js';
import { Btn, Card, G, GA, RED, fmtDollar } from '../components/ui.jsx';

// ── SVG icons ─────────────────────────────────────────────────────────────────
const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const IconTrophy = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="8 21 12 17 16 21"/>
    <line x1="12" y1="17" x2="12" y2="11"/>
    <path d="M7 4H4a2 2 0 0 0-2 2v1a5 5 0 0 0 5 5h1"/>
    <path d="M17 4h3a2 2 0 0 1 2 2v1a5 5 0 0 1-5 5h-1"/>
    <rect x="7" y="2" width="10" height="9" rx="1"/>
  </svg>
);

export default function HomePage({ onNewRound, onResume, onHistory, inProgress }) {
  const rounds  = useMemo(() => roundLib.list(), []);
  const players = useMemo(() => ls.get(SK.players) || [], []);
  const courses = useMemo(() => ls.get(SK.courses) || [], []);

  // Build a set of player names excluded from Money List
  const excludedNames = useMemo(() => {
    const excluded = new Set();
    players.forEach(p => {
      if (p.inMoneyLists === false) excluded.add(p.name);
    });
    return excluded;
  }, [players]);

  // Cumulative winnings across all rounds, filtered by inMoneyLists
  const moneyList = useMemo(() => {
    const totals = {};
    rounds.forEach(r => {
      Object.entries(r.bank || {}).forEach(([name, v]) => {
        if (excludedNames.has(name)) return;
        totals[name] = (totals[name] || 0) + v;
      });
    });
    return Object.entries(totals)
      .sort((a, b) => b[1] - a[1]);
  }, [rounds, excludedNames]);

  const hasData = rounds.length > 0 && moneyList.length > 0;

  return (
    <div style={{ minHeight: '100vh', background: '#eef4ee' }}>

      {/* ── Header ── */}
      <div style={{
        background: G,
        padding: '8px 16px 7px',
        position: 'sticky', top: 0, zIndex: 10,
        boxShadow: '0 2px 12px rgba(0,0,0,.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <img src="/logo_icon.png" alt="The Card" style={{ height: 58, width: 'auto', display: 'block' }} />
        <div style={{
          color: '#fff', fontWeight: 800, fontSize: 16,
          letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'inherit',
        }}>
          The Card
        </div>
      </div>

      <div style={{ padding: '14px 14px', maxWidth: 520, margin: '0 auto' }}>

        {/* ── Resume in-progress round ── */}
        {inProgress && (
          <div style={{
            background: '#fff8e1', border: '1.5px solid #f0c040',
            borderRadius: 14, padding: '12px 14px', marginBottom: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#b7770d' }}>Round in Progress</div>
              <div style={{ fontSize: 11, color: '#b7770d', opacity: 0.8 }}>Tap to continue scoring</div>
            </div>
            <Btn onClick={onResume} style={{ background: '#e67e22', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 700 }}>
              Resume →
            </Btn>
          </div>
        )}

        {/* ── New Round CTA ── */}
        <button
          onClick={onNewRound}
          style={{
            width: '100%', background: G, color: '#fff', border: 'none',
            borderRadius: 14, padding: '16px 20px', fontSize: 15, fontWeight: 800,
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 8, marginBottom: 12,
            boxShadow: '0 4px 16px rgba(26,71,42,.3)', fontFamily: 'inherit',
          }}
        >
          <IconPlus />
          New Round
        </button>

        {/* ── Quick stats ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          {[
            { label: 'Rounds',  value: rounds.length  },
            { label: 'Players', value: players.length },
            { label: 'Courses', value: courses.length },
          ].map(s => (
            <div key={s.label} style={{
              background: '#fff', borderRadius: 12, padding: '12px 8px',
              textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,.06)',
            }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: G, lineHeight: 1.1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Money List ── */}
        {hasData && (
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <IconTrophy />
              <div style={{ fontWeight: 700, fontSize: 14, color: G, flex: 1 }}>Money List</div>
              <div style={{ fontSize: 11, color: '#aaa' }}>{rounds.length} round{rounds.length !== 1 ? 's' : ''}</div>
            </div>
            <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '4px 8px 6px 0', color: '#999', fontSize: 11, fontWeight: 600 }}>#</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px 6px', color: '#999', fontSize: 11, fontWeight: 600 }}>Player</th>
                  <th style={{ textAlign: 'right', padding: '4px 0 6px 8px', color: '#999', fontSize: 11, fontWeight: 600 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {moneyList.map(([name, total], i) => (
                  <tr key={name} style={{ borderTop: i === 0 ? 'none' : '1px solid #f0f0f0' }}>
                    <td style={{ padding: '7px 8px 7px 0', color: i === 0 ? '#f59e0b' : '#bbb', fontWeight: 700, fontSize: i === 0 ? 14 : 12, verticalAlign: 'middle' }}>
                      {i === 0 ? '★' : i + 1}
                    </td>
                    <td style={{ padding: '7px 8px', fontWeight: i === 0 ? 700 : 500, color: '#222', verticalAlign: 'middle' }}>
                      {name}
                    </td>
                    <td style={{ padding: '7px 0 7px 8px', textAlign: 'right', fontWeight: 700, verticalAlign: 'middle',
                      color: total > 0 ? '#27ae60' : total < 0 ? RED : '#888' }}>
                      {fmtDollar(total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {/* ── Empty state ── */}
        {rounds.length === 0 && players.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: '#aaa' }}>
            <img src="/logo_icon.png" alt="" style={{ height: 64, width: 'auto', marginBottom: 16, opacity: 0.5 }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: '#888', marginBottom: 6 }}>Welcome to The Card</div>
            <div style={{ fontSize: 13 }}>Add players and courses, then start your first round.</div>
          </div>
        )}

      </div>
    </div>
  );
}
