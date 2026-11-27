// ui.js — the DOM around the canvas: control panel (clock, speed, follow), the goals board
// (control A), the settler panel with their plan (control B), speech bubbles, overlays.
// Panels are rebuilt from signatures, in parts, never while a pointer is down in them.
import { GOALS, LESSONS, FOUNDERS, BUILDINGS, hhmm } from './data.js';
import { clockOf, mealUnits, foodTarget, goalDone, goalOpen, hourOf } from './sim.js';
import { lessonParam, forecastNeeds } from './brain.js';

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const SPEEDS = [0, 1, 2, 4, 8, 16];
const METERS = [['health', 'Health'], ['energy', 'Energy'], ['hunger', 'Fed'], ['mood', 'Mood'], ['clean', 'Clean'], ['bladder', 'Bladder'], ['bowel', 'Bowel']];
const ACT_WORD = { walk: 'walking', run: 'running', chop: 'chopping', mine: 'breaking stone', pick: 'picking up', build: 'building', cook: 'cooking', eat: 'eating', sleep: 'asleep', collapsed: 'collapsed', sit: 'resting', talk: 'talking', bathe: 'washing', forage: 'foraging', trap: 'setting snares', fish: 'fishing', squat: 'in private', maintain: 'sharpening tools', look: 'looking around', drop: 'setting down', idle: 'idle' };

export function makeUI(api) {
  const ui = { held: false, parts: {}, bubbleEls: new Map(), shown: new Set() };
  document.addEventListener('pointerdown', (e) => { if (e.target.closest('.side')) ui.held = true; });
  document.addEventListener('pointerup', () => { ui.held = false; });

  // speeds
  const sp = $('#speeds');
  SPEEDS.forEach((v, i) => {
    const b = document.createElement('button'); b.className = 'spd'; b.textContent = v ? v + '×' : '⏸'; b.dataset.i = i;
    b.addEventListener('click', () => api.setSpeed(i)); sp.appendChild(b);
  });
  // follow
  const fsel = $('#follow-sel');
  api.sim().settlers.forEach((s) => { const o = document.createElement('option'); o.value = s.id; o.textContent = s.name + ' · ' + s.title; fsel.appendChild(o); });
  fsel.addEventListener('change', () => api.follow(fsel.value === '' ? null : +fsel.value));
  $('#settler-close').addEventListener('click', () => api.follow(null));
  // goals
  $('#goal-add').addEventListener('change', (e) => { if (e.target.value) api.input({ type: 'goalAdd', id: e.target.value }); e.target.value = ''; });
  $('#goal-list').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const sim = api.sim(), id = b.dataset.g, i = sim.goals.indexOf(id);
    if (b.dataset.a === 'up') api.input({ type: 'goalMove', id, to: i - 1 });
    if (b.dataset.a === 'down') api.input({ type: 'goalMove', id, to: i + 1 });
    if (b.dataset.a === 'rm') api.input({ type: 'goalRemove', id });
  });
  $('#settler-body').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const sid = api.selected(); if (sid == null) return;
    const i = +b.dataset.i, itemId = b.dataset.id == null ? null : +b.dataset.id;
    if (b.dataset.a === 'now') api.input({ type: 'doNow', sid, idx: i, itemId });
    if (b.dataset.a === 'up') api.input({ type: 'reorder', sid, from: i, to: i - 1, itemId });
    if (b.dataset.a === 'later') api.input({ type: 'later', sid, need: b.dataset.n, hours: 1 });
  });
  $('#info-btn').addEventListener('click', () => showInfo());
  $('#gear-btn').addEventListener('click', () => showSettings());
  $('#overlay').addEventListener('click', (e) => { if (e.target.id === 'overlay') hideOverlay(); });

  function part(name, sig, el, html) {
    if (ui.parts[name] === sig || (ui.held && el.closest('.side'))) return false;
    const sc = el.closest('.side'), top = sc ? sc.scrollTop : 0;
    el.innerHTML = html; ui.parts[name] = sig;
    if (sc) sc.scrollTop = top;
    return true;
  }

  function goals() {
    const sim = api.sim();
    const rows = sim.goals.map((g, i) => {
      const G = GOALS[g]; if (!G) return '';
      const done = goalDone(sim, g), open = goalOpen(sim, g);
      let st = done ? 'done ✓' : !open ? 'waits for ' + G.prereq.filter((p) => !goalDone(sim, p)).map((p) => GOALS[p].label).join(', ') : '';
      if (!done && open) {
        if (G.food) st = mealUnits(sim).toFixed(0) + ' / ' + foodTarget(sim) + ' meals stored';
        else {
          const xs = sim.sites.filter((x) => x.goal === g);
          if (!xs.length) st = 'not started';
          else { const need = xs.reduce((a, x) => a + x.need.wood + x.need.stone, 0), have = xs.reduce((a, x) => a + x.have.wood + x.have.stone, 0), prog = xs.reduce((a, x) => a + x.prog, 0) / xs.reduce((a, x) => a + x.hours, 0); st = prog > 0 ? 'building ' + Math.round(prog * 100) + '%' : 'materials ' + have + ' / ' + need; }
        }
      }
      return `<li class="${done ? 'done' : ''}"><span class="gl">${i + 1}. ${esc(G.label)}<span class="gs">${esc(st)}</span></span>` +
        `<button class="mini" data-a="up" data-g="${g}" aria-label="Move up" ${i ? '' : 'disabled'}>▲</button><button class="mini" data-a="down" data-g="${g}" aria-label="Move down">▼</button><button class="mini" data-a="rm" data-g="${g}" aria-label="Remove">✕</button></li>`;
    }).join('');
    part('goals', rows, $('#goal-list'), rows);
    const opts = Object.keys(GOALS).filter((g) => !sim.goals.includes(g));
    const sig = opts.join();
    part('goaladd', sig, $('#goal-add'), '<option value="">+ add a goal</option>' + opts.map((g) => `<option value="${g}">${esc(GOALS[g].label)}</option>`).join(''));
  }

  function settler() {
    const sim = api.sim(), sid = api.selected(), box = $('#settler');
    if (sid == null) { box.classList.add('hidden'); ui.parts.sHead = null; return; }
    box.classList.remove('hidden');
    const s = sim.settlers[sid], F = FOUNDERS[sid];
    const body = $('#settler-body');
    if (!body.querySelector('#s-head') || ui.parts.sId !== sid) {
      ui.parts.sId = sid; ui.parts.sMeters = ui.parts.sMind = ui.parts.sPlan = null;
      const L = s.look;
      body.innerHTML = `<div id="s-head"></div><h3>Now</h3><div id="s-now"></div><h3>Next</h3><div id="s-next"></div><h3>Needs</h3><div id="s-meters"></div><div id="s-mind"></div>`;
      $('#s-head').innerHTML = `<div class="who"><div class="swatch" style="background:linear-gradient(${L.hair} 0 18%,${L.skin} 18% 34%,${L.shirt} 34% 66%,${L.pants} 66% 92%,${L.boots} 92%)"></div><div><h2 style="margin:0">${esc(s.name)}</h2><div class="role">${esc(s.title)} · founder · perseverance</div></div></div>` +
        `<h3>Attributes</h3><div class="attrs">${Object.entries(s.attrs).map(([k, v]) => `<div>${v}<small>${k}</small></div>`).join('')}</div>` +
        `<h3>Character</h3><div class="tags"><em>Strengths:</em> ${esc(F.strengths.join(', '))}<br><em>Weaknesses:</em> ${esc(F.weaknesses.join(', '))}<br><em>Likes:</em> ${esc(F.prefs.join(', '))}<br><em>Goals:</em> ${esc(F.goals.join(', '))}<br><em>Fears:</em> ${esc(F.fears.join(', '))}</div>`;
    }
    // meters: values change every tick, so update in place
    const mEl = $('#s-meters');
    if (!mEl.children.length) mEl.innerHTML = METERS.map(([k, l]) => `<div class="meter" data-k="${k}"><span>${l}</span><div class="bar"><i></i><b style="left:50%"></b><b style="left:80%"></b></div><span class="v"></span></div>`).join('');
    for (const row of mEl.children) {
      const k = row.dataset.k, v = s.m[k], i = row.querySelector('i');
      i.style.width = v.toFixed(1) + '%';
      i.style.background = v < 25 ? 'var(--red)' : v < 50 ? 'var(--gold)' : v > 80 ? 'var(--blue)' : 'var(--green)';
      row.querySelector('.v').textContent = Math.round(v) + '%';
    }
    // what they are doing now, and the plan
    const T = s.task;
    const nowSig = T ? T.id + ':' + T.i + ':' + s.act : 'none';
    part('sNow', nowSig, $('#s-now'), T ? `<div class="task now"><div class="tl"><b>${esc(T.label)}</b>${T.pinned ? ' <span class="role">(your order)</span>' : ''} <span class="role">· ${esc(ACT_WORD[s.act] || s.act)}</span><div class="steps">${T.steps.map((st, j) => `<span class="${j === T.i ? 'cur' : ''}">${j < T.i ? '✓ ' : j === T.i ? '▸ ' : '· '}${esc(st.label || st.act || st.do)}</span>`).join('<br>')}</div></div></div>` : '<div class="log">thinking…</div>');
    const fc = forecastNeeds(sim, s);
    const planSig = s.plan.map((it) => it.id + it.kind + (it.owner || '')).join() + '|' + fc.map((f) => f.label).join() + '|' + (s.delay ? JSON.stringify(s.delay) : '');
    part('sPlan', planSig, $('#s-next'), s.plan.map((it, i) => `<div class="task"><span class="tl">${esc(it.label || it.kind)}${it.owner === 'player' ? ' <span class="role">(moved by you)</span>' : it.steps ? ' <span class="role">(paused)</span>' : ''}</span><button class="mini" data-a="up" data-i="${i}" data-id="${it.id}" ${i ? '' : 'disabled'} aria-label="Earlier">▲</button><button class="mini" data-a="now" data-i="${i}" data-id="${it.id}">Do now</button></div>`).join('') +
      fc.map((f) => `<div class="task"><span class="tl" style="color:var(--dim)">${esc(f.label)}</span><button class="mini" data-a="later" data-n="${f.kind}">Later</button></div>`).join(''));
    // the mind: lessons, friends, recent log
    const lessons = Object.entries(s.lessons).map(([k, l]) => `<li>✦ ${esc(LESSONS[k].label)} <span class="role">— ${esc(LESSONS[k].fmt(l.v))} (day ${l.day})</span></li>`).join('') || '<li class="role">none yet</li>';
    const friends = Object.entries(s.rel).sort((a, b) => b[1] - a[1]).map(([id, v]) => `${esc(sim.settlers[id].name)} ${Math.round(v)}`).join(' · ');
    const logs = s.log.slice(-6).reverse().map((l) => { const c = clockOf({ t: l.t }); return `<div>D${c.day} ${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')} ${esc(l.text)}</div>`; }).join('');
    const mindSig = lessons + friends.replace(/\d+/g, (n) => Math.round(n / 5)) + logs;
    part('sMind', mindSig, $('#s-mind'), `<h3>Lessons learned</h3><ul>${lessons}</ul><h3>Friends</h3><div class="tags">${friends}</div><h3>Recently</h3><div class="log">${logs || '—'}</div>`);
  }

  function topbar() {
    const sim = api.sim(), c = clockOf(sim);
    $('#clock').textContent = `Day ${c.day} · ${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}${api.nightSkip() ? ' ⏩' : ''}`;
    for (const b of document.querySelectorAll('.spd')) b.classList.toggle('on', +b.dataset.i === api.speedIdx());
    const v = api.selected() == null ? '' : String(api.selected());
    if (fsel.value !== v) fsel.value = v;
  }

  // speech bubbles over heads, for 8 real seconds each
  function bubbles(project, nowReal) {
    const sim = api.sim(), root = $('#bubbles');
    // a line is shown once: `shown` remembers it for as long as the sim still holds it
    const held = new Set(sim.bubbles.map((b) => b.id));
    for (const id of ui.shown) if (!held.has(id)) ui.shown.delete(id);
    for (const b of sim.bubbles) if (!ui.shown.has(b.id) && b.t >= api.loadedAt()) {
      ui.shown.add(b.id);
      const el = document.createElement('div'); el.className = 'bubble ' + (b.kind === 'refuse' ? 'refuse' : '');
      el.innerHTML = `<span class="bn">${esc(sim.settlers[b.sid].name)}</span>${esc(b.text)}`;
      root.appendChild(el); ui.bubbleEls.set(b.id, { el, born: nowReal, sid: b.sid });
    }
    const live = [...ui.bubbleEls.entries()];
    const perSettler = {};
    for (let i = live.length - 1; i >= 0; i--) {
      const [id, o] = live[i];
      const old = nowReal - o.born > 8 || (perSettler[o.sid] = (perSettler[o.sid] || 0) + 1) > 1 || live.length - i > 4;
      if (old) { o.el.remove(); ui.bubbleEls.delete(id); continue; }
      const p = project(o.sid);
      if (!p) { o.el.style.display = 'none'; continue; }
      o.el.style.display = ''; o.el.style.left = p.sx + 'px'; o.el.style.top = (p.sy - 14) + 'px';
    }
  }

  function overlay(html) { $('#overlay-card').innerHTML = html; $('#overlay').classList.remove('hidden'); api.overlayOpen(true); }
  function hideOverlay() { $('#overlay').classList.add('hidden'); api.overlayOpen(false); }
  function showInfo() {
    overlay(`<h1>Colony Sim</h1>
<p>Four settlers, chosen by the people paying for their expedition, have landed on an island with one set of tools and a crate of rations. Watch them make a camp, learn from their mistakes and get ready for a fifth.</p>
<h3>Camera</h3><p>Drag to orbit · right-drag or shift-drag to pan · wheel to zoom · WASD / arrows to move · Q / E to turn · click a settler to follow them · pick one from <em>follow</em> to fly to them.</p>
<h3>Time</h3><p>A day is 30 minutes at 1×. Space pauses; 1–6 pick a speed. While everyone sleeps the night runs at 16× (⏩).</p>
<h3>Goals (left)</h3><p>The leader turns these into jobs and hands them out. Reorder them with ▲▼, remove with ✕, add from the list. A goal waits until the ones it needs are done.</p>
<h3>A settler (right)</h3><p>Needs: 50–80% is normal; below 50% they work worse; above 80% better, up to +20% at 100%. <b>Next</b> is their plan: ▲ moves a job earlier, <b>Do now</b> makes it their next order, <b>Later</b> puts off sleep or a meal. Until they have learned better they obey, even when it hurts them. Once a mistake has taught them a lesson, they refuse and say why.</p>
<h3>Phase 1</h3><p>Done when the camp has a fire, a lean-to, storage, a food store, a latrine, two huts, five beds and a tool bench, holds three days of food for five, and nobody has dropped below 50% on health, energy, food, mood or cleanliness for two days.</p>
<h3>Sky</h3><p>The real sky over an island at 15°S in the South Pacific, from 5 July 2027 on: each game day is the next date, so the moon runs through its phases. Drawn by zmh-sky. Star data: XHIP (Anderson &amp; Francis 2012) via d3-celestial, (c) 2015 Olaf Frohn, BSD-3-Clause; constellation lines after the IAU figures, modified by O. Frohn; planet elements: JPL (Standish), Table 1. <a href="LICENSE-d3-celestial.txt" target="_blank" rel="noopener">Licence</a>.</p>
<p class="role">First draft. Graphics are deliberately blocky for now.</p>
<button class="btn" id="ov-ok">Back to the island</button>`);
    $('#ov-ok').addEventListener('click', hideOverlay);
  }
  function showSettings() {
    overlay(`<h1>Settings</h1>
<p>Island seed: <b>${api.sim().seed}</b> · day ${clockOf(api.sim()).day}</p>
<p><label>New island with seed <input id="seed-in" type="number" value="${Math.floor(Math.random() * 99999)}" style="width:110px;background:#141c16;color:var(--ink);border:1px solid var(--border);border-radius:5px;font:inherit;padding:2px 5px"></label></p>
<button class="btn" id="ov-new">Start a new island</button><button class="btn alt" id="ov-ok">Back</button>`);
    $('#ov-ok').addEventListener('click', hideOverlay);
    $('#ov-new').addEventListener('click', () => { const v = Math.max(1, Math.floor(+$('#seed-in').value) || 1); hideOverlay(); api.newGame(v); });
  }
  function showPhase1(sim) {
    const S = sim.settlers;
    overlay(`<h1>Phase 1 complete</h1>
<p>Day ${sim.phase1.day}: the camp is self-sufficient. It has shelter and beds for five, three days of food, and a tool bench. Everyone has stayed in good shape for two days running.</p>
<p>${S.map((s) => `<b>${esc(s.name)}</b>: ${Object.keys(s.lessons).length} lessons, lowest ${Math.round(s.stats.lowest)}% (${s.stats.lowWhat})`).join('<br>')}</p>
<p class="role">Inviting a fifth settler comes in a later draft. The colony carries on in the meantime.</p>
<button class="btn" id="ov-ok">Keep watching</button>`);
    $('#ov-ok').addEventListener('click', hideOverlay);
  }
  function showLoad(day, onGo, onNew) {
    overlay(`<h1>Colony Sim</h1><p>Your island is waiting on day ${day}.</p><button class="btn" id="ov-go">Continue</button><button class="btn alt" id="ov-new">New island</button>`);
    $('#ov-go').addEventListener('click', () => { hideOverlay(); onGo(); });
    $('#ov-new').addEventListener('click', () => { hideOverlay(); onNew(); });
  }
  ui.update = (project, nowReal, full) => { topbar(); if (full) { goals(); } settler(); bubbles(project, nowReal); };
  ui.refreshAll = () => { ui.parts = {}; ui.shown.clear(); $('#settler-body').innerHTML = ''; for (const [, o] of ui.bubbleEls) o.el.remove(); ui.bubbleEls.clear(); };
  ui.showPhase1 = showPhase1; ui.showLoad = showLoad; ui.hideOverlay = hideOverlay; ui.showInfo = showInfo;
  return ui;
}
