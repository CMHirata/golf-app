// ─── components/RangePicker.jsx ───────────────────────────────────────────────
//
// ✅ Self-checked: added '30days' and '365days' rolling-window branches to
//    filterByRange; RANGE_OPTS expanded to 6 options with word-based labels
//    (Week/Month/Year/YTD/All/Custom); pill grid updated to repeat(6,1fr);
//    existing '7days'/'all' values unchanged so stored prefs remain valid.
//
// Shared by HomePage (Money List) and HistoryPage (round filter).

import { useState, useCallback, useRef, useEffect } from 'react';
import { ls } from '../services/storage.js';
import { G } from '../components/ui.jsx';

// Inject scrollbar-hiding CSS once
if (typeof document !== 'undefined' && !document.getElementById('wheel-picker-style')) {
  const s = document.createElement('style');
  s.id = 'wheel-picker-style';
  s.textContent = '.wheel-scroll::-webkit-scrollbar { display: none; }';
  document.head.appendChild(s);
}

export const ML_KEY = 'moneyListRange';
export const HISTORY_KEY = 'historyRange';

export const RANGE_OPTS = [
  { v: '7days',   l: 'Week'   },
  { v: '30days',  l: 'Month'  },
  { v: '365days', l: 'Year'   },
  { v: 'ytd',     l: 'YTD'    },
  { v: 'all',     l: 'All'    },
  { v: 'custom',  l: 'Custom' },
];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ITEM_H = 36;

// ── Helpers ───────────────────────────────────────────────────────────────────
export function loadRangePref(key = ML_KEY) {
  const saved = ls.get(key);
  if (saved && saved.range) return saved;
  return { range: 'ytd', customStart: null, customEnd: null };
}

export function saveRangePref(pref, key = ML_KEY) { ls.set(key, pref); }

export function rangeLabel(pref) {
  const opt = RANGE_OPTS.find(o => o.v === pref.range);
  if (!opt) return 'YTD';
  if (pref.range === 'custom' && pref.customStart && pref.customEnd) {
    const s = pref.customStart; const e = pref.customEnd;
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
  if (pref.range === '30days') {
    const cutoff = new Date(now); cutoff.setDate(now.getDate() - 30);
    return items.filter(r => new Date(r.date) >= cutoff);
  }
  if (pref.range === '365days') {
    const cutoff = new Date(now); cutoff.setDate(now.getDate() - 365);
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

// ── ScrollWheel — single scrollable column ────────────────────────────────────
function ScrollWheel({ items, selectedIndex, onSelect, width }) {
  const ref = useRef(null);
  const isScrolling = useRef(false);
  const lastIndex = useRef(selectedIndex);

  // Scroll to selected index on mount and when selectedIndex changes externally
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = selectedIndex * ITEM_H;
    el.scrollTop = target;
    lastIndex.current = selectedIndex;
  }, [selectedIndex]);

  const handleScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    clearTimeout(isScrolling.current);
    isScrolling.current = setTimeout(() => {
      const idx = Math.round(el.scrollTop / ITEM_H);
      const clamped = Math.max(0, Math.min(idx, items.length - 1));
      // Snap to nearest
      el.scrollTo({ top: clamped * ITEM_H, behavior: 'smooth' });
      if (clamped !== lastIndex.current) {
        lastIndex.current = clamped;
        onSelect(clamped);
      }
    }, 80);
  }, [items.length, onSelect]);

  return (
    <div style={{ position: 'relative', width: width || 64, flexShrink: 0 }}>
      {/* Selection highlight band — border only, transparent bg so text is fully visible */}
      <div style={{
        position: 'absolute', top: ITEM_H * 2, left: 4, right: 4,
        height: ITEM_H,
        borderTop: '1.5px solid #c8e6c9', borderBottom: '1.5px solid #c8e6c9',
        background: 'rgba(234,243,222,0.5)',
        pointerEvents: 'none', zIndex: 1, borderRadius: 6,
      }} />
      {/* Top fade — stops before selected row */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: ITEM_H * 2 - 4,
        background: 'linear-gradient(to bottom, rgba(255,255,255,1) 40%, rgba(255,255,255,0))',
        pointerEvents: 'none', zIndex: 2,
      }} />
      {/* Bottom fade — stops before selected row */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: ITEM_H * 2 - 4,
        background: 'linear-gradient(to top, rgba(255,255,255,1) 40%, rgba(255,255,255,0))',
        pointerEvents: 'none', zIndex: 2,
      }} />
      {/* Scrollable list */}
      <div
        ref={ref}
        className="wheel-scroll"
        onScroll={handleScroll}
        style={{
          height: ITEM_H * 5,
          overflowY: 'scroll',
          scrollSnapType: 'y mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {/* Top padding items */}
        <div style={{ height: ITEM_H * 2, flexShrink: 0 }} />
        {items.map((item, i) => (
          <div
            key={item}
            onClick={() => {
              ref.current?.scrollTo({ top: i * ITEM_H, behavior: 'smooth' });
              lastIndex.current = i;
              onSelect(i);
            }}
            style={{
              height: ITEM_H,
              scrollSnapAlign: 'center',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13,
              fontWeight: i === selectedIndex ? 700 : 400,
              color: i === selectedIndex ? G : '#555',
              cursor: 'pointer',
              userSelect: 'none',
              position: 'relative', zIndex: 4,
            }}
          >
            {item}
          </div>
        ))}
        {/* Bottom padding items */}
        <div style={{ height: ITEM_H * 2, flexShrink: 0 }} />
      </div>
    </div>
  );
}

// ── WheelDatePicker — three-column iOS-style wheel ────────────────────────────
function WheelDatePicker({ label, value, open, onToggle, onChange }) {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear; y >= currentYear - 10; y--) years.push(String(y));
  years.reverse(); // oldest first so index matches natural order

  const numDays = daysInMonth(value.month, value.year);
  const dayItems  = Array.from({ length: numDays }, (_, i) => String(i + 1));
  const monthItems = MONTHS;
  const yearItems  = years;

  const monthIdx = value.month - 1;
  const dayIdx   = Math.min(value.day - 1, numDays - 1);
  const yearIdx  = yearItems.indexOf(String(value.year));

  const handleMonthSelect = useCallback((idx) => {
    const newMonth = idx + 1;
    const maxDay = daysInMonth(newMonth, value.year);
    onChange({ ...value, month: newMonth, day: Math.min(value.day, maxDay) });
  }, [value, onChange]);

  const handleDaySelect = useCallback((idx) => {
    onChange({ ...value, day: idx + 1 });
  }, [value, onChange]);

  const handleYearSelect = useCallback((idx) => {
    const newYear = parseInt(yearItems[idx]);
    const maxDay = daysInMonth(value.month, newYear);
    onChange({ ...value, year: newYear, day: Math.min(value.day, maxDay) });
  }, [value, onChange, yearItems]);

  const chipLabel = `${MONTHS[value.month - 1]} ${value.day}, ${value.year}`;

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      {/* Chip button */}
      <button onClick={onToggle} style={{
        width: '100%', textAlign: 'left',
        background: '#f0f7f0',
        border: open ? '2px solid ' + G : '1.5px solid ' + G,
        borderRadius: 10, padding: '8px 12px',
        cursor: 'pointer', fontFamily: 'inherit', boxSizing: 'border-box',
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

      {/* Wheel picker */}
      {open && (
        <div style={{
          border: '1.5px solid ' + G, borderRadius: 12,
          marginTop: 6, background: '#fff', overflow: 'hidden',
          padding: '0 8px',
          display: 'flex', justifyContent: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {/* Month */}
            <ScrollWheel
              items={monthItems}
              selectedIndex={monthIdx}
              onSelect={handleMonthSelect}
              width={60}
            />
            {/* Day */}
            <ScrollWheel
              items={dayItems}
              selectedIndex={dayIdx}
              onSelect={handleDaySelect}
              width={36}
            />
            {/* Year */}
            <ScrollWheel
              items={yearItems}
              selectedIndex={yearIdx < 0 ? 0 : yearIdx}
              onSelect={handleYearSelect}
              width={52}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── RangePickerRow ────────────────────────────────────────────────────────────
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, marginBottom: isCustomActive ? 12 : 0 }}>
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
      {/* Custom date wheel pickers — side by side */}
      {isCustomActive && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10 }}>
          <WheelDatePicker
            label="From"
            value={customStart}
            open={openChip === 'start'}
            onToggle={() => setOpenChip(o => o === 'start' ? null : 'start')}
            onChange={handleCustomStartChange}
          />
          <WheelDatePicker
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
