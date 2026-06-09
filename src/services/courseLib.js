// ─── courseLib.js ─────────────────────────────────────────────────────────────
// Course library: CRUD, AI-powered search & scorecard parsing, pre-loaded data.
//
// Course schema:
//   {
//     id, name, location,
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
//     nineComboNames?: [string],  // 3-nine courses only: the three 18-hole combo labels
//                                 // in card order (e.g. ['South/North','North/East','East/South'])
//                                 // Used by CourseCard to display combo yardages correctly.
//                                 // Omit for 18-hole courses.
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
   * now has (e.g. women's ratings, nineYards added in a later build).
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
      for (const field of ['location']) {
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
    return [...this._load()].sort((a, b) => {
      const sa = a.starred ? 0 : 1, sb = b.starred ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return (a.name || '').localeCompare(b.name || '');
    });
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

async function aiCall(messages, maxTokens = 2000) {
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

// ─── aiSearchCourses ──────────────────────────────────────────────────────────

export async function aiSearchCourses(query) {
  const text = await aiCall([{
    role:    'user',
    content:
    `You are a golf course database. Return ONLY valid JSON (no markdown) for golf courses matching: "${query}"\n\n` +
    `Format:\n` +
    `{\n` +
    `  "courses": [{\n` +
    `    "name": "Full Course Name",\n` +
    `    "location": "City, State",\n` +
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
    `- nineYards: one yardage total per nine (e.g. [3375, 3065] for front+back). totalYards = sum of nineYards\n` +
    `- For 3-nine courses nineYards has 3 entries; totalYards reflects the primary 18-hole combo\n` +
    `- Use real, accurate data for known courses. If data is uncertain, omit that field rather than guess.\n` +
    `- Return up to 3 matching courses if multiple results are plausible`
  }], 3000);
  return extractJSON(text);
}

// ─── aiParseScorecard ─────────────────────────────────────────────────────────

/** Resize a base64 image to max 1400px on the long edge via canvas. */
async function resizeImage(b64, mediaType) {
  const mt = ['image/jpeg','image/png','image/gif','image/webp'].includes(mediaType)
    ? mediaType : 'image/jpeg';
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1400 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width  = Math.round(img.width  * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL('image/jpeg', 0.85).split(',')[1]);
    };
    img.onerror = () => res(b64);
    img.src = `data:${mt};base64,${b64}`;
  });
}

/**
 * Parse a golf scorecard from one, two, or three photos.
 * photos: [{ b64, mediaType }]
 * Returns a course object matching the courseLib schema (minus id).
 */
export async function aiParseScorecard(photos) {
  const resized = await Promise.all(
    photos.map(p => resizeImage(p.b64, p.mediaType))
  );

  const imageBlocks = resized.map(data => ({
    type:   'image',
    source: { type: 'base64', media_type: 'image/jpeg', data },
  }));

  const prompt =
    `You are looking at ${photos.length} photo${photos.length > 1 ? 's' : ''} of a golf scorecard.\n` +
    `Extract ALL available data from the image(s). Typical scorecard layout:\n` +
    `- Ratings panel: tee box names, men's course rating & slope, women's course rating & slope, nine/total yardages per tee\n` +
    `- Holes panel: par by hole (men's, and women's if different), men's stroke index, women's stroke index\n\n` +
    `Return ONLY valid JSON (no markdown) in exactly this format:\n` +
    `{\n` +
    `  "courseName": "Full Course Name",\n` +
    `  "location": "City, State",\n` +
    `  "nines": [\n` +
    `    {\n` +
    `      "name": "Front",\n` +
    `      "pars":           [4,4,3,5,4,3,4,5,4],\n` +
    `      "parsWomen":      [4,4,3,5,4,3,4,5,5],\n` +
    `      "handicaps":      [7,11,15,1,5,17,3,9,13],\n` +
    `      "handicapsWomen": [6,10,14,2,4,18,4,8,12]\n` +
    `    }\n` +
    `  ],\n` +
    `  "tees": [\n` +
    `    {\n` +
    `      "name": "Blue",\n` +
    `      "rating":  72.1,\n` +
    `      "slope":   131,\n` +
    `      "ratingW": 75.2,\n` +
    `      "slopeW":  128,\n` +
    `      "nineYards": [3375, 3065],\n` +
    `      "totalYards": 6440\n` +
    `    }\n` +
    `  ]\n` +
    `}\n\n` +
    `Important rules:\n` +
    `- Each nine must have exactly 9 values in pars and handicaps arrays\n` +
    `- Stroke index values are unique 1-18 across all nines combined (not 1-9 per nine)\n` +
    `- parsWomen and handicapsWomen: omit if identical to men's values, otherwise include\n` +
    `- nineYards: one OUT total per nine in order (e.g. [3375, 3065] for front+back 18-hole card)\n` +
    `- totalYards: the printed 18-hole total; must equal sum of nineYards for standard 2-nine courses\n` +
    `- For 3-nine courses, nineYards has 3 entries and totalYards reflects the primary combo on the card\n` +
    `- DO NOT attempt to read per-hole yardages — nine totals and 18-hole total only\n` +
    `- Include ALL tee boxes visible on the scorecard\n` +
    `- If a value is not legible, omit that field entirely rather than guessing\n` +
    `- Preserve exact tee names as printed on the scorecard`;

  const text = await aiCall([{
    role:    'user',
    content: [...imageBlocks, { type: 'text', text: prompt }],
  }], 3000);

  return extractJSON(text);
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
