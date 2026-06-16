// menu.js — Start menu: Save / Load / Settings dialog.
//
// Opened by the Start button. Shows a dialog over a gray overlay that blocks
// interaction with the game controls (the engine's pointer handler ignores
// events inside #menu-overlay; gameplay is paused while open). Closes on the ✕,
// a click outside the dialog, or Escape.
//
// Settings menu is generated dynamically from the loaded settings object, so it
// stays in sync with settings.json automatically: every key becomes a control.
// `char1_sprite_prefix` and `map` render as dropdowns populated from the asset
// manifest; everything else renders as a text box. Edits are persisted as
// overrides in localStorage (merged over settings.json at boot) — see the
// "Settings ↔ in-game menu sync" SOP in CLAUDE.md.

const MENU_OVERRIDES_KEY = 'lowres_settings_overrides';
const MENU_SAVE_KEY      = 'lowres_savegame';

// Settings keys that render as dropdowns, mapped to the manifest list they pull
// their options from.
const MENU_DROPDOWNS = {
  char1_sprite_prefix: 'sprites',
  map: 'maps',
};

// Friendlier labels for a few keys (falls back to the raw key name).
const MENU_LABELS = {
  char1_sprite_prefix: 'character_type',
};

function initMenu(game, settings, manifest, defaults = {}) {
  const overlay  = document.getElementById('menu-overlay');
  const closeBtn = document.getElementById('menu-close');
  const title    = document.getElementById('menu-title');
  const status   = document.getElementById('menu-status');
  const form     = document.getElementById('settings-form');
  const applyBtn = document.getElementById('settings-apply');
  if (!overlay) return { open() {}, close() {} };

  const views = {
    main:     document.getElementById('menu-main'),
    settings: document.getElementById('menu-settings'),
  };
  const titles = { main: 'Menu', settings: 'Settings' };

  function setStatus(msg) { status.textContent = msg || ''; }

  function showView(name) {
    for (const [key, el] of Object.entries(views)) el.hidden = (key !== name);
    title.textContent = titles[name] || 'Menu';
    if (name === 'settings') buildSettings();
  }

  // ── Settings form (built from the current settings) ──────────────────────
  function buildSettings() {
    form.innerHTML = '';
    for (const [key, value] of Object.entries(settings)) {
      if (key.startsWith('_')) continue;
      const row = document.createElement('div');
      row.className = 'settings-row';

      const label = document.createElement('label');
      label.textContent = MENU_LABELS[key] || key;
      label.htmlFor = `set-${key}`;
      row.appendChild(label);

      let field;
      if (MENU_DROPDOWNS[key]) {
        field = document.createElement('select');
        const opts = (manifest && manifest[MENU_DROPDOWNS[key]]) || [];
        const list = opts.length ? opts.slice() : [String(value)];
        if (!list.includes(String(value))) list.unshift(String(value));
        for (const opt of list) {
          const o = document.createElement('option');
          o.value = opt; o.textContent = opt;
          field.appendChild(o);
        }
        field.value = String(value);
      } else {
        field = document.createElement('input');
        field.type = 'text';
        field.value = value;
      }
      field.id = `set-${key}`;
      field.dataset.key = key;
      row.appendChild(field);
      form.appendChild(row);
    }
  }

  function applySettings() {
    const overrides = {};
    form.querySelectorAll('[data-key]').forEach(field => {
      const key = field.dataset.key;
      let val = field.value;
      // Coerce to a number when the default for this key is numeric.
      if (typeof defaults[key] === 'number') {
        const n = parseFloat(val);
        if (Number.isFinite(n)) val = n;
      }
      // Persist only values that differ from the settings.json default, so
      // later edits to settings.json still take effect for untouched keys.
      if (!(key in defaults) || val !== defaults[key]) overrides[key] = val;
    });
    try {
      localStorage.setItem(MENU_OVERRIDES_KEY, JSON.stringify(overrides));
    } catch (_) {}
    location.reload();
  }

  // ── Save / Load ──────────────────────────────────────────────────────────
  function doSave() {
    try {
      localStorage.setItem(MENU_SAVE_KEY, JSON.stringify(game.getState()));
      setStatus('Game saved.');
    } catch (_) {
      setStatus('Save failed (storage unavailable).');
    }
  }

  function doLoad() {
    let state = null;
    try { state = JSON.parse(localStorage.getItem(MENU_SAVE_KEY)); } catch (_) {}
    if (!state) { setStatus('No saved game found.'); return; }
    game.loadState(state);
    setStatus(`Loaded: ${state.char1_sprite_prefix} on ${state.map} at (${state.tileX}, ${state.tileY}).`);
  }

  // ── Open / close ───────────────────────────────────────────────────────────
  function open() {
    game.paused = true;
    game.input.clearAll();
    setStatus('');
    showView('main');
    overlay.hidden = false;
  }

  function close() {
    overlay.hidden = true;
    game.paused = false;
  }

  // ── Wiring ─────────────────────────────────────────────────────────────────
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) close();
  });

  views.main.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action], [data-view]');
    if (!btn) return;
    if (btn.dataset.view) showView(btn.dataset.view);
    else if (btn.dataset.action === 'save') doSave();
    else if (btn.dataset.action === 'load') doLoad();
  });

  views.settings.addEventListener('click', (e) => {
    const back = e.target.closest('[data-view]');
    if (back) { setStatus(''); showView(back.dataset.view); }
  });
  applyBtn.addEventListener('click', applySettings);

  return { open, close };
}
