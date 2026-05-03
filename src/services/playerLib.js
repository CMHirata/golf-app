// ─── services/playerLib.js ────────────────────────────────────────────────────
// Player library: CRUD, ID migration, last-name sort.
//
// Player schema:
//   { id, name, gender ('M'|'F'), ghin (HI string), email?, phone? }
//
// All methods go through _load() which backfills IDs on legacy records so
// delete/update can never accidentally wipe the whole array via undefined id.

import { ls, SK, makeId } from './storage.js';

function playerSortKey(name) {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2 ? parts[parts.length - 1].toLowerCase() : parts[0].toLowerCase();
}

export const playerLib = {
  /** Read raw array, backfill missing IDs in-place (one-time migration). */
  _load() {
    const raw = ls.get(SK.players) || [];
    let dirty = false;
    const migrated = raw.map(p => {
      if (p.id) return p;
      dirty = true;
      return { ...p, id: makeId('p'), gender: p.gender || 'M', email: p.email || '', phone: p.phone || '' };
    });
    if (dirty) ls.set(SK.players, migrated);
    return migrated;
  },

  /** Returns all players sorted by last name. */
  list() {
    return [...this._load()].sort((a, b) =>
      playerSortKey(a.name).localeCompare(playerSortKey(b.name))
    );
  },

  save(data) {
    const all = this._load();
    const player = {
      id:     makeId('p'),
      name:   data.name   || '',
      gender: data.gender || 'M',
      ghin:   data.ghin   || '',
      email:  data.email  || '',
      phone:  data.phone  || '',
    };
    all.push(player);
    ls.set(SK.players, all);
    return player;
  },

  update(id, changes) {
    if (!id) return;
    const all = this._load();
    const idx = all.findIndex(p => p.id === id);
    if (idx === -1) return;
    all[idx] = { ...all[idx], ...changes };
    ls.set(SK.players, all);
    return all[idx];
  },

  delete(id) {
    if (!id) return;                          // guard: never pass undefined
    const all = this._load();
    const next = all.filter(p => p.id !== id);
    if (next.length === all.length) return;  // id not found — don't write
    ls.set(SK.players, next);
  },

  getById(id) {
    if (!id) return null;
    return this._load().find(p => p.id === id) || null;
  },
};
