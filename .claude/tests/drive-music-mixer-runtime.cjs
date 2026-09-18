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

    const rgeom = await page.evaluate(() => {
      const pads = [...document.querySelectorAll('.pad')].map((p) => p.getBoundingClientRect());
      const c = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      return { p2: c(pads[2]), p3: c(pads[3]), p7: c(pads[7]) };
    });

    /* TAP PAD cannot share the surface with a latch. With lock ON, a press
       LATCHES the pad, so it is still held on release and the "nothing held
       now" test that opens the picker never fires: the CD got a lit pad, a
       played note and no dialog (report, 2026-09-18). The tool suspends lock
       rather than switching it off, so the persisted setting survives. */
    const lockTrip = await page.evaluate(() => {
      window.__MM.setTool('none');
      const before = window.__MM.state().lockMode;
      if (!before) document.getElementById('lock').click();   /* lock ON */
      const onNow = window.__MM.state();
      window.__MM.setTool('tappad');
      const inTool = window.__MM.state();
      window.__MM.setTool('none');
      return { locked: onNow.lockEffective, inTool, after: window.__MM.state() };
    });
    if (!lockTrip.locked) fail('could not turn lock on to set up the TAP PAD check');
    if (lockTrip.inTool.lockEffective)
      fail('TAP PAD is active with lock still in effect — a press will latch and swallow the tap');
    else if (!lockTrip.inTool.lockDisabled)
      fail('the lock toggle is still enabled under TAP PAD');
    else if (!lockTrip.after.lockMode)
      fail('leaving TAP PAD lost the CD\'s lock setting instead of restoring it');
    else console.log('TAP=lock suspended under the tool, setting restored on the way out');

    /* and the symptom itself: with lock on, entering TAP PAD and tapping a pad
       must still open the picker and must not leave the pad lit */
    await page.evaluate(() => { window.__MM.setTool('tappad'); });
    await page.waitForTimeout(120);
    await setTouches([rgeom.p7]);
    await page.waitForTimeout(60);
    await setTouches([]);
    await page.waitForTimeout(120);
    const lockTap = await page.evaluate(() => ({
      picker: window.__MM.picker(), held: window.__MM.state().held,
    }));
    if (!lockTap.picker.open) fail('with lock previously on, a tap under TAP PAD still opened no picker');
    else if (lockTap.held !== 0) fail('the tapped pad stayed lit (' + lockTap.held + ' held) after the lift');
    else console.log('TAP=lock-on regression clear: picker opens, pad does not stay lit');
    await page.evaluate(() => document.getElementById('pk-close').click());
    await page.waitForTimeout(60);
    /* put lock back to off for the remaining checks — the toggle is disabled
       under the tool, so it has to be left before it can be clicked */
    await page.evaluate(() => {
      window.__MM.setTool('none');
      if (window.__MM.state().lockMode) document.getElementById('lock').click();
      window.__MM.setTool('tappad');
    });
    await page.waitForTimeout(120);

    /* TAP PAD's gesture rule: one quick tap opens the picker, a chord does not */
    await setTouches([rgeom.p2]);
    await page.waitForTimeout(60);
    await setTouches([]);
    await page.waitForTimeout(80);
    const opened = await page.evaluate(() => window.__MM.picker());
    if (!opened.open) fail('a single quick tap under TAP PAD did not open the picker');
    else if (opened.pad !== 2) fail('the tap opened the picker on pad ' + (opened.pad + 1) + ', expected 3');
    else console.log('TAP=pad 3  a lone quick tap opens its picker');
    await page.evaluate(() => document.getElementById('pk-close').click());
    await page.waitForTimeout(60);

    await setTouches([rgeom.p3, rgeom.p7]);
    await page.waitForTimeout(60);
    await setTouches([]);
    await page.waitForTimeout(80);
    const chord = await page.evaluate(() => window.__MM.picker());
    if (chord.open) fail('a two-pad chord under TAP PAD opened a picker — the view must stay playable');
    else console.log('TAP=chord  two pads at once is a chord, not an assignment');

    /* --- 8. CHANGE KEY & MODE ---------------------------------------- */
    /* The rule the CD set is that the sample's STRUCTURE never moves, only
       its colour: changing key or mode mid-playback must retune the next note
       and nothing else. A version that restarted the loop on every tap would
       look identical on screen and be wrong in exactly the way that matters. */
    await page.evaluate(() => window.__MM.setTool('keymode'));
    await page.waitForTimeout(200);
    const km = await page.evaluate(() => window.__MM.keymode());
    if (!km.up) fail('CHANGE KEY & MODE did not open its screen');
    if (km.gridUp) fail('the pad grid is still up behind the key/mode screen');
    if (km.keys !== 12) fail('the key list has ' + km.keys + ' entries, expected 12');
    if (km.modes < 7) fail('the mode list has only ' + km.modes + ' entries');
    else console.log('KEYMODE=' + km.keys + ' keys / ' + km.modes + ' modes, grid swapped out');

    /* the pads are inert while this screen is up, and its lists must scroll */
    await setTouches([{ x: 60, y: 300 }]);
    await page.waitForTimeout(60);
    const kmHeld = await heldNow();
    await setTouches([]);
    if (kmHeld !== 0) fail('a touch on the key/mode screen held ' + kmHeld + ' pads');
    const scrollable = await page.evaluate(() =>
      getComputedStyle(document.getElementById('km-keys')).touchAction);
    if (!/pan-y|auto/.test(scrollable))
      fail('the key list has touch-action "' + scrollable + '" and cannot scroll');
    else console.log('KEYMODE=inert  no pad answers, and the lists can scroll');

    /* a key change retunes the pads, which is the transposition contract */
    const tr = await page.evaluate(() => {
      window.__MM.setKeyMode(9, 'dorian');
      return { key: window.__MM.keymode(), labs: window.__MM.padLabels() };
    });
    const wantDorian = ['A4', 'B4', 'C5', 'D5', 'E5', 'F#5', 'G5', 'A5', 'B5', 'C6'];
    if (tr.labs.slice(0, 10).join(' ') !== wantDorian.join(' '))
      fail('A dorian gave [' + tr.labs.slice(0, 10).join(' ') + '], expected [' + wantDorian.join(' ') + ']');
    else if (!/A DORIAN/.test(tr.key.scale) || !/F#/.test(tr.key.scale))
      fail('the scale readout says "' + tr.key.scale + '"');
    else console.log('KEYMODE=' + tr.key.scale.trim());

    /* the sample: it sounds, it keeps its place through a key change, pause
       holds that place and stop returns it to the top */
    await page.evaluate(() => window.__MM.sample('play'));
    let smpPeak = 0;
    for (let k = 0; k < 24; k++) {
      await page.waitForTimeout(60);
      smpPeak = Math.max(smpPeak, await page.evaluate(() => window.__MM.level()));
    }
    const mid = await page.evaluate(() => window.__MM.keymode());
    if (smpPeak < 0.01) fail('the key/mode sample peaked at ' + smpPeak.toFixed(4) + ' — it is silent');
    else if (!mid.playing || mid.step < 4) fail('the sample is not advancing (step ' + mid.step + ')');
    else console.log('SAMPLE=playing  peak ' + smpPeak.toFixed(3) + ' at step ' + mid.step);

    const before = mid.step;
    await page.evaluate(() => window.__MM.setKeyMode(3, 'blues'));
    await page.waitForTimeout(350);
    const after = await page.evaluate(() => window.__MM.keymode());
    if (!after.playing) fail('changing key stopped the sample');
    else if (after.step < before) fail('changing key restarted the sample (step ' + before + ' -> ' +
      after.step + ') — the structure must not move, only the key');
    else console.log('SAMPLE=step ' + before + ' -> ' + after.step + ' through a key change, no restart');

    await page.evaluate(() => window.__MM.sample('pause'));
    await page.waitForTimeout(300);
    const paused = await page.evaluate(() => window.__MM.keymode());
    if (paused.playing) fail('pause did not stop the sample');
    else if (paused.step !== after.step && paused.step < after.step)
      fail('pause moved the playhead backwards');
    const held2 = await page.evaluate(() => window.__MM.keymode());
    if (held2.step !== paused.step) fail('the sample is still advancing while paused');
    else console.log('SAMPLE=paused at step ' + paused.step + ', and it stays there');

    await page.evaluate(() => window.__MM.sample('stop'));
    const stopped = await page.evaluate(() => window.__MM.keymode());
    if (stopped.playing || stopped.step !== 0) fail('stop left the sample at step ' + stopped.step);
    else console.log('SAMPLE=stopped and rewound');

    /* Leaving the tool has to put the pads back AND re-measure them. Rotating
       WHILE the screen is up is what makes this bite: `resize` still fires and
       still runs layout(), but the grid is display:none, so every pad rect
       measures as zero and the hit test goes completely deaf. Coming back
       without a re-measure leaves a grid that lights up for nobody. */
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(250);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(250);
    await page.evaluate(() => window.__MM.setTool('tappad'));
    await page.waitForTimeout(250);
    const backGrid = await page.evaluate(() => window.__MM.keymode());
    if (backGrid.up || !backGrid.gridUp) fail('leaving CHANGE KEY & MODE did not restore the grid');
    const rg = await page.evaluate(() => {
      const pads = [...document.querySelectorAll('.pad')].map((q) => q.getBoundingClientRect());
      const c = (r) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
      return { seam: { x: (c(pads[0]).x + c(pads[1]).x) / 2, y: (c(pads[0]).y + c(pads[1]).y) / 2 } };
    });
    await setTouches([rg.seam]);
    await page.waitForTimeout(60);
    const seamBack = await heldNow();
    await setTouches([]);
    await page.waitForTimeout(80);
    await page.evaluate(() => { window.__MM.setTool('none'); });
    if (seamBack !== 2) fail('after rotating on the key/mode screen and leaving it, a seam press held ' +
      seamBack + ' pads, expected 2 — the pad rects were not re-measured');
    else console.log('KEYMODE=left   rotated while up, grid back and re-measured, a seam holds two');
    await page.evaluate(() => window.__MM.setKeyMode(0, 'major'));

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

    /* --- 9. record, process, replay and edit -------------------------- */
    /* The processor is the part that cannot be eyeballed: it decides a tempo,
       a metre and where the song starts and stops from nothing but tap times.
       Synthetic takes at KNOWN tempi are the only way to check it, so that is
       what these drive — a real recording has no right answer to compare to. */
    const mkTake = `(bpm, beats, bars) => {
      const beat = 60 / bpm, ev = [];
      for (let bar = 0; bar < bars; bar++) for (let s = 0; s < beats * 4; s++) {
        const t = 1.4 + bar * beat * beats + s * beat / 4 + Math.sin(bar * 5 + s * 3) * 0.012;
        const w = (s === 0 ? 3 : 0) + (s === beats * 2 ? 1 : 0)
                + (s === 4 || s === beats * 4 - 4 ? 1 : 0) + (s % 2 === 0 ? 1 : 0);
        for (let q = 0; q < w; q++) ev.push({ i: q % 3 === 0 ? 10 : (q % 3 === 1 ? 11 : 0), t, d: 0.2 });
      }
      return ev;
    }`;
    await page.evaluate(() => { window.__MM.wipeTakes(); window.__MM.pick('rec'); });
    await page.waitForTimeout(150);

    const det = await page.evaluate(`(() => {
      const mk = ${mkTake};
      const out = [];
      for (const c of [[112, 4], [96, 4], [120, 3], [104, 5]]) {
        const ev = mk(c[0], c[1], 8);
        const d = window.__MM.detect(ev.map((e) => e.t));
        out.push({ want: c, got: [d.bpm, d.beats] });
      }
      return out;
    })()`);
    let detOK = 0;
    for (const d of det) {
      if (Math.abs(d.got[0] - d.want[0]) < 2 && d.got[1] === d.want[1]) detOK++;
      else fail('detection: a ' + d.want[0] + ' BPM ' + d.want[1] + '/4 take read as ' +
                d.got[0] + ' BPM ' + d.got[1] + '/4');
    }
    if (detOK === det.length) console.log('DETECT=' + detOK + '/' + det.length + '  tempo and metre recovered from tap times alone');

    /* the record button's own sequence: 3, 2, 1, a beat of nothing, then live */
    const seq = [];
    await page.evaluate(() => { window.__MM.setTool('record'); window.__MM.rec('arm'); });
    for (let k = 0; k < 5; k++) {
      seq.push(await page.evaluate(() => {
        const r = window.__MM.rec();
        return r.state + ':' + (r.label || (r.btn.indexOf('live') >= 0 ? 'DOT' : '-'));
      }));
      await page.waitForTimeout(1000);
    }
    const got = seq.join(' ');
    if (!/count:3 count:2 count:1 count:- recording:DOT/.test(got))
      fail('the record countdown ran "' + got + '", expected 3, 2, 1, a blank beat, then the dot');
    else console.log('REC=3 2 1 . then the red dot');

    /* a take end to end, then what replay must and must not do */
    const made = await page.evaluate(`(() => {
      const mk = ${mkTake};
      window.__MM.rec('stop');
      return window.__MM.process(mk(112, 4, 8), 'GATE TAKE');
    })()`);
    if (!made) fail('processing a synthetic take produced nothing');
    else if (made.bpm !== 112 || made.beats !== 4 || made.bars !== 8)
      fail('the processed take is ' + made.bpm + ' BPM ' + made.beats + '/4 x ' + made.bars +
           ' bars, expected 112 / 4 / 8');
    else console.log('TAKE=' + made.bpm + ' BPM ' + made.beats + '/4, ' + made.bars +
                     ' bars, ' + made.notes + ' notes');

    await page.evaluate((id) => window.__MM.pick('t:' + id), made.id);
    await page.waitForTimeout(400);
    const rep = await page.evaluate(() => window.__MM.state());
    if (rep.mode !== 'take' || rep.padMode !== 'gate')
      fail('a recorded song replays in mode "' + rep.mode + '" / padMode "' + rep.padMode + '"');
    if (!rep.infoShown) fail('a recorded song shows no tempo strip');
    if (rep.transportShown) fail('the transport is showing outside REPLAY & EDIT');
    if (rep.sig !== '4/4' || rep.bpm !== 112) fail('the tempo strip reads ' + rep.bpm + ' ' + rep.sig);

    /* THE contract for a recorded song: the pads gate it, exactly like the
       built-in five. Silent with nothing held, loud with everything held. */
    let tkQuiet = 1, loud = 0;
    for (let k = 0; k < 12; k++) {
      await page.waitForTimeout(45);
      tkQuiet = Math.min(tkQuiet, await page.evaluate(() => window.__MM.level()));
    }
    await page.evaluate(() => window.__MM.holdAll(true));
    for (let k = 0; k < 20; k++) {
      await page.waitForTimeout(45);
      loud = Math.max(loud, await page.evaluate(() => window.__MM.level()));
    }
    await page.evaluate(() => window.__MM.holdAll(false));
    if (tkQuiet > 0.01) fail('a recorded song is audible at ' + tkQuiet.toFixed(4) + ' with no pad held — it is not gating');
    else if (loud < 0.02) fail('holding every pad of a recorded song peaked at ' + loud.toFixed(4) + ' — it is silent');
    else console.log('TAKE=gated  ' + tkQuiet.toFixed(4) + ' held nothing, ' + loud.toFixed(3) + ' held everything');

    /* the knobs: snap and intro padding both move the song, non-destructively */
    const knobs = await page.evaluate(() => {
      const base = window.__MM.take().dur;
      const off = window.__MM.setTake('snap', 0);
      const pad = window.__MM.setTake('padSteps', 32);
      const back = window.__MM.setTake('padSteps', 0);
      window.__MM.setTake('snap', 1);
      return { base, off: off.dur, padBars: pad.bars, backBars: back.bars, backDur: back.dur };
    });
    if (knobs.padBars - knobs.backBars !== 2)
      fail('32 steps of intro padding added ' + (knobs.padBars - knobs.backBars) + ' bars, expected 2');
    else if (Math.abs(knobs.backDur - knobs.base) > 0.01)
      fail('removing the padding did not restore the duration (' + knobs.backDur + ' vs ' + knobs.base + ')');
    else console.log('TAKE=padding 2 bars in and back out, snap off and on, nothing lost');

    const dbl = await page.evaluate(() => {
      const a = window.__MM.take().bpm;
      document.getElementById('tk-dbl').click();
      const b = window.__MM.take().bpm;
      document.getElementById('tk-half').click();
      return [a, b, window.__MM.take().bpm];
    });
    if (dbl[1] !== dbl[0] * 2 || dbl[2] !== dbl[0])
      fail('halve/double gave ' + dbl.join(' -> ') + ' — an octave error must be a one-tap fix');
    else console.log('TAKE=x2 and /2 round-trip ' + dbl[0] + ' -> ' + dbl[1] + ' -> ' + dbl[2]);

    /* edit: overdub adds, the erase handle removes, and NO really does undo */
    await page.evaluate(() => window.__MM.setTool('edit'));
    await page.waitForTimeout(200);
    const ed = await page.evaluate(() => window.__MM.state());
    if (!ed.editing || ed.padMode !== 'live') fail('REPLAY & EDIT left editing=' + ed.editing + ' padMode=' + ed.padMode);
    if (!ed.transportShown || !ed.recbarShown) fail('REPLAY & EDIT is missing its transport or its edit bar');
    else console.log('EDIT=transport and edit bar up, pads live for overdub');

    const dub = await page.evaluate(async () => {
      const before = window.__MM.take().notes;
      window.__MM.overdub(true);
      window.__MM.transport('play');
      await new Promise((r) => setTimeout(r, 350));
      window.__MM.hold(5, true);
      await new Promise((r) => setTimeout(r, 150));
      window.__MM.hold(5, false);
      const added = window.__MM.take().notes;
      const erased = window.__MM.erase(10, true);
      const ask = window.__MM.overdub(false);
      const after = window.__MM.answer(false);
      return { before, added, erased, ask: ask.ask, after };
    });
    if (dub.added <= dub.before) fail('overdubbing a pad added no note (' + dub.before + ' -> ' + dub.added + ')');
    else if (dub.erased >= dub.added) fail('the erase handle removed nothing (' + dub.added + ' -> ' + dub.erased + ')');
    else if (!dub.ask) fail('leaving overdub with changes did not ask whether to save them');
    else if (dub.after !== dub.before)
      fail('answering NO left ' + dub.after + ' notes, expected the original ' + dub.before);
    else console.log('EDIT=overdub +1, erase -1, and NO restores ' + dub.after + ' notes');

    const kept = await page.evaluate(async () => {
      window.__MM.overdub(true);
      window.__MM.transport('play');
      await new Promise((r) => setTimeout(r, 300));
      window.__MM.hold(6, true);
      await new Promise((r) => setTimeout(r, 140));
      window.__MM.hold(6, false);
      const n = window.__MM.take().notes;
      window.__MM.overdub(false);
      return { n, after: window.__MM.answer(true) };
    });
    if (kept.after !== kept.n) fail('answering YES kept ' + kept.after + ' notes, expected ' + kept.n);
    else console.log('EDIT=YES keeps the overdub (' + kept.after + ' notes)');

    /* and it has to survive a reload, since that is the only copy */
    await page.evaluate(() => { document.getElementById('tk-title').value = 'KEEP ME'; });
    await page.evaluate(() => {
      const t = document.getElementById('tk-title');
      t.value = 'KEEP ME';
      t.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(150);
    await page.reload();
    await page.waitForTimeout(900);
    const kept2 = await page.evaluate(() => ({
      takes: window.__MM.takes(), opts: window.__MM.options(), st: window.__MM.state(),
    }));
    if (!kept2.takes.length) fail('the recorded take did not survive a reload');
    else if (kept2.takes[0].name !== 'KEEP ME') fail('the take came back named "' + kept2.takes[0].name + '"');
    else if (kept2.opts.indexOf('t:' + kept2.takes[0].id) !== 2)
      fail('a recorded song is not listed under RECORD NEW SONG: ' + kept2.opts.join(','));
    else if (kept2.st.mode !== 'none')
      fail('a reload with takes stored opened on "' + kept2.st.mode + '" instead of nothing selected');
    else console.log('TAKE=survives a reload as "' + kept2.takes[0].name + '", listed at slot 2');

    /* --- 10. export ---------------------------------------------------- */
    /* The export exists so a Claude Code session can USE it, which means the
       rendered song has to satisfy the same notation contract as the five
       built-in ones — a file that would not load is not an export. The check
       that matters is the ROUND TRIP: walk the pattern strings back out and
       require exactly the notes the take holds, no more and no fewer. */
    /* the reload above left nothing selected, so pick the take back up first */
    const exTake = await page.evaluate(() => {
      const t = window.__MM.takes()[0];
      window.__MM.pick('t:' + t.id);
      return t.id;
    });
    await page.waitForTimeout(300);
    const ex = await page.evaluate(() => ({
      text: window.__MM.exportText(), grid: window.__MM.takeGrid(),
    }));
    let J = null;
    try { J = JSON.parse(ex.text); } catch (e) { fail('the export is not valid JSON: ' + e.message); }
    /* An empty export must FAIL rather than skip every check below it. The
       first version of this section ran with nothing selected, got null, and
       went green having tested nothing at all. */
    if (!ex.text || !J) fail('exporting take ' + exTake + ' produced nothing');
    else {
      if (J.format !== 'music-mixer-take/v1') fail('export format is "' + J.format + '"');
      for (const k of ['song', 'songSource', 'kit', 'performance', 'readme'])
        if (!J[k]) fail('the export has no "' + k + '" section');
      const S2 = J.song || {};
      if (!S2.tracks || S2.tracks.length !== 15) fail('the exported song has ' + (S2.tracks || []).length + ' tracks, expected 15');
      else if (!S2.arr || S2.arr.length !== 1 || S2.arr[0].p.length !== 15)
        fail('the exported arrangement row is malformed');
      else {
        /* the same structural rules the data gate holds SONGS[] to */
        for (let i = 0; i < 15; i++) {
          const t = S2.tracks[i];
          if (t.pats.a.length % S2.steps !== 0)
            fail('exported pad' + i + ' pattern is ' + t.pats.a.length + ' chars, not a multiple of ' + S2.steps);
          if (i >= 10 && t.k !== 'p') fail('exported pad' + i + ' is in the percussion column but k="' + t.k + '"');
          if (i < 10 && t.k === 'p') fail('exported pad' + i + ' is a drum outside the percussion column');
          const ok = t.k === 'p' ? /^[Xxor.\-]*$/ : /^[1-9a-f.\-]*$/;
          if (!ok.test(t.pats.a)) fail('exported pad' + i + ' uses characters its kind cannot render');
          if (S2.arr[0].p[i] !== '.' && !(S2.arr[0].p[i] in t.pats))
            fail('exported pad' + i + ' is arranged to a pattern it does not have');
        }
        const total = S2.arr[0].b * S2.steps, out = new Set();
        for (let i = 0; i < 15; i++) {
          if (S2.arr[0].p[i] === '.') continue;
          const pat = S2.tracks[i].pats.a;
          for (let a = 0; a < total; a++) {
            const c = pat[a % pat.length];
            if (c !== '.' && c !== '-') out.add(i + '@' + a);
          }
        }
        const want = new Set(ex.grid);
        let missing = 0, extra = 0;
        want.forEach((x) => { if (!out.has(x)) missing++; });
        out.forEach((x) => { if (!want.has(x)) extra++; });
        if (missing || extra)
          fail('the exported notation does not match the take: ' + missing + ' notes missing, ' +
               extra + ' invented (of ' + want.size + ')');
        else console.log('EXPORT=round trip exact, ' + want.size + ' notes through ' +
                         S2.tracks[0].pats.a.length + '-char patterns');
      }
      /* the readme has to tell the receiving session the one thing that will
         otherwise waste its time: this is a seed and it will fail the gate */
      const txt = (J.readme || []).join(' ');
      if (!/285/.test(txt) || !/drive-music-mixer/.test(txt))
        fail('the export readme does not tell a session the song contract or which gate to run');
      if (!/^\{[\s\S]*\}$/.test(J.songSource || '') || (J.songSource || '').indexOf('tracks: [') < 0)
        fail('songSource is not a pasteable object literal');
      if (/[^\x00-\x7F]/.test(ex.text)) fail('the export contains non-ASCII characters');
      else console.log('EXPORT=' + ex.text.length + ' bytes, ASCII, readme names the contract and the gate');
    }
    /* and the button really produces a file */
    const dl = await page.evaluate(async () => {
      let name = null;
      const real = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () { if (this.download) name = this.download; };
      try { window.__MM.exportFile(); } finally { HTMLAnchorElement.prototype.click = real; }
      return name;
    });
    if (dl !== 'keep-me-take.json') fail('the export downloaded as "' + dl + '", expected keep-me-take.json');
    else console.log('EXPORT=downloads as ' + dl);


    /* --- 11. the loop edges, the title field and DELETE ---------------- */
    /* A take is a LOOP, and nobody starts or stops on a bar line. Whatever was
       played before the first bar line and after the last one is not part of
       the song, so a performance that wanders in three seconds late and stops
       mid-phrase still has to come back as a whole number of bars that joins
       onto itself: first note on step 0, last note inside the grid, nothing
       ringing past the seam. */
    const mkLoose = `(bpm, beats, bars, lead, extra) => {
      const beat = 60 / bpm, barSec = beat * beats, ev = [];
      const hit = (t, n) => { for (let q = 0; q < n; q++)
        ev.push({ i: q % 3 === 0 ? 10 : (q % 3 === 1 ? 11 : 0), t, d: 0.2 }); };
      for (let bar = 0; bar < bars; bar++) for (let b = 0; b < beats; b++) {
        const t = lead + bar * barSec + b * beat + Math.sin(bar * 5 + b * 3) * 0.011;
        hit(t, b === 0 ? 3 : 2);
        hit(t + beat / 2, 1);
      }
      /* and then a few quarter notes past the end, the way a person stops */
      for (let k = 0; k < extra; k++) hit(lead + bars * barSec + k * beat, 1);
      return ev;
    }`;
    await page.evaluate(() => { window.__MM.wipeTakes(); window.__MM.pick('rec'); });
    await page.waitForTimeout(150);

    for (const c of [[120, 4, 4, 2.6, 3], [132, 4, 8, 0.9, 1], [96, 4, 4, 4.2, 5]]) {
      const lab = c[0] + ' BPM ' + c[1] + '/4 x ' + c[2] + ' bars, in at ' + c[3] + 's +' + c[4];
      const r = await page.evaluate(`(() => {
        const mk = ${mkLoose};
        const ev = mk(${c.join(', ')});
        const made = window.__MM.process(ev, 'LOOP ME');
        if (!made) return null;
        window.__MM.pick('t:' + made.id);
        return { made, fed: ev.length, loop: window.__MM.loop() };
      })()`);
      if (!r) { fail('processing a loose take (' + lab + ') produced nothing'); continue; }
      const L = r.loop, want = c[2], barSec = (60 / c[0]) * c[1], extras = c[4];
      if (r.made.beats !== c[1]) { fail('a ' + lab + ' take read as ' + r.made.beats + '/4'); continue; }
      if (L.bars !== want) fail('a ' + lab + ' take came back ' + L.bars +
        ' bars long - the trailing fragment was not cut back to the bar line');
      else if (Math.abs(L.dur - want * barSec) > 0.02)
        fail('a ' + lab + ' take runs ' + L.dur + 's, expected ' + (want * barSec).toFixed(3));
      else if (L.first !== 0)
        fail('a ' + lab + ' take starts at step ' + L.first + ' - the lead-in was not shifted off');
      else if (L.last >= L.songSteps)
        fail('a ' + lab + ' take has a note at step ' + L.last + ' of ' + L.songSteps);
      else if (L.over > 0.001)
        fail('a ' + lab + ' take rings ' + L.over + 's past its own loop point');
      else if (L.steps !== c[1] * 4 || L.perBeat !== 4)
        fail('a ' + c[1] + '/4 take grids at ' + L.steps + ' steps a bar (' + L.perBeat + ' a beat)');
      else if (L.notes !== r.fed - extras)
        fail('a ' + lab + ' take kept ' + L.notes + ' of ' + r.fed + ' hits, expected ' +
             (r.fed - extras) + ' - the remainder was not dropped exactly');
      else console.log('LOOP=' + want + ' bars exactly, ' + L.dur.toFixed(2) + 's, ' +
        extras + ' trailing hits cut  (' + lab + ')');
    }

    /* The grid is four steps to the beat in every metre, not sixteen steps to
       the bar - otherwise SNAP's 1/16 is a lie in 3/4 and the edit click, which
       fires every `perBeat` steps, only ever lands on the downbeat. */
    const odd = await page.evaluate(() => {
      window.__MM.setTake('beats', 3);
      return window.__MM.loop();
    });
    if (odd.steps !== 12 || odd.perBeat !== 4)
      fail('a 3/4 take grids at ' + odd.steps + ' steps a bar, ' + odd.perBeat + ' a beat');
    else if (odd.songSteps !== odd.bars * 12 || odd.last >= odd.songSteps || odd.over > 0.001)
      fail('re-gridding to 3/4 left the loop ragged: last=' + odd.last + ' of ' +
           odd.songSteps + ', over=' + odd.over);
    else console.log('LOOP=3/4 regrids to 12 steps a bar, 4 to the beat, still closed');

    /* and it has to come round again: play past the end and the playhead is
       back inside the loop with the transport still running */
    const short = await page.evaluate(`(() => {
      const mk = ${mkLoose};
      const made = window.__MM.process(mk(120, 4, 2, 0.8, 0), 'ROUND AND ROUND');
      window.__MM.pick('t:' + made.id);
      return window.__MM.loop();
    })()`);
    await page.evaluate(() => window.__MM.holdAll(true));
    await page.waitForTimeout(Math.round(short.dur * 1000) + 500);
    const wrapped = await page.evaluate(() => window.__MM.take());
    await page.evaluate(() => window.__MM.holdAll(false));
    if (!wrapped.playing) fail('the take stopped instead of looping');
    else if (wrapped.pos >= short.dur)
      fail('after ' + short.dur + 's the playhead reads ' + wrapped.pos + ' - it ran off the end');
    else console.log('LOOP=came round: ' + short.dur.toFixed(2) + 's loop, playhead back at ' +
                     wrapped.pos.toFixed(2) + 's');

    /* one clean take to name and then delete */
    await page.evaluate(() => { window.__MM.wipeTakes(); window.__MM.pick('rec'); });
    await page.waitForTimeout(150);
    await page.evaluate(`(() => {
      const mk = ${mkLoose};
      const made = window.__MM.process(mk(120, 4, 4, 2.6, 3), 'LOOP ME');
      window.__MM.pick('t:' + made.id);
    })()`);
    await page.waitForTimeout(200);

    /* Typing a name must not play the drums. Every letter in this string bar
       one is a pad key, and a window-level handler that preventDefault()s them
       is why half of them never reached the field. */
    await page.evaluate(() => window.__MM.setTool('edit'));
    await page.waitForTimeout(80);
    await page.click('#tk-title');
    await page.evaluate(() => { document.getElementById('tk-title').value = ''; });
    await page.keyboard.type('SAD FROG 12', { delay: 12 });
    const typed = await page.evaluate(() => ({
      v: document.getElementById('tk-title').value,
      held: window.__MM.state().held,
      name: window.__MM.take().name,
    }));
    if (typed.v !== 'SAD FROG 12')
      fail('typing a song title produced "' + typed.v + '" - the pad keys ate the rest');
    else if (typed.held) fail('typing a song title held ' + typed.held + ' pads down');
    else if (typed.name !== 'SAD FROG 12') fail('the take is named "' + typed.name + '"');
    else console.log('TITLE=' + typed.v + '  every pad letter and digit reached the field');

    /* and the keys have to come BACK the moment the field is done with them */
    await page.keyboard.press('Enter');
    await page.keyboard.down('a');
    await page.waitForTimeout(60);
    const keyBack = await page.evaluate(() => window.__MM.state().held);
    await page.keyboard.up('a');
    if (keyBack !== 1) fail('after leaving the title field a pad key held ' + keyBack + ' pads, expected 1');
    else console.log('TITLE=enter hands the keyboard back to the pads');

    /* DELETE is the only irreversible thing in the game, so it asks twice and
       asks the second time somewhere else: the menu hangs off the wrench at
       the top, the confirm sits at the bottom, and a second tap where the
       first one landed cannot answer it. */
    await page.evaluate(() => window.__MM.setTool('none'));
    await page.click('#tools');
    await page.waitForTimeout(80);
    const menuBox = await page.locator('#toolmenu').boundingBox();
    const row = await page.evaluate(() => {
      const b = document.querySelector('#toolmenu button[data-tool="delete"]');
      return b ? { label: b.textContent.trim(), off: !!b.disabled } : null;
    });
    if (!row) fail('there is no DELETE row in the tool menu');
    else if (row.off) fail('the DELETE row is disabled on a recorded song');
    else {
      await page.evaluate(() => document.querySelector('#toolmenu button[data-tool="delete"]').click());
      await page.waitForTimeout(80);
      const delBox = await page.locator('#del').boundingBox();
      const d1 = await page.evaluate(() => window.__MM.del());
      if (!d1.open) fail('picking DELETE did not open a confirmation');
      else if (d1.name !== 'SAD FROG 12')
        fail('the confirmation names "' + d1.name + '" rather than the selected song');
      else if (!delBox || delBox.y < menuBox.y + menuBox.height + 40)
        fail('the delete confirmation opens at y=' + (delBox && Math.round(delBox.y)) +
             ', right under the menu row that opened it (menu ends at ' +
             Math.round(menuBox.y + menuBox.height) + ')');
      else console.log('DELETE=asks at y=' + Math.round(delBox.y) + ', clear of the menu at ' +
                       Math.round(menuBox.y + menuBox.height));
      const d2 = await page.evaluate(() => window.__MM.del('no'));
      if (d2.open || d2.takes !== 1) fail('answering KEEP left ' + d2.takes + ' songs and open=' + d2.open);
      else console.log('DELETE=KEEP puts the song back untouched');
      const d3 = await page.evaluate(() => { window.__MM.del('ask'); return window.__MM.del('yes'); });
      if (d3.takes !== 0) fail('answering DELETE left ' + d3.takes + ' songs');
      else if (d3.sel !== '') fail('after deleting the selection the song list sits on "' + d3.sel + '"');
      else console.log('DELETE=gone, and the list falls back to nothing selected');
    }

    /* Landscape is the awkward case: the menu is now seven rows and does not
       fit under the wrench on a 390 px-tall screen, so it clamps upward - and
       once it does, "the confirm goes at the bottom" would put the answer
       under the finger that asked the question. */
    await page.evaluate(`(() => {
      const mk = ${mkLoose};
      const made = window.__MM.process(mk(120, 4, 4, 2.6, 3), 'LAND SCAPE');
      window.__MM.pick('t:' + made.id);
    })()`);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(250);
    await page.click('#tools');
    await page.waitForTimeout(80);
    const land = await page.evaluate(() => {
      const m = document.getElementById('toolmenu').getBoundingClientRect();
      const b = document.querySelector('#toolmenu button[data-tool="delete"]');
      const r = b.getBoundingClientRect();
      b.click();
      const d = document.getElementById('del').getBoundingClientRect();
      return { menuTop: Math.round(m.top), menuBottom: Math.round(m.bottom),
               rowMid: Math.round(r.top + r.height / 2),
               delTop: Math.round(d.top), delBottom: Math.round(d.bottom),
               h: window.innerHeight };
    });
    if (land.menuBottom > land.h)
      fail('in landscape the tool menu runs ' + (land.menuBottom - land.h) +
           'px off the bottom of the screen (menu ' + land.menuTop + '-' + land.menuBottom +
           ' of ' + land.h + ')');
    else if (land.delTop <= land.rowMid && land.delBottom >= land.rowMid)
      fail('in landscape the delete confirm (' + land.delTop + '-' + land.delBottom +
           ') opens over the menu row that asked, at y=' + land.rowMid);
    else console.log('DELETE=landscape: menu clamped to ' + land.menuTop + '-' + land.menuBottom +
                     ' of ' + land.h + ', confirm at ' + land.delTop + '-' + land.delBottom +
                     ' clear of the row at ' + land.rowMid);
    const landGone = await page.evaluate(() => window.__MM.del('yes'));
    if (landGone.takes !== 0) fail('deleting in landscape left ' + landGone.takes + ' songs');
    /* and the menu itself has to stay on the screen. Seven rows fit under the
       wrench on every phone in landscape today, so squash the viewport until
       they cannot - otherwise this is an assertion that can never go red. */
    await page.evaluate(() => window.__MM.pick('rec'));
    await page.setViewportSize({ width: 844, height: 260 });
    await page.waitForTimeout(220);
    await page.click('#tools');
    await page.waitForTimeout(80);
    const squash = await page.evaluate(() => {
      const m = document.getElementById('toolmenu').getBoundingClientRect();
      const r = { top: Math.round(m.top), bottom: Math.round(m.bottom), h: window.innerHeight };
      document.getElementById('veil').click();
      return r;
    });
    if (squash.bottom > squash.h || squash.top < 0)
      fail('squashed to ' + squash.h + 'px the tool menu sits at ' + squash.top + '-' +
           squash.bottom + ', off the screen');
    else console.log('MENU=fits a ' + squash.h + 'px screen at ' + squash.top + '-' + squash.bottom);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(250);

    /* a built-in song is not the CD's to delete */
    await page.evaluate(() => window.__MM.pick('0'));
    await page.waitForTimeout(150);
    const builtIn = await page.evaluate(() => ({
      tools: window.__MM.state().toolsShown,
      off: !!document.querySelector('#toolmenu button[data-tool="delete"]').disabled,
    }));
    if (builtIn.tools) fail('the wrench is showing on a built-in song');
    else if (!builtIn.off) fail('the DELETE row is live on a built-in song');
    else console.log('DELETE=refused on the five built-in songs');

    await page.reload();
    await page.waitForTimeout(900);
    const gone = await page.evaluate(() => window.__MM.takes());
    if (gone.length) fail('a deleted song came back after a reload');
    else console.log('DELETE=still gone after a reload');

    await page.evaluate(() => window.__MM.wipeTakes());
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
