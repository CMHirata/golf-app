// netlify/functions/parse-scorecard.js
//
// Server-side Gemini scorecard parser.
// Accepts POST { photos: [{ b64, mediaType }] }
// Uploads each image to Gemini Files API, then extracts scorecard data.
// GEMINI_API_KEY must be set in Netlify environment variables.

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const MODEL      = 'gemini-2.5-flash';
const BASE_URL   = 'https://generativelanguage.googleapis.com';

// ── Upload one image to Gemini Files API ──────────────────────────────────────

async function uploadToFilesAPI(b64, mediaType, displayName) {
  const imageBytes = Buffer.from(b64, 'base64');
  const byteLength = imageBytes.length;

  // Step 1: initiate resumable upload
  const initRes = await fetch(
    `${BASE_URL}/upload/v1beta/files?key=${GEMINI_KEY}`,
    {
      method:  'POST',
      headers: {
        'X-Goog-Upload-Protocol':              'resumable',
        'X-Goog-Upload-Command':               'start',
        'X-Goog-Upload-Header-Content-Type':   mediaType,
        'X-Goog-Upload-Header-Content-Length': byteLength.toString(),
        'Content-Type':                        'application/json',
      },
      body: JSON.stringify({ file: { display_name: displayName } }),
    }
  );

  if (!initRes.ok) {
    const txt = await initRes.text();
    throw new Error(`Files API init failed (${initRes.status}): ${txt}`);
  }

  const uploadUrl = initRes.headers.get('x-goog-upload-url');
  if (!uploadUrl) throw new Error('Files API did not return upload URL');

  // Step 2: upload the image bytes
  const uploadRes = await fetch(uploadUrl, {
    method:  'POST',
    headers: {
      'Content-Type':          mediaType,
      'Content-Length':        byteLength.toString(),
      'X-Goog-Upload-Offset':  '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: imageBytes,
  });

  if (!uploadRes.ok) {
    const txt = await uploadRes.text();
    throw new Error(`Files API upload failed (${uploadRes.status}): ${txt}`);
  }

  const fileData = await uploadRes.json();
  const uri = fileData?.file?.uri;
  if (!uri) throw new Error(`Files API did not return URI. Response: ${JSON.stringify(fileData)}`);
  return { uri, mimeType: mediaType };
}

// ── Gemini generateContent ────────────────────────────────────────────────────

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
        },
        required: ['holeNumber', 'par'],
      },
    },
  },
  required: ['courseName', 'holes'],
};

async function parseWithGemini(fileUris) {
  const imageParts = fileUris.map(f => ({
    file_data: { mime_type: f.mimeType, file_uri: f.uri },
  }));

  const body = {
    system_instruction: { parts: [{ text: SCORECARD_SI }] },
    contents: [{
      parts: [
        ...imageParts,
        { text:
          'Analyze these golf scorecard images. ' +
          'Extract the course name, address, all tee ratings and slopes for men and women separately, ' +
          'and hole-by-hole par and handicap data for all holes. ' +
          'Capture every hole and all available tee sets.'
        },
      ],
    }],
    generationConfig: {
      temperature:        0,
      response_mime_type: 'application/json',
      response_schema:    SCORECARD_SCHEMA,
    },
  };

  const res = await fetch(
    `${BASE_URL}/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`,
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
  if (!text) throw new Error(`Gemini returned no content. Response: ${JSON.stringify(d)}`);
  return JSON.parse(text);
}

// ── Convert to courseLib schema ───────────────────────────────────────────────

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

  return {
    courseName: d.courseName || 'Imported Course',
    location:   d.address    || '',
    nines,
    tees: Object.values(teeMap),
  };
}

// ── Netlify handler ───────────────────────────────────────────────────────────

exports.handler = async (event) => {
  console.log('parse-scorecard invoked:', event.httpMethod);

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!GEMINI_KEY) {
    console.error('GEMINI_API_KEY not set');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'GEMINI_API_KEY not configured' }),
    };
  }

  let photos;
  try {
    const parsed = JSON.parse(event.body);
    photos = parsed.photos;
    if (!Array.isArray(photos) || !photos.length) throw new Error('No photos in request');
    console.log(`Received ${photos.length} photo(s)`);
  } catch (e) {
    console.error('Body parse error:', e.message);
    return { statusCode: 400, body: JSON.stringify({ error: e.message }) };
  }

  try {
    console.log('Uploading to Files API...');
    const fileUris = await Promise.all(
      photos.map((p, i) => uploadToFilesAPI(p.b64, p.mediaType, `scorecard_${i + 1}`))
    );
    console.log('Upload complete:', fileUris.map(f => f.uri));

    console.log('Calling Gemini...');
    const raw    = await parseWithGemini(fileUris);
    console.log('Gemini response received');

    const result = toSchema(raw);
    console.log('Conversion complete:', result.courseName);

    return {
      statusCode: 200,
      headers:    { 'Content-Type': 'application/json' },
      body:       JSON.stringify(result),
    };
  } catch (e) {
    console.error('Function error:', e.message);
    return {
      statusCode: 500,
      body:       JSON.stringify({ error: e.message }),
    };
  }
};
