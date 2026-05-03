// ─── courseLib.js ─────────────────────────────────────────────────────────────
// Course library: CRUD, AI-powered search & scorecard parsing, pre-loaded data.
//
// Course schema:
//   {
//     id, name, location, website?,
//     nines: [{
//       name,
//       pars:            [9 numbers],  // men's par
//       parsWomen?:      [9 numbers],  // women's par (if different from men's)
//       handicaps:       [9 numbers],  // men's stroke index (unique 1-18 across nines)
//       handicapsWomen?: [9 numbers],  // women's stroke index
//     }],
//     tees: [{
//       name,
//       rating,  slope,           // men's USGA course rating & slope
//       ratingW?, slopeW?,        // women's rating & slope (omit for combo tees)
//       nineYards?: [number],     // one OUT-total per nine, in nine order
//       totalYards?,              // sum of nineYards; for 3-nine courses = primary combo
//     }],
//   }
//
// Combo tees (e.g. Blue/White) play a different tee per nine. nineYards reflects
// the actual tee played each nine. No USGA rating is issued for combo tees so
// ratingW/slopeW may be omitted from KNOWN_COURSES but can be added by the user.
//
// For 3-nine courses (e.g. Sahalee), nineYards has 3 entries — one per nine —
// so any 18-hole combo total is the sum of any two entries.

import { ls, SK, makeId } from './storage.js';

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export const courseLib = {
  /**
   * Read stored courses, backfill missing IDs, and silently upgrade any record
   * whose name matches a KNOWN_COURSE but is missing fields the known version
   * now has (e.g. women's ratings, nineYards, website added in a later build).
   *
   * ID backfill: courses saved before IDs were added to the schema get a stable
   * generated ID written back to localStorage (one-time, safe migration).
   *
   * Field upgrade rules:
   *  - Only fills ABSENT fields — never overwrites a value the user already set.
   *  - "Absent" means null, undefined, or empty array — NOT empty string or 0.
   *  - Tees merged by name: known tee fields fill matching stored tees;
   *    known tees not present in stored record are appended.
   *  - Nines merged by index: known nine fields fill missing stored nine fields.
   *  - Writes back to localStorage only when something actually changed.
   */
  _load() {
    const raw = ls.get(SK.courses) || [];
    let dirty = false;

    // ── Step 1: backfill missing IDs ──────────────────────────────────────────
    const withIds = raw.map(c => {
      if (c.id) return c;
      dirty = true;
      return { ...c, id: makeId('c') };
    });

    // ── Step 2: upgrade fields from KNOWN_COURSES ─────────────────────────────
    const upgraded = withIds.map(stored => {
      const known = KNOWN_COURSES.find(k =>
        k.name.trim().toLowerCase() === (stored.name || '').trim().toLowerCase()
      );
      if (!known) return stored;

      let changed = false;
      const out = { ...stored };

      // Top-level scalar fields
      for (const field of ['location', 'website']) {
        if (!out[field] && known[field]) { out[field] = known[field]; changed = true; }
      }

      // Nines — merge by index, fill missing array fields
      if (known.nines?.length) {
        const mergedNines = (out.nines || []).map((sn, ni) => {
          const kn = known.nines[ni];
          if (!kn) return sn;
          const nc = { ...sn };
          for (const f of ['parsWomen', 'handicaps', 'handicapsWomen']) {
            if ((!nc[f] || nc[f].length === 0) && kn[f]?.length) {
              nc[f] = kn[f]; changed = true;
            }
          }
          return nc;
        });
        // Append known nines beyond what is stored (e.g. Sahalee East nine)
        for (let i = mergedNines.length; i < known.nines.length; i++) {
          mergedNines.push({ ...known.nines[i] });
          changed = true;
        }
        out.nines = mergedNines;
      }

      // Tees — merge by name, fill absent fields, append unknown tees
      if (known.tees?.length) {
        const storedTees = (out.tees || []).map(t => ({ ...t }));
        const TEE_FIELDS = ['rating', 'slope', 'ratingW', 'slopeW', 'nineYards', 'totalYards'];

        known.tees.forEach(kt => {
          const si = storedTees.findIndex(
            st => st.name?.trim().toLowerCase() === kt.name?.trim().toLowerCase()
          );
          if (si === -1) {
            // Tee not in stored record at all — append it
            storedTees.push({ ...kt });
            changed = true;
          } else {
            // Tee exists — fill only absent fields
            TEE_FIELDS.forEach(f => {
              const v = storedTees[si][f];
              const absent = v === null || v === undefined ||
                             (Array.isArray(v) && v.length === 0);
              if (absent && kt[f] != null) {
                storedTees[si][f] = kt[f];
                changed = true;
              }
            });
          }
        });
        out.tees = storedTees;
      }

      if (changed) dirty = true;
      return out;
    });

    if (dirty) ls.set(SK.courses, upgraded);
    return upgraded;
  },

  list() {
    return this._load();
  },

  save(data) {
    // Use _load() so IDs get backfilled before we append
    const all = this._load();
    const course = { id: makeId('c'), ...data };
    all.push(course);
    ls.set(SK.courses, all);
    return course;
  },

  update(id, changes) {
    if (!id) return;
    // Read raw (not _load) so migration doesn't race with our write.
    // The migration already ran when list() last populated the UI.
    // We do need IDs to be present, so if somehow a record has no id we
    // skip it gracefully — the id backfill in _load() will fix it on next read.
    const all = ls.get(SK.courses) || [];
    const idx = all.findIndex(c => c.id === id);
    if (idx === -1) return;
    all[idx] = { ...all[idx], ...changes };
    ls.set(SK.courses, all);
    return all[idx];
  },

  delete(id) {
    if (!id) return;
    // Read raw — same reasoning as update()
    const all = ls.get(SK.courses) || [];
    ls.set(SK.courses, all.filter(c => c.id !== id));
  },
};

// ─── AI helpers ───────────────────────────────────────────────────────────────

/**
 * Anthropic transport — text-only, used by aiSearchCourses.
 */
async function aiCall(provider, messages, maxTokens = 2000) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:      'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      messages,
    }),
  });
  if (!r.ok) throw new Error(`API ${r.status}`);
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return (d.content || []).map(b => b.text || '').join('').trim();
}

function extractJSON(text) {
  let depth = 0, start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') { if (depth === 0) start = i; depth++; }
    else if (text[i] === '}') { if (--depth === 0) return JSON.parse(text.slice(start, i + 1)); }
  }
  throw new Error('No JSON found in response');
}

/**
 * Server-side scorecard parser via Netlify Function.
 * Images are uploaded to Gemini Files API server-side — full resolution,
 * no base64 bloat in the request, API key never exposed to the browser.
 *
 * Endpoint: /.netlify/functions/parse-scorecard
 * POST { photos: [{ b64, mediaType }] }
 * Returns courseLib-compatible { courseName, location, nines, tees }
 *
 * Falls back to direct Gemini call if running locally without Netlify
 * (i.e. when window.location.hostname is localhost).
 */
async function callScorecardFunction(photos) {
  // Resize images before sending to stay under Netlify's 6MB body limit.
  console.log('Resizing', photos.length, 'photo(s)...');
  const resized = await Promise.all(
    photos.map(async p => ({
      b64:       await resizeForUpload(p.b64, p.mediaType),
      mediaType: 'image/jpeg',
    }))
  );

  // Log approximate sizes
  resized.forEach((p, i) => {
    console.log(`Photo ${i+1} resized b64 length: ${p.b64.length} (~${Math.round(p.b64.length * 0.75 / 1024)}KB)`);
  });

  console.log('Sending to Netlify function...');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout

  try {
    const res = await fetch('/.netlify/functions/parse-scorecard', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ photos: resized }),
      signal:  controller.signal,
    });
    clearTimeout(timeout);
    console.log('Function responded with status:', res.status);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || `Server error ${res.status}`);
    }

    return res.json();
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') throw new Error('Request timed out after 60s');
    throw e;
  }
}

/**
 * Gemini 2.5 Flash direct call — used as local dev fallback only.
 * Auth: SK.geminiKey from localStorage.
 */
async function geminiVisionCall(parts, { systemInstruction = '', jsonMode = false, jsonSchema = null } = {}) {
  const key = ls.get(SK.geminiKey);
  if (!key) throw new Error('GEMINI_NO_KEY');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`;

  const body = {
    ...(systemInstruction ? {
      system_instruction: { parts: [{ text: systemInstruction }] },
    } : {}),
    contents: [{ parts }],
    generationConfig: {
      temperature: 0,
      ...(jsonMode   ? { response_mime_type: 'application/json' } : {}),
      ...(jsonSchema ? { response_schema: jsonSchema }            : {}),
    },
  };

  const r = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  if (r.status === 401 || r.status === 403) throw new Error('GEMINI_AUTH_FAILURE');
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini API ${r.status}`);
  }

  const d    = await r.json();
  const text = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!text) throw new Error('Gemini returned no content');
  return text;
}

/**
 * Resize image to max 2048px on longest edge at 0.85 JPEG quality.
 * Keeps detail high enough for Gemini OCR while staying under Netlify's
 * 6MB function body limit (two photos ~1-2MB each after resize).
 */
function resizeForUpload(b64, mediaType) {
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1200;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      res(canvas.toDataURL('image/jpeg', 0.75).split(',')[1]);
    };
    img.onerror = () => res(b64); // fallback to original on error
    img.src = `data:${mediaType};base64,${b64}`;
  });
}

/** Build image parts for direct Gemini calls (local dev fallback). */
function makeImageParts(photos) {
  return photos.map(p => ({
    inline_data: { mime_type: p.mediaType, data: p.b64 },
  }));
}

// ─── aiSearchCourses ──────────────────────────────────────────────────────────

export async function aiSearchCourses(query) {
  const text = await aiCall('anthropic', [{
    role:    'user',
    content:
    `You are a golf course database. Return ONLY valid JSON (no markdown) for golf courses matching: "${query}"\n\n` +
    `Format:\n` +
    `{\n` +
    `  "courses": [{\n` +
    `    "name": "Full Course Name",\n` +
    `    "location": "City, State",\n` +
    `    "website": "https://...",\n` +
    `    "nines": [\n` +
    `      {\n` +
    `        "name": "Front",\n` +
    `        "pars":           [4,4,3,5,4,3,4,5,4],\n` +
    `        "parsWomen":      [4,4,3,5,4,3,4,5,5],\n` +
    `        "handicaps":      [7,11,15,1,5,17,3,9,13],\n` +
    `        "handicapsWomen": [6,10,14,2,4,18,4,8,12]\n` +
    `      }\n` +
    `    ],\n` +
    `    "tees": [\n` +
    `      {\n` +
    `        "name": "Blue",\n` +
    `        "rating":  72.1,\n` +
    `        "slope":   131,\n` +
    `        "ratingW": 74.5,\n` +
    `        "slopeW":  128,\n` +
    `        "nineYards": [3375, 3065],\n` +
    `        "totalYards": 6440\n` +
    `      }\n` +
    `    ]\n` +
    `  }]\n` +
    `}\n\n` +
    `Rules:\n` +
    `- Each nine has exactly 9 pars (values 3/4/5/6) and 9 stroke index values (unique 1-18 across all nines combined)\n` +
    `- Include ALL available tee boxes with accurate USGA/R&A ratings and slopes\n` +
    `- Include women's ratings/slopes wherever the tee is available to women\n` +
    `- parsWomen and handicapsWomen may be omitted if identical to men's values\n` +
    `- nineYards: one yardage total per nine. totalYards = sum of nineYards\n` +
    `- For 3-nine courses nineYards has 3 entries; totalYards reflects the primary 18-hole combo\n` +
    `- Use real, accurate data for known courses. If data is uncertain, omit that field rather than guess.\n` +
    `- Return up to 3 matching courses if multiple results are plausible`
  }], 3000);
  return extractJSON(text);
}

// ─── aiParseScorecard ─────────────────────────────────────────────────────────

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
          holeNumber:   { type: 'integer' },
          par:          { type: 'integer' },
          handicapMen:  { type: 'integer' },
          handicapWomen:{ type: 'integer' },
        },
        required: ['holeNumber', 'par'],
      },
    },
  },
  required: ['courseName', 'address', 'tees', 'holes'],
};

// Prompt proven working in AI Studio (Fairway Analytics).
const SCORECARD_PROMPT =
  'Analyze these images of a golf scorecard (front and back). ' +
  'Extract the following information: ' +
  '1. Course Name and Address. ' +
  '2. Hole numbers, par for each hole, and handicaps (Mens and Womens where available). ' +
  '3. All tees listed, including their color/name, and the Rating and Slope for both men and women if specified. ' +
  'Capture every hole (usually 1-18) and all available tee sets.';

/**
 * Convert Fairway Analytics schema → courseLib nines/tees schema.
 * Tees come in as separate Men/Women entries — merge them into combined objects.
 */
function fairwayToSchema(d) {
  if (!d || !Array.isArray(d.holes)) throw new Error('Invalid response shape');

  // Sort holes and group into nines
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

  // Merge Men/Women tee entries into combined tee objects
  const teeMap = {};
  for (const t of (d.tees || [])) {
    const key = t.teeName;
    if (!teeMap[key]) teeMap[key] = { name: key };
    if (t.gender === 'Men' || t.gender === 'Unspecified') {
      teeMap[key].rating = t.rating;
      teeMap[key].slope  = t.slope;
    }
    if (t.gender === 'Women') {
      teeMap[key].ratingW = t.rating;
      teeMap[key].slopeW  = t.slope;
    }
  }
  const tees = Object.values(teeMap);

  return {
    courseName: d.courseName || 'Imported Course',
    location:   d.address    || '',
    nines,
    tees,
  };
}

/**
 * Parse a golf scorecard from one, two, or three photos.
 * photos: [{ b64, mediaType }]
 * Returns a course object matching the courseLib schema (minus id).
 */
export async function aiParseScorecard(photos, onProgress) {
  onProgress?.('Reading scorecard…');
  // Always use Netlify Function — handles Files API upload server-side.
  // For local dev, run 'netlify dev' to proxy the function locally.
  return callScorecardFunction(photos);
}

// ─── Course comparison utilities ──────────────────────────────────────────────
// Pure data functions — no React, no rendering.
// Used by CourseMergeModal (merge UI), CourseSearchModal (duplicate detection),
// and CoursesPage (incoming-course dedup check).

/** Normalise a course name for fuzzy comparison. */
export function normCourseName(n) {
  return (n || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Fuzzy-match two course names — returns true if likely the same course. */
export function likelySameCourse(a, b) {
  const na = normCourseName(a), nb = normCourseName(b);
  if (na === nb) return true;
  // One contains the other (handles "Fircrest" vs "Fircrest Golf Club")
  if (na.includes(nb) || nb.includes(na)) return true;
  // Word-level: ≥60% overlap
  const wa = new Set(na.split(/\s+/)), wb = new Set(nb.split(/\s+/));
  const shared = [...wa].filter(w => wb.has(w)).length;
  return shared / Math.max(wa.size, wb.size) >= 0.6;
}

/** Deep-compare two courses and return an array of difference descriptors. */
export function diffCourses(existing, incoming) {
  const diffs = [];

  // Location
  if ((existing.location || '') !== (incoming.location || '') && (incoming.location || '')) {
    diffs.push({ field: 'location', label: 'Location', old: existing.location || '—', neu: incoming.location });
  }

  // Tees — compare by matching tee names
  const existTeeMap = Object.fromEntries((existing.tees || []).map(t => [t.name?.toLowerCase(), t]));
  const incomTeeMap = Object.fromEntries((incoming.tees || []).map(t => [t.name?.toLowerCase(), t]));
  const allTeeNames = new Set([...Object.keys(existTeeMap), ...Object.keys(incomTeeMap)]);

  for (const tn of allTeeNames) {
    const et = existTeeMap[tn], it = incomTeeMap[tn];
    if (!et && it) {
      diffs.push({ field: `tee_new_${tn}`, label: `Tee "${it.name}"`, old: '—', neu: `Rating ${it.rating}/${it.slope}` });
    } else if (et && it) {
      if (et.rating !== it.rating || et.slope !== it.slope) {
        diffs.push({ field: `tee_${tn}`, label: `${et.name} (Men's)`, old: `${et.rating}/${et.slope}`, neu: `${it.rating}/${it.slope}` });
      }
      if ((et.ratingW || it.ratingW) && (et.ratingW !== it.ratingW || et.slopeW !== it.slopeW)) {
        diffs.push({ field: `teeW_${tn}`, label: `${et.name} (Women's)`, old: `${et.ratingW||'—'}/${et.slopeW||'—'}`, neu: `${it.ratingW||'—'}/${it.slopeW||'—'}` });
      }
      const etTotal = et.totalYards || (et.nineYards?.reduce((a,b)=>a+b,0));
      const itTotal = it.totalYards || (it.nineYards?.reduce((a,b)=>a+b,0));
      if (itTotal && etTotal !== itTotal) {
        diffs.push({ field: `yards_${tn}`, label: `${et.name} Yardage`, old: etTotal ? `${etTotal} yds` : '—', neu: `${itTotal} yds` });
      }
    }
  }

  // Pars / handicaps per nine
  (incoming.nines || []).forEach((inNine, ni) => {
    const exNine = (existing.nines || [])[ni];
    if (!exNine) {
      diffs.push({ field: `nine_${ni}`, label: `Nine "${inNine.name}"`, old: '—', neu: `Par ${inNine.pars?.reduce((a,b)=>a+b,0)}` });
      return;
    }
    const parDiff = inNine.pars?.some((p, i) => p !== (exNine.pars||[])[i]);
    if (parDiff) diffs.push({ field: `par_${ni}`, label: `${inNine.name} Pars`, old: (exNine.pars||[]).join('-'), neu: (inNine.pars||[]).join('-') });
    const hcpDiff = inNine.handicaps?.some((h, i) => h !== (exNine.handicaps||[])[i]);
    if (hcpDiff) diffs.push({ field: `hcp_${ni}`, label: `${inNine.name} M-Handicaps`, old: (exNine.handicaps||[]).join('-'), neu: (inNine.handicaps||[]).join('-') });
    const hcpWDiff = inNine.handicapsWomen?.some((h, i) => h !== (exNine.handicapsWomen||[])[i]);
    if (hcpWDiff) diffs.push({ field: `hcpw_${ni}`, label: `${inNine.name} W-Handicaps`, old: (exNine.handicapsWomen||[]).join('-') || '—', neu: (inNine.handicapsWomen||[]).join('-') });
  });

  return diffs;
}

// ─── Pre-loaded known courses ─────────────────────────────────────────────────
// Data verified from physical scorecards (April 2026).
// Fircrest: IMG_3307 (ratings), IMG_3308 (holes/yardages)
// Sahalee:  IMG_3254 (ratings/yardage totals), IMG_3253 (hole-by-hole grids)
//
// Note on combo tees (Blue/White, White/Green): no USGA women's rating is
// officially issued for combo tees, so ratingW/slopeW are absent here.
// Users may add them manually via the Edit screen — those values are preserved.

export const KNOWN_COURSES = [
  {
    name:     'Fircrest Golf Club',
    location: 'Fircrest, WA',
    website:  'https://www.fircrestgolfclub.org',
    // Women's par differs: front holes 2 & 5; back holes 14 & 15.
    nines: [
      {
        name:           'Front',
        pars:           [5, 4, 3, 4, 4, 4, 5, 3, 4],   // M OUT=36
        parsWomen:      [5, 5, 3, 4, 5, 4, 5, 3, 4],   // W OUT=38
        handicaps:      [15, 3, 9, 11, 1, 7, 13, 17, 5],
        handicapsWomen: [3, 11, 13, 1, 15, 7, 9, 17, 5],
      },
      {
        name:           'Back',
        pars:           [5, 4, 4, 3, 4, 4, 3, 4, 4],   // M IN=35  Total M=71
        parsWomen:      [5, 4, 4, 3, 5, 5, 3, 4, 4],   // W IN=37  Total W=75
        handicaps:      [16, 4, 8, 18, 10, 2, 14, 6, 12],
        handicapsWomen: [6, 10, 16, 18, 2, 12, 14, 4, 8],
      },
    ],
    // Blue/White: Front=Blue (3375), Back=White (2895) = 6240 total.
    // White/Green: Front=White (3090), Back=Green (2410) = 5465 total.
    tees: [
      { name:'Black',       rating:72.2, slope:134, ratingW:78.4, slopeW:142, nineYards:[3530, 3165], totalYards:6695 },
      { name:'Blue',        rating:71.0, slope:131, ratingW:76.8, slopeW:139, nineYards:[3375, 3065], totalYards:6440 },
      { name:'Blue/White',  rating:70.0, slope:129,                           nineYards:[3375, 2895], totalYards:6240 },
      { name:'White',       rating:68.7, slope:124, ratingW:74.5, slopeW:133, nineYards:[3090, 2895], totalYards:5985 },
      { name:'White/Green', rating:66.2, slope:121,                           nineYards:[3090, 2410], totalYards:5465 },
      { name:'Green',       rating:64.1, slope:114, ratingW:69.3, slopeW:122, nineYards:[2635, 2410], totalYards:5045 },
    ],
  },

  {
    name:     'Sahalee Country Club',
    location: 'Sammamish, WA',
    website:  'https://www.sahalee.com',
    // Three nines. Stroke index restarts 1-9 per nine (USGA 27-hole standard).
    nines: [
      {
        name:           'South',
        pars:           [4, 5, 4, 4, 3, 5, 4, 4, 3],   // OUT=36
        handicaps:      [5, 1, 4, 6, 9, 3, 7, 2, 8],
        handicapsWomen: [4, 2, 5, 6, 8, 1, 7, 3, 9],
      },
      {
        name:           'North',
        pars:           [4, 5, 4, 4, 4, 4, 4, 3, 4],   // OUT=36
        handicaps:      [5, 1, 9, 3, 6, 4, 7, 8, 2],
        handicapsWomen: [5, 1, 9, 6, 3, 7, 8, 2, 4],
      },
      {
        name:           'East',
        pars:           [5, 4, 4, 3, 5, 4, 4, 3, 4],   // OUT=36
        handicaps:      [1, 3, 7, 8, 2, 6, 5, 9, 4],
        handicapsWomen: [1, 5, 7, 8, 2, 6, 3, 9, 4],
      },
    ],
    // nineYards: [South, North, East] — sum any two for any 18-hole combo total.
    // totalYards = South+North (primary championship routing).
    // Women's ratings available for White/Gold/Green only (not printed for Black/Blue).
    tees: [
      { name:'Black', rating:74.6, slope:138,                           nineYards:[3505, 3502, 3471], totalYards:7007 },
      { name:'Blue',  rating:73.2, slope:136,                           nineYards:[3358, 3341, 3364], totalYards:6699 },
      { name:'White', rating:71.4, slope:133, ratingW:76.6, slopeW:140, nineYards:[3151, 3133, 3147], totalYards:6284 },
      { name:'Gold',  rating:69.0, slope:129, ratingW:74.0, slopeW:132, nineYards:[2895, 2930, 2891], totalYards:5815 },
      { name:'Green', rating:66.6, slope:125, ratingW:72.0, slopeW:127, nineYards:[2703, 2689, 2704], totalYards:5392 },
    ],
  },
];
