// ─── services/roundLib.js ─────────────────────────────────────────────────────
// ✅ Self-checked (13-G.2): toActiveRound now attaches siArray = buildPlayerSI(p, layout)
// to each player on reload (Handicap_Contract §2.5 caller responsibility, inv 21).
// Legacy records pre-13-G.2 lacked siArray — this defensive build ensures engines
// always have a valid siArray when computePayouts runs against a reloaded round.
// Falls back to DEF_HCP if no course snapshot exists. siArray is recomputable,
// so it is NOT serialized in fromActiveRound.
//
// Round history library: save, list, update, delete completed rounds.
//
// Schema conversions:
//   fromActiveRound(ar)  — activeRound blob  → history record (for saving)
//   toActiveRound(r)     — history record    → activeRound blob (for reloading to scorecard)
//   toSetupState(r)      — history record    → NewRoundPage init state (for pre-filling setup)
//
// ✅ Self-checked (13-C.7.5 / v2.0): `earlyDepartureOpts[pi].eventOrder`
// migration added to `migrateRecord`. PartialGameContract v2.0 §4.1 / §13:
// every entry in earlyDepartureOpts gains an `eventOrder` field — 0-based
// chronological position by `departureHole` ascending; ties broken stably
// by playerIdx. v1.x history records load with `eventOrder` derived
// automatically. activeRound consumers do not rely on this migration —
// they re-derive `eventOrder` at consumption time per the project's
// established "derive at read, never trust storage" pattern (cf.
// `restoreDotDefs`, `restoreAutoWhen`).
//
// ✅ Self-checked (13-C.6): `earlyDepartureOpts` now round-trips through all
// three schema conversions. Stored as `early_departure_opts` in history
// records. Defaults to `undefined` when absent; callers (payouts.js,
// ScorecardPage, ScoreGrid) apply `?? {}` at read time. Old records without
// the field load correctly with no-departure behavior per
// PartialGameContract §4.5. NewRoundPage does not currently read this field
// from initSrc, but `toSetupState` restores it anyway so any future setup-
// time inspection has the data available — and per H-21 / invariant 16,
// adding to `fromActiveRound` and `toActiveRound` without `toSetupState`
// would be a contract violation if NewRoundPage ever started reading the
// field, so symmetry here is the safe default.
//
// ✅ Self-checked (13-C.3): `gameRanges` now round-trips through all three
// schema conversions. Stored as `game_ranges` in history records. Defaults to
// `undefined` when absent; callers (payouts.js, GameConfig, table components)
// apply `?? {}` at read time. Old records without the field load correctly
// with full-round behavior per PartialGameContract §4.5 / §13.
//
// Round record schema (stored in SK.rounds):
//   id, date, course_name, course_snapshot, front_nine, back_nine, selected_tee,
//   pars, hcps, players[{id,name,gender,ghin,courseHcpVal,selectedTee}],
//   course_hcps[], min_course_hcp, active_games[], game_opts{},
//   matches[],
//   skins_players[], stroke_play_players[], stableford_players[], nines_players[],
//   sixes_teams[], sixes_players[],
//   dots_players[], dots[], dot_entries{},   ← renamed from specials_players/specials/spec_entries in v2.0
//   scores[][], breakdown[], bank{}
//
// Legacy fields still read for backward compat:
//   match_pairs, nassau_pairs (match migration)
//   specials_players, specials, spec_entries (Dots rename migration v2.0)
//   active_games entry 'Specials' → 'Dots' (v2.0)
//   game_opts.Specials → game_opts.Dots (v2.0)
//   DotDef.pts → DotDef.value (v2.0)
//
// DATA INTEGRITY RULE (Session 1-B):
//   toActiveRound and toSetupState must NEVER read from the live player or course
//   libraries. All data must come exclusively from the stored history record.

import { ls, SK, makeId } from './storage.js';
import { buildGenderLayout, DEF_PARS, DEF_HCP, groupCourseHandicaps, buildPlayerSI } from '../engine/handicap.js';

// ─── Migration shim ────────────────────────────────────────────────────────────
function migrateRecord(r) {
  let rec = r;

  // ── Match migration (legacy match_pairs / nassau_pairs) ────────────────────
  if (rec.matches === undefined) {
    const matches = [];
    const mp = rec.match_pairs || [];
    const mpOpts = rec.game_opts?.['Match Play'] || {};
    mp.forEach(key => {
      const [i, j] = key.split('-').map(Number);
      matches.push({
        id: `mp_${key}`, format: 'individual', p1: i, p2: j,
        grossNetNOL: mpOpts.scoring || 'net', autoPress: mpOpts.autoPress || 'none',
        autoPressN: mpOpts.autoPressN || '2', betFront: 0, betBack: 0,
        betOverall: mpOpts.bet || 0,
      });
    });
    const np = rec.nassau_pairs || [];
    const nOpts = rec.game_opts?.['Nassau'] || {};
    np.forEach(key => {
      const [i, j] = key.split('-').map(Number);
      matches.push({
        id: `nau_${key}`, format: 'individual', p1: i, p2: j,
        grossNetNOL: nOpts.scoring || 'net', autoPress: nOpts.autoPress || 'none',
        autoPressN: nOpts.autoPressN || '2',
        betFront: nOpts.betFront ?? nOpts.bet ?? 0,
        betBack: nOpts.betBack ?? nOpts.bet ?? 0,
        betOverall: nOpts.betOverall ?? nOpts.bet ?? 0,
      });
    });
    let activeGames = rec.active_games || [];
    if (activeGames.includes('Match Play') || activeGames.includes('Nassau')) {
      activeGames = activeGames.filter(g => g !== 'Match Play' && g !== 'Nassau');
      if (!activeGames.includes('Match / Nassau') && matches.length > 0) {
        activeGames = ['Match / Nassau', ...activeGames];
      }
    }
    rec = { ...rec, matches, active_games: activeGames };
  }

  // ── Dots rename migration (v2.0) ───────────────────────────────────────────
  // activeGames: 'Specials' → 'Dots'
  if (rec.active_games?.includes('Specials') && !rec.active_games.includes('Dots')) {
    rec = {
      ...rec,
      active_games: rec.active_games.map(g => g === 'Specials' ? 'Dots' : g),
    };
  }

  // game_opts: Specials → Dots
  if (rec.game_opts?.Specials && !rec.game_opts?.Dots) {
    const { Specials, ...restOpts } = rec.game_opts;
    rec = { ...rec, game_opts: { ...restOpts, Dots: Specials } };
  }

  // Field renames: specials_players → dots_players, specials → dots, spec_entries → dot_entries
  if (rec.specials_players !== undefined && rec.dots_players === undefined) {
    rec = { ...rec, dots_players: rec.specials_players };
  }
  if (rec.specials !== undefined && rec.dots === undefined) {
    rec = { ...rec, dots: rec.specials };
  }
  if (rec.spec_entries !== undefined && rec.dot_entries === undefined) {
    rec = { ...rec, dot_entries: rec.spec_entries };
  }

  // Companion key segment: team_special_for → team_dot_for
  if (rec.dot_entries) {
    const entries = rec.dot_entries;
    const hasLegacy = Object.keys(entries).some(k => k.includes('team_special_for'));
    if (hasLegacy) {
      const migrated = {};
      Object.entries(entries).forEach(([key, v]) => {
        migrated[key.replace('team_special_for', 'team_dot_for')] = v;
      });
      rec = { ...rec, dot_entries: migrated };
    }
  }

  // DotDef.pts → DotDef.value (non-destructive; restoreDotDefs handles at read time,
  // but we normalise here for permanence when the record is re-saved)
  if (rec.dots?.length) {
    const needsMigration = rec.dots.some(d => d.value === undefined && d.pts !== undefined);
    if (needsMigration) {
      rec = {
        ...rec,
        dots: rec.dots.map(d =>
          d.value === undefined && d.pts !== undefined
            ? { ...d, value: d.pts }
            : d
        ),
      };
    }
  }

  // DotDef name fix: 'KP (par 3s)' → 'KP' (v2.0 label cleanup)
  if (rec.dots?.some(d => d.id === 'kp' && d.name === 'KP (par 3s)')) {
    rec = {
      ...rec,
      dots: rec.dots.map(d =>
        d.id === 'kp' && d.name === 'KP (par 3s)' ? { ...d, name: 'KP' } : d
      ),
    };
  }

  // ── betMode field renames (v2.7) ───────────────────────────────────────────
  // Stroke Play: strokeMode → betMode; 'single' → 'total'; 'nassau' → 'segments'
  const spOpts = rec.game_opts?.['Stroke Play'];
  if (spOpts && spOpts.betMode === undefined && spOpts.strokeMode !== undefined) {
    const val = spOpts.strokeMode === 'nassau' ? 'segments'
              : spOpts.strokeMode === 'single'  ? 'total'
              : 'total';
    rec = { ...rec, game_opts: { ...rec.game_opts, 'Stroke Play': { ...spOpts, betMode: val } } };
  }

  // Stableford: stabBetMode → betMode; 'nassau' → 'segments'; 'single' → 'perpoint'
  const stabOpts = rec.game_opts?.Stableford;
  if (stabOpts && stabOpts.betMode === undefined && stabOpts.stabBetMode !== undefined) {
    const val = stabOpts.stabBetMode === 'nassau' ? 'segments'
              : stabOpts.stabBetMode === 'single'  ? 'perpoint'
              : 'perpoint';
    rec = { ...rec, game_opts: { ...rec.game_opts, Stableford: { ...stabOpts, betMode: val } } };
  }

  // Nines: ninesMode → betMode; 'nassau' → 'segments'; 'single' → 'perpoint'
  const ninesOpts = rec.game_opts?.Nines;
  if (ninesOpts && ninesOpts.betMode === undefined && ninesOpts.ninesMode !== undefined) {
    const val = ninesOpts.ninesMode === 'nassau' ? 'segments'
              : ninesOpts.ninesMode === 'single'  ? 'perpoint'
              : 'perpoint';
    rec = { ...rec, game_opts: { ...rec.game_opts, Nines: { ...ninesOpts, betMode: val } } };
  }

  // Skins: carryover string → boolean ('yes' → true, 'no' → false)
  const skinsOpts = rec.game_opts?.Skins;
  if (skinsOpts && typeof skinsOpts.carryover === 'string') {
    rec = { ...rec, game_opts: { ...rec.game_opts, Skins: { ...skinsOpts, carryover: skinsOpts.carryover !== 'no' } } };
  }

  // ── scoring → grossNetNOL field rename (v2.9) ─────────────────────────────
  // Non-destructive: copy old field to new if new is absent.
  const gnolGames = ['Stroke Play', 'Skins', 'Stableford', 'Nines', 'Sixes', 'Dots'];
  let needsGnolOpts = false;
  const updatedOpts = { ...(rec.game_opts || {}) };
  for (const g of gnolGames) {
    const o = updatedOpts[g];
    if (o && o.grossNetNOL === undefined && o.scoring !== undefined) {
      updatedOpts[g] = { ...o, grossNetNOL: o.scoring };
      needsGnolOpts = true;
    }
  }
  if (needsGnolOpts) rec = { ...rec, game_opts: updatedOpts };

  // matchDef.scoring → matchDef.grossNetNOL (v2.9)
  if (rec.matches?.length) {
    let matchChanged = false;
    const updatedMatches = rec.matches.map(m => {
      const changes = {};
      if (m.grossNetNOL === undefined && m.scoring !== undefined) {
        changes.grossNetNOL = m.scoring;
        matchChanged = true;
      }
      // matchDef.tiebreak → matchDef.scoring (v2.9); 'half' → 'none'
      if (m.scoring === undefined && m.tiebreak !== undefined) {
        changes.scoring = m.tiebreak === 'half' ? 'none' : m.tiebreak;
        matchChanged = true;
      }
      return Object.keys(changes).length ? { ...m, ...changes } : m;
    });
    if (matchChanged) rec = { ...rec, matches: updatedMatches };
  }

  // gameOpts.Sixes.tiebreak → gameOpts.Sixes.scoring (v2.9); 'half' → 'none'
  const sixesO = rec.game_opts?.Sixes;
  if (sixesO && sixesO.scoring === undefined && sixesO.tiebreak !== undefined) {
    rec = {
      ...rec,
      game_opts: {
        ...rec.game_opts,
        Sixes: { ...sixesO, scoring: sixesO.tiebreak === 'half' ? 'none' : sixesO.tiebreak },
      },
    };
  }

  // ── Dots teamMode: 'Match' → 'Match:{matchId}' (v3.0 / 11-J) ─────────────
  // Pre-11-J rounds stored the generic string 'Match' with no ID suffix.
  // Resolve to the first team-format match ID, or 'none' if none exists.
  const dotsO = rec.game_opts?.Dots;
  if (dotsO && dotsO.teamMode === 'Match') {
    const firstTeam = (rec.matches || []).find(m => m.format === 'team');
    const newMode   = firstTeam ? `Match:${firstTeam.id}` : 'none';
    rec = {
      ...rec,
      game_opts: { ...rec.game_opts, Dots: { ...dotsO, teamMode: newMode } },
    };
  }

  // ── earlyDepartureOpts.eventOrder backfill (v2.0 / 13-C.7.5) ─────────────
  // PartialGameContract v2.0 §4.1 / §13: every entry in earlyDepartureOpts
  // gains an `eventOrder` field — 0-based chronological position by
  // `departureHole` ascending. v1.x history records (13-C.6, 13-C.7) do not
  // have this field; this migration backfills them on first read.
  //
  // SCOPE: this migration runs against history records loaded by `list()`.
  // activeRound (the live in-flight round) is NOT routed through this path —
  // active-round consumers (resolverUtils.classifyPlayersAtResults) re-derive
  // `eventOrder` at consumption time. This matches the existing pattern
  // (restoreDotDefs, restoreAutoWhen) where derived values are computed at
  // read, not stored. The history-record migration here is for round-trip
  // fidelity — when a saved round is reloaded into the scorecard, its
  // metadata stays consistent.
  //
  // Ties broken stably by playerIdx ascending per PartialGameContract §5.4.1.
  const edo = rec.early_departure_opts;
  if (edo && typeof edo === 'object') {
    const piKeys = Object.keys(edo);
    const needsMigration = piKeys.length > 0 && piKeys.some(pi => edo[pi]?.eventOrder === undefined);
    if (needsMigration) {
      const sorted = piKeys
        .map(piStr => ({ pi: Number(piStr), entry: edo[piStr] }))
        .filter(x => x.entry && typeof x.entry.departureHole === 'number')
        .sort((a, b) => {
          const dh = (a.entry.departureHole ?? 0) - (b.entry.departureHole ?? 0);
          return dh !== 0 ? dh : (a.pi - b.pi);
        });
      const migrated = {};
      sorted.forEach((x, i) => {
        migrated[String(x.pi)] = { ...x.entry, eventOrder: i };
      });
      // Preserve any malformed entries (no departureHole) verbatim — they
      // will be filtered by the resolver chain when classification runs.
      piKeys.forEach(piStr => {
        if (!(piStr in migrated)) migrated[piStr] = edo[piStr];
      });
      rec = { ...rec, early_departure_opts: migrated };
    }
  }

  return rec;
}

// ─── CRUD ──────────────────────────────────────────────────────────────────────

export const roundLib = {

  list() {
    return (ls.get(SK.rounds) || []).map(migrateRecord);
  },

  saveFromActive(ar) {
    const record = roundLib.fromActiveRound(ar);
    const all = ls.get(SK.rounds) || [];
    if (ar.roundId) {
      const idx = all.findIndex(r => r.id === ar.roundId);
      if (idx !== -1) {
        all[idx] = { ...record, id: ar.roundId };
        ls.set(SK.rounds, all);
        return all[idx];
      }
    }
    ls.set(SK.rounds, [record, ...all]);
    return record;
  },

  save(data) {
    const all = ls.get(SK.rounds) || [];
    const round = { id: makeId('r'), ...data };
    ls.set(SK.rounds, [round, ...all]);
    return round;
  },

  update(id, changes) {
    if (!id) return;
    const all = ls.get(SK.rounds) || [];
    const idx = all.findIndex(r => r.id === id);
    if (idx === -1) return;
    all[idx] = { ...all[idx], ...changes };
    ls.set(SK.rounds, all);
    return all[idx];
  },

  delete(id) {
    if (!id) return;
    const all = ls.get(SK.rounds) || [];
    ls.set(SK.rounds, all.filter(r => r.id !== id));
  },

  // ─── Schema conversions ───────────────────────────────────────────────────

  fromActiveRound(ar) {
    return {
      id:           makeId('r'),
      date:         ar.roundDate,

      course_name:     ar.course?.name  || 'Unknown',
      course_snapshot: ar.course        || null,
      front_nine:      ar.frontNine     || '',
      back_nine:       ar.backNine      || '',
      selected_tee:    ar.selectedTee   || '',

      pars: ar.pars || DEF_PARS,
      hcps: ar.hcps || DEF_HCP,
      hcps_women: ar.hcpsWomen || null,
      pars_women: ar.parsWomen || null,

      players: (ar.activePlayers || []).map(p => ({
        id:           p.id           || p.name,
        name:         p.name,
        gender:       p.gender       || '',
        ghin:         p.ghin         || '',
        courseHcpVal: p.courseHcpVal ?? null,
        selectedTee:  p.selectedTee  || '',
      })),
      course_hcps:    ar.courseHcps   || [],
      min_course_hcp: ar.minCourseHcp ?? null,

      active_games:  ar.activeGames  || [],
      game_opts:     ar.gameOpts     || {},
      matches:       ar.matches      || [],

      // 13-C.2: Round length — stored as-is (undefined if not set). Callers
      // apply ?? 0 and ?? 18 at read time per PartialGameContract §1A.7.
      round_start_hole: ar.roundStartHole,
      round_num_holes:  ar.roundNumHoles,

      // 13-C.3: Per-game hole range overrides, keyed by game name or matchDef.id
      // (PartialGameContract §4.3, §4.5). Stored as-is (undefined if not set);
      // readers apply ?? {} at read time. Absent = all games use full round range.
      game_ranges:      ar.gameRanges,

      // 13-C.6: Per-player departure metadata. Keyed by player index. Each
      // entry: { departureHole: number, gameResolutions: { [gameKey]: SegmentedResolution } }.
      // Stored as-is; readers apply ?? {} at read time. Absent = no departures.
      // Currently consumed only by ScoreGrid (locked-cell display, dimmed
      // name chip) — payouts.js reader is 13-C.8 work.
      early_departure_opts: ar.earlyDepartureOpts,

      // 13-C.7.6: Group-stop metadata per PartialGameContract §5.4.4. Written
      // by the resolver chain's last event when every player is Early-departure.
      // Round-tripped here so Back→Setup→Forward navigation preserves the
      // group-stop state.
      early_end_opts:       ar.earlyEndOpts,
      last_completed_hole:  ar.lastCompletedHole,

      stroke_play_players: ar.strokePlayPlayers || [],
      skins_players:       ar.skinsPlayers      || [],
      stableford_players:  ar.stablefordPlayers || [],
      nines_players:       ar.ninesPlayers      || [],
      sixes_teams:         ar.sixesTeams        || [null, null, null],
      sixes_players:       ar.sixesPlayers      || [],
      dots_players:        ar.dotsPlayers       || [],
      dots:                ar.dots              || [],
      dot_entries:         ar.dotEntries        || {},
      manual_presses:      ar.manualPresses     || {},

      scores:    ar.scores    || Array.from({ length: 18 }, () => []),
      breakdown: ar.breakdown || [],
      bank:      ar.bank      || {},
      wolf_picks: ar.wolfPicks || {},
    };
  },

  toActiveRound(r) {
    try {
      const rec = migrateRecord(r);

      const courseSnapshot = rec.course_snapshot || null;
      const nines = courseSnapshot?.nines;
      const layout = (nines?.length && rec.front_nine)
        ? buildGenderLayout(nines, rec.front_nine, rec.back_nine)
        : null;

      const pars      = rec.pars       || layout?.pars      || DEF_PARS;
      const hcps      = rec.hcps       || layout?.hcps      || DEF_HCP;
      const hcpsWomen = rec.hcps_women ?? layout?.hcpsWomen ?? null;
      const parsWomen = rec.pars_women ?? layout?.parsWomen ?? null;

      const activePlayers = (rec.players || []).map(p => ({
        id:           p.id   || p.name,
        name:         p.name,
        gender:       p.gender || '',
        ghin:         p.ghin   || '',
        courseHcpVal: p.courseHcpVal ?? null,
        selectedTee:  p.selectedTee  || rec.selected_tee || '',
      }));

      const storedCourseHcps = rec.course_hcps?.length ? rec.course_hcps : null;
      // If stored courseHcps exist, use them (they were correctly computed at round-start time).
      // If absent (legacy record), recompute gender-aware from stored player/tee data.
      let courseHcps;
      if (storedCourseHcps) {
        courseHcps = storedCourseHcps;
      } else if (activePlayers.length && courseSnapshot?.tees) {
        const perPlayerTees = activePlayers.map(p => {
          const tName = p.selectedTee || rec.selected_tee || '';
          return courseSnapshot.tees.find(t => t.name === tName) || null;
        });
        courseHcps = groupCourseHandicaps(activePlayers, perPlayerTees, pars, nines);
      } else {
        courseHcps = [];
      }
      const minCourseHcp = rec.min_course_hcp ?? (courseHcps.length ? Math.min(...courseHcps) : 0);

      return {
        roundId:     rec.id,
        roundDate:   rec.date,
        course:      courseSnapshot,
        frontNine:   rec.front_nine   || '',
        backNine:    rec.back_nine    || '',
        selectedTee: rec.selected_tee || '',
        layout,
        pars,
        hcps,
        hcpsWomen,
        parsWomen,
        activePlayers: activePlayers.map((p, i) => ({
          ...p,
          courseHcpVal: courseHcps[i] ?? p.courseHcpVal ?? null,
          // 13-G.2 / Handicap_Contract §2.5, inv 21:
          // Build per-player SI defensively on reload. Layout-derived even for
          // legacy records (no historical female-player rounds exist, but we
          // attach unconditionally so engines always have a valid siArray).
          // Falls back to DEF_HCP if layout is null (no course snapshot).
          siArray: layout
            ? buildPlayerSI(p, layout)
            : [...(hcps || DEF_HCP)],
        })),
        courseHcps,
        minCourseHcp,
        activeGames:        rec.active_games        || [],
        gameOpts:           rec.game_opts           || {},
        matches:            rec.matches             || [],
        // 13-C.2: Round length — restored as-is (undefined if absent in record).
        // Callers apply ?? 0 and ?? 18 at read time per PartialGameContract §1A.7.
        // Backward compat: legacy records with neither field load as full 18-hole rounds.
        roundStartHole:     rec.round_start_hole,
        roundNumHoles:      rec.round_num_holes,
        // 13-C.3: Per-game ranges — restored as-is (undefined if absent).
        // Callers apply ?? {} at read time per PartialGameContract §4.5 / §13.
        // Legacy records without this field load as "all games use full round".
        gameRanges:         rec.game_ranges,
        // 13-C.6: Per-player departure metadata — restored as-is.
        // Callers (ScorecardPage, ScoreGrid) apply ?? {} at read time per
        // PartialGameContract §4.5. Legacy records without this field load
        // with no departures (full no-op, byte-identical pre-13-C.6 render).
        earlyDepartureOpts: rec.early_departure_opts,
        // 13-C.7.6: Group-stop metadata round-trip.
        earlyEndOpts:       rec.early_end_opts,
        lastCompletedHole:  rec.last_completed_hole,
        strokePlayPlayers:  rec.stroke_play_players || [],
        skinsPlayers:       rec.skins_players       || [],
        stablefordPlayers:  rec.stableford_players  || [],
        ninesPlayers:       rec.nines_players       || [],
        sixesTeams:         rec.sixes_teams         || [null, null, null],
        sixesPlayers:       rec.sixes_players       || [],
        dotsPlayers:        rec.dots_players        || [],
        dots:               rec.dots               || [],
        dotEntries:         rec.dot_entries         || {},
        manualPresses:      rec.manual_presses      || {},
        scores:             rec.scores              || Array.from({ length: 18 }, () => []),
        breakdown:          rec.breakdown           || [],
        bank:               rec.bank                || {},
        wolfPicks:          rec.wolf_picks          || {},
      };
    } catch(e) {
      console.error('roundLib.toActiveRound failed:', e);
      throw new Error('Failed to reconstruct round: ' + e.message);
    }
  },

  toSetupState(r) {
    const rec = migrateRecord(r);

    const courseSnapshot = rec.course_snapshot || null;
    const playerSnapshots = (rec.players || []).map(p => ({
      id:           p.id   || p.name,
      name:         p.name,
      gender:       p.gender || '',
      ghin:         p.ghin   || '',
      courseHcpVal: p.courseHcpVal ?? null,
      selectedTee:  p.selectedTee  || rec.selected_tee || '',
    }));

    return {
      roundId:           rec.id,
      roundDate:         rec.date,
      selectedCourseId:  courseSnapshot?.id || '',
      frontNine:         rec.front_nine   || '',
      backNine:          rec.back_nine    || '',
      selectedTee:       rec.selected_tee || '',
      selectedPlayerIds: playerSnapshots.map(p => p.id),
      playerSnapshots,
      courseSnapshot,
      activeGames:       rec.active_games      || [],
      gameOpts:          rec.game_opts         || {},
      gameBets: Object.fromEntries(
        Object.entries(rec.game_opts || {}).map(([g, o]) => [g, o.bet || 0])
      ),
      matches:             rec.matches              || [],
      strokePlayPlayers:   rec.stroke_play_players  || [],
      skinsPlayers:        rec.skins_players        || [],
      stablefordPlayers:   rec.stableford_players   || [],
      ninesPlayers:        rec.nines_players        || [],
      sixesTeams:          rec.sixes_teams          || [null, null, null],
      sixesPlayers:        rec.sixes_players        || [],
      dotsPlayers:         rec.dots_players         || [],
      dots:                rec.dots                 || [],
      isReload:            true,
      reloadedScores:      rec.scores               || [],
      dot_entries:         rec.dot_entries          || {},
      // J1 fix (13-C.2 fix pass): manual_presses was not restored here, causing
      // saved presses to be lost on round reload. The `handleStart` path reads
      // `initSrc?.manual_presses` which was always undefined without this field.
      // Pre-existing bug surfaced during 13-C.2 testing.
      manual_presses:      rec.manual_presses       || {},
      // 13-C.2: Round length — restored as-is (undefined if absent). NewRoundPage
      // applies ?? 0 and ?? 18 at read time via initSrc. Without this, a reload
      // of a saved partial round would silently reset to 0/18 in the picker.
      roundStartHole:      rec.round_start_hole,
      roundNumHoles:       rec.round_num_holes,
      // 13-C.3: Per-game ranges — restored as-is (undefined if absent in record).
      // NewRoundPage applies ?? {} at read time and threads through GameConfig /
      // MatchCard so per-game range pickers reflect the saved ranges on reload.
      // Without this, saved per-game ranges would silently reset to defaults.
      gameRanges:          rec.game_ranges,
      // 13-C.6 / 13-C.7.6: Departure metadata — restored as-is. As of
      // 13-C.7.6 NewRoundPage's handleStart reads these via
      // initSrc?.earlyDepartureOpts (camelCase) to preserve the round's
      // departure state through Back→Setup→Forward navigation. Without
      // this restoration the round would silently lose all locked-cell
      // displays and resolver decisions on reload.
      earlyDepartureOpts:  rec.early_departure_opts,
      earlyEndOpts:        rec.early_end_opts,
      lastCompletedHole:   rec.last_completed_hole,
      wolfPicks:           rec.wolf_picks || {},
    };
  },
};
