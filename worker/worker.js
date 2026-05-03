// Cloudflare Worker — Golf Scorecard Parser
// Uploads images to Gemini Files API and runs 2-pass extraction pipeline.
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
  // Decode base64 to binary in Workers runtime (no Buffer available)
  const binary    = atob(b64);
  const bytes     = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const byteLen   = bytes.length;

  // Step 1: initiate resumable upload
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

  // Step 2: upload bytes
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
  if (!uri) throw new Error(`Files API no URI. Response: ${JSON.stringify(fileData)}`);
  return { uri, mimeType: mediaType };
}

// Single Gemini generateContent call
async function geminiCall(imageParts, prompt, apiKey) {
  const body = {
    system_instruction: { parts: [{ text: SCORECARD_SI }] },
    contents: [{ parts: [...imageParts, { text: prompt }] }],
    generationConfig: {
      temperature:        0,
      response_mime_type: 'application/json',
      response_schema:    SCORECARD_SCHEMA,
    },
  };

  const res = await fetch(
    `${BASE_URL}/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Gemini API ${res.status}: ${txt}`);
  }

  const d    = await res.json();
  const text = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) throw new Error(`Gemini returned no content`);
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

  // Build nineYards from hole yardages
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
    // CORS headers for browser requests
    const corsHeaders = {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let photos;
    try {
      const body = await request.json();
      photos = body.photos;
      if (!Array.isArray(photos) || !photos.length) throw new Error('No photos provided');
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      // Upload all images to Files API
      const fileUris = await Promise.all(
        photos.map((p, i) => uploadImage(p.b64, p.mediaType, `scorecard_${i + 1}`, apiKey))
      );

      const imageParts = fileUris.map(f => ({
        file_data: { mime_type: f.mimeType, file_uri: f.uri },
      }));

      // Pass 1 - Extract
      const extracted = await geminiCall(
        imageParts,
        'Analyze these golf scorecard images. Extract the course name, address, all tee ratings and slopes for men and women separately, and hole-by-hole par, handicap, and yardage data for every hole. Capture all yardages for every tee and all available tee sets.',
        apiKey
      );

      // Pass 2 - Validate and correct
      const validated = await geminiCall(
        imageParts,
        'Here is data extracted from this scorecard: ' + JSON.stringify(extracted) + ' Verify this data against the scorecard images: 1. For each tee, sum hole yardages and compare to OUT, IN, TOT columns. Fix any mismatches. 2. Check par values are all 3, 4, or 5. 3. Check handicap values are unique from 1 to total hole count for both men and women separately. 4. Ensure no yardages are missing. Return the fully corrected data.',
        apiKey
      );

      const result = toSchema(validated);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
