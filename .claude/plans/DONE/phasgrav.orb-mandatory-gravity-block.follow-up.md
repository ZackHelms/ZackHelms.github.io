# phasgrav — follow-up (2026-08-01 run)

## Blocked — needs you

- (none — but this is the run whose content most needs your playtest: L17–24
  start to finish. Every level should now force the orb into your hand; the
  shove — and the plain stone drag — should feel visibly futile where you
  used them before.)

## Decisions made on your behalf — review

- **The exploit was broader than your report (traced, task 2).** You reported
  shoving the puddle with a solid; reproducing it showed four maps
  (Sideways, Point Pull, Balloon Route, Reflow) could be solved by dragging
  the gem home **as stone — no melt at all** (they had no second solid to
  shove with). Hardened against the plan's stated criterion (pockets beyond
  any solid-reachable cell), which kills both the drag and the shove. The
  Kettle was measured already-proof (untouched). Master Facet had the one
  real shove exploit — killed with a 3-tall divide + far-cellar socket; its
  hint now names the lift.
- **Sockets moved on four maps** (Sideways → floor nook, Point Pull → one
  row down, Reflow → capped pocket w/ chute, Master Facet → right cellar;
  Balloon Route's pocket doorway narrowed). Each lesson preserved (verified
  per-map in the run transcript); `save.done` indices 16–18 shifted meaning
  with the AUTH reshuffle — acceptable, you are the only player.
- **Plan wording vs shipped gravmaze shape (task 3, measured):** the plan's
  literal "serpentine 1-wide channel" is unsolvable for the soft-body pour —
  0/24 across candidates (particles cannot file through 1-cell gates into
  1-row legs). Shipped shape: sealed 3-row tunnel under the drawer, 1-cell
  mouth, 2–3 alternating roof/floor baffles, roofed socket alcove — 40/40,
  and solid-impassability is *stronger* than the plan asked (BFS: no solid
  placement reaches ANY tunnel cell).
- **`getLevel` now prefers gravmaze candidates in block 2** (same scan
  mechanism as woven boards in blocks 5–7) — without it the served L24's
  salt-0 roll (0.718) shipped a drawer and the block's one generated level
  missed its own template. Blocks ≥3 byte-identical (2846/2862 candidate
  defs unchanged; the 16 diffs are all index 23 at exactly the sub-0.60
  salts).
- Maze-gem drawer pool excludes `M` (1×1 fits the mouth) and `B` (L-tromino
  notch dips into an edge mouth — caught by BFS at salts 3 and 7).
- Suite label fix: Room to Pour's `load(9)` checks printed `L20:` (stale
  labels colliding with The Kettle's real L20) — relabeled `L10:`,
  assertions untouched.

## Deferred / discovered follow-ups

- **Obstacle-era gravmazes** (bushes/fans/voids woven into orb mazes,
  blocks 5+) — already a Later backlog item per your walls-only decision;
  note that until it lands, index 23 is the ONLY gravmaze index, so the
  60% odds mostly govern salt re-rolls, not variety across levels.
- **Traced-but-inert corner (task 4):** the maze-GEM pool still includes
  `B`; its notch cell can rest at the mouth row without breaching the
  tunnel (cannot descend further, so anti-shove holds). If a future BFS
  audit trips on it, exclude `B` from the maze-gem role too.
- Ramp checks skip blocks 1–2 by design (single generated index each,
  below the ramp's ≥2 threshold) — pre-existing, noted so nobody reads
  block 2's silence as a gap introduced here.
