// ─── ResultsPage.jsx ──────────────────────────────────────────────────────────
//
// ✅ Self-checked (15-C): Renamed "Results" → "Payouts" in header. Player chips
// replaced with initial-circle + name + net amount, sorted win-to-loss, 2-col
// for 2/4 players, 3-col for 3. Settlement tile added above PayoutsSection —
// derives minimal payment set via greedy debt simplification (buildSettlements).
// bank keyed by player name; net derived from bank[p.name] with null guard.
// All prior self-check notes from 13-E.5 and 13-C.8 retained below.
//
// ✅ Self-checked (13-E.5): Removed local DotsColTable, SubHeader, PayRow,
// splitGameHeader, fmtMoney, SectionLabel, ResultsDisplay. Replaced with
// <PayoutsSection> from PayoutDisplay.jsx. Pre-extraction ResultsDisplay
// (green-card totals + SectionLabel styling) preserved as commented block
// below for revert if visual rework prefers original. RED retained for
// saveMsg/shareError inline styles outside the payout section. Card retained
// for no-scores placeholder. cleanGameName import removed (now internal to
// PayoutDisplay).
//
// ✅ Self-checked (13-C.8):
//   (1) `computePerMatchPayouts` invocation extended with `earlyEndOpts` and
//       `lastCompletedHole` so Results-page Match payouts honor engine
//       departure resolutions (end_at_k / abandon / continue / exclude_player).
//   (2) Match SubHeader now renders `match.decoration` as a styled secondary
//       line under the label when present (resolution outcome description).
//   (3) `otherEntries` filter widened to also drop any per-match `🥊 Match `
//       entries emitted by computePayouts under Option A (matchPayouts list
//       above renders them separately).
//   (4) Non-match game headers also render a decoration line when the game
//       string contains a ` — ` resolution suffix appended by computePayouts.
//
// ✅ Self-checked (13-C.3 Phase 2A finalization):
//   (1) `computePerMatchPayouts` is now invoked with gameRanges / roundStartHole /
//       roundEndHole per the updated roundUtils.js signature, so Results-page
//       Match payouts honor per-match custom ranges. Full-round rounds (no
//       gameRanges entries) remain byte-identical: runMatchNassau short-circuits
//       on the default range argument per invariant #13.
//   (2) Match rendering now detects `match.colHeaders` and routes through the
//       same `DotsColTable` used for Stroke Play / Stableford / Nines (Nassau)
//       segment displays. Each Match A/B/... renders one row per player with
//       F / B / O / Total columns. Legacy fallback (PayRow + tie banner) kept
//       for matches without colHeaders (backward-compat for older history
//       records).

import { useState, useCallback } from 'react';
import { Btn, Card, G, RED, ShareOrientationPicker } from '../components/ui.jsx';
import { computePerMatchPayouts } from '../services/roundUtils.js';
import { triggerRoundShare, buildShareImage } from '../services/shareUtils.js';
import { roundLib } from '../services/roundLib.js';
import { PayoutsSection } from './PayoutDisplay.jsx';

// Layout constants — must match App.jsx
const NAV_BAR_HEIGHT    = 68;
const ACTION_BAR_HEIGHT = 52;

// ── buildSettlements ──────────────────────────────────────────────────────────
// Greedy debt simplification — fewest transactions.
// Returns array of { from, to, amount } sorted by amount desc.
function buildSettlements(bank) {
  if (!bank) return [];
  const entries = Object.entries(bank).filter(([, v]) => v !== 0);
  if (!entries.length) return [];

  // Work in cents to avoid float drift
  const balances = entries.map(([name, v]) => ({ name, bal: Math.round(v * 100) }));
  const debtors   = balances.filter(x => x.bal < 0).sort((a, b) => a.bal - b.bal); // most negative first
  const creditors = balances.filter(x => x.bal > 0).sort((a, b) => b.bal - a.bal); // most positive first

  const result = [];
  let di = 0, ci = 0;
  while (di < debtors.length && ci < creditors.length) {
    const d = debtors[di];
    const c = creditors[ci];
    const amount = Math.min(-d.bal, c.bal);
    if (amount > 0) {
      result.push({ from: d.name, to: c.name, amount: amount / 100 });
    }
    d.bal += amount;
    c.bal -= amount;
    if (d.bal === 0) di++;
    if (c.bal === 0) ci++;
  }

  return result.sort((a, b) => b.amount - a.amount);
}

// ── PlayerInitial ─────────────────────────────────────────────────────────────
// Colored circle with player initial — matches PlayerPickerPopup treatment.
const CHIP_COLORS = ['#1a472a', '#2c5f8a', '#7b3f00', '#6b2d8b', '#8a4a00', '#2d6b5a'];
function PlayerInitial({ name, index, size = 36 }) {
  const initial = (name || '?')[0].toUpperCase();
  const bg = CHIP_COLORS[index % CHIP_COLORS.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bg, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.44, fontWeight: 700, flexShrink: 0,
      fontFamily: 'inherit',
    }}>
      {initial}
    </div>
  );
}

function getMissingScoresError(scores, activePlayers, roundStartHole = 0, roundNumHoles = 18) {
  const rsh = roundStartHole ?? 0;
  const reh = rsh + (roundNumHoles ?? 18) - 1;
  const numPlayers = (activePlayers || []).length;
  const byPlayer   = {};

  for (let h = rsh; h <= reh; h++) {
    for (let pi = 0; pi < numPlayers; pi++) {
      const val = scores?.[h]?.[pi];
      if (val === '' || val === null || val === undefined) {
        const name = activePlayers[pi]?.name || `Player ${pi + 1}`;
        if (!byPlayer[name]) byPlayer[name] = [];
        byPlayer[name].push(h + 1);
      }
    }
  }

  if (Object.keys(byPlayer).length === 0) return null;

  const lines = Object.entries(byPlayer).map(([name, holes]) => {
    const holeList = holes.length <= 6
      ? `hole${holes.length > 1 ? 's' : ''} ${holes.join(', ')}`
      : `${holes.length} holes`;
    return `${name}: missing ${holeList}`;
  });
  return `Scores incomplete — cannot save.\n${lines.join('\n')}`;
}

export default function ResultsPage({ getActiveRound, onSave, onBack }) {
  const [saveMsg,        setSaveMsg]        = useState('');
  const [shareStatus,    setShareStatus]    = useState('idle');
  const [shareError,     setShareError]     = useState('');
  const [showOrienPick,  setShowOrienPick]  = useState(false);
  const ar = getActiveRound();

  const matchPayouts = (() => {
    if (!ar) return [];
    if (!(ar.activeGames || []).includes('Match / Nassau')) return [];
    try {
      const rs = ar.roundStartHole ?? 0;
      const rn = ar.roundNumHoles  ?? 18;
      const re = rs + rn - 1;
      return computePerMatchPayouts(
        ar.matches || [], ar.activePlayers, ar.scores, ar.hcps,
        ar.courseHcps, ar.minCourseHcp, ar.manualPresses || {},
        ar.gameRanges || {}, rs, re,
        ar.earlyDepartureOpts || {},
        ar.earlyEndOpts || {}, ar.lastCompletedHole,
      );
    } catch(e) {
      console.error('ResultsPage: computePerMatchPayouts failed', e);
      return [];
    }
  })();

  const handleShare = useCallback(() => {
    if (!ar) return;
    setShowOrienPick(true);
  }, [ar]);

  const handleShareWithOrientation = useCallback(async (orientation) => {
    if (!ar) return;
    setShowOrienPick(false);
    setShareStatus('building');
    setShareError('');
    try {
      const rShim = { ...roundLib.fromActiveRound(ar), id: ar.roundId || undefined };
      const blob  = await buildShareImage(rShim, ar, ar.bank || {}, ar.breakdown || [], matchPayouts, orientation);
      await triggerRoundShare(rShim, ar, ar.bank || {}, ar.breakdown || [], matchPayouts, blob, orientation);
      setShareStatus('done');
    } catch(err) {
      if (err?.name === 'AbortError') { setShareStatus('idle'); return; }
      console.error('Share failed:', err);
      setShareError('Could not share. Try again.');
      setShareStatus('error');
    }
  }, [ar, matchPayouts]);

  if (!ar) {
    return (
      <div style={{ padding: 40, textAlign:'center', color:'#aaa' }}>
        <div>No active round.</div>
        <Btn onClick={onBack} style={{ marginTop: 16 }}>← Back</Btn>
      </div>
    );
  }

  const { activePlayers, breakdown, bank, courseHcps } = ar;
  const hasScores    = (ar.scores || []).some(r => r.some(s => s !== ''));
  const missingError = getMissingScoresError(ar.scores, activePlayers, ar.roundStartHole ?? 0, ar.roundNumHoles ?? 18);
  const canSave      = hasScores && !missingError;

  const handleSave = () => {
    setSaveMsg('');
    if (missingError) { setSaveMsg('Error: ' + missingError); return; }
    try {
      onSave();
      setSaveMsg('Saved! View in History tab.');
      setTimeout(() => setSaveMsg(''), 6000);
    } catch(e) {
      setSaveMsg(`Save failed: ${e.message}`);
    }
  };

  const n = (activePlayers || []).length;

  // Build sorted player list: highest net first
  const sortedPlayers = (activePlayers || [])
    .map((p, i) => ({ ...p, originalIndex: i, net: (bank || {})[p.name] ?? 0 }))
    .sort((a, b) => b.net - a.net);

  // Grid columns: 3 for exactly 3 players, 2 otherwise
  const chipCols = n === 3 ? 3 : 2;

  // Settlement transfers
  const settlements = buildSettlements(bank || {});

  const bottomClearance = NAV_BAR_HEIGHT + ACTION_BAR_HEIGHT + 30;
  const actionBarBottom = NAV_BAR_HEIGHT;

  return (
    <div style={{ minHeight:'100vh', background:'#eef4ee' }}>

      {/* Sticky header */}
      <div style={{ background:G, padding:'8px 16px 7px', position:'sticky', top:0, zIndex:10, boxShadow:'0 2px 12px rgba(0,0,0,.2)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <img src="/logo_lockup.png" alt="The Card" style={{ height:58, width:'auto', display:'block' }} />
        <div style={{ color:'#fff', fontWeight:800, fontSize:16, letterSpacing:'0.12em', textTransform:'uppercase', fontFamily:'inherit' }}>Payouts</div>
      </div>

      {/* Scrollable content */}
      <div style={{ padding:'14px 14px', maxWidth:520, margin:'0 auto', paddingBottom:`calc(${bottomClearance}px + env(safe-area-inset-bottom))` }}>

        {/* Player outcome rail */}
            borderRadius: 18,
            padding: '14px 14px 13px',
            boxShadow: '0 2px 8px rgba(0,0,0,.05)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <PlayerInitial name={p.name} index={p.originalIndex} size={38} />

            <div style={{ minWidth:0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#1d1d1d',
                  lineHeight: 1.2,
                  wordBreak: 'break-word',
                }}
              >
                {p.name}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div
              style={{
                fontSize: 11,
                color: '#8b8b8b',
                fontWeight: 600,
                letterSpacing: '.04em',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              Net
            </div>

            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: '-0.03em',
                color: isPositive
                  ? '#1f8f4e'
                  : isNegative
                  ? RED
                  : '#666',
              }}
            >
              {net > 0
                ? `+$${net.toFixed(2)}`
                : net < 0
                ? `-$${Math.abs(net).toFixed(2)}`
                : '$0'}
            </div>
          </div>
        </div>
      );
    })}
  </div>
)}

        {/* Settlement tile */}
            fontWeight: 700,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: '#7c8b7f',
            marginBottom: 2,
          }}
        >
          Settlement
        </div>

        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#1d1d1d',
          }}
        >
          Simplified payouts
        </div>
      </div>

      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: '#edf6ee',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M4 12h16" stroke="#1a472a" strokeWidth="2" strokeLinecap="round"/>
          <path d="M14 6l6 6-6 6" stroke="#1a472a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>

    {settlements.map((s, i) => (
      <div
        key={i}
        style={{
          display:'flex',
          alignItems:'center',
          justifyContent:'space-between',
          padding:'10px 0',
          borderTop: i === 0 ? 'none' : '1px solid #edf3ed',
        }}
      >
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#d5e8d8',
            }}
          />

          <div
            style={{
              fontSize: 14,
              color: '#2d2d2d',
              fontWeight: 600,
            }}
          >
            {s.from}
            <span style={{ color:'#98a298', margin:'0 8px', fontWeight:500 }}>
              pays
            </span>
            {s.to}
          </div>
        </div>

        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            color: RED,
            letterSpacing: '-0.02em',
          }}
        >
          ${s.amount.toFixed(2)}
        </div>
      </div>
    ))}
  </div>
)}
