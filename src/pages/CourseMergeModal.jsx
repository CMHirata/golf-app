// ─── CourseMergeModal.jsx ──────────────────────────────────────────────────────
// Pure render component — no logic, no state mutations beyond local UI state.
// Shown when an incoming course matches an existing library entry.
// Lets the user keep the library version, use the incoming version, or
// merge field-by-field with a tap-to-toggle diff UI.
//
// Comparison logic (normCourseName, likelySameCourse, diffCourses) lives in
// courseLib.js — the authoritative service layer for all course data logic.

import { useState, useMemo } from 'react';
import { Btn, G, GB, AMB, AMBBG } from '../components/ui.jsx';
import { diffCourses } from '../services/courseLib.js';

export default function CourseMergeModal({ existing, incoming, onKeepExisting, onUseIncoming, onMerge, onClose }) {
  const diffs = useMemo(() => diffCourses(existing, incoming), [existing, incoming]);
  // For each diff field, track which version user chose: 'old' | 'new'
  const [choices, setChoices] = useState(() => Object.fromEntries(diffs.map(d => [d.field, 'new'])));

  const toggle = (field) => setChoices(c => ({ ...c, [field]: c[field] === 'new' ? 'old' : 'new' }));

  if (diffs.length === 0) {
    return (
      <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:400, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={onClose}>
        <div style={{ background:'#fff', borderRadius:20, padding:22, width:'100%', maxWidth:420 }} onClick={e=>e.stopPropagation()}>
          <div style={{ fontWeight:800, fontSize:17, color:G, marginBottom:6 }}>No Differences Found</div>
          <p style={{ fontSize:13, color:'#555', marginBottom:16 }}>
            <strong>{incoming.name}</strong> matches what's already in your library. No update needed.
          </p>
          <Btn onClick={onClose} style={{ width:'100%' }}>OK, Keep Existing</Btn>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:400, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'16px 16px 80px', overflowY:'auto' }} onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:20, padding:22, width:'100%', maxWidth:500, marginTop:10 }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
          <div>
            <div style={{ fontWeight:800, fontSize:17, color:AMB }}>Course Already Exists</div>
            <div style={{ fontSize:11, color:'#888' }}>{incoming.name} · {diffs.length} difference{diffs.length!==1?'s':''} found</div>
          </div>
          <button onClick={onClose} style={{ border:'none', background:'none', fontSize:24, cursor:'pointer', color:'#aaa' }}>×</button>
        </div>

        <div style={{ background:AMBBG, color:AMB, borderRadius:8, padding:'9px 12px', fontSize:12, marginBottom:14 }}>
          Tap each row to choose which version to keep. Tap <strong>Save Merged</strong> when done, or keep either version as-is.
        </div>

        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, fontWeight:700, color:'#888', marginBottom:6, padding:'0 4px' }}>
          <span>FIELD</span>
          <div style={{ display:'flex', gap:28 }}><span style={{color:'#888'}}>LIBRARY</span><span style={{color:G}}>INCOMING</span></div>
        </div>

        {diffs.map(d => {
          const picked = choices[d.field];
          return (
            <div key={d.field} onClick={() => toggle(d.field)}
              style={{ border:`1.5px solid ${picked==='new' ? G : '#ddd'}`, borderRadius:10, padding:'9px 12px', marginBottom:6, cursor:'pointer', background: picked==='new' ? GB : '#fafafa' }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#888', marginBottom:3 }}>{d.label}</div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <div style={{ flex:1, fontSize:13, color: picked==='old' ? '#222' : '#bbb', textDecoration: picked==='new' ? 'line-through' : 'none' }}>{d.old}</div>
                <div style={{ fontSize:16, color:'#ccc' }}>→</div>
                <div style={{ flex:1, fontSize:13, fontWeight: picked==='new' ? 700 : 400, color: picked==='new' ? G : '#bbb' }}>{d.neu}</div>
              </div>
              <div style={{ fontSize:10, color:'#aaa', textAlign:'right', marginTop:2 }}>tap to toggle · using: {picked==='new'?'incoming':'library'}</div>
            </div>
          );
        })}

        <div style={{ display:'flex', gap:8, marginTop:14 }}>
          <Btn variant="outline" onClick={onKeepExisting} style={{ flex:1, fontSize:12 }}>Keep Library</Btn>
          <Btn variant="outline" onClick={onUseIncoming} style={{ flex:1, fontSize:12, borderColor:AMB, color:AMB }}>Use All New</Btn>
          <Btn onClick={() => onMerge(choices, diffs)} style={{ flex:2, fontSize:13 }}>Save Merged</Btn>
        </div>
      </div>
    </div>
  );
}
