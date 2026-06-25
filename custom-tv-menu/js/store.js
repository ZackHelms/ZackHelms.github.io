// store.js — local persistence (localStorage) for settings, subscribed services,
// favorites and watched history. All app state lives here; views read/write through it.

const NS = 'ctm.';
const KEYS = {
  settings: NS + 'settings',
  services: NS + 'services',   // array of subscribed service ids
  favorites: NS + 'favorites',
  watched: NS + 'watched',
  seeded: NS + 'seeded',
};

const DEFAULT_SETTINGS = {
  tmdbApiKey: '',
  region: 'US',
  theme: {
    bg: '#000000',
    focusColor: '#ffeb00',
    pulseSpeed: 1.6,        // seconds per pulse cycle
  },
  defaultSort: 'recent',    // 'alpha' | 'recent' | 'added'
  defaultGroup: 'none',     // 'service' | 'genre' | 'none'
};

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('store: failed to persist', key, e);
  }
}

// Deep-merge stored settings over defaults so new fields always have a value.
function getSettings() {
  const s = read(KEYS.settings, {});
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    theme: { ...DEFAULT_SETTINGS.theme, ...(s.theme || {}) },
  };
}

function setSettings(patch) {
  const current = getSettings();
  const next = { ...current, ...patch };
  if (patch.theme) next.theme = { ...current.theme, ...patch.theme };
  write(KEYS.settings, next);
  return next;
}

function getServices() { return read(KEYS.services, []); }
function setServices(ids) { write(KEYS.services, ids); }
function toggleService(id) {
  const set = new Set(getServices());
  set.has(id) ? set.delete(id) : set.add(id);
  setServices([...set]);
  return [...set];
}

function getFavorites() { return read(KEYS.favorites, []); }
function setFavorites(list) { write(KEYS.favorites, list); }

function isFavorite(id, mediaType) {
  return getFavorites().some(f => f.id === id && f.mediaType === mediaType);
}

function addFavorite(item) {
  const list = getFavorites();
  if (list.some(f => f.id === item.id && f.mediaType === item.mediaType)) return list;
  const now = new Date().toISOString();
  list.push({
    poster: null, genres: [], service: null,
    addedAt: now, lastWatchedAt: null,
    ...item,
  });
  setFavorites(list);
  return list;
}

function removeFavorite(id, mediaType) {
  setFavorites(getFavorites().filter(f => !(f.id === id && f.mediaType === mediaType)));
}

function getWatched() { return read(KEYS.watched, []); }
function setWatched(list) { write(KEYS.watched, list); }

// Record a watch event. Updates favorites' lastWatchedAt if favorited, otherwise
// upserts into the watched list (kept distinct from favorites for the home page).
function recordWatch(item) {
  const now = new Date().toISOString();
  if (isFavorite(item.id, item.mediaType)) {
    const list = getFavorites().map(f =>
      (f.id === item.id && f.mediaType === item.mediaType) ? { ...f, lastWatchedAt: now } : f);
    setFavorites(list);
    return;
  }
  const list = getWatched().filter(w => !(w.id === item.id && w.mediaType === item.mediaType));
  list.unshift({ poster: null, service: null, ...item, lastWatchedAt: now });
  setWatched(list);
}

// One-time seed of mock data so the app is usable before a TMDB key exists.
async function seedIfEmpty() {
  if (read(KEYS.seeded, false)) return;
  try {
    const res = await fetch('./data/mock.json');
    const mock = await res.json();
    if (getFavorites().length === 0) setFavorites(mock.favorites || []);
    if (getWatched().length === 0) setWatched(mock.watched || []);
  } catch (e) {
    console.warn('store: seed failed', e);
  }
  write(KEYS.seeded, true);
}

export const store = {
  KEYS, DEFAULT_SETTINGS,
  getSettings, setSettings,
  getServices, setServices, toggleService,
  getFavorites, setFavorites, isFavorite, addFavorite, removeFavorite,
  getWatched, setWatched, recordWatch,
  seedIfEmpty,
};
