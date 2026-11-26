// rng.js — seeded randomness. sfc32 core; named streams so one system's draws
// never shift another's (a test can then force one outcome without moving the rest).
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
function sfc32(a, b, c, d) {
  return function () {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11); d = (d + 1) | 0; t = (t + d) | 0; c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}
function gen(seed, name) {
  const h = fnv1a(String(seed) + '|' + name);
  const f = sfc32(h, h ^ 0x9e3779b9, (h * 31) ^ 0x85ebca6b, fnv1a(name + '#' + seed));
  for (let i = 0; i < 12; i++) f();
  const r = {
    next: f,
    range: (a, b) => a + f() * (b - a),
    int: (a, b) => a + Math.floor(f() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(f() * arr.length)],
    chance: (p) => f() < p,
    stream: (n) => gen(seed, name + '/' + n),
  };
  return r;
}
export function makeRng(seed) { return gen(seed >>> 0, 'root'); }
export function hashState(obj) { return fnv1a(JSON.stringify(obj)).toString(16).padStart(8, '0'); }
