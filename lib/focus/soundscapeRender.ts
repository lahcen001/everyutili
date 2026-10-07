/**
 * Offline synthesis of natural-sounding ambience. Each function returns one mono channel of
 * `seconds` of audio in roughly [-1, 1]; call it again for the other ear to get a decorrelated
 * stereo image. Pure functions (random source and sample rate are parameters) so they can be tested.
 */

export type Rand = () => number;

const TAU = Math.PI * 2;

/** One-pole low-pass coefficient for a cutoff in Hz. */
const lpCoef = (cutoff: number, sr: number) => 1 - Math.exp((-TAU * Math.min(cutoff, sr * 0.45)) / sr);

/** Slowly wandering control signal in 0..1 (smoothed noise), rate roughly `hz` changes per second. */
function wander(n: number, sr: number, hz: number, rand: Rand): Float32Array {
  const out = new Float32Array(n);
  const a = lpCoef(hz, sr);
  let v = 0.5;
  for (let i = 0; i < n; i++) {
    v += a * (rand() - v) * 2.2;
    out[i] = Math.min(1, Math.max(0, v));
  }
  return out;
}

/** Crossfades the end into the start so the buffer loops with no click. */
export function makeLoopable(data: Float32Array, fade: number): Float32Array {
  const n = data.length - fade;
  const out = data.slice(0, n);
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    out[i] = data[i] * Math.sin((t * Math.PI) / 2) + data[n + i] * Math.cos((t * Math.PI) / 2);
  }
  return out;
}

function normalize(data: Float32Array, peak: number): Float32Array {
  let max = 0;
  for (const v of data) max = Math.max(max, Math.abs(v));
  if (max > 0) {
    const k = peak / max;
    for (let i = 0; i < data.length; i++) data[i] *= k;
  }
  return data;
}

/** Adds a short filtered noise burst (a drop, pop or snap) into `out` at sample `at`. */
function burst(out: Float32Array, at: number, length: number, amp: number, brightness: number, rand: Rand) {
  let lp = 0;
  for (let j = 0; j < length && at + j < out.length; j++) {
    const env = Math.exp((-5 * j) / length);
    lp += brightness * ((rand() * 2 - 1) - lp);
    out[at + j] += (lp * 2.2 + (rand() * 2 - 1) * 0.15) * env * amp;
  }
}

export function renderRain(sr: number, seconds: number, rand: Rand = Math.random): Float32Array {
  const fade = Math.floor(sr * 1.5);
  const n = Math.floor(sr * seconds) + fade;
  const out = new Float32Array(n);
  const intensity = wander(n, sr, 0.12, rand);
  // dense, bright hiss of countless small drops
  let hp = 0;
  let lp = 0;
  const hpA = lpCoef(1400, sr);
  const lpA = lpCoef(9000, sr);
  for (let i = 0; i < n; i++) {
    const w = rand() * 2 - 1;
    hp += hpA * (w - hp);
    lp += lpA * (w - hp - lp);
    out[i] = lp * (0.22 + 0.2 * intensity[i]);
  }
  // individual, audible drops (more of them when the rain "picks up")
  for (let i = 0; i < n; ) {
    i += Math.floor((-Math.log(1 - rand()) / (60 + 140 * intensity[Math.min(n - 1, i)])) * sr) + 1;
    if (i >= n) break;
    burst(out, i, Math.floor(sr * (0.002 + rand() * 0.012)), 0.1 + rand() * rand() * 0.9, 0.15 + rand() * 0.6, rand);
  }
  // distant low rumble
  let b = 0;
  for (let i = 0; i < n; i++) {
    b += lpCoef(180, sr) * ((rand() * 2 - 1) - b);
    out[i] += b * 0.5;
  }
  return normalize(makeLoopable(out, fade), 0.85);
}

export function renderOcean(sr: number, seconds: number, rand: Rand = Math.random): Float32Array {
  const fade = Math.floor(sr * 2);
  const n = Math.floor(sr * seconds) + fade;
  const env = new Float32Array(n);
  // a run of waves: each swells slowly, breaks, then washes back
  for (let t = rand() * 2; t < seconds + 4; t += 6 + rand() * 5) {
    const rise = 2.5 + rand() * 2.5;
    const fall = 3 + rand() * 4;
    const peak = 0.6 + rand() * 0.4;
    for (let i = Math.max(0, Math.floor(t * sr)); i < n; i++) {
      const dt = Math.max(0, i / sr - t);
      const e = dt < rise ? Math.pow(dt / rise, 2.2) : Math.exp(-(dt - rise) / (fall / 3));
      if (e < 0.002 && dt > rise) break;
      env[i] += e * peak;
    }
  }
  const out = new Float32Array(n);
  let lp = 0;
  let lp2 = 0;
  let rumble = 0;
  for (let i = 0; i < n; i++) {
    const e = Math.min(1.4, env[i]);
    const w = rand() * 2 - 1;
    // louder waves are brighter (surf and foam)
    lp += lpCoef(250 + 3800 * e * e, sr) * (w - lp);
    lp2 += lpCoef(250 + 3800 * e * e, sr) * (lp - lp2);
    rumble += lpCoef(120, sr) * (w - rumble);
    out[i] = lp2 * (0.25 + 1.7 * e) * 2.5 + rumble * 0.6;
  }
  return normalize(makeLoopable(out, fade), 0.8);
}

export function renderWind(sr: number, seconds: number, rand: Rand = Math.random): Float32Array {
  const fade = Math.floor(sr * 2);
  const n = Math.floor(sr * seconds) + fade;
  const gust = wander(n, sr, 0.25, rand);
  const flutter = wander(n, sr, 3, rand);
  const out = new Float32Array(n);
  let a = 0;
  let b = 0;
  let c = 0;
  for (let i = 0; i < n; i++) {
    const g = gust[i];
    const w = rand() * 2 - 1;
    const cut = 160 + 1700 * g * g;
    a += lpCoef(cut, sr) * (w - a);
    b += lpCoef(cut, sr) * (a - b);
    // faint whistling band that drifts with the gust
    c += lpCoef(cut * 1.8, sr) * (w - c);
    const whistle = (c - a) * 0.5;
    out[i] = (b * 3 + whistle * g) * (0.12 + 0.88 * g) * (0.85 + 0.3 * flutter[i]);
  }
  return normalize(makeLoopable(out, fade), 0.75);
}

export function renderStream(sr: number, seconds: number, rand: Rand = Math.random): Float32Array {
  const fade = Math.floor(sr * 1.5);
  const n = Math.floor(sr * seconds) + fade;
  const mods = [wander(n, sr, 9, rand), wander(n, sr, 17, rand), wander(n, sr, 30, rand)];
  const slow = wander(n, sr, 0.3, rand);
  const out = new Float32Array(n);
  let a = 0;
  let b = 0;
  for (let i = 0; i < n; i++) {
    const w = rand() * 2 - 1;
    // the babble: noise whose pitch and level wobble quickly, like water over stones
    const m = mods[0][i] * 0.5 + mods[1][i] * 0.3 + mods[2][i] * 0.2;
    a += lpCoef(900 + 3600 * m, sr) * (w - a);
    b += lpCoef(500, sr) * (a - b);
    out[i] = (a - b) * (0.25 + 1.6 * m * m) * (0.8 + 0.4 * slow[i]);
  }
  return normalize(makeLoopable(out, fade), 0.8);
}

export function renderFire(sr: number, seconds: number, rand: Rand = Math.random): Float32Array {
  const fade = Math.floor(sr * 1.5);
  const n = Math.floor(sr * seconds) + fade;
  const flicker = wander(n, sr, 2, rand);
  const out = new Float32Array(n);
  let lp = 0;
  let lp2 = 0;
  for (let i = 0; i < n; i++) {
    const w = rand() * 2 - 1;
    lp += lpCoef(500, sr) * (w - lp);
    lp2 += lpCoef(2500, sr) * (w - lp2);
    out[i] = lp * (0.5 + 0.7 * flicker[i]) + (lp2 - lp) * 0.12 * flicker[i];
  }
  // crackles and the occasional loud snap
  for (let i = 0; i < n; ) {
    i += Math.floor((-Math.log(1 - rand()) / (7 + 10 * flicker[Math.min(n - 1, i)])) * sr) + 1;
    if (i >= n) break;
    const snap = rand() < 0.12;
    burst(out, i, Math.floor(sr * (snap ? 0.012 : 0.002 + rand() * 0.004)), snap ? 1.2 + rand() : 0.25 + rand() * rand() * 1.1, 0.5 + rand() * 0.45, rand);
  }
  return normalize(makeLoopable(out, fade), 0.85);
}
