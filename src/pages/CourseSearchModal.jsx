// ─── CourseSearchModal.jsx ─────────────────────────────────────────────────────
// Pure render component — no logic, no state mutations beyond local search state.
// AI-powered course search: queries KNOWN_COURSES first, then falls back to the
// aiSearchCourses API. Highlights results already in the user's library.
// On selection calls onSelect(courseData); on cancel calls onClose().

import { useState } from 'react';
import { Btn, Inp, G, GA, AMB, AMBBG, RED } from '../components/ui.jsx';
import { aiSearchCourses, KNOWN_COURSES, likelySameCourse } from '../services/courseLib.js';

export default function CourseSearchModal({ existingCourses, onSelect, onClose }) {
  const [q, setQ]     = useState('');
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const search = async () => {
    if (!q.trim()) return;
    setLoading(true); setErr(''); setRes(null);
    const known = KNOWN_COURSES.filter(
      c => c.name.toLowerCase().includes(q.toLowerCase()) ||
           (c.location || '').toLowerCase().includes(q.toLowerCase())
    );
    if (known.length > 0) { setRes(known); setLoading(false); return; }
    try   { const d = await aiSearchCourses(q); setRes(d.courses || []); }
    catch (e) { setErr(`Search error: ${e.message}`); }
    setLoading(false);
  };

  const isDuplicate = (course) =>
    existingCourses.some(e => likelySameCourse(e.name, course.name));

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:20, padding:22, width:'100%', maxWidth:500, maxHeight:'88vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
          <div>
            <div style={{ fontWeight:800, fontSize:17, color:G }}>Find a Course</div>
            <div style={{ fontSize:11, color:'#888' }}>AI-powered · Full tee, rating, slope & yardage data</div>
          </div>
          <button onClick={onClose} style={{ border:'none', background:'none', fontSize:24, cursor:'pointer', color:'#aaa' }}>×</button>
        </div>
        <div style={{ display:'flex', gap:8, marginBottom:14 }}>
          <Inp value={q} onChange={setQ} placeholder="Course name, city, state…" onKeyDown={e=>e.key==='Enter'&&search()} style={{ flex:1 }}/>
          <Btn onClick={search} disabled={loading||!q.trim()}>{loading ? '…' : 'Search'}</Btn>
        </div>
        {err && <div style={{ background:'#fce8e8', color:RED, borderRadius:8, padding:'9px 12px', fontSize:13, marginBottom:10 }}>{err}</div>}
        {res?.length === 0 && <div style={{ textAlign:'center', color:'#aaa', padding:20 }}>No results. Try different terms or use Manual entry.</div>}
        {res?.map((c, i) => {
          const dup = isDuplicate(c);
          return (
            <div key={i} onClick={()=>onSelect(c)}
              style={{ border:`1.5px solid ${dup ? AMB : '#e0ece0'}`, borderRadius:12, padding:'12px 15px', marginBottom:8, cursor:'pointer', background: dup ? AMBBG : '#fff' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:14, color:G }}>{c.name}</div>
                  <div style={{ fontSize:12, color:'#888' }}>{c.location}</div>
                </div>
                {dup && <span style={{ fontSize:10, background:AMB, color:'#fff', borderRadius:6, padding:'2px 7px', flexShrink:0, marginLeft:6 }}>in library</span>}
              </div>
              <div style={{ display:'flex', gap:5, marginTop:6, flexWrap:'wrap' }}>
                {c.nines?.map((n,ni) => (
                  <span key={ni} style={{ background:GA, color:G, borderRadius:20, padding:'2px 8px', fontSize:11, fontWeight:600 }}>
                    {n.name} (par {n.pars?.reduce((a,b)=>a+b,0)||'?'})
                  </span>
                ))}
              </div>
              {c.tees?.length > 0 && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:6 }}>
                  {c.tees.map((t,ti) => (
                    <span key={ti} style={{ fontSize:10, color:'#666', background:'#f4f4f4', borderRadius:6, padding:'2px 6px' }}>
                      {t.name}: {t.rating}/{t.slope}
                      {t.ratingW ? ` · W:${t.ratingW}/${t.slopeW}` : ''}
                      {(t.totalYards||(t.nineYards?.reduce((a,b)=>a+b,0))) ? ` · ${t.totalYards||(t.nineYards?.reduce((a,b)=>a+b,0))}y` : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
