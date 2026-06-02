// ─── pages/HomePage.jsx ───────────────────────────────────────────────────────
//
// ✅ Self-checked: H-13 — starred/inMoneyLists enriched from playerLib by name.
//    H-46 — no overflow:hidden on any ancestor of PlayerAvatar; slide clip uses
//    clipPath only. H-29 — filterByRange applied before all stats/streaks.
//    H-30 — ML_KEY ('moneyListRange') only. No emoji in rendered UI.
//    Stat tiles match mockup icon set (flag/people/pin/dollar).
//    Podium pennant ribbons as SVG. Ranked list starts at 4.
//    Basic/Enhanced toggle persisted to localStorage.

import { useMemo, useState, useCallback } from 'react';
import { ls, SK } from '../services/storage.js';
import { roundLib } from '../services/roundLib.js';
import { Card, G, fmtDollar, Btn } from '../components/ui.jsx';
import {
  loadRangePref, saveRangePref, filterByRange, rangeLabel,
  RangePickerRow, ML_KEY,
} from '../components/RangePicker.jsx';
import PlayerAvatar from '../components/PlayerAvatar.jsx';

// ── Constants ─────────────────────────────────────────────────────────────────
const HOME_VIEW_KEY = 'homeViewMode';
const ICON_BG = '#e8f5ec'; // light green circle bg for stat/insight icons

// ── Stat tile icons — match nav icon style ────────────────────────────────────
const IconFlag = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke={G} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="2" x2="4" y2="22"/>
    <path d="M4 4h12l-3 5 3 5H4"/>
  </svg>
);

const IconPeople = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke={G} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const IconPin = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke={G} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>
);

const IconDollar = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke={G} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 6v12M9 9.5c0-1 1.3-2 3-2s3 1 3 2.5c0 1.5-1.3 2-3 2.5s-3 1-3 2.5c0 1.5 1.3 2.5 3 2.5s3-1 3-2"/>
  </svg>
);

// ── Other icons ───────────────────────────────────────────────────────────────
const IconChevronDown = ({ size = 10, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);

const IconChevronRight = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke={G} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

const IconArrowUp = ({ color = G }) => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5"/>
    <polyline points="5 12 12 5 19 12"/>
  </svg>
);

const IconArrowDown = ({ color = '#A32D2D' }) => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <polyline points="5 12 12 19 19 12"/>
  </svg>
);

const IconPlus = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);

// ── Insight icons in light green circles ─────────────────────────────────────
const IconFireSvg = () => (
  <svg width="22" height="22" viewBox="0 0 100 100" fill="none">
    <path d="M50 10C50 10 30 35 30 55C30 70 39 82 50 82C61 82 70 70 70 55C70 35 50 10 50 10Z" fill="#E8612C"/>
    <path d="M50 38C50 38 40 50 40 62C40 70 44 76 50 76C56 76 60 70 60 62C60 50 50 38 50 38Z" fill="#FFA040"/>
    <path d="M50 58C47 58 45 61 45 64C45 67 47 69 50 69C53 69 55 67 55 64C55 61 53 58 50 58Z" fill="#FFD040"/>
  </svg>
);

const IconSnowSvg = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke="#4A90D9" strokeWidth="1.8" strokeLinecap="round">
    <line x1="12" y1="2" x2="12" y2="22"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
    <line x1="19.07" y1="4.93" x2="4.93" y2="19.07"/>
    <line x1="12" y1="2" x2="10" y2="5"/><line x1="12" y1="2" x2="14" y2="5"/>
    <line x1="12" y1="22" x2="10" y2="19"/><line x1="12" y1="22" x2="14" y2="19"/>
    <line x1="2" y1="12" x2="5" y2="10"/><line x1="2" y1="12" x2="5" y2="14"/>
    <line x1="22" y1="12" x2="19" y2="10"/><line x1="22" y1="12" x2="19" y2="14"/>
    <circle cx="12" cy="12" r="1.5" fill="#4A90D9" stroke="none"/>
  </svg>
);

const IconTrophySvg = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke="#B8860B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 21h8M12 17v4M7 4H4a2 2 0 0 0-2 2v1c0 3.3 2.7 6 6 6"/>
    <path d="M17 4h3a2 2 0 0 1 2 2v1c0 3.3-2.7 6-6 6"/>
    <path d="M6 2h12v10a6 6 0 0 1-12 0V2z"/>
  </svg>
);

const IconScissorsSvg = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke="#777" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="3"/>
    <circle cx="6" cy="18" r="3"/>
    <line x1="20" y1="4" x2="8.12" y2="15.88"/>
    <line x1="14.47" y1="14.48" x2="20" y2="20"/>
    <line x1="8.12" y1="8.12" x2="12" y2="12"/>
  </svg>
);

// Inline fire/snow for streak labels (small)
const FireSmall = () => (
  <svg width="11" height="11" viewBox="0 0 100 100">
    <path d="M50 10C50 10 30 35 30 55C30 70 39 82 50 82C61 82 70 70 70 55C70 35 50 10 50 10Z" fill="#E8612C"/>
    <path d="M50 38C50 38 40 50 40 62C40 70 44 76 50 76C56 76 60 70 60 62C60 50 50 38 50 38Z" fill="#FFA040"/>
  </svg>
);

const SnowSmall = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
    stroke="#4A90D9" strokeWidth="2" strokeLinecap="round">
    <line x1="12" y1="2" x2="12" y2="22"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
    <line x1="19.07" y1="4.93" x2="4.93" y2="19.07"/>
  </svg>
);

// ── Pennant ribbon SVG ────────────────────────────────────────────────────────
function PennantRibbon({ rank }) {
  const color = rank === 1 ? G : rank === 2 ? '#8a8a8a' : '#b67a43';
  // Downward-pointing banner shape: rect top + triangle notch at bottom center
  return (
    <svg width="32" height="36" viewBox="0 0 32 36" style={{ display: 'block' }}>
      <path d="M2 0 H30 V26 L16 36 L2 26 Z" fill={color}/>
      <text x="16" y="18" textAnchor="middle" dominantBaseline="middle"
        fill="#fff" fontSize="13" fontWeight="800" fontFamily="inherit">
        {rank}
      </text>
    </svg>
  );
}

// ── Data helpers ──────────────────────────────────────────────────────────────
function cleanGameName(raw) {
  return raw.replace(/\s*[—–-].*$/, '').replace(/\s*\(.*$/, '').trim();
}

function computeStreaks(filteredRounds, names) {
  const streaks = {};
  for (const name of names) {
    let count = 0, type = null;
    for (const r of filteredRounds) {
      const net = r.bank?.[name];
      if (net == null) break;
      if (net > 0) { if (type === 'cold') break; type = 'hot'; count++; }
      else if (net < 0) { if (type === 'hot') break; type = 'cold'; count++; }
      else break;
    }
    if (count >= 2 && type) streaks[name] = { count, type };
  }
  return streaks;
}

function computeGameTotals(filteredRounds, rosterNames) {
  const totals = {};
  const seen = new Set();
  const gameOrder = [];
  for (const r of filteredRounds) {
    for (const entry of (r.breakdown || [])) {
      const game = cleanGameName(entry.game);
      if (!seen.has(game)) { seen.add(game); gameOrder.push(game); }
      if (!totals[game]) totals[game] = {};
      for (const row of (entry.rows || [])) {
        if (!rosterNames.has(row.name)) continue;
        totals[game][row.name] = (totals[game][row.name] || 0) + (row.net || 0);
      }
    }
  }
  return { gameTotals: totals, gameOrder };
}

function computeInsights(filteredRounds, streaks, playerNetInPeriod) {
  let heater = null, heaterCount = 0;
  let coldest = null, coldCount = 0;
  for (const [name, s] of Object.entries(streaks)) {
    if (s.type === 'hot' && s.count > heaterCount) { heaterCount = s.count; heater = name; }
    if (s.type === 'cold' && s.count > coldCount) { coldCount = s.count; coldest = name; }
  }

  const pairRec = {};
  const teamRec = {};

  for (const r of filteredRounds) {
    const pl = r.players || [];
    for (const m of (r.matches || [])) {
      let sideA = [], sideB = [];
      if (m.format === 'individual') {
        const p1 = pl[m.p1]?.name, p2 = pl[m.p2]?.name;
        if (!p1 || !p2) continue;
        sideA = [p1]; sideB = [p2];
      } else if (m.format === 'team') {
        sideA = (m.teamA || []).map(i => pl[i]?.name).filter(Boolean);
        sideB = (m.teamB || []).map(i => pl[i]?.name).filter(Boolean);
        // Same-side pairs for Strongest Team
        for (const side of [sideA, sideB]) {
          const sideNet = side.reduce((s, n) => s + (r.bank?.[n] || 0), 0);
          for (let i = 0; i < side.length; i++) {
            for (let j = i + 1; j < side.length; j++) {
              const key = [side[i], side[j]].sort().join('|');
              if (!teamRec[key]) teamRec[key] = { names: [side[i], side[j]], wins: 0, net: 0 };
              if (sideNet > 0) teamRec[key].wins++;
              teamRec[key].net += sideNet;
            }
          }
        }
      } else continue;

      if (!sideA.length || !sideB.length) continue;
      const netA = sideA.reduce((s, n) => s + (r.bank?.[n] || 0), 0);
      const netB = sideB.reduce((s, n) => s + (r.bank?.[n] || 0), 0);
      if (netA === 0 && netB === 0) continue;
      const aWon = netA > netB;
      for (const a of sideA) {
        for (const b of sideB) {
          const key = [a, b].sort().join('|');
          if (!pairRec[key]) pairRec[key] = { names: [a, b], winsA: 0, winsB: 0, netA: 0, netB: 0 };
          if (aWon) pairRec[key].winsA++; else pairRec[key].winsB++;
          pairRec[key].netA += r.bank?.[a] || 0;
          pairRec[key].netB += r.bank?.[b] || 0;
        }
      }
    }
  }

  let strongestTeam = null, strongestWins = 0;
  for (const rec of Object.values(teamRec)) {
    if (rec.wins > strongestWins) { strongestWins = rec.wins; strongestTeam = rec; }
  }

  let nemesis = null, nemesisImbalance = 0;
  for (const rec of Object.values(pairRec)) {
    const total = rec.winsA + rec.winsB;
    if (total < 2) continue;
    const imbalance = Math.abs(rec.winsA - rec.winsB);
    if (imbalance > nemesisImbalance) {
      nemesisImbalance = imbalance;
      const aLeads = rec.winsA >= rec.winsB;
      nemesis = {
        winner: aLeads ? rec.names[0] : rec.names[1],
        loser: aLeads ? rec.names[1] : rec.names[0],
        wWins: Math.max(rec.winsA, rec.winsB),
        lWins: Math.min(rec.winsA, rec.winsB),
        netLoser: aLeads ? rec.netB : rec.netA,
      };
    }
  }

  return { heater, heaterCount, coldest, coldCount, strongestTeam, strongestWins, nemesis };
}

// ── Icon circle wrapper for insights ─────────────────────────────────────────
function IconCircle({ children }) {
  return (
    <div style={{
      width: 44, height: 44, borderRadius: '50%',
      background: ICON_BG,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {children}
    </div>
  );
}

// ── PodiumCard ────────────────────────────────────────────────────────────────
// H-46: no overflow:hidden anywhere in this tree
function PodiumCard({ name, total, rank, streak, playerRecord }) {
  const nameParts = (name || '').trim().split(/\s+/);
  const first = nameParts[0] || '';
  const last  = nameParts.slice(1).join(' ');
  const amtColor = total >= 0 ? G : '#A32D2D';
  const isFirst  = rank === 1;

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      background: '#fff',
      border: '1px solid #e5eee5',
      borderRadius: 14,
      padding: '0 8px 14px',
      boxShadow: '0 2px 8px rgba(0,0,0,.06)',
      position: 'relative',
      marginTop: isFirst ? 0 : 12, // 2nd/3rd sit lower
    }}>
      {/* Pennant hanging from top center */}
      <div style={{
        marginTop: -1,
        marginBottom: 8,
      }}>
        <PennantRibbon rank={rank} />
      </div>

      {/* Avatar — H-46 safe: no overflow:hidden ancestor */}
      <div style={{ marginBottom: 8 }}>
        <PlayerAvatar player={playerRecord} size={isFirst ? 52 : 44} starred={!!playerRecord?.starred} />
      </div>

      {/* Name stacked */}
      <div style={{ fontWeight: 700, fontSize: isFirst ? 14 : 13, color: '#111', textAlign: 'center', lineHeight: 1.2 }}>{first}</div>
      {last && <div style={{ fontWeight: 600, fontSize: isFirst ? 13 : 12, color: '#555', textAlign: 'center', marginBottom: 6, lineHeight: 1.2 }}>{last}</div>}
      {!last && <div style={{ marginBottom: 6 }} />}

      {/* Amount */}
      <div style={{ fontWeight: 800, fontSize: isFirst ? 20 : 17, color: amtColor, textAlign: 'center' }}>
        {fmtDollar(total)}
      </div>

      {/* Streak label */}
      {streak && streak.count >= 2 && (
        <div style={{
          marginTop: 5, fontSize: 11, fontWeight: 600,
          color: streak.type === 'hot' ? '#E8612C' : '#4A90D9',
          display: 'flex', alignItems: 'center', gap: 3,
        }}>
          {streak.type === 'hot' ? <FireSmall /> : <SnowSmall />}
          {streak.type === 'hot' ? 'Heater' : 'Cold'} {streak.count} wins
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function HomePage({ onNewRound, onResume, inProgress }) {
  const rounds  = useMemo(() => roundLib.list(), []);
  const players = useMemo(() => ls.get(SK.players) || [], []);

  const [rangePref, setRangePrefRaw] = useState(() => loadRangePref(ML_KEY));
  const [pickerOpen, setPickerOpen]  = useState(false);
  const [showMatrix, setShowMatrix]  = useState(false);
  const [listExpanded, setListExpanded] = useState(false);
  const [viewMode, setViewMode]      = useState(() => ls.get(HOME_VIEW_KEY) || 'basic');

  const setRangePref = useCallback((pref) => {
    saveRangePref(pref, ML_KEY);
    setRangePrefRaw(pref);
    if (pref.range !== 'custom') setPickerOpen(false);
  }, []);

  const setView = useCallback((mode) => {
    ls.set(HOME_VIEW_KEY, mode);
    setViewMode(mode);
    setShowMatrix(false);
  }, []);

  // H-13: enrich from playerLib by name
  const playerByName = useMemo(() => {
    const map = {};
    players.forEach(p => { map[p.name] = p; });
    return map;
  }, [players]);

  const rosterNames = useMemo(() => {
    const s = new Set(); players.forEach(p => s.add(p.name)); return s;
  }, [players]);

  const excludedNames = useMemo(() => {
    const s = new Set();
    players.forEach(p => { if (p.inMoneyLists === false) s.add(p.name); });
    return s;
  }, [players]);

  // H-29: filter first
  const filteredRounds = useMemo(() =>
    filterByRange(rounds, rangePref), [rounds, rangePref]);

  const moneyList = useMemo(() => {
    const totals = {};
    filteredRounds.forEach(r => {
      Object.entries(r.bank || {}).forEach(([name, v]) => {
        if (!rosterNames.has(name) || excludedNames.has(name)) return;
        totals[name] = (totals[name] || 0) + v;
      });
    });
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [filteredRounds, rosterNames, excludedNames]);

  const activePlayerNames = useMemo(() =>
    Array.from(rosterNames).filter(n => !excludedNames.has(n)),
    [rosterNames, excludedNames]);

  const streaks = useMemo(() =>
    computeStreaks(filteredRounds, activePlayerNames),
    [filteredRounds, activePlayerNames]);

  const { gameTotals, gameOrder } = useMemo(() =>
    computeGameTotals(filteredRounds, rosterNames),
    [filteredRounds, rosterNames]);

  const playerNetInPeriod = useMemo(() => {
    const map = {};
    filteredRounds.forEach(r => {
      Object.entries(r.bank || {}).forEach(([name, v]) => { map[name] = (map[name] || 0) + v; });
    });
    return map;
  }, [filteredRounds]);

  const insights = useMemo(() =>
    computeInsights(filteredRounds, streaks, playerNetInPeriod),
    [filteredRounds, streaks, playerNetInPeriod]);

  // Stat tiles
  const statTiles = useMemo(() => {
    const thisYear = new Date().getFullYear();
    const ytdRounds = rounds.filter(r => new Date(r.date).getFullYear() === thisYear);
    const activePlayers = players.filter(p => p.inMoneyLists !== false).length;
    const coursesPlayed = new Set(filteredRounds.map(r => r.course_name).filter(Boolean)).size;
    let wagered = 0;
    filteredRounds.forEach(r => { Object.values(r.bank || {}).forEach(v => { wagered += Math.abs(v); }); });
    wagered = wagered / 2;
    return [
      { icon: <IconFlag />,   value: String(ytdRounds.length), label: 'ROUNDS',  sub: 'This year' },
      { icon: <IconPeople />, value: String(activePlayers),    label: 'PLAYERS', sub: 'Active'    },
      { icon: <IconPin />,    value: String(coursesPlayed),    label: 'COURSES', sub: 'Played'    },
      { icon: <IconDollar />, value: fmtDollar(wagered),       label: 'WAGERED', sub: 'This year' },
    ];
  }, [rounds, players, filteredRounds]);

  const top3  = moneyList.slice(0, 3);
  const rest  = moneyList.slice(3);
  const hasData = rounds.length > 0;

  // Podium display order: 2nd left, 1st center, 3rd right
  const podiumSlots = [
    top3[1] ? { name: top3[1][0], total: top3[1][1], rank: 2 } : null,
    top3[0] ? { name: top3[0][0], total: top3[0][1], rank: 1 } : null,
    top3[2] ? { name: top3[2][0], total: top3[2][1], rank: 3 } : null,
  ];

  // Insight tiles
  const insightTiles = useMemo(() => {
    const tiles = [];
    const { heater, heaterCount, coldest, coldCount, strongestTeam, strongestWins, nemesis } = insights;
    if (heater && heaterCount >= 2) {
      const net = playerNetInPeriod[heater] || 0;
      tiles.push({ icon: <IconFireSvg />, title: 'HEATER', name: heater,
        stat: `+${fmtDollar(Math.abs(net))} over last ${heaterCount} rounds`, statColor: G });
    }
    if (coldest && coldCount >= 2) {
      const net = playerNetInPeriod[coldest] || 0;
      tiles.push({ icon: <IconSnowSvg />, title: 'COLD STREAK', name: coldest,
        stat: `${coldCount} losses in a row`, amount: fmtDollar(net), amountColor: '#A32D2D' });
    }
    if (strongestTeam && strongestWins >= 1) {
      tiles.push({ icon: <IconTrophySvg />, title: 'STRONGEST TEAM',
        name: strongestTeam.names.join(' & '),
        stat: `${strongestWins} wins together`,
        amount: `+${fmtDollar(Math.abs(strongestTeam.net))}`, amountColor: G });
    }
    if (nemesis) {
      const { winner, loser, wWins, lWins, netLoser } = nemesis;
      tiles.push({ icon: <IconScissorsSvg />, title: 'NEMESIS', name: loser,
        stat: `${lWins}-${wWins} vs ${winner}`, amount: fmtDollar(netLoser), amountColor: '#A32D2D' });
    }
    return tiles;
  }, [insights, playerNetInPeriod]);

  return (
    <div style={{ minHeight: '100vh', background: '#eef4ee', paddingBottom: 80 }}>

      {/* ── Header ── */}
      <div style={{
        background: G, padding: '10px 16px',
        position: 'sticky', top: 0, zIndex: 10,
        boxShadow: '0 2px 12px rgba(0,0,0,.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <img src="/logo_icon.png" alt="The Card" style={{ height: 54, width: 'auto', display: 'block' }} />
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, letterSpacing: '.14em', textTransform: 'uppercase', fontFamily: 'inherit' }}>
          The Card
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '14px 14px' }}>

        {/* ── Resume banner ── */}
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

        {/* ── New Round ── */}
        <button onClick={onNewRound} style={{
          width: '100%', background: G, color: '#fff', border: 'none',
          borderRadius: 16, padding: '18px 20px', fontSize: 17, fontWeight: 800,
          cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', gap: 8, marginBottom: 14,
          boxShadow: '0 6px 18px rgba(26,71,42,.28)', fontFamily: 'inherit',
        }}>
          <IconPlus /> New Round
        </button>

        {/* ── Stat tiles — single card, 4 columns ── */}
        <div style={{
          background: '#fff', borderRadius: 16,
          boxShadow: '0 1px 6px rgba(0,0,0,.07)',
          marginBottom: 14,
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
        }}>
          {statTiles.map(({ icon, value, label, sub }, i) => (
            <div key={label} style={{
              padding: '14px 8px',
              borderRight: i < 3 ? '1px solid #f0f4f0' : 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: ICON_BG,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {icon}
              </div>
              <div style={{ fontSize: label === 'WAGERED' ? 13 : 20, fontWeight: 800, color: G, lineHeight: 1, textAlign: 'center' }}>{value}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#888', textAlign: 'center', letterSpacing: '.04em' }}>{label}</div>
              <div style={{ fontSize: 9, color: '#bbb', textAlign: 'center', marginTop: -4 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* ── BASIC VIEW ── */}
        {viewMode === 'basic' && hasData && (
          <Card style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: pickerOpen ? 10 : 14 }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#1f3f24', flex: 1 }}>Money List</div>
              <button onClick={() => setPickerOpen(o => !o)} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: '#fff', border: '1.5px solid #ddd', color: '#444',
                borderRadius: 20, padding: '5px 10px',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {rangeLabel(rangePref)} <IconChevronDown />
              </button>
            </div>
            {pickerOpen && (
              <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #eee' }}>
                <RangePickerRow rangePref={rangePref} onRangePrefChange={setRangePref} />
              </div>
            )}
            {moneyList.length > 0 ? (
              <div style={{ background: '#fafdfa', border: '1px solid #e8efe8', borderRadius: 12 }}>
                {moneyList.map(([name, total], i) => {
                  const pr = playerByName[name] || { name };
                  return (
                    <div key={name} style={{
                      display: 'flex', alignItems: 'center', padding: '10px 14px',
                      borderBottom: i < moneyList.length - 1 ? '1px solid #edf3ed' : 'none',
                    }}>
                      <div style={{ width: 20, fontSize: 12, fontWeight: 700, color: '#aaa', flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ marginRight: 8, flexShrink: 0 }}>
                        <PlayerAvatar player={pr} size={28} starred={false} />
                      </div>
                      <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#222' }}>{name}</div>
                      <div style={{ fontWeight: 800, color: total >= 0 ? G : '#A32D2D' }}>{fmtDollar(total)}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#aaa', textAlign: 'center', padding: '14px 0' }}>No rounds in this period</div>
            )}
          </Card>
        )}

        {/* ── ENHANCED VIEW ── */}
        {viewMode === 'enhanced' && hasData && (
          <>
            <Card style={{ padding: 16, marginBottom: 14, overflow: 'visible' }}>

              {/* Standings header row */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: pickerOpen ? 10 : 16 }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#1f3f24', letterSpacing: '.06em', textTransform: 'uppercase' }}>Standings</div>
                <button onClick={() => setPickerOpen(o => !o)} style={{
                  display: 'flex', alignItems: 'center', gap: 4, marginLeft: 10,
                  background: 'transparent', border: '1px solid #ccc', color: '#555',
                  borderRadius: 20, padding: '4px 10px',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  {rangeLabel(rangePref)} <IconChevronDown color="#555" />
                </button>
                <div style={{ flex: 1 }} />
                <button onClick={() => { setShowMatrix(v => !v); setListExpanded(false); }} style={{
                  display: 'flex', alignItems: 'center', gap: 3,
                  background: 'transparent', border: 'none', color: G,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', padding: 0,
                }}>
                  {showMatrix ? 'Standings' : 'View Full List'} <IconChevronRight />
                </button>
              </div>

              {pickerOpen && (
                <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid #eee' }}>
                  <RangePickerRow rangePref={rangePref} onRangePrefChange={setRangePref} />
                </div>
              )}

              {moneyList.length === 0 && (
                <div style={{ fontSize: 12, color: '#aaa', textAlign: 'center', padding: '14px 0' }}>No rounds in this period</div>
              )}

              {moneyList.length > 0 && (
                // Slide container — clipPath instead of overflow:hidden (H-46)
                <div style={{ position: 'relative' }}>
                  <div style={{ clipPath: 'inset(0 0 0 0 round 12px)' }}>
                    <div style={{
                      display: 'flex', width: '200%',
                      transform: showMatrix ? 'translateX(-50%)' : 'translateX(0)',
                      transition: 'transform .35s ease',
                    }}>

                      {/* ── Standings panel ── */}
                      <div style={{ width: '50%', boxSizing: 'border-box', paddingRight: 8 }}>

                        {/* Podium */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'flex-start' }}>
                          {podiumSlots.map((slot, i) => slot ? (
                            <PodiumCard
                              key={slot.name}
                              name={slot.name}
                              total={slot.total}
                              rank={slot.rank}
                              streak={streaks[slot.name]}
                              playerRecord={playerByName[slot.name] || { name: slot.name }}
                            />
                          ) : (
                            <div key={i} style={{ flex: 1 }} />
                          ))}
                        </div>

                        {/* Ranked list 4+ */}
                        {rest.length > 0 && (
                          <>
                            <div style={{ background: '#fafdfa', border: '1px solid #e8efe8', borderRadius: 12 }}>
                              {(listExpanded ? rest : rest.slice(0, 3)).map(([name, total], i) => {
                                const pr = playerByName[name] || { name };
                                const streak = streaks[name];
                                return (
                                  <div key={name} style={{
                                    display: 'flex', alignItems: 'center', padding: '10px 12px',
                                    borderBottom: '1px solid #edf3ed',
                                  }}>
                                    <div style={{ width: 20, fontSize: 12, fontWeight: 700, color: '#aaa', flexShrink: 0 }}>{i + 4}</div>
                                    {/* H-46: no overflow:hidden ancestor */}
                                    <div style={{ marginRight: 8, flexShrink: 0 }}>
                                      <PlayerAvatar player={pr} size={28} starred={false} />
                                    </div>
                                    <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#222' }}>{name}</div>
                                    {streak && streak.count >= 2 && (
                                      <div style={{
                                        display: 'flex', alignItems: 'center', gap: 2,
                                        fontSize: 10, fontWeight: 700, marginRight: 8,
                                        color: streak.type === 'hot' ? '#E8612C' : '#4A90D9',
                                      }}>
                                        {streak.type === 'hot' ? <FireSmall /> : <SnowSmall />}
                                        {streak.count}
                                      </div>
                                    )}
                                    <div style={{ fontWeight: 800, fontSize: 13, color: total >= 0 ? G : '#A32D2D' }}>
                                      {fmtDollar(total)}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            {/* Expand/collapse chevron */}
                            {rest.length > 3 && (
                              <button onClick={() => setListExpanded(e => !e)} style={{
                                width: '100%', background: 'none', border: 'none',
                                padding: '8px 0 0', cursor: 'pointer',
                                display: 'flex', justifyContent: 'center',
                              }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                                  stroke="#bbb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                                  style={{ transform: listExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
                                  <polyline points="6 9 12 15 18 9"/>
                                </svg>
                              </button>
                            )}
                          </>
                        )}
                      </div>

                      {/* ── Matrix panel ── */}
                      <div style={{ width: '50%', boxSizing: 'border-box', paddingLeft: 8 }}>
                        {gameOrder.length === 0 ? (
                          <div style={{ fontSize: 12, color: '#aaa', textAlign: 'center', padding: '20px 0' }}>No breakdown data</div>
                        ) : (
                          <div style={{
                            background: '#fff', border: '1px solid #e5eee5', borderRadius: 12,
                            overflowX: 'auto', WebkitOverflowScrolling: 'touch',
                          }}>
                            <table style={{ width: '100%', minWidth: 380, borderCollapse: 'collapse', fontSize: 12 }}>
                              <thead>
                                <tr style={{ borderBottom: '2px solid #eee' }}>
                                  <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 700, color: '#666', fontSize: 11, whiteSpace: 'nowrap' }}>Player</th>
                                  {gameOrder.map(g => (
                                    <th key={g} style={{ padding: '9px 6px', textAlign: 'center', fontWeight: 700, color: '#666', fontSize: 11, whiteSpace: 'nowrap' }}>{g}</th>
                                  ))}
                                  <th style={{ padding: '9px 6px', textAlign: 'center', fontWeight: 700, color: '#666', fontSize: 11 }}>Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {moneyList.map(([name, total], ri) => {
                                  const pr = playerByName[name] || { name };
                                  return (
                                    <tr key={name} style={{ borderBottom: ri < moneyList.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                                      <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                          {/* H-46: td has no overflow:hidden */}
                                          <PlayerAvatar player={pr} size={22} starred={false} />
                                          <span style={{ fontWeight: 700, fontSize: 11, color: '#222' }}>
                                            {(name || '').split(' ')[0]}
                                          </span>
                                        </div>
                                      </td>
                                      {gameOrder.map(g => {
                                        const val = gameTotals[g]?.[name] || 0;
                                        return (
                                          <td key={g} style={{
                                            padding: '9px 6px', textAlign: 'center',
                                            color: val > 0 ? G : val < 0 ? '#A32D2D' : '#bbb',
                                            fontWeight: 700,
                                          }}>
                                            {val === 0 ? '—' : fmtDollar(val)}
                                          </td>
                                        );
                                      })}
                                      <td style={{
                                        padding: '9px 6px', textAlign: 'center', fontWeight: 800,
                                        color: total >= 0 ? G : '#A32D2D',
                                      }}>
                                        {fmtDollar(total)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* ── Insights ── */}
            {insightTiles.length > 0 && (
              <Card style={{ padding: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: '#1f3f24', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 14 }}>
                  Insights
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {insightTiles.map(({ icon, title, name, stat, amount, statColor, amountColor }) => (
                    <div key={title} style={{
                      background: '#fff', border: '1px solid #e8efe8', borderRadius: 14,
                      padding: 14, display: 'flex', gap: 10, alignItems: 'flex-start',
                    }}>
                      <IconCircle>{icon}</IconCircle>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9aaa9a', fontWeight: 700, marginBottom: 2 }}>{title}</div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: '#111', marginBottom: 2 }}>{name}</div>
                        <div style={{ fontSize: 11, color: '#666' }}>{stat}</div>
                        {amount && <div style={{ fontSize: 12, fontWeight: 700, color: amountColor }}>{amount}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
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

      {/* ── Basic / Enhanced toggle — subtle, fixed above nav ── */}
      <div style={{
        position: 'fixed', bottom: 62, left: '50%', transform: 'translateX(-50%)',
        zIndex: 20,
        background: 'rgba(235,242,235,0.94)',
        borderRadius: 20, padding: 3,
        boxShadow: '0 1px 8px rgba(0,0,0,.10)',
        border: '1px solid #cdd8cd',
        display: 'flex',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}>
        {['basic', 'enhanced'].map(mode => (
          <button key={mode} onClick={() => setView(mode)} style={{
            padding: '5px 16px', borderRadius: 17, border: 'none',
            background: viewMode === mode ? G : 'transparent',
            color: viewMode === mode ? '#fff' : '#999',
            fontSize: 11, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit',
            transition: 'background .15s, color .15s',
            letterSpacing: '.03em',
          }}>
            {mode === 'basic' ? 'Basic' : 'Enhanced'}
          </button>
        ))}
      </div>

    </div>
  );
}
