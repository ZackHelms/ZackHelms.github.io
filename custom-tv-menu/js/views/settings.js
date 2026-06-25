// settings.js — customize theme (background, focus color, pulse speed), default
// sort/group, and the TMDB API key + region. Changes apply live via applyTheme().

import { store } from '../store.js';
import { el, clear } from '../ui.js';
import { focusFirst } from '../nav.js';

// Apply theme settings to CSS variables on :root. Called on load and on change.
export function applyTheme() {
  const { theme } = store.getSettings();
  const root = document.documentElement.style;
  root.setProperty('--bg', theme.bg);
  root.setProperty('--focus', theme.focusColor);
  root.setProperty('--pulse-speed', `${theme.pulseSpeed}s`);
}

function field(labelText, control) {
  return el('label', { class: 'field' }, [
    el('span', { class: 'field-label', text: labelText }),
    control,
  ]);
}

export function mountSettings(container) {
  clear(container);
  const s = store.getSettings();

  const section = el('section', { class: 'section settings' }, [
    el('div', { class: 'section-head' }, [el('h2', { text: 'Settings' })]),
  ]);

  // --- Appearance ---
  const bg = el('input', { type: 'color', value: s.theme.bg, 'data-focusable': '',
    oninput: e => { store.setSettings({ theme: { bg: e.target.value } }); applyTheme(); } });

  const focus = el('input', { type: 'color', value: s.theme.focusColor, 'data-focusable': '',
    oninput: e => { store.setSettings({ theme: { focusColor: e.target.value } }); applyTheme(); } });

  const speed = el('input', { type: 'range', min: '0.6', max: '4', step: '0.1',
    value: String(s.theme.pulseSpeed), 'data-focusable': '',
    oninput: e => {
      store.setSettings({ theme: { pulseSpeed: parseFloat(e.target.value) } });
      applyTheme();
      speedVal.textContent = `${e.target.value}s`;
    } });
  const speedVal = el('span', { class: 'range-val', text: `${s.theme.pulseSpeed}s` });

  section.appendChild(el('h3', { class: 'group-head', text: 'Appearance' }));
  section.appendChild(field('Background color', bg));
  section.appendChild(field('Focus highlight color', focus));
  section.appendChild(field('Focus pulse speed', el('div', { class: 'range-wrap' }, [speed, speedVal])));

  // --- Defaults ---
  const sortSel = el('select', { 'data-focusable': '',
    onchange: e => store.setSettings({ defaultSort: e.target.value }) },
    [['alpha', 'A–Z'], ['recent', 'Recently watched'], ['added', 'Date added']]
      .map(([v, t]) => el('option', { value: v, selected: v === s.defaultSort }, [t])));

  const groupSel = el('select', { 'data-focusable': '',
    onchange: e => store.setSettings({ defaultGroup: e.target.value }) },
    [['none', 'None'], ['service', 'Service'], ['genre', 'Genre']]
      .map(([v, t]) => el('option', { value: v, selected: v === s.defaultGroup }, [t])));

  section.appendChild(el('h3', { class: 'group-head', text: 'Home defaults' }));
  section.appendChild(field('Default sort', sortSel));
  section.appendChild(field('Default grouping', groupSel));

  // --- Data source (TMDB) ---
  const key = el('input', { type: 'password', value: s.tmdbApiKey, placeholder: 'TMDB API key',
    'data-focusable': '', autocomplete: 'off', spellcheck: 'false',
    onchange: e => store.setSettings({ tmdbApiKey: e.target.value.trim() }) });

  const region = el('input', { type: 'text', value: s.region, placeholder: 'US', maxlength: '2',
    'data-focusable': '', spellcheck: 'false',
    onchange: e => store.setSettings({ region: e.target.value.trim().toUpperCase() }) });

  section.appendChild(el('h3', { class: 'group-head', text: 'Data source' }));
  section.appendChild(field('TMDB API key', key));
  section.appendChild(field('Region (2-letter)', region));
  section.appendChild(el('p', { class: 'hint', html:
    'Get a free key at <strong>themoviedb.org</strong> → Settings → API. ' +
    'Stored locally in this browser only. Powers Search and service availability.' }));

  container.appendChild(section);
  focusFirst();
}
