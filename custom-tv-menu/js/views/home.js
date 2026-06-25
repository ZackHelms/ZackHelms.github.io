// home.js — home page: favorites list (sortable + groupable) and, below it, the
// recently-watched list. Reads from store; re-renders in place on toggle changes.

import { store } from '../store.js';
import { el, clear, poster, serviceBadge, serviceName } from '../ui.js';
import { focusFirst } from '../nav.js';

const SORTS = [
  { id: 'alpha',  label: 'A–Z' },
  { id: 'recent', label: 'Recently watched' },
  { id: 'added',  label: 'Date added' },
];
const GROUPS = [
  { id: 'none',    label: 'None' },
  { id: 'service', label: 'Service' },
  { id: 'genre',   label: 'Genre' },
];

function ts(v) { return v ? new Date(v).getTime() : 0; }

function sortFavorites(list, sort) {
  const a = [...list];
  if (sort === 'alpha') a.sort((x, y) => x.title.localeCompare(y.title));
  else if (sort === 'recent') a.sort((x, y) => ts(y.lastWatchedAt) - ts(x.lastWatchedAt));
  else if (sort === 'added') a.sort((x, y) => ts(y.addedAt) - ts(x.addedAt));
  return a;
}

// Returns [{ heading|null, items:[] }] for rendering.
function groupFavorites(list, group) {
  if (group === 'none') return [{ heading: null, items: list }];

  const map = new Map();
  const push = (key, item) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  };

  if (group === 'service') {
    for (const it of list) push(serviceName(it.service), it);
  } else { // genre — items can appear under multiple genres
    for (const it of list) {
      const genres = (it.genres && it.genres.length) ? it.genres : ['Other'];
      for (const g of genres) push(g, it);
    }
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([heading, items]) => ({ heading, items }));
}

function titleCard(item, onOpen) {
  return el('button', {
    class: 'card', 'data-focusable': '',
    onclick: () => onOpen(item),
  }, [
    poster(item),
    el('div', { class: 'card-meta' }, [
      el('div', { class: 'card-title', text: item.title }),
      el('div', { class: 'card-sub' }, [serviceBadge(item.service)]),
    ]),
  ]);
}

function watchedRow(item, onOpen) {
  return el('button', {
    class: 'wrow', 'data-focusable': '',
    onclick: () => onOpen(item),
  }, [
    poster(item),
    el('div', { class: 'wrow-meta' }, [
      el('div', { class: 'card-title', text: item.title }),
      el('div', { class: 'card-sub' }, [serviceBadge(item.service), serviceName(item.service)]),
    ]),
  ]);
}

function segmented(options, active, onPick) {
  return el('div', { class: 'segmented' },
    options.map(o => el('button', {
      class: 'seg' + (o.id === active ? ' active' : ''),
      'data-focusable': '',
      'aria-pressed': o.id === active ? 'true' : 'false',
      onclick: () => onPick(o.id),
    }, [o.label])));
}

export function mountHome(container, { onOpen }) {
  const settings = store.getSettings();
  let sort = settings.defaultSort;
  let group = settings.defaultGroup;

  function render() {
    clear(container);

    const favorites = store.getFavorites();
    const watched = store.getWatched()
      .slice()
      .sort((a, b) => ts(b.lastWatchedAt) - ts(a.lastWatchedAt));

    // Favorites section
    const controls = el('div', { class: 'controls' }, [
      el('div', { class: 'control-group' }, [
        el('span', { class: 'control-label', text: 'Sort' }),
        segmented(SORTS, sort, id => { sort = id; store.setSettings({ defaultSort: id }); render(); }),
      ]),
      el('div', { class: 'control-group' }, [
        el('span', { class: 'control-label', text: 'Group' }),
        segmented(GROUPS, group, id => { group = id; store.setSettings({ defaultGroup: id }); render(); }),
      ]),
    ]);

    const favSection = el('section', { class: 'section' }, [
      el('div', { class: 'section-head' }, [el('h2', { text: 'Favorites' }), controls]),
    ]);

    if (!favorites.length) {
      favSection.appendChild(el('p', { class: 'empty', text: 'No favorites yet. Use Search to add titles.' }));
    } else {
      const sorted = sortFavorites(favorites, sort);
      for (const grp of groupFavorites(sorted, group)) {
        if (grp.heading) favSection.appendChild(el('h3', { class: 'group-head', text: grp.heading }));
        favSection.appendChild(el('div', { class: 'grid' }, grp.items.map(it => titleCard(it, onOpen))));
      }
    }

    // Watched section
    const watchedSection = el('section', { class: 'section' }, [
      el('div', { class: 'section-head' }, [el('h2', { text: 'Recently watched' })]),
    ]);
    if (!watched.length) {
      watchedSection.appendChild(el('p', { class: 'empty', text: 'Nothing watched yet.' }));
    } else {
      watchedSection.appendChild(el('div', { class: 'wlist' }, watched.map(it => watchedRow(it, onOpen))));
    }

    container.appendChild(favSection);
    container.appendChild(watchedSection);
    focusFirst();
  }

  render();
}
