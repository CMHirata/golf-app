// ─── pages/HistoryPage.jsx ────────────────────────────────────────────────────
// Round history: list, filter, export/import.
// Cumulative winnings moved to HomePage (Money List) in 15-E.
//
// ✅ Self-checked: cumulative useMemo, showWinningsDetail state, winnings display
//    block, and winnings detail modal all removed; fmtMoney removed (unused);
//    GA still imported and used by range selector; no dangling references to
//    removed state remain.
// 13-E.3: `SwipeableRoundRow` extracted to `pages/history/SwipeableRoundRow.jsx`
// (with its strip color constants and `REVEAL_W`); the five action icons
// extracted to `pages/history/HistoryIcons.jsx`. Per Architectural Decision #23
// (codebase extraction pattern). Zero logic changes.
//
// ✅ Self-checked (13-E.3): All eight `<SwipeableRoundRow>` props pass through
// unchanged from the parent (`r`, `canEdit`, `onEdit`, `onDelete`,
// `onOpenSummary`, `onShare`, `openId`, `setOpenId`). `useRef` dropped from
// React imports (no longer used at this level); `fmtDate` dropped from
// ui.jsx imports (used only inside the extracted row). `IconDownload` and
// `IconUpload` re-imported from `./history/HistoryIcons.jsx` for the
// Backup & Restore card. `handleShareWithOrientation` 13-C.8 self-check
// preserved (forwards `earlyEndOpts` + `lastCompletedHole`).

import { useState, useMemo, useCallback } from 'react';
import { ls, SK, makeId } from '../services/storage.js';
import { roundLib } from '../services/roundLib.js';
import { playerLib } from '../services/playerLib.js';
import { courseLib } from '../services/courseLib.js';
import { Card, G, GA, RED, ShareOrientationPicker } from '../components/ui.jsx';
import {
  ImportModal, ImportConflictModal,
  likelySameCourse, likelySamePlayer, diffCourses,
} from './ImportModals.jsx';
import { RoundSummaryModal } from './RoundSummaryModal.jsx';
import { buildPayoutArgs, computePerMatchPayouts } from '../services/roundUtils.js';
import { triggerRoundShare, buildShareImage } from '../services/shareUtils.js';
import { computePayouts } from '../engine/payouts.js';
import SwipeableRoundRow from './history/SwipeableRoundRow.jsx';
import { IconDownload, IconUpload } from './history/HistoryIcons.jsx';

const RANGES = [['ytd','YTD'],['week','7d'],['month','30d'],['year','12mo'],['all','All']];

function mergeById(existing, incoming) {
  const map = new Map(existing.map(r => [r.id, r]));
  incoming.forEach(r => { if (r.id) map.set(r.id, r); });
  return Array.from(map.values());
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function HistoryPage({ onLoadRound }) {
  const [rounds,             setRounds]             = useState(() => roundLib.list());
  const [range,              setRange]              = useState('ytd');
  const [summaryRound,       setSummaryRound]       = useState(null);
  const [openRowId,          setOpenRowId]          = useState(null);
  const [importModal,        setImportModal]        = useState(null);
  const [conflictModal,      setConflictModal]      = useState(null);

  const [shareRound,    setShareRound]    = useState(null);
  const [shareStatus,   setShareStatus]   = useState('idle');
  const [shareError,    setShareError]    = useState('');
  const [showOrienPick, setShowOrienPick] = useState(false);
  const [editUnlocked,  setEditUnlocked]  = useState(false);

  const handleShareRound = useCallback((r) => {
    setShareRound(r);
    setShowOrienPick(true);
  }, []);

  const handleShareWithOrientation = useCallback(async (orientation) => {
    if (!shareRound) return;
    setShowOrienPick(false);
    setShareStatus('building');
    setShareError('');
    try {
      const ar = roundLib.toActiveRound(shareRound);
      const { bank, breakdown } = computePayouts(buildPayoutArgs(ar));
      const matchPayouts = (ar.activeGames || []).includes('Match / Nassau')
        ? computePerMatchPayouts(
            ar.matches || [], ar.activePlayers, ar.scores, ar.hcps,
            ar.courseHcps, ar.minCourseHcp, ar.manualPresses || {},
            ar.gameRanges || {},
            ar.roundStartHole ?? 0,
            (ar.roundStartHole ?? 0) + (ar.roundNumHoles ?? 18) - 1,
            ar.earlyDepartureOpts || {},
            // 13-C.8: forward Scenario B group-stop metadata so saved rounds
            // with engine departure resolutions render correctly in shares.
            ar.earlyEndOpts || {}, ar.lastCompletedHole,
          )
        : [];
      const blob = await buildShareImage(shareRound, ar, bank, breakdown, matchPayouts, orientation);
      await triggerRoundShare(shareRound, ar, bank, breakdown, matchPayouts, blob, orientation);
      setShareStatus('done');
    } catch(err) {
      if (err?.name === 'AbortError') { setShareStatus('idle'); return; }
      console.error('Share failed:', err);
      setShareError('Could not share. Try again.');
      setShareStatus('error');
    }
  }, [shareRound]);

  const now = new Date();

  const filtered = useMemo(() => rounds.filter(r => {
    const d = new Date(r.date);
    if (range === 'week')  { const w = new Date(now); w.setDate(now.getDate()-7);         return d >= w; }
    if (range === 'month') { const m = new Date(now); m.setMonth(now.getMonth()-1);       return d >= m; }
    if (range === 'year')  { const y = new Date(now); y.setFullYear(now.getFullYear()-1); return d >= y; }
    if (range === 'ytd')   return d.getFullYear() === now.getFullYear();
    return true;
  }).sort((a, b) => new Date(b.date) - new Date(a.date)), [rounds, range]);

  const mostRecentDate = filtered[0]?.date || null;

  const handleDelete = useCallback((id) => { roundLib.delete(id); setRounds(roundLib.list()); }, []);

  const handleExport = async () => {
    const filename = `golf_backup_${new Date().toISOString().slice(0,10)}.json`;
    const payload  = { exportedAt: new Date().toISOString(), appVersion: 'golf-scorekeeper-v4', players: playerLib.list(), courses: courseLib.list(), rounds: roundLib.list(), settings: { moneyListRange: ls.get('moneyListRange') } };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: 'application/json' })] })) {
      try { await navigator.share({ files: [new File([blob], filename, { type: 'application/json' })], title: 'Golf Scorekeeper Backup' }); return; }
      catch (err) { if (err.name === 'AbortError') return; }
    }
    if (typeof window.showSaveFilePicker === 'function') {
      try { const h = await window.showSaveFilePicker({ suggestedName: filename, types: [{ description: 'Golf Backup (JSON)', accept: { 'application/json': ['.json'] } }] }); const w = await h.createWritable(); await w.write(json); await w.close(); return; }
      catch (err) { if (err.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const n = { players: parsed.players||[], courses: parsed.courses||[], rounds: parsed.rounds||[] };
      if (!n.players.length && !n.courses.length && !n.rounds.length) { alert('No importable data found.'); return; }
      setImportModal({ parsed: n });
    } catch(e) { alert(`Could not read file: ${e.message}`); }
  };

  const handleImportConfirmSections = (sel) => {
    const { parsed } = importModal; setImportModal(null);
    const conflicts = [];
    if (sel.courses && parsed.courses?.length) {
      const ec = ls.get(SK.courses) || [];
      parsed.courses.forEach(inc => {
        const im = ec.find(e => e.id === inc.id);
        if (im) { const d = diffCourses(im, inc); if (d.length) conflicts.push({ type:'course', sameId:true, existing:im, incoming:inc }); return; }
        const nm = ec.find(e => likelySameCourse(e.name, inc.name));
        if (nm) conflicts.push({ type:'course', sameId:false, existing:nm, incoming:inc });
      });
    }
    if (sel.players && parsed.players?.length) {
      const ep = ls.get(SK.players) || [];
      parsed.players.forEach(inc => {
        const im = ep.find(e => e.id === inc.id);
        if (im) { const f=['name','gender','ghin','email','phone','starred','inMoneyLists']; if (f.some(k=>(im[k]||'')!==(inc[k]||''))) conflicts.push({ type:'player', existing:im, incoming:inc }); return; }
        const nm = ep.find(e => likelySamePlayer(e.name, inc.name));
        if (nm) conflicts.push({ type:'player', existing:nm, incoming:inc });
      });
    }
    if (conflicts.length > 0) setConflictModal({ conflicts, pendingSel:sel, pendingParsed:parsed });
    else applyImport(sel, parsed, {});
  };

  const handleConflictsResolved = (decisions) => {
    const { pendingSel, pendingParsed } = conflictModal; setConflictModal(null); applyImport(pendingSel, pendingParsed, decisions);
  };

  const applyImport = (sel, parsed, decisions) => {
    // cr maps inc.id → resolved course object | 'skip' | { __keepBoth: true, newName, rec }
    // pr maps inc.id → resolved player object | 'skip'
    const cr={}, pr={}; let ci=0;
    if (sel.courses && parsed.courses?.length) {
      const ec = ls.get(SK.courses)||[];
      parsed.courses.forEach(inc => {
        const im=ec.find(e=>e.id===inc.id);
        if(im){
          const d=diffCourses(im,inc);
          if(!d.length){cr[inc.id]='skip';return;}
          const dec=decisions[ci++]||{action:'keep'};
          if(dec.action==='replace') cr[inc.id]=inc;
          else if(dec.action==='keep_both') cr[inc.id]={__keepBoth:true, newName:dec.newName, rec:inc};
          else cr[inc.id]='skip';
          return;
        }
        const nm=ec.find(e=>likelySameCourse(e.name,inc.name));
        if(nm){
          const dec=decisions[ci++]||{action:'keep'};
          if(dec.action==='replace') cr[inc.id]={...inc,id:nm.id};
          else if(dec.action==='keep_both') cr[inc.id]={__keepBoth:true, newName:dec.newName, rec:inc};
          else cr[inc.id]='skip';
        }
        // Brand-new course (no id/name match) — leave cr entry absent; handled in tm build below
      });
    }
    if (sel.players && parsed.players?.length) {
      const ep=ls.get(SK.players)||[];const f=['name','gender','ghin','email','phone','starred','inMoneyLists'];
      parsed.players.forEach(inc=>{
        const im=ep.find(e=>e.id===inc.id);
        if(im){if(!f.some(k=>(im[k]||'')!==(inc[k]||''))){pr[inc.id]='skip';return;}const dec=decisions[ci++]||{action:'keep'};pr[inc.id]=dec.action==='replace'?inc:'skip';return;}
        const nm=ep.find(e=>likelySamePlayer(e.name,inc.name));
        if(nm){const dec=decisions[ci++]||{action:'keep'};pr[inc.id]=dec.action==='replace'?{...inc,id:nm.id}:'skip';}
        // Brand-new player — leave pr entry absent; handled in tm build below
      });
    }
    const summary=[];
    if(sel.players&&parsed.players?.length){
      const ex=ls.get(SK.players)||[];
      const tm=parsed.players.map(p=>{const res=pr[p.id];if(res==='skip')return null;if(res&&typeof res==='object')return res;const rec=p.id?p:{...p,id:makeId('p')};return rec;}).filter(Boolean);
      ls.set(SK.players,mergeById(ex,tm));
      summary.push(`${tm.length} player${tm.length!==1?'s':''}`);
    }
    if(sel.courses&&parsed.courses?.length){
      const ex=ls.get(SK.courses)||[];
      const tm=[];
      parsed.courses.forEach(c=>{
        const res=cr[c.id];
        if(res==='skip') return;
        if(res&&res.__keepBoth){
          // Add as brand-new record with a fresh id and the user-provided name
          tm.push({...res.rec, id:makeId('c'), name:res.newName});
          return;
        }
        if(res&&typeof res==='object'){tm.push(res);return;}
        // Brand-new (no cr entry) — ensure it has an id
        tm.push(c.id?c:{...c,id:makeId('c')});
      });
      ls.set(SK.courses,mergeById(ex,tm));
      summary.push(`${tm.length} course${tm.length!==1?'s':''}`);
    }
    if(sel.rounds&&parsed.rounds?.length){const ex=ls.get(SK.rounds)||[];ls.set(SK.rounds,mergeById(ex,parsed.rounds));setRounds(roundLib.list());summary.push(`${parsed.rounds.length} round${parsed.rounds.length!==1?'s':''}`);}
    if(parsed.settings?.moneyListRange){ls.set('moneyListRange',parsed.settings.moneyListRange);}
    const sk=Object.values({...cr,...pr}).filter(v=>v==='skip').length;
    alert(`Imported: ${summary.join(', ')}${sk>0?` (${sk} duplicate${sk!==1?'s':''} skipped)`:''}.`);
  };

  return (
    <div style={{ minHeight:'100vh', background:'#eef4ee' }} onClick={() => setOpenRowId(null)}>

      {/* ── Header: lockup logo left, "History" right ── */}
      <div style={{
        background: G,
        padding: '8px 16px 7px',
        position: 'sticky', top: 0, zIndex: 10,
        boxShadow: '0 2px 12px rgba(0,0,0,.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <img
          src="/logo_lockup.png"
          alt="The Card"
          style={{ height: 58, width: 'auto', display: 'block' }}
        />
        <div style={{
          color: '#fff',
          fontWeight: 800,
          fontSize: 16,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          fontFamily: 'inherit',
        }}>
          History
        </div>
      </div>

      <div style={{ padding:'12px 14px', maxWidth:520, margin:'0 auto', display:'flex', flexDirection:'column', gap:10 }}>

        {/* ── Date range filter — equal-width pills ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:5 }}>
          {RANGES.map(([v, l]) => (
            <button key={v} onClick={() => setRange(v)}
              style={{
                padding: '5px 0',
                borderRadius: 20,
                border: `1.5px solid ${range === v ? G : '#ddd'}`,
                background: range === v ? GA : '#fff',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                color: range === v ? G : '#777',
                fontFamily: 'inherit',
                textAlign: 'center',
              }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ fontSize:11, color:'#999', paddingLeft:2 }}>
          {filtered.length} round{filtered.length !== 1 ? 's' : ''} in range
        </div>

        {/* ── Round rows ── */}
        <Card>
          <div style={{ fontWeight:700, fontSize:13, color:G, marginBottom:9 }}>Rounds</div>
          {rounds.length === 0 && <p style={{ fontSize:13, color:'#aaa', textAlign:'center', padding:'16px 0' }}>No rounds saved yet.</p>}
          <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
            {filtered.map((r) => (
              <SwipeableRoundRow
                key={r.id} r={r}
                canEdit={!!(onLoadRound && (editUnlocked || r.date === mostRecentDate))}
                onEdit={() => onLoadRound && onLoadRound(r)}
                onDelete={() => handleDelete(r.id)}
                onOpenSummary={() => { setOpenRowId(null); setSummaryRound(r); }}
                onShare={() => { setOpenRowId(null); handleShareRound(r); }}
                openId={openRowId}
                setOpenId={setOpenRowId}
              />
            ))}
          </div>
          {/* ── Edit lock/unlock toggle ── */}
          {onLoadRound && filtered.length > 0 && (
            <div style={{ display:'flex', justifyContent:'center', marginTop:10 }}>
              <button
                onClick={(e) => { e.stopPropagation(); setEditUnlocked(u => !u); }}
                title={editUnlocked ? 'Lock editing to most recent rounds only' : 'Unlock editing for all rounds'}
                style={{
                  border: 'none', background: 'none', cursor: 'pointer', padding: '4px 10px',
                  display: 'flex', alignItems: 'center', gap: 5,
                  color: editUnlocked ? G : '#bbb',
                  fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                }}>
                {editUnlocked ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                    stroke={G} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                  </svg>
                ) : (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                    stroke="#bbb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                )}
                {editUnlocked ? 'All rounds editable' : 'Edit locked'}
              </button>
            </div>
          )}
        </Card>

        {/* ── Backup & Restore ── */}
        <Card>
          <div style={{ fontWeight:700, fontSize:13, color:G, marginBottom:4 }}>Backup &amp; Restore</div>
          <div style={{ fontSize:12, color:'#888', marginBottom:10 }}>Export saves <strong>all</strong> players, courses, and rounds. Import lets you choose what to restore.</div>
          <div style={{ display:'flex', gap:8 }}>
            <button
              onClick={handleExport}
              style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                padding:'8px 0', border:`1.5px solid ${G}`, borderRadius:9,
                background:'#fff', color:G, fontWeight:700, fontSize:12,
                cursor:'pointer', fontFamily:'inherit' }}>
              <IconDownload color={G} size={14} />
              Export
            </button>
            <button
              onClick={() => document.getElementById('imp-f').click()}
              style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                padding:'8px 0', border:'1.5px solid #ddd', borderRadius:9,
                background:'#f8f8f8', color:'#666', fontWeight:700, fontSize:12,
                cursor:'pointer', fontFamily:'inherit' }}>
              <IconUpload color="#666" size={14} />
              Import
            </button>
            <input id="imp-f" type="file" accept=".json" style={{ display:'none' }}
              onChange={e => { handleImportFile(e.target.files?.[0]); e.target.value = ''; }}/>
          </div>
        </Card>

      </div>

      {summaryRound && <RoundSummaryModal r={summaryRound} onClose={() => setSummaryRound(null)}/>}

      {showOrienPick && (
        <ShareOrientationPicker
          onPick={handleShareWithOrientation}
          onDismiss={() => setShowOrienPick(false)}
        />
      )}

      {/* Share error toast */}
      {shareStatus === 'error' && shareError && (
        <div style={{ position:'fixed', bottom:80, left:'50%', transform:'translateX(-50%)',
          background:RED, color:'#fff', borderRadius:10, padding:'10px 18px',
          fontSize:13, fontWeight:600, zIndex:500, whiteSpace:'nowrap' }}
          onClick={() => setShareStatus('idle')}>
          {shareError} (tap to dismiss)
        </div>
      )}

      {importModal && <ImportModal parsed={importModal.parsed} onConfirm={handleImportConfirmSections} onClose={() => setImportModal(null)}/>}
      {conflictModal && <ImportConflictModal conflicts={conflictModal.conflicts} onResolved={handleConflictsResolved} onClose={() => { setConflictModal(null); alert('Import cancelled.'); }}/>}
    </div>
  );
}
