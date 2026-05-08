// ─── CoursesPage.jsx ──────────────────────────────────────────────────────────
// State owner and page chrome for the course library.
// Owns: course list state, modal open/close flags, merge state.
// Delegates all rendering to extracted components:
//   CourseCard          — expanded detail view (nines + tees table)
//   CourseMergeModal    — diff/merge UI when an incoming course matches an existing one
//   ManualCourseModal   — manual add and edit flows (TeeRow + NineEditor inside)
//   PhotoImportModal    — AI scorecard photo scan flow
//   CourseSearchModal   — AI course search flow
//
// ✅ Self-checked: SwipeableRow replaces inline Edit/✕ buttons; openRowId lifted
//    to page level; handleDelete confirm removed from CoursesPage (lives in
//    SwipeableRow deleteWarning); expandedId click still works (not inside swipe area).

import { useState, useCallback } from 'react';
import { courseLib, likelySameCourse } from '../services/courseLib.js';
import { Card, G } from '../components/ui.jsx';
import CourseCard        from './CourseCard.jsx';
import CourseMergeModal  from './CourseMergeModal.jsx';
import ManualCourseModal from './ManualCourseModal.jsx';
import PhotoImportModal  from './PhotoImportModal.jsx';
import CourseSearchModal from './CourseSearchModal.jsx';
import SwipeableRow      from '../components/SwipeableRow.jsx';

export default function CoursesPage() {
  const [courses,       setCourses]       = useState(() => courseLib.list());
  const [expandedId,    setExpandedId]    = useState(null);
  const [showPhoto,     setShowPhoto]     = useState(false);
  const [showManual,    setShowManual]    = useState(false);
  const [showSearch,    setShowSearch]    = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  // Merge state: { existing: Course, incoming: Course }
  const [mergeState,    setMergeState]    = useState(null);
  const [openRowId,     setOpenRowId]     = useState(null);

  const refresh = useCallback(() => setCourses(courseLib.list()), []);

  /** Called when any add-flow returns a course data object */
  const handleIncomingCourse = useCallback((data) => {
    const all = courseLib.list();
    const dup = all.find(e => likelySameCourse(e.name, data.name));
    if (dup) {
      setMergeState({ existing: dup, incoming: data });
    } else {
      courseLib.save(data);
      refresh();
    }
    setShowPhoto(false); setShowManual(false); setShowSearch(false);
  }, [refresh]);

  const handleEdit = (data) => {
    courseLib.update(editingCourse.id, data);
    refresh();
    setEditingCourse(null);
  };

  const handleDelete = (id, name) => {
    courseLib.delete(id);
    refresh();
  };

  // Merge modal actions
  const handleMergeKeepExisting = () => setMergeState(null);

  const handleMergeUseIncoming = () => {
    if (!mergeState) return;
    courseLib.update(mergeState.existing.id, { ...mergeState.incoming, id: mergeState.existing.id });
    refresh();
    setMergeState(null);
  };

  const handleMergeCustom = (choices, diffs) => {
    if (!mergeState) return;
    // Start with existing, apply chosen 'new' fields
    const merged = JSON.parse(JSON.stringify(mergeState.existing));
    diffs.forEach(d => {
      if (choices[d.field] !== 'new') return;
      // Apply incoming value for the differing field
      if (d.field === 'location') merged.location = mergeState.incoming.location;
      else if (d.field.startsWith('tee_new_')) {
        const tName = d.field.replace('tee_new_', '');
        const it = mergeState.incoming.tees?.find(t => t.name?.toLowerCase()===tName);
        if (it) { merged.tees = merged.tees || []; merged.tees.push(it); }
      } else if (d.field.startsWith('tee_')) {
        const tName = d.field.replace('teeW_','').replace('tee_','');
        const it = mergeState.incoming.tees?.find(t => t.name?.toLowerCase()===tName);
        const ei = merged.tees?.findIndex(t => t.name?.toLowerCase()===tName);
        if (it && ei>=0) {
          if (d.field.startsWith('teeW_')) { merged.tees[ei].ratingW=it.ratingW; merged.tees[ei].slopeW=it.slopeW; }
          else { merged.tees[ei].rating=it.rating; merged.tees[ei].slope=it.slope; }
        }
      } else if (d.field.startsWith('yards_')) {
        const tName = d.field.replace('yards_','');
        const it = mergeState.incoming.tees?.find(t => t.name?.toLowerCase()===tName);
        const ei = merged.tees?.findIndex(t => t.name?.toLowerCase()===tName);
        if (it && ei>=0) { merged.tees[ei].nineYards=it.nineYards; merged.tees[ei].totalYards=it.totalYards; }
      } else if (d.field.startsWith('par_')) {
        const ni = parseInt(d.field.replace('par_',''));
        if (merged.nines?.[ni]) merged.nines[ni].pars = mergeState.incoming.nines?.[ni]?.pars;
      } else if (d.field.startsWith('hcp_')) {
        const ni = parseInt(d.field.replace('hcp_',''));
        if (merged.nines?.[ni]) merged.nines[ni].handicaps = mergeState.incoming.nines?.[ni]?.handicaps;
      } else if (d.field.startsWith('hcpw_')) {
        const ni = parseInt(d.field.replace('hcpw_',''));
        if (merged.nines?.[ni]) merged.nines[ni].handicapsWomen = mergeState.incoming.nines?.[ni]?.handicapsWomen;
      } else if (d.field.startsWith('nine_')) {
        const ni = parseInt(d.field.replace('nine_',''));
        const inNine = mergeState.incoming.nines?.[ni];
        if (inNine) { merged.nines = merged.nines||[]; merged.nines[ni] = inNine; }
      }
    });
    courseLib.update(mergeState.existing.id, merged);
    refresh();
    setMergeState(null);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#eef4ee' }}>
      {/* Header */}
      <div style={{ background:G, padding:'8px 16px 7px', position:'sticky', top:0, zIndex:10, boxShadow:'0 2px 12px rgba(0,0,0,.2)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <img src="/logo_lockup.png" alt="The Card" style={{ height:58, width:'auto', display:'block' }} />
        <div style={{ color:'#fff', fontWeight:800, fontSize:16, letterSpacing:'0.12em', textTransform:'uppercase', fontFamily:'inherit' }}>Courses</div>
      </div>

      <div style={{ padding: '14px 14px', maxWidth: 520, margin: '0 auto' }}>

        {/* Add buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
          {[
            { label: 'Search',    onClick: () => setShowSearch(true),  filled: true  },
            { label: 'Scan Card', onClick: () => setShowPhoto(true),   filled: true  },
            { label: 'Manual',    onClick: () => setShowManual(true),  filled: false },
          ].map(({ label, onClick, filled }) => (
            <button key={label} onClick={onClick} style={{
              width: '100%', padding: '6px 0', borderRadius: 20, textAlign: 'center',
              border: '1.5px solid ' + G,
              background: filled ? G : '#fff',
              color: filled ? '#fff' : G,
              fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {label}
            </button>
          ))}
        </div>

        {/* Course list */}
        <Card>
          <div style={{ fontWeight: 700, fontSize: 14, color: G, marginBottom: 10 }}>
            Saved Courses ({courses.length})
          </div>
          {courses.length === 0 && (
            <p style={{ fontSize: 13, color: '#aaa', textAlign: 'center', padding: '16px 0' }}>
              No courses yet. Search, scan a scorecard, or enter manually.
            </p>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {courses.map(c => {
              const expanded = expandedId === c.id;
              const totalPar = c.nines?.reduce((s,n) => s+(n.pars?.reduce((a,b)=>a+b,0)||0), 0) || null;
              return (
                <SwipeableRow
                  key={c.id}
                  id={c.id}
                  openId={openRowId}
                  setOpenId={setOpenRowId}
                  onEdit={() => { setOpenRowId(null); setEditingCourse(c); }}
                  onDelete={() => handleDelete(c.id, c.name)}
                  deleteWarning={`Remove "${c.name}" from your library?`}
                >
                  <div style={{ border: '1.5px solid #e0ece0', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px', cursor:'pointer' }}
                      onClick={() => setExpandedId(expanded ? null : c.id)}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: G, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.name}
                        </div>
                        {c.location && <div style={{ fontSize: 11, color: '#888' }}>{c.location}</div>}
                        <div style={{ display:'flex', gap:8, fontSize:11, color:'#aaa', marginTop:1, flexWrap:'wrap' }}>
                          <span>{c.nines?.length||0} nine(s){totalPar ? ` · par ${totalPar}` : ''}</span>
                          <span>{c.tees?.length||0} tee(s)</span>
                        </div>
                      </div>
                    </div>
                    {expanded && <CourseCard course={c} />}
                  </div>
                </SwipeableRow>
              );
            })}
          </div>
        </Card>
      </div>

      {showSearch && (
        <CourseSearchModal
          existingCourses={courses}
          onSelect={handleIncomingCourse}
          onClose={()=>setShowSearch(false)}
        />
      )}
      {showPhoto && (
        <PhotoImportModal
          onImport={handleIncomingCourse}
          onClose={()=>setShowPhoto(false)}
        />
      )}
      {showManual && (
        <ManualCourseModal
          onSave={handleIncomingCourse}
          onClose={()=>setShowManual(false)}
        />
      )}
      {editingCourse && (
        <ManualCourseModal
          initialData={editingCourse}
          onSave={handleEdit}
          onClose={()=>setEditingCourse(null)}
        />
      )}
      {mergeState && (
        <CourseMergeModal
          existing={mergeState.existing}
          incoming={mergeState.incoming}
          onKeepExisting={handleMergeKeepExisting}
          onUseIncoming={handleMergeUseIncoming}
          onMerge={handleMergeCustom}
          onClose={handleMergeKeepExisting}
        />
      )}
    </div>
  );
}
