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

// ---------------------------------------------------------------------------
// More ambience: storms, wildlife, rooms and rhythms
// ---------------------------------------------------------------------------

/** Distant thunder: quiet rumble with an occasional crack that rolls away over several seconds. */
export function renderThunder(sr: number, seconds: number, rand: Rand = Math.random): Float32Array {
  const fade = Math.floor(sr * 2);
  const n = Math.floor(sr * seconds) + fade;
  const env = new Float32Array(n);
  for (let t = 1 + rand() * 4; t < seconds + 2; t += 9 + rand() * 12) {
    const parts = 3 + Math.floor(rand() * 3);
    for (let p = 0; p < parts; p++) {
      const start = t + (p === 0 ? 0 : 0.4 + rand() * 2.2);
      const amp = (p === 0 ? 1 : 0.35 + rand() * 0.5) * (0.7 + rand() * 0.3);
      const decay = 1.2 + rand() * 2.2;
      for (let i = Math.max(0, Math.floor(start * sr)); i < n; i++) {
        const dt = i / sr - start;
        const e = Math.exp(-dt / decay) * Math.min(1, dt * 18);
        if (e < 0.003) break;
        env[i] += e * amp;
      }
    }
  }
  const out = new Float32Array(n);
  let a = 0, b = 0, hiss = 0;
  for (let i = 0; i < n; i++) {
    const w = rand() * 2 - 1;
    const e = Math.min(1.5, env[i]);
    a += lpCoef(70 + 200 * e, sr) * (w - a);
    b += lpCoef(70 + 200 * e, sr) * (a - b);
    hiss += lpCoef(1500, sr) * (w - hiss);
    out[i] = b * (0.03 + 5 * e) + hiss * e * e * 0.08;
  }
  return normalize(makeLoopable(out, fade), 0.9);
}

/** Night crickets: a few insects chirping in pulses at slightly different pitches and speeds. */
export function renderCrickets(sr: number, seconds: number, rand: Rand = Math.random): Float32Array {
  const fade = Math.floor(sr * 1);
  const n = Math.floor(sr * seconds) + fade;
  const out = new Float32Array(n);
  const voices = Array.from({ length: 4 }, () => ({ f: Math.min(sr * 0.4, 4200 + rand() * 900), chirp: 2.4 + rand() * 1.6, pulse: 32 + rand() * 12, phase: rand() * 10, gain: 0.5 + rand() * 0.5 }));
  for (const v of voices) {
    for (let i = 0; i < n; i++) {
      const t = i / sr + v.phase;
      const gate = (t * v.chirp) % 1 < 0.38 ? 1 : 0;
      const pulse = Math.max(0, Math.sin(TAU * v.pulse * t));
      out[i] += Math.sin(TAU * v.f * t) * gate * pulse * pulse * v.gain * 0.25;
    }
  }
  let rustle = 0;
  for (let i = 0; i < n; i++) {
    rustle += lpCoef(900, sr) * (rand() * 2 - 1 - rustle);
    out[i] += rustle * 0.03;
  }
  return normalize(makeLoopable(out, fade), 0.6);
}

/** A forest at dawn: scattered bird calls (gliding chirps) over soft leaves. */
export function renderBirds(sr: number, seconds: number, rand: Rand = Math.random): Float32Array {
  const fade = Math.floor(sr * 1.5);
  const n = Math.floor(sr * seconds) + fade;
  const out = new Float32Array(n);
  const chirp = (at: number, f0: number, f1: number, len: number, gain: number) => {
    const L = Math.floor(len * sr);
    let phase = 0;
    for (let j = 0; j < L && at + j < n; j++) {
      const u = j / L;
      const f = Math.min(sr * 0.45, f0 + (f1 - f0) * (u * u * (3 - 2 * u)) + Math.sin(u * 40) * 60);
      phase += (TAU * f) / sr;
      out[at + j] += Math.sin(phase) * Math.sin(Math.PI * u) ** 2 * gain;
    }
  };
  for (let t = rand() * 1.5; t < seconds; t += 0.5 + rand() * 2.8) {
    const base = 2200 + rand() * 3200;
    const near = 0.15 + rand() * 0.55;
    const count = rand() < 0.4 ? 3 + Math.floor(rand() * 3) : 1 + Math.floor(rand() * 2);
    let at = Math.floor(t * sr);
    for (let k = 0; k < count; k++) {
      const len = 0.06 + rand() * 0.14;
      chirp(at, base, base * (rand() < 0.5 ? 1.35 : 0.75), len, near);
      at += Math.floor((len + 0.05 + rand() * 0.08) * sr);
    }
  }
  let leaf = 0;
  let leaf2 = 0;
  for (let i = 0; i < n; i++) {
    const w = rand() * 2 - 1;
    leaf += lpCoef(2500, sr) * (w - leaf);
    leaf2 += lpCoef(500, sr) * (w - leaf2);
    out[i] += (leaf - leaf2) * 0.05;
  }
  return normalize(makeLoopable(out, fade), 0.8);
}

/** A café: layers of low murmur with the occasional cup clink. */
export function renderCafe(sr: number, seconds: number, rand: Rand = Math.random): Float32Array {
  const fade = Math.floor(sr * 1.5);
  const n = Math.floor(sr * seconds) + fade;
  const out = new Float32Array(n);
  for (let voice = 0; voice < 3; voice++) {
    const rhythm = wander(n, sr, 2.5 + rand() * 3, rand);
    const slow = wander(n, sr, 0.3, rand);
    const centre = 380 + rand() * 500;
    let a = 0, b = 0, c = 0, d = 0;
    for (let i = 0; i < n; i++) {
      const w = rand() * 2 - 1;
      a += lpCoef(centre * 1.6, sr) * (w - a);
      b += lpCoef(centre * 0.6, sr) * (a - b);
      c += lpCoef(centre * 3.2, sr) * (w - c);
      d += lpCoef(centre * 1.2, sr) * (c - d);
      out[i] += ((a - b) + (c - d) * 0.6) * rhythm[i] ** 1.5 * (0.3 + slow[i]) * 0.8;
    }
  }
  for (let i = 0; i < n; ) {
    i += Math.floor((-Math.log(1 - rand()) / 0.35) * sr) + 1;
    if (i >= n) break;
    const f = 2800 + rand() * 2600;
    const L = Math.floor(0.12 * sr);
    const amp = 0.04 + rand() * 0.1;
    for (let j = 0; j < L && i + j < n; j++) out[i + j] += Math.sin(TAU * f * (j / sr)) * Math.exp(-j / (0.025 * sr)) * amp;
  }
  return normalize(makeLoopable(out, fade), 0.7);
}

/** A train on the tracks: deep rumble with a steady clickety-clack. */
export function renderTrain(sr: number, seconds: number, rand: Rand = Math.random): Float32Array {
  const period = 0.42;
  const beats = Math.max(8, Math.round(seconds / period));
  const n = Math.floor(beats * period * sr);
  const out = new Float32Array(n);
  let rumble = 0;
  let rumble2 = 0;
  for (let i = 0; i < n; i++) {
    const w = rand() * 2 - 1;
    rumble += lpCoef(110, sr) * (w - rumble);
    rumble2 += lpCoef(280, sr) * (w - rumble2);
    out[i] = rumble * 3.2 + rumble2 * 0.8;
  }
  for (let b = 0; b < beats; b++) {
    for (const [off, amp] of [[0, 1], [0.085, 0.75]] as const) {
      const at = Math.floor((b * period + off) * sr);
      const L = Math.floor(0.06 * sr);
      let hp = 0;
      let lp = 0;
      for (let j = 0; j < L; j++) {
        const w = rand() * 2 - 1;
        lp += lpCoef(2400, sr) * (w - lp);
        hp += lpCoef(500, sr) * (lp - hp);
        out[(at + j) % n] += (lp - hp) * Math.exp(-j / (0.014 * sr)) * amp * 1.4 * (0.85 + rand() * 0.3);
      }
    }
  }
  return normalize(out, 0.85);
}

/** A ticking clock: a soft tick and a slightly lower tock each second. */
export function renderClock(sr: number, seconds: number): Float32Array {
  const secs = Math.max(2, Math.round(seconds / 2) * 2);
  const n = Math.floor(secs * sr);
  const out = new Float32Array(n);
  for (let s = 0; s < secs; s++) {
    const f = s % 2 === 0 ? 2300 : 1750;
    const at = Math.floor(s * sr);
    const L = Math.floor(0.05 * sr);
    for (let j = 0; j < L; j++) {
      const t = j / sr;
      out[at + j] += (Math.sin(TAU * f * t) * Math.exp(-t / 0.006) + Math.sin(TAU * f * 0.5 * t) * Math.exp(-t / 0.012) * 0.6) * (s % 2 === 0 ? 1 : 0.85);
    }
  }
  return normalize(out, 0.7);
}

/** A slow heartbeat (about 62 bpm): "lub-dub". */
export function renderHeartbeat(sr: number, seconds: number): Float32Array {
  const period = 0.97;
  const beats = Math.max(4, Math.round(seconds / period));
  const n = Math.floor(beats * period * sr);
  const out = new Float32Array(n);
  const thump = (at: number, f: number, amp: number, decay: number) => {
    const L = Math.floor(0.4 * sr);
    for (let j = 0; j < L; j++) {
      const t = j / sr;
      out[(at + j) % n] += Math.sin(TAU * f * t * (1 - 0.3 * Math.min(1, t * 6))) * Math.exp(-t / decay) * Math.min(1, t * 120) * amp;
    }
  };
  for (let b = 0; b < beats; b++) {
    const at = Math.floor(b * period * sr);
    thump(at, 62, 1, 0.07);
    thump(at + Math.floor(0.3 * sr), 52, 0.7, 0.06);
  }
  return normalize(out, 0.9);
}

/** Someone typing on a mechanical keyboard: bursts of keystrokes with natural pauses. */
export function renderKeyboard(sr: number, seconds: number, rand: Rand = Math.random): Float32Array {
  const fade = Math.floor(sr * 1);
  const n = Math.floor(sr * seconds) + fade;
  const out = new Float32Array(n);
  let t = 0.2;
  while (t < seconds + 0.5) {
    const at = Math.floor(t * sr);
    const L = Math.floor(0.03 * sr);
    const amp = 0.45 + rand() * 0.55;
    const pitch = 0.5 + rand() * 0.5;
    let lp = 0;
    for (let j = 0; j < L && at + j < n; j++) {
      const w = rand() * 2 - 1;
      lp += lpCoef(3500 * pitch + 800, sr) * (w - lp);
      out[at + j] += lp * Math.exp(-j / (0.005 * sr)) * amp;
      out[at + j] += Math.sin(TAU * 170 * pitch * (j / sr)) * Math.exp(-j / (0.012 * sr)) * amp * 0.5;
    }
    t += rand() < 0.1 ? 0.7 + rand() * 1.6 : 0.07 + rand() * 0.2;
  }
  return normalize(makeLoopable(out, fade), 0.7);
}

/** A waterfall: a broad, steady roar with a soft low thunder under it. */
export function renderWaterfall(sr: number, seconds: number, rand: Rand = Math.random): Float32Array {
  const fade = Math.floor(sr * 1.5);
  const n = Math.floor(sr * seconds) + fade;
  const swell = wander(n, sr, 0.4, rand);
  const out = new Float32Array(n);
  let lo = 0, mid = 0, hi = 0;
  for (let i = 0; i < n; i++) {
    const w = rand() * 2 - 1;
    lo += lpCoef(260, sr) * (w - lo);
    mid += lpCoef(1800, sr) * (w - mid);
    hi += lpCoef(7000, sr) * (w - hi);
    out[i] = (lo * 1.6 + (mid - lo) * 0.6 + (hi - mid) * 0.35) * (0.8 + 0.4 * swell[i]);
  }
  return normalize(makeLoopable(out, fade), 0.85);
}

/** Underwater calm: a muffled hum with the odd rising bubble. */
export function renderUnderwater(sr: number, seconds: number, rand: Rand = Math.random): Float32Array {
  const fade = Math.floor(sr * 1.5);
  const n = Math.floor(sr * seconds) + fade;
  const drift = wander(n, sr, 0.2, rand);
  const out = new Float32Array(n);
  let a = 0, b = 0;
  for (let i = 0; i < n; i++) {
    const w = rand() * 2 - 1;
    a += lpCoef(260 + 140 * drift[i], sr) * (w - a);
    b += lpCoef(260 + 140 * drift[i], sr) * (a - b);
    out[i] = b * 3.4;
  }
  for (let i = 0; i < n; ) {
    i += Math.floor((-Math.log(1 - rand()) / 0.9) * sr) + 1;
    if (i >= n) break;
    const f0 = 280 + rand() * 300;
    const L = Math.floor((0.05 + rand() * 0.07) * sr);
    const amp = 0.08 + rand() * 0.22;
    let phase = 0;
    for (let j = 0; j < L && i + j < n; j++) {
      const u = j / L;
      phase += (TAU * f0 * (1 + 1.6 * u)) / sr;
      out[i + j] += Math.sin(phase) * Math.sin(Math.PI * u) * amp;
    }
  }
  return normalize(makeLoopable(out, fade), 0.8);
}
