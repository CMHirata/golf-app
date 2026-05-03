// ─── CourseCard.jsx ────────────────────────────────────────────────────────────
// ✅ Self-checked (13-E.7): Verbatim extraction of the Course card body from
// NewRoundPage.jsx (lines ~845–1037 pre-extraction). No logic added or removed.
// All setters are parent-owned; this component is render-only for the card body.
// NineDropdown imported from NewRoundHelpers (B resolution — shared helpers file).
// H-23 draft-string pattern preserved intact: clamp on blur, not on keystroke.
// H-6: no new picker implementations introduced.
// State ownership: zero local state; all values and setters come from props.

import { G, GA, Card } from '../../components/ui.jsx';
import { NineDropdown } from './NewRoundHelpers.jsx';

// Props:
//   Data:    course, courseFromLib, courseSnapshot, isReload, allCourses,
//            frontNine, backNine, roundStartHole, roundNumHoles,
//            startHoleDraft, endHoleDraft, roundLengthError
//   Setters: setShowCoursePicker, setFrontNine, setBackNine,
//            setRoundStartHole, setRoundNumHoles,
//            setStartHoleDraft, setEndHoleDraft
export default function CourseCard({
  course, courseFromLib, courseSnapshot, isReload, allCourses,
  frontNine, backNine, roundStartHole, roundNumHoles,
  startHoleDraft, endHoleDraft, roundLengthError,
  setShowCoursePicker, setFrontNine, setBackNine,
  setRoundStartHole, setRoundNumHoles,
  setStartHoleDraft, setEndHoleDraft,
}) {
  return (
    <Card>
      <div style={{ fontWeight:700, fontSize:14, color:G, marginBottom:8 }}>Course</div>
      {isReload && courseSnapshot && !courseFromLib && (
        <div style={{ background:'#fff8e8', border:'1px solid #f0d070', borderRadius:8, padding:'7px 11px', marginBottom:8, fontSize:12, color:'#7a5800' }}>
          <strong>{courseSnapshot.name}</strong> is not in your current course library. Using saved course data.
        </div>
      )}
      {allCourses.length === 0 && !courseSnapshot ? (
        <p style={{ fontSize:12, color:'#aaa' }}>No courses saved. Go to Courses tab to add one.</p>
      ) : (
        /* Course picker trigger — styled like player picker */
        <button onClick={() => setShowCoursePicker(true)}
          style={{ width:'100%', padding:'10px 12px', borderRadius:12, border:`1.5px solid ${course ? G : '#ddd'}`, background:course ? GA : '#fff', cursor:'pointer', fontFamily:'inherit', marginBottom: course ? 8 : 0, textAlign:'left', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          {course ? (
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:700, color:G, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{course.name}</div>
              {course.location && <div style={{ fontSize:11, color:G, opacity:0.7, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{course.location}</div>}
            </div>
          ) : (
            <span style={{ fontSize:13, color:'#aaa' }}>Select a course…</span>
          )}
          <span style={{ fontSize:11, color: course ? G : '#bbb', flexShrink:0, marginLeft:8 }}>▼</span>
        </button>
      )}

      {/* Front 9 / Back 9 — only shown when course has more than 2 nines */}
      {course?.nines?.length > 2 && (
        <div style={{ display:'flex', gap:8, marginBottom:8 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#666', marginBottom:4 }}>Front 9</div>
            <NineDropdown
              nines={course.nines}
              value={frontNine}
              onChange={setFrontNine}
              label="Front 9"
            />
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#666', marginBottom:4 }}>Back 9</div>
            <NineDropdown
              nines={course.nines}
              value={backNine}
              onChange={setBackNine}
              label="Back 9"
            />
          </div>
        </div>
      )}

      {/* ── 13-C.2: Round Length — Start Hole + End Hole ───────────────── */}
      {/* Stored as roundStartHole (0-based) + roundNumHoles. UI uses       */}
      {/* 1-based Start + End (inclusive). Draft-string pattern: field      */}
      {/* holds raw text during editing; validation/clamp runs on blur.     */}
      {/* Defaults: Start 1, End 18 → no-op for full rounds.                */}
      {/* A1 fix pass 4: each <input> is wrapped in a flex-centered outer   */}
      {/* <div> (same pattern as ScoreGrid's renderCell). The outer div has */}
      {/* fixed height and centers its content vertically; the input itself */}
      {/* has auto-height and no background/border. This decouples box      */}
      {/* stability from the browser's internal text-baseline quirks,       */}
      {/* which shift between empty-cursor and populated-text states on iOS.*/}
      <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#666', marginBottom:4 }}>Start Hole</div>
          <div style={{
            // Outer shell — owns the box dimensions, border, background.
            height: 38,
            border:`1px solid ${roundLengthError ? '#c0392b' : '#ddd'}`,
            borderRadius:8,
            background:'#fff',
            display:'flex',
            alignItems:'center',
            justifyContent:'center',
            boxSizing:'border-box',
          }}>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              autoCapitalize="none"
              value={startHoleDraft !== null ? startHoleDraft : String(roundStartHole + 1)}
              onFocus={() => { setStartHoleDraft(''); }}
              onChange={e => {
                const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
                setStartHoleDraft(digits);
              }}
              onBlur={() => {
                // Commit: validate draft, update state. Invalid entries revert
                // (A6 fix). Start change preserves End Hole when still valid;
                // only bumps End up if forced (B4 fix).
                const raw = startHoleDraft;
                setStartHoleDraft(null);
                if (raw === null || raw === '') return;
                const n = parseInt(raw, 10);
                if (Number.isNaN(n) || n < 1 || n > 18) return;
                const newStart = n - 1;
                const currentEnd1b = roundStartHole + roundNumHoles;
                const minEnd1b     = newStart + 3;
                const newEnd1b     = Math.min(18, Math.max(minEnd1b, currentEnd1b));
                setRoundStartHole(newStart);
                setRoundNumHoles(newEnd1b - newStart);
              }}
              style={{
                // Inner element — minimal styling; let outer div own layout.
                width: '100%',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                textAlign: 'center',
                fontSize: 13,
                fontFamily: 'inherit',
                color: G,
                fontWeight: 700,
                padding: 0,
                margin: 0,
                WebkitAppearance: 'none',
                appearance: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#666', marginBottom:4 }}>End Hole</div>
          <div style={{
            height: 38,
            border:`1px solid ${roundLengthError ? '#c0392b' : '#ddd'}`,
            borderRadius:8,
            background:'#fff',
            display:'flex',
            alignItems:'center',
            justifyContent:'center',
            boxSizing:'border-box',
          }}>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              autoCapitalize="none"
              value={endHoleDraft !== null ? endHoleDraft : String(roundStartHole + roundNumHoles)}
              onFocus={() => { setEndHoleDraft(''); }}
              onChange={e => {
                const digits = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
                setEndHoleDraft(digits);
              }}
              onBlur={() => {
                const raw = endHoleDraft;
                setEndHoleDraft(null);
                if (raw === null || raw === '') return;
                const n = parseInt(raw, 10);
                const minEnd = roundStartHole + 3;
                if (Number.isNaN(n) || n < minEnd || n > 18) return;
                setRoundNumHoles(n - roundStartHole);
              }}
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                textAlign: 'center',
                fontSize: 13,
                fontFamily: 'inherit',
                color: G,
                fontWeight: 700,
                padding: 0,
                margin: 0,
                WebkitAppearance: 'none',
                appearance: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      </div>
      {/* Inline description / error */}
      {!roundLengthError && (roundStartHole !== 0 || roundNumHoles !== 18) && (
        <div style={{ fontSize:11, color:'#888', marginTop:6 }}>
          Playing {roundNumHoles} holes · {roundStartHole + 1} through {roundStartHole + roundNumHoles}.
        </div>
      )}
      {roundLengthError && (
        <div style={{ fontSize:11, color:'#c0392b', marginTop:6, fontWeight:600 }}>
          {roundLengthError}
        </div>
      )}

    </Card>
  );
}
