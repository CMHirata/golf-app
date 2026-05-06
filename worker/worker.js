// Cloudflare Worker — Golf Scorecard Parser (Mistral OCR)
// Uses Mistral OCR API for table extraction, then Gemini for structured interpretation
// MISTRAL_API_KEY and GEMINI_API_KEY set via: wrangler secret put KEY_NAME

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL   = 'https://generativelanguage.googleapis.com';

// ── Mistral OCR ───────────────────────────────────────────────────────────────

async function mistralOCR(b64, mediaType, apiKey) {
  const res = await fetch('https://api.mistral.ai/v1/ocr', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model:    'mistral-ocr-latest',
      document: {
        type:      'image_url',
        image_url: `data:${mediaType};base64,${b64}`,
      },
      table_format: 'html',
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Mistral OCR ${res.status}: ${txt}`);
  }

  const data = await res.json();
  console.log('Mistral raw response keys:', Object.keys(data).join(','));

  // Debug: check page structure
  if (data.pages && data.pages[0]) {
    const p0 = data.pages[0];
    console.log('Page 0 keys:', Object.keys(p0).join(','));
    console.log('Page 0 tables type:', typeof p0.tables, Array.isArray(p0.tables) ? 'array len:'+p0.tables.length : '');
    if (p0.tables && p0.tables.length > 0) {
      console.log('First table keys:', Object.keys(p0.tables[0]).join(','));
      console.log('First table id:', p0.tables[0].id);
      console.log('First table content preview:', (p0.tables[0].content || '').slice(0, 100));
    }
  }

  // Tables are in page.tables as array of {id, content} objects
  let markdown = (data.pages || []).map(p => {
    let text = p.markdown || '';
    const tables = p.tables || [];
    for (const table of tables) {
      const placeholder = `[${table.id}](${table.id})`;
      text = text.replace(placeholder, table.content || '');
    }
    return text;
  }).join('\n\n');

  console.log('Mistral OCR markdown length:', markdown.length);
  console.log('Mistral OCR preview:', markdown.slice(0, 500));
  return markdown;
}

// ── Parse Mistral OCR output ──────────────────────────────────────────────────

function normalizeTee(name) {
  return name.split('/').map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('/');
}

function parseHTMLTable(html) {
  // Extract rows from HTML table
  const rows = [];
  const rowMatches = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  for (const rowMatch of rowMatches) {
    const cells = [...rowMatch[1].matchAll(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)]
      .map(m => m[1].replace(/<[^>]+>/g, '').trim());
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

function parseOCROutput(markdown) {
  const data = {
    courseName:    null,
    location:      null,
    nines:         [],
    par:           [],
    parWomen:      [],
    handicapMen:   [],
    handicapWomen: [],
    tees:          {},
    ratings:       {},
  };

  // Extract course name and location from text before tables
  const lines = markdown.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.match(/^#\s+/)) {
      // Markdown heading — likely course name
      if (!data.courseName) data.courseName = line.replace(/^#+\s+/, '').trim();
    }
  }

  // Extract HTML tables
  const tableMatches = [...markdown.matchAll(/<table[\s\S]*?<\/table>/gi)];
  console.log('Tables found:', tableMatches.length);

  for (const tableMatch of tableMatches) {
    const rows = parseHTMLTable(tableMatch[0]);
    if (rows.length === 0) continue;

    // Determine what kind of table this is
    const firstRow = rows[0].map(c => c.toUpperCase());
    const hasHole  = firstRow.some(c => c === 'HOLE' || c === '#');
    const hasPar   = rows.some(r => r[0]?.toUpperCase() === 'PAR');
    const hasRating = rows.some(r => r[0]?.toUpperCase() === 'RATING' || r[0]?.toUpperCase() === 'TEE');

    if (hasRating && !hasPar) {
      // Ratings table
      parseRatingsTable(rows, data.ratings);
    } else if (hasHole || hasPar) {
      // Scorecard grid — parse hole data
      parseScorecardTable(rows, data);
    }
  }

  return data;
}

function parseScorecardTable(rows, data) {
  // Find header row with hole numbers
  let holeRow = -1;
  for (let i = 0; i < rows.length; i++) {
    const upper = rows[i].map(c => c.toUpperCase());
    if (upper[0] === 'HOLE' || upper[0] === '#') { holeRow = i; break; }
    if (rows[i].some(c => c === '1' || c === '10')) { holeRow = i; break; }
  }

  // Find TOT column index
  let totIdx = -1;
  if (holeRow >= 0) {
    const hr = rows[holeRow];
    totIdx = hr.findIndex(c => c.toUpperCase() === 'TOT' || c.toUpperCase() === 'OUT' || c.toUpperCase() === 'TOTAL');
  }

  // Find nine name
  for (const row of rows) {
    const label = row[0]?.toUpperCase();
    if (label === 'SOUTH' || label === 'NORTH' || label === 'EAST' ||
        label === 'FRONT' || label === 'BACK'  || label === 'THIRD') {
      if (!data.nines.includes(row[0])) data.nines.push(row[0]);
    }
  }

  // Parse data rows
  for (const row of rows) {
    if (row.length < 2) continue;
    const label = row[0]?.toUpperCase().trim();
    if (!label) continue;

    // Get hole values (skip label and TOT columns)
    const getVals = () => {
      const end = totIdx > 0 ? totIdx : row.length;
      return row.slice(1, end).map(v => {
        const n = parseFloat(v.replace(/,/g, ''));
        return isNaN(n) ? null : n;
      });
    };

    if (label === 'PAR' || label === "MEN'S PAR" || label === 'MENS PAR') {
      const vals = getVals();
      data.par = [...data.par, ...vals];
    } else if (label === "WOMEN'S PAR" || label === 'WOMENS PAR' || label === 'PAR_W') {
      const vals = getVals();
      data.parWomen = [...data.parWomen, ...vals];
    } else if (label === "MEN'S HCP" || label === 'MENS HCP' || label === 'HCP' ||
               label === "MEN'S HANDICAP" || label === 'HCP_M') {
      const vals = getVals();
      data.handicapMen = [...data.handicapMen, ...vals];
    } else if (label === "WOMEN'S HCP" || label === 'WOMENS HCP' || label === "LADIES' HCP" ||
               label === "WOMEN'S HANDICAP" || label === 'HCP_W') {
      const vals = getVals();
      data.handicapWomen = [...data.handicapWomen, ...vals];
    } else if (label.match(/^(BLACK|BLUE|WHITE|RED|GOLD|GREEN|SILVER)/i)) {
      // Yardage row
      const teeName = normalizeTee(row[0].trim());
      const vals    = getVals();
      if (!data.tees[teeName]) data.tees[teeName] = { yardages: [] };
      data.tees[teeName].yardages = [...(data.tees[teeName].yardages || []), ...vals];
    }
  }
}

function parseRatingsTable(rows, ratings) {
  for (const row of rows) {
    if (row.length < 3) continue;
    const tee = normalizeTee(row[0].trim());
    if (!tee || tee.toUpperCase() === 'TEE') continue;

    // Try to find rating and slope
    const nums = row.slice(1).map(v => parseFloat(v)).filter(n => !isNaN(n));
    if (nums.length >= 2) {
      if (!ratings[tee]) ratings[tee] = {};
      // Assume first number is rating, second is slope
      if (nums[0] > 50 && nums[0] < 90) ratings[tee].menRating = nums[0];
      if (nums[1] > 50 && nums[1] < 160) ratings[tee].menSlope  = nums[1];
    }
  }
}

// ── Gemini for ratings/course info ───────────────────────────────────────────

async function geminiText(imageB64, mediaType, prompt, apiKey) {
  const body = {
    contents: [{ parts: [
      { inline_data: { mime_type: mediaType, data: imageB64 } },
      { text: prompt },
    ]}],
    generationConfig: { temperature: 0 },
  };
  const res = await fetch(
    `${GEMINI_URL}/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const d = await res.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ── Build courseLib schema ────────────────────────────────────────────────────

function buildSchema(data, ratingsText) {
  const n        = data.par.length;
  const nineSize = 9;
  const nineCount = Math.ceil(n / nineSize);
  const defaultNames = ['Front', 'Back', 'Third'];
  const nineNames = data.nines.length === nineCount ? data.nines : defaultNames;
  const nines = [];

  for (let i = 0; i < nineCount; i++) {
    const start = i * nineSize;
    const end   = Math.min(start + nineSize, n);
    const nine  = { name: nineNames[i] || `Nine ${i+1}` };

    const pars = data.par.slice(start, end).filter(v => v != null);
    if (pars.length) nine.pars = pars;

    const parsW = data.parWomen.slice(start, end).filter(v => v != null);
    if (parsW.length && JSON.stringify(parsW) !== JSON.stringify(pars)) nine.parsWomen = parsW;

    const hcpM = data.handicapMen.slice(start, end).filter(v => v != null);
    if (hcpM.length) nine.handicaps = hcpM;

    const hcpW = data.handicapWomen.slice(start, end).filter(v => v != null);
    if (hcpW.length) nine.handicapsWomen = hcpW;

    nines.push(nine);
  }

  // Build tees from ratings text + yardages
  const teeMap = {};

  // Parse ratings from Gemini text response
  if (ratingsText) {
    const pm = /([\w/]+)\s+men\s+([\d.]+)\/([\d]+)/gi;
    const pw = /([\w/]+)\s+women\s+([\d.]+)\/([\d]+)/gi;
    let m;
    while ((m = pm.exec(ratingsText)) !== null) {
      const k = normalizeTee(m[1]);
      if (!teeMap[k]) teeMap[k] = { name: k };
      teeMap[k].rating = parseFloat(m[2]);
      teeMap[k].slope  = parseInt(m[3]);
    }
    while ((m = pw.exec(ratingsText)) !== null) {
      const k = normalizeTee(m[1]);
      if (!teeMap[k]) teeMap[k] = { name: k };
      teeMap[k].ratingW = parseFloat(m[2]);
      teeMap[k].slopeW  = parseInt(m[3]);
    }
  }

  // Add yardages
  for (const [teeName, info] of Object.entries(data.tees)) {
    if (!teeMap[teeName]) teeMap[teeName] = { name: teeName };
    if (Array.isArray(info.yardages) && info.yardages.length === n) {
      const nineYards = [];
      for (let i = 0; i < nineCount; i++) {
        const slice = info.yardages.slice(i * nineSize, (i + 1) * nineSize);
        const sum   = slice.filter(v => v != null).reduce((a, b) => a + b, 0);
        if (sum > 0) nineYards.push(sum);
      }
      if (nineYards.length === nineCount) {
        teeMap[teeName].nineYards  = nineYards;
        teeMap[teeName].totalYards = nineYards.reduce((a, b) => a + b, 0);
      }
    }
  }

  return {
    courseName: data.courseName || 'Imported Course',
    location:   data.location  || '',
    nines,
    tees: Object.values(teeMap),
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST')   return new Response('Method Not Allowed', { status: 405, headers: cors });

    const mistralKey = env.MISTRAL_API_KEY;
    const geminiKey  = env.GEMINI_API_KEY;
    console.log('Mistral key present:', !!mistralKey, 'length:', mistralKey?.length);
    if (!mistralKey) return new Response(JSON.stringify({ error: 'MISTRAL_API_KEY not configured' }), {
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
      console.log('Processing', photos.length, 'photos with Mistral OCR');

      // Run Mistral OCR on all photos in parallel
      const ocrResults = await Promise.all(
        photos.map(p => mistralOCR(p.b64, p.mediaType, mistralKey))
      );
      console.log('OCR done:', Date.now() - t0, 'ms');

      // Combine all OCR output
      const combined = ocrResults.join('\n\n---\n\n');

      // Parse OCR output
      const data = parseOCROutput(combined);
      console.log('Parsed:', data.par.length, 'holes,', Object.keys(data.tees).length, 'tees');
      console.log('PAR:', data.par.join(','));
      console.log('HCP_M:', data.handicapMen.join(','));

      // Use Gemini for ratings/course info if we have a key
      let ratingsText = '';
      if (geminiKey) {
        console.log('Getting ratings from Gemini...');
        ratingsText = await geminiText(
          photos[0].b64, photos[0].mediaType,
          'Extract ONLY the course name, location, and all tee ratings/slopes from this scorecard.\n' +
          'Format: COURSE: name\nLOCATION: city, state\n' +
          'RATINGS: TeeName men rating/slope, TeeName women rating/slope,...\n' +
          'Nothing else.',
          geminiKey
        );
        console.log('Ratings:', ratingsText.slice(0, 200));

        // Extract course name and location from Gemini response
        for (const line of ratingsText.split('\n')) {
          if (line.toUpperCase().startsWith('COURSE:') && !data.courseName) {
            data.courseName = line.slice(line.indexOf(':') + 1).trim();
          }
          if (line.toUpperCase().startsWith('LOCATION:') && !data.location) {
            const raw   = line.slice(line.indexOf(':') + 1).trim();
            const parts = raw.split(',').map(p => p.trim());
            data.location = parts.length >= 2
              ? `${parts[parts.length-2]}, ${parts[parts.length-1].replace(/\d{5}/, '').trim()}`
              : raw;
          }
        }
      }

      const result = buildSchema(data, ratingsText);
      console.log('Done:', Date.now() - t0, 'ms', result.courseName);

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
