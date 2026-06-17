// ─── GameConfigWolf.jsx ───────────────────────────────────────────────────────
// Wolf game configuration panel.
// Rendered by GameConfig.jsx dispatcher when game === 'Wolf'.
//
// Uses BetSection + TiebreakSelect + StyledSel from GameConfigShared —
// identical structure to GameConfigSkins / GameConfigNines.
//
// Config surface (Wolf_Contract.md §3.3):
//   - Bet per point (BetSection, carryover as extraField)
//   - Partner-team tiebreak rule (TiebreakSelect)
//   - Point values for partner / lone wolf / blind wolf (StyledSel, 1–5)
//   - Wolf Order section: "Holes 1-16" subtitle + 4 slots + Randomize,
//     "Holes 17 & 18" subtitle + 3-button segmented control (fairness rule)
//
// grossNetNOL handled by parent GameTile header (not here).
// payStyle not supported for Wolf.
//
// ✅ Self-checked (16-A): Wolf Order is now a single section with two
//   subsections (Holes 1-16 / Holes 17 & 18) per owner layout request.
//   17/18 rule uses a 3-button segmented control instead of a dropdown.

import { G, GA } from '../../components/ui.jsx';
import { BetSection, TiebreakSelect, SegmentedPills } from './GameConfigShared.jsx';
import { StyledSel } from '../PlayerDropdown.jsx';

const PT_OPTS = [1,2,3,4,5].map(v => ({ value: v, label: String(v) }));
const ORDER_LABELS = ['First', 'Second', 'Third', 'Fourth'];

const LAST_TWO_OPTS = [
  { value: 'keepOrder', label: 'Same Order' },
  { value: 'lastPlace', label: 'Last Place' },
  { value: 'skip',      label: 'Skip' },
];

// ─── Wolf Order section — Holes 1-16 slots + Holes 17/18 fairness rule ────
function WolfOrderSection({ players, wolfOrder, onOrderChange, lastTwoHoles, onLastTwoChange }) {
  const randomize = () => {
    const arr = [0,1,2,3];
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

  const moveUp = (slotIdx) => {
    if (slotIdx === 0) return;
    const next = [...wolfOrder];
    [next[slotIdx - 1], next[slotIdx]] = [next[slotIdx], next[slotIdx - 1]];
    onOrderChange(next);
  };

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize:12, fontWeight:700, color:G, marginBottom:8 }}>Wolf Order</div>

      {/* Holes 1-16 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
        <span style={{ fontSize:10, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:'0.04em' }}>
          Holes 1–16
        </span>
        <button onClick={randomize} style={{
          padding:'4px 10px', borderRadius:8,
          border:`1.5px solid ${G}`, background:GA,
          fontSize:11, fontWeight:700, color:G,
          cursor:'pointer', fontFamily:'inherit',
        }}>Randomize</button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:5 }}>
        {wolfOrder.map((pi, slotIdx) => {
          const first = (players[pi]?.name || '?').trim().split(/\s+/)[0];
          return (
            <div key={slotIdx} onClick={() => moveUp(slotIdx)} style={{
              borderRadius:8, border:'1.5px solid #ddd',
              background:'#fff',
              padding:'5px 4px', textAlign:'center',
              cursor: slotIdx === 0 ? 'default' : 'pointer',
              userSelect:'none',
            }}>
              <div style={{ fontSize:9, fontWeight:600, color:'#888', marginBottom:2 }}>
                {ORDER_LABELS[slotIdx]}
              </div>
              <div style={{ fontSize:12, fontWeight:700, color:G,
                            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {first}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize:10, color:'#aaa', marginTop:4, marginBottom:12 }}>
        Tap a slot to move that player earlier in the order
      </div>

      {/* Holes 17 & 18 */}
      <div style={{ fontSize:10, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:4 }}>
        Holes 17 &amp; 18
      </div>
      <div style={{ fontSize:10, color:'#aaa', marginBottom:6 }}>
        Rotation gives each player 4 turns through hole 16 — pick a rule for the last two
      </div>
      <SegmentedPills value={lastTwoHoles} onChange={onLastTwoChange} options={LAST_TWO_OPTS}/>
    </div>
  );
}

export function GameConfigWolf({
  opts, setOpt,
  bet, setBet,
  players,
  activateSetupKp,
  activeFieldId,
}) {
  const wolfOrder    = opts?.wolfOrder    || [0,1,2,3];
  const carryover    = opts?.carryover    ?? false;
  const ptPartner    = opts?.ptPartner    ?? 1;
  const ptLone       = opts?.ptLone       ?? 2;
  const ptBlind      = opts?.ptBlind      ?? 3;
  const lastTwoHoles = opts?.lastTwoHoles ?? 'keepOrder';

  return (
    <>
      <BetSection
        values={{ single: bet }}
        onValueChange={(_, v) => setBet(v)}
        extraField={
          <StyledSel
            value={carryover}
            onChange={v => setOpt('carryover', v)}
            options={[
              { value: false, label: 'No Carryover' },
              { value: true,  label: 'Carryover'    },
            ]}
            width="100%"
          />
        }
        onActivate={activateSetupKp}
        activeFieldId={activeFieldId}
        betSectionId="wolf"
      />

      {/* Partner team tiebreak rule */}
      <div style={{ marginTop:8 }}>
        <TiebreakSelect value={opts?.scoring} onChange={v => setOpt('scoring', v)}/>
      </div>

      {/* Point values */}
      <div style={{ marginTop:10 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#666', marginBottom:6 }}>Points</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
          <div>
            <div style={{ fontSize:10, color:'#888', marginBottom:3, textAlign:'center' }}>Partner</div>
            <StyledSel value={ptPartner} onChange={v => setOpt('ptPartner', v)} options={PT_OPTS} width="100%"/>
          </div>
          <div>
            <div style={{ fontSize:10, color:'#888', marginBottom:3, textAlign:'center' }}>Lone Wolf</div>
            <StyledSel value={ptLone} onChange={v => setOpt('ptLone', v)} options={PT_OPTS} width="100%"/>
          </div>
          <div>
            <div style={{ fontSize:10, color:'#888', marginBottom:3, textAlign:'center' }}>Blind Wolf</div>
            <StyledSel value={ptBlind} onChange={v => setOpt('ptBlind', v)} options={PT_OPTS} width="100%"/>
          </div>
        </div>
      </div>

      <WolfOrderSection
        players={players}
        wolfOrder={wolfOrder}
        onOrderChange={v => setOpt('wolfOrder', v)}
        lastTwoHoles={lastTwoHoles}
        onLastTwoChange={v => setOpt('lastTwoHoles', v)}
      />
    </>
  );
}
