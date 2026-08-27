// FIREBALL -- "a ball of fire". No diffuse read at all: it is a churning
// emissive shell with charred ember wads riding it and a ragged corona. Six
// frames walk the turbulence through the flame's own frame, so looping reads
// as one continuous burn rather than six unrelated fireballs.
import { Model, sphere, xf } from '../lib/geom.mjs';
import { hash3 } from '../lib/noise.mjs';

export const FIRE_R = 3.0;
export const FIRE_FRAMES = 6;

export function fireball(frame) {
  const m = new Model();
  const ph = frame / FIRE_FRAMES;
  // core shell, then two counter-drifting outer shells for depth
  m.add('fire', sphere(FIRE_R, 40, 26), xf({ t: [0, 0, 0], s: [1, 1, 1] }));
  m.add('fire', sphere(FIRE_R * 0.80, 32, 20),
        xf({ t: [Math.cos(ph * 6.28) * 0.5, Math.sin(ph * 6.28) * 0.4, 0.5], s: [1.1, 0.95, 1.05] }));
  // ember wads: opaque, barely lit, and the reason the ball reads as a volume
  for (let k = 0; k < 7; k++) {
    const a = hash3(k, 3, 1, 61) * Math.PI * 2 + ph * 2.4;
    const b = (hash3(k, 7, 2, 67) - 0.5) * 2.2;
    const r = FIRE_R * (0.72 + hash3(k, 11, 3, 71) * 0.34);
    m.add('ember', sphere(FIRE_R * (0.18 + hash3(k, 13, 4, 73) * 0.16), 14, 10),
          xf({ t: [Math.cos(a) * r, Math.sin(a) * r * 0.8, b * r * 0.55] }));
  }
  return m.finalize();
}
