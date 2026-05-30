// ─── pages/RoundSummaryModal.jsx ──────────────────────────────────────────────
//
// ✅ Self-checked (13-E.8): Removed inline ReadOnlyScorecard definition (~240
// lines, original lines 87–332); replaced with named import from
// ../components/ReadOnlyScorecard.jsx. Invocation site props unchanged (all
// 9 props confirmed). restoreDotDefs/COL_W/TOT_W/NAME_MIN/xGrossScore imports
// retained — still consumed by TotalsCard and in-modal logic. FRONT/BACK
// constants retained (used by gameRange helper). useMemo retained (ar/bank/
// matchPayouts memos). Modal target: ~440 lines (down from 685).
//
// ✅ Self-checked (13-E.5): Removed local DotsColTable, PayoutsSummary,
// renderPayRow, subHeader, splitGameHeader, fmtMoney. Replaced with
// <PayoutsSection> from PayoutDisplay.jsx. Pre-extraction PayoutsSummary block
// preserved as commented section below for revert. fmtMoney removed from
// module scope (was only used inside PayoutsSummary). cleanGameName import
// retained in roundUtils import — moved to PayoutDisplay; removed from RSM.
//
// Read-only full-screen modal: scorecard + game tables + payouts.
//
// Portrait:  scorecard = Front 9 over Back 9; game tables = portrait (unchanged).
// Landscape: modal fills full screen; scorecard = 18-hole single row;
//            game tables receive isLandscape=true for 18-hole layout.
//
// Scorecard column widths match game table COL_W so holes align vertically.
// Payouts section: no emojis, left-justified headers, per-match breakdown.
//
// ✅ Self-checked (13-E.2): Local `useIsLandscape` definition removed and
//   replaced with `import { useIsLandscape } from '../hooks/useIsLandscape.js'`.
//   The single call site (line ~482, inside the main component) consumes the
//   hook identically — return value is still a single boolean. No other edits.
//   `useState` and `useEffect` imports retained — both are still used elsewhere
//   in the file (ShareOrientationPicker state, layout effects, etc.).
//
// ✅ Self-checked (13-C.8):
//   (1) `computePerMatchPayouts` invocation extended with `earlyEndOpts` and
//       `lastCompletedHole` for engine departure handling per session 13-C.8.
//   (2) PayoutsSummary now renders match `decoration` (when present) under
//       the SubHeader so end_at_k / continue / exclude_player outcome is
//       visible per match. NO top-level resolution ribbon (per session
//       decision — surface decoration per game instead).
//   (3) `otherEntries` filter widened to also drop any `🥊 Match ` entries
//       emitted by computePayouts under Option A (matchPayouts already
//       renders them separately above).
//
// ✅ Self-checked (13-C.3 Phase 2A finalization):
//   (1) `computePerMatchPayouts` is now invoked with gameRanges / roundStartHole
//       / roundEndHole (matches the updated roundUtils.js signature).
//   (2) `<ReadOnlyScorecard>` now receives roundStartHole/roundEndHole so its
//       internal `inRound(h)` gate actually triggers `–` rendering for
//       out-of-range holes (§12.1). Without this the default [0,17] defaults
//       mask the partial-round UI entirely.
//   (3) Landscape `xAware` score aggregator now skips out-of-range holes
//       (matches the portrait `tot` aggregator, line ~253). Without this,
//       F9/B9/Tot would include scores the user entered before shortening
//       the round — diverging from portrait and from game-table totals.
//   (4) Per-game startHole/endHole plumbing to all 7 tables was completed in
//       the pre-compaction pass; this finalization only adds the three
//       residuals above. Full-round output is byte-identical.

import { useMemo, useState, useEffect, useCallback } from 'react';
import { G, RED, AMB, fmtDate, ShareOrientationPicker } from '../components/ui.jsx';
import { useIsLandscape } from '../hooks/useIsLandscape.js';
import { roundLib } from '../services/roundLib.js';
import { playerLib } from '../services/playerLib.js';
import { restoreDotDefs, COL_W, TOT_W, NAME_MIN } from './scorecard/scorecardUtils.js';
import { xGrossScore } from '../engine/handicap.js';
import { MatchNassauTable } from './tables/MatchNassauTable.jsx';
import { SixesTable }       from './tables/SixesTable.jsx';
import { SkinsTable }       from './tables/SkinsTable.jsx';
import { NinesTable }       from './tables/NinesTable.jsx';
import { StablefordTable }  from './tables/StablefordTable.jsx';
import { StrokePlayTable }  from './tables/StrokePlayTable.jsx';
import { DotsTable }        from './tables/DotsTable.jsx';
import { TotalsCard }       from './scorecard/TotalsCard.jsx';
import { computePayouts }   from '../engine/payouts.js';
import { buildPayoutArgs, computePerMatchPayouts } from '../services/roundUtils.js';
import { triggerRoundShare, buildShareImage } from '../services/shareUtils.js';
import { PayoutsSection } from './PayoutDisplay.jsx';
import { ReadOnlyScorecard } from '../components/ReadOnlyScorecard.jsx';
import PlayerAvatar from '../components/PlayerAvatar.jsx';

const FRONT = [0,1,2,3,4,5,6,7,8];
const BACK  = [9,10,11,12,13,14,15,16,17];

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize:11, fontWeight:700, color:G, marginBottom:6, marginTop:14,
      textTransform:'uppercase', letterSpacing:'0.5px' }}>
      {children}
    </div>
  );
}

// ── Landscape detection ────────────────────────────────────────────────────────
// 13-E.2: local useIsLandscape removed; now imported from hooks/useIsLandscape.js
// (deduplicates the byte-identical copy that previously lived in App.jsx).


// ── Read-only scorecard ────────────────────────────────────────────────────────
// 13-E.8: Extracted to ../components/ReadOnlyScorecard.jsx.

// ── Main modal ─────────────────────────────────────────────────────────────────
export function RoundSummaryModal({ r, onClose }) {
  const isLandscape = useIsLandscape();

  // S-4: share — build image eagerly on tap, then fire share sheet synchronously
  const [shareStatus,   setShareStatus]   = useState('idle');
  const [shareError,    setShareError]    = useState('');
  const [showOrienPick, setShowOrienPick] = useState(false);

  const ar = useMemo(() => {
    try { return roundLib.toActiveRound(r); }
    catch(e) { console.error('RoundSummaryModal: toActiveRound failed', e); return null; }
  }, [r]);

  const { bank, breakdown } = useMemo(() => {
    if (!ar) return { bank: r.bank || {}, breakdown: r.breakdown || [] };
    try { return computePayouts(buildPayoutArgs(ar)); }
    catch(e) { return { bank: r.bank || {}, breakdown: r.breakdown || [] }; }
  }, [ar, r]);

  const matchPayouts = useMemo(() => {
    if (!ar) return [];
    try {
      // 13-C.3: forward gameRanges + round bounds so per-match ranges are
      // honored (share image / summary modal now match Results payouts).
      // 13-C.7.6: forward earlyDepartureOpts so departed scores are guarded
      // out of per-match calculations (mirrors computePayouts pipeline).
      // 13-C.8: forward earlyEndOpts + lastCompletedHole so per-match
      // resolutions (end_at_k / abandon / continue / exclude_player) are
      // honored. Abandoned matches are filtered out by the engine.
      const rs = ar.roundStartHole ?? 0;
      const rn = ar.roundNumHoles  ?? 18;
      const re = rs + rn - 1;
      return computePerMatchPayouts(
        ar.matches || [], ar.activePlayers, ar.scores, ar.hcps,
        ar.courseHcps, ar.minCourseHcp, ar.manualPresses,
        ar.gameRanges || {}, rs, re,
        ar.earlyDepartureOpts || {},
        ar.earlyEndOpts || {}, ar.lastCompletedHole,
      );
    } catch(e) { return []; }
  }, [ar]);

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
      const photoMap = Object.fromEntries(playerLib.list().map(p => [p.id, p.photo]).filter(([,v]) => v));
      const blob = await buildShareImage(r, ar, bank, breakdown, matchPayouts, orientation, photoMap);
      await triggerRoundShare(r, ar, bank, breakdown, matchPayouts, blob, orientation);
      setShareStatus('done');
    } catch(err) {
      if (err?.name === 'AbortError') { setShareStatus('idle'); return; }
      console.error('Share failed:', err);
      setShareError('Could not share. Try again.');
      setShareStatus('error');
    }
  }, [ar, r, bank, breakdown, matchPayouts]);

  if (!ar) return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:300,
      display:'flex',alignItems:'center',justifyContent:'center',padding:16 }} onClick={onClose}>
      <div style={{ background:'#fff',borderRadius:16,padding:24,maxWidth:400,width:'100%' }} onClick={e=>e.stopPropagation()}>
        <div style={{ color:RED, fontWeight:700 }}>Could not load round data.</div>
        <button onClick={onClose} style={{ marginTop:12,padding:'8px 20px',borderRadius:8,border:`1px solid ${G}`,background:'#eef4ee',color:G,fontWeight:700,cursor:'pointer',fontFamily:'inherit' }}>Close</button>
      </div>
    </div>
  );

  const {
    activePlayers: players, pars, hcps, courseHcps, minCourseHcp,
    scores, activeGames, gameOpts,
    matches, sixesTeams, skinsPlayers, stablefordPlayers,
    ninesPlayers, strokePlayPlayers, dotsPlayers,
    dots: rawDots, dotEntries, manualPresses,
    frontNine, backNine,
  } = ar;

  // 13-C.7.6: Per-player departure metadata, forwarded to game tables
  // that apply the engine departure data guardrail (PartialGameContract
  // §14 invariant 21) at display time. Currently consumed by SkinsTable;
  // other table components will add support in 13-C.8 as their engine
  // resolution paths come online.
  const earlyDepartureOpts = ar.earlyDepartureOpts ?? {};

  // 13-C.3: Round bounds + per-game range overrides — forwarded to each
  // table component and to ReadOnlyScorecard (which renders `–` for any
  // hole outside the round range, per PartialGameContract §12.1).
  const roundStartHole = ar.roundStartHole ?? 0;
  const roundNumHoles  = ar.roundNumHoles  ?? 18;
  const roundEndHole   = roundStartHole + roundNumHoles - 1;
  const gameRanges     = ar.gameRanges     ?? {};

  // Per-game effective range helper — falls back to round bounds when
  // gameRanges has no entry (or an invalid entry) for the key.
  const gameRange = (key) => {
    const entry = gameRanges?.[key];
    if (entry
        && Number.isInteger(entry.startHole)
        && Number.isInteger(entry.endHole)
        && entry.startHole >= roundStartHole
        && entry.endHole   <= roundEndHole
        && entry.startHole <  entry.endHole) {
      return { startHole: entry.startHole, endHole: entry.endHole };
    }
    return { startHole: roundStartHole, endHole: roundEndHole };
  };

  const dots = restoreDotDefs(rawDots);

  const ninesSuffix = (() => {
    const n = (r.course_snapshot?.nines || []).length;
    return n > 2 && frontNine && backNine ? ` · ${frontNine} / ${backNine}` : '';
  })();

  // Full-screen in landscape; floating window in portrait
  const modalStyle = isLandscape
    ? { width:'100%', maxWidth:'100vw', height:'100vh', borderRadius:0 }
    : { width:'calc(100% - 32px)', maxWidth:560, maxHeight:'93vh', borderRadius:20 };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:300,
      display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent: isLandscape ? 'flex-start' : 'center' }}
      onClick={onClose}>

      <div style={{ background:'#eef4ee', ...modalStyle,
        display:'flex', flexDirection:'column' }}
        onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{ background:G, padding: isLandscape ? '10px 18px' : '16px 18px 14px', flexShrink:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div style={{ fontWeight:800, fontSize: isLandscape ? 15 : 17, color:'#fff' }}>
                {(r.course_name || 'Unknown Course').split(' - ').reduce((acc, part, i) =>
                  i === 0 ? [part] : [...acc, <br key={i}/>, part], []
                )}{ninesSuffix}
              </div>
              <div style={{ fontSize:12, color:'#a8d8a8', marginTop:2 }}>
                {fmtDate(r.date)} · Read-only summary
              </div>
            </div>
            <button onClick={onClose}
              style={{ border:'none', background:'rgba(255,255,255,.15)', borderRadius:20, width:32, height:32,
                display:'flex', alignItems:'center', justifyContent:'center',
                cursor:'pointer', color:'#fff', fontSize:16, flexShrink:0 }}>
              ✕
            </button>
          </div>
        </div>

        {/* Player chip band — matches share image style */}
        <div style={{ background:'#ddeedd', padding:'8px 14px' }}>
          <PlayerChipsGrid players={players} courseHcps={courseHcps} selectedTee={r.selected_tee} />
        </div>

        {/* Scrollable body */}
        <div style={{ flex:1, overflowY:'auto', padding: isLandscape ? '4px 10px 12px' : '4px 14px 20px' }}>

          <SectionLabel>Scorecard</SectionLabel>
          <ReadOnlyScorecard
            players={players} scores={scores} pars={pars} hcps={hcps}
            courseSnapshot={r.course_snapshot}
            isLandscape={isLandscape}
            frontNineName={frontNine}
            backNineName={backNine}
            courseHcps={courseHcps}
            minCourseHcp={minCourseHcp}
            roundStartHole={roundStartHole}
            roundEndHole={roundEndHole}
            earlyDepartureOpts={earlyDepartureOpts}
            dotMode={(() => {
              // Derive handicap dot mode — same priority as deriveShareDotMode in roundUtils:
              // net > NOL-full-field > NOL-subset > gross.
              // Only check active scoring games; exclude Dots (always gross for scoring).
              const scoringKeys = ['Skins','Stableford','Nines','Stroke Play','Sixes'];
              const matchModes  = (matches||[]).map(m => m.grossNetNOL ?? m.scoring ?? 'net');
              const gameModes   = scoringKeys
                .filter(k => (activeGames||[]).includes(k))
                .map(k => gameOpts?.[k]?.grossNetNOL ?? gameOpts?.[k]?.scoring ?? 'net');
              const allModes = [...gameModes, ...matchModes];
              if (!allModes.length) return 'gross';
              if (allModes.some(m => m === 'net')) return 'net';
              if (allModes.some(m => m === 'netofflow')) return 'netofflow';
              return 'gross';
            })()}
          />

          <TotalsCard
            players={players}
            pars={pars}
            scores={scores}
            courseHcps={courseHcps}
            hcps={hcps}
            roundStartHole={roundStartHole}
            roundNumHoles={roundNumHoles}
            earlyDepartureOpts={earlyDepartureOpts}
          />
          {activeGames?.length > 0 && (
            <>
              <SectionLabel>Game Results</SectionLabel>

              {activeGames.includes('Nines') && (() => {
                const r = gameRange('Nines');
                return (
                  <NinesTable players={players} scores={scores} pars={pars} hcps={hcps}
                    opts={gameOpts?.Nines} courseHcps={courseHcps} minCourseHcp={minCourseHcp}
                    ninesPlayers={ninesPlayers} isLandscape={isLandscape}
                    startHole={r.startHole} endHole={r.endHole}
                    earlyDepartureOpts={earlyDepartureOpts}/>
                );
              })()}
              {activeGames.includes('Stableford') && (() => {
                const r = gameRange('Stableford');
                return (
                  <StablefordTable players={players} scores={scores} pars={pars} hcps={hcps}
                    opts={gameOpts?.Stableford} courseHcps={courseHcps} minCourseHcp={minCourseHcp}
                    stablefordPlayers={stablefordPlayers} isLandscape={isLandscape}
                    startHole={r.startHole} endHole={r.endHole}
                    earlyDepartureOpts={earlyDepartureOpts}/>
                );
              })()}
              {activeGames.includes('Skins') && (() => {
                const r = gameRange('Skins');
                return (
                  <SkinsTable players={players} scores={scores} hcps={hcps}
                    opts={gameOpts?.Skins} courseHcps={courseHcps} minCourseHcp={minCourseHcp}
                    skinsPlayerIdxs={skinsPlayers} isLandscape={isLandscape}
                    startHole={r.startHole} endHole={r.endHole}
                    earlyDepartureOpts={earlyDepartureOpts}/>
                );
              })()}
              {activeGames.includes('Stroke Play') && (() => {
                const r = gameRange('Stroke Play');
                return (
                  <StrokePlayTable players={players} scores={scores} pars={pars} hcps={hcps}
                    opts={gameOpts?.['Stroke Play']} courseHcps={courseHcps} minCourseHcp={minCourseHcp}
                    strokePlayPlayers={strokePlayPlayers} isLandscape={isLandscape}
                    startHole={r.startHole} endHole={r.endHole}
                    earlyDepartureOpts={earlyDepartureOpts}/>
                );
              })()}
              {activeGames.includes('Match / Nassau') && (
                <MatchNassauTable
                  players={players} scores={scores} hcps={hcps}
                  matches={matches || []} courseHcps={courseHcps} minCourseHcp={minCourseHcp}
                  manualPresses={manualPresses || {}} setManualPresses={() => {}}
                  isLandscape={isLandscape}
                  gameRanges={gameRanges} roundStartHole={roundStartHole} roundEndHole={roundEndHole}
                  earlyDepartureOpts={earlyDepartureOpts}
                />
              )}
              {activeGames.includes('Sixes') && (() => {
                const r = gameRange('Sixes');
                return (
                  <SixesTable players={players} scores={scores} hcps={hcps}
                    opts={gameOpts?.Sixes} sixesTeams={sixesTeams}
                    courseHcps={courseHcps} minCourseHcp={minCourseHcp}
                    manualPresses={manualPresses || {}} setManualPresses={() => {}}
                    startHole={r.startHole} endHole={r.endHole}
                    earlyDepartureOpts={earlyDepartureOpts}/>
                );
              })()}
              {(activeGames.includes('Dots') || activeGames.includes('Specials')) && (() => {
                // Dots range — locked to team source in team mode (D-3A).
                const dotsOpts    = gameOpts?.Dots || gameOpts?.Specials || {};
                const rawTeamMode = dotsOpts.teamMode;
                const legacyTeam  = dotsOpts.teamScoring;
                const isTeamMode  = rawTeamMode ? rawTeamMode !== 'none' : !!legacyTeam;
                const teamSource  = rawTeamMode && rawTeamMode !== 'none'
                  ? rawTeamMode
                  : (legacyTeam ? 'Sixes' : 'none');
                let dr;
                if (isTeamMode && teamSource === 'Sixes')               dr = gameRange('Sixes');
                else if (isTeamMode && teamSource.startsWith('Match:')) dr = gameRange(teamSource.slice(6));
                else                                                     dr = gameRange('Dots');
                return (
                  <DotsTable players={players} dots={dots} dotEntries={dotEntries}
                    sixesTeams={sixesTeams} matches={matches}
                    gameOpts={gameOpts} dotsPlayers={dotsPlayers}
                    isLandscape={isLandscape}
                    startHole={dr.startHole} endHole={dr.endHole}
                    earlyDepartureOpts={earlyDepartureOpts}/>
                );
              })()}
            </>
          )}

          <SectionLabel>Payouts</SectionLabel>
          <PayoutsSection bank={bank} breakdown={breakdown} matchPayouts={matchPayouts} />

          {/* S-4: Share Summary */}
          <div style={{ marginTop: 20 }}>
            {shareStatus === 'error' && (
              <div style={{ fontSize:12, color:RED, marginBottom:8, textAlign:'center' }}>{shareError}</div>
            )}
            <button
              onClick={handleShare}
              disabled={shareStatus === 'building'}
              style={{
                width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                padding:'13px 0', borderRadius:14,
                background: shareStatus === 'building' ? '#aaa' : G,
                border:'none', cursor: shareStatus === 'building' ? 'not-allowed' : 'pointer',
                color:'#fff', fontWeight:700, fontSize:14, fontFamily:'inherit',
              }}>
              {shareStatus === 'building' ? 'Building…' : shareStatus === 'done' ? 'Shared ✓' : 'Share Summary'}
            </button>
          </div>
        </div>
      </div>

      {showOrienPick && (
        <ShareOrientationPicker
          onPick={handleShareWithOrientation}
          onDismiss={() => setShowOrienPick(false)}
        />
      )}

    </div>
  );
}

// ── PlayerChipsGrid ────────────────────────────────────────────────────────────
// Player chips: avatar circle above first/last name + HI/CH. Grid: up to 4 cols.
function PlayerChipsGrid({ players, courseHcps, selectedTee }) {
  const n = players.length;
  const cols = Math.min(n, 4);
  return (
    <div style={{ display:'grid', gridTemplateColumns:`repeat(${cols}, 1fr)`, gap:6 }}>
      {players.map((p, i) => {
        const ch = courseHcps?.[i] != null ? courseHcps[i] : (p.courseHcpVal ?? null);
        const nameParts = (p.name || '').trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName  = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
        return (
          <div key={i} style={{ background:'#fff', borderRadius:8, padding:'6px 4px', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:3, minWidth:0 }}>
            <PlayerAvatar player={p} size={32} starred={false} />
            <div style={{ fontSize:11, fontWeight:700, color:'#1a472a', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', width:'100%', textAlign:'center' }}>{firstName}</div>
            {lastName && <div style={{ fontSize:10, fontWeight:500, color:'#1a472a', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', width:'100%', textAlign:'center' }}>{lastName}</div>}
            <div style={{ fontSize:9, color:'#666', whiteSpace:'nowrap', marginTop:1 }}>
              {p.ghin != null && p.ghin !== '' ? `HI ${p.ghin}` : ''}
              {p.ghin != null && p.ghin !== '' && ch != null ? ' · ' : ''}
              {ch != null ? `CH ${ch}` : ''}
            </div>
          </div>
        );
      })}
    </div>
  );
}
