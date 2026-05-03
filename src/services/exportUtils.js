// ─── src/services/exportUtils.js ──────────────────────────────────────────────
// JSON-export helpers for The Card backup file.
//
// `triggerExport()` is called from App.jsx `handleSaveRound` to auto-export
// the full history (players + courses + rounds) on every save. It uses a
// progressive-fallback chain: Web Share API → showSaveFilePicker → anchor-
// click download. The Web Share API is preferred on mobile because it is
// the only path that gives the user a native share sheet (iOS Files,
// AirDrop, email, etc.); showSaveFilePicker covers desktop Chrome / Edge;
// the anchor-click fallback covers everything else.
//
// Extracted verbatim from App.jsx in session 13-E.2. Pure reorganization —
// zero logic changes.
//
// ✅ Self-checked (13-E.2): Both functions moved verbatim from App.jsx
//   prior lines 95–152. `makeExportFilename` and `triggerExport` are named
//   exports (matched their App.jsx export pattern). `triggerExport` calls
//   `makeExportFilename` internally — call site updated to local reference,
//   no module-prefix needed since both live in this file. Imports for
//   `playerLib`, `courseLib`, `roundLib` resolve from `services/` siblings.

import { playerLib } from './playerLib.js';
import { courseLib } from './courseLib.js';
import { roundLib }  from './roundLib.js';

// ── G-6: Shared export filename helper ────────────────────────────────────────
export function makeExportFilename() {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}`;
  return `The Card ${date} ${time}.json`;
}

// ── G-6: Trigger a JSON export download of the full history ──────────────────
export async function triggerExport() {
  const filename = makeExportFilename();
  const payload  = {
    exportedAt: new Date().toISOString(),
    appVersion: 'golf-scorekeeper-v4',
    players:    playerLib.list(),
    courses:    courseLib.list(),
    rounds:     roundLib.list(),
  };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });

  if (navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: 'application/json' })] })) {
    try {
      await navigator.share({
        files: [new File([blob], filename, { type: 'application/json' })],
        title: 'The Card — Golf Backup',
      });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }

  if (typeof window.showSaveFilePicker === 'function') {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'Golf Backup (JSON)', accept: { 'application/json': ['.json'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }

  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
