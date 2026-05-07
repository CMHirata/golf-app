// ─── PlayerPickerPopup.jsx ────────────────────────────────────────────────────
// Bottom-sheet popup for selecting and ordering round players.
// Render-only extraction from NewRoundPage.jsx — no logic changes.
// Props: allPlayers, selectedIds, onConfirm, onClose

import { useState } from 'react';
import { Btn, G, GA } from '../components/ui.jsx';

export default function PlayerPickerPopup({ allPlayers, selectedIds, onConfirm, onClose }) {
  const [ids, setIds] = useState([...selectedIds]);

  const toggle = (id) => {
    setIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const moveUp   = (i) => { if (i === 0) return; const n=[...ids]; [n[i-1],n[i]]=[n[i],n[i-1]]; setIds(n); };
  const moveDown = (i) => { if (i===ids.length-1) return; const n=[...ids]; [n[i],n[i+1]]=[n[i+1],n[i]]; setIds(n); };

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:300,display:'flex',alignItems:'flex-end',justifyContent:'center' }} onClick={onClose}>
      {/* Bottom sheet — flex column so buttons stay pinned at bottom regardless of list length */}
      <div style={{ background:'#fff',borderRadius:'20px 20px 0 0',width:'100%',maxWidth:520,maxHeight:'80vh',display:'flex',flexDirection:'column' }} onClick={e=>e.stopPropagation()}>

        {/* Scrollable list area */}
        <div style={{ overflowY:'auto',flex:1,padding:'20px 20px 8px' }}>
          <div style={{ fontWeight:800,fontSize:17,color:G,marginBottom:4 }}>Select Players</div>
          <div style={{ fontSize:11,color:'#888',marginBottom:14 }}>Tap to add · use arrows to reorder</div>
          {allPlayers.length === 0 && (
            <p style={{ textAlign:'center',color:'#aaa',padding:'20px 0',fontSize:13 }}>No players saved yet. Go to the Players tab to add some.</p>
          )}
          <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
            {allPlayers.map(p => {
              const sel = ids.includes(p.id);
              const pos = ids.indexOf(p.id);
              return (
                <div key={p.id} style={{ display:'flex',alignItems:'center',gap:8,padding:'9px 12px',borderRadius:12,border:`1.5px solid ${sel?G:'#eee'}`,background:sel?GA:'#fff',cursor:'pointer' }}
                  onClick={()=>toggle(p.id)}>
                  <div style={{ width:28,height:28,borderRadius:'50%',background:sel?G:GA,display:'flex',alignItems:'center',justifyContent:'center',color:sel?'#fff':G,fontWeight:800,fontSize:13,flexShrink:0 }}>
                    {sel ? pos+1 : p.name[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600,fontSize:14,color:sel?G:'#333',display:'flex',alignItems:'center',gap:4 }}>
                      {p.name}
                      {p.starred && <span style={{ fontSize:11,color:'#f59e0b',lineHeight:1 }}>★</span>}
                    </div>
                    {p.ghin && <div style={{ fontSize:11,color:'#888' }}>HI: {p.ghin}</div>}
                  </div>
                  {sel && (
                    <div style={{ display:'flex',gap:3 }} onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>moveUp(pos)} style={{ border:'1px solid #ddd',borderRadius:6,background:'#fff',width:24,height:24,cursor:'pointer',fontSize:12 }}>↑</button>
                      <button onClick={()=>moveDown(pos)} style={{ border:'1px solid #ddd',borderRadius:6,background:'#fff',width:24,height:24,cursor:'pointer',fontSize:12 }}>↓</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Pinned action row — always visible at the bottom of the sheet */}
        <div style={{ padding:'10px 20px 24px', borderTop:'1px solid #eee', background:'#fff', flexShrink:0 }}>
          <div style={{ display:'flex',gap:8 }}>
            <Btn variant="outline" onClick={onClose} style={{ flex:1 }}>Cancel</Btn>
            <Btn onClick={()=>onConfirm(ids)} disabled={ids.length<2} style={{ flex:2 }}>
              Confirm {ids.length} Player{ids.length!==1?'s':''}
            </Btn>
          </div>
        </div>

      </div>
    </div>
  );
}
