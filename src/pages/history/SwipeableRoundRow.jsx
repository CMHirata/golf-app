// ─── pages/history/SwipeableRoundRow.jsx ─────────────────────────────────────
// Swipeable round row used by HistoryPage. Reveals Share / Edit / Delete
// action strip on left-swipe; full-tile delete overlay on hard left-swipe
// (≥80% of row width).
//
// H-1 swipe (preserved from original HistoryPage.jsx implementation):
//   Strip tracks finger in real time with zero setState during the gesture.
//   All tracking state is in refs. The sliding div is updated via direct DOM
//   style manipulation (slideRef.current.style.transform). React state is
//   only written once at touchend for the snap position. This avoids the
//   iOS Safari issue where setState mid-gesture causes React to replace
//   event handler references, breaking subsequent touchmove events.
//
// Extracted verbatim from HistoryPage.jsx in 13-E.3 per Architectural
// Decision #23 (codebase extraction pattern). Zero logic changes.
// Strip color constants and REVEAL_W moved with the component.
//
// Generic-swipe extraction is deferred to 15-H per Architectural Decision #5
// — when Players & Courses pages adopt swipe, the gesture mechanics will be
// abstracted then, with two real call sites to design against.
//
// ✅ Self-checked (13-E.3): Component signature, prop destructure, all eight
// refs, both useCallback deps arrays, the touch handlers, the syncedOffset
// reconciliation block, and both render branches (touch / non-touch) moved
// verbatim. `openId`/`setOpenId` single-row-open pattern preserved. Imports
// `IconShare`/`IconEdit`/`IconTrash` from sibling HistoryIcons; `G`/`GA`/
// `RED`/`fmtDate` from ui.jsx.

import { useState, useCallback, useRef } from 'react';
import { G, GA, RED, fmtDate } from '../../components/ui.jsx';
import { IconShare, IconEdit, IconTrash } from './HistoryIcons.jsx';

// ── Swipe strip colors — bright app palette ───────────────────────────────────
const STRIP_SHARE  = '#1a472a';   // app primary green
const STRIP_EDIT   = '#fff9e6';   // pale yellow — uses dark text (matches PALE_YELLOW in ui.jsx)
const STRIP_DELETE = '#c0392b';   // app RED token

// ── Reveal width for swipe strip ──────────────────────────────────────────────
const REVEAL_W = 180;

export default function SwipeableRoundRow({ r, canEdit, onEdit, onDelete, onOpenSummary, onShare, openId, setOpenId }) {
  const isOpen = openId === r.id;

  const [snapOffset, setSnapOffset] = useState(0);

  const rowRef        = useRef(null);
  const slideRef      = useRef(null);
  const stripRef      = useRef(null);
  const overlayRef    = useRef(null);
  const touchStartX   = useRef(null);
  const wasOpen       = useRef(false);
  const committed     = useRef(false);
  const liveOffset    = useRef(0);
  const rawDx         = useRef(0);

  const setTransform = (px, animated) => {
    if (!slideRef.current) return;
    slideRef.current.style.transition = animated ? 'transform 0.2s ease' : 'none';
    slideRef.current.style.transform  = `translateX(${px}px)`;
    liveOffset.current = px;

    if (!wasOpen.current) {
      const rowW         = rowRef.current?.offsetWidth || 360;
      const deleteThresh = rowW * 0.8;
      const isDeleteZone = rawDx.current <= -deleteThresh;
      if (overlayRef.current) {
        overlayRef.current.style.opacity    = isDeleteZone ? '1' : '0';
        overlayRef.current.style.transition = animated ? 'opacity 0.15s ease' : 'none';
      }
    }
  };

  const snapClose = useCallback(() => {
    setTransform(0, true);
    if (overlayRef.current) overlayRef.current.style.opacity = '0';
    setSnapOffset(0);
    setOpenId(prev => prev === r.id ? null : prev);
  }, [r.id, setOpenId]);

  const snapOpen = useCallback(() => {
    setTransform(-REVEAL_W, true);
    setSnapOffset(-REVEAL_W);
    setOpenId(r.id);
  }, [r.id, setOpenId]);

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    wasOpen.current     = isOpen;
    committed.current   = false;
    rawDx.current       = 0;
    if (slideRef.current) slideRef.current.style.transition = 'none';
  };

  const onTouchMove = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    rawDx.current = dx;
    if (!committed.current) {
      if (Math.abs(dx) <= 6) return;
      committed.current = true;
    }
    const base     = wasOpen.current ? -REVEAL_W : 0;
    const clamped  = Math.min(0, base + dx);
    setTransform(clamped, false);
  };

  const onTouchEnd = () => {
    if (touchStartX.current === null) return;
    touchStartX.current = null;
    if (!committed.current) {
      if (wasOpen.current) { snapClose(); } else { setTransform(0, false); onOpenSummary(); }
      return;
    }
    const dx           = rawDx.current;
    const rowW         = rowRef.current?.offsetWidth || 360;
    const deleteThresh = rowW * 0.8;
    if (!wasOpen.current && dx <= -deleteThresh) {
      snapClose();
      if (window.confirm('Delete this round? This cannot be undone.')) onDelete();
      return;
    }
    if (wasOpen.current && liveOffset.current > -REVEAL_W / 2) { snapClose(); return; }
    if (!wasOpen.current && liveOffset.current < -REVEAL_W / 2) { snapOpen(); }
    else if (wasOpen.current && liveOffset.current <= -REVEAL_W / 2) { snapOpen(); }
    else { snapClose(); }
  };

  const syncedOffset = isOpen ? snapOffset : 0;
  if (slideRef.current) {
    const currentPx = parseInt(slideRef.current.style.transform.replace('translateX(', '').replace('px)', '') || '0');
    if (currentPx !== syncedOffset && !committed.current) {
      slideRef.current.style.transition = 'transform 0.2s ease';
      slideRef.current.style.transform  = `translateX(${syncedOffset}px)`;
    }
  }

  const hasTouch    = 'ontouchstart' in window;
  const playerNames = (r.players || []).map(p => typeof p === 'string' ? p : p.name).join(', ');
  const numNines    = (r.course_snapshot?.nines || []).length;
  const ninesSuffix = numNines > 2 && r.front_nine && r.back_nine ? ` - ${r.front_nine}/${r.back_nine}` : '';

  return (
    <div ref={rowRef} style={{ position:'relative', borderRadius:12, overflow:'hidden', border:'1.5px solid #e0ece0', background:'#fff' }}>

      {/* Full-tile delete overlay */}
      {hasTouch && (
        <div ref={overlayRef}
          style={{ position:'absolute', inset:0, background:STRIP_DELETE, opacity:0,
            display:'flex', alignItems:'center', justifyContent:'center',
            flexDirection:'column', gap:8, pointerEvents:'none',
            transition:'opacity 0.15s ease', zIndex:10 }}>
          <IconTrash color="#fff" size={28} />
          <span style={{ fontSize:13, fontWeight:700, color:'#fff', letterSpacing:'0.3px' }}>Release to delete</span>
        </div>
      )}

      {/* Action strip */}
      {hasTouch && (
        <div ref={stripRef} style={{ position:'absolute', top:0, right:0, bottom:0, width:REVEAL_W, display:'flex', alignItems:'stretch' }}>
          <button
            onClick={(e) => { e.stopPropagation(); snapClose(); onShare && onShare(); }}
            style={{ flex:1, border:'none', background:STRIP_SHARE, color:'#fff', fontWeight:700, fontSize:11,
              cursor:'pointer', fontFamily:'inherit', display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'center', gap:4 }}>
            <IconShare color="#fff" size={17} />
            <span>Share</span>
          </button>
          {canEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); snapClose(); onEdit(); }}
              style={{ flex:1, border:'none', background:STRIP_EDIT, color:G, fontWeight:700, fontSize:11,
                cursor:'pointer', fontFamily:'inherit', display:'flex', flexDirection:'column',
                alignItems:'center', justifyContent:'center', gap:4 }}>
              <IconEdit color={G} size={17} />
              <span>Edit</span>
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); snapClose(); if (window.confirm('Delete this round? This cannot be undone.')) onDelete(); }}
            style={{ flex:1, border:'none', background:STRIP_DELETE, color:'#fff', fontWeight:700, fontSize:11,
              cursor:'pointer', fontFamily:'inherit', display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'center', gap:4 }}>
            <IconTrash color="#fff" size={17} />
            <span>Delete</span>
          </button>
        </div>
      )}

      {/* Sliding row content */}
      <div
        ref={slideRef}
        onTouchStart={hasTouch ? onTouchStart : undefined}
        onTouchMove={hasTouch ? onTouchMove : undefined}
        onTouchEnd={hasTouch ? onTouchEnd : undefined}
        onClick={hasTouch ? undefined : onOpenSummary}
        style={{
          position:'relative', zIndex:1, background:'#fff',
          transform:`translateX(${syncedOffset}px)`,
          transition:'transform 0.2s ease',
          cursor:'pointer',
        }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'10px 12px' }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:700, fontSize:13, color:G }}>{r.course_name || 'Unknown Course'}{ninesSuffix}</div>
            <div style={{ fontSize:11, color:'#888', marginTop:1 }}>{fmtDate(r.date)} · {playerNames}</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:4, alignItems:'center' }}>
              {(r.active_games || []).map(g => (
                <span key={g} style={{ background:GA, color:G, borderRadius:20, padding:'2px 8px', fontSize:10, fontWeight:600 }}>{g}</span>
              ))}
            </div>
          </div>

          {/* Desktop buttons */}
          {!hasTouch && (
            <div style={{ display:'flex', gap:4, flexShrink:0, alignItems:'center' }} onClick={e => e.stopPropagation()}>
              <button onClick={() => onShare && onShare()}
                style={{ border:`1.5px solid ${STRIP_SHARE}`, background:'#eef6f1', borderRadius:6,
                  cursor:'pointer', fontSize:11, fontWeight:700, padding:'3px 8px', color:STRIP_SHARE, fontFamily:'inherit' }}>
                Share
              </button>
              {canEdit && (
                <button onClick={onEdit}
                  style={{ border:'1.5px solid #bbb', background:'#f5f5f5', borderRadius:6,
                    cursor:'pointer', fontSize:11, fontWeight:700, padding:'3px 8px', color:'#444', fontFamily:'inherit' }}>
                  Edit
                </button>
              )}
              <button onClick={() => { if (window.confirm('Delete this round? This cannot be undone.')) onDelete(); }}
                style={{ border:'none', background:'none', cursor:'pointer', padding:'2px 4px', lineHeight:1 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7.5" stroke={RED} strokeWidth="1.2" fill="none"/>
                  <line x1="5" y1="5" x2="11" y2="11" stroke={RED} strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="11" y1="5" x2="5" y2="11" stroke={RED} strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          )}
          {hasTouch && <div style={{ color:'#ccc', fontSize:16, flexShrink:0, alignSelf:'center' }}>‹</div>}
        </div>
      </div>
    </div>
  );
}
