// title.js — title detail. Shows the title and the services that offer it, lets you
// pick a service to add it to Favorites, and "Play" deep-links out to that service.
//
// With a TMDB key: fetches genres + live watch-provider availability.
// Without a key: falls back to data already in the store (for items opened from the
// home page) and lets you choose any service manually.

import * as tmdb from '../tmdb.js';
import { store } from '../store.js';
import { allServices, serviceByProviderId, serviceById, deepLink } from '../services.js';
import { el, clear, poster, serviceName } from '../ui.js';
import { focusFirst } from '../nav.js';

export function mountTitle(container, { mediaType, id, onOpen }) {
  clear(container);
  id = Number(id);

  // Seed from store if we already know this title (favorites or watched).
  const known =
    store.getFavorites().find(f => f.id === id && f.mediaType === mediaType) ||
    store.getWatched().find(w => w.id === id && w.mediaType === mediaType) ||
    null;

  let item = known ? { ...known } : { id, mediaType, title: 'Loading…', poster: null, genres: [] };
  let availableServiceIds = []; // service ids offering this title

  const root = el('section', { class: 'section title-detail' });
  container.appendChild(root);

  function render() {
    clear(root);

    const head = el('div', { class: 'title-head' }, [
      poster(item),
      el('div', { class: 'title-info' }, [
        el('h2', { text: item.title }),
        item.genres && item.genres.length
          ? el('div', { class: 'genres', text: item.genres.join(' · ') })
          : null,
        item.overview ? el('p', { class: 'overview', text: item.overview }) : null,
      ]),
    ]);
    root.appendChild(head);

    // Service choices: availability if known, otherwise all services.
    const choices = availableServiceIds.length
      ? availableServiceIds
      : allServices().map(s => s.id);
    const subscribed = new Set(store.getServices());

    root.appendChild(el('h3', { class: 'group-head', text:
      availableServiceIds.length ? 'Available on' : 'Choose a service' }));

    const list = el('div', { class: 'svc-grid' }, choices.map(sid => {
      const svc = serviceById(sid);
      if (!svc) return null;
      const mine = subscribed.has(sid);
      return el('div', { class: 'svc-choice' + (mine ? ' mine' : '') }, [
        el('span', { class: 'svc-badge big', style: `background:${svc.color}`, text: svc.short }),
        el('span', { class: 'svc-name', text: svc.name + (mine ? ' ✓' : '') }),
        el('div', { class: 'svc-actions' }, [
          el('button', { class: 'btn', 'data-focusable': '',
            onclick: () => addFav(sid) }, ['+ Favorite']),
          el('a', { class: 'btn play', 'data-focusable': '',
            href: deepLink(sid, item.title), target: '_blank', rel: 'noopener',
            onclick: () => store.recordWatch({ ...item, service: sid }) }, ['▶ Play']),
        ]),
      ]);
    }));
    root.appendChild(list);

    if (store.isFavorite(id, mediaType)) {
      root.appendChild(el('button', { class: 'btn danger', 'data-focusable': '',
        onclick: () => { store.removeFavorite(id, mediaType); onOpen({ ...item }, { removed: true }); } },
        ['Remove from favorites']));
    }

    focusFirst();
  }

  function addFav(serviceId) {
    store.addFavorite({
      id, mediaType, title: item.title, poster: item.poster,
      genres: item.genres || [], service: serviceId,
    });
    render();
  }

  render();

  // Enrich with live TMDB data when a key is available.
  if (tmdb.hasKey()) {
    tmdb.details(mediaType, id).then(d => { item = { ...item, ...d }; render(); }).catch(() => {});
    tmdb.watchProviders(mediaType, id).then(wp => {
      availableServiceIds = wp.providers
        .map(p => serviceByProviderId(p.providerId))
        .filter(Boolean)
        .map(s => s.id);
      render();
    }).catch(() => {});
  }
}
