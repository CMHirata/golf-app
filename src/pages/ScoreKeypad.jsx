// ─── scorecard/ScoreKeypad.jsx ────────────────────────────────────────────────
// Custom in-app numeric keypad — fixed overlay at very bottom of screen.
// Covers the nav bar (zIndex 300 > nav bar zIndex 50).
// Appears when a score cell is active; dismisses on outside tap.
// 4 rows: 1-2-3 / 4-5-6 / 7-8-9 / ⌫-0-[special]
//
// Props:
//   containerRef  {ref}      — attached to outer div so parent can detect inside-taps
//   visible       {bool}     — show/hide the keypad
//   value         {string}   — current in-progress value
//   kpPlus        {bool}     — handicap modes: true = plus sign active
//   onChange      {func}     — (newVal: string) => void
//   onPlusToggle  {func}     — handicap modes: () => void
//   onBackspace   {func}     — () => void
//   onCommit      {func}     — optional; fires on explicit Done tap (non-score)
//   onLongPressX  {func}     — score mode only, optional
//   mode          {string}   — 'score'|'currency'|'handicap-decimal'|'handicap-int'|'integer'
//                              defaults to 'score' — all existing call sites byte-identical
//
// ✅ Self-checked (13-F): mode defaults to 'score'; all ScoreGrid call sites
// that pass no mode prop receive byte-identical behavior. onTouchEnd+preventDefault
// applied to all digit/backspace buttons mirroring the X pattern (A-1). Special
// button varies by mode per §2.2 and §6 (B-1). No engine calls added.

import { useRef, useCallback, useEffect, useState } from 'react';
import { AMB, RED, G } from '../components/ui.jsx';

const LONG_PRESS_MS   = 600;
const LONG_PRESS_WARN = 300;
const ROW_H           = 56;
const GAP             = 3;

export function ScoreKeypad({
  containerRef, visible, value, onChange, onBackspace,
  onLongPressX,
  kpPlus = false,
  onPlusToggle,
  onCommit,
  mode = 'score',
  noPlus = false,
}) {
  const [xWarning, setXWarning] = useState(false);
  // Ignore taps for 250ms after mount — prevents phantom clicks from the
  // tap that opened the keypad landing on a keypad button after layout shift.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(false);
    const t = setTimeout(() => setReady(true), 250);
    return () => clearTimeout(t);
  }, []);

  const longPressTimer = useRef(null);
  const warnTimer      = useRef(null);
  const longPressFired = useRef(false);
  const xMouseTimer    = useRef(null);
  const xMouseFired    = useRef(false);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    if (warnTimer.current)      { clearTimeout(warnTimer.current);      warnTimer.current = null; }
    setXWarning(false);
  }, []);

  useEffect(() => () => clearLongPress(), [clearLongPress]);

  // ── Digit handler — enforces per-mode constraints ──────────────────────────
  const handleDigit = useCallback((d) => {
    if (mode === 'score') {
      let next;
      if (value === 'X')          next = d;
      else if (value.length >= 2) next = d;
      else                        next = value + d;
      onChange(next);
      return;
    }

    if (mode === 'currency') {
      const dotIdx = value.indexOf('.');
      if (dotIdx === -1) {
        if (value.length >= 3) return;
        onChange(value + d);
      } else {
        const afterDot = value.slice(dotIdx + 1);
        if (afterDot.length >= 2) return;
        onChange(value + d);
      }
      return;
    }

    if (mode === 'handicap-decimal') {
      if (value.length >= 3) return;
      onChange(value + d);
      return;
    }

    if (mode === 'handicap-int') {
      let next;
      if (value.length >= 2) next = d;
      else                   next = value + d;
      onChange(next);
      return;
    }

    if (mode === 'integer') {
      if (value.length >= 4) return;
      onChange(value + d);
      return;
    }
  }, [mode, value, onChange]);

  const handleBackspace = useCallback(() => {
    onBackspace();
  }, [onBackspace]);

  const handleXTap = useCallback(() => {
    onChange('X');
  }, [onChange]);

  // ── Special button tap — varies by mode ────────────────────────────────────
  const handleSpecialTap = useCallback(() => {
    if (mode === 'score') { handleXTap(); return; }
    if (mode === 'currency') {
      if (value.includes('.')) return;
      onChange(value + '.');
      return;
    }
    if ((mode === 'handicap-decimal' || mode === 'handicap-int') && !noPlus) {
      if (onPlusToggle) onPlusToggle();
      return;
    }
    // integer, or handicap with noPlus → Done
    if (onCommit) onCommit();
  }, [mode, noPlus, value, onChange, onPlusToggle, onCommit, handleXTap]);

  // ── Touch handlers for digit/backspace (A-1 scroll-jump fix) ──────────────
  // Mirror the X button's onTouchStart/onTouchEnd pattern exactly.
  // Each button gets a touch-start ref to track if touch is in progress,
  // and a touch-end that calls preventDefault + fires the action.

  // Generic tap handlers with touch support (no long press)
  const makeTouchHandlers = useCallback((action) => ({
    onTouchStart: () => { /* no long-press needed */ },
    onTouchEnd: (e) => {
      e.preventDefault();
      action();
    },
    onTouchCancel: () => { /* no cleanup needed */ },
    onMouseUp: action,     // desktop fallback
    // No onClick needed since onTouchEnd+preventDefault suppresses click on mobile
    // and onMouseUp handles desktop. But we keep onClick for pointer events on
    // non-touch devices that don't fire mouseup reliably (e.g. pointer cancel).
    onClick: action,
  }), []);

  // ── X button touch / mouse long-press (score mode only) ───────────────────
  const handleXTouchStart = useCallback(() => {
    longPressFired.current = false;
    if (!onLongPressX) return;
    warnTimer.current = setTimeout(() => setXWarning(true), LONG_PRESS_WARN);
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      clearLongPress();
      onLongPressX();
    }, LONG_PRESS_MS);
  }, [onLongPressX, clearLongPress]);

  const handleXTouchEnd = useCallback((e) => {
    e.preventDefault();
    const fired = longPressFired.current;
    clearLongPress();
    if (!fired) handleSpecialTap();
  }, [clearLongPress, handleSpecialTap]);

  const handleXMouseDown = useCallback(() => {
    xMouseFired.current = false;
    if (!onLongPressX || mode !== 'score') return;
    warnTimer.current = setTimeout(() => setXWarning(true), LONG_PRESS_WARN);
    xMouseTimer.current = setTimeout(() => {
      xMouseFired.current = true;
      if (xMouseTimer.current) { clearTimeout(xMouseTimer.current); xMouseTimer.current = null; }
      clearLongPress();
      onLongPressX();
    }, LONG_PRESS_MS);
  }, [onLongPressX, mode, clearLongPress]);

  const handleXMouseUp = useCallback(() => {
    if (xMouseTimer.current) { clearTimeout(xMouseTimer.current); xMouseTimer.current = null; }
    clearLongPress();
  }, [clearLongPress]);

  const handleXClick = useCallback(() => {
    if (xMouseFired.current) { xMouseFired.current = false; return; }
    handleSpecialTap();
  }, [handleSpecialTap]);

  if (!visible) return null;

  // ── Special button appearance by mode ──────────────────────────────────────
  const xBg = mode === 'score'
    ? (xWarning ? RED : AMB)
    : mode === 'currency'
      ? '#c8c8c8'
      : (mode === 'handicap-decimal' || mode === 'handicap-int') && !noPlus
        ? (kpPlus ? '#145a2e' : G)
        : G;  // integer, currency-dot, or noPlus → Done green

  const xColor = mode === 'currency' ? '#444' : '#fff';

  const xLabel = mode === 'score'
    ? 'X'
    : mode === 'currency'
      ? '.'
      : (mode === 'handicap-decimal' || mode === 'handicap-int') && !noPlus
        ? '+'
        : 'Done';

  const xFontSize = (mode === 'integer' || noPlus) ? 14 : 18;

  // ── Button factory ─────────────────────────────────────────────────────────
  // A-1: digit/backspace buttons now use onTouchEnd+preventDefault (mirror X pattern)
  const btn = (label, action, bg, color, extra = {}) => {
    const handlers = makeTouchHandlers(action);
    return (
      <button
        key={label}
        {...handlers}
        style={{
          flex: 1, height: ROW_H,
          border: 'none', borderRadius: 6,
          fontSize: 18, fontWeight: 700, fontFamily: 'inherit',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          userSelect: 'none', WebkitUserSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
          background: bg, color,
          ...extra,
        }}
      >{label}</button>
    );
  };

  const row = (children) => (
    <div style={{ display: 'flex', gap: GAP }}>{children}</div>
  );

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        left: 0, right: 0, bottom: 0,
        zIndex: 1100,
        background: '#e0e0e0',
        borderTop: '1px solid #bbb',
        paddingTop: GAP,
        paddingLeft: GAP,
        paddingRight: GAP,
        paddingBottom: `calc(${GAP}px + env(safe-area-inset-bottom))`,
        display: 'flex',
        flexDirection: 'column',
        gap: GAP,
        pointerEvents: ready ? 'auto' : 'none',
      }}
    >
      {row(<>
        {btn('1', () => handleDigit('1'), '#fff', '#222')}
        {btn('2', () => handleDigit('2'), '#fff', '#222')}
        {btn('3', () => handleDigit('3'), '#fff', '#222')}
      </>)}
      {row(<>
        {btn('4', () => handleDigit('4'), '#fff', '#222')}
        {btn('5', () => handleDigit('5'), '#fff', '#222')}
        {btn('6', () => handleDigit('6'), '#fff', '#222')}
      </>)}
      {row(<>
        {btn('7', () => handleDigit('7'), '#fff', '#222')}
        {btn('8', () => handleDigit('8'), '#fff', '#222')}
        {btn('9', () => handleDigit('9'), '#fff', '#222')}
      </>)}
      {row(<>
        {btn('⌫', handleBackspace, '#c8c8c8', '#444', { fontSize: 22 })}
        {btn('0', () => handleDigit('0'), '#fff', '#222')}
        {/* Special button — uses X long-press pattern in score mode; simple tap in other modes */}
        <button
          style={{
            flex: 1, height: ROW_H,
            border: 'none', borderRadius: 6,
            fontSize: xFontSize, fontWeight: 700, fontFamily: 'inherit',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            userSelect: 'none', WebkitUserSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
            background: xBg, color: xColor,
          }}
          onTouchStart={mode === 'score' ? handleXTouchStart : undefined}
          onTouchEnd={handleXTouchEnd}
          onTouchCancel={mode === 'score' ? clearLongPress : undefined}
          onMouseDown={mode === 'score' ? handleXMouseDown : undefined}
          onMouseUp={mode === 'score' ? handleXMouseUp : undefined}
          onClick={mode === 'score' ? handleXClick : handleSpecialTap}
        >{xLabel}</button>
      </>)}
    </div>
  );
}
