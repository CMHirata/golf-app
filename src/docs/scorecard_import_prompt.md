# Scorecard Import Prompt

Use this prompt with any AI (ChatGPT, Gemini, Claude) that supports image uploads.
Upload ALL photos of the scorecard (scoring grid + cover/ratings page if separate), then send this prompt:

---

You are analyzing a golf scorecard image. Extract all data and return a single JSON object. Do not include any explanation, markdown, or code fences — just the raw JSON.

**Example for an 18-hole course (2 nines):**
```json
{
  "courseName": "Waiehu Municipal Golf Course",
  "location": "Wailuku, HI",
  "nines": [
    {
      "name": "Front",
      "pars": [5,3,4,5,3,4,5,3,4],
      "handicaps": [9,13,17,5,3,11,1,15,7],
      "handicapsWomen": [7,17,11,1,3,13,5,15,9]
    },
    {
      "name": "Back",
      "pars": [4,4,4,4,4,4,3,5,4],
      "handicaps": [14,10,18,6,2,12,16,4,8],
      "handicapsWomen": [10,4,16,6,2,14,18,12,8]
    }
  ],
  "tees": [
    {
      "name": "White",
      "rating": 70.5,
      "slope": 123,
      "ratingW": 77.1,
      "slopeW": 135,
      "nineYards": [3530, 2800],
      "totalYards": 6330
    },
    {
      "name": "Red",
      "rating": 66.3,
      "slope": 114,
      "ratingW": 71.4,
      "slopeW": 122,
      "nineYards": [2762, 2716],
      "totalYards": 5478
    }
  ]
}
```

**Example for a 27-hole course (3 nines) with women's par:**
```json
{
  "courseName": "Sahalee Country Club",
  "location": "Sammamish, WA",
  "nines": [
    {
      "name": "South",
      "pars": [4,5,4,4,3,5,4,4,3],
      "parsWomen": [5,5,4,4,3,5,4,4,3],
      "handicaps": [5,1,4,6,9,3,7,2,8],
      "handicapsWomen": [4,2,5,6,8,1,7,3,9]
    },
    {
      "name": "North",
      "pars": [4,5,4,3,4,4,4,3,5],
      "handicaps": [5,1,2,9,6,4,7,8,3]
    },
    {
      "name": "East",
      "pars": [5,4,4,3,5,4,4,3,4],
      "handicaps": [1,3,7,8,2,6,5,9,4]
    }
  ],
  "tees": [
    {
      "name": "Black",
      "rating": 74.0,
      "slope": 138,
      "nineYards": [3505, 3502, 3471],
      "totalYards": 10478
    }
  ]
}
```

**Rules:**

NINES:
- One entry per nine-hole panel, left to right as printed
- Use names printed on card (Front/Back, South/North/East, etc.). If none printed, use Front/Back
- "pars" — exactly 9 values, never include OUT/IN/TOT totals
- "parsWomen" — only include if women's par differs from men's on any hole. If card shows "5/4", women=5, men=4
- "handicaps" — men's stroke index, exactly 9 unique values
- "handicapsWomen" — only include if a separate women's HCP row exists

TEES:
- One entry per tee, top to bottom as printed. Combo tees (e.g. "Blue/White") are valid
- "rating"/"slope" = men's. "ratingW"/"slopeW" = women's, omit if not on card
- "nineYards" — one subtotal per nine (matching nines array order)
- "totalYards" — must equal sum of nineYards

BEFORE OUTPUTTING, verify:
- Each pars array has exactly 9 values summing to 27-40
- Each handicaps array has exactly 9 unique values
- totalYards equals sum of nineYards
- "nineComboNames" — for 27-hole courses only, include the three 18-hole combination names in the order shown on the card (e.g. ["South/North", "North/East", "East/South"]). Omit for 18-hole courses.
- All numbers are numbers not strings
- Do not guess — omit any field you cannot read clearly
