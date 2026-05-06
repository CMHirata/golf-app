// ─── PhotoImportModal.jsx ──────────────────────────────────────────────────────
// Two import modes:
//   "photo"     — upload photos, Gemini Worker parses automatically
//   "assistant" — copy prompt, open Gemini chat, paste JSON result back
//
// Gemini key flow (Option B — localStorage prompt):
//   1. User taps "Analyse Photo" with no key stored → key-prompt UI appears.
//   2. User enters key from aistudio.google.com/app/apikey, taps "Save & Analyse".
//   3. Key written to SK.geminiKey; parse fires immediately.
//   4. On 401/403: key deleted from localStorage, err shown, key-prompt re-shown.

import { useState } from 'react';
import { Btn, Inp, G, GA, AMB, AMBBG, RED } from '../components/ui.jsx';
import { aiParseScorecard } from '../services/courseLib.js';
import { ls, SK } from '../services/storage.js';

const IMPORT_PROMPT = `You are analyzing a golf scorecard image. Extract all data and return a single JSON object. Do not include any explanation, markdown, or code fences — just the raw JSON.

The JSON must follow this exact shape:
{
  "courseName": "Full Course Name",
  "location": "City, State",
  "nines": [
    {
      "name": "Front",
      "pars": [4,3,5,4,4,3,5,4,4],
      "parsWomen": [5,3,5,4,4,3,5,4,4],
      "handicaps": [7,15,3,11,1,17,5,13,9],
      "handicapsWomen": [5,13,1,9,3,15,7,17,11]
    }
  ],
  "tees": [
    {
      "name": "Blue",
      "rating": 71.0,
      "slope": 131,
      "ratingW": 76.8,
      "slopeW": 139,
      "nineYards": [3375, 3065],
      "totalYards": 6440
    }
  ]
}

Rules:
- One "nines" entry per nine-hole panel, left to right as printed
- Use nine names printed on card (Front/Back, South/North/East, etc.). If none printed use Front/Back
- "pars" must have exactly 9 values — never include OUT/IN/TOT totals
- "parsWomen" — only include if women's par differs from men's. If card shows "5/4", women=5 men=4
- "handicaps" — men's stroke index, exactly 9 unique values
- "handicapsWomen" — only include if a separate women's HCP row exists
- One "tees" entry per tee color, top to bottom as printed. Combo tees (e.g. "Blue/White") are valid
- "rating"/"slope" = men's. "ratingW"/"slopeW" = women's, omit if not on card
- "nineYards" — one subtotal per nine in same order as nines array
- "totalYards" — must equal sum of nineYards
- All numbers must be numbers not strings
- Do not guess — omit any field you cannot read clearly
- Verify: each pars array sums to 27-40, each handicaps array has 9 unique values`;

export default function PhotoImportModal({ onImport, onClose }) {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // Mode: 'photo' or 'assistant'
  const [aiMode, setAiMode]           = useState('photo');

  // Photo mode state
  const [photo1, setPhoto1]           = useState(null);
  const [photo2, setPhoto2]           = useState(null);
  const [parsed, setParsed]           = useState(null);
  const [loading, setLoading]         = useState(false);
  const [err, setErr]                 = useState('');
  const [missing, setMissing]         = useState([]);
  const [manFill, setManFill]         = useState({});
  const [keyPrompt, setKeyPrompt]     = useState(false);
  const [parseStatus, setParseStatus] = useState('');
  const [keyDraft, setKeyDraft]       = useState('');

  // Assistant mode state
  const [promptCopied, setPromptCopied] = useState(false);
  const [jsonDraft, setJsonDraft]       = useState('');
  const [jsonErr, setJsonErr]           = useState('');
  const [pasteSuccess, setPasteSuccess] = useState(false);

  // ── Image processing ────────────────────────────────────────────────────────

  const readFile = file => new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width  = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const contrast  = 1.5;
        const intercept = 128 * (1 - contrast);
        for (let i = 0; i < data.length; i += 4) {
          const gray     = Math.round(0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
          const adjusted = Math.min(255, Math.max(0, Math.round(gray * contrast + intercept)));
          data[i] = data[i+1] = data[i+2] = adjusted;
        }
        ctx.putImageData(imageData, 0, 0);
        const jpegUrl = canvas.toDataURL('image/jpeg', 0.92);
        res({ b64: jpegUrl.split(',')[1], mediaType: 'image/jpeg', thumb: jpegUrl });
      };
      img.onerror = () => {
        const b64       = dataUrl.split(',')[1];
        const mediaType = ['image/jpeg','image/png','image/gif','image/webp'].includes(file.type) ? file.type : 'image/jpeg';
        res({ b64, mediaType, thumb: dataUrl });
      };
      img.src = dataUrl;
    };
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });

  const handleFile = async (file, slot) => {
    if (!file) return;
    try {
      const photo = await readFile(file);
      if (slot === 1) { setPhoto1(photo); setParsed(null); setErr(''); }
      else            { setPhoto2(photo); setParsed(null); setErr(''); }
    } catch(e) { setErr('Could not read image file.'); }
  };

  // ── Photo mode parse ────────────────────────────────────────────────────────

  const runParse = async () => {
    setLoading(true); setErr(''); setParsed(null);
    try {
      const photos = [photo1, photo2].filter(Boolean);
      const d = await aiParseScorecard(photos, setParseStatus);
      setParsed(d);
      const miss = [];
      if (!d.tees?.some(t => t.rating)) miss.push('men\'s rating');
      if (!d.tees?.some(t => t.slope))  miss.push('men\'s slope');
      setMissing(miss);
    } catch(e) {
      if (e.message === 'GEMINI_AUTH_FAILURE') {
        ls.del(SK.geminiKey);
        setErr('Gemini key rejected — tap Analyse to re-enter.');
      } else if (e.message === 'GEMINI_NO_KEY') {
        setKeyPrompt(true);
      } else {
        setErr(`Could not read scorecard: ${e.message}`);
      }
    }
    setParseStatus('');
    setLoading(false);
  };

  const analyse = () => {
    if (!photo1) return;
    if (isLocal) {
      const storedKey = ls.get(SK.geminiKey);
      if (!storedKey) { setKeyPrompt(true); setErr(''); return; }
    }
    runParse();
  };

  const saveKeyAndAnalyse = () => {
    const trimmed = keyDraft.trim();
    if (!trimmed) return;
    ls.set(SK.geminiKey, trimmed);
    setKeyDraft('');
    setKeyPrompt(false);
    runParse();
  };

  const cancelKeyPrompt = () => { setKeyPrompt(false); setKeyDraft(''); };

  // ── Assistant mode ──────────────────────────────────────────────────────────

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(IMPORT_PROMPT);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 3000);
    } catch(e) {
      // Fallback: select a textarea if clipboard API unavailable
      setErr('Could not copy automatically — please copy the prompt manually.');
    }
  };

  const openGemini = () => {
    window.open('https://gemini.google.com', '_blank');
  };

  const pasteFromClipboard = async () => {
    setJsonErr('');
    try {
      const text = await navigator.clipboard.readText();
      if (!text?.trim()) { setJsonErr('Clipboard is empty — copy the JSON from Gemini first.'); return; }
      processJsonText(text.trim());
    } catch(e) {
      // iOS requires user permission — if denied or unavailable, show manual paste area
      setJsonErr('Tap the field below and use Paste to enter the JSON manually.');
    }
  };

  const processJsonText = (text) => {
    setJsonErr('');
    try {
      // Strip markdown code fences if present
      const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
      const d = JSON.parse(cleaned);
      if (!d.nines || !d.tees) throw new Error('Missing nines or tees fields');
      setParsed(d);
      const miss = [];
      if (!d.tees?.some(t => t.rating)) miss.push('men\'s rating');
      if (!d.tees?.some(t => t.slope))  miss.push('men\'s slope');
      setMissing(miss);
      setPasteSuccess(true);
    } catch(e) {
      setJsonErr(`Invalid JSON: ${e.message}. Check the output from Gemini and try again.`);
    }
  };

  // ── Shared finish ───────────────────────────────────────────────────────────

  const finish = () => {
    const c = JSON.parse(JSON.stringify(parsed || { courseName: 'Imported', nines: [], tees: [{ name: "Men's" }] }));
    if (!c.tees?.length) c.tees = [{ name: "Men's" }];
    if (manFill.rating) c.tees[0].rating = parseFloat(manFill.rating);
    if (manFill.slope)  c.tees[0].slope  = parseInt(manFill.slope);
    const out = { name: c.courseName, location: c.location || '', nines: c.nines || [], tees: c.tees || [] };
    if (c.nineComboNames?.length) out.nineComboNames = c.nineComboNames;
    onImport(out);
  };

  // ── Styles ──────────────────────────────────────────────────────────────────

  const slotStyle = filled => ({
    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
    gap:4, padding:8, borderRadius:10, cursor:'pointer', fontSize:12, fontWeight:600,
    border:`1.5px solid ${filled ? G : '#ddd'}`, background: filled ? GA : '#fafafa',
    color: filled ? G : '#888', minHeight:80, position:'relative', overflow:'hidden',
  });

  const tabStyle = active => ({
    flex:1, padding:'8px 0', fontSize:13, fontWeight:700, textAlign:'center',
    borderRadius:8, cursor:'pointer', border:'none',
    background: active ? G : 'transparent',
    color: active ? '#fff' : '#888',
    transition:'all .15s',
  });

  const stepStyle = {
    display:'flex', alignItems:'flex-start', gap:10, marginBottom:12,
  };

  const stepNumStyle = {
    width:24, height:24, borderRadius:12, background:G, color:'#fff',
    fontSize:12, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center',
    flexShrink:0, marginTop:1,
  };

  const totalPhotos = [photo1, photo2].filter(Boolean).length;

  // ── Parsed result (shared between both modes) ───────────────────────────────

  const renderParsedResult = () => (
    <div>
      <div style={{ background:'#f0f8f0', border:'1.5px solid #b8d8b8', borderRadius:12, padding:12, marginBottom:10 }}>
        <div style={{ fontWeight:700, color:G, fontSize:14 }}>{parsed.courseName || 'Course detected'}</div>
        <div style={{ fontSize:12, color:'#888', marginBottom:6 }}>
          {parsed.nines?.length||0} nine(s) · {parsed.tees?.length||0} tee set(s)
        </div>
        {parsed.nines?.map((n,i) => (
          <div key={i} style={{ fontSize:12, color:'#555', marginBottom:2 }}>
            • {n.name}: par {n.pars?.reduce((a,b)=>a+b,0)||'?'}
            {n.handicapsWomen?.length ? ' (M+W handicaps)' : ' (M handicaps)'}
          </div>
        ))}
        {parsed.tees?.map((t,i) => (
          <div key={i} style={{ fontSize:12, color:'#555', marginBottom:2 }}>
            • {t.name}: M {t.rating != null ? Number(t.rating).toFixed(1) : '—'}/{t.slope||'—'}
            {t.ratingW ? ` · W ${Number(t.ratingW).toFixed(1)}/${t.slopeW||'—'}` : ''}
            {t.totalYards ? ` · ${t.totalYards} yds` : ''}
          </div>
        ))}
      </div>
      {missing.length > 0 && (
        <div style={{ background:AMBBG, color:AMB, borderRadius:8, padding:'8px 12px', fontSize:12, marginBottom:10 }}>
          Could not read: {missing.join(', ')}. Enter below.
        </div>
      )}
      {missing.some(m=>m.includes('rating')) && (
        <div style={{ marginBottom:8 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#666', marginBottom:3 }}>Men's Course Rating</div>
          <Inp value={manFill.rating||''} onChange={v=>setManFill(p=>({...p,rating:v}))} placeholder="e.g. 72.3" type="number"/>
        </div>
      )}
      {missing.some(m=>m.includes('slope')) && (
        <div style={{ marginBottom:10 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#666', marginBottom:3 }}>Men's Slope</div>
          <Inp value={manFill.slope||''} onChange={v=>setManFill(p=>({...p,slope:v}))} placeholder="e.g. 131" type="number"/>
        </div>
      )}
      <div style={{ display:'flex', gap:8 }}>
        <Btn variant="outline" onClick={() => { setParsed(null); setErr(''); setJsonErr(''); setPasteSuccess(false); setJsonDraft(''); }} style={{ flex:1 }}>Retake</Btn>
        <Btn onClick={finish} style={{ flex:2 }}>Save Course</Btn>
      </div>
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:20, padding:22, width:'100%', maxWidth:460, maxHeight:'92vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
          <div>
            <div style={{ fontWeight:800, fontSize:17, color:G }}>Import Scorecard</div>
            <div style={{ fontSize:11, color:'#888' }}>AI reads tees, ratings, slopes, yardages &amp; handicaps</div>
          </div>
          <button onClick={onClose} style={{ border:'none', background:'none', fontSize:24, cursor:'pointer', color:'#aaa' }}>×</button>
        </div>

        {/* Mode tabs */}
        {!parsed && (
          <div style={{ display:'flex', gap:4, background:'#f0f0f0', borderRadius:10, padding:3, marginBottom:14 }}>
            <button style={tabStyle(aiMode==='photo')}    onClick={() => { setAiMode('photo');     setErr(''); setJsonErr(''); }}>Auto Scan</button>
            <button style={tabStyle(aiMode==='assistant')} onClick={() => { setAiMode('assistant'); setErr(''); setJsonErr(''); }}>AI Assistant</button>
          </div>
        )}

        {/* Auto Scan in-development notice */}
        {aiMode === 'photo' && !parsed && !loading && (
          <div style={{ background:'#fff3cd', border:'1px solid #ffc107', borderRadius:8, padding:'8px 11px', fontSize:12, color:'#856404', marginBottom:10 }}>
            Auto Scan is in development and may produce inaccurate results. Use AI Assistant for reliable imports.
          </div>
        )}
        {err     && <div style={{ background:'#fce8e8', color:RED, borderRadius:8, padding:'9px 12px', fontSize:13, marginBottom:10 }}>{err}</div>}
        {jsonErr && <div style={{ background:'#fce8e8', color:RED, borderRadius:8, padding:'9px 12px', fontSize:13, marginBottom:10 }}>{jsonErr}</div>}

        {/* ── PHOTO MODE ── */}
        {aiMode === 'photo' && (
          loading ? (
            <div style={{ textAlign:'center', padding:32 }}>
              <div style={{ color:'#888', fontSize:14, marginTop:8, fontWeight:600 }}>{parseStatus || 'Analysing scorecard…'}</div>
              <div style={{ color:'#aaa', fontSize:12, marginTop:4 }}>This usually takes 10–30s</div>
            </div>
          ) : parsed ? renderParsedResult() : (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
                {[1,2].map(slot => {
                  const photo  = slot === 1 ? photo1 : photo2;
                  const labels = ['Front (Ratings)', 'Back (Holes)'];
                  return (
                    <div key={slot}>
                      <div style={{ fontSize:10, fontWeight:700, color:'#666', marginBottom:4, textAlign:'center' }}>
                        {labels[slot-1]} {slot===1 && <span style={{color:RED}}>*</span>}
                      </div>
                      <label style={slotStyle(!!photo)}>
                        {photo
                          ? <img src={photo.thumb} alt={`Side ${slot}`} style={{ width:'100%', height:72, objectFit:'cover', borderRadius:6 }}/>
                          : <><span style={{ fontSize:16, color:'#bbb' }}>+</span><span>Tap to add</span></>
                        }
                        <input type="file" accept="image/*" style={{ position:'absolute', opacity:0, inset:0, cursor:'pointer' }}
                          onChange={e => { handleFile(e.target.files?.[0], slot); e.target.value=''; }}/>
                      </label>
                    </div>
                  );
                })}
              </div>
              {keyPrompt && (
                <div style={{ background:'#f5f5ff', border:'1.5px solid #c5c5f0', borderRadius:12, padding:14, marginBottom:12 }}>
                  <div style={{ fontWeight:700, fontSize:14, color:'#333', marginBottom:4 }}>Gemini API key required</div>
                  <div style={{ fontSize:12, color:'#666', marginBottom:10 }}>
                    Get a free key at{' '}
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color:G }}>aistudio.google.com/app/apikey</a>
                  </div>
                  <Inp value={keyDraft} onChange={setKeyDraft} placeholder="Paste API key here"/>
                  <div style={{ display:'flex', gap:8, marginTop:10 }}>
                    <Btn variant="outline" onClick={cancelKeyPrompt} style={{ flex:1 }}>Cancel</Btn>
                    <Btn onClick={saveKeyAndAnalyse} disabled={!keyDraft.trim()} style={{ flex:2 }}>Save &amp; Analyse</Btn>
                  </div>
                </div>
              )}
              {!keyPrompt && (
                <Btn onClick={analyse} disabled={!photo1} style={{ width:'100%', marginBottom:10 }}>
                  {totalPhotos > 1 ? `Analyse ${totalPhotos} Photos` : 'Analyse Photo'}
                </Btn>
              )}
              <Btn variant="ghost" onClick={onClose} style={{ width:'100%' }}>Cancel</Btn>
            </div>
          )
        )}

        {/* ── ASSISTANT MODE ── */}
        {aiMode === 'assistant' && !parsed && (
          <div>
            <div style={{ background:AMBBG, color:AMB, borderRadius:8, padding:'8px 11px', fontSize:12, marginBottom:16 }}>
              Use Gemini to read your scorecard and paste the result back here.
            </div>

            {/* Step 1 */}
            <div style={stepStyle}>
              <div style={stepNumStyle}>1</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:13, color:'#333', marginBottom:4 }}>Copy the import prompt</div>
                <Btn onClick={copyPrompt} style={{ width:'100%' }}>
                  {promptCopied ? '✓ Copied!' : 'Copy Prompt to Clipboard'}
                </Btn>
              </div>
            </div>

            {/* Step 2 */}
            <div style={stepStyle}>
              <div style={stepNumStyle}>2</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:13, color:'#333', marginBottom:2 }}>Open Gemini and upload your scorecard photos</div>
                <div style={{ fontSize:12, color:'#888', marginBottom:6 }}>Paste the prompt, attach your scorecard photos, and send.</div>
                <Btn onClick={openGemini} variant="outline" style={{ width:'100%' }}>
                  Open Gemini ↗
                </Btn>
              </div>
            </div>

            {/* Step 3 */}
            <div style={stepStyle}>
              <div style={stepNumStyle}>3</div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:13, color:'#333', marginBottom:2 }}>Paste the JSON result back here</div>
                <div style={{ fontSize:12, color:'#888', marginBottom:8 }}>Copy the JSON from Gemini, then tap below — or paste it manually.</div>
                <Btn onClick={pasteFromClipboard} style={{ width:'100%', marginBottom:8 }}>
                  Paste from Clipboard
                </Btn>
                <div style={{ fontSize:11, color:'#aaa', textAlign:'center', marginBottom:6 }}>or paste manually:</div>
                <textarea
                  value={jsonDraft}
                  onChange={e => setJsonDraft(e.target.value)}
                  placeholder='{"courseName": "...", "nines": [...], "tees": [...]}'
                  style={{
                    width:'100%', minHeight:80, borderRadius:8, border:'1.5px solid #ddd',
                    padding:'8px 10px', fontSize:11, fontFamily:'monospace', resize:'vertical',
                    boxSizing:'border-box', color:'#333',
                  }}
                />
                {jsonDraft.trim() && (
                  <Btn onClick={() => processJsonText(jsonDraft)} style={{ width:'100%', marginTop:6 }}>
                    Import JSON
                  </Btn>
                )}
              </div>
            </div>

            <Btn variant="ghost" onClick={onClose} style={{ width:'100%', marginTop:4 }}>Cancel</Btn>
          </div>
        )}

        {/* Parsed result in assistant mode */}
        {aiMode === 'assistant' && parsed && renderParsedResult()}

      </div>
    </div>
  );
}
