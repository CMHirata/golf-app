// ─── GameConfigWolf.jsx ───────────────────────────────────────────────────────
// Wolf game configuration panel.
// Rendered by GameConfig.jsx dispatcher when game === 'Wolf'.
// Architecture: UI layer only — no engine calls (ARCHITECTURE_FOUNDATIONS §2).
//
// Config surface (Wolf_Contract.md §3.3):
//   - Bet per point (dollar amount)
//   - Carryover toggle (tied holes carry vs push)
//   - Wolf order panel: 4 slots showing player names in rotation order
//     plus a Randomize button (all permutations of 4 indices valid)
//
// grossNetNOL is handled by the parent GameTile header (not rendered here).
// payStyle is not supported for Wolf (contract §5.3 / §10.6).

import { useState } from 'react';
import { BetInput, G, GA } from '../../components/ui.jsx';

// ─── Wolf order panel ─────────────────────────────────────────────────────────
// Shows 4 numbered slots. Tapping a slot cycles that player forward by 1
// position in the order (shift right, others shift left — intuitive "move up"
// feel for who goes first).
// Randomize button: shuffles order using Fisher-Yates ensuring a different
// permutation each time (retries once on identity to avoid no-op feel).
function WolfOrderPanel({ players, wolfOrder, onOrderChange }) {
  const n = 4;

  const randomize = () => {
    const arr = [0, 1, 2, 3];
    let result;
    let attempts = 0;
    do {
      result = [...arr];
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
      attempts++;
    } while (attempts < 5 && result.join(',') === wolfOrder.join(','));
    onOrderChange(result);
  };

  // Tap a slot: swap it with the previous slot (moves player earlier in order)
  const moveUp = (slotIdx) => {
    if (slotIdx === 0) return;
    const next = [...wolfOrder];
    [next[slotIdx - 1], next[slotIdx]] = [next[slotIdx], next[slotIdx - 1]];
    onOrderChange(next);
  };

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#666' }}>Wolf Order</span>
        <button
          onClick={randomize}
          style={{
            padding: '4px 10px', borderRadius: 8,
            border: `1.5px solid ${G}`, background: GA,
            fontSize: 11, fontWeight: 700, color: G,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
          Randomize
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
        {wolfOrder.map((pi, slotIdx) => {
          const p = players[pi];
          const first = (p?.name || '?').trim().split(/\s+/)[0];
          return (
            <div
              key={slotIdx}
              onClick={() => moveUp(slotIdx)}
              style={{
                borderRadius: 8,
                border: `1.5px solid ${G}`,
                background: slotIdx === 0 ? G : GA,
                padding: '5px 4px',
                textAlign: 'center',
                cursor: slotIdx === 0 ? 'default' : 'pointer',
                userSelect: 'none',
              }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: slotIdx === 0 ? '#fff' : '#888', marginBottom: 2 }}>
                {slotIdx === 0 ? 'First' : `#${slotIdx + 1}`}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: slotIdx === 0 ? '#fff' : G, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {first}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 10, color: '#aaa', marginTop: 4 }}>
        Tap a slot to move that player earlier in the order
      </div>
    </div>
  );
}

// ─── GameConfigWolf (exported) ────────────────────────────────────────────────
export function GameConfigWolf({
  opts, setOpt,
  bet, setBet,
  players,
  activateSetupKp,
  activeFieldId,
}) {
  const wolfOrder = opts?.wolfOrder || [0, 1, 2, 3];
  const carryover = opts?.carryover ?? false;

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' }}>

      {/* Bet per point */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', alignItems: 'center', marginBottom: 8, gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: G }}>Bet / pt</span>
        <BetInput
          value={bet || 0}
          onChange={setBet}
          style={{ width: '100%', boxSizing: 'border-box', textAlign: 'center' }}
          onActivate={activateSetupKp}
          fieldId="wolf_bet"
          isActive={activeFieldId === 'wolf_bet'}
        />
      </div>

      {/* Carryover toggle */}
      <div
        onClick={() => setOpt('carryover', !carryover)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '7px 10px', borderRadius: 8,
          border: `1.5px solid ${carryover ? G : '#ddd'}`,
          background: carryover ? GA : '#fff',
          cursor: 'pointer', marginBottom: 4,
          userSelect: 'none',
        }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: carryover ? G : '#666' }}>
          Carryover (ties carry points)
        </span>
        <input
          type="checkbox"
          readOnly
          checked={carryover}
          style={{ accentColor: G, width: 14, height: 14, pointerEvents: 'none' }}
        />
      </div>

      {/* Wolf order panel */}
      <WolfOrderPanel
        players={players}
        wolfOrder={wolfOrder}
        onOrderChange={v => setOpt('wolfOrder', v)}
      />

    </div>
  );
}
