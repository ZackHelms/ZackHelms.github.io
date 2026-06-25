// search.js — search across all services via TMDB. Each result can be opened to see
// which services carry it. Requires a TMDB key (set in Settings); degrades gracefully.

import * as tmdb from '../tmdb.js';
import { el, clear, poster } from '../ui.js';
import { focusFirst, setFocus } from '../nav.js';

export function mountSearch(container, { onOpen }) {
  clear(container);

  const input = el('input', {
    type: 'search', class: 'search-input', placeholder: 'Search shows & movies…',
    'data-focusable': '', autocomplete: 'off', spellcheck: 'false',
  });
  const results = el('div', { class: 'grid search-results' });
  const status = el('p', { class: 'empty' });

  const section = el('section', { class: 'section' }, [
    el('div', { class: 'section-head' }, [el('h2', { text: 'Search' })]),
    el('div', { class: 'search-bar' }, [input]),
    status,
    results,
  ]);
  container.appendChild(section);

  if (!tmdb.hasKey()) {
    status.textContent = 'Add a TMDB API key in Settings to enable search.';
  } else {
    status.textContent = 'Type a title and press Enter.';
  }

  let seq = 0;
  async function run() {
    const q = input.value.trim();
    if (!q) { clear(results); status.textContent = 'Type a title and press Enter.'; return; }
    if (!tmdb.hasKey()) { status.textContent = 'Add a TMDB API key in Settings to enable search.'; return; }

    const mine = ++seq;
    status.textContent = 'Searching…';
    clear(results);
    try {
      const items = await tmdb.searchMulti(q);
      if (mine !== seq) return; // a newer search superseded this one
      if (!items.length) { status.textContent = `No results for “${q}”.`; return; }
      status.textContent = `${items.length} result${items.length === 1 ? '' : 's'}`;
      for (const it of items) {
        results.appendChild(el('button', {
          class: 'card', 'data-focusable': '', onclick: () => onOpen(it),
        }, [
          poster(it),
          el('div', { class: 'card-meta' }, [
            el('div', { class: 'card-title', text: it.title }),
            el('div', { class: 'card-sub', text: [it.year, it.mediaType === 'tv' ? 'TV' : 'Movie'].filter(Boolean).join(' · ') }),
          ]),
        ]));
      }
      const first = results.querySelector('[data-focusable]');
      if (first) setFocus(first, { scroll: false });
    } catch (e) {
      if (mine !== seq) return;
      status.textContent = `Search failed: ${e.message}`;
    }
  }

  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.stopPropagation(); run(); } });

  focusFirst();
  setFocus(input, { scroll: false });
  setTimeout(() => input.focus(), 0);
}
