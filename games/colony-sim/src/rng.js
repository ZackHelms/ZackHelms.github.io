// rng.js — seeded randomness. sfc32 core; named streams so one system's draws
// never shift another's (a test can then force one outcome without moving the rest).
// A stream's state is four uint32s, so a whole simulation can be saved and restored.
export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
function wrap(seed, name, st) {
  const r = {
    s: st,
    next() {
      const s = r.s;
      let a = s[0] >>> 0, b = s[1] >>> 0, c = s[2] >>> 0, d = s[3] >>> 0;
      let t = (a + b) | 0; a = b ^ (b >>> 9); b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11); d = (d + 1) | 0; t = (t + d) | 0; c = (c + t) | 0;
      s[0] = a >>> 0; s[1] = b >>> 0; s[2] = c >>> 0; s[3] = d >>> 0;
      return (t >>> 0) / 4294967296;
    },
    range: (a, b) => a + r.next() * (b - a),
    int: (a, b) => a + Math.floor(r.next() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(r.next() * arr.length)],
    chance: (p) => r.next() < p,
    stream: (n) => gen(seed, name + '/' + n),
    save: () => r.s.slice(),
    load: (arr) => { r.s = arr.slice(); return r; },
  };
  return r;
}
function gen(seed, name) {
  const h = fnv1a(String(seed) + '|' + name);
  const r = wrap(seed, name, [h, h ^ 0x9e3779b9, (Math.imul(h, 31) ^ 0x85ebca6b) >>> 0, fnv1a(name + '#' + seed)]);
  for (let i = 0; i < 12; i++) r.next();
  return r;
}
export function makeRng(seed) { return gen(seed >>> 0, 'root'); }
export function hashState(obj) { return fnv1a(JSON.stringify(obj)).toString(16).padStart(8, '0'); }
