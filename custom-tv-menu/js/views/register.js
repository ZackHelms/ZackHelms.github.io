// register.js — pick which streaming services you subscribe to. This is local only:
// streaming services have no public login API, so there are no credentials to store.
// Your selection is used to highlight/filter availability in Search (Phase 2).

import { store } from '../store.js';
import { allServices } from '../services.js';
import { el, clear } from '../ui.js';
import { focusFirst } from '../nav.js';

export function mountRegister(container) {
  let selected = new Set(store.getServices());

  function render() {
    clear(container);
    const section = el('section', { class: 'section' }, [
      el('div', { class: 'section-head' }, [el('h2', { text: 'My services' })]),
      el('p', { class: 'hint', text:
        'Select the services you subscribe to. Search results will highlight titles ' +
        'available on these. (No login required — selecting "Play" opens the service directly.)' }),
    ]);

    const grid = el('div', { class: 'svc-grid' },
      allServices().map(svc => {
        const on = selected.has(svc.id);
        return el('button', {
          class: 'svc-tile' + (on ? ' on' : ''), 'data-focusable': '',
          'aria-pressed': on ? 'true' : 'false',
          onclick: () => { selected = new Set(store.toggleService(svc.id)); render(); },
        }, [
          el('span', { class: 'svc-badge big', style: `background:${svc.color}`, text: svc.short }),
          el('span', { class: 'svc-name', text: svc.name }),
          el('span', { class: 'svc-check', text: on ? '✓ Subscribed' : 'Tap to add' }),
        ]);
      }));

    section.appendChild(grid);
    container.appendChild(section);
    focusFirst();
  }

  render();
}
