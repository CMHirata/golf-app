// ─── pages/HomePage.jsx ───────────────────────────────────────────────────────
//
// ✅ Self-checked: moneyListRange preference loaded from / saved to localStorage
//    key 'moneyListRange'; default YTD; range picker (7 Days, MTD, YTD, All Time,
//    Custom) with native date inputs for Custom; no table headers; place numbers
//    prominent (16px bold green); name column tight to number; settings persist
//    through backup/restore (written by HistoryPage applyImport).

import { useMemo, useState, useCallback } from 'react';
import { ls, SK } from '../services/storage.js';
import { roundLib } from '../services/roundLib.js';
import { Btn, Card, G, RED, fmtDollar } from '../components/ui.jsx';

const ML_KEY = 'moneyListRange';

const RANGE_OPTS = [
  { v: '7days',  l: '7 Days'   },
  { v: 'mtd',    l: 'MTD'      },
  { v: 'ytd',    l: 'YTD'      },
  { v: 'all',    l: 'All Time' },
  { v: 'custom', l: 'Custom'   },
];

function loadRangePref() {
  const saved = ls.get(ML_KEY);
  if (saved && saved.range) return saved;
  return { range: 'ytd', customStart: '', customEnd: '' };
}

function saveRangePref(pref) {
  ls.set(ML_KEY, pref);
}

function rangeLabel(pref) {
  const opt = RANGE_OPTS.find(o => o.v === pref.range);
  if (!opt) return 'YTD';
  if (pref.range === 'custom' && pref.customStart && pref.customEnd) {
    return pref.customStart + ' – ' + pref.customEnd;
  }
  return opt.l;
}

function filterByRange(rounds, pref) {
  const now = new Date();
  if (pref.range === 'all') return rounds;
  if (pref.range === '7days') {
    const cutoff = new Date(now); cutoff.setDate(now.getDate() - 7);
    return rounds.filter(r => new Date(r.date) >= cutoff);
  }
  if (pref.range === 'mtd') {
    return rounds.filter(r => {
      const d = new Date(r.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
  }
  if (pref.range === 'ytd') {
    return rounds.filter(r => new Date(r.date).getFullYear() === now.getFullYear());
  }
  if (pref.range === 'custom' && pref.customStart && pref.customEnd) {
    const s = new Date(pref.customStart);
    const e = new Date(pref.customEnd); e.setHours(23, 59, 59);
    return rounds.filter(r => { const d = new Date(r.date); return d >= s && d <= e; });
  }
  return rounds;
}

// ── SVG icons ─────────────────────────────────────────────────────────────────
const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const IconChevron = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

export default function HomePage({ onNewRound, onResume, onHistory, inProgress }) {
  const rounds  = useMemo(() => roundLib.list(), []);
  const players = useMemo(() => ls.get(SK.players) || [], []);
  const courses = useMemo(() => ls.get(SK.courses) || [], []);

  const [rangePref, setRangePrefState] = useState(() => loadRangePref());
  const [pickerOpen, setPickerOpen] = useState(false);

  const setRangePref = useCallback((pref) => {
    saveRangePref(pref);
    setRangePrefState(pref);
  }, []);

  const rosterNames = useMemo(() => {
    const names = new Set();
    players.forEach(p => names.add(p.name));
    return names;
  }, [players]);

  const excludedNames = useMemo(() => {
    const excluded = new Set();
    players.forEach(p => { if (p.inMoneyLists === false) excluded.add(p.name); });
    return excluded;
  }, [players]);

  const filteredRounds = useMemo(() => filterByRange(rounds, rangePref), [rounds, rangePref]);

  const moneyList = useMemo(() => {
    const totals = {};
    filteredRounds.forEach(r => {
      Object.entries(r.bank || {}).forEach(([name, v]) => {
        if (!rosterNames.has(name)) return;
        if (excludedNames.has(name)) return;
        totals[name] = (totals[name] || 0) + v;
      });
    });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [filteredRounds, rosterNames, excludedNames]);

  const hasData = rounds.length > 0;
  const isCustomActive = rangePref.range === 'custom';

  const handlePickRange = (v) => {
    if (v === 'custom') {
      setRangePref({ ...rangePref, range: 'custom' });
    } else {
      setRangePref({ range: v, customStart: '', customEnd: '' });
      setPickerOpen(false);
    }
  };

  const handleCustomDate = (field, val) => {
    setRangePref({ ...rangePref, range: 'custom', [field]: val });
  };

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
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: pickerOpen ? 8 : 10 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: G, flex: 1 }}>Money List</div>
              <button
                onClick={() => setPickerOpen(o => !o)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: '#f0f7f0', border: '1.5px solid ' + G,
                  borderRadius: 20, padding: '4px 10px',
                  fontSize: 12, fontWeight: 700, color: G,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {rangeLabel(rangePref)}
                <IconChevron />
              </button>
            </div>

            {/* Range picker */}
            {pickerOpen && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: isCustomActive ? 8 : 0 }}>
                  {RANGE_OPTS.map(opt => (
                    <button
                      key={opt.v}
                      onClick={() => handlePickRange(opt.v)}
                      style={{
                        padding: '5px 12px', borderRadius: 20,
                        border: '1.5px solid ' + (rangePref.range === opt.v ? G : '#ddd'),
                        background: rangePref.range === opt.v ? G : '#fff',
                        color: rangePref.range === opt.v ? '#fff' : '#555',
                        fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
                {isCustomActive && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                    <input
                      type="date"
                      value={rangePref.customStart}
                      onChange={e => handleCustomDate('customStart', e.target.value)}
                      style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 13, fontFamily: 'inherit' }}
                    />
                    <span style={{ color: '#999', fontSize: 12, flexShrink: 0 }}>to</span>
                    <input
                      type="date"
                      value={rangePref.customEnd}
                      onChange={e => handleCustomDate('customEnd', e.target.value)}
                      style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 13, fontFamily: 'inherit' }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Money list rows — no headers */}
            {moneyList.length > 0 ? (
              <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%' }}>
                <tbody>
                  {moneyList.map(([name, total], i) => (
                    <tr key={name} style={{ borderTop: i === 0 ? 'none' : '1px solid #f0f0f0' }}>
                      <td style={{ padding: '7px 6px 7px 0', width: 26, verticalAlign: 'middle' }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: G }}>{i + 1}</span>
                      </td>
                      <td style={{ padding: '7px 4px 7px 0', fontWeight: i === 0 ? 700 : 500, color: '#222', verticalAlign: 'middle' }}>
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
            ) : (
              <div style={{ fontSize: 12, color: '#aaa', textAlign: 'center', padding: '10px 0' }}>
                No rounds in this period
              </div>
            )}
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
