# What a web app can monitor, and where iOS stops it

From the 2026-07-27 session that shipped `signals/` — a live capability prober
for every signal class a web app can read.

**The catalog itself is not duplicated here.** `signals/index.html`'s `SIGNALS[]`
and `NATIVE_ONLY[]` arrays are the source of truth: 64 web-reachable signals
with a per-entry iOS verdict, plus 14 iPhone signals no browser reaches on any
platform. Copying that table into a note would guarantee the two drift apart.
What follows is only the part a *future session in this repo* needs without
opening the app.

## The one wall that decides architecture

**A web page cannot run in the background on iOS. At all.** Lock the screen or
switch apps and JavaScript stops — timers, `watchPosition`, media streams,
sockets. There is no Background Sync, no Periodic Background Sync, and Web Push
is `userVisibleOnly`, so it cannot be used for silent data collection either.

Everything else on the list is a detail; this is the line. Any feature phrased
as "keep checking / keep tracking / notice while they're away" is a native app,
and no amount of PWA work changes it.

The one genuine middle step before native: **Add to Home Screen**. On iOS 16.4+
that unlocks Web Push and durable storage (uninstalled sites can be evicted
after 7 days of no visits). It is free and needs no App Store. The prober
detects which side of that line it is on and says so.

## iOS boundaries that matter for games in this repo

Usable, and good: `devicemotion` / `deviceorientation` (tap-gated permission),
geolocation, microphone, camera, speech recognition, screen wake lock, gamepads
over Bluetooth, every `prefers-*` accessibility query, `visualViewport`.

Absent on iPhone, so never design around them:

- **No `navigator.vibrate`.** Haptics are native-only (Core Haptics). Nothing in
  `games/` uses it today — keep it that way; a game whose feedback loop depends
  on rumble simply has no feel on the target device.
- **No Battery Status API.** No "low battery, reduce effects" adaptation.
- **No ambient light sensor.** The only web workaround is mean camera-frame
  brightness, which lights the privacy indicator — rarely worth it.
- **No camera torch / exposure / zoom control**, so no camera-PPG heart rate.
- **No Network Information API.** To adapt to a bad connection, measure it:
  time your own `fetch` (the prober's RTT probe does exactly this and works
  everywhere). Do not reach for `navigator.connection` — it is Chromium-only.
- **No memory introspection**, and worse, Safari kills oversized tabs with no
  warning and no event. You cannot detect that you are approaching the limit.
- **No Bluetooth / NFC / USB / Serial / HID / MIDI.** All six, permanently as of
  2026, on fingerprinting grounds. App Store rules put every iOS browser on
  WebKit, so "use Chrome instead" is not an escape.

Two WebKit-specific wins worth remembering:

- **`event.webkitCompassHeading`** is the only true (magnetic-north) heading on
  iPhone — the standard `alpha` is *relative* there. Currently used nowhere in
  this repo; **wayfinder's compass is entirely in-world simulation**, which is
  correct for a sim, but a real-device-heading mode is available if it is ever
  wanted.
- **`visualViewport.height`** collapsing is the *only* way to detect the iOS
  keyboard — Safari fires no keyboard event. Subtract from `innerHeight`.

Motion permission is already handled correctly in `tilt-labyrinth` (gated behind
its ROLL action). It is the only game using orientation input.

## Camera capture: the `<video>` must be visible

`getUserMedia` video is new to this repo (sky-lantern was mic-only, see
`20260725-sensor-input-and-async-versus-games.md`).

**iOS Safari will not decode frames into a `<video>` that is detached from the
document or `display:none`.** The element must be in the DOM and rendered. The
canvas you `drawImage` from stays black otherwise — and it fails *only on iOS*,
so a desktop test proves nothing. Append a real (small) preview rather than
hiding it.

Everything downstream is then ordinary maths on `getImageData`: mean luma
(a stand-in for the absent light sensor), mean RGB, and inter-frame absolute
difference for motion energy.

## Two small rules that read as bugs when broken

- **A polling readout must do its first read immediately**, not wait for the
  first interval tick. Two probes shipped writing only from `setInterval(read,
  500)`; for half a second each looked hung. Call `read()` once before starting
  the timer. (Same family as `applyMute()` setting the icon before the guard.)
- **Auditing API usage by grepping the API name misses aliased access.**
  `tilt-labyrinth` does `const D = window.DeviceOrientationEvent;` then
  `D.requestPermission()`, so a repo-wide grep for
  `DeviceOrientationEvent.requestPermission` returns nothing and looks like a
  missing iOS permission gate. Grep the **method** name, not the receiver, then
  read the call site before concluding anything.

## Probe/readout harness shape (reusable)

If another page ever needs many independent live readouts, the shape that
worked: one `Map<Node,string>` of pending writes flushed by a single 100 ms
interval, so a 60 Hz probe cannot thrash the DOM; per-probe `onstop(fn)`
cleanup arrays; and a global `visibilitychange` handler that stops every
running probe — a camera or mic must never survive a tab switch.
