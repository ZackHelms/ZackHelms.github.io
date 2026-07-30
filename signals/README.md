# signals/

A single self-contained page that answers one question: **what can a web app
actually monitor?** — and answers it about the browser the visitor is holding,
not in the abstract.

Live at `https://tythos.com/signals/`
(`https://ZackHelms.github.io/signals` redirects there — the repo has a `CNAME`).

## What it does

Every entry is feature-detected at load, and most have a **PROBE** button that
starts the signal for real and streams live values: accelerometer axes, compass
heading, GPS fix, mic dBFS + spectrum, camera brightness and motion energy,
WebRTC round-trip time, frame rate and jank, visual-viewport keyboard height,
touch contact size, and so on.

That makes the badges evidence rather than claims. Opening the same page on a
desktop Chromium and on an iPhone gives two very different scores, which is the
whole point — the gap between them *is* the answer to "do I need a native app".

Four states:

| Badge | Meaning |
|---|---|
| `LIVE` | readable right now, no permission needed |
| `PERMISSION` | the API exists here; needs consent or a user gesture |
| `ABSENT` | no such API in this browser |
| `NATIVE` | no web API on any platform — needs an app |

## Layout

One file, `index.html`, no build step, no dependencies, no backend, no
analytics. Google Fonts is the only external request. Every probe runs locally
and nothing is transmitted.

Structure of the script block:

1. `GROUPS[]` — the 13 category headers and their blurbs.
2. `SIGNALS[]` — the catalog. One object per signal.
3. `NATIVE_ONLY[]` — iPhone signals no browser can reach, rendered as a
   separate closing section.
4. Engine — card building, filtering, the throttled readout flush, and the
   report exporter.

## Adding a signal

Append one object to `SIGNALS[]`:

```js
{
  g:'net',                       // group id from GROUPS[]
  id:'my-signal',                // unique, used for probe bookkeeping
  n:'Human readable name',
  w:'One sentence on what it measures and why you would want it.',
  api:'the API call, verbatim',  // rendered in a scrollable code block
  ios:'yes'|'partial'|'no',      // editorial iPhone verdict → coloured tag
  perm:'none'|'permission'|'gesture'|'tap + permission'|'install + permission',
  https:true,                    // optional → adds an "HTTPS only" tag
  iosn:'iPhone note. <b>HTML allowed here</b> — it is authored, not user input.',
  nat:'Native route → framework and class names.',   // optional
  det: () => 'yes'|'gate'|'no',  // wrapped in try/catch by the engine
  probe: async io => { /* optional */ }
}
```

`nativeOnly:true` skips `det`/`probe` and forces the `NATIVE` badge.

### The probe contract

`probe(io)` may be async. `io` gives you:

- `io.set(text)` — throttled write, flushed at 10 Hz. **Use this for anything
  firing at frame rate**; writing directly at 60 Hz on a phone is visible jank.
- `io.now(text)` / `io.err(text)` — immediate write; `err` also colours it red.
- `io.onstop(fn)` — register cleanup. Every listener, interval, rAF handle,
  `MediaStream` track and `AudioContext` **must** be torn down here.
- `io.box` / `io.card` — the readout container and the whole card, if the probe
  needs to append an element (video preview, input, button) or attach listeners.
- `io.watchdog(cond, msg)` — after 1.8 s, if `cond()` still holds, write `msg`.
  Used to distinguish "permission granted but the hardware sent nothing" from
  "still waiting", which is otherwise indistinguishable to the user.

Throwing from a probe is fine — the engine catches it and renders the error,
which is usually the most informative outcome (a denied permission shows its
real `NotAllowedError`). Probes are stopped automatically on `visibilitychange`
so a camera or mic never survives a tab switch.

## Gotchas worth keeping

- **The camera preview `<video>` must be in the document and visible.** iOS
  Safari will not decode frames into a detached or `display:none` element, so
  the canvas you sample from stays black. This is why the probe appends a real
  130 px preview rather than a hidden element.
- **Do the first read immediately**, not only on the interval — a probe whose
  first paint waits 500 ms reads as broken.
- `det()` returning `gate` (not `yes`) is correct whenever the API is present
  but a permission or gesture stands between it and a value. iOS motion is the
  canonical case.

## Verifying a change

There is no test suite; the check is a headless pass with Playwright (Chromium
is pre-installed in Claude Code web sessions at `/opt/pw-browsers`). Serve the
repo, load `/signals/`, click every `.probe-btn`, and assert that no card's
readout is left empty or stuck on `starting…` and that `pageerror` count is
zero. Grant fake media devices with
`--use-fake-device-for-media-stream --use-fake-ui-for-media-stream` so the
camera and mic paths get exercised too.

Also update the `#build-badge` timestamp on every edit, per the repo SOP — it
is how you tell a deployed change from a cached one.

## Downstream consumer: the iOS app

This page is **copied**, not linked, into a native iOS app. `ZackHelms/rn-ios-flightdeck`
carries it at `games/signals/www/index.html`, where it is the **WEB** tab of an
app whose **NATIVE** tab probes the same signal classes through CoreMotion,
CoreLocation, AVFoundation, Network.framework and CoreBluetooth — so the two can
be compared on one phone. It shipped to TestFlight 2026-07-30.

**Editing this file does not update the app.** That needs a re-import from a
session working in flightdeck:

```bash
scripts/import-web-game.sh signals <path-to-this-repo>/signals "Signals"
```

which replaces only `www/`, then a dispatch of `ios-build.yml`.

Two things worth knowing when reasoning about this page's iOS behaviour:

- **Inside that app it runs in a WKWebView, which is not Safari.** Since iOS 15
  WebKit denies `DeviceOrientationEvent.requestPermission()` unless the host app
  implements `requestDeviceOrientationAndMotionPermissionFor`, which
  `react-native-webview` does not. Motion, orientation and compass read DENIED
  there for shell reasons, not device reasons — the app shows a banner saying so.
  Judge this page's real iOS behaviour in Safari, never in that tab.
- The native side measured **14 signals that no browser can reach on iOS**,
  which is the concrete answer to the question this page raises. If you extend
  `NATIVE_ONLY[]` here, the app's `src/catalog.ts` is where the native
  counterpart would go.
