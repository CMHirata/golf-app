// ─── GameConfigWolf.jsx ───────────────────────────────────────────────────────
// Wolf game configuration panel.
// Rendered by GameConfig.jsx dispatcher when game === 'Wolf'.
//
// Uses BetSection + StyledSel from GameConfigShared — identical structure
// to GameConfigSkins / GameConfigNines.
//
// Config surface (Wolf_Contract.md §3.3):
//   - Bet per point (BetSection, carryover as extraField)
//   - Point values for partner / lone wolf / blind wolf (StyledSel, 1–5)
//   - Wolf order panel: 4 slots + Randomize button
//
// grossNetNOL handled by parent GameTile header (not here).
// payStyle not supported for Wolf.
//
// ✅ Self-checked (16-A): uses BetSection/StyledSel/G/GA from shared
//   components. Point values stored as opts.ptPartner/ptLone/ptBlind.
//   Defaults: 1/2/3 matching contract. WolfOrderPanel unchanged.

import { G, GA } from '../../components/ui.jsx';
import { BetSection, TiebreakSelect } from './GameConfigShared.jsx';
import { StyledSel } from '../PlayerDropdown.jsx';

const PT_OPTS = [1,2,3,4,5].map(v => ({ value: v, label: String(v) }));

const ORDER_LABELS = ['First', 'Second', 'Third', 'Fourth'];

function WolfOrderPanel({ players, wolfOrder, onOrderChange }) {
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
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
        <span style={{ fontSize:11, fontWeight:700, color:'#666' }}>Wolf Order</span>
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
              borderRadius:8, border:`1.5px solid ${G}`,
              background: slotIdx === 0 ? G : GA,
              padding:'5px 4px', textAlign:'center',
              cursor: slotIdx === 0 ? 'default' : 'pointer',
              userSelect:'none',
            }}>
              <div style={{ fontSize:9, fontWeight:600, color: slotIdx===0?'#fff':'#888', marginBottom:2 }}>
                {ORDER_LABELS[slotIdx]}
              </div>
              <div style={{ fontSize:12, fontWeight:700, color: slotIdx===0?'#fff':G,
                            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {first}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize:10, color:'#aaa', marginTop:4 }}>
        Tap a slot to move that player earlier in the order
      </div>
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

      {/* Holes 17/18 fairness — rotation only covers holes 1-16 evenly (4 turns
          each); holes 17/18 repeat players 1 and 2 unless adjusted. */}
      <div style={{ marginTop:10 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#666', marginBottom:4 }}>Holes 17 &amp; 18</div>
        <div style={{ fontSize:10, color:'#aaa', marginBottom:6 }}>
          Rotation gives each player 4 turns through hole 16 — holes 17/18 need a rule
        </div>
        <StyledSel
          value={lastTwoHoles}
          onChange={v => setOpt('lastTwoHoles', v)}
          options={[
            { value:'keepOrder', label:'Keep Same Order' },
            { value:'lastPlace', label:'Last Place First' },
            { value:'skip',      label:'Skip Holes 17/18' },
          ]}
          width="100%"
        />
      </div>

      <WolfOrderPanel
        players={players}
        wolfOrder={wolfOrder}
        onOrderChange={v => setOpt('wolfOrder', v)}
      />
    </>
  );
}
