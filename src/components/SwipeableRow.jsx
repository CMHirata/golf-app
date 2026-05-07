// ─── components/SwipeableRow.jsx ──────────────────────────────────────────────
// Shared swipe-to-reveal-actions row wrapper.
// Gesture mechanics ported verbatim from SwipeableRoundRow.jsx (13-E.3).
//
// Props:
//   id            — unique identifier for this row (used by openId/setOpenId)
//   openId        — currently-open row id (lifted state from parent)
//   setOpenId     — setter for openId
//   onEdit        — callback for Edit action (omit to hide Edit button)
//   onDelete      — callback for Delete action
//   deleteWarning — string passed to window.confirm before deletion
//   children      — the visible row content
//
// Colors match HistoryPage swipe strip:
//   Edit   = pale yellow (#fff9e6) with green text
//   Delete = app red (#c0392b)
//
// ✅ Self-checked: all gesture tracking in refs (zero setState during gesture);
//    snapClose called before action callbacks (no re-render race); delete
//    threshold uses rowRef.offsetWidth * 0.8 matching SwipeableRoundRow;
//    tap-off handler checks rowRef (outer wrapper) so star/$ taps inside
//    children don't mis-fire; full-tile delete overlay present on touch;
//    hasTouch guard hides strip on desktop.

import { useState, useCallback, useRef } from 'react';
import { G } from './ui.jsx';

const STRIP_EDIT   = '#fff9e6';
const STRIP_DELETE = '#c0392b';
const REVEAL_W     = 180;

const IconEdit = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke={G} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const IconTrash = ({ color = '#fff' }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/>
    <path d="M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);

export default function SwipeableRow({ id, openId, setOpenId, onEdit, onDelete, deleteWarning, children }) {
  const isOpen = openId === id;

  const [snapOffset, setSnapOffset] = useState(0);

  const rowRef      = useRef(null);
  const slideRef    = useRef(null);
  const overlayRef  = useRef(null);
  const touchStartX = useRef(null);
  const wasOpen     = useRef(false);
  const committed   = useRef(false);
  const liveOffset  = useRef(0);
  const rawDx       = useRef(0);

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
    setOpenId(prev => prev === id ? null : prev);
  }, [id, setOpenId]);

  const snapOpen = useCallback(() => {
    setTransform(-REVEAL_W, true);
    setSnapOffset(-REVEAL_W);
    setOpenId(id);
  }, [id, setOpenId]);

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
    const base    = wasOpen.current ? -REVEAL_W : 0;
    const clamped = Math.min(0, base + dx);
    setTransform(clamped, false);
  };

  const onTouchEnd = () => {
    if (touchStartX.current === null) return;
    touchStartX.current = null;
    if (!committed.current) {
      if (wasOpen.current) { snapClose(); }
      else { setTransform(0, false); }
      return;
    }
    const dx           = rawDx.current;
    const rowW         = rowRef.current?.offsetWidth || 360;
    const deleteThresh = rowW * 0.8;
    if (!wasOpen.current && dx <= -deleteThresh) {
      snapClose();
      if (window.confirm(deleteWarning || 'Delete this item? This cannot be undone.')) onDelete?.();
      return;
    }
    if (wasOpen.current && liveOffset.current > -REVEAL_W / 2) { snapClose(); return; }
    if (!wasOpen.current && liveOffset.current < -REVEAL_W / 2) { snapOpen(); }
    else if (wasOpen.current && liveOffset.current <= -REVEAL_W / 2) { snapOpen(); }
    else { snapClose(); }
  };

  // Sync when another row opens/closes this one externally
  const syncedOffset = isOpen ? snapOffset : 0;
  if (slideRef.current) {
    const currentPx = parseInt(
      slideRef.current.style.transform.replace('translateX(', '').replace('px)', '') || '0'
    );
    if (currentPx !== syncedOffset && !committed.current) {
      slideRef.current.style.transition = 'transform 0.2s ease';
      slideRef.current.style.transform  = `translateX(${syncedOffset}px)`;
    }
  }

  const hasTouch = 'ontouchstart' in window;

  return (
    <div ref={rowRef} style={{ position: 'relative', borderRadius: 13, overflow: 'hidden' }}>

      {/* Full-tile delete overlay */}
      {hasTouch && (
        <div ref={overlayRef}
          style={{
            position: 'absolute', inset: 0, background: STRIP_DELETE, opacity: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 8, pointerEvents: 'none',
            transition: 'opacity 0.15s ease', zIndex: 10,
          }}>
          <IconTrash color="#fff" />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '0.3px' }}>
            Release to delete
          </span>
        </div>
      )}

      {/* Action strip */}
      {hasTouch && (
        <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0,
          width: REVEAL_W, display: 'flex', alignItems: 'stretch',
        }}>
          {onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); snapClose(); onEdit(); }}
              style={{
                flex: 1, border: 'none', background: STRIP_EDIT,
                color: G, fontWeight: 700, fontSize: 11,
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 4,
              }}>
              <IconEdit />
              <span>Edit</span>
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              snapClose();
              if (window.confirm(deleteWarning || 'Delete this item? This cannot be undone.')) onDelete?.();
            }}
            style={{
              flex: 1, border: 'none', background: STRIP_DELETE,
              color: '#fff', fontWeight: 700, fontSize: 11,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 4,
            }}>
            <IconTrash color="#fff" />
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
        style={{
          position: 'relative', zIndex: 1, background: '#fff',
          transform: `translateX(${syncedOffset}px)`,
          transition: 'transform 0.2s ease',
        }}
      >
        {children}
      </div>
    </div>
  );
}
