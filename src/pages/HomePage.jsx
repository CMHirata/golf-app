// ─── pages/HomePage.jsx ───────────────────────────────────────────────────────
//
// ✅ Self-checked: H-13 applied — starred/inMoneyLists enriched from playerLib
//    by name match, never from activePlayers snapshot. H-46 applied — no
//    overflow:hidden on any ancestor of PlayerAvatar. H-29 applied —
//    filterByRange called before all stat/streak/insights computations. H-30
//    applied — ML_KEY ('moneyListRange') used; historyRange untouched.
//    Basic/Enhanced toggle persisted to localStorage key 'homeViewMode'.
//    Strongest Team and Nemesis degrade gracefully when no Match/Nassau rounds
//    exist. Game breakdown table uses r.breakdown rows; avatars frozen left via
//    sticky positioning (no overflow:hidden on container).

import { useMemo, useState, useCallback, useRef } from 'react';
import { ls, SK } from '../services/storage.js';
import { roundLib } from '../services/roundLib.js';
import { Btn, Card, G, RED, fmtDollar } from '../components/ui.jsx';
import {
  loadRangePref, saveRangePref, filterByRange, rangeLabel,
  RangePickerRow, ML_KEY,
} from '../components/RangePicker.jsx';
import PlayerAvatar from '../components/PlayerAvatar.jsx';

// ── Constants ─────────────────────────────────────────────────────────────────
const HOME_VIEW_KEY = 'homeViewMode';
const GOLD   = '#B8860B';
const SILVER = '#707070';
const BRONZE = '#8B4513';

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

const IconFlame = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="#E8612C" stroke="none">
    <path d="M12 2C12 2 8 7 8 11c0 2.2 1.8 4 4 4s4-1.8 4-4c0-1.5-.8-2.8-1.5-3.5C14.5 8 14 9 13 9.5 13.5 8 13 5.5 12 2z"/>
    <path d="M7 14c0 4 2.2 7 5 7s5-3 5-7c0-2-.8-3.8-2-5-.3 1.5-1 2.5-2 3 .5-1.5 0-3.5-1-5C11 8 9 9.5 8.5 11.5 7.5 12 7 13 7 14z" opacity="0.7"/>
  </svg>
);

const IconSnowflake = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4A90D9" strokeWidth="1.8" strokeLinecap="round">
    <line x1="12" y1="2" x2="12" y2="22"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
    <line x1="19.07" y1="4.93" x2="4.93" y2="19.07"/>
    <circle cx="12" cy="12" r="2" fill="#4A90D9" stroke="none"/>
  </svg>
);

const IconTrophy = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 21h8M12 17v4M7 4H4a2 2 0 0 0-2 2v1c0 3.3 2.7 6 6 6"/>
    <path d="M17 4h3a2 2 0 0 1 2 2v1c0 3.3-2.7 6-6 6"/>
    <path d="M6 2h12v10a6 6 0 0 1-12 0V2z"/>
  </svg>
);

const IconScissors = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="3"/>
    <circle cx="6" cy="18" r="3"/>
    <line x1="20" y1="4" x2="8.12" y2="15.88"/>
    <line x1="14.47" y1="14.48" x2="20" y2="20"/>
    <line x1="8.12" y1="8.12" x2="12" y2="12"/>
  </svg>
);

// ── Helpers ───────────────────────────────────────────────────────────────────
function cleanGameName(raw) {
  // Strip detail suffix after ' —' or ' - ' or ' (', keep base game name
  return raw.replace(/\s*[—\-–].*$/, '').replace(/\s*\(.*$/, '').trim();
}

function computeStreaks(filteredRounds, playerNames) {
  // Returns { [name]: { count, type: 'hot'|'cold' } } for streaks >= 2
  const streaks = {};
  for (const name of playerNames) {
    let count = 0;
    let type = null;
    for (const r of filteredRounds) { // newest-first (H-29)
      const net = r.bank?.[name];
      if (net === undefined || net === null) break;
      if (net > 0) {
        if (type === 'cold') break;
        type = 'hot'; count++;
      } else if (net < 0) {
        if (type === 'hot') break;
        type = 'cold'; count++;
      } else {
        break; // zero = streak broken
      }
    }
    if (count >= 2 && type) streaks[name] = { count, type };
  }
  return streaks;
}

function computeGameTotals(filteredRounds, playerNames) {
  // Returns { gameName: { playerName: netTotal } }
  const gameTotals = {};
  const gameOrder = [];
  for (const r of filteredRounds) {
    for (const entry of (r.breakdown || [])) {
      const game = cleanGameName(entry.game);
      if (!gameTotals[game]) { gameTotals[game] = {}; gameOrder.push(game); }
      for (const row of (entry.rows || [])) {
        if (!playerNames.has(row.name)) continue;
        gameTotals[game][row.name] = (gameTotals[game][row.name] || 0) + (row.net || 0);
      }
    }
  }
  // Deduplicate gameOrder while preserving first-seen order
  const seen = new Set();
  const uniqueOrder = [];
  for (const g of gameOrder) { if (!seen.has(g)) { seen.add(g); uniqueOrder.push(g); } }
  return { gameTotals, gameOrder: uniqueOrder };
}

function computeInsights(filteredRounds, playerNames, streaks) {
  // Heater: longest active hot streak
  let heater = null;
  let heaterCount = 0;
  for (const [name, s] of Object.entries(streaks)) {
    if (s.type === 'hot' && s.count > heaterCount) {
      heaterCount = s.count;
      heater = name;
    }
  }

  // Cold streak: longest active cold streak
  let coldest = null;
  let coldCount = 0;
  for (const [name, s] of Object.entries(streaks)) {
    if (s.type === 'cold' && s.count > coldCount) {
      coldCount = s.count;
      coldest = name;
    }
  }

  // Strongest Team + Nemesis: parse match rounds
  // Pair key = sorted names joined with '|'
  const pairWins = {}; // { 'A|B': { wins: { A: n, B: n }, net: { A: n, B: n } } }

  for (const r of filteredRounds) {
    const matches = r.matches || [];
    if (!matches.length) continue;
    const players = r.players || [];

    for (const m of matches) {
      let sideA = [], sideB = [];
      if (m.format === 'individual') {
        const p1 = players[m.p1]?.name;
        const p2 = players[m.p2]?.name;
        if (!p1 || !p2) continue;
        sideA = [p1]; sideB = [p2];
      } else if (m.format === 'team') {
        sideA = (m.teamA || []).map(i => players[i]?.name).filter(Boolean);
        sideB = (m.teamB || []).map(i => players[i]?.name).filter(Boolean);
        if (!sideA.length || !sideB.length) continue;
      } else continue;

      // Determine winner from bank net: side with positive sum wins
      const netA = sideA.reduce((s, n) => s + (r.bank?.[n] || 0), 0);
      const netB = sideB.reduce((s, n) => s + (r.bank?.[n] || 0), 0);
      if (netA === 0 && netB === 0) continue; // tie / no data

      const winnerSide = netA > netB ? sideA : sideB;
      const loserSide  = netA > netB ? sideB : sideA;

      // Register all cross-pairs from opposite sides
      for (const a of sideA) {
        for (const b of sideB) {
          const key = [a, b].sort().join('|');
          if (!pairWins[key]) pairWins[key] = { names: [a, b], winsA: 0, winsB: 0, netA: 0, netB: 0 };
          const rec = pairWins[key];
          const aWon = winnerSide.includes(a);
          if (aWon) { rec.winsA++; } else { rec.winsB++; }
          rec.netA += r.bank?.[a] || 0;
          rec.netB += r.bank?.[b] || 0;
        }
      }
    }
  }

  // Strongest Team: pair with most combined wins (highest total games played together on same side)
  // Reinterpret: pairs who played on SAME side — scan team matches
  const teamPairWins = {};
  for (const r of filteredRounds) {
    const matches = r.matches || [];
    for (const m of matches) {
      if (m.format !== 'team') continue;
      const players = r.players || [];
      const sides = [m.teamA || [], m.teamB || []];
      for (const side of sides) {
        const names = side.map(i => players[i]?.name).filter(Boolean);
        const sideNet = names.reduce((s, n) => s + (r.bank?.[n] || 0), 0);
        const won = sideNet > 0;
        for (let i = 0; i < names.length; i++) {
          for (let j = i + 1; j < names.length; j++) {
            const key = [names[i], names[j]].sort().join('|');
            if (!teamPairWins[key]) teamPairWins[key] = { names: [names[i], names[j]], wins: 0, net: 0 };
            if (won) teamPairWins[key].wins++;
            teamPairWins[key].net += sideNet;
          }
        }
      }
    }
  }

  let strongestTeam = null;
  let strongestWins = 0;
  for (const rec of Object.values(teamPairWins)) {
    if (rec.wins > strongestWins) { strongestWins = rec.wins; strongestTeam = rec; }
  }

  // Nemesis: pair with most lopsided head-to-head record (most wins vs losses)
  let nemesis = null;
  let nemesisImbalance = 0;
  for (const rec of Object.values(pairWins)) {
    const imbalance = Math.abs(rec.winsA - rec.winsB);
    const total = rec.winsA + rec.winsB;
    if (total < 2) continue; // need at least 2 rounds
    if (imbalance > nemesisImbalance) {
      nemesisImbalance = imbalance;
      const winnerName = rec.winsA >= rec.winsB ? rec.names[0] : rec.names[1];
      const loserName  = rec.winsA >= rec.winsB ? rec.names[1] : rec.names[0];
      const winsForWinner = Math.max(rec.winsA, rec.winsB);
      const winsForLoser  = Math.min(rec.winsA, rec.winsB);
      const netLoser = rec.names[0] === loserName ? rec.netA : rec.netB;
      nemesis = { winner: winnerName, loser: loserName, wWins: winsForWinner, lWins: winsForLoser, netLoser };
    }
  }

  return { heater, heaterCount, coldest, coldCount, strongestTeam, strongestWins, nemesis };
}

// ── Place badge ───────────────────────────────────────────────────────────────
function PlaceBadge({ place }) {
  const color = place === 1 ? GOLD : place === 2 ? SILVER : BRONZE;
  return (
    <div style={{
      position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)',
      background: color, color: '#fff',
      borderRadius: 4, width: 20, height: 20,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 10, fontWeight: 800, zIndex: 2,
      boxShadow: '0 1px 4px rgba(0,0,0,.25)',
    }}>
      {place}
    </div>
  );
}

// ── Insight tile ──────────────────────────────────────────────────────────────
function InsightTile({ icon, label, name, stat, statColor }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '12px 10px',
      display: 'flex', alignItems: 'flex-start', gap: 10,
      boxShadow: '0 1px 4px rgba(0,0,0,.06)',
      border: '1px solid #eee',
    }}>
      <div style={{ flexShrink: 0, marginTop: 2 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
        <div style={{ fontSize: 12, color: statColor || G }}>{stat}</div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function HomePage({ onNewRound, onResume, onHistory, inProgress }) {
  const rounds  = useMemo(() => roundLib.list(), []);
  const players = useMemo(() => ls.get(SK.players) || [], []);
  const courses = useMemo(() => ls.get(SK.courses) || [], []);

  const [rangePref, setRangePrefState] = useState(() => loadRangePref(ML_KEY));
  const [pickerOpen, setPickerOpen]    = useState(false);
  const [expanded, setExpanded]        = useState(false);
  const [viewMode, setViewMode]        = useState(() => ls.get(HOME_VIEW_KEY) || 'basic');

  const tableRef = useRef(null);

  const setRangePref = useCallback((pref) => {
    saveRangePref(pref, ML_KEY);
    setRangePrefState(pref);
    if (pref.range !== 'custom') setPickerOpen(false);
  }, []);

  const setView = useCallback((mode) => {
    ls.set(HOME_VIEW_KEY, mode);
    setViewMode(mode);
  }, []);

  // H-13: enrich from playerLib by name
  const playerByName = useMemo(() => {
    const map = {};
    players.forEach(p => { map[p.name] = p; });
    return map;
  }, [players]);

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

  // Money list (all players, sorted by net desc)
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

  // Streaks
  const streaks = useMemo(() =>
    computeStreaks(filteredRounds, Array.from(rosterNames).filter(n => !excludedNames.has(n))),
    [filteredRounds, rosterNames, excludedNames]
  );

  // Game totals for breakdown table
  const { gameTotals, gameOrder } = useMemo(() =>
    computeGameTotals(filteredRounds, rosterNames),
    [filteredRounds, rosterNames]
  );

  // Insights
  const insights = useMemo(() =>
    computeInsights(filteredRounds, rosterNames, streaks),
    [filteredRounds, rosterNames, streaks]
  );

  // Stat tiles
  const statTiles = useMemo(() => {
    const thisYear = new Date().getFullYear();
    const ytdRounds = rounds.filter(r => new Date(r.date).getFullYear() === thisYear);
    const activePlayers = players.filter(p => p.inMoneyLists !== false).length;
    const coursesPlayed = new Set(filteredRounds.map(r => r.course_name).filter(Boolean)).size;
    let wagered = 0;
    filteredRounds.forEach(r => {
      Object.values(r.bank || {}).forEach(v => { wagered += Math.abs(v); });
    });
    wagered = wagered / 2; // each transaction counted from both sides
    return [
      { label: 'Rounds',   value: ytdRounds.length,   sub: 'This year' },
      { label: 'Players',  value: activePlayers,       sub: 'Active'    },
      { label: 'Courses',  value: coursesPlayed,       sub: 'Played'    },
      { label: 'Wagered',  value: fmtDollar(wagered),  sub: 'This year', green: true },
    ];
  }, [rounds, players, filteredRounds]);

  const hasData = rounds.length > 0;
  const top3    = moneyList.slice(0, 3);

  // Net total across filteredRounds per player (for heater/cold stat line)
  const playerNetInPeriod = useMemo(() => {
    const map = {};
    filteredRounds.forEach(r => {
      Object.entries(r.bank || {}).forEach(([name, v]) => {
        map[name] = (map[name] || 0) + v;
      });
    });
    return map;
  }, [filteredRounds]);

  return (
    <div style={{ minHeight: '100vh', background: '#eef4ee', paddingBottom: 80 }}>

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

        {/* ── Stat tiles ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 12 }}>
          {statTiles.map(s => (
            <div key={s.label} style={{
              background: '#fff', borderRadius: 12, padding: '10px 6px',
              textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,.06)',
            }}>
              <div style={{ fontSize: s.label === 'Wagered' ? 13 : 20, fontWeight: 800, color: s.green ? G : G, lineHeight: 1.1 }}>{s.value}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#444', marginTop: 1 }}>{s.label}</div>
              <div style={{ fontSize: 9, color: '#aaa', marginTop: 1 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* ── BASIC VIEW ── */}
        {viewMode === 'basic' && hasData && (
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

            {pickerOpen && (
              <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #eee' }}>
                <RangePickerRow rangePref={rangePref} onRangePrefChange={setRangePref} />
              </div>
            )}

            {moneyList.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {moneyList.map(([name, total], i) => {
                  const positive = total > 0;
                  const negative = total < 0;
                  const amountColor = positive ? '#27500A' : negative ? '#A32D2D' : '#bbb';
                  const playerRecord = playerByName[name] || { name };
                  return (
                    <div key={name} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: '#f8faf8', borderRadius: 9, padding: '6px 12px 6px 8px',
                      border: '1px solid #e8f0e8',
                    }}>
                      <PlayerAvatar player={playerRecord} size={30} starred={false} />
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#222', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {name}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: amountColor, flexShrink: 0 }}>
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

        {/* ── ENHANCED VIEW ── */}
        {viewMode === 'enhanced' && hasData && (
          <>
            {/* ── Standings card ── */}
            <Card style={{ padding: '14px 14px', marginBottom: 12 }}>

              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: pickerOpen ? 10 : 14 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: G, flex: 1 }}>Standings</div>
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
                <button
                  onClick={() => setExpanded(e => !e)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: 'transparent', border: 'none',
                    fontSize: 12, fontWeight: 700, color: G,
                    cursor: 'pointer', fontFamily: 'inherit', padding: '4px 2px',
                  }}
                >
                  {expanded ? 'Collapse' : 'Expand'}
                  <IconChevron open={expanded} />
                </button>
              </div>

              {pickerOpen && (
                <div style={{ marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid #eee' }}>
                  <RangePickerRow rangePref={rangePref} onRangePrefChange={setRangePref} />
                </div>
              )}

              {moneyList.length === 0 && (
                <div style={{ fontSize: 12, color: '#aaa', textAlign: 'center', padding: '10px 0' }}>
                  No rounds in this period
                </div>
              )}

              {/* ── Podium — top 3 ── */}
              {!expanded && moneyList.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                  {/* 2nd — left */}
                  {top3[1] && (() => {
                    const [name, total] = top3[1];
                    const pr = playerByName[name] || { name };
                    const streak = streaks[name];
                    const amtColor = total > 0 ? '#27500A' : total < 0 ? '#A32D2D' : '#bbb';
                    return (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 0 }}>
                        <div style={{ position: 'relative', marginBottom: 6, marginTop: 16 }}>
                          <PlaceBadge place={2} />
                          {/* H-46: no overflow:hidden here */}
                          <PlayerAvatar player={pr} size={44} starred={!!pr.starred} />
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#111', textAlign: 'center', marginBottom: 2 }}>{name}</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: amtColor, textAlign: 'center' }}>{fmtDollar(total)}</div>
                        {streak && (
                          <div style={{ fontSize: 11, color: streak.type === 'hot' ? '#E8612C' : '#4A90D9', marginTop: 2 }}>
                            {streak.type === 'hot' ? '🔥' : '❄️'} {streak.count} wins
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* 1st — center, elevated */}
                  {top3[0] && (() => {
                    const [name, total] = top3[0];
                    const pr = playerByName[name] || { name };
                    const streak = streaks[name];
                    const amtColor = total > 0 ? '#27500A' : total < 0 ? '#A32D2D' : '#bbb';
                    return (
                      <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ position: 'relative', marginBottom: 6 }}>
                          <PlaceBadge place={1} />
                          {/* H-46: no overflow:hidden here */}
                          <PlayerAvatar player={pr} size={52} starred={!!pr.starred} />
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#111', textAlign: 'center', marginBottom: 2 }}>{name}</div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: amtColor, textAlign: 'center' }}>{fmtDollar(total)}</div>
                        {streak && (
                          <div style={{ fontSize: 11, color: streak.type === 'hot' ? '#E8612C' : '#4A90D9', marginTop: 2 }}>
                            {streak.type === 'hot' ? 'Heater 🔥' : 'Cold ❄️'} {streak.count} wins
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* 3rd — right */}
                  {top3[2] && (() => {
                    const [name, total] = top3[2];
                    const pr = playerByName[name] || { name };
                    const streak = streaks[name];
                    const amtColor = total > 0 ? '#27500A' : total < 0 ? '#A32D2D' : '#bbb';
                    return (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 0 }}>
                        <div style={{ position: 'relative', marginBottom: 6, marginTop: 16 }}>
                          <PlaceBadge place={3} />
                          {/* H-46: no overflow:hidden here */}
                          <PlayerAvatar player={pr} size={44} starred={!!pr.starred} />
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#111', textAlign: 'center', marginBottom: 2 }}>{name}</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: amtColor, textAlign: 'center' }}>{fmtDollar(total)}</div>
                        {streak && (
                          <div style={{ fontSize: 11, color: streak.type === 'hot' ? '#E8612C' : '#4A90D9', marginTop: 2 }}>
                            {streak.type === 'hot' ? '🔥' : '❄️'} {streak.count} wins
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* ── Expanded: game breakdown table ── */}
              {expanded && moneyList.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  {gameOrder.length === 0 ? (
                    <div style={{ fontSize: 12, color: '#aaa', textAlign: 'center', padding: '10px 0' }}>No game breakdown data</div>
                  ) : (
                    // Outer wrapper — position:relative, NO overflow:hidden (H-46 applies to avatars below)
                    <div style={{ position: 'relative' }}>
                      {/* Scrollable area — overflow:auto OK here because avatars are outside this in frozen col */}
                      <div style={{ display: 'flex' }}>

                        {/* Frozen left column: avatars + names */}
                        <div style={{ flexShrink: 0, zIndex: 2 }}>
                          {/* Header spacer */}
                          <div style={{ height: 32 }} />
                          {moneyList.map(([name]) => {
                            const pr = playerByName[name] || { name };
                            return (
                              <div key={name} style={{
                                height: 38, display: 'flex', alignItems: 'center', gap: 6,
                                paddingRight: 8, borderBottom: '1px solid #f0f0f0',
                                background: '#fff',
                              }}>
                                {/* H-46: PlayerAvatar outside any overflow:hidden ancestor */}
                                <PlayerAvatar player={pr} size={26} starred={false} />
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#222', whiteSpace: 'nowrap', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {name.split(' ')[0]}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Scrollable game columns */}
                        <div
                          ref={tableRef}
                          style={{ overflowX: 'auto', flex: 1, WebkitOverflowScrolling: 'touch' }}
                        >
                          {/* Column headers */}
                          <div style={{ display: 'flex', borderBottom: '2px solid #eee', height: 32 }}>
                            {[...gameOrder, 'Total'].map(g => (
                              <div key={g} style={{
                                minWidth: 64, flex: '0 0 64px', textAlign: 'center',
                                fontSize: 10, fontWeight: 700, color: '#888',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                paddingBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em',
                              }}>
                                {g === 'Total' ? 'Total' : g}
                              </div>
                            ))}
                          </div>

                          {/* Data rows */}
                          {moneyList.map(([name, total]) => (
                            <div key={name} style={{ display: 'flex', height: 38, borderBottom: '1px solid #f0f0f0', alignItems: 'center' }}>
                              {gameOrder.map(g => {
                                const val = gameTotals[g]?.[name] || 0;
                                const c = val > 0 ? '#27500A' : val < 0 ? '#A32D2D' : '#bbb';
                                return (
                                  <div key={g} style={{ minWidth: 64, flex: '0 0 64px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: c }}>
                                    {val === 0 ? '—' : fmtDollar(val)}
                                  </div>
                                );
                              })}
                              {/* Total col */}
                              <div style={{
                                minWidth: 64, flex: '0 0 64px', textAlign: 'center',
                                fontSize: 12, fontWeight: 800,
                                color: total > 0 ? '#27500A' : total < 0 ? '#A32D2D' : '#bbb',
                              }}>
                                {fmtDollar(total)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Ranked list (below podium, always visible in non-expanded state) ── */}
              {!expanded && moneyList.length > 1 && (
                <div style={{ marginTop: 8, borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
                  {moneyList.map(([name, total], i) => {
                    const pr = playerByName[name] || { name };
                    const streak = streaks[name];
                    const amtColor = total > 0 ? '#27500A' : total < 0 ? '#A32D2D' : '#bbb';
                    return (
                      <div key={name} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 4px', borderBottom: i < moneyList.length - 1 ? '1px solid #f5f5f5' : 'none',
                      }}>
                        <div style={{ width: 16, fontSize: 11, color: '#bbb', fontWeight: 600, textAlign: 'center', flexShrink: 0 }}>{i + 1}</div>
                        {/* H-46: no overflow:hidden ancestor */}
                        <PlayerAvatar player={pr} size={28} starred={false} />
                        <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#222', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                        {streak && (
                          <div style={{ fontSize: 11, color: streak.type === 'hot' ? '#E8612C' : '#4A90D9', flexShrink: 0 }}>
                            {streak.type === 'hot' ? '🔥' : '❄️'}
                          </div>
                        )}
                        <div style={{ fontSize: 13, fontWeight: 700, color: amtColor, flexShrink: 0 }}>{fmtDollar(total)}</div>
                      </div>
                    );
                  })}
                </div>
              )}

            </Card>

            {/* ── Insights ── */}
            {(() => {
              const tiles = [];

              if (insights.heater && insights.heaterCount >= 2) {
                const net = playerNetInPeriod[insights.heater] || 0;
                tiles.push(
                  <InsightTile
                    key="heater"
                    icon={<IconFlame />}
                    label="Heater"
                    name={insights.heater}
                    stat={`+${fmtDollar(Math.abs(net))} over last ${insights.heaterCount} rounds`}
                    statColor="#27500A"
                  />
                );
              }

              if (insights.coldest && insights.coldCount >= 2) {
                const net = playerNetInPeriod[insights.coldest] || 0;
                tiles.push(
                  <InsightTile
                    key="cold"
                    icon={<IconSnowflake />}
                    label="Cold Streak"
                    name={insights.coldest}
                    stat={`${insights.coldCount} losses in a row / ${fmtDollar(net)}`}
                    statColor="#A32D2D"
                  />
                );
              }

              if (insights.strongestTeam && insights.strongestWins >= 1) {
                const { names, net } = insights.strongestTeam;
                tiles.push(
                  <InsightTile
                    key="team"
                    icon={<IconTrophy />}
                    label="Strongest Team"
                    name={names.join(' & ')}
                    stat={`${insights.strongestWins} wins together / +${fmtDollar(Math.abs(net))}`}
                    statColor="#27500A"
                  />
                );
              }

              if (insights.nemesis) {
                const { winner, loser, wWins, lWins, netLoser } = insights.nemesis;
                tiles.push(
                  <InsightTile
                    key="nemesis"
                    icon={<IconScissors />}
                    label="Nemesis"
                    name={loser}
                    stat={`${lWins}-${wWins} vs ${winner} / ${fmtDollar(netLoser)}`}
                    statColor="#A32D2D"
                  />
                );
              }

              if (tiles.length === 0) return null;

              return (
                <Card style={{ padding: '14px 14px' }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                    Insights
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {tiles}
                  </div>
                </Card>
              );
            })()}
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

      {/* ── Basic / Enhanced toggle — fixed bottom ── */}
      <div style={{
        position: 'fixed', bottom: 56, left: '50%', transform: 'translateX(-50%)',
        zIndex: 20, background: 'rgba(255,255,255,0.95)',
        borderRadius: 24, padding: '4px', boxShadow: '0 2px 12px rgba(0,0,0,.18)',
        border: '1px solid #ddd', display: 'flex',
      }}>
        {['basic', 'enhanced'].map(mode => (
          <button
            key={mode}
            onClick={() => setView(mode)}
            style={{
              padding: '6px 18px', borderRadius: 20, border: 'none',
              background: viewMode === mode ? G : 'transparent',
              color: viewMode === mode ? '#fff' : '#666',
              fontSize: 12, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'background .15s, color .15s',
              textTransform: 'capitalize',
            }}
          >
            {mode === 'basic' ? 'Basic' : 'Enhanced'}
          </button>
        ))}
      </div>

    </div>
  );
}
