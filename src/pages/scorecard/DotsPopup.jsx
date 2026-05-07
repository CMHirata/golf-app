// ─── scorecard/DotsPopup.jsx ──────────────────────────────────────────────────
// RENDER ONLY — no business logic in this file.
// No scoring calculations. No match state computation.
// All logic must come from engine/ or scorecardUtils.js

import { useRef } from 'react';
import { Btn, G, GA } from '../../components/ui.jsx';
import { restoreDotDefs } from './scorecardUtils.js';
import { sixesSegForHole, getDotsPartner, getMatchTeamPartner } from '../../engine/games.js';
import { scoreForMode } from '../../engine/handicap.js';

const entryCount = v => typeof v === 'number' ? v : (v === true ? 1 : 0);

function calcCompanionCount(hole, pi, entries, ens) {
  let total = 0;
  Object.entries(entries).forEach(([key, v]) => {
    const cnt = entryCount(v);
    if (!cnt) return;
    const parts = key.split('_');
    if (parseInt(parts[0]) !== hole || parseInt(parts[1]) !== pi) return;
    if (parts[2] === 'team') return;
    const sp = ens.find(s => s.id === parts.slice(2).join('_'));
    if (sp) total += cnt;
  });
  return total;
}

export function DotsPopup({
  hole, pi, playerName, par, gross,
  dots, entries, setEntries,
  sixesTeams, matches, players, gameOpts, onClose,
  courseHcps, hcps, minCourseHcp,
  paddingTop,
}) {
  const restored = restoreDotDefs(dots);
  const enabled  = restored.filter(s => s.enabled && s.id !== 'team');
  const ens      = restored.filter(s => s.enabled);

  const dotsOpts   = gameOpts?.Dots || gameOpts?.Specials || {};
  const dotScoring = dotsOpts.grossNetNOL ?? dotsOpts.scoring;

  const rawTeamMode = dotsOpts.teamMode;
  const legacyTeam  = dotsOpts.teamScoring;
  const teamSource  = rawTeamMode && rawTeamMode !== 'none'
    ? rawTeamMode : (legacyTeam ? 'Sixes' : 'none');
  const isTeamMode = teamSource !== 'none';

  const effectiveScore = (dotScoring === 'net' && gross && courseHcps && hcps && minCourseHcp != null)
    ? scoreForMode(gross, courseHcps[pi], hcps[hole], minCourseHcp, 'net')
    : gross;

  const isAutoEarned = sp => sp.auto && sp.autoWhen && effectiveScore && par
    ? sp.autoWhen(effectiveScore, par) : false;

  const getCount = sp => entryCount(entries[`${hole}_${pi}_${sp.id}`]);

  const getPartner = () => {
    if (!isTeamMode) return -1;
    if (teamSource === 'Sixes') return getDotsPartner(pi, sixesSegForHole(hole), sixesTeams, players);
    if (teamSource.startsWith('Match:')) return getMatchTeamPartner(pi, matches);
    return -1;
  };

  const writeCompanion = (n, partnerIdx) => {
    // Delete ALL stale companion entries written by pi on this hole before
    // writing the new one. Cleans up orphaned companions from teamMode changes.
    Object.keys(n).forEach(key => {
      const parts = key.split('_');
      if (parts[2] === 'team' && parts.length > 3 &&
          parseInt(parts[0]) === hole &&
          parseInt(parts[parts.length - 1]) === pi) {
        delete n[key];
      }
    });
    if (partnerIdx < 0) return;
    const compKey  = `${hole}_${partnerIdx}_team_dot_for_${pi}`;
    const newCount = calcCompanionCount(hole, pi, n, ens);
    if (newCount > 0) n[compKey] = newCount; else delete n[compKey];
  };

  const increment = sp => setEntries(prev => {
    const key = `${hole}_${pi}_${sp.id}`;
    const n   = { ...prev, [key]: (entryCount(prev[key]) + 1) };
    if (isTeamMode) writeCompanion(n, getPartner());
    return n;
  });

  const decrement = sp => setEntries(prev => {
    const key = `${hole}_${pi}_${sp.id}`;
    const cur = entryCount(prev[key]);
    const n   = { ...prev };
    if (cur <= 1) delete n[key]; else n[key] = cur - 1;
    if (isTeamMode) writeCompanion(n, getPartner());
    return n;
  });

  const toggle = sp => setEntries(prev => {
    const key  = `${hole}_${pi}_${sp.id}`;
    const n    = { ...prev };
    const isOn = entryCount(prev[key]) > 0;
    if (isOn) delete n[key]; else n[key] = 1;
    if (isTeamMode) writeCompanion(n, getPartner());
    return n;
  });

  const spVal = sp => sp.value ?? sp.pts ?? 1;

  const tileBg  = (isOn) => isOn ? GA  : '#fafafa';
  const tileBdr = (isOn) => isOn ? G   : '#e5e5e5';
  const nameClr = (isOn) => isOn ? G   : '#555';
  const multClr = (isOn) => isOn ? G   : '#bbb';

  // Shared tile style — fixed height so badge rows and text rows are identical
  const tileStyle = (isOn, extra = {}) => ({
    display: 'flex', alignItems: 'center',
    height: 44, padding: '0 13px', borderRadius: 10,
    background: tileBg(isOn), border: `1.5px solid ${tileBdr(isOn)}`,
    boxSizing: 'border-box',
    ...extra,
  });

  const hasMulti = enabled.some(sp => !sp.auto && sp.multi);

  // touchStartedOnBackdrop: only close on touchend if a touchstart was first
  // received on the backdrop after mount. This prevents the finger-lift from the
  // long-press gesture (which opens the popup) from immediately closing it.
  const touchStartedOnBackdrop = useRef(false);

  // cardInteractionsReady: false until the opening long-press finger has lifted.
  // The long-press that opens DotsPopup is still in progress when the card mounts.
  // The finger-lift generates a synthesized click that would fire tile onClick handlers
  // before the user has made a deliberate tap. This ref blocks all tile interactions
  // until the first touchend on the card is consumed (the opening finger-lift), after
  // which all subsequent taps are processed normally.
  const cardInteractionsReady = useRef(false);

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 400,
               display: 'flex', alignItems: paddingTop ? 'flex-start' : 'center',
               justifyContent: 'center', padding: 16,
               paddingTop: paddingTop ?? 16 }}
      onTouchStart={e => {
        e.stopPropagation();
        // Only record a backdrop touchstart when it lands directly on the backdrop,
        // not on the card (card stopPropagation means those never reach here).
        if (e.target === e.currentTarget) touchStartedOnBackdrop.current = true;
      }}
      onTouchEnd={e => {
        e.stopPropagation();
        if (e.target === e.currentTarget && touchStartedOnBackdrop.current) {
          touchStartedOnBackdrop.current = false;
          onClose();
        } else {
          touchStartedOnBackdrop.current = false;
        }
      }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 18, padding: 20,
                 width: '100%', maxWidth: 320, boxShadow: '0 8px 32px rgba(0,0,0,.18)',
                 userSelect: 'none', WebkitUserSelect: 'none' }}
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.preventDefault()}
        onTouchStart={e => e.stopPropagation()}
        onTouchEnd={e => {
          e.stopPropagation();
          if (!cardInteractionsReady.current) {
            // First touchend after mount = the opening long-press finger lifting.
            // Call preventDefault to suppress the synthesized click that would
            // otherwise fire on whichever tile is under the finger.
            e.preventDefault();
            cardInteractionsReady.current = true;
          }
          // Subsequent touchends: no preventDefault — synthesized clicks fire normally.
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 15, color: G, marginBottom: 2 }}>
          Dots — H{hole + 1}
        </div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 14 }}>
          {playerName} · Score {gross || '?'} · Par {par}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {enabled.map(sp => {
            const count    = getCount(sp);
            const isOn     = count > 0;
            const isLocked = sp.auto;

            // ── Auto (locked) — show only when earned, non-interactive ──
            if (isLocked) {
              if (!isAutoEarned(sp) && !isOn) return null;
              return (
                <div key={sp.id} style={{ ...tileStyle(true), background: GA, border: `1.5px solid ${G}` }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: G }}>{sp.name}</span>
                  <span style={{ fontSize: 11, color: G, opacity: 0.6, marginLeft: 5 }}>×{spVal(sp)}</span>
                </div>
              );
            }

            // ── Multi-count row: tap tile = increment, tap count = decrement ──
            if (sp.multi) {
              return (
                <div key={sp.id}
                  onClick={() => { if (cardInteractionsReady.current) increment(sp); }}
                  style={{ ...tileStyle(isOn), cursor: 'pointer' }}
                >
                  {/* Name + multiplier inline, close together */}
                  <span style={{ fontSize: 14, fontWeight: isOn ? 700 : 400, color: nameClr(isOn) }}>{sp.name}</span>
                  <span style={{ fontSize: 11, color: multClr(isOn), marginLeft: 5, opacity: 0.75 }}>×{spVal(sp)}</span>
                  <div style={{ flex: 1 }}/>
                  {/* Count badge — 24px fits within standard tile padding; tap decrements */}
                  <div
                    onClick={e => { e.stopPropagation(); if (cardInteractionsReady.current && isOn) decrement(sp); }}
                    style={{
                      width: 24, height: 24, borderRadius: 6,
                      background: isOn ? G : '#e8e8e8',
                      color: isOn ? '#fff' : '#aaa',
                      fontSize: 13, fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, cursor: isOn ? 'pointer' : 'default',
                    }}
                  >{count}</div>
                </div>
              );
            }

            // ── Single-count row: tap tile toggles ──
            return (
              <div key={sp.id}
                onClick={() => { if (cardInteractionsReady.current) toggle(sp); }}
                style={{ ...tileStyle(isOn), cursor: 'pointer' }}
              >
                <span style={{ fontSize: 14, fontWeight: isOn ? 700 : 400, color: nameClr(isOn) }}>{sp.name}</span>
                <span style={{ fontSize: 11, color: multClr(isOn), marginLeft: 5, opacity: 0.75 }}>×{spVal(sp)}</span>
              </div>
            );
          })}
        </div>

        {/* Hint — tap tile adds, tap count reduces */}
        {hasMulti && (
          <div style={{ fontSize: 10, color: '#bbb', marginTop: 10, textAlign: 'center' }}>
            Tap tile to add · tap count to reduce
          </div>
        )}

        <Btn onClick={onClose} style={{ marginTop: 10, width: '100%' }}>Done</Btn>
      </div>
    </div>
  );
}
