// app.js — bootstrap + hash router. Wires the left nav, mounts views into <main>,
// and manages back navigation for the TV remote.

import { store } from './store.js';
import { loadServices } from './services.js';
import { initNav, setBackHandler, focusFirst } from './nav.js';
import { mountHome } from './views/home.js';
import { mountSearch } from './views/search.js';
import { mountRegister } from './views/register.js';
import { mountSettings, applyTheme } from './views/settings.js';
import { mountTitle } from './views/title.js';

const main = document.getElementById('view');
const navEl = document.getElementById('nav');

// Open a title detail page (used by home/search results).
function openTitle(item, opts = {}) {
  if (opts.removed) { location.hash = '#/home'; return; }
  location.hash = `#/title/${item.mediaType}/${item.id}`;
}

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '') || 'home';
  return h.split('/');
}

function setActiveNav(route) {
  [...navEl.querySelectorAll('[data-route]')].forEach(b =>
    b.classList.toggle('active', b.dataset.route === route));
}

function render() {
  const [route, a, b] = parseHash();
  setActiveNav(route);

  switch (route) {
    case 'home':
      setActiveNav('home');
      mountHome(main, { onOpen: openTitle });
      break;
    case 'search':
      mountSearch(main, { onOpen: openTitle });
      break;
    case 'register':
      mountRegister(main);
      break;
    case 'settings':
      mountSettings(main);
      break;
    case 'title':
      mountTitle(main, { mediaType: a, id: b, onOpen: openTitle });
      break;
    default:
      location.hash = '#/home';
  }
}

function goBack() {
  const [route] = parseHash();
  if (route === 'home') focusFirst();
  else location.hash = '#/home';
}

function buildNav() {
  const items = [
    { route: 'home', label: '☰ Home' },
    { route: 'search', label: '🔍 Search' },
    { route: 'register', label: '＋ Register' },
    { route: 'settings', label: '⚙ Settings' },
  ];
  for (const it of items) {
    const btn = document.createElement('button');
    btn.className = 'nav-item';
    btn.dataset.route = it.route;
    btn.dataset.focusable = '';
    btn.textContent = it.label;
    btn.addEventListener('click', () => { location.hash = `#/${it.route}`; });
    navEl.appendChild(btn);
  }
}

async function boot() {
  applyTheme();
  buildNav();
  await loadServices();
  await store.seedIfEmpty();

  initNav();
  setBackHandler(goBack);
  window.addEventListener('hashchange', render);

  if (!location.hash) location.hash = '#/home';
  else render();
}

boot();
