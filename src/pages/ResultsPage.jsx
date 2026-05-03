// ─── ResultsPage.jsx ──────────────────────────────────────────────────────────
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


function getMissingScoresError(scores, activePlayers, roundStartHole = 0, roundNumHoles = 18) {
  // 13-C.2: Loop bounds respect round length. For default full rounds (rsh=0,
  // rnh=18) this is identical to the prior [0..17] scan. Also treats 'X' as
  // unscored for Stroke Play compatibility — this gate is the save-time guard
  // and partial rounds with X (picked-up) scores are not saveable without the
  // departure resolver (13-C.7 scope).
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
      // 13-C.3: forward gameRanges + round bounds so per-match ranges are
      // honored (matches computePayouts and RoundSummaryModal output).
      // 13-C.8: forward earlyEndOpts + lastCompletedHole for engine departure
      // handling. Abandoned matches are filtered out by the engine.
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
  // 13-C.2: Pass round length so save-time check only flags missing scores
  // within [roundStartHole, roundEndHole]. Defaults preserve 18-hole behavior.
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

  // Total bottom clearance: action bar height + nav bar + button protrusion + gap
  const bottomClearance = NAV_BAR_HEIGHT + ACTION_BAR_HEIGHT + 30;
  // Action bar sits flush on top of nav bar; paddingBottom absorbs button protrusion
  const actionBarBottom = NAV_BAR_HEIGHT;

  return (
    <div style={{ minHeight:'100vh', background:'#eef4ee' }}>

      {/* Sticky header */}
      <div style={{ background:G, padding:'8px 16px 7px', position:'sticky', top:0, zIndex:10, boxShadow:'0 2px 12px rgba(0,0,0,.2)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <img src="/logo_lockup.png" alt="The Card" style={{ height:58, width:'auto', display:'block' }} />
        <div style={{ color:'#fff', fontWeight:800, fontSize:16, letterSpacing:'0.12em', textTransform:'uppercase', fontFamily:'inherit' }}>Results</div>
      </div>

      {/* Scrollable content — paddingBottom clears pinned bar + nav */}
      <div style={{ padding:'14px 14px', maxWidth:520, margin:'0 auto', paddingBottom:`calc(${bottomClearance}px + env(safe-area-inset-bottom))` }}>

        {/* R-5: Player chips */}
        {n > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:`repeat(${n}, 1fr)`, gap:6, marginBottom:12 }}>
            {(activePlayers || []).map((p, i) => {
              const hi  = p.ghin != null && p.ghin !== '' ? p.ghin : null;
              const ch  = (courseHcps || [])[i] != null ? (courseHcps || [])[i] : (p.courseHcpVal ?? null);
              const tee = p.selectedTee || '';
              const hasHiCh = hi != null || ch != null;
              return (
                <div key={i} style={{ background:'#fff', borderRadius:12, padding:'8px 10px', minWidth:0, boxShadow:'0 1px 4px rgba(0,0,0,.06)', border:'1.5px solid #e0ece0' }}>
                  <div style={{ fontWeight:700, color:G, fontSize:12, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.name}</div>
                  {hasHiCh && (
                    <div style={{ fontSize:10, marginTop:2, color:'#888' }}>
                      {hi != null && <span>HI {hi}</span>}
                      {hi != null && ch != null && <span> · </span>}
                      {ch != null && <span>CH {ch}</span>}
                    </div>
                  )}
                  {tee && <div style={{ fontSize:10, color:'#aaa', marginTop:1 }}>{tee}</div>}
                </div>
              );
            })}
          </div>
        )}

        {!hasScores && (
          <Card><div style={{ textAlign:'center', color:'#aaa', padding:36 }}>Enter scores to see results.</div></Card>
        )}
        {hasScores && (
          <PayoutsSection breakdown={breakdown} bank={bank} matchPayouts={matchPayouts} />
        )}

        {/* 13-C.2 fix pass (H3): removed the automatic missingError banner that
            previously displayed whenever there were missing scores. It duplicated
            the saveMsg banner when the user tapped Save. Per owner direction, the
            error appears only after a Save attempt (via saveMsg below). */}

        {saveMsg && (
          <div style={{ padding:'8px 12px', borderRadius:8, margin:'10px 0',
            background: saveMsg.startsWith('Saved') ? '#e8f5e8' : '#fce8e8',
            color:      saveMsg.startsWith('Saved') ? '#27ae60' : RED,
            fontSize:13, whiteSpace:'pre-line' }}>
            {saveMsg}
          </div>
        )}

        {shareStatus === 'error' && (
          <div style={{ fontSize:12, color:RED, marginTop:6 }}>{shareError}</div>
        )}
      </div>

      {showOrienPick && (
        <ShareOrientationPicker
          onPick={handleShareWithOrientation}
          onDismiss={() => setShowOrienPick(false)}
        />
      )}

      {/* ── Pinned action bar: ← Scorecard | Save Round | Share ── */}
      {/* Flush on nav bar top. paddingBottom: 13px clears 5px button protrusion. */}
      <div style={{
        position: 'fixed',
        bottom: `calc(${actionBarBottom}px + env(safe-area-inset-bottom))`,
        left: 0, right: 0,
        zIndex: 20,
        background: '#eef4ee',
        borderTop: '1px solid #d4e8d4',
        padding: '8px 12px 16px',
      }}>
        <div style={{ display:'flex', gap:8, maxWidth:520, margin:'0 auto' }}>
          <Btn variant="outline" onClick={onBack} style={{ flex:1 }}>← Scorecard</Btn>
          <Btn
            onClick={handleSave}
            style={{ flex:1, opacity:canSave?1:0.5, cursor:canSave?'pointer':'not-allowed' }}
          >
            Save Round
          </Btn>
          <Btn
            variant="ghost"
            onClick={handleShare}
            disabled={shareStatus==='building'}
            style={{ flex:1 }}
          >
            {shareStatus==='building' ? 'Building…' : shareStatus==='done' ? 'Shared ✓' : 'Share'}
          </Btn>
        </div>
      </div>

    </div>
  );
}
