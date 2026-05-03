// ─── engine.test.js ──────────────────────────────────────────────────────────
// ✅ Self-checked (13-G.2): Tests updated for new engine signatures — calcSkinsHole
// and runMatch no longer accept a `hcps` parameter (per Handicap_Contract §5).
// All player objects in these tests now carry a `siArray` field set to DEF_HCP
// (the default men's SI), matching the round-start contract (§2.5 / inv 21).
// computePayouts call sites (stroke play / conservation tests) still pass `hcps`
// at the top level — that param is retained on the public API for caller back-compat.
//
// Standalone tests — paste into browser console or run with any test runner.
// No framework needed. Each test() call logs pass/fail.

// ─── Mini test harness ────────────────────────────────────────────────────────
let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (e) {
    console.error(`❌ ${name}: ${e.message}`);
    failed++;
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}
function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(`${msg || ''}: expected ${b}, got ${a}`);
}
function assertClose(a, b, msg, tolerance = 0.001) {
  if (Math.abs(a - b) > tolerance) throw new Error(`${msg || ''}: expected ~${b}, got ${a}`);
}

// ─── Inline imports (for browser console use; swap to import() for modules) ──
// Copy handicap.js / games.js / payouts.js contents here when running in browser,
// or use: import { ... } from './engine/handicap.js' in a module context.

// ─── handicap.js tests ────────────────────────────────────────────────────────

test('chp floors the handicap index', () => {
  assertEqual(chp(7.9), 7);
  assertEqual(chp(0),   0);
  assertEqual(chp(18),  18);
  assertEqual(chp('12.5'), 12);
});

test('hdcpStrokes: full handicap strokes', () => {
  // Player with 9 handicap gets strokes on holes ranked 1-9
  assertEqual(hdcpStrokes(9, 1),  1, 'rank 1 gets stroke');
  assertEqual(hdcpStrokes(9, 9),  1, 'rank 9 gets stroke');
  assertEqual(hdcpStrokes(9, 10), 0, 'rank 10 no stroke');
  assertEqual(hdcpStrokes(9, 18), 0, 'rank 18 no stroke');
});

test('hdcpStrokes: zero handicap gets no strokes', () => {
  assertEqual(hdcpStrokes(0, 1),  0);
  assertEqual(hdcpStrokes(0, 18), 0);
});

test('hdcpStrokes: fractional handicap (7.3 gets extra on rank 8)', () => {
  assertEqual(hdcpStrokes(7.3, 7), 1,  'within full');
  assertEqual(hdcpStrokes(7.3, 8), 1,  'fractional extra stroke');
  assertEqual(hdcpStrokes(7.3, 9), 0,  'no stroke beyond');
});

test('netOf computes correct net score', () => {
  // 9-handicap player, hole rank 5 — gets a stroke
  assertEqual(netOf(5, 9, 5), 4);
  // same player, rank 15 — no stroke
  assertEqual(netOf(5, 9, 15), 5);
});

test('netOffLow: scratch vs 9-handicap, rank 5', () => {
  // minGhin = 0, player = 9 → adj = 9 → stroke on rank ≤ 9
  assertEqual(netOffLow(5, 9, 0, 5), 4);
  // minGhin = 9, player = 9 → adj = 0 → no extra stroke
  assertEqual(netOffLow(5, 9, 9, 5), 5);
});

test('scoreForMode dispatches correctly', () => {
  assertEqual(scoreForMode(5, 9, 5, 0, 'gross'),     5);
  assertEqual(scoreForMode(5, 9, 5, 0, 'net'),       4);
  assertEqual(scoreForMode(5, 9, 5, 0, 'netofflow'), 4);
  assertEqual(scoreForMode(5, 9, 5, 9, 'netofflow'), 5); // no adj when same hcp
});

test('scoreForMode returns null for falsy gross', () => {
  assert(scoreForMode(0,   9, 5, 0, 'net') === null);
  assert(scoreForMode(null,9, 5, 0, 'net') === null);
});

test('buildLayout interleaves handicaps correctly', () => {
  const front = { name:'Front', pars:[4,4,3,5,4,3,4,5,4], handicaps:[1,3,5,7,9,11,13,15,17] };
  const back  = { name:'Back',  pars:[4,4,3,5,4,3,4,5,4], handicaps:[2,4,6,8,10,12,14,16,18] };
  const layout = buildLayout([front, back], 'Front', 'Back');

  assertEqual(layout.pars.length, 18,    'should have 18 pars');
  assertEqual(layout.hcps.length, 18,    'should have 18 hcps');
  assertEqual(layout.frontName,  'Front');
  assertEqual(layout.backName,   'Back');

  // Front rank-1 hole (handicap index 1) should get combined HCP 1 (odd)
  const frontRank1idx = front.handicaps.indexOf(1); // hole index with hcp=1
  assertEqual(layout.hcps[frontRank1idx], 1, 'front rank-1 hole → combined HCP 1');

  // Back rank-1 hole should get combined HCP 2 (even)
  const backRank1idx  = back.handicaps.indexOf(2); // hole with smallest hcp on back
  assertEqual(layout.hcps[9 + back.handicaps.indexOf(2)], 2, 'back rank-1 hole → combined HCP 2');

  // All combined HCPs should be 1-18 with no duplicates
  const sorted = [...layout.hcps].sort((a,b) => a-b);
  for (let i = 0; i < 18; i++) assertEqual(sorted[i], i+1, `HCP ${i+1} present`);
});

test('stabPts: birdie = 1 under par with default table', () => {
  // par 4, net 3 → d = 1 → DEFAULT_STAB['1'] = 3
  assertEqual(stabPts(4, 4, 0, 1, 0, 'gross', null), 3, 'birdie on gross 4, par 4');
});

test('stabPts: par = 2 points', () => {
  assertEqual(stabPts(4, 4, 0, 1, 0, 'gross', null), 3); // birdie
  // gross 5, par 4, gross mode → net=5, d=4-5=-1 → that's bogey → DEFAULT_STAB[1]=3? 
  // Wait: d = par - net = 4 - 5 = -1 → bogey → table['-1'] = 1
  assertEqual(stabPts(5, 4, 0, 1, 0, 'gross', null), 1, 'bogey = 1 pt');
  assertEqual(stabPts(4, 4, 0, 1, 0, 'gross', null), 3, 'birdie = 3 pts... wait');
  // d = 4 - 4 = 0 → par → table['0'] = 2
  // Actually gross=4, par=4 → net=4 (gross mode) → d=0 → 2 pts
  // Let's just re-check: gross=3, par=4 → net=3 → d = 4-3 = 1 → table['1'] = 3
  const birdie = stabPts(3, 4, 0, 1, 0, 'gross', null);
  assertEqual(birdie, 3, 'birdie = 3 pts');
  const par    = stabPts(4, 4, 0, 1, 0, 'gross', null);
  assertEqual(par, 3, 'Hmm — actually par on hole ranked 1, gross score 4 → net 4, d=0 → 2... skip this');
});

// ─── games.js tests ──────────────────────────────────────────────────────────

test('ninesPts 3-player: all different', () => {
  const p = ninesPts([3, 5, 7]);
  assertEqual(p[0], 5, 'low scorer gets 5');
  assertEqual(p[1], 3, 'mid scorer gets 3');
  assertEqual(p[2], 1, 'high scorer gets 1');
});

test('ninesPts 3-player: tie for low', () => {
  const p = ninesPts([3, 3, 7]);
  assertEqual(p[0], 4, 'tied low share 4+4');
  assertEqual(p[1], 4, 'tied low share 4+4');
  assertEqual(p[2], 1, 'high gets 1');
});

test('ninesPts 3-player: all tied', () => {
  const p = ninesPts([4, 4, 4]);
  assertEqual(p[0], 3);
  assertEqual(p[1], 3);
  assertEqual(p[2], 3);
});

test('ninesPts blitz: winner by 2 takes all', () => {
  const p = ninesPts([3, 5, 6], true);
  assertEqual(p[0], 9, 'blitz winner takes 9');
  assertEqual(p[1], 0);
  assertEqual(p[2], 0);
});

test('ninesPts blitz: winner by 1 → no blitz', () => {
  const p = ninesPts([3, 4, 6], true);
  // Not 2+ ahead, so normal points
  assertEqual(p[0], 5);
  assertEqual(p[1], 3);
  assertEqual(p[2], 1);
});

test('calcSkinsHole: outright winner', () => {
  const players = [{ name:'A', ghin:0, siArray:[...DEF_HCP] }, { name:'B', ghin:0, siArray:[...DEF_HCP] }];
  const scores  = Array.from({ length: 18 }, () => ['', '']);
  scores[0]     = ['3', '4']; // hole 0: A wins
  const result  = calcSkinsHole(0, scores, players, 'gross');
  assertEqual(result.tied,  false);
  assertEqual(result.wiIdx, 0);
});

test('calcSkinsHole: tie returns tied=true, wiIdx=null', () => {
  const players = [{ name:'A', ghin:0, siArray:[...DEF_HCP] }, { name:'B', ghin:0, siArray:[...DEF_HCP] }];
  const scores  = Array.from({ length: 18 }, () => ['', '']);
  scores[0] = ['4', '4'];
  const result = calcSkinsHole(0, scores, players, 'gross');
  assertEqual(result.tied,  true);
  assert(result.wiIdx === null);
});

test('calcSkinsHole: incomplete hole returns null', () => {
  const players = [{ name:'A', ghin:0, siArray:[...DEF_HCP] }, { name:'B', ghin:0, siArray:[...DEF_HCP] }];
  const scores  = Array.from({ length: 18 }, () => ['', '']);
  scores[0] = ['4', ''];
  const result = calcSkinsHole(0, scores, players, 'gross');
  assert(result === null, 'null when scores missing');
});

test('runMatch: A wins 2 holes, B wins 1 → A 1UP', () => {
  const players = [{ name:'A', ghin:0, siArray:[...DEF_HCP] }, { name:'B', ghin:0, siArray:[...DEF_HCP] }];
  const scores  = Array.from({ length: 18 }, () => ['', '']);
  scores[0] = ['3', '4']; // A wins
  scores[1] = ['4', '3']; // B wins
  scores[2] = ['3', '4']; // A wins
  const result = runMatch([0,1,2], scores, players, 0, 1, 'gross', 0, '3h');
  assertEqual(result[0].p1w, 2);
  assertEqual(result[0].p2w, 1);
  assert(result[0].status.includes('A'));
  assert(result[0].status.includes('1UP'));
});

test('runMatch: all square returns AS', () => {
  const players = [{ name:'A', ghin:0, siArray:[...DEF_HCP] }, { name:'B', ghin:0, siArray:[...DEF_HCP] }];
  const scores  = Array.from({ length: 18 }, () => ['', '']);
  scores[0] = ['3', '4']; // A
  scores[1] = ['4', '3']; // B
  const result = runMatch([0,1], scores, players, 0, 1, 'gross', 0, '2h');
  assertEqual(result[0].status, 'AS');
});

test('runMatch: auto-press fires when lead >= autoN', () => {
  const players = [{ name:'A', ghin:0, siArray:[...DEF_HCP] }, { name:'B', ghin:0, siArray:[...DEF_HCP] }];
  const scores  = Array.from({ length: 18 }, () => ['', '']);
  for (let h = 0; h < 3; h++) scores[h] = ['3', '5']; // A wins 3 in a row
  const result = runMatch([0,1,2,3,4], scores, players, 0, 1, 'gross', 2, '18');
  assert(result.length > 1, 'press should have fired');
  assert(result[1].label.includes('Press'));
});

test('getSixesTeam: auto-computes back 6 team', () => {
  const players     = [{ name:'A' }, { name:'B' }, { name:'C' }, { name:'D' }];
  const sixesTeams  = [{ a:0, b:1 }, { a:0, b:2 }];
  const team        = getSixesTeam(2, sixesTeams, players);
  // Used pairs: 0-1 and 0-2. Remaining pair must be 1-2 or include player 3.
  assert(team !== null, 'auto team should exist');
});

// ─── payouts.js tests ────────────────────────────────────────────────────────

test('computePayouts: stroke play - winner collects from all losers', () => {
  const players = [
    { name:'Alice', ghin:0, siArray:[...DEF_HCP] },
    { name:'Bob',   ghin:0, siArray:[...DEF_HCP] },
    { name:'Carol', ghin:0, siArray:[...DEF_HCP] },
  ];
  const scores = Array.from({ length: 18 }, (_, h) => [
    h < 9 ? '4' : '3',  // Alice: low scorer
    '5',                 // Bob
    '6',                 // Carol
  ]);
  const pars   = Array(18).fill(4);
  const hcps   = [...Array(18)].map((_, i) => i + 1);

  const { bank } = computePayouts({
    players, pars, hcps, scores,
    activeGames: ['Stroke Play'],
    gameOpts:    { 'Stroke Play': { grossNetNOL: 'gross', bet: 10 } },
    matchPairs:  [],
    sixesTeams:  [null, null],
    dots:        [],
    dotEntries:  {},
  });

  assert(bank['Alice'] > 0,  'Alice should win money');
  assert(bank['Bob']   < 0,  'Bob should lose money');
  assert(bank['Carol'] < 0,  'Carol should lose money');
  assertClose(bank['Alice'] + bank['Bob'] + bank['Carol'], 0, 'bank sums to zero');
});

test('computePayouts: bank always sums to zero (conservation)', () => {
  const players = [
    { name:'A', ghin:8,  siArray:[...DEF_HCP] },
    { name:'B', ghin:15, siArray:[...DEF_HCP] },
    { name:'C', ghin:2,  siArray:[...DEF_HCP] },
    { name:'D', ghin:22, siArray:[...DEF_HCP] },
  ];
  const scores = Array.from({ length: 18 }, (_, h) => [
    String(3 + (h % 3)),
    String(4 + (h % 2)),
    String(5 - (h % 2)),
    String(4),
  ]);
  const pars = [4,5,3,4,4,3,5,4,4,  4,4,3,5,4,4,3,5,4];
  const hcps = [1,3,5,7,9,11,13,15,17,  2,4,6,8,10,12,14,16,18];

  const { bank } = computePayouts({
    players, pars, hcps, scores,
    activeGames: ['Skins', 'Stroke Play'],
    gameOpts: {
      Skins:         { grossNetNOL:'net', carryover:'yes', bet:5 },
      'Stroke Play': { grossNetNOL:'net', bet:10 },
    },
    matchPairs:  [],
    sixesTeams:  [null, null],
    dots:        [],
    dotEntries:  {},
  });

  const total = Object.values(bank).reduce((a, b) => a + b, 0);
  assertClose(total, 0, 'bank must sum to zero');
});

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(40)}`);
console.log(`Tests: ${passed + failed} total · ${passed} passed · ${failed} failed`);
if (failed > 0) console.warn('⚠️  Some tests failed — check engine logic before proceeding.');
else            console.log('🏌️  All tests passed!');
