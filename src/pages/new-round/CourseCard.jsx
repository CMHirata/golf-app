// ─── CourseCard.jsx ────────────────────────────────────────────────────────────
// Pure render component — no logic, no state mutations.
// Displays the expanded detail body for a single course entry:
// hole grid (par + stroke index per nine) and tees table (rating/slope/yards).
// Shown when the user taps a course row in CoursesPage to expand it.

import { useState } from 'react';
import { G, GA, GB } from '../components/ui.jsx';

const PINK   = '#c2185b';
const PINKBG = '#fce4ec';

export default function CourseCard({ course }) {
  const hasWomens = course.nines?.some(n => n.handicapsWomen?.length || n.parsWomen?.length) ||
                    course.tees?.some(t => t.ratingW);
  const [gender, setGender] = useState('M'); // 'M' | 'F'
  const isW = gender === 'F';
  const accentColor = isW ? PINK : G;

  return (
    <div style={{ padding:'0 12px 12px', borderTop:'1px solid #f0f8f0' }}>

      {/* Gender toggle — only shown when women's data exists */}
      {hasWomens && (
        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:10, marginBottom:2 }}>
          <div style={{ fontSize:10, color:'#aaa', fontWeight:600 }}>Showing:</div>
          <div style={{ display:'flex', background:'#f0f0f0', borderRadius:20, padding:2, gap:2 }}>
            {[{ v:'M', label:"Men's" }, { v:'F', label:"Women's" }].map(opt => (
              <button key={opt.v} onClick={() => setGender(opt.v)} style={{
                padding:'3px 12px', borderRadius:16, border:'none', cursor:'pointer',
                fontSize:11, fontWeight:700, transition:'all .15s',
                background: gender === opt.v ? (opt.v === 'F' ? PINK : G) : 'transparent',
                color:       gender === opt.v ? '#fff' : '#888',
              }}>{opt.label}</button>
            ))}
          </div>
        </div>
      )}

      {/* Nines — hole number, par, handicap */}
      {course.nines?.map((nine, ni) => {
        const pars = (isW && nine.parsWomen?.length) ? nine.parsWomen : nine.pars;
        const hcps = (isW && nine.handicapsWomen?.length) ? nine.handicapsWomen : nine.handicaps;
        const total = pars?.reduce((a,b) => a+b, 0) ?? '?';
        return (
          <div key={ni} style={{ marginTop:10 }}>
            <div style={{ fontSize:11, fontWeight:700, color:accentColor, marginBottom:4 }}>
              {nine.name} — Par {total}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(9,1fr)', gap:3, textAlign:'center' }}>
              {pars?.map((par, h) => (
                <div key={h} style={{ background: isW ? '#fff0f5' : '#fafafa', borderRadius:4, padding:'3px 0' }}>
                  <div style={{ fontSize:8, color:'#aaa' }}>{h+1}</div>
                  <div style={{ fontSize:12, fontWeight:700, color:accentColor }}>{par}</div>
                  <div style={{ fontSize:9, color: isW ? `${PINK}99` : '#bbb' }}>{hcps?.[h] ?? ''}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize:9, color:'#bbb', marginTop:2 }}>
              hole · par · stroke index
            </div>
          </div>
        );
      })}

      {/* Tees table — Rating, Slope, Yards for selected gender */}
      {course.tees?.length > 0 && (
        <div style={{ marginTop:12 }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
              <thead>
                <tr style={{ background: isW ? PINKBG : GB }}>
                  <th style={{ textAlign:'left',   padding:'4px 8px', color:accentColor, fontWeight:700 }}>Tee</th>
                  <th style={{ textAlign:'center', padding:'4px 6px', color:accentColor, fontWeight:700 }}>Rating</th>
                  <th style={{ textAlign:'center', padding:'4px 6px', color:accentColor, fontWeight:700 }}>Slope</th>
                  <th style={{ textAlign:'center', padding:'4px 6px', color:accentColor, fontWeight:700 }}>Yards</th>
                </tr>
              </thead>
              <tbody>
                {course.tees.map((t, ti) => {
                  const rating = isW ? (t.ratingW ?? '—') : (t.rating ?? '—');
                  const slope  = isW ? (t.slopeW  ?? '—') : (t.slope  ?? '—');
                  const nineCount = course.nines?.length || 2;
                  const ny = t.nineYards;

                  // Yardage display — depends on number of nines
                  let yardsMain, yardsSub;
                  if (nineCount === 3 && ny?.length === 3) {
                    // 27-hole: show three 18-hole combos
                    const comboTotals = `${ny[0]+ny[1]} / ${ny[1]+ny[2]} / ${ny[2]+ny[0]}`;
                    yardsMain = comboTotals;
                    if (course.nineComboNames?.length === 3) {
                      // Use combo names from card (e.g. South/North, North/East, East/South)
                      yardsSub = course.nineComboNames.join(' · ');
                    } else {
                      // Fallback: derive from nine names
                      const names = course.nines.map(n => n.name?.[0] || '?');
                      yardsSub = `${names[0]}/${names[1]} · ${names[1]}/${names[2]} · ${names[2]}/${names[0]}`;
                    }
                  } else if (ny?.length) {
                    yardsMain = t.totalYards || ny.reduce((a,b) => a+b, 0);
                    yardsSub  = ny.join(' / ');
                  } else {
                    yardsMain = t.totalYards || '—';
                    yardsSub  = null;
                  }

                  // Dim rows that have no women's data when in women's mode
                  const dimmed = isW && !t.ratingW;
                  return (
                    <tr key={ti} style={{
                      borderTop:'1px solid #eee',
                      background: ti%2===0 ? '#fff' : '#fcfcfc',
                      opacity: dimmed ? 0.45 : 1,
                    }}>
                      <td style={{ padding:'5px 8px', fontWeight:700, color:accentColor }}>{t.name}</td>
                      <td style={{ textAlign:'center', padding:'5px 6px', color:'#333' }}>{rating}</td>
                      <td style={{ textAlign:'center', padding:'5px 6px', color:'#333' }}>{slope}</td>
                      <td style={{ textAlign:'center', padding:'5px 6px', color:'#555' }}>
                        <span style={{ fontWeight:700 }}>{yardsMain}</span>
                        {yardsSub && <div style={{ fontSize:9, color:'#aaa', marginTop:1 }}>{yardsSub}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {isW && course.tees.some(t => !t.ratingW) && (
            <div style={{ fontSize:10, color:'#aaa', marginTop:4 }}>
              Dimmed tees have no women's rating on file.
            </div>
          )}
        </div>
      )}

    </div>
  );
}
