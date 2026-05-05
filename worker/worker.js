// Cloudflare Worker — Golf Scorecard Parser (Coordinate + Cross-Anchor)
// Pass 1: Spatial survey — course name, panel bounding boxes, tee names, ratings
// Pass 2: Per-panel microscope transcription using coordinates
// JS: Assemble panels, validate with printed TOT, trigger Pass 3 if mismatch
// GEMINI_API_KEY set via: wrangler secret put GEMINI_API_KEY

const MODEL    = 'gemini-2.5-flash';
const BASE_URL = 'https://generativelanguage.googleapis.com';

const SCORECARD_SI =
  'You are an OCR transcription engine for golf scorecards. ' +
  'Read numbers exactly as printed. Never guess or interpolate. ' +
  'Each nine-hole panel is an independent data island. ' +
  'Use null for any illegible value.';

async function uploadImage(b64, mediaType, name, apiKey) {
  const binary  = atob(b64);
  const bytes   = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const byteLen = bytes.length;

  const initRes = await fetch(
    `${BASE_URL}/upload/v1beta/files?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol':              'resumable',
        'X-Goog-Upload-Command':               'start',
        'X-Goog-Upload-Header-Content-Type':   mediaType,
        'X-Goog-Upload-Header-Content-Length': byteLen.toString(),
        'Content-Type':                        'application/json',
      },
      body: JSON.stringify({ file: { display_name: name } }),
    }
  );
  if (!initRes.ok) throw new Error(`Files API init (${initRes.status}): ${await initRes.text()}`);
  const uploadUrl = initRes.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new Error('No upload URL from Files API');

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type':          mediaType,
      'Content-Length':        byteLen.toString(),
      'X-Goog-Upload-Offset':  '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: bytes,
  });
  if (!uploadRes.ok) throw new Error(`Files API upload (${uploadRes.status}): ${await uploadRes.text()}`);
  const fileData = await uploadRes.json();
  const uri = fileData?.file?.uri;
  if (!uri) throw new Error(`No URI from Files API: ${JSON.stringify(fileData)}`);
  return { uri, mimeType: mediaType };
}

async function geminiText(imageParts, prompt, apiKey, attempt = 1) {
  const body = {
    system_instruction: { parts: [{ text: SCORECARD_SI }] },
    contents: [{ parts: [...imageParts, { text: prompt }] }],
    generationConfig: { temperature: 0 },
  };
  const res = await fetch(
    `${BASE_URL}/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  if (res.status === 503 && attempt < 4) {
    const delay = attempt * 5000;
    console.log(`503 attempt ${attempt}, retry in ${delay}ms`);
    await new Promise(r => setTimeout(r, delay));
    return geminiText(imageParts, prompt, apiKey, attempt + 1);
  }
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const d    = await res.json();
  const text = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) throw new Error('Gemini returned no content');
  return text.trim();
}

function normalizeTee(name) {
  return name.split('/').map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('/');
}

// Parse Pass 1 layout response
function parseLayout(text) {
  const result = { courseName: null, location: null, panels: [], tees: [], ratingsText: null };
  for (const line of text.split('\n').map(l => l.trim()).filter(Boolean)) {
    if (line.toUpperCase().startsWith('COURSE:')) {
      result.courseName = line.slice(line.indexOf(':') + 1).trim();
    } else if (line.toUpperCase().startsWith('LOCATION:')) {
      const raw   = line.slice(line.indexOf(':') + 1).trim();
      const parts = raw.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        const state = parts[parts.length - 1].replace(/\d{5}(-\d{4})?/, '').trim();
        const city  = parts[parts.length - 2].replace(/^\d+\s+\S+\s+/, '').trim();
        result.location = `${city}, ${state}`;
      } else {
        result.location = raw;
      }
    } else if (line.toUpperCase().startsWith('PANELS:')) {
      // Parse: PANELS: South:[0,0,1000,333], North:[0,334,1000,666]
      const panelStr = line.slice(line.indexOf(':') + 1).trim();
      // Split on pattern: ], followed by optional space and a word character
      const panelParts = panelStr.split(/\],\s*(?=[A-Za-z])/);
      for (const part of panelParts) {
        const bracketIdx = part.indexOf(':[');
        if (bracketIdx === -1) continue;
        const name   = part.slice(0, bracketIdx).trim();
        const coords = part.slice(bracketIdx + 1).replace(/[\[\]]/g, '').trim();
        if (name && coords) result.panels.push({ name, coords });
      }
    } else if (line.toUpperCase().startsWith('TEES:')) {
      result.tees = line.slice(line.indexOf(':') + 1)
        .split(',').map(t => t.replace(/[\[\]]/g, '').trim()).filter(Boolean);
    } else if (line.toUpperCase().startsWith('RATINGS:')) {
      result.ratingsText = line.slice(line.indexOf(':') + 1).trim();
    }
  }
  return result;
}

// Parse a single panel transcription into arrays
function parsePanel(text, teeNames) {
  const panel = { par: [], parWomen: [], handicapMen: [], handicapWomen: [], parTot: null, tees: {} };

  for (const line of text.split('\n').map(l => l.trim()).filter(Boolean)) {
    if (line.match(/^Hole\s+\d+/i)) {
      const getVal = (key) => {
        let m = line.match(new RegExp(key + '\\[([^\\]]*?)\\]'));
        if (!m) m = line.match(new RegExp(key + '(\\d+(?:\\.\\d+)?)(?:[,\\s]|$)'));
        if (!m) return null;
        const v = m[1].trim();
        if (v === 'null' || v === '' || v === '-') return null;
        const n = parseFloat(v);
        return isNaN(n) ? null : n;
      };

      panel.par.push(getVal('PAR'));
      const pw = getVal('PAR_W');
      if (pw !== null) panel.parWomen.push(pw);
      panel.handicapMen.push(getVal('HCP_M'));
      panel.handicapWomen.push(getVal('HCP_W'));

      // Yardages: Y_TeeName[value] or Y_TeeName512
      const yMatches = [...line.matchAll(/Y_([A-Za-z/]+)(?:\[([^\]]*?)\]|(\d+))/g)];
      for (const m of yMatches) {
        const teeName = normalizeTee(m[1].trim());
        if (!panel.tees[teeName]) panel.tees[teeName] = [];
        const v = (m[2] !== undefined ? m[2] : m[3] || '').trim();
        panel.tees[teeName].push(v === 'null' || v === '' ? null : parseFloat(v));
      }
    } else if (line.match(/^Summary/i)) {
      const m = line.match(/PAR\[(\d+)\]/);
      if (m) panel.parTot = parseInt(m[1]);
    }
  }
  return panel;
}

function parseRatings(str, tees) {
  if (!str) return;
  const pm  = /([\w/]+)\s+men\s+([\d.]+)\/([\d]+)/gi;
  const pw  = /([\w/]+)\s+women\s+([\d.]+)\/([\d]+)/gi;
  let m;
  while ((m = pm.exec(str))  !== null) {
    const k = normalizeTee(m[1]);
    if (!tees[k]) tees[k] = {};
    tees[k].menRating = parseFloat(m[2]);
    tees[k].menSlope  = parseInt(m[3]);
  }
  while ((m = pw.exec(str)) !== null) {
    const k = normalizeTee(m[1]);
    if (!tees[k]) tees[k] = {};
    tees[k].womenRating = parseFloat(m[2]);
    tees[k].womenSlope  = parseInt(m[3]);
  }
}

function validate(panels) {
  const issues = [];
  panels.forEach((panel, i) => {
    const sum    = panel.par.filter(v => v != null).reduce((a, b) => a + b, 0);
    const target = panel.parTot;
    const name   = panel.name || `Nine ${i+1}`;
    if (target !== null && sum !== target) {
      issues.push({ nine: i, name, sum, target, message: `${name} par sum ${sum} but card shows ${target}` });
    } else if (target === null && (sum < 27 || sum > 40)) {
      issues.push({ nine: i, name, sum, target: null, message: `${name} par sum ${sum} outside 27-40` });
    }
    // Handicap uniqueness 1-9
    const mh = panel.handicapMen.filter(v => v != null);
    if (mh.length === 9) {
      const sorted = [...mh].sort((a,b) => a-b);
      if (JSON.stringify(sorted) !== JSON.stringify([1,2,3,4,5,6,7,8,9])) {
        const dups = mh.filter((v,j,a) => a.indexOf(v) !== j);
        issues.push({ nine: i, name, message: `${name} mens HCP not unique 1-9${dups.length ? ', dups: '+dups : ''}` });
      }
    }
    const wh = panel.handicapWomen.filter(v => v != null);
    if (wh.length === 9) {
      const sorted = [...wh].sort((a,b) => a-b);
      if (JSON.stringify(sorted) !== JSON.stringify([1,2,3,4,5,6,7,8,9])) {
        const dups = wh.filter((v,j,a) => a.indexOf(v) !== j);
        issues.push({ nine: i, name, message: `${name} womens HCP not unique 1-9${dups.length ? ', dups: '+dups : ''}` });
      }
    }
  });
  return issues;
}

function buildSchema(courseName, location, panels, teesData) {
  const nineSize = 9;
  const n        = panels.length * nineSize;
  const nines    = panels.map(panel => {
    const nine = { name: panel.name };
    const pars = panel.par.filter(v => v != null);
    if (pars.length) nine.pars = pars;
    const parsW = panel.parWomen.filter(v => v != null);
    if (parsW.length && JSON.stringify(parsW) !== JSON.stringify(pars)) nine.parsWomen = parsW;
    const hcpM = panel.handicapMen.filter(v => v != null);
    if (hcpM.length) nine.handicaps = hcpM;
    const hcpW = panel.handicapWomen.filter(v => v != null);
    if (hcpW.length) nine.handicapsWomen = hcpW;
    return nine;
  });

  // Merge per-panel tee yardages into full-course tee objects
  const teeMap = {};
  // Start with ratings — map internal field names to courseLib field names
  for (const [name, info] of Object.entries(teesData)) {
    teeMap[name] = {
      name,
      rating:  info.menRating,
      slope:   info.menSlope,
      ratingW: info.womenRating,
      slopeW:  info.womenSlope,
    };
    // Remove undefined fields
    for (const k of Object.keys(teeMap[name])) {
      if (teeMap[name][k] === undefined) delete teeMap[name][k];
    }
  }
  // Add yardages from panels
  for (const [teeName, info] of Object.entries(teeMap)) {
    const allYards = panels.flatMap(p => p.tees[teeName] || Array(9).fill(null));
    if (allYards.length === n && allYards.some(v => v != null)) {
      const nineYards = panels.map((p, i) => {
        const slice = p.tees[teeName] || Array(9).fill(null);
        const sum   = slice.filter(v => v != null).reduce((a,b) => a+b, 0);
        return sum > 0 ? sum : null;
      }).filter(v => v != null);
      if (nineYards.length === panels.length) {
        teeMap[teeName].nineYards  = nineYards;
        teeMap[teeName].totalYards = nineYards.reduce((a,b) => a+b, 0);
      }
    }
  }

  return {
    courseName: courseName || 'Imported Course',
    location:   location  || '',
    nines,
    tees: Object.values(teeMap),
  };
}

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST')   return new Response('Method Not Allowed', { status: 405, headers: cors });

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });

    let photos;
    try {
      ({ photos } = await request.json());
      if (!Array.isArray(photos) || !photos.length) throw new Error('No photos provided');
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    try {
      const t0 = Date.now();

      console.log('Uploading', photos.length, 'images...');
      const fileUris = await Promise.all(
        photos.map((p, i) => uploadImage(p.b64, p.mediaType, `scorecard_${i+1}`, apiKey))
      );
      console.log('Upload done:', Date.now() - t0, 'ms');

      const imageParts = fileUris.map(f => ({
        file_data: { mime_type: f.mimeType, file_uri: f.uri },
      }));

      // Pass 1 — Spatial survey: panels, tees, ratings
      console.log('Pass 1 start');
      const layoutText = await geminiText(
        imageParts,
        'Survey this scorecard and output ONLY the following:\n' +
        'COURSE: (full course name)\n' +
        'LOCATION: (city, state)\n' +
        'PANELS: (nine name):[ymin,xmin,ymax,xmax], (nine name):[ymin,xmin,ymax,xmax], ...\n' +
        '  Use 0-1000 scale. Each panel covers exactly one 9-hole grid.\n' +
        'TEES: (tee names in order top to bottom, comma separated)\n' +
        'RATINGS: (tee) men (rating)/(slope), (tee) women (rating)/(slope), ...\n' +
        'Nothing else. No descriptions.',
        apiKey
      );
      console.log('Pass 1 done:', Date.now() - t0, 'ms');
      console.log('Layout:', layoutText);

      const layout = parseLayout(layoutText);
      console.log('Panels:', layout.panels.map(p => `${p.name}:[${p.coords}]`).join(', '));
      console.log('Tees:', layout.tees.join(', '));

      // Fallback if no panels detected
      if (layout.panels.length === 0) {
        layout.panels = [
          { name: 'Front', coords: '0,0,1000,500' },
          { name: 'Back',  coords: '0,500,1000,1000' },
        ];
        console.log('No panels detected, using default Front/Back split');
      }

      // Normalize generic panel names to Front/Back/Third
      const defaultNames = ['Front', 'Back', 'Third'];
      layout.panels = layout.panels.map((p, i) => {
        const u = p.name.toUpperCase();
        if (u.includes('FRONT') || u.includes('1-9')   || u.includes('OUT'))   return { ...p, name: 'Front' };
        if (u.includes('BACK')  || u.includes('10-18') || u.includes('IN'))     return { ...p, name: 'Back'  };
        if (u.includes('THIRD') || u.includes('19-27'))                         return { ...p, name: 'Third' };
        if (/^[A-Z][a-z]+$/.test(p.name))                                       return p; // real name like North/South
        return { ...p, name: defaultNames[i] || p.name };
      });
      console.log('Panels:', layout.panels.map(p => `${p.name}:[${p.coords}]`).join(', '));
      const teesData = {};
      if (layout.ratingsText) parseRatings(layout.ratingsText, teesData);

      // Pass 2 — Per-panel microscope transcription
      const panels = [];
      for (const panel of layout.panels) {
        console.log(`Pass 2 panel "${panel.name}" [${panel.coords}] start`);
        const panelText = await geminiText(
          imageParts,
          `Focus strictly on the "${panel.name}" nine-hole panel at coordinates [${panel.coords}] (0-1000 scale).\n` +
          `This panel contains exactly 9 holes. For each hole number printed at the TOP of its column,\n` +
          `look STRAIGHT DOWN that column and read: par, womens par (if different row exists), mens handicap, womens handicap, and yardage for every tee.\n\n` +
          `CRITICAL: Number your output holes 1-9 regardless of what hole numbers are printed on the card.\n` +
          `Output one line per hole:\n` +
          `Hole [1]: PAR[value], PAR_W[value], HCP_M[value], HCP_W[value], Y_${layout.tees[0] || 'Tee1'}[value], Y_${layout.tees[1] || 'Tee2'}[value]...\n\n` +
          `After all 9 holes, you MUST include this summary line using the printed OUT or TOT column total:\n` +
          `Summary TOT: PAR[value]\n` +
          `Example: Summary TOT: PAR[36]\n\n` +
          `CRITICAL: Read exactly 9 holes. Always include Summary TOT. Use null for illegible values. No other output.`,
          apiKey
        );
        console.log(`Pass 2 panel "${panel.name}" done:`, Date.now() - t0, 'ms');
        console.log(`Panel "${panel.name}" text:`, panelText.slice(0, 200));

        const parsed   = parsePanel(panelText, layout.tees);
        parsed.name    = panel.name;
        parsed.coords  = panel.coords;
        panels.push(parsed);
      }

      // Validate all panels
      const issues = validate(panels);
      console.log('Validation:', issues.length ? issues.map(i => i.message).join('; ') : 'none');

      // Pass 3 — Re-read par for panels with sum mismatch
      const parIssues = issues.filter(i => i.message.includes('par sum'));
      for (const issue of parIssues) {
        const panel = panels[issue.nine];
        console.log(`Pass 3 "${panel.name}" par correction start`);
        const fix = await geminiText(
          imageParts,
          `The "${panel.name}" nine at [${panel.coords}] has a par sum of ${issue.sum} but the card shows ${issue.target}.\n` +
          `Re-read ONLY the PAR row for this panel. For each hole number at the top of its column,\n` +
          `look straight down to the PAR row and read the value.\n` +
          `Output corrected lines only:\n` +
          `Hole [N]: PAR[corrected value]\n` +
          `Nothing else.`,
          apiKey
        );
        console.log(`Pass 3 "${panel.name}" done:`, Date.now() - t0, 'ms', fix.slice(0, 150));

        // Merge corrections
        for (const line of fix.split('\n').map(l => l.trim()).filter(Boolean)) {
          if (line.match(/^Hole\s+\d+/i)) {
            const idx = parseInt(line.match(/\d+/)[0]) - 1;
            const m   = line.match(/PAR\[(\d+)\]/);
            if (m && idx >= 0 && idx < panel.par.length) {
              panel.par[idx] = parseFloat(m[1]);
            }
          }
        }
      }

      const result = buildSchema(layout.courseName, layout.location, panels, teesData);
      console.log('Done:', Date.now() - t0, 'ms', result.courseName, result.nines.length, 'nines', result.tees.length, 'tees');

      return new Response(JSON.stringify(result), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
      });

    } catch (e) {
      console.error('Error:', e.message);
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
  },
};
