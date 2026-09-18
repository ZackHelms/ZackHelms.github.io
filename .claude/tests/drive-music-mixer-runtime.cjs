#!/usr/bin/env node
/**
 * drive-music-mixer-runtime.cjs — runtime gate for Music Mixer.
 *
 * drive-music-mixer.cjs proves the NOTATION is well formed. This proves the
 * two things that only a browser can: the SOUND path (every pattern character
 * in all five songs reaches a voice that can render it, the transport
 * schedules notes, holding every pad produces a non-silent signal at the
 * limiter), the CONTACT-PATCH hit test (one fingertip on a seam holds both
 * pads, and the CD's eight-finger grip really does hold all fifteen), and the
 * two-mode TAP-TO-LOCK state machine, whose awkward case — locks surviving a
 * switch back to hold mode, then released by a tap — is pure edge handling
 * and unreadable from the code.
 *
 * Two things make this worth a Chromium launch. First, a voice that throws on
 * one character (a gong handed an 'X', a filter handed a NaN frequency) kills
 * the whole scheduling tick, so one bad char silences fourteen good tracks —
 * and only for the sections that use it, which a live listen may never reach.
 * Second, "the pads light up" is not evidence of audio: the lamp is CSS and
 * runs fine with the audio graph completely dead.
 *
 * Usage: NODE_PATH=/opt/node22/lib/node_modules/playwright/node_modules \
 *          node .claude/tests/drive-music-mixer-runtime.cjs
 *
 * Final line: MIXER-RUNTIME: GREEN | RED   (exit 0 / 1)
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');

const PAGE = path.join(process.cwd(), 'games', 'music-mixer', 'index.html');
const CHROME = process.env.SMOKE_CHROMIUM || '/opt/pw-browsers/chromium';
const problems = [];
const fail = (m) => problems.push(m);
const NOISE = /fonts\.googleapis|fonts\.gstatic|net::ERR_|favicon/i;

(async () => {
  if (!fs.existsSync(PAGE)) { console.log('MIXER-RUNTIME: RED'); console.error('missing ' + PAGE); process.exit(1); }
  const browser = await chromium.launch({
    executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
    args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
  });
  /* hasTouch so Chromium emits real TouchEvents — the CD's six-finger bug
     lived in the pointer-event path and synthetic PointerEvents cannot see it */
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) errs.push('console: ' + m.text()); });

  await page.goto('file://' + PAGE);
  await page.waitForTimeout(900);

  if (!(await page.evaluate(() => !!window.__MM))) {
    fail('the page exposes no __MM test hook');
  } else {
    /* --- 0. boot state: nothing selected, but the grid is already there --
       The CD's rule is that the grid is the invitation, so an unselected app
       still shows pads. The failure this catches is the opposite one: a mode
       with no song quietly taking the tempo strip, the wrench or the pads
       with it, or the song list losing the two entries above the songs. */
    const boot = await page.evaluate(() => window.__MM.state());
    if (boot.mode !== 'none') fail('boot mode is "' + boot.mode + '", expected "none"');
    if (boot.song !== null) fail('boot has song "' + boot.song + '" selected, expected none');
    if (boot.sel !== '') fail('boot select value is "' + boot.sel + '", expected empty');
    if (boot.infoShown) fail('the tempo strip is showing with no song selected');
    if (boot.toolsShown) fail('the wrench is showing with no song selected');
    const padsUp = await page.evaluate(() =>
      [...document.querySelectorAll('.pad')].filter((p) => p.getBoundingClientRect().width > 20).length);
    if (padsUp !== 15) fail('only ' + padsUp + ' pads are laid out with nothing selected, expected 15');
    else console.log('BOOT=none  15 pads up, no song, no tempo strip, no wrench');

    const opts = await page.evaluate(() => window.__MM.options());
    const wantOpts = ['', 'rec', '0', '1', '2', '3', '4'];
    if (opts.join('|') !== wantOpts.join('|'))
      fail('song list is [' + opts.join(',') + '], expected [' + wantOpts.join(',') + ']');
    else console.log('OPTIONS=' + opts.length + '  make-a-selection, record, then the five songs');

    /* every icon in the song row must be the same height as the select */
    const rowH = await page.evaluate(() => window.__MM.rowHeights());
    if (rowH['song-select'] !== rowH.lock)
      fail('song row heights differ: select ' + rowH['song-select'] + 'px vs lock ' + rowH.lock + 'px');
    else console.log('ROW=' + rowH['song-select'] + 'px  select and lock match');

    /* --- 1. does an AudioContext come up at all? --------------------- */
    const up = await page.evaluate(() => window.__MM.audio());
    if (!up) fail('initAudio() did not produce a running AudioContext');
    await page.evaluate(() => window.__MM.probe());

    /* --- 2. every pattern character through its real voice ----------- */
    const n = await page.evaluate(() => {
      try { return window.__MM.audition(); } catch (e) { return 'THREW: ' + e.message; }
    });
    if (typeof n !== 'number') fail('audition() ' + n);
    else if (n < 250) fail('audition() only exercised ' + n + ' voice/character pairs, expected 250+');
    else console.log('AUDITIONED=' + n);
    await page.waitForTimeout(500);

    /* --- 3. per song: transport runs, pads sound, nothing throws ----- */
    const peaks = [];
    for (let i = 0; i < 5; i++) {
      const before = errs.length;
      await page.evaluate((k) => { window.__MM.select(k); window.__MM.holdAll(true); }, i);
      await page.waitForTimeout(1500);
      let peak = 0;
      for (let s = 0; s < 22; s++) {
        peak = Math.max(peak, await page.evaluate(() => window.__MM.level()));
        await page.waitForTimeout(55);
      }
      const st = await page.evaluate(() => window.__MM.state());
      const tag = st.song;
      if (!st.playing) fail(tag + ': transport is not running after a hold');
      if (st.held !== 15) fail(tag + ': holdAll left ' + st.held + '/15 pads held');
      if (st.step < 6) fail(tag + ': only ' + st.step + ' steps scheduled in 1.5 s');
      if (st.dur < 285 || st.dur > 315) fail(tag + ': duration ' + st.dur + 's outside 285-315');
      if (!(peak > 0.02)) fail(tag + ': signal at the limiter peaked at ' + peak.toFixed(4) +
        ' with all 15 pads held — effectively silent');
      if (peak > 0.99) fail(tag + ': signal peaked at ' + peak.toFixed(3) + ' — the limiter is being overrun');
      if (errs.length > before)
        fail(tag + ': threw while playing -> ' + errs.slice(before).join(' | '));
      peaks.push(peak);
      console.log('PLAYED=' + tag + ' step=' + st.step + ' peak=' + peak.toFixed(3) +
                  ' bars=' + st.bars + ' dur=' + st.dur + 's');
      await page.evaluate(() => window.__MM.holdAll(false));
      await page.waitForTimeout(200);
    }

    /* --- 3b. the five songs must be level-matched -------------------- */
    if (peaks.length === 5) {
      const lo = Math.min(...peaks), hi = Math.max(...peaks);
      console.log('LEVELS=' + peaks.map((x) => x.toFixed(3)).join(' ') + '  spread=' + (hi / lo).toFixed(2) + 'x');
      if (hi / lo > 2.2)
        fail('song levels span ' + (hi / lo).toFixed(2) + 'x (max 2.2x) — retune the per-song `mix` trims ' +
             'so the dropdown is not also a volume control');
    }

    /* --- 4. releasing everything really does go quiet ---------------- */
    await page.waitForTimeout(700);
    let quiet = 1;
    for (let s = 0; s < 8; s++) {
      quiet = Math.min(quiet, await page.evaluate(() => window.__MM.level()));
      await page.waitForTimeout(60);
    }
    if (quiet > 0.004) fail('releasing every pad left ' + quiet.toFixed(4) +
      ' of signal — a track is latching when nothing should sustain');
    else console.log('RELEASED_FLOOR=' + quiet.toFixed(5));

    /* --- 5. the contact patch: seams, crossings, and the CD's grip ---- */
    /* Every point below is derived from the live pad rectangles, so this
       checks the real geometry rather than numbers typed from a screenshot,
       and the touches are dispatched through CDP so the page receives real
       TouchEvents with real identifiers. */
    const geom = await page.evaluate(() => {
      const pads = [...document.querySelectorAll('.pad')].map((p) => p.getBoundingClientRect());
      const c = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      /* portrait: pad i sits at column i/5, and i%5 climbs from the bottom */
      const mid = (a, b) => ({ x: (c(pads[a]).x + c(pads[b]).x) / 2,
                               y: (c(pads[a]).y + c(pads[b]).y) / 2 });
      return {
        centre: c(pads[0]),
        seam01: mid(0, 1),                       // one seam inside column 0
        cross: mid(5, 11),                       // where pads 5,6,10,11 meet
        colSeams: [mid(0, 1), mid(1, 2), mid(2, 3), mid(3, 4)],
        crossings: [mid(5, 11), mid(6, 12), mid(7, 13), mid(8, 14)],
      };
    });
    const cdp = await page.context().newCDPSession(page);
    const setTouches = (pts) => cdp.send('Input.dispatchTouchEvent', {
      type: pts.length ? 'touchStart' : 'touchEnd',
      touchPoints: pts.map((p, i) => ({ x: Math.round(p.x), y: Math.round(p.y), id: i + 1 })),
    });
    const heldNow = () => page.evaluate(() => window.__MM.state().held);
    const grip = geom.colSeams.concat(geom.crossings);

    const cases = [
      ['a fingertip in the middle of one pad', [geom.centre], 1],
      ['a fingertip laid across one seam', [geom.seam01], 2],
      ['a fingertip on a four-pad crossing', [geom.cross], 4],
      ["four fingers down one column's seams", geom.colSeams, 5],
      ["four fingers on two columns' crossings", geom.crossings, 10],
      ["the CD's eight-finger grip", grip, 15],
    ];
    for (const [what, pts, want] of cases) {
      await setTouches(pts);
      const n = await heldNow();
      await setTouches([]);
      const after = await heldNow();
      if (n !== want) fail('contact patch: ' + what + ' held ' + n + ' pads, expected ' + want);
      else console.log('TOUCH=' + want + '  ' + what);
      if (after !== 0) fail('contact patch: ' + what + ' left ' + after + ' pads stuck on after release');
      await page.waitForTimeout(50);
    }

    /* --- 5b. ADDING a finger must never drop the ones already down ----- */
    /* The CD's report: five fingers held, the sixth took everything with it.
       Safari fires pointercancel for the fingers already down when its
       gesture recognizer wakes up, and an incrementally-maintained pointer
       map never recovers. Build the grip one finger at a time and require the
       count to climb. */
    const ladder = [];
    let worst = '';
    for (let k = 1; k <= grip.length; k++) {
      await setTouches(grip.slice(0, k));
      const n = await heldNow();
      ladder.push(n);
      if (k > 1 && n < ladder[k - 2] && !worst)
        worst = 'finger ' + k + ' dropped the held count from ' + ladder[k - 2] + ' to ' + n;
      await page.waitForTimeout(40);
    }
    await setTouches([]);
    console.log('LADDER=' + ladder.join(' '));
    if (worst) fail('adding a finger dropped pads already held: ' + worst);
    if (ladder[ladder.length - 1] !== 15)
      fail('the eight-finger grip built up one finger at a time ended on ' +
           ladder[ladder.length - 1] + ' pads, expected 15');
    if (await heldNow() !== 0) fail('lifting the whole grip left pads stuck on');

    /* --- 5c. a cancel for ONE finger must not wipe the grip ------------ */
    /* touchcancel/touchend carry the fingers that REMAIN, and the held set is
       rebuilt from that list, so losing one finger costs one finger. */
    await setTouches(grip);
    const beforeCancel = await heldNow();
    const afterCancel = await page.evaluate((pts) => {
      const stage = document.getElementById('stage');
      const mk = (p, id) => new Touch({ identifier: id, target: stage,
        clientX: p.x, clientY: p.y, pageX: p.x, pageY: p.y });
      const keep = pts.slice(0, pts.length - 1).map((p, i) => mk(p, i + 1));
      const gone = mk(pts[pts.length - 1], pts.length);
      window.dispatchEvent(new TouchEvent('touchcancel', {
        touches: keep, targetTouches: keep, changedTouches: [gone],
        bubbles: true, cancelable: true,
      }));
      return window.__MM.state().held;
    }, grip);
    await setTouches([]);
    if (beforeCancel !== 15) fail('cancel check could not get to 15 pads first (got ' + beforeCancel + ')');
    else if (afterCancel < 13)
      fail('a touchcancel for ONE of eight fingers dropped the grip from 15 pads to ' +
           afterCancel + ' — the held set is being cleared instead of rebuilt');
    else console.log('CANCEL=15->' + afterCancel + '  one cancelled finger costs one finger');

    /* --- 5cc. a window blur must not drop the fingers ------------------ */
    /* The other half of the six-finger bug, and the half that IS reproducible
       here: `blur` used to clear the whole touch set. Safari can blur the
       window for an instant while it decides whether a many-finger touch is a
       system gesture, so that handler took the grip with it. */
    await setTouches(grip);
    const beforeBlur = await heldNow();
    const afterBlur = await page.evaluate(() => {
      window.dispatchEvent(new Event('blur'));
      return window.__MM.state().held;
    });
    await setTouches([]);
    if (beforeBlur !== 15) fail('blur check could not get to 15 pads first (got ' + beforeBlur + ')');
    else if (afterBlur !== 15)
      fail('a window blur dropped the grip from 15 pads to ' + afterBlur +
           ' — fingers must be released by touchend/touchcancel, not by blur');
    else console.log('BLUR=15  a window blur leaves the fingers held');

    /* --- 5d. the mouse path still works alongside the touch path ------- */
    await page.mouse.move(Math.round(geom.centre.x), Math.round(geom.centre.y));
    await page.mouse.down();
    const mouseHeld = await heldNow();
    await page.mouse.up();
    const mouseAfter = await heldNow();
    if (mouseHeld !== 1) fail('a mouse press on one pad held ' + mouseHeld + ' pads, expected 1 — ' +
      'gating pointer events on pointerType has broken the desktop path');
    else console.log('MOUSE=1  a mouse press still holds its pad');
    if (mouseAfter !== 0) fail('a mouse release left ' + mouseAfter + ' pads held');

    /* --- 6. tap-to-lock, every case in the CD's spec ------------------- */
    const centres = await page.evaluate(() =>
      [...document.querySelectorAll('.pad')].map((e) => {
        const r = e.getBoundingClientRect();
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
      }));
    const snap = () => page.evaluate(() => {
      const st = window.__MM.state();
      return st.held + '/' + st.locks + (st.lockMode ? '/lock' : '/hold');
    });
    const tap = async (i) => {
      await setTouches([centres[i]]);
      await page.waitForTimeout(35);
      await setTouches([]);
      await page.waitForTimeout(35);
    };
    const toggleLock = async () => { await page.click('#lock'); await page.waitForTimeout(40); };
    const want = async (label, expect) => {
      const got = await snap();
      if (got !== expect) fail('lock: ' + label + ' gave ' + got + ', expected ' + expect +
        '  (held/locks/mode)');
      else console.log('LOCK=' + expect.padEnd(10) + label);
    };

    await page.evaluate(() => window.__MM.state());
    await want('boot is hold mode, nothing held', '0/0/hold');
    await tap(0);
    await want('hold mode: a tap leaves nothing behind', '0/0/hold');
    await toggleLock();
    await want('lock mode engaged', '0/0/lock');
    await tap(0);
    await want('lock mode: a tap locks the pad ON', '1/1/lock');
    await tap(0);
    await want('lock mode: tapping it again releases it', '0/0/lock');
    await tap(0); await tap(7); await tap(12);
    await want('lock mode: three pads locked hands-free', '3/3/lock');
    await toggleLock();
    /* the CD's exact case: switching to hold mode must NOT release the locks */
    await want('switching to hold mode leaves the locks standing', '3/3/hold');
    await tap(7);
    await want('hold mode: tapping a locked pad unlocks it', '2/2/hold');
    await setTouches([centres[3]]);
    await page.waitForTimeout(35);
    await want('hold mode: holding an unlocked pad adds to the locks', '3/2/hold');
    await toggleLock();
    await want('locking while holding keeps what was sounding', '3/3/lock');
    await setTouches([]);
    await page.waitForTimeout(35);
    await want('lifting leaves the newly locked pad on', '3/3/lock');
    await page.click('#reload');
    await page.waitForTimeout(60);
    await want('restart clears the locks too', '0/0/lock');
    /* a locked pad must look engaged, not merely lit */
    await tap(4);
    const engaged = await page.evaluate(() => {
      const p = document.querySelectorAll('.pad')[4];
      return p.classList.contains('lit') && p.classList.contains('down');
    });
    if (!engaged) fail('lock: a locked pad is not drawn depressed and lit — a latching ' +
      'switch has to read as engaged with no finger on it');
    else console.log('LOCK=engaged   a locked pad stays depressed and lit');
    /* changing song must not carry locks onto a different fifteen tracks */
    await page.selectOption('#song-select', '2');
    await page.waitForTimeout(120);
    await want('changing song clears the locks', '0/0/lock');
    await toggleLock();
    await want('back to hold mode for the remaining checks', '0/0/hold');

    /* with the spread dialled to zero a seam press must fall between the pads */
    await page.evaluate(() => {
      const s = document.getElementById('spread');
      s.value = '0';
      s.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await setTouches([geom.seam01]);
    const zero = await heldNow();
    await setTouches([]);
    if (zero !== 0) fail('with touch spread at 0 a seam press still held ' + zero + ' pads');
    else console.log('TOUCH=0  seam press with spread dialled to zero');

    /* --- 7. RECORD NEW SONG: the pads become instruments -------------- */
    /* A song GATES a running transport; the kit TRIGGERS notes. The bug this
       is here for is the one where the two paths cross: a kit pad left gated
       (silent, because no transport ever opens its gain) or a song pad left
       triggering (every hold firing a stray one-shot). */
    await page.evaluate(() => {
      const s = document.getElementById('spread');
      s.value = '12';
      s.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.evaluate(() => window.__MM.pick('rec'));
    await page.waitForTimeout(150);
    const rec = await page.evaluate(() => window.__MM.state());
    if (rec.mode !== 'rec') fail('picking RECORD NEW SONG left mode "' + rec.mode + '"');
    if (rec.padMode !== 'live') fail('record mode has padMode "' + rec.padMode + '", expected "live"');
    if (rec.playing) fail('record mode is running the song transport, which has nothing to play');
    if (rec.infoShown) fail('record mode is showing a tempo strip for a song that does not exist yet');
    if (!rec.toolsShown) fail('the wrench is hidden in record mode, where it is the only way in');
    if (rec.tool !== 'tappad') fail('record mode opened on tool "' + rec.tool + '", expected "tappad"');
    else console.log('REC=live   transport off, wrench up, TAP PAD selected');

    const recH = await page.evaluate(() => window.__MM.rowHeights());
    if (recH['song-select'] !== recH.tools || recH.tools !== recH.lock)
      fail('record-mode row heights differ: select ' + recH['song-select'] +
           ' / wrench ' + recH.tools + ' / lock ' + recH.lock);
    else console.log('ROW=' + recH.tools + 'px  select, wrench and lock all match');

    /* the default kit, exactly as specified: ten degrees of C major climbing
       the two left columns, PULSE's five drums in the right one */
    const labs = await page.evaluate(() => window.__MM.padLabels());
    const wantLabs = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5',
                      'KICK', 'SNARE', 'HAT', 'TOM', 'RIDE'];
    if (labs.join(' ') !== wantLabs.join(' '))
      fail('default kit reads [' + labs.join(' ') + '], expected [' + wantLabs.join(' ') + ']');
    else console.log('KIT=' + labs.slice(0, 10).join(' ') + ' | ' + labs.slice(10).join(' '));
    const oct = await page.evaluate(() => window.__MM.padMidi(7) - window.__MM.padMidi(0));
    if (oct !== 12) fail('pad 8 is ' + oct + ' semitones over pad 1, expected an octave');

    /* Switching modes must also SILENCE the song you left. Its already-
       scheduled notes are still in the graph — a gamelan gong rings for six
       seconds — so a record mode that opened the track gains to hear its own
       pads would play the last song's tail underneath them. This floor check
       is what tells the peak check below that it is measuring the kit. */
    await page.waitForTimeout(700);
    let ghost = 0;
    for (let k = 0; k < 10; k++) {
      await page.waitForTimeout(40);
      ghost = Math.max(ghost, await page.evaluate(() => window.__MM.level()));
    }
    if (ghost > 0.01) fail('record mode is leaking the previous song at ' + ghost.toFixed(4) +
      ' with no pad held — the outgoing song\'s tails are not damped');
    else console.log('REC=quiet  ' + ghost.toFixed(4) + ' with nothing held, the old song is damped');

    /* a kit pad must actually SOUND — the lamp lighting proves nothing */
    let recPeak = 0;
    await page.evaluate(() => window.__MM.hold(3, true));
    for (let k = 0; k < 14; k++) {
      await page.waitForTimeout(25);
      recPeak = Math.max(recPeak, await page.evaluate(() => window.__MM.level()));
    }
    await page.evaluate(() => window.__MM.hold(3, false));
    if (recPeak < 0.01) fail('holding a kit pad produced peak ' + recPeak.toFixed(4) + ' — the live path is silent');
    else console.log('REC=sound  a kit pad peaks at ' + recPeak.toFixed(3));

    /* assigning a pad: both halves of the picker, across the pitched/perc line */
    const a1 = await page.evaluate(() => window.__MM.setPad(0, 'm:organ', 2));
    if (a1 !== 'E4') fail('assigning organ at degree 2 labelled pad 1 "' + a1 + '", expected E4');
    const a2 = await page.evaluate(() => window.__MM.setPad(12, 'p:clap'));
    if (a2 !== 'CLAP') fail('assigning clap labelled pad 13 "' + a2 + '", expected CLAP');
    /* crossing back to a pitched voice has to bring the note list back with it */
    const a3 = await page.evaluate(() => {
      window.__MM.setPad(12, 'm:vibes', 0);
      return window.__MM.picker();
    });
    if (a3.notes < 14) fail('the note list offered only ' + a3.notes + ' notes after a pitched reassignment');
    else console.log('PICK=E4 CLAP, and the note list returns with a pitched voice');
    await page.evaluate(() => { window.__MM.setPad(0, 'm:piano', 0); window.__MM.setPad(12, 'p:hat'); });

    /* TAP PAD's gesture rule: one quick tap opens the picker, a chord does not */
    const rgeom = await page.evaluate(() => {
      const pads = [...document.querySelectorAll('.pad')].map((p) => p.getBoundingClientRect());
      const c = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      return { p2: c(pads[2]), p3: c(pads[3]), p7: c(pads[7]) };
    });
    await setTouches([rgeom.p2]);
    await page.waitForTimeout(60);
    await setTouches([]);
    await page.waitForTimeout(80);
    const opened = await page.evaluate(() => window.__MM.picker());
    if (!opened.open) fail('a single quick tap under TAP PAD did not open the picker');
    else if (opened.pad !== 2) fail('the tap opened the picker on pad ' + (opened.pad + 1) + ', expected 3');
    else console.log('TAP=pad 3  a lone quick tap opens its picker');
    await page.click('#pk-close');
    await page.waitForTimeout(60);

    await setTouches([rgeom.p3, rgeom.p7]);
    await page.waitForTimeout(60);
    await setTouches([]);
    await page.waitForTimeout(80);
    const chord = await page.evaluate(() => window.__MM.picker());
    if (chord.open) fail('a two-pad chord under TAP PAD opened a picker — the view must stay playable');
    else console.log('TAP=chord  two pads at once is a chord, not an assignment');

    /* and back: a song must restore gating, the tempo strip and the transport */
    await page.evaluate(() => window.__MM.pick('0'));
    await page.waitForTimeout(200);
    const back = await page.evaluate(() => window.__MM.state());
    if (back.mode !== 'song' || back.padMode !== 'gate')
      fail('going back to a song left mode "' + back.mode + '" / padMode "' + back.padMode + '"');
    else if (!back.playing) fail('going back to a song did not restart the transport');
    else if (!back.infoShown) fail('going back to a song did not bring the tempo strip back');
    else if (back.toolsShown) fail('the wrench is still showing on a built-in song');
    else console.log('BACK=' + back.song + '  gating, tempo strip and transport all restored');
  }

  for (const e of errs) fail(e);
  await browser.close();

  console.log('');
  console.log('PROBLEMS=' + problems.length);
  for (const p of problems) console.log('  - ' + p);
  console.log('MIXER-RUNTIME: ' + (problems.length ? 'RED' : 'GREEN'));
  process.exit(problems.length ? 1 : 0);
})().catch((e) => {
  console.error(e);
  console.log('MIXER-RUNTIME: RED');
  process.exit(1);
});
