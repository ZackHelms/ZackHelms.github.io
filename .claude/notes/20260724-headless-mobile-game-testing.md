# Headless mobile game testing (iPhone 13 viewport) — harness + gotchas

From the 2026-07-24 session that shipped Merge Drop and Neon Golf. Both games
were verified before push by driving them headlessly in Chromium at the
target device profile. The reusable minimum lives in
`.claude/scripts/smoke-mobile.cjs` (error-free load gate); this note records
the fuller gameplay-driving pattern and the traps hit.

## Harness pattern

- Remote sessions: Chromium is pre-installed at `/opt/pw-browsers/chromium`;
  do NOT `playwright install`. `npm install playwright-core` in the session
  scratchpad and launch with `executablePath`.
- Device profile that matches the design target:
  `{ viewport: {width:390, height:844}, deviceScaleFactor:3, isMobile:true,
  hasTouch:true }` (iPhone 13).
- Load games via `file://` URLs — everything is self-contained, so no server
  is needed. Filter out Google-Fonts/network console errors
  (`/fonts\.g|net::ERR|Failed to load resource/i`); fail on the rest.
- **Touch drags:** `page.touchscreen` only taps. For drag gestures
  (golf pull-back, aim-and-release), synthesize `TouchEvent`s inside
  `page.evaluate` — `new Touch({identifier, target, clientX, clientY})`
  dispatched as `touchstart` / interpolated `touchmove`s / `touchend` on
  `document.elementFromPoint(x, y)`. Works because the games listen on the
  canvas with `{passive:false}`.
- Game internals (top-level `let` state like `orbs`, `ball`, `state`) are
  reachable from `page.evaluate` — classic scripts put top-level lexical
  bindings in the realm's global scope. Drive deterministic scenarios by
  setting state directly (place ball beside cup, push orbs into the tank)
  instead of relying on random gameplay.
- Useful sweep for physics games: fire the ball/orb at max speed in N
  directions per level and assert (a) it never escapes the playfield bounds
  and (b) it always comes to rest — catches tunneling and energy leaks
  cheaply (54 shots across Neon Golf's 9 holes ran in seconds).

## Test-design traps hit (the game was right, the test was wrong)

- **Merge test:** two same-tier orbs placed 4 px apart never merge — merges
  require actual circle overlap (`d² < (r1+r2)²`), and two orbs resting on
  the floor have no lateral force pulling them together. Deterministic merge
  tests must place the pair overlapping.
- **Overflow test:** dumping 40 same-tier orbs to force a game-over fails —
  the game chain-merges them into a few big orbs and the pile ends up *below*
  the danger line. That's the core mechanic working, not a bug. To test the
  danger-line rule deterministically, build a column of *alternating* tiers
  (can't merge) taller than the tank.
- iOS fires both `touchend` and `click` for one tap on overlay elements —
  the games debounce (400 ms) their start/retry handlers for this; tests
  should tap once and not assume a second event is a second intent.

## Related SOP

After pushing: `git push` ≠ live. Verify the "pages build and deployment"
workflow run for the pushed SHA concludes `success` (three jobs: build,
report-build-status, deploy), then compare the page's `#build-badge`
timestamp against the live page. Config: `.claude/zmh/producer.md` § Publish.
