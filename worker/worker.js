// Cloudflare Worker — Golf Scorecard Parser
// Uses inline base64 (no Files API) for speed, enabling 3-pass pipeline.
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
          nineYards: { type: 'array', items: { type: 'integer' } },
          totalYards: { type: 'integer' },
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

// Single Gemini generateContent call with inline base64 images
async function geminiCall(photos, prompt, apiKey) {
  const imageParts = photos.map(p => ({
    inline_data: { mime_type: p.mediaType, data: p.b64 },
  }));

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
  if (!text) throw new Error('Gemini returned no content');
  return JSON.parse(text);
}

// Convert Gemini output to courseLib schema
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
      if (Array.isArray(t.nineYards))  teeMap[t.teeName].nineYards  = t.nineYards;
      if (t.totalYards != null)        teeMap[t.teeName].totalYards = t.totalYards;
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

export default {
  async fetch(request, env) {
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
      // Pass 1 - Layout mapping
      const layout = await geminiCall(
        photos,
        'Before extracting any data, describe the layout of this scorecard. List every tee box name in the order they appear. Identify where par, handicap, and yardage rows are. Note whether men and women ratings are in separate columns. Note any combo tees. Describe the structure in detail.',
        apiKey
      );

      // Pass 2 - Full extraction using layout context
      const extracted = await geminiCall(
        photos,
        'Using this layout description as reference: ' + JSON.stringify(layout) + ' Now extract ALL data from the scorecard: course name, address, all tee ratings and slopes for men and women separately, nine yardage totals and overall total for each tee, and hole-by-hole par and handicap data for every hole.',
        apiKey
      );

      // Pass 3 - Validation and correction
      const validated = await geminiCall(
        photos,
        'Here is data extracted from this scorecard: ' + JSON.stringify(extracted) + ' Verify this data against the scorecard images: 1. Check par values are all 3, 4, or 5. 2. Check handicap values are unique from 1 to total hole count for both men and women separately. 3. Verify nine yardage totals match OUT and IN columns on the card. 4. Ensure all tee yardages are present. Return the fully corrected data.',
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
