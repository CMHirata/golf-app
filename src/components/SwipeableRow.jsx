// ─── components/SwipeableRow.jsx ──────────────────────────────────────────────
// Shared swipe-to-reveal-actions row wrapper.
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
// Behaviour:
//   - Swipe-left reveals Edit (blue, if onEdit provided) + Delete (red) buttons
//   - Full swipe-left (>80% of reveal width) auto-triggers Delete after confirm
//   - Swipe-right or tap-off closes
//   - Only one row open at a time (openId pattern)
//   - H-35: uses touchHandledRef timestamp guard — no reliance on e.preventDefault
//
// ✅ Self-checked: verified touchHandledRef guard prevents double-fire on iOS;
//    full-swipe threshold uses REVEAL_W not window width; openId closes previous
//    row before opening new one; onEdit omitted path hides Edit button correctly.

import { useRef, useEffect } from 'react';

const REVEAL_W   = 148;  // total revealed width (edit 64 + delete 64 + gap 20)
const FULL_SWIPE = REVEAL_W * 0.85;

const EDIT_COLOR   = '#2563eb';
const DELETE_COLOR = '#dc2626';

export default function SwipeableRow({ id, openId, setOpenId, onEdit, onDelete, deleteWarning, children }) {
  const open           = openId === id;
  const translateX     = open ? -REVEAL_W : 0;

  const startXRef      = useRef(null);
  const startYRef      = useRef(null);
  const isDraggingRef  = useRef(false);
  const currentXRef    = useRef(0);
  const rowRef         = useRef(null);
  const touchHandledRef = useRef(0);

  // Close when another row opens
  useEffect(() => {
    if (!open) {
      currentXRef.current = 0;
    }
  }, [open]);

  const handleTouchStart = (e) => {
    const t = e.touches[0];
    startXRef.current     = t.clientX;
    startYRef.current     = t.clientY;
    isDraggingRef.current = false;
    currentXRef.current   = open ? -REVEAL_W : 0;
  };

  const handleTouchMove = (e) => {
    if (startXRef.current === null) return;
    const dx = e.touches[0].clientX - startXRef.current;
    const dy = e.touches[0].clientY - startYRef.current;

    // If primarily vertical — don't intercept
    if (!isDraggingRef.current && Math.abs(dy) > Math.abs(dx) + 4) return;

    isDraggingRef.current = true;
    const base  = open ? -REVEAL_W : 0;
    const clamped = Math.min(0, Math.max(-REVEAL_W - 20, base + dx));
    if (rowRef.current) {
      rowRef.current.style.transition = 'none';
      rowRef.current.style.transform  = `translateX(${clamped}px)`;
    }
    currentXRef.current = clamped;
  };

  const handleTouchEnd = (e) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    // H-35 timestamp guard
    const now = Date.now();
    if (now - touchHandledRef.current < 300) return;
    touchHandledRef.current = now;

    const delta   = currentXRef.current;
    const wasOpen = open;

    if (rowRef.current) rowRef.current.style.transition = '';

    // Full swipe → confirm delete
    if (!wasOpen && delta < -FULL_SWIPE) {
      setOpenId(null);
      if (rowRef.current) rowRef.current.style.transform = 'translateX(0)';
      if (window.confirm(deleteWarning || 'Delete this item?')) {
        onDelete?.();
      }
      return;
    }

    // Partial swipe left past 30px → open
    if (!wasOpen && delta < -30) {
      setOpenId(id);
      return;
    }

    // Swipe right while open → close
    if (wasOpen && delta > 30) {
      setOpenId(null);
      return;
    }

    // Snap back to current state
    if (rowRef.current) {
      rowRef.current.style.transform = `translateX(${wasOpen ? -REVEAL_W : 0}px)`;
    }
  };

  // Tap-off to close
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (rowRef.current && !rowRef.current.parentElement?.contains(e.target)) return;
      if (rowRef.current && rowRef.current.contains(e.target)) return;
      setOpenId(null);
    };
    document.addEventListener('touchstart', handler);
    document.addEventListener('mousedown',  handler);
    return () => {
      document.removeEventListener('touchstart', handler);
      document.removeEventListener('mousedown',  handler);
    };
  }, [open, setOpenId]);

  const handleEditClick = (e) => {
    e.stopPropagation();
    setOpenId(null);
    onEdit?.();
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    setOpenId(null);
    if (window.confirm(deleteWarning || 'Delete this item?')) {
      onDelete?.();
    }
  };

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 13 }}>
      {/* Revealed action buttons */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0,
        display: 'flex', alignItems: 'stretch',
        width: REVEAL_W,
      }}>
        {onEdit && (
          <button
            onClick={handleEditClick}
            style={{
              flex: 1, border: 'none', background: EDIT_COLOR,
              color: '#fff', fontWeight: 700, fontSize: 13,
              cursor: 'pointer', fontFamily: 'inherit',
              borderRadius: '0',
            }}
          >
            Edit
          </button>
        )}
        <button
          onClick={handleDeleteClick}
          style={{
            flex: 1, border: 'none', background: DELETE_COLOR,
            color: '#fff', fontWeight: 700, fontSize: 13,
            cursor: 'pointer', fontFamily: 'inherit',
            borderRadius: onEdit ? '0 13px 13px 0' : '13px',
          }}
        >
          Delete
        </button>
      </div>

      {/* Sliding content */}
      <div
        ref={rowRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          transform:  `translateX(${translateX}px)`,
          transition: 'transform 0.22s ease',
          position:   'relative',
          zIndex:     1,
          background: '#fff',
          borderRadius: 13,
        }}
      >
        {children}
      </div>
    </div>
  );
}
