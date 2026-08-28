// One place for every number the atlas depends on. The game reads the same
// values back out of sprites/atlas.json, so nothing is duplicated by hand.
//
// PPU is the number that matters: the game draws the board at about 7.6 device
// pixels per world unit on a phone (390 x 844, dpr 2), so a sprite rendered at
// 6.9 px/unit is resampled by about 10% and stays crisp. Rendering smaller than that
// is the one quality loss that cannot be recovered at runtime.
export const SS = 3;                    // supersample factor
// UNIT_TILE and UNIT_SPAN exist only to express PPU as "this many pixels for a
// unit this big". They are NOT the canvas a sprite is rendered into: that is
// RENDER_CANVAS, which is deliberately far larger so a raised sword or a long
// contact shadow has room, and the result is then trimmed to its own alpha
// bounds. Rendering into a tile the size of the finished sprite is how you clip
// a weapon and never notice.
export const UNIT_TILE = 152;
export const UNIT_SPAN = 22;            // world units across a unit tile
export const PPU = UNIT_TILE / UNIT_SPAN;   // 6.91
export const RENDER_CANVAS = 280;       // generous; every sprite is cropped after
export const UNIT_PIVOT_Y = 0.800;      // where the ground plane sits in that canvas
export const YAWS = 12;                 // 30-degree steps around the compass
export const FRAMES = 3;                // walk A, walk B, strike
export const GROUND_TILE = 256;
export const ATLAS_VERSION = 1;
