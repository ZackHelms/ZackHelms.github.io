/* cyoa2-player.js - the CYOA2 suite's OWN player (loaded into the page by drive-cyoa2.cjs, section U).
 *
 * A table of travellers played from the first morning to the report, by intents alone: it talks to everyone who
 * matters, settles what whispers it can, goes up the hill, fights (the monsters by their own script, the travellers
 * by a plain plan of its own), rests, searches, frees and reports. It shares no plan with the page: where the page
 * has a rule (who may be seen, what a thing offers) the player asks the engine for it, as a finger on the glass
 * would; what to DO about it is decided here.
 *
 * After every deed the engine accepts it checks that the tale is still whole (out.broken names the first thing that
 * was not). It is deterministic: the same seed and options give the same tale.
 *
 *   window.playTale(seed, { party: 4, tries: 6, log: false, tail: 0, keep: false })
 *     -> { won, tries, days, deaths, whispers, heard, fights, searched, gold, levels, quests, refused{}, broken, why, ending, log[], st? }
 */
window.playTale = function (seed, opts) {
  opts = opts || {};
  const st = newGame(seed), log = [], say = (s) => { if (log.length < 400) log.push(s); };
  const out = { seed, k: mainK(st), sides: sideKs(st), won: false, tries: 0, deaths: 0, whispers: 0, why: '', fights: 0, searched: 0, intents: 0, refused: {}, broken: '' };
  /* the tale is whole: nobody shares a square, nobody has more or less than their sheet allows, the purse is never in debt */
  const whole = () => {
    if (!Number.isInteger(st.gold) || st.gold < 0) return 'the purse holds ' + st.gold;
    const m = st.maps[st.here], at = new Set();
    for (const p of st.party) { if (!(p.hp >= 0 && p.hp <= p.hpMax)) return p.name + ' has ' + p.hp + '/' + p.hpMax; if (p.site !== st.here) return p.name + ' is not with the party'; if ((p.hp > 0) !== (p.status === 'ok')) return p.name + ' is ' + p.status + ' at ' + p.hp; const k = p.x + ',' + p.y; if (at.has(k)) return 'two pieces on ' + k; at.add(k); if (p.items.some((x) => !(x.q >= 1))) return p.name + ' carries none of something'; }
    for (const t of m.tokens) { const k = t.x + ',' + t.y; if (at.has(k)) return 'two pieces on ' + k; at.add(k); }
    for (const q of Object.values(st.quests)) if (!['active', 'done', 'failed'].includes(q.status)) return q.id + ' is ' + q.status;
    return '';
  };
  const I = (it) => { out.intents++; const r = intent(st, it); if (!r.ok) out.refused[it.t + ':' + r.why] = (out.refused[it.t + ':' + r.why] || 0) + 1; else if (!out.broken && !st.walk) { const w = whole(); if (w) out.broken = w + ' after ' + JSON.stringify(it).slice(0, 80); } return r; };
  for (let k = 1; k < (opts.party || 4); k++) I({ t: 'party', op: 'add' });
  const M = () => st.maps[st.here], L = () => leadOf(st);
  const fightLoop = () => {
    out.fights++;
    let mark = -1, quiet = 0;
    const tally = () => st.party.reduce((n, p) => n + p.hp, 0) + M().tokens.reduce((n, t) => n + (t.k === 'foe' ? sheetOf(st, t, true).hp : 0), 0) + M().tokens.length * 1000;
    for (let guard = 0; guard < 6000 && st.round && !st.over; guard++) {
      const a = turnOf(st);
      if (st.round.i === 0) { const t = tally(); quiet = t === mark ? quiet + 1 : 0; mark = t; }
      if (quiet > 12 * st.round.order.length) { if (!threatOf(st)) { I({ t: 'rounds', op: 'stop' }); out.broke = (out.broke || 0) + 1; return; } if (quiet > 60 * st.round.order.length) { out.stale = (out.stale || 0) + 1; I({ t: 'rounds', op: 'stop' }); return; } }
      if (!a) { I({ t: 'end' }); continue; }
      if (!a.pc) {   /* the monsters' own script, as the table runs it */
        let n = 0;
        for (; n < 10; n++) {
          const it = foePlan(st) || { t: 'end' };
          if (it.t === 'move') { const r = I({ t: 'move', who: a.id, to: it.to }); if (r.ok && r.path && r.path.length) { walkOut(st, a.id); continue; } }
          else if (it.t === 'attack' || it.t === 'dash') { const r = I(Object.assign({ who: a.id }, it)); if (r.ok) { if (!st.round) break; continue; } }
          break;
        }
        if (st.round && turnOf(st) && turnOf(st).id === a.id) I({ t: 'end' });
        continue;
      }
      const p = a.o, m = a.m, R = st.round, foes = () => m.tokens.filter((t) => t.k === 'foe');
      const hpOf = (t) => sheetOf(st, t, true).hp;
      const tryHit = () => {
        if (!st.round || st.round.act < 1) return false;
        const c = [];
        for (const w of weaponsOf(p)) for (const t of foes()) if (!reachWhy(m, p, t, w.rg)) c.push({ w, t });
        if (!c.length) return false;
        c.sort((x, y) => hpOf(x.t) - hpOf(y.t) || x.w.rg - y.w.rg);
        return I({ t: 'attack', who: p.id, target: c[0].t.id, attack: c[0].w.n }).ok;
      };
      const ab = (n) => p.abilities.find((x) => x.n === n && (x.max === null || x.uses > 0));
      /* mend first */
      if (p.hp <= p.hpMax * .45) {
        if (ab('Second Wind') && R.bonus > 0) I({ t: 'ability', who: p.id, name: 'Second Wind' });
        else if (p.items.some((x) => itemKey(x.n) === 'healing draught') && R.act > 0) I({ t: 'item', who: p.id, item: 'healing draught' });
      }
      if (st.round && ab('Healing Word') && R.bonus > 0) { const hurt = st.party.filter((q) => q.status !== 'dead' && q.hp <= q.hpMax * .4 && !reachWhy(m, p, q, 12)).sort((x, y) => x.hp - y.hp)[0]; if (hurt) I({ t: 'ability', who: p.id, name: 'Healing Word', target: hurt.id }); }
      if (st.round && ab('Cure Wounds') && st.round.act > 0) { const hurt = st.party.filter((q) => q.status !== 'dead' && q.hp <= q.hpMax * .35 && (q === p || meleeClear(m, p.x, p.y, q.x, q.y))).sort((x, y) => x.hp - y.hp)[0]; if (hurt) I({ t: 'ability', who: p.id, name: 'Cure Wounds', target: hurt.id }); }
      /* then the calling's best opening */
      if (st.round && R.n === 1 && ab('Bless') && st.round.act > 0 && foes().length >= 2) I({ t: 'ability', who: p.id, name: 'Bless' });
      if (st.round && ab('Sleep') && st.round.act > 0 && foes().length >= 2) { const t = foes().filter((q) => !reachWhy(m, p, q, 18))[0]; if (t) I({ t: 'ability', who: p.id, name: 'Sleep', target: t.id }); }
      if (st.round && ab('Magic Missile') && st.round.act > 0) { const t = foes().filter((q) => !reachWhy(m, p, q, 24)).sort((x, y) => hpOf(x) - hpOf(y))[0]; if (t) I({ t: 'ability', who: p.id, name: 'Magic Missile', target: t.id }); }
      if (st.round && ab('Hunter’s Mark') && st.round.bonus > 0 && !p.mark) { const t = foes().filter((q) => !reachWhy(m, p, q, 18))[0]; if (t) I({ t: 'ability', who: p.id, name: 'Hunter’s Mark', target: t.id }); }
      if (st.round && turnOf(st) && turnOf(st).id === p.id && !tryHit() && st.round && st.round.act > 0) {
        /* nobody in reach: close with the nearest, then try again */
        const goals = [];
        for (const t of foes()) for (let k = 0; k < 8; k++) { const x = t.x + STEPS[k][0], y = t.y + STEPS[k][1]; if (tileFree(m, x, y) && !taken(st, m, x, y, p.id) && meleeClear(m, x, y, t.x, t.y)) goals.push([x, y]); }
        let moved = false;
        if (!goals.length || !findPath(m, p.x, p.y, new Set(goals.map((g) => g[1] * m.w + g[0])), barrier(st, m, a, false))) { goals.length = 0; for (const t of foes()) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const x = t.x + dx, y = t.y + dy; if (tileFree(m, x, y) && !taken(st, m, x, y, p.id)) goals.push([x, y]); } }
        if (goals.length) {
          const far = route(st, a, goals, false);
          if (far.ok && far.path.length) { const r = I({ t: 'move', who: p.id, goals }); if (r.ok) { walkOut(st, p.id); moved = true; } }
          else {   /* too far for one turn: as far along the way as the feet go */
            const F = findPath(m, p.x, p.y, new Set(goals.map((g) => g[1] * m.w + g[0])), barrier(st, m, a, false));
            if (F) { let ft = 0, best = null; for (const q of F.path) { ft += tileCost(m, q[0], q[1]) * FT; if (ft > moveLeft(st.round)) break; if (!taken(st, m, q[0], q[1], p.id)) best = q; } if (best) { const r = I({ t: 'move', who: p.id, to: best }); if (r.ok) { walkOut(st, p.id); moved = true; } } }
          }
        }
        if (moved && st.round && turnOf(st) && turnOf(st).id === p.id) tryHit();
      }
      if (st.round && turnOf(st) && turnOf(st).id === p.id && ab('Action Surge') && st.round.act < 1 && foes().some((t) => weaponsOf(p).some((w) => !reachWhy(m, p, t, w.rg)))) { I({ t: 'ability', who: p.id, name: 'Action Surge' }); tryHit(); }
      if (st.round && turnOf(st) && turnOf(st).id === p.id) I({ t: 'end' });
    }
  };
  /* a walk to its end; a fight that starts on the way is fought */
  const walk = (goals, then) => {
    for (let tries = 0; tries < 6; tries++) {
      if (st.over) return false;
      const r = I({ t: 'move', goals, then, known: false });
      if (!r.ok) return false;
      if (!r.path) return true;                       /* already there: the engine did the rest */
      let next = null, halted = false;
      for (let k = 0; k < 900 && st.walk; k++) { const s = I({ t: 'step', who: st.walk.who }); if (!s.ok) break; if (s.halted || (!st.round && threatOf(st))) { halted = true; break; } if (s.done) { next = s.next; break; } }
      if (st.walk) I({ t: 'halt' });
      if (halted) { const m = M();
        /* a word first, where there is one: the chief's old name */
        { const c = m.tokens.find((t) => t.npc === 'N5'); if (c && visOf(st).g[c.y * m.w + c.x] && has('N5', 'name')) { const b = best(['persuasion']); if (b) I({ t: 'lead', id: b.p.id }); const r = ask('N5', 'name'); out.called = r.ok ? (r.next === 'fight' ? 'failed' : 'worked') : 'refused'; if (r.ok && r.next !== 'fight') { if (threatOf(st)) { I({ t: 'rounds', op: 'start' }); fightLoop(); } continue; } } }
        I({ t: 'rounds', op: 'start' }); fightLoop(); if (st.over || st.here !== m.id || st.round) return false; if (st.party.some((p) => p.status !== 'ok' && p.status !== 'dead') || st.party.filter((p) => p.status === 'ok').some((p) => p.hp < p.hpMax * .5)) return false; continue; }
      if (next) { const z = I(Object.assign({ who: L().id }, next)); return z.ok ? z : false; }
      return true;
    }
    return false;
  };
  const goSite = (id) => {
    for (let guard = 0; guard < 6 && st.here !== id && !st.over; guard++) {
      const m = M();
      let e = m.exits.find((x) => x.to === id);
      if (!e) e = m.exits.find((x) => x.to === 'S0') || m.exits[0];
      const res = walk(exitGoals(m, e), { t: 'travel' });
      if (!res) return false;
      if (st.here === m.id) { const t = I({ t: 'travel' }); if (!t.ok) return false; }
    }
    return st.here === id;
  };
  const near = (npcId) => {
    const m = M(), t = m.tokens.find((q) => q.npc === npcId);
    if (!t) return false;
    if (visOf(st).g[t.y * m.w + t.x] && cheb(t, L()) <= 4) return true;
    const A = anchorOf(st, m, npcId);
    return !!(A && A.stand.length && walk(A.stand) && visOf(st).g[t.y * m.w + t.x]);
  };
  const ask = (npcId, topic) => { const r = I({ t: 'talk', npc: npcId, topic }); if (r.ok) say(npcId + '/' + topic + ': ' + r.text.slice(0, 90) + (r.lines.length ? ' [' + r.lines.map((z) => z.t).join(' | ') + ']' : '')); return r; };
  const has = (npcId, topic) => topicsFor(st, npcId).some((x) => x.id === topic && !x.off);
  const best = (list) => { let b = null; for (const p of st.party) { if (p.status !== 'ok') continue; const c = bestCheck(p, list); if (!b || c.mod > b.mod) b = { p, mod: c.mod }; } return b; };
  const visit = (siteId, npcId, fn) => { if (st.over) return false; if (!goSite(siteId)) { say('cannot reach ' + siteId); return false; } if (!near(npcId)) { say('cannot find ' + npcId + ' at ' + siteId); return false; } fn(); return true; };
  const whispersWith = (npcId) => {
    for (const w of sideKs(st)) {
      const W = WHISPERS[w];
      if (W.who !== npcId || flag(st, 'done:' + w)) continue;
      /* each traveller may ask once: the best talker first */
      const order = W.check ? st.party.filter((p) => p.status === 'ok').sort((x, y) => bestCheck(y, W.check).mod - bestCheck(x, W.check).mod) : [L()];
      for (const p of order) { if (flag(st, 'done:' + w)) break; I({ t: 'lead', id: p.id }); if (has(npcId, 'w:' + w)) ask(npcId, 'w:' + w); }
    }
  };
  const townRound = () => {
    for (const [site, id] of [['S1', 'N0'], ['S0', 'N4'], ['S5', 'N3'], ['S3', 'N1'], ['S4', 'N2']]) if (sideKs(st).some((w) => !flag(st, 'heard:' + w))) visit(site, id, () => { ask(id, 'news'); });
    visit('S1', 'N0', () => { ask('N0', 'gang'); ask('N0', 'news'); ask('N0', 'news'); whispersWith('N0'); });
    visit('S0', 'N4', () => { if (has('N4', 'job')) ask('N4', 'job'); ask('N4', 'matter'); ask('N4', 'news'); ask('N4', 'news'); whispersWith('N4'); });
    visit('S5', 'N3', () => { if (has('N3', 'job')) ask('N3', 'job'); ask('N3', 'news'); ask('N3', 'news'); whispersWith('N3'); });
    visit('S3', 'N1', () => { ask('N1', 'news'); ask('N1', 'news'); whispersWith('N1'); });
    visit('S4', 'N2', () => { ask('N2', 'news'); ask('N2', 'news'); whispersWith('N2'); while (st.gold >= 12 + 4 && has('N2', 'buy:healing draught') && st.party.reduce((n, p) => n + p.items.filter((x) => itemKey(x.n) === 'healing draught').reduce((a, x) => a + x.q, 0), 0) < 4) ask('N2', 'buy:healing draught'); });
    /* whoever was told of something after their own door was passed gets a second call */
    visit('S1', 'N0', () => whispersWith('N0'));
    visit('S5', 'N3', () => whispersWith('N3'));
    visit('S3', 'N1', () => whispersWith('N1'));
    visit('S4', 'N2', () => whispersWith('N2'));
  };
  const mend = () => {   /* back at the inn: sleep, and see the priest if anyone is still hurt */
    if (st.over) return;
    if (goSite('S1')) { const r = I({ t: 'rest', kind: 'long' }); say('rest: ' + (r.ok ? r.say : r.why)); }
  };
  const cave = () => {
    if (!goSite('S2')) return false;
    const m = M(), here = m.id;
    const hurt = () => st.party.some((p) => p.status !== 'ok' && p.status !== 'dead') || st.party.filter((p) => p.status === 'ok').some((p) => p.hp < p.hpMax * .5);
    const breath = () => { if (!hurt()) return true; I({ t: 'rest', kind: 'short' }); return !hurt(); };
    /* every chamber, nearest first; then every thing that offers something; then the cell */
    for (let pass = 0; pass < 3 && !st.over && st.here === here; pass++) {
      const rooms = m.rooms.map((r, k) => k).sort((a, b) => a - b);
      for (const k of rooms) {
        if (st.over || st.here !== here || st.round || !breath()) return false;
        const goals = []; for (let i = 0; i < m.w * m.h; i++) if (m.rg[i] === k + 1 && tileFree(m, i % m.w, (i - i % m.w) / m.w)) goals.push([i % m.w, (i - i % m.w) / m.w]);
        if (goals.length) walk(goals);
      }
      if (st.over || st.here !== here) return false;
      if (!m.tokens.some((t) => t.k === 'foe')) break;
    }
    if (st.over || st.here !== here || st.round) return false;
    if (m.tokens.some((t) => t.k === 'foe')) return false;
    for (let pass = 0; pass < 2; pass++) {
      for (const o of m.objs.slice()) {
        if (o.on) continue;
        for (let n = 0; n < 8; n++) {
          const V = verbsFor(st, o.id).filter((v) => !v.off);
          if (!V.length) break;
          const v = V.find((x) => x.verb === 'search') || V.find((x) => x.verb === 'unlock') || V[0], T = thingOf(st, m, o.id);
          if (!T.stand.length) break;
          if (v.verb === 'pick' || v.verb === 'force') { const b = best([v.verb === 'pick' ? 'sleight of hand' : 'athletics']); const who = st.party.filter((p) => p.status === 'ok' && !flag(st, 'tried:' + thingKey(m, o.id) + ':' + v.verb + ':' + p.id)).sort((x, y) => bestCheck(y, [v.verb === 'pick' ? 'sleight of hand' : 'athletics']).mod - bestCheck(x, [v.verb === 'pick' ? 'sleight of hand' : 'athletics']).mod)[0]; if (!who) break; I({ t: 'lead', id: who.id }); }
          const r = walk(T.stand, { t: 'use', what: o.id, verb: v.verb });
          if (!r) break;
          if (r.t === 'use') { if (r.verb === 'search') out.searched++; say(o.id + '/' + r.verb + ': ' + r.lines.map((z) => z.t).join(' | ')); }
          if (st.round || st.here !== here) break;
        }
      }
      for (const d of m.doors) {
        if (!d.lock) continue;
        for (let n = 0; n < 14 && d.lock; n++) {
          const V = verbsFor(st, d.id);
          const v = V.find((x) => x.verb === 'unlock') || V.filter((x) => !x.off)[0];
          if (!v) { const who = st.party.find((p) => p.status === 'ok' && V.some((x) => !flag(st, 'tried:' + thingKey(m, d.id) + ':' + x.verb + ':' + p.id))); if (!who || who === L()) break; I({ t: 'lead', id: who.id }); continue; }
          const r = walk(doorSides(d), { t: 'use', what: d.id, verb: v.verb });
          if (!r) break;
          if (r.t === 'use') say(d.id + '/' + r.verb + ': ' + r.lines.map((z) => z.t).join(' | ') + (r.text ? ' "' + r.text.slice(0, 60) + '"' : ''));
        }
      }
      if (st.npcs.N6 && st.npcs.N6.kind === 'captive' && m.tokens.some((t) => t.npc === 'N6') && has('N6', 'free')) { if (near('N6')) ask('N6', 'free'); }
    }
    return true;
  };
  try {
    townRound();
    for (out.tries = 1; out.tries <= (opts.tries || 6) && !st.over; out.tries++) {
      const done = cave();
      if (st.over) break;
      if (goalMet(st) && (done || st.here !== 'S2')) break;
      if (done && !M().tokens.some((t) => t.k === 'foe') && goalMet(st)) break;
      if (done && !goalMet(st) && !M().tokens.some((t) => t.k === 'foe')) { say('the cave is clear and the goal is not met'); break; }
      mend();
    }
    if (!st.over && goalMet(st)) {
      const g = giverOf(st), home = st.npcs[g].home;
      visit(home, g, () => { whispersWith(g); if (has(g, 'report')) { const r = ask(g, 'report'); out.won = r.ok && st.quests.Q0.status === 'done'; out.next = r.next; } });
      visit('S0', 'N4', () => whispersWith('N4'));
    }
    if (!out.won) out.why = st.over ? 'the tale ended: ' + st.over : !goalMet(st) ? 'goal not met' : 'could not report';
  } catch (e) { out.why = 'THREW ' + e.message + ' @ ' + String(e.stack).split('\n')[1]; }
  out.days = st.time.day; out.deaths = st.fallen.length; out.whispers = sideKs(st).filter((w) => flag(st, 'done:' + w)).length; out.heard = sideKs(st).filter((w) => flag(st, 'heard:' + w)).length;
  out.gold = st.gold; out.levels = st.party.map((p) => p.cls[0] + p.level).join(' '); out.quests = Object.values(st.quests).map((q) => q.id + ':' + q.status).join(' ');
  out.ending = out.won ? beatText(st, 'ending') : '';
  out.log = opts.log ? log : log.slice(-(opts.tail || 0));
  out.st = opts.keep ? st : undefined;
  return out;
};
