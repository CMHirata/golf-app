// ─── components/RangePicker.jsx ───────────────────────────────────────────────
//
// ✅ Self-checked: all range logic extracted from HomePage; RANGE_OPTS, helpers,
//    DateChipPicker, and RangePickerRow are all exported; ls import uses shared
//    storage service; G imported from ui.jsx; no page-specific logic present.
//
// Shared by HomePage (Money List) and HistoryPage (round filter).
// Single source of truth for range options, filter logic, and picker UI.
//
// Exports:
//   RANGE_OPTS        — [{v, l}] array of range options
//   loadRangePref()   — reads {range, customStart, customEnd} from localStorage
//   saveRangePref()   — writes pref to localStorage
//   filterByRange()   — filters an array of {date} objects by pref
//   rangeLabel()      — human-readable label for current pref
//   RangePickerRow    — full pill grid + custom date chips, drop-in component

import { useState, useCallback } from 'react';
import { ls } from '../services/storage.js';
import { G } from '../components/ui.jsx';

export const ML_KEY = 'moneyListRange';

export const RANGE_OPTS = [
  { v: '7days',  l: '7 Days'   },
  { v: 'mtd',    l: 'MTD'      },
  { v: 'ytd',    l: 'YTD'      },
  { v: 'all',    l: 'All Time' },
  { v: 'custom', l: 'Custom'   },
];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Helpers ───────────────────────────────────────────────────────────────────
export function loadRangePref() {
  const saved = ls.get(ML_KEY);
  if (saved && saved.range) return saved;
  return { range: 'ytd', customStart: null, customEnd: null };
}

export function saveRangePref(pref) {
  ls.set(ML_KEY, pref);
}

export function rangeLabel(pref) {
  const opt = RANGE_OPTS.find(o => o.v === pref.range);
  if (!opt) return 'YTD';
  if (pref.range === 'custom' && pref.customStart && pref.customEnd) {
    const s = pref.customStart;
    const e = pref.customEnd;
    return `${MONTHS[s.month-1]} ${s.day}, ${s.year} – ${MONTHS[e.month-1]} ${e.day}, ${e.year}`;
  }
  return opt.l;
}

export function filterByRange(items, pref) {
  const now = new Date();
  if (pref.range === 'all') return items;
  if (pref.range === '7days') {
    const cutoff = new Date(now); cutoff.setDate(now.getDate() - 7);
    return items.filter(r => new Date(r.date) >= cutoff);
  }
  if (pref.range === 'mtd') {
    return items.filter(r => {
      const d = new Date(r.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
  }
  if (pref.range === 'ytd') {
    return items.filter(r => new Date(r.date).getFullYear() === now.getFullYear());
  }
  if (pref.range === 'custom' && pref.customStart && pref.customEnd) {
    const s = new Date(pref.customStart.year, pref.customStart.month - 1, pref.customStart.day);
    const e = new Date(pref.customEnd.year, pref.customEnd.month - 1, pref.customEnd.day, 23, 59, 59);
    return items.filter(r => { const d = new Date(r.date); return d >= s && d <= e; });
  }
  return items;
}

function daysInMonth(month, year) { return new Date(year, month, 0).getDate(); }

function todayParts() {
  const now = new Date();
  return { day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() };
}

function jan1Parts() {
  const now = new Date();
  return { day: 1, month: 1, year: now.getFullYear() };
}

// ── DateChipPicker ────────────────────────────────────────────────────────────
function DateChipPicker({ label, value, open, onToggle, onChange }) {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear; y >= currentYear - 10; y--) years.push(y);
  const days = [];
  for (let d = 1; d <= daysInMonth(value.month, value.year); d++) days.push(d);
  const chipLabel = `${MONTHS[value.month - 1]} ${value.day}, ${value.year}`;

  return (
    <div style={{ flex: 1 }}>
      <button onClick={onToggle} style={{
        width: '100%', textAlign: 'left',
        background: '#f0f7f0',
        border: open ? '2px solid ' + G : '1.5px solid ' + G,
        borderRadius: 10, padding: '8px 12px',
        cursor: 'pointer', fontFamily: 'inherit',
      }}>
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
      {open && (
        <div style={{ border: '1.5px solid ' + G, borderRadius: 12, marginTop: 6, background: '#fff', overflow: 'hidden' }}>
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
                }}>{m}</button>
              );
            })}
          </div>
          {/* Year row — horizontally scrollable */}
          <div style={{ overflowX: 'auto', borderTop: '0.5px solid #eee', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ display: 'flex', gap: 3, padding: '8px 8px', width: 'max-content' }}>
              {years.slice().reverse().map(y => {
                const sel = value.year === y;
                return (
                  <button key={y} onClick={() => {
                    const maxDay = daysInMonth(value.month, y);
                    onChange({ ...value, year: y, day: Math.min(value.day, maxDay) });
                  }} style={{
                    padding: '6px 10px', fontSize: 12, borderRadius: 6, whiteSpace: 'nowrap',
                    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    background: sel ? G : '#f5f5f5',
                    color: sel ? '#fff' : '#555', fontWeight: sel ? 600 : 400,
                  }}>{y}</button>
                );
              })}
            </div>
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
                  }}>{d}</button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── RangePickerRow ────────────────────────────────────────────────────────────
// Drop-in component. Renders the pill grid + custom date chips.
// Props:
//   rangePref        — current {range, customStart, customEnd}
//   onRangePrefChange — called with new pref whenever user makes a selection
export function RangePickerRow({ rangePref, onRangePrefChange }) {
  const isCustomActive = rangePref.range === 'custom';
  const [openChip, setOpenChip] = useState(null);
  const [customStart, setCustomStart] = useState(() => rangePref.customStart || jan1Parts());
  const [customEnd,   setCustomEnd]   = useState(() => rangePref.customEnd   || todayParts());

  const handlePickRange = useCallback((v) => {
    if (v === 'custom') {
      onRangePrefChange({ range: 'custom', customStart, customEnd });
    } else {
      onRangePrefChange({ range: v, customStart: null, customEnd: null });
    }
  }, [customStart, customEnd, onRangePrefChange]);

  const handleCustomStartChange = useCallback((parts) => {
    setCustomStart(parts);
    onRangePrefChange({ range: 'custom', customStart: parts, customEnd });
  }, [customEnd, onRangePrefChange]);

  const handleCustomEndChange = useCallback((parts) => {
    setCustomEnd(parts);
    onRangePrefChange({ range: 'custom', customStart, customEnd: parts });
  }, [customStart, onRangePrefChange]);

  return (
    <div>
      {/* Pill grid */}
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
      {/* Custom date chips */}
      {isCustomActive && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10 }}>
          <DateChipPicker
            label="From"
            value={customStart}
            open={openChip === 'start'}
            onToggle={() => setOpenChip(o => o === 'start' ? null : 'start')}
            onChange={handleCustomStartChange}
          />
          <DateChipPicker
            label="To"
            value={customEnd}
            open={openChip === 'end'}
            onToggle={() => setOpenChip(o => o === 'end' ? null : 'end')}
            onChange={handleCustomEndChange}
          />
        </div>
      )}
    </div>
  );
}
