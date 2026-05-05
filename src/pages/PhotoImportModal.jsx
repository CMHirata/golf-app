// ─── PhotoImportModal.jsx ──────────────────────────────────────────────────────
// Pure render component — no logic, no state mutations beyond local form state.
// Allows the user to photograph up to three scorecard panels and have the AI
// parse tees, ratings, slopes, yardages, pars, and stroke indices from them.
// On success calls onImport(courseData); on cancel calls onClose().
//
// Gemini key flow (Option B — localStorage prompt):
//   1. User taps "Analyse Photo" with no key stored → key-prompt UI appears.
//   2. User enters key from aistudio.google.com/app/apikey, taps "Save & Analyse".
//   3. Key written to SK.geminiKey; parse fires immediately.
//   4. On 401/403 from OpenAI: key deleted from localStorage, err shown,
//      key-prompt re-shown on next "Analyse" tap.

import { useState } from 'react';
import { Btn, Inp, G, GA, AMB, AMBBG, RED } from '../components/ui.jsx';
import { aiParseScorecard } from '../services/courseLib.js';
import { ls, SK } from '../services/storage.js';

export default function PhotoImportModal({ onImport, onClose }) {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const [photo1, setPhoto1] = useState(null);
  const [photo2, setPhoto2] = useState(null);
  const [parsed, setParsed]         = useState(null);
  const [loading, setLoading]       = useState(false);
  const [err, setErr]               = useState('');
  const [missing, setMissing]       = useState([]);
  const [manFill, setManFill]       = useState({});
  const [keyPrompt, setKeyPrompt]   = useState(false);
  const [parseStatus, setParseStatus] = useState('');
  const [keyDraft, setKeyDraft]     = useState('');

  const readFile = file => new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const img = new Image();
      img.onload = () => {
        // Convert to grayscale to improve OCR accuracy
        const canvas = document.createElement('canvas');
        canvas.width  = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        // Grayscale + contrast boost (factor 1.5)
        const contrast = 1.5;
        const intercept = 128 * (1 - contrast);
        for (let i = 0; i < data.length; i += 4) {
          const gray = Math.round(0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
          const adjusted = Math.min(255, Math.max(0, Math.round(gray * contrast + intercept)));
          data[i] = data[i+1] = data[i+2] = adjusted;
        }
        ctx.putImageData(imageData, 0, 0);

        // Sharpen using unsharp mask convolution
        const sharpCanvas = document.createElement('canvas');
        sharpCanvas.width  = canvas.width;
        sharpCanvas.height = canvas.height;
        const sCtx = sharpCanvas.getContext('2d');
        sCtx.filter = 'contrast(1.1)';
        sCtx.drawImage(canvas, 0, 0);
        // Apply sharpening kernel via CSS filter (supported in modern browsers)
        const sharpCtx = sharpCanvas.getContext('2d');
        const sharpData = sharpCtx.getImageData(0, 0, sharpCanvas.width, sharpCanvas.height);
        const src = imageData.data;
        const dst = sharpData.data;
        const w   = sharpCanvas.width;
        const h   = sharpCanvas.height;
        // Sharpen kernel: center=5, neighbors=-1 (normalized)
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const i = (y * w + x) * 4;
            for (let ch = 0; ch < 3; ch++) {
              const val = 5 * src[i+ch]
                - src[((y-1)*w+x)*4+ch]
                - src[((y+1)*w+x)*4+ch]
                - src[(y*w+x-1)*4+ch]
                - src[(y*w+x+1)*4+ch];
              dst[i+ch] = Math.min(255, Math.max(0, val));
            }
            dst[i+3] = 255;
          }
        }
        sCtx.putImageData(sharpData, 0, 0);
        const jpegUrl = sharpCanvas.toDataURL('image/jpeg', 0.92);
        res({ b64: jpegUrl.split(',')[1], mediaType: 'image/jpeg', thumb: jpegUrl });
      };
      img.onerror = () => {
        // Fallback: use raw data
        const b64 = dataUrl.split(',')[1];
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
        // Bad key — delete from storage and prompt user to re-enter on next tap
        ls.del(SK.geminiKey);
        setErr('Gemini key rejected — tap Analyse to re-enter.');
      } else if (e.message === 'GEMINI_NO_KEY') {
        // Defensive: analyse() guards this, but handle in case runParse called directly
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
      // Local dev: need a key for direct Gemini call
      const storedKey = ls.get(SK.geminiKey);
      if (!storedKey) {
        setKeyPrompt(true);
        setErr('');
        return;
      }
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

  const cancelKeyPrompt = () => {
    setKeyPrompt(false);
    setKeyDraft('');
  };

  const finish = () => {
    const c = JSON.parse(JSON.stringify(parsed || { courseName: 'Imported', nines: [], tees: [{ name: "Men's" }] }));
    if (!c.tees?.length) c.tees = [{ name: "Men's" }];
    if (manFill.rating) c.tees[0].rating = parseFloat(manFill.rating);
    if (manFill.slope)  c.tees[0].slope  = parseInt(manFill.slope);
    onImport({ name: c.courseName, location: c.location || '', nines: c.nines || [], tees: c.tees || [] });
  };

  const slotStyle = filled => ({
    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
    gap:4, padding:8, borderRadius:10, cursor:'pointer', fontSize:12, fontWeight:600,
    border:`1.5px solid ${filled ? G : '#ddd'}`, background: filled ? GA : '#fafafa',
    color: filled ? G : '#888', minHeight:80, position:'relative', overflow:'hidden',
  });

  const totalPhotos = [photo1, photo2].filter(Boolean).length;

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }} onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:20, padding:22, width:'100%', maxWidth:460, maxHeight:'92vh', overflowY:'auto' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
          <div>
            <div style={{ fontWeight:800, fontSize:17, color:G }}>Scan Scorecard</div>
            <div style={{ fontSize:11, color:'#888' }}>AI reads all tees, ratings, slopes, yardages &amp; handicaps</div>
          </div>
          <button onClick={onClose} style={{ border:'none', background:'none', fontSize:24, cursor:'pointer', color:'#aaa' }}>×</button>
        </div>
        <div style={{ background:AMBBG, color:AMB, borderRadius:8, padding:'8px 11px', fontSize:12, marginBottom:14 }}>
          💡 Capture all scorecard panels — tee/rating side, par/handicap side, and women's tee data if on a separate panel.
        </div>
        {err && <div style={{ background:'#fce8e8', color:RED, borderRadius:8, padding:'9px 12px', fontSize:13, marginBottom:10 }}>{err}</div>}
        {loading ? (
          <div style={{ textAlign:'center', padding:32 }}>
            <div style={{ color:'#888', fontSize:14, marginTop:8, fontWeight:600 }}>{parseStatus || 'Analysing scorecard…'}</div>
            <div style={{ color:'#aaa', fontSize:12, marginTop:4 }}>This usually takes 10–20s</div>
          </div>
        ) : (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
              {[1,2].map(slot => {
                const photo = slot === 1 ? photo1 : photo2;
                const labels = ['Front (Ratings)', 'Back (Holes)'];
                return (
                  <div key={slot}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#666', marginBottom:4, textAlign:'center' }}>
                      {labels[slot-1]} {slot===1 && <span style={{color:RED}}>*</span>}
                    </div>
                    <label style={slotStyle(!!photo)}>
                      {photo
                        ? <img src={photo.thumb} alt={`Side ${slot}`} style={{ width:'100%', height:72, objectFit:'cover', borderRadius:6 }}/>
                        : <><span style={{ fontSize:20 }}>📄</span><span>Tap to add</span></>
                      }
                      <input type="file" accept="image/*" style={{ position:'absolute', opacity:0, inset:0, cursor:'pointer' }}
                        onChange={e => { handleFile(e.target.files?.[0], slot); e.target.value=''; }}/>
                    </label>
                  </div>
                );
              })}
            </div>

            {/* Gemini key prompt — shown when no key is stored and user tapped Analyse */}
            {keyPrompt && !parsed && (
              <div style={{ background:'#f5f5ff', border:'1.5px solid #c5c5f0', borderRadius:12, padding:14, marginBottom:12 }}>
                <div style={{ fontWeight:700, fontSize:14, color:'#333', marginBottom:4 }}>Gemini API key required</div>
                <div style={{ fontSize:12, color:'#666', marginBottom:10 }}>
                  Get a free key at{' '}
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color:G }}>aistudio.google.com/app/apikey</a>
                  {' '}→ Get API key. Only needed for local development.
                </div>
                <Inp
                  value={keyDraft}
                  onChange={setKeyDraft}
                  placeholder="Paste API key here"
                />
                <div style={{ display:'flex', gap:8, marginTop:10 }}>
                  <Btn variant="outline" onClick={cancelKeyPrompt} style={{ flex:1 }}>Cancel</Btn>
                  <Btn onClick={saveKeyAndAnalyse} disabled={!keyDraft.trim()} style={{ flex:2 }}>Save &amp; Analyse</Btn>
                </div>
              </div>
            )}

            {!parsed && !keyPrompt && (
              <Btn onClick={analyse} disabled={!photo1} style={{ width:'100%', marginBottom:10 }}>
                {totalPhotos > 1 ? `Analyse ${totalPhotos} Photos` : 'Analyse Photo'}
              </Btn>
            )}

            {parsed && (
              <div>
                <div style={{ background:'#f0f8f0', border:'1.5px solid #b8d8b8', borderRadius:12, padding:12, marginBottom:10 }}>
                  <div style={{ fontWeight:700, color:G, fontSize:14 }}>{parsed.courseName || 'Course detected'}</div>
                  <div style={{ fontSize:12, color:'#888', marginBottom:6 }}>{parsed.nines?.length||0} nine(s) · {parsed.tees?.length||0} tee set(s)</div>
                  {parsed.nines?.map((n,i) => (
                    <div key={i} style={{ fontSize:12, color:'#555', marginBottom:2 }}>
                      • {n.name}: par {n.pars?.reduce((a,b)=>a+b,0)||'?'}
                      {n.handicapsWomen?.length ? ' (M+W handicaps)' : ' (M handicaps)'}
                    </div>
                  ))}
                  {parsed.tees?.map((t,i) => (
                    <div key={i} style={{ fontSize:12, color:'#555', marginBottom:2 }}>
                      • {t.name}: M {t.rating||'—'}/{t.slope||'—'}
                      {t.ratingW ? ` · W ${t.ratingW}/${t.slopeW||'—'}` : ''}
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
                  <Btn variant="outline" onClick={() => { setParsed(null); setErr(''); }} style={{ flex:1 }}>Retake</Btn>
                  <Btn onClick={finish} style={{ flex:2 }}>Save Course</Btn>
                </div>
              </div>
            )}
            <Btn variant="ghost" onClick={onClose} style={{ width:'100%', marginTop:8 }}>Cancel</Btn>
          </div>
        )}
      </div>
    </div>
  );
}
