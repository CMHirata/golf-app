// ─── pages/ImportModals.jsx ───────────────────────────────────────────────────
// Two-step import modal flow:
//   ImportModal         — step 1: choose which sections (players/courses/rounds) to import
//   ImportConflictModal — step 2: resolve name-based or ID-based duplicates one at a time
// No page state. No round data. Pure modal UI.

import { useState } from 'react';
import { Btn, G, GA } from '../components/ui.jsx';

const AMB   = '#b45309';
const AMBBG = '#fffbeb';

// ── Name normaliser & fuzzy-match ─────────────────────────────────────────────
function normName(n) { return (n || '').trim().toLowerCase().replace(/\s+/g, ' '); }

// Words too common in golf course names to count toward identity matching
const GOLF_STOP_WORDS = new Set(['golf','club','course','country','resort','links',
  'at','the','of','and','&','de']);

export function likelySameCourse(a, b) {
  const na = normName(a), nb = normName(b);
  if (!na || !nb) return false;
  // Exact match
  if (na === nb) return true;
  // Substring only when the shorter string is substantial (≥12 chars) —
  // prevents short noise like "Golf Club" matching everything
  const shorter = na.length <= nb.length ? na : nb;
  const longer  = na.length <= nb.length ? nb : na;
  if (shorter.length >= 12 && longer.includes(shorter)) return true;
  // Word-overlap ignoring common golf stop-words; require 80% of significant words to match
  const sig = s => new Set(s.split(/\s+/).filter(w => w.length > 1 && !GOLF_STOP_WORDS.has(w)));
  const wa = sig(na), wb = sig(nb);
  if (wa.size === 0 || wb.size === 0) return false;
  const shared = [...wa].filter(w => wb.has(w)).length;
  return shared / Math.max(wa.size, wb.size) >= 0.80;
}

export function likelySamePlayer(a, b) {
  return normName(a) === normName(b);
}

// ── Deep-diff two courses ─────────────────────────────────────────────────────
export function diffCourses(existing, incoming) {
  const diffs = [];

  // Name — most critical: if names differ on an ID collision these are likely different courses
  if (normName(existing.name) !== normName(incoming.name)) {
    diffs.push({ field: 'name', label: 'Name', old: existing.name || '—', neu: incoming.name || '—' });
  }

  if ((existing.location || '') !== (incoming.location || '') && (incoming.location || '')) {
    diffs.push({ field: 'location', label: 'Location', old: existing.location || '—', neu: incoming.location });
  }
  const existTeeMap = Object.fromEntries((existing.tees || []).map(t => [t.name?.toLowerCase(), t]));
  const incomTeeMap = Object.fromEntries((incoming.tees || []).map(t => [t.name?.toLowerCase(), t]));
  const allTeeNames = new Set([...Object.keys(existTeeMap), ...Object.keys(incomTeeMap)]);
  for (const tn of allTeeNames) {
    const et = existTeeMap[tn], it = incomTeeMap[tn];
    if (!et && it) {
      diffs.push({ field: `tee_new_${tn}`, label: `Tee "${it.name}"`, old: '—', neu: `Rating ${it.rating}/${it.slope}` });
    } else if (et && it) {
      if (et.rating !== it.rating || et.slope !== it.slope) {
        diffs.push({ field: `tee_${tn}`, label: `${et.name} (Men's)`, old: `${et.rating}/${et.slope}`, neu: `${it.rating}/${it.slope}` });
      }
      if ((et.ratingW || it.ratingW) && (et.ratingW !== it.ratingW || et.slopeW !== it.slopeW)) {
        diffs.push({ field: `teeW_${tn}`, label: `${et.name} (Women's)`, old: `${et.ratingW||'—'}/${et.slopeW||'—'}`, neu: `${it.ratingW||'—'}/${it.slopeW||'—'}` });
      }
      const etTotal = et.totalYards || (et.nineYards?.reduce((a,b)=>a+b,0));
      const itTotal = it.totalYards || (it.nineYards?.reduce((a,b)=>a+b,0));
      if (itTotal && etTotal !== itTotal) {
        diffs.push({ field: `yards_${tn}`, label: `${et.name} Yardage`, old: etTotal ? `${etTotal} yds` : '—', neu: `${itTotal} yds` });
      }
    }
  }
  (incoming.nines || []).forEach((inNine, ni) => {
    const exNine = (existing.nines || [])[ni];
    if (!exNine) {
      diffs.push({ field: `nine_${ni}`, label: `Nine "${inNine.name}"`, old: '—', neu: `Par ${inNine.pars?.reduce((a,b)=>a+b,0)}` });
      return;
    }
    const parDiff = inNine.pars?.some((p, i) => p !== (exNine.pars||[])[i]);
    if (parDiff) diffs.push({ field: `par_${ni}`, label: `${inNine.name} Pars`, old: (exNine.pars||[]).join('-'), neu: (inNine.pars||[]).join('-') });
    const hcpDiff = inNine.handicaps?.some((h, i) => h !== (exNine.handicaps||[])[i]);
    if (hcpDiff) diffs.push({ field: `hcp_${ni}`, label: `${inNine.name} M-Handicaps`, old: (exNine.handicaps||[]).join('-'), neu: (inNine.handicaps||[]).join('-') });
    const hcpWDiff = inNine.handicapsWomen?.some((h, i) => h !== (exNine.handicapsWomen||[])[i]);
    if (hcpWDiff) diffs.push({ field: `hcpw_${ni}`, label: `${inNine.name} W-Handicaps`, old: (exNine.handicapsWomen||[]).join('-') || '—', neu: (inNine.handicapsWomen||[]).join('-') });
  });
  return diffs;
}

// ── Course summary card — one side of the side-by-side conflict view ──────────
function CourseSummaryCard({ course, label, labelColor }) {
  const ninesSummary = (course.nines || []).map(n =>
    `${n.name}: Par ${(n.pars||[]).reduce((a,b)=>a+b,0)}`
  ).join('  ·  ');
  const teesSummary = (course.tees || []).map(t => t.name).join(', ');

  return (
    <div style={{
      flex: 1,
      border: `2px solid ${labelColor}`,
      borderRadius: 10,
      padding: '10px 11px',
      background: labelColor === '#1a6e1a' ? '#f0faf0' : '#e8f4fd',
      minWidth: 0,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: labelColor, marginBottom: 4,
        textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#222', marginBottom: 3, wordBreak: 'break-word' }}>
        {course.name || '—'}
      </div>
      {course.location && (
        <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>{course.location}</div>
      )}
      {ninesSummary && (
        <div style={{ fontSize: 10, color: '#666', marginBottom: 2 }}>{ninesSummary}</div>
      )}
      {teesSummary && (
        <div style={{ fontSize: 10, color: '#888' }}>Tees: {teesSummary}</div>
      )}
      {!course.nines?.length && !course.tees?.length && (
        <div style={{ fontSize: 10, color: '#bbb', fontStyle: 'italic' }}>No detail available</div>
      )}
    </div>
  );
}

// ── Rename prompt — shown when user picks Keep Both ───────────────────────────
function RenamePrompt({ defaultName, onConfirm, onCancel }) {
  const [name, setName] = useState(defaultName || '');
  return (
    <div style={{ marginTop: 4, background: '#f5f5f5', border: '1.5px solid #ddd',
      borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#444', marginBottom: 6 }}>
        Name the imported course:
      </div>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        autoFocus
        style={{
          width: '100%', boxSizing: 'border-box',
          border: '1.5px solid #bbb', borderRadius: 8,
          padding: '8px 10px', fontSize: 13, fontFamily: 'inherit',
          marginBottom: 8,
        }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel}
          style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid #ccc',
            background: '#fff', color: '#888', fontSize: 12, cursor: 'pointer',
            fontFamily: 'inherit' }}>
          Back
        </button>
        <button onClick={() => name.trim() && onConfirm(name.trim())}
          disabled={!name.trim()}
          style={{ flex: 2, padding: '8px', borderRadius: 8, border: 'none',
            background: name.trim() ? G : '#ccc', color: '#fff',
            fontSize: 12, fontWeight: 700,
            cursor: name.trim() ? 'pointer' : 'default',
            fontFamily: 'inherit' }}>
          Add as New Course
        </button>
      </div>
    </div>
  );
}

// ── Step 1: Section selector ──────────────────────────────────────────────────
export function ImportModal({ parsed, onConfirm, onClose }) {
  const [sel, setSel] = useState({
    players: !!parsed.players?.length,
    courses: !!parsed.courses?.length,
    rounds:  !!parsed.rounds?.length,
  });

  const toggle = (k) => setSel(p => ({ ...p, [k]: !p[k] }));
  const noneSelected = !sel.players && !sel.courses && !sel.rounds;

  const rows = [
    { key: 'players', label: 'Players',      emoji: '👤', count: parsed.players?.length || 0 },
    { key: 'courses', label: 'Courses',       emoji: '⛳', count: parsed.courses?.length || 0 },
    { key: 'rounds',  label: 'Round history', emoji: '📋', count: parsed.rounds?.length  || 0 },
  ].filter(r => r.count > 0);

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:400,
      display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:'20px 20px 0 0', padding:22,
        width:'100%', maxWidth:520 }} onClick={e => e.stopPropagation()}>

        <div style={{ fontWeight:800, fontSize:17, color:G, marginBottom:2 }}>📥 Import Data</div>
        <div style={{ fontSize:12, color:'#888', marginBottom:16 }}>
          Choose what to import. Potential duplicates will be shown for review before anything is saved.
        </div>

        {rows.length === 0 && (
          <div style={{ textAlign:'center', color:'#aaa', padding:'20px 0', fontSize:13 }}>
            No importable data found in this file.
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:18 }}>
          {rows.map(({ key, label, emoji, count }) => (
            <div key={key} onClick={() => toggle(key)}
              style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px',
                borderRadius:12, border:`1.5px solid ${sel[key] ? G : '#ddd'}`,
                background: sel[key] ? GA : '#fff', cursor:'pointer' }}>
              <div style={{ width:22, height:22, borderRadius:6,
                border:`2px solid ${sel[key] ? G : '#ccc'}`,
                background: sel[key] ? G : '#fff',
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {sel[key] && <span style={{ color:'#fff', fontSize:13, fontWeight:900 }}>✓</span>}
              </div>
              <span style={{ fontSize:16 }}>{emoji}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:14, color: sel[key] ? G : '#333' }}>{label}</div>
                <div style={{ fontSize:11, color:'#888' }}>{count} record{count !== 1 ? 's' : ''}</div>
              </div>
            </div>
          ))}
        </div>

        {(sel.players || sel.courses || sel.rounds) && (
          <div style={{ background:'#fff8e1', border:'1px solid #f0d070', borderRadius:8,
            padding:'8px 12px', fontSize:11, color:'#7a5800', marginBottom:14 }}>
            ℹ️ Your existing data not in this file will always be kept intact.
          </div>
        )}

        <div style={{ display:'flex', gap:8 }}>
          <Btn variant="outline" onClick={onClose} style={{ flex:1 }}>Cancel</Btn>
          <Btn onClick={() => onConfirm(sel)} disabled={noneSelected || rows.length === 0}
            style={{ flex:2 }}>
            Next →
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Conflict resolver ─────────────────────────────────────────────────
export function ImportConflictModal({ conflicts, onResolved, onClose }) {
  const [idx,        setIdx]        = useState(0);
  const [decisions,  setDecisions]  = useState({});
  const [showRename, setShowRename] = useState(false);

  const conflict = conflicts[idx];
  if (!conflict) return null;

  const isCourse    = conflict.type === 'course';
  const diffs       = isCourse ? diffCourses(conflict.existing, conflict.incoming) : [];
  const nameDiffers = isCourse
    && normName(conflict.existing.name) !== normName(conflict.incoming.name);

  const conflictReason = conflict.sameId
    ? nameDiffers
      ? 'These records share the same internal ID but have different names — they may be different courses.'
      : 'Same record (matching ID) but some data has changed. Choose which version to keep.'
    : 'A course with a similar name already exists in your library. Review both and decide.';

  const advance = (decision) => {
    const newDecisions = { ...decisions, [idx]: decision };
    setDecisions(newDecisions);
    setShowRename(false);
    if (idx < conflicts.length - 1) {
      setIdx(idx + 1);
    } else {
      onResolved(newDecisions);
    }
  };

  const progress = `${idx + 1} of ${conflicts.length}`;

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:410,
      display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div style={{ background:'#fff', borderRadius:'20px 20px 0 0', padding:20,
        width:'100%', maxWidth:520, maxHeight:'90vh', overflowY:'auto' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
          <div>
            <div style={{ fontWeight:800, fontSize:16, color: nameDiffers ? '#c0392b' : AMB }}>
              {nameDiffers ? '🚨 Possible ID Conflict' : '⚠️ Possible Duplicate'}
            </div>
            <div style={{ fontSize:11, color:'#888', marginTop:1 }}>Conflict {progress}</div>
          </div>
          <button onClick={onClose}
            style={{ border:'none', background:'none', fontSize:18, color:'#bbb', cursor:'pointer', padding:'0 4px' }}>
            ✕
          </button>
        </div>

        {/* Reason banner */}
        <div style={{
          background: nameDiffers ? '#fff0ee' : AMBBG,
          border: `1px solid ${nameDiffers ? '#f5c0b8' : '#f0d070'}`,
          borderRadius: 10, padding: '8px 12px', marginBottom: 12,
          fontSize: 12, color: nameDiffers ? '#7a1a0a' : '#7a5800',
        }}>
          {conflictReason}
        </div>

        {/* Side-by-side course cards */}
        {isCourse && (
          <div style={{ display:'flex', gap:8, marginBottom:14 }}>
            <CourseSummaryCard
              course={conflict.existing}
              label="In Your Library"
              labelColor="#1a6e1a"
            />
            <CourseSummaryCard
              course={conflict.incoming}
              label="From File"
              labelColor="#1a5c8c"
            />
          </div>
        )}

        {/* Player diff table */}
        {!isCourse && (() => {
          const fields = ['name', 'gender', 'ghin', 'email', 'phone'];
          const labels = { name:'Name', gender:'Gender', ghin:'Handicap Index', email:'Email', phone:'Phone' };
          const playerDiffs = fields.filter(f =>
            (conflict.existing[f] || '') !== (conflict.incoming[f] || '') &&
            (conflict.existing[f] || conflict.incoming[f])
          );
          return playerDiffs.length > 0 ? (
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#555', marginBottom:6 }}>Field differences:</div>
              <div style={{ border:'1px solid #e0e0e0', borderRadius:10, overflow:'hidden' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', background:'#f5f5f5',
                  padding:'5px 10px', fontSize:10, fontWeight:700, color:'#888', gap:4 }}>
                  <span>Field</span>
                  <span style={{ color:'#1a6e1a' }}>Library</span>
                  <span style={{ color:'#1a5c8c' }}>File</span>
                </div>
                {playerDiffs.map((f, di) => (
                  <div key={f} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr',
                    padding:'7px 10px', fontSize:11, gap:4,
                    background: di % 2 === 0 ? '#fff' : '#fafafa',
                    borderTop:'1px solid #f0f0f0' }}>
                    <span style={{ fontWeight:600, color:'#555', fontSize:10 }}>{labels[f]}</span>
                    <span style={{ color:'#1a6e1a' }}>{conflict.existing[f] || '—'}</span>
                    <span style={{ color:'#1a5c8c' }}>{conflict.incoming[f] || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ background:'#f0faf0', border:'1px solid #c8e8c8', borderRadius:10,
              padding:'10px 14px', marginBottom:12, fontSize:12, color:'#2d6a2d' }}>
              ✅ Records appear identical — no field differences found.
            </div>
          );
        })()}

        {/* Action buttons (hidden while rename prompt is open) */}
        {!showRename && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => advance({ action: 'keep' })}
                style={{ flex:1, padding:'11px 8px', borderRadius:10, border:'1.5px solid #43a047',
                  background:'#e8f5e9', color:'#1a6e1a', fontWeight:700, fontSize:13,
                  cursor:'pointer', fontFamily:'inherit', textAlign:'center' }}>
                Keep Library
                <div style={{ fontSize:10, fontWeight:400, color:'#4caf50', marginTop:2 }}>
                  Discard the imported copy
                </div>
              </button>
              <button onClick={() => advance({ action: 'replace' })}
                style={{ flex:1, padding:'11px 8px', borderRadius:10, border:'1.5px solid #1e88e5',
                  background:'#e3f2fd', color:'#1a5c8c', fontWeight:700, fontSize:13,
                  cursor:'pointer', fontFamily:'inherit', textAlign:'center' }}>
                Use File
                <div style={{ fontSize:10, fontWeight:400, color:'#42a5f5', marginTop:2 }}>
                  Replace library with this
                </div>
              </button>
            </div>
            {isCourse && (
              <button onClick={() => setShowRename(true)}
                style={{ width:'100%', padding:'11px 8px', borderRadius:10,
                  border:`1.5px solid ${G}`, background:'#e8f4e8', color: G,
                  fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                Keep Both
                <span style={{ fontWeight:400, fontSize:11, color:'#5a9a5a', marginLeft:6 }}>
                  Add imported course under a new name
                </span>
              </button>
            )}
          </div>
        )}

        {/* Rename prompt */}
        {showRename && (
          <RenamePrompt
            defaultName={conflict.incoming.name}
            onConfirm={(newName) => advance({ action: 'keep_both', newName })}
            onCancel={() => setShowRename(false)}
          />
        )}

        {/* Progress dots */}
        {conflicts.length > 1 && (
          <div style={{ display:'flex', justifyContent:'center', gap:5, marginTop:14 }}>
            {conflicts.map((_, i) => (
              <div key={i} style={{ width:7, height:7, borderRadius:'50%',
                background: i === idx ? G : i < idx ? '#a8d8a8' : '#ddd' }} />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
