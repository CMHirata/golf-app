// ─── components/ImageCropOverlay.jsx ─────────────────────────────────────────
//
// ✅ Self-checked: zero setState during gesture — transform applied directly to
// img DOM node via applyTransform() for 60fps responsiveness. State synced only
// on touchend for canvas export. Touch-only (no pointer events). Pinch baseline
// lazy-init on first two-finger touchmove. H-39: native non-passive touchmove.

import { useRef, useState, useEffect, useCallback } from 'react';

const G = '#1a472a';
const EXPORT_SIZE = 400;
const JPEG_QUALITY = 0.7;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export default function ImageCropOverlay({ imageSrc, onSave, onCancel }) {
  const [imgSize, setImgSize] = useState(null);

  const overlayRef = useRef(null);
  const imgRef     = useRef(null);
  const canvasRef  = useRef(null);
  const cropRef    = useRef(null);

  // Live transform — refs only, never triggers React render during gesture
  const scaleRef  = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const panRef    = useRef(null);
  const pinchRef  = useRef(null);

  // Apply transform directly to DOM — bypasses React reconciler entirely
  const applyTransform = useCallback(() => {
    const img = imgRef.current;
    const sz  = img?._naturalSize;
    if (!img || !sz) return;
    const sc = scaleRef.current;
    const ox = offsetRef.current.x;
    const oy = offsetRef.current.y;
    img.style.width     = `${sz.w * sc}px`;
    img.style.height    = `${sz.h * sc}px`;
    img.style.transform = `translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px))`;
  }, []);

  // H-39: block page scroll
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const prevent = (e) => e.preventDefault();
    el.addEventListener('touchmove', prevent, { passive: false });
    return () => el.removeEventListener('touchmove', prevent);
  }, []);

  const handleImgLoad = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const nat = { w: img.naturalWidth, h: img.naturalHeight };
    img._naturalSize = nat;
    setImgSize(nat);
    const shortSide = Math.min(window.innerWidth, window.innerHeight);
    const maskD = Math.min(shortSide * 0.72, 300);
    const initScale = maskD / Math.min(nat.w, nat.h);
    scaleRef.current  = initScale;
    offsetRef.current = { x: 0, y: 0 };
    applyTransform();
  }, [applyTransform]);

  // ── Touch gesture system ───────────────────────────────────────────────────
  useEffect(() => {
    const el = cropRef.current;
    if (!el) return;

    const dist = (t0, t1) => {
      const dx = t0.clientX - t1.clientX;
      const dy = t0.clientY - t1.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const findById = (list, id) => {
      for (let i = 0; i < list.length; i++) if (list[i].identifier === id) return list[i];
      return null;
    };

    const onStart = (e) => {
      e.preventDefault();
      const t = e.touches;
      if (t.length === 1 && !pinchRef.current) {
        panRef.current = {
          id: t[0].identifier,
          startX: t[0].clientX,
          startY: t[0].clientY,
          startOX: offsetRef.current.x,
          startOY: offsetRef.current.y,
        };
      } else if (t.length >= 2) {
        panRef.current  = null;
        pinchRef.current = null; // lazy-init on first move
      }
    };

    const onMove = (e) => {
      e.preventDefault();
      const t = e.touches;

      if (t.length >= 2) {
        panRef.current = null;
        const d = dist(t[0], t[1]);
        if (!pinchRef.current) {
          // First two-finger move — set accurate baseline
          pinchRef.current = {
            id0: t[0].identifier,
            id1: t[1].identifier,
            startDist: d,
            startScale: scaleRef.current,
          };
          return;
        }
        const bt0 = findById(t, pinchRef.current.id0);
        const bt1 = findById(t, pinchRef.current.id1);
        const cur = (bt0 && bt1) ? dist(bt0, bt1) : d;
        scaleRef.current = clamp(
          pinchRef.current.startScale * (cur / pinchRef.current.startDist),
          0.2, 10
        );
        applyTransform();
      } else if (t.length === 1 && panRef.current) {
        const touch = findById(t, panRef.current.id);
        if (!touch) return;
        offsetRef.current = {
          x: panRef.current.startOX + (touch.clientX - panRef.current.startX),
          y: panRef.current.startOY + (touch.clientY - panRef.current.startY),
        };
        applyTransform();
      }
    };

    const onEnd = (e) => {
      e.preventDefault();
      const t = e.touches;
      if (t.length < 2) pinchRef.current = null;
      if (t.length === 0) panRef.current = null;
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
  }, [applyTransform]);

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
    const maskD  = Math.min(shortSide * 0.72, 300);
    const sc     = scaleRef.current;
    const ox     = offsetRef.current.x;
    const oy     = offsetRef.current.y;
    const imgLeft = -(imgSize.w * sc) / 2 + ox;
    const imgTop  = -(imgSize.h * sc) / 2 + oy;
    const srcX = clamp((-maskD / 2 - imgLeft) / sc, 0, imgSize.w);
    const srcY = clamp((-maskD / 2 - imgTop)  / sc, 0, imgSize.h);
    const srcW = clamp(maskD / sc, 1, imgSize.w - srcX);
    const srcH = clamp(maskD / sc, 1, imgSize.h - srcY);

    ctx.drawImage(imgRef.current, srcX, srcY, srcW, srcH, 0, 0, EXPORT_SIZE, EXPORT_SIZE);
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

      <div
        ref={cropRef}
        style={{
          position: 'relative',
          width: maskD, height: maskD,
          borderRadius: '50%',
          overflow: 'hidden',
          border: '3px solid #fff',
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
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
              top: '50%', left: '50%',
              pointerEvents: 'none',
              userSelect: 'none',
              willChange: 'transform, width, height',
            }}
          />
        )}
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div style={{ display: 'flex', gap: 14, marginTop: 28 }}>
        <button onClick={onCancel} style={{ padding: '11px 28px', borderRadius: 12, border: '2px solid rgba(255,255,255,0.4)', background: 'transparent', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          Cancel
        </button>
        <button onClick={handleSave} style={{ padding: '11px 28px', borderRadius: 12, border: 'none', background: G, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          Save Photo
        </button>
      </div>
    </div>
  );
}
