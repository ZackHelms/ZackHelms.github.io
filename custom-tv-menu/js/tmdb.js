// tmdb.js — TMDB API client with a TTL localStorage cache.
//
// Powers search, details (genres), and watch-provider availability. The API key and
// region come from settings (store.js). Fully wired for Phase 2; safe to import now.
// TMDB serves CORS headers for browsers, so no backend/proxy is needed.

import { store } from './store.js';

const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';
const CACHE_PREFIX = 'ctm.tmdbcache.';
const TTL_MS = 1000 * 60 * 60 * 24; // 24h

export function hasKey() { return !!store.getSettings().tmdbApiKey; }

export function posterUrl(path, size = 'w185') {
  return path ? `${IMG}/${size}${path}` : null;
}

function cacheGet(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw);
    if (Date.now() - t > TTL_MS) { localStorage.removeItem(CACHE_PREFIX + key); return null; }
    return v;
  } catch { return null; }
}

function cacheSet(key, v) {
  try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), v })); }
  catch { /* quota — ignore */ }
}

async function get(path, params = {}) {
  const { tmdbApiKey } = store.getSettings();
  if (!tmdbApiKey) throw new Error('No TMDB API key set (add one in Settings).');

  const qs = new URLSearchParams({ api_key: tmdbApiKey, ...params }).toString();
  const cacheKey = `${path}?${qs.replace(tmdbApiKey, 'KEY')}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const res = await fetch(`${BASE}${path}?${qs}`);
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${res.statusText}`);
  const json = await res.json();
  cacheSet(cacheKey, json);
  return json;
}

// Multi-search across movies + tv. Returns normalized result items.
export async function searchMulti(query) {
  if (!query.trim()) return [];
  const data = await get('/search/multi', { query, include_adult: 'false' });
  return (data.results || [])
    .filter(r => r.media_type === 'movie' || r.media_type === 'tv')
    .map(r => ({
      id: r.id,
      mediaType: r.media_type,
      title: r.title || r.name,
      poster: r.poster_path || null,
      year: (r.release_date || r.first_air_date || '').slice(0, 4),
      overview: r.overview || '',
    }));
}

export async function details(mediaType, id) {
  const d = await get(`/${mediaType}/${id}`);
  return {
    id: d.id,
    mediaType,
    title: d.title || d.name,
    poster: d.poster_path || null,
    genres: (d.genres || []).map(g => g.name),
    overview: d.overview || '',
  };
}

// Which providers offer this title in the user's region (flatrate = subscription).
// Returns { providers:[{providerId,name,logo}], link } (link = JustWatch page).
export async function watchProviders(mediaType, id) {
  const { region } = store.getSettings();
  const d = await get(`/${mediaType}/${id}/watch/providers`);
  const r = (d.results || {})[region] || {};
  const flat = r.flatrate || [];
  return {
    link: r.link || null,
    providers: flat.map(p => ({
      providerId: p.provider_id,
      name: p.provider_name,
      logo: p.logo_path || null,
    })),
  };
}
