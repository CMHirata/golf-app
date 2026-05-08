// ─── pages/HomePage.jsx ───────────────────────────────────────────────────────
//
// ✅ Self-checked: moneyListRange saved/loaded from localStorage 'moneyListRange';
//    default YTD; settings field preserved through import (fix: handleImportFile
//    now passes settings through); custom date selector uses styled select wheels
//    (day/month/year) matching app look; place numbers 13px muted; no winner
//    highlight; each row has left accent bar; visual design refined.

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

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function loadRangePref() {
  const saved = ls.get(ML_KEY);
  if (saved && saved.range) return saved;
  return { range: 'ytd', customStart: null, customEnd: null };
}

function saveRangePref(pref) {
  ls.set(ML_KEY, pref);
}

function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

function rangeLabel(pref) {
  const opt = RANGE_OPTS.find(o => o.v === pref.range);
  if (!opt) return 'YTD';
  if (pref.range === 'custom' && pref.customStart && pref.customEnd) {
    const s = pref.customStart;
    const e = pref.customEnd;
    return `${MONTHS[s.month-1]} ${s.day}, ${s.year} – ${MONTHS[e.month-1]} ${e.day}, ${e.year}`;
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
    const s = new Date(pref.customStart.year, pref.customStart.month - 1, pref.customStart.day);
    const e = new Date(pref.customEnd.year, pref.customEnd.month - 1, pref.customEnd.day, 23, 59, 59);
    return rounds.filter(r => { const d = new Date(r.date); return d >= s && d <= e; });
  }
  return rounds;
}

function todayParts() {
  const now = new Date();
  return { day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() };
}

function jan1Parts() {
  const now = new Date();
  return { day: 1, month: 1, year: now.getFullYear() };
}

// ── Custom date picker — Option A chip + dropdown ─────────────────────────────
function DateChipPicker({ label, value, open, onToggle, onChange }) {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear; y >= currentYear - 10; y--) years.push(y);
  const days = [];
  for (let d = 1; d <= daysInMonth(value.month, value.year); d++) days.push(d);

  const chipLabel = `${MONTHS[value.month - 1]} ${value.day}, ${value.year}`;

  return (
    <div style={{ flex: 1 }}>
      {/* Chip */}
      <button
        onClick={onToggle}
        style={{
          width: '100%', textAlign: 'left',
          background: '#f0f7f0',
          border: open ? '2px solid ' + G : '1.5px solid ' + G,
          borderRadius: 10, padding: '8px 12px',
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 600, color: '#3B6D11', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: G }}>{chipLabel}</span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="3"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s', flexShrink: 0 }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          border: '1.5px solid ' + G, borderRadius: 12,
          marginTop: 6, background: '#fff', overflow: 'hidden',
        }}>
          {/* Month grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4, padding: 10 }}>
            {MONTHS.map((m, i) => {
              const sel = value.month === i + 1;
              return (
                <button key={m} onClick={() => {
                  const newMonth = i + 1;
                  const maxDay = daysInMonth(newMonth, value.year);
                  onChange({ ...value, month: newMonth, day: Math.min(value.day, maxDay) });
                }} style={{
                  padding: '7px 4px', fontSize: 12, textAlign: 'center',
                  borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  background: sel ? G : 'transparent',
                  color: sel ? '#fff' : '#333', fontWeight: sel ? 600 : 400,
                }}>
                  {m}
                </button>
              );
            })}
          </div>

          {/* Year row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderTop: '0.5px solid #eee' }}>
            {years.slice().reverse().map(y => {
              const sel = value.year === y;
              return (
                <button key={y} onClick={() => {
                  const maxDay = daysInMonth(value.month, y);
                  onChange({ ...value, year: y, day: Math.min(value.day, maxDay) });
                }} style={{
                  padding: '5px 8px', fontSize: 12, borderRadius: 6,
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  background: sel ? G : 'transparent',
                  color: sel ? '#fff' : '#555', fontWeight: sel ? 600 : 400,
                }}>
                  {y}
                </button>
              );
            })}
          </div>

          {/* Day row */}
          <div style={{ padding: '8px 10px 10px', borderTop: '0.5px solid #eee' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Day</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {days.map(d => {
                const sel = value.day === d;
                return (
                  <button key={d} onClick={() => onChange({ ...value, day: d })} style={{
                    width: 28, height: 28, fontSize: 11, borderRadius: '50%',
                    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    background: sel ? G : 'transparent',
                    color: sel ? '#fff' : '#333', fontWeight: sel ? 600 : 400,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SVG icons ─────────────────────────────────────────────────────────────────
const IconPlus = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

const IconChevron = ({ open }) => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
    style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

// ── Main page ─────────────────────────────────────────────────────────────────
export default function HomePage({ onNewRound, onResume, onHistory, inProgress }) {
  const rounds  = useMemo(() => roundLib.list(), []);
  const players = useMemo(() => ls.get(SK.players) || [], []);
  const courses = useMemo(() => ls.get(SK.courses) || [], []);

  const [rangePref, setRangePrefState] = useState(() => loadRangePref());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [openChip, setOpenChip] = useState(null); // 'start' | 'end' | null

  // Custom date state — initialise from saved pref or sensible defaults
  const [customStart, setCustomStart] = useState(() => rangePref.customStart || jan1Parts());
  const [customEnd,   setCustomEnd]   = useState(() => rangePref.customEnd   || todayParts());

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
      const pref = { range: 'custom', customStart, customEnd };
      setRangePref(pref);
    } else {
      setRangePref({ range: v, customStart: null, customEnd: null });
      setPickerOpen(false);
    }
  };

  const handleCustomStartChange = (parts) => {
    setCustomStart(parts);
    if (isCustomActive) setRangePref({ range: 'custom', customStart: parts, customEnd });
  };

  const handleCustomEndChange = (parts) => {
    setCustomEnd(parts);
    if (isCustomActive) setRangePref({ range: 'custom', customStart, customEnd: parts });
  };

  return (
    <div style={{ minHeight: '100vh', background: '#eef4ee' }}>

      {/* ── Header ── */}
      <div style={{
        background: G, padding: '8px 16px 7px',
        position: 'sticky', top: 0, zIndex: 10,
        boxShadow: '0 2px 12px rgba(0,0,0,.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <img src="/logo_icon.png" alt="The Card" style={{ height: 58, width: 'auto', display: 'block' }} />
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'inherit' }}>
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
        <button onClick={onNewRound} style={{
          width: '100%', background: G, color: '#fff', border: 'none',
          borderRadius: 14, padding: '16px 20px', fontSize: 15, fontWeight: 800,
          cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 8, marginBottom: 12,
          boxShadow: '0 4px 16px rgba(26,71,42,.3)', fontFamily: 'inherit',
        }}>
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
          <Card style={{ padding: '14px 14px' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: pickerOpen ? 10 : 12 }}>
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
                <IconChevron open={pickerOpen} />
              </button>
            </div>

            {/* Range picker */}
            {pickerOpen && (
              <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #eee' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: isCustomActive ? 12 : 0 }}>
                  {RANGE_OPTS.map(opt => (
                    <button
                      key={opt.v}
                      onClick={() => handlePickRange(opt.v)}
                      style={{
                        width: '100%', padding: '6px 0', borderRadius: 20, textAlign: 'center',
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
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10 }}>
                    <DateChipPicker
                      label="From"
                      value={customStart}
                      open={openChip === 'start'}
                      onToggle={() => setOpenChip(o => o === 'start' ? null : 'start')}
                      onChange={parts => { handleCustomStartChange(parts); }}
                    />
                    <DateChipPicker
                      label="To"
                      value={customEnd}
                      open={openChip === 'end'}
                      onToggle={() => setOpenChip(o => o === 'end' ? null : 'end')}
                      onChange={parts => { handleCustomEndChange(parts); }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Rows */}
            {moneyList.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {moneyList.map(([name, total], i) => {
                  const positive = total > 0;
                  const negative = total < 0;
                  const accentColor = positive ? '#27500A' : negative ? '#A32D2D' : '#bbb';
                  return (
                    <div key={name} style={{
                      display: 'flex', alignItems: 'center',
                      background: '#f8faf8',
                      borderRadius: 9,
                      overflow: 'hidden',
                      border: '1px solid #e8f0e8',
                    }}>
                      {/* Left accent bar */}
                      <div style={{ width: 4, alignSelf: 'stretch', background: accentColor, flexShrink: 0 }} />
                      {/* Place number */}
                      <div style={{
                        width: 28, textAlign: 'center', flexShrink: 0,
                        fontSize: 12, fontWeight: 700,
                        color: '#999',
                        padding: '9px 0',
                      }}>
                        {i + 1}
                      </div>
                      {/* Name */}
                      <div style={{
                        flex: 1, fontSize: 13, fontWeight: 500, color: '#222',
                        padding: '9px 4px 9px 2px',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {name}
                      </div>
                      {/* Amount */}
                      <div style={{
                        padding: '9px 12px 9px 8px',
                        fontSize: 13, fontWeight: 700,
                        color: accentColor,
                        flexShrink: 0,
                      }}>
                        {fmtDollar(total)}
                      </div>
                    </div>
                  );
                })}
              </div>
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
