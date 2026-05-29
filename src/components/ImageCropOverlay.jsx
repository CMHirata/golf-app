// ─── components/ImageCropOverlay.jsx ─────────────────────────────────────────
//
// ✅ Self-checked: touch-only gesture system (no pointer events — eliminates
// pointer/touch conflict that caused pinch jump on iOS). Pan uses single-finger
// touchmove delta against start position. Pinch baseline captured on the first
// two-finger touchmove frame (not touchstart) to avoid iOS split-event stale
// position bug. Both gestures tracked entirely in refs — zero setState during
// active gesture. H-39: native non-passive touchmove on overlay div blocks
// page scroll. Canvas export at 400×400 JPEG 0.7.

import { useRef, useState, useEffect, useCallback } from 'react';

const G = '#1a472a';
const EXPORT_SIZE = 400;
const JPEG_QUALITY = 0.7;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export default function ImageCropOverlay({ imageSrc, onSave, onCancel }) {
  const [scale,   setScale]   = useState(1);
  const [offset,  setOffset]  = useState({ x: 0, y: 0 });
  const [imgSize, setImgSize] = useState(null);

  const overlayRef = useRef(null);
  const imgRef     = useRef(null);
  const canvasRef  = useRef(null);
  const cropRef    = useRef(null); // the circular crop div

  // All gesture state in refs — never setState during active touch
  const scaleRef  = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const panRef    = useRef(null);   // { id, startX, startY, startOX, startOY }
  const pinchRef  = useRef(null);   // { id0, id1, startDist, startScale } — set on first move

  scaleRef.current  = scale;
  offsetRef.current = offset;

  // H-39: block page scroll under overlay
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const prevent = (e) => e.preventDefault();
    el.addEventListener('touchmove', prevent, { passive: false });
    return () => el.removeEventListener('touchmove', prevent);
  }, []);

  // Init scale to fill mask on load
  const handleImgLoad = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const nat = { w: img.naturalWidth, h: img.naturalHeight };
    setImgSize(nat);
    const shortSide = Math.min(window.innerWidth, window.innerHeight);
    const maskD = Math.min(shortSide * 0.72, 300);
    const initScale = maskD / Math.min(nat.w, nat.h);
    scaleRef.current = initScale;
    offsetRef.current = { x: 0, y: 0 };
    setScale(initScale);
    setOffset({ x: 0, y: 0 });
  }, []);

  // ── Touch handlers (native, registered imperatively to allow passive:false) ─
  useEffect(() => {
    const el = cropRef.current;
    if (!el) return;

    const dist = (t0, t1) => {
      const dx = t0.clientX - t1.clientX;
      const dy = t0.clientY - t1.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const findTouch = (list, id) => {
      for (let i = 0; i < list.length; i++) if (list[i].identifier === id) return list[i];
      return null;
    };

    const onStart = (e) => {
      e.preventDefault();
      const touches = e.touches;
      if (touches.length === 1 && !panRef.current && !pinchRef.current) {
        // Start pan
        panRef.current = {
          id: touches[0].identifier,
          startX: touches[0].clientX,
          startY: touches[0].clientY,
          startOX: offsetRef.current.x,
          startOY: offsetRef.current.y,
        };
      } else if (touches.length >= 2) {
        // Two fingers down — cancel pan, prepare for pinch (baseline set on first move)
        panRef.current = null;
        pinchRef.current = null; // will init on first touchmove with 2 touches
      }
    };

    const onMove = (e) => {
      e.preventDefault();
      const touches = e.touches;

      if (touches.length >= 2) {
        // Pinch
        panRef.current = null;
        const t0 = touches[0];
        const t1 = touches[1];
        const d = dist(t0, t1);
        if (!pinchRef.current) {
          // Lazy baseline — both fingers now have accurate positions
          pinchRef.current = {
            id0: t0.identifier,
            id1: t1.identifier,
            startDist: d,
            startScale: scaleRef.current,
          };
          return;
        }
        // Use same two fingers as baseline if possible
        const bt0 = findTouch(touches, pinchRef.current.id0);
        const bt1 = findTouch(touches, pinchRef.current.id1);
        const curDist = (bt0 && bt1) ? dist(bt0, bt1) : d;
        const newScale = clamp(
          pinchRef.current.startScale * (curDist / pinchRef.current.startDist),
          0.2, 10
        );
        scaleRef.current = newScale;
        setScale(newScale);
      } else if (touches.length === 1 && panRef.current) {
        // Pan
        const t = findTouch(touches, panRef.current.id);
        if (!t) return;
        const nx = panRef.current.startOX + (t.clientX - panRef.current.startX);
        const ny = panRef.current.startOY + (t.clientY - panRef.current.startY);
        offsetRef.current = { x: nx, y: ny };
        setOffset({ x: nx, y: ny });
      }
    };

    const onEnd = (e) => {
      e.preventDefault();
      const touches = e.touches;
      if (touches.length < 2) pinchRef.current = null;
      if (touches.length === 0) panRef.current = null;
    };

    el.addEventListener('touchstart',  onStart, { passive: false });
    el.addEventListener('touchmove',   onMove,  { passive: false });
    el.addEventListener('touchend',    onEnd,   { passive: false });
    el.addEventListener('touchcancel', onEnd,   { passive: false });

    return () => {
      el.removeEventListener('touchstart',  onStart);
      el.removeEventListener('touchmove',   onMove);
      el.removeEventListener('touchend',    onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, []); // register once — reads from refs only

  // ── Canvas export ──────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    if (!imgRef.current || !imgSize) return;
    const canvas = canvasRef.current;
    canvas.width  = EXPORT_SIZE;
    canvas.height = EXPORT_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, EXPORT_SIZE, EXPORT_SIZE);

    ctx.save();
    ctx.beginPath();
    ctx.arc(EXPORT_SIZE / 2, EXPORT_SIZE / 2, EXPORT_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();

    const shortSide = Math.min(window.innerWidth, window.innerHeight);
    const maskD = Math.min(shortSide * 0.72, 300);
    const sc = scaleRef.current;
    const ox = offsetRef.current.x;
    const oy = offsetRef.current.y;

    const imgLeft = -(imgSize.w * sc) / 2 + ox;
    const imgTop  = -(imgSize.h * sc) / 2 + oy;

    const srcX = (-maskD / 2 - imgLeft) / sc;
    const srcY = (-maskD / 2 - imgTop)  / sc;
    const srcW = maskD / sc;
    const srcH = maskD / sc;

    ctx.drawImage(
      imgRef.current,
      clamp(srcX, 0, imgSize.w),
      clamp(srcY, 0, imgSize.h),
      clamp(srcW, 1, imgSize.w - clamp(srcX, 0, imgSize.w)),
      clamp(srcH, 1, imgSize.h - clamp(srcY, 0, imgSize.h)),
      0, 0, EXPORT_SIZE, EXPORT_SIZE
    );
    ctx.restore();

    onSave(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
  }, [imgSize, onSave]);

  const shortSide = Math.min(
    typeof window !== 'undefined' ? window.innerWidth  : 375,
    typeof window !== 'undefined' ? window.innerHeight : 667
  );
  const maskD = Math.min(shortSide * 0.72, 300);

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        userSelect: 'none', touchAction: 'none',
      }}
    >
      <div style={{ color: '#fff', fontSize: 13, marginBottom: 16, opacity: 0.75 }}>
        Drag to pan · Pinch to zoom
      </div>

      {/* Crop circle — gestures registered via useEffect */}
      <div
        ref={cropRef}
        style={{
          position: 'relative',
          width: maskD, height: maskD,
          borderRadius: '50%',
          overflow: 'hidden',
          border: '3px solid #fff',
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
          cursor: 'grab',
          touchAction: 'none',
        }}
      >
        {imageSrc && (
          <img
            ref={imgRef}
            src={imageSrc}
            alt="crop"
            onLoad={handleImgLoad}
            draggable={false}
            style={{
              position: 'absolute',
              width:  imgSize ? imgSize.w * scale : 'auto',
              height: imgSize ? imgSize.h * scale : 'auto',
              top: '50%', left: '50%',
              transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          />
        )}
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div style={{ display: 'flex', gap: 14, marginTop: 28 }}>
        <button
          onClick={onCancel}
          style={{
            padding: '11px 28px', borderRadius: 12,
            border: '2px solid rgba(255,255,255,0.4)',
            background: 'transparent', color: '#fff',
            fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          style={{
            padding: '11px 28px', borderRadius: 12,
            border: 'none', background: G, color: '#fff',
            fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Save Photo
        </button>
      </div>
    </div>
  );
}
