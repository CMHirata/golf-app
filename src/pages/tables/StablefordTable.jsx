// ─── tables/StablefordTable.jsx ───────────────────────────────────────────────
// ✅ Self-checked (13-G.2): scoreHole now reads per-player siArray for both the
// xGrossScore X substitution and the stabPts rank arg (Handicap_Contract §5).
// Fallback to round-shared hcps for legacy reloaded rounds where players[pi]
// lacks siArray.
//
// RENDER ONLY — no business logic in this file.
// No scoring calculations. No match state computation.
// All logic must come from engine/ or scorecardUtils.js
//
// ✅ Self-checked (13-C.8): individual-mode activeIdxs now filtered to exclude
// players with `exclude_player` resolution for Stableford (PartialGameContract
// §11.3 / §6.1 pool-family). Team mode is Match-family — exclude_player is
// rejected by the resolver UI for team Stableford so the filter is omitted
// there. Mirrors engine reader in payouts.js.
//
// ✅ Self-checked (13-C.3): Accepts startHole/endHole props (default 0/17).
// Both individual and team modes use range-derived FRONT/BACK arrays.
// Half labels changed "Front 9 / Back 9" → "Front / Back". Single-half
// landscape renders a 9-column table (Q5). PartialGameContract §2.4.

import { stabPts, xGrossScore } from '../../engine/handicap.js';
import { S, nameTd, scoringLabel, applyDepartureGuardrailToScores } from '../scorecard/scorecardUtils.js';
import { GameSection, GameTable, HalfLabel, TableDivider, PlayerChips } from '../scorecard/GameSection.jsx';
import { RED } from '../../components/ui.jsx';

// Color token for a Stableford point value
const vColor = v => v === null ? '#ccc' : v >= 3 ? '#27ae60' : v === 0 ? RED : '#555';

export function StablefordTable({
  players, scores, pars, hcps, opts, courseHcps, minCourseHcp, stablefordPlayers, isLandscape,
  startHole = 0, endHole = 17,
  // 13-C.7.6: Engine departure data guardrail (PartialGameContract §14
  // invariant 21). Filters scores past departureHole before any aggregation.
  earlyDepartureOpts = {},
}) {
  // 13-C.7.6: Apply guardrail before any score aggregation.
  scores = applyDepartureGuardrailToScores(scores, earlyDepartureOpts, players.length);

  const mode     = opts?.grossNetNOL ?? 'net';
  const format   = opts?.format ?? 'individual';
  const isTeam   = format === 'team';
  const teamA    = opts?.teamA ?? [];
  const teamB    = opts?.teamB ?? [];
  const scoring  = opts?.scoring ?? 'cumulative';

  // ── Participant set and NOL baseline ─────────────────────────────────────────
  // 13-C.8: in individual mode (Pool-family), filter out players with
  // `exclude_player` resolution per PartialGameContract §11.3 / §6.1. Team
  // mode is Match-family — exclude_player is rejected by the resolver UI
  // and ignored here.
  const activeIdxs = isTeam
    ? [...teamA, ...teamB]
    : (stablefordPlayers?.length ? stablefordPlayers : players.map((_, i) => i))
        .filter(pi =>
          earlyDepartureOpts?.[pi]?.gameResolutions?.['Stableford']?.topLevel !== 'exclude_player'
        );

  const displayMin = (mode === 'netofflow' && activeIdxs.length)
    ? Math.min(...activeIdxs.map(i => courseHcps[i]))
    : minCourseHcp;

  // Per-hole points for one player
  // 'X' = player picked up — substitute xGrossScore per Stableford_Contract X Score Behavior
  // 13-G.2: Use per-player siArray from players[pi].siArray (Handicap_Contract §5).
  // Fallback to round-shared hcps for legacy reloaded rounds.
  const scoreHole = (pi, h) => {
    const raw = scores[h]?.[pi];
    if (raw === '' || raw == null) return null;
    const siA = players[pi]?.siArray && players[pi].siArray.length === 18 ? players[pi].siArray : hcps;
    const g = raw === 'X' ? xGrossScore(h, courseHcps[pi], siA, pars) : parseInt(raw);
    if (!g) return null;
    return stabPts(g, pars[h], courseHcps[pi], siA[h], displayMin, mode, opts?.stabTable);
  };

  // 13-C.3: Range-derived hole arrays. Full round → identical to pre-13-C.3 constants.
  const frontHoles = []; const backHoles = [];
  for (let h = startHole; h <= endHole; h++) {
    if (h < 9) frontHoles.push(h); else backHoles.push(h);
  }
  const rangeHoles = [...frontHoles, ...backHoles];
  const hasFront = frontHoles.length > 0;
  const hasBack  = backHoles.length  > 0;

  // ── Individual mode ───────────────────────────────────────────────────────────
  if (!isTeam) {
    const subsetPlayers = activeIdxs.map(pi => ({ p: players[pi], pi })).filter(({ p }) => p);

    const renderHalf = (hs, label) => {
      if (!hs.length) return null;
      const halves = players.map((_, pi) => hs.reduce((s, h) => s + (scoreHole(pi, h) ?? 0), 0));
      return (
        <>
          <HalfLabel>{label}</HalfLabel>
          <div style={{ padding:'0 8px 4px' }}>
            <GameTable hs={hs} colHeader="Total" headerBg={S.hdrBg} headerColor={S.hdrClr} totBg={S.totBg} totColor={S.totClr}>
              {subsetPlayers.map(({ p, pi }, rowIdx) => {
                const holePts = hs.map(h => scoreHole(pi, h));
                return (
                  <tr key={pi} style={{ background: S.row[rowIdx % 2] }}>
                    <td style={{ ...nameTd, color: S.hdrClr }}>{p.name}</td>
                    {holePts.map((v, i) => <td key={i} style={{ textAlign:'center', fontSize:11, color:vColor(v), fontWeight:v != null && v >= 3 ? 700 : 400 }}>{v === null ? '·' : v}</td>)}
                    <td style={{ textAlign:'center', fontSize:11, fontWeight:700, color:S.totClr, background:S.totBg, padding:'2px 4px' }}>{halves[pi]}</td>
                  </tr>
                );
              })}
            </GameTable>
          </div>
        </>
      );
    };

    const renderAll18 = () => {
      const frontHalves = players.map((_, pi) => frontHoles.reduce((s, h) => s + (scoreHole(pi, h) ?? 0), 0));
      const backHalves  = players.map((_, pi) => backHoles.reduce((s, h)  => s + (scoreHole(pi, h) ?? 0), 0));

      // Q5: single-half landscape
      if (!hasFront || !hasBack) {
        const hs = hasFront ? frontHoles : backHoles;
        return (
          <div style={{ padding:'0 8px 4px' }}>
            <GameTable hs={hs} colHeader="Total" headerBg={S.hdrBg} headerColor={S.hdrClr} totBg={S.totBg} totColor={S.totClr}>
              {subsetPlayers.map(({ p, pi }, rowIdx) => {
                const holePts = hs.map(h => scoreHole(pi, h));
                const tot = holePts.reduce((s, v) => s + (v ?? 0), 0);
                return (
                  <tr key={pi} style={{ background: S.row[rowIdx % 2] }}>
                    <td style={{ ...nameTd, color: S.hdrClr }}>{p.name}</td>
                    {holePts.map((v, i) => <td key={i} style={{ textAlign:'center', fontSize:11, color:vColor(v), fontWeight:v != null && v >= 3 ? 700 : 400 }}>{v === null ? '·' : v}</td>)}
                    <td style={{ textAlign:'center', fontSize:11, fontWeight:800, color:S.totClr, background:S.totBg, padding:'2px 3px' }}>{tot}</td>
                  </tr>
                );
              })}
            </GameTable>
          </div>
        );
      }

      return (
        <div style={{ padding:'0 8px 4px' }}>
          <GameTable landscape headerBg={S.hdrBg} headerColor={S.hdrClr} totBg={S.totBg} totColor={S.totClr}>
            {subsetPlayers.map(({ p, pi }, rowIdx) => {
              const frontPts = frontHoles.map(h => scoreHole(pi, h));
              const backPts  = backHoles.map(h  => scoreHole(pi, h));
              return (
                <tr key={pi} style={{ background: S.row[rowIdx % 2] }}>
                  <td style={{ ...nameTd, color: S.hdrClr }}>{p.name}</td>
                  {frontPts.map((v, i) => <td key={`f${i}`} style={{ textAlign:'center', fontSize:11, color:vColor(v), fontWeight:v != null && v >= 3 ? 700 : 400 }}>{v === null ? '·' : v}</td>)}
                  <td style={{ textAlign:'center', fontSize:11, fontWeight:700, color:S.totClr, background:S.totBg, padding:'2px 3px' }}>{frontHalves[pi]}</td>
                  {backPts.map((v, i) => <td key={`b${i}`} style={{ textAlign:'center', fontSize:11, color:vColor(v), fontWeight:v != null && v >= 3 ? 700 : 400 }}>{v === null ? '·' : v}</td>)}
                  <td style={{ textAlign:'center', fontSize:11, fontWeight:700, color:S.totClr, background:S.totBg, padding:'2px 3px' }}>{backHalves[pi]}</td>
                  <td style={{ textAlign:'center', fontSize:11, fontWeight:800, color:S.totClr, background:S.totBg, padding:'2px 3px' }}>{frontHalves[pi] + backHalves[pi]}</td>
                </tr>
              );
            })}
          </GameTable>
        </div>
      );
    };

    const subsetTotals = subsetPlayers.map(({ pi }) =>
      rangeHoles.reduce((s, h) => s + (scoreHole(pi, h) ?? 0), 0)
    );

    return (
      <GameSection title="Stableford" badge={scoringLabel(mode)} color={S.hdrClr} borderColor={S.border}>
        {isLandscape ? (
          renderAll18()
        ) : (
          <>
            {hasFront && renderHalf(frontHoles, 'Front')}
            {hasFront && hasBack && <TableDivider/>}
            {hasBack  && renderHalf(backHoles,  'Back')}
          </>
        )}
        <TableDivider/>
        <PlayerChips
          players={subsetPlayers.map(({ p }) => p)}
          values={subsetTotals}
          chipBg={S.hdrBg} chipColor={S.hdrClr}
          leaderBg={S.totBg} leaderColor={S.totClr}
          fmtVal={v => v} subLabel="pts"
        />
      </GameSection>
    );
  }

  // ── Team mode ─────────────────────────────────────────────────────────────────
  // Per-hole team score: cumulative = sum, bestball = max
  const teamHolePts = (idxs, h) => {
    const pts = idxs.map(pi => scoreHole(pi, h) ?? 0);
    return scoring === 'bestball' ? Math.max(...pts) : pts.reduce((a, b) => a + b, 0);
  };

  const teamSegTotal = (idxs, hs) => hs.reduce((s, h) => s + teamHolePts(idxs, h), 0);

  const nmA = teamA.map(pi => players[pi]?.name).filter(Boolean).join(' & ') || 'Team A';
  const nmB = teamB.map(pi => players[pi]?.name).filter(Boolean).join(' & ') || 'Team B';
  const scoringLabel2 = scoring === 'bestball' ? 'Best Ball' : 'Cumulative';

  // Team total row rendered below each GameTable half
  const TeamTotalRow = ({ idxs, hs, label }) => {
    const tot = teamSegTotal(idxs, hs);
    return (
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'3px 8px 2px', background:S.totBg }}>
        <span style={{ fontSize:11, fontWeight:700, color:S.totClr }}>{label}</span>
        <span style={{ fontSize:12, fontWeight:800, color:S.totClr }}>{tot} pts</span>
      </div>
    );
  };

  const renderTeamHalf = (hs, halfLabel) => {
    if (!hs.length) return null;
    const allIdxs = [...teamA, ...teamB];
    const halfTots = players.map((_, pi) => hs.reduce((s, h) => s + (scoreHole(pi, h) ?? 0), 0));
    return (
      <>
        <HalfLabel>{halfLabel}</HalfLabel>
        <div style={{ padding:'0 8px 2px' }}>
          <GameTable hs={hs} colHeader="Total" headerBg={S.hdrBg} headerColor={S.hdrClr} totBg={S.totBg} totColor={S.totClr}>
            {allIdxs.map((pi, rowIdx) => {
              const p = players[pi];
              if (!p) return null;
              const holePts = hs.map(h => scoreHole(pi, h));
              const isTeamASep = rowIdx === teamA.length - 1 && rowIdx < allIdxs.length - 1;
              return (
                <tr key={pi} style={{ background: S.row[rowIdx % 2], borderBottom: isTeamASep ? `2px solid ${S.border}` : undefined }}>
                  <td style={{ ...nameTd, color: S.hdrClr }}>{p.name}</td>
                  {holePts.map((v, i) => <td key={i} style={{ textAlign:'center', fontSize:11, color:vColor(v), fontWeight:v != null && v >= 3 ? 700 : 400 }}>{v === null ? '·' : v}</td>)}
                  <td style={{ textAlign:'center', fontSize:11, fontWeight:700, color:S.totClr, background:S.totBg, padding:'2px 4px' }}>{halfTots[pi]}</td>
                </tr>
              );
            })}
          </GameTable>
        </div>
        <TeamTotalRow idxs={teamA} hs={hs} label={nmA}/>
        <TeamTotalRow idxs={teamB} hs={hs} label={nmB}/>
      </>
    );
  };

  const totAF = teamSegTotal(teamA, frontHoles);
  const totBF = teamSegTotal(teamB, frontHoles);
  const totAB = teamSegTotal(teamA, backHoles);
  const totBB = teamSegTotal(teamB, backHoles);
  const totA  = totAF + totAB;
  const totB  = totBF + totBB;

  return (
    <GameSection title="Stableford" badge={scoringLabel(mode)} badge2={scoringLabel2} color={S.hdrClr} borderColor={S.border}>
      {hasFront && renderTeamHalf(frontHoles, 'Front')}
      {hasFront && hasBack && <TableDivider/>}
      {hasBack  && renderTeamHalf(backHoles,  'Back')}
      <TableDivider/>
      {/* 18-hole team chip summary — custom rendering to avoid name-splitting bug */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, padding:'6px 8px 8px' }}>
        {[[nmA, totA], [nmB, totB]].map(([nm, tot], ti) => {
          const isLeader = tot > 0 && tot === Math.max(totA, totB);
          const bg  = isLeader ? S.totBg  : S.hdrBg;
          const clr = isLeader ? S.totClr : S.hdrClr;
          return (
            <div key={ti} style={{ textAlign:'center', borderRadius:8, padding:'5px 4px', background:bg, display:'flex', flexDirection:'column', justifyContent:'center' }}>
              <div style={{ fontSize:10, fontWeight:600, color:clr, lineHeight:1.3, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{nm}</div>
              <div style={{ fontSize:15, fontWeight:700, color:clr }}>{tot}</div>
              <div style={{ fontSize:10, color:'#aaa' }}>pts</div>
            </div>
          );
        })}
      </div>
    </GameSection>
  );
}
