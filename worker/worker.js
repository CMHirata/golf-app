// Cloudflare Worker — Golf Scorecard Parser
// Files API upload for full-resolution server-side processing.
// 2-pass pipeline: layout mapping -> structured extraction
// GEMINI_API_KEY set via: wrangler secret put GEMINI_API_KEY

const MODEL    = 'gemini-2.5-flash';
const BASE_URL = 'https://generativelanguage.googleapis.com';

const SCORECARD_SI =
  'You are an expert OCR agent specializing in high-precision data extraction from golf scorecards. ' +
  'Operational Protocol: ' +
  '1. Identify Anchors: First, locate the row headers (Black, Blue, White, Par, HCP) and column headers (Holes 1-18, OUT, IN, TOT). ' +
  '2. Process Logic: For every hole, cross-reference the vertical column with the horizontal row. ' +
  '3. Combo Tee Rule: Pay close attention to small black triangles or arrows indicating combo tees. ' +
  '4. Self-Correction Step: After extracting all holes, verify yardage sums match the TOT columns on the card. ' +
  '5. Handling Ambiguity: If a number is obstructed, output null. DO NOT guess or infer. ' +
  '6. Final Output: Provide only valid JSON following the provided schema. No markdown or conversational text.';

const SCORECARD_SCHEMA = {
  type: 'object',
  properties: {
    courseName: { type: 'string' },
    address:    { type: 'string' },
    tees: {
      type:  'array',
      items: {
        type: 'object',
        properties: {
          teeName: { type: 'string' },
          gender:  { type: 'string', enum: ['Men', 'Women', 'Unspecified'] },
          rating:  { type: 'number' },
          slope:   { type: 'number' },
        },
        required: ['teeName', 'gender', 'rating', 'slope'],
      },
    },
    holes: {
      type:  'array',
      items: {
        type: 'object',
        properties: {
          holeNumber:    { type: 'integer' },
          par:           { type: 'integer' },
          handicapMen:   { type: 'integer' },
          handicapWomen: { type: 'integer' },
          yardages:      { type: 'object' },
        },
        required: ['holeNumber', 'par'],
      },
    },
  },
  required: ['courseName', 'holes'],
};

// Upload image to Gemini Files API
async function uploadImage(b64, mediaType, name, apiKey) {
  const binary  = atob(b64);
  const bytes   = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const byteLen = bytes.length;

  const initRes = await fetch(
    `${BASE_URL}/upload/v1beta/files?key=${apiKey}`,
    {
      method:  'POST',
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

  if (!initRes.ok) {
    const txt = await initRes.text();
    throw new Error(`Files API init failed (${initRes.status}): ${txt}`);
  }

  const uploadUrl = initRes.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new Error('Files API did not return upload URL');

  const uploadRes = await fetch(uploadUrl, {
    method:  'POST',
    headers: {
      'Content-Type':          mediaType,
      'Content-Length':        byteLen.toString(),
      'X-Goog-Upload-Offset':  '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: bytes,
  });

  if (!uploadRes.ok) {
    const txt = await uploadRes.text();
    throw new Error(`Files API upload failed (${uploadRes.status}): ${txt}`);
  }

  const fileData = await uploadRes.json();
  const uri = fileData?.file?.uri;
  if (!uri) throw new Error(`Files API no URI: ${JSON.stringify(fileData)}`);
  return { uri, mimeType: mediaType };
}

// Gemini call — text response only (no JSON schema)
async function geminiText(imageParts, prompt, apiKey) {
  const body = {
    system_instruction: { parts: [{ text: SCORECARD_SI }] },
    contents: [{ parts: [...imageParts, { text: prompt }] }],
    generationConfig: { temperature: 0 },
  };

  const res = await fetch(
    `${BASE_URL}/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );

  if (!res.ok) { const txt = await res.text(); throw new Error(`Gemini ${res.status}: ${txt}`); }
  const d    = await res.json();
  const text = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) throw new Error('Gemini returned no content');
  return text;
}

// Gemini call — JSON schema enforced
async function geminiJSON(imageParts, prompt, apiKey, schema) {
  const body = {
    system_instruction: { parts: [{ text: SCORECARD_SI }] },
    contents: [{ parts: [...imageParts, { text: prompt }] }],
    generationConfig: {
      temperature:        0,
      response_mime_type: 'application/json',
      response_schema:    schema || SCORECARD_SCHEMA,
    },
  };

  const res = await fetch(
    `${BASE_URL}/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );

  if (!res.ok) { const txt = await res.text(); throw new Error(`Gemini ${res.status}: ${txt}`); }
  const d    = await res.json();
  const text = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) throw new Error('Gemini returned no content');
  return JSON.parse(text);
}

// Convert Gemini per-hole output to courseLib schema
function toSchema(d) {
  const sorted    = [...d.holes].sort((a, b) => a.holeNumber - b.holeNumber);
  const nineSize  = 9;
  const nineCount = Math.ceil(sorted.length / nineSize);
  const nineNames = ['Front', 'Back', 'Third'];
  const nines     = [];

  for (let i = 0; i < nineCount; i++) {
    const group = sorted.slice(i * nineSize, (i + 1) * nineSize);
    const nine  = { name: nineNames[i] || `Nine ${i + 1}` };
    nine.pars      = group.map(h => h.par).filter(v => v != null);
    nine.handicaps = group.map(h => h.handicapMen).filter(v => v != null);
    const hw = group.map(h => h.handicapWomen).filter(v => v != null);
    if (hw.length === group.length) nine.handicapsWomen = hw;
    nines.push(nine);
  }

  const teeMap = {};
  for (const t of (d.tees || [])) {
    if (!teeMap[t.teeName]) teeMap[t.teeName] = { name: t.teeName };
    if (t.gender === 'Men' || t.gender === 'Unspecified') {
      teeMap[t.teeName].rating = t.rating;
      teeMap[t.teeName].slope  = t.slope;
    }
    if (t.gender === 'Women') {
      teeMap[t.teeName].ratingW = t.rating;
      teeMap[t.teeName].slopeW  = t.slope;
    }
  }

  const tees = Object.values(teeMap).map(tee => {
    const nineYards = nines.map((nine, ni) => {
      const group = sorted.slice(ni * nineSize, (ni + 1) * nineSize);
      const yards = group.map(h => h.yardages?.[tee.name]).filter(v => v != null);
      return yards.length === group.length ? yards.reduce((a, b) => a + b, 0) : null;
    }).filter(v => v != null);
    if (nineYards.length === nines.length) {
      tee.nineYards  = nineYards;
      tee.totalYards = nineYards.reduce((a, b) => a + b, 0);
    }
    return tee;
  });

  return {
    courseName: d.courseName || 'Imported Course',
    location:   d.address    || '',
    nines,
    tees,
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
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors });

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

      // Upload images to Files API
      console.log('Uploading', photos.length, 'images...');
      const fileUris = await Promise.all(
        photos.map((p, i) => uploadImage(p.b64, p.mediaType, `scorecard_${i + 1}`, apiKey))
      );
      console.log('Upload done:', Date.now() - t0, 'ms');

      const imageParts = fileUris.map(f => ({
        file_data: { mime_type: f.mimeType, file_uri: f.uri },
      }));

      // Pass 1 - Layout mapping
      console.log('Pass 1 start');
      const layout = await geminiText(
        imageParts,
        'Before extracting any data, describe the layout of this scorecard. ' +
        'List every tee box name exactly as printed, in the order they appear. ' +
        'Identify where par, handicap, and yardage rows are. ' +
        'Note whether men and women ratings are in separate columns. ' +
        'Note any combo tees. Describe the structure in detail.',
        apiKey
      );
      console.log('Pass 1 done:', Date.now() - t0, 'ms');

      // Pass 2 - Full extraction using layout context
      console.log('Pass 2 start');
      const extracted = await geminiJSON(
        imageParts,
        'Using this layout description as reference: ' + layout + ' ' +
        'Now extract ALL data from the scorecard including: ' +
        'course name, address, ' +
        'all tee ratings and slopes for men and women separately, ' +
        'and for EVERY hole: par, mens handicap, womens handicap, and yardage for EVERY tee. ' +
        'The yardages object for each hole must include a yardage value for every tee listed. ' +
        'Return null for any illegible value but do not skip any holes or tees.',
        apiKey
      );
      console.log('Pass 2 done:', Date.now() - t0, 'ms');

      // Pass 3 - Validation: fix adjacent-hole swaps and missing values
      console.log('Pass 3 start');
      const validated = await geminiJSON(
        imageParts,
        'Here is extracted scorecard data: ' + JSON.stringify(extracted) + ' ' +
        'Verify against the scorecard image: ' +
        '1. Mens handicap values across all 18 holes must be unique integers 1-18. Check for any swapped adjacent holes and correct them. ' +
        '2. Womens handicap values across all 18 holes must be unique integers 1-18. Check for any swapped adjacent holes and correct them. ' +
        '3. Par values must all be 3, 4, or 5. Re-read any that seem wrong. ' +
        '4. Every hole must have yardage values for every tee. Fill in any missing yardages. ' +
        'Return the fully corrected data.',
        apiKey
      );
      console.log('Pass 3 done:', Date.now() - t0, 'ms');

      const result = toSchema(validated);
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
