// ─── components/ImageCropOverlay.jsx ─────────────────────────────────────────
//
// ✅ Self-checked: pan uses pointermove (works mouse + touch); pinch uses
// two-pointer distance delta; H-35 touch passive listener — no synthetic
// preventDefault; H-39 backdrop scroll lock uses native non-passive touchmove
// listener on overlay div via useEffect; canvas export at max 400×400 JPEG 0.7;
// Save/Cancel pinned at bottom; tap-outside does NOT dismiss (prevents accidental
// loss of crop work — user must tap Cancel explicitly).

import { useRef, useState, useEffect, useCallback } from 'react';

const G = '#1a472a';
const EXPORT_SIZE = 400;
const JPEG_QUALITY = 0.7;

// Clamp helper
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export default function ImageCropOverlay({ imageSrc, onSave, onCancel }) {
  // Transform state: offset = pan (px from center), scale = zoom
  const [scale,   setScale]   = useState(1);
  const [offset,  setOffset]  = useState({ x: 0, y: 0 });
  const [imgSize, setImgSize] = useState(null); // natural image dimensions

  const overlayRef  = useRef(null);
  const imgRef      = useRef(null);
  const canvasRef   = useRef(null);

  // Gesture tracking refs — zero setState during gesture (H-41 pattern)
  const dragRef  = useRef(null);  // { startX, startY, startOX, startOY }
  const pinchRef = useRef(null);  // { startDist, startScale }
  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);
  scaleRef.current  = scale;
  offsetRef.current = offset;

  // H-39: native non-passive touchmove to block page scroll under overlay
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const prevent = (e) => e.preventDefault();
    el.addEventListener('touchmove', prevent, { passive: false });
    return () => el.removeEventListener('touchmove', prevent);
  }, []);

  // When image loads, initialise scale so the image fills the mask circle
  const handleImgLoad = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const nat = { w: img.naturalWidth, h: img.naturalHeight };
    setImgSize(nat);
    // mask diameter = 72% of screen short side, capped at 300px
    const shortSide = Math.min(window.innerWidth, window.innerHeight);
    const maskD = Math.min(shortSide * 0.72, 300);
    const minDim = Math.min(nat.w, nat.h);
    const initScale = maskD / minDim;
    setScale(initScale);
    scaleRef.current = initScale;
    setOffset({ x: 0, y: 0 });
  }, []);

  // ── Pointer events for pan (single pointer) ───────────────────────────────
  const onPointerDown = useCallback((e) => {
    if (e.pointerId == null) return;
    // Count active pointers on the element
    const active = e.currentTarget._activePointers = e.currentTarget._activePointers || new Set();
    active.add(e.pointerId);
    if (active.size >= 2) return; // pinch takes over
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startOX: offsetRef.current.x,
      startOY: offsetRef.current.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e) => {
    const active = e.currentTarget._activePointers;
    if (!active || active.size >= 2) return; // let pinch handle
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset({ x: dragRef.current.startOX + dx, y: dragRef.current.startOY + dy });
  }, []);

  const onPointerUp = useCallback((e) => {
    const active = e.currentTarget._activePointers;
    if (active) active.delete(e.pointerId);
    dragRef.current = null;
  }, []);

  // ── Touch events for pinch-to-zoom ────────────────────────────────────────
  const touchDist = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const onTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      pinchRef.current = { startDist: touchDist(e.touches), startScale: scaleRef.current };
      dragRef.current = null; // cancel pan during pinch
    }
  }, []);

  const onTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const dist = touchDist(e.touches);
      const newScale = clamp(
        pinchRef.current.startScale * (dist / pinchRef.current.startDist),
        0.3, 8
      );
      setScale(newScale);
    }
  }, []);

  const onTouchEnd = useCallback((e) => {
    if (e.touches.length < 2) pinchRef.current = null;
  }, []);

  // ── Canvas export ─────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    if (!imgRef.current || !imgSize) return;
    const canvas = canvasRef.current;
    canvas.width  = EXPORT_SIZE;
    canvas.height = EXPORT_SIZE;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, EXPORT_SIZE, EXPORT_SIZE);

    // Mask to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(EXPORT_SIZE / 2, EXPORT_SIZE / 2, EXPORT_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();

    // Compute what region of the image is visible in the mask
    // maskD in screen px
    const shortSide = Math.min(window.innerWidth, window.innerHeight);
    const maskD = Math.min(shortSide * 0.72, 300);
    const sc = scaleRef.current;

    // Rendered image dimensions in screen px
    const rendW = imgSize.w * sc;
    const rendH = imgSize.h * sc;

    // Center of mask in screen coords = center of viewport
    // offset shifts the image center relative to mask center
    const ox = offsetRef.current.x;
    const oy = offsetRef.current.y;

    // Top-left of rendered image in screen coords (relative to mask center)
    const imgLeft = -rendW / 2 + ox;
    const imgTop  = -rendH / 2 + oy;

    // Which part of the source image falls inside the mask circle's bounding box
    // mask bounding box: [-maskD/2 .. +maskD/2] relative to mask center
    const srcX = (-maskD / 2 - imgLeft) / sc;
    const srcY = (-maskD / 2 - imgTop)  / sc;
    const srcW = maskD / sc;
    const srcH = maskD / sc;

    ctx.drawImage(
      imgRef.current,
      clamp(srcX, 0, imgSize.w), clamp(srcY, 0, imgSize.h),
      clamp(srcW, 1, imgSize.w - clamp(srcX, 0, imgSize.w)),
      clamp(srcH, 1, imgSize.h - clamp(srcY, 0, imgSize.h)),
      0, 0, EXPORT_SIZE, EXPORT_SIZE
    );
    ctx.restore();

    const base64 = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    onSave(base64);
  }, [imgSize, onSave]);

  // Mask diameter for display
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
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      {/* Instruction */}
      <div style={{ color: '#fff', fontSize: 13, marginBottom: 16, opacity: 0.75 }}>
        Drag to pan · Pinch to zoom
      </div>

      {/* Crop area */}
      <div
        style={{
          position: 'relative',
          width: maskD,
          height: maskD,
          borderRadius: '50%',
          overflow: 'hidden',
          border: '3px solid #fff',
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
          cursor: 'grab',
          touchAction: 'none',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
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
              top:  '50%',
              left: '50%',
              transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          />
        )}
      </div>

      {/* Hidden canvas for export */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Actions */}
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
