import { fillNoise, type NoiseKind } from "@/lib/focus/noise";
import { makeLoopable, renderFire, renderOcean, renderRain, renderStream, renderWind, type Rand } from "@/lib/focus/soundscapeRender";

export type SoundId = "white" | "pink" | "brown" | "rain" | "ocean" | "wind" | "stream" | "fire" | "fan" | "alpha";

export interface Channel {
  /** Connect this to the master gain. */
  output: GainNode;
  stop: () => void;
}

const bufferCache = new Map<string, AudioBuffer>();

/** A looping stereo source whose two ears are rendered independently, so it sounds wide and natural. */
function renderedSource(ctx: AudioContext, key: string, render: (sr: number, seconds: number, rand: Rand) => Float32Array, seconds: number): AudioBufferSourceNode {
  const cacheKey = `${key}:${ctx.sampleRate}`;
  let buffer = bufferCache.get(cacheKey);
  if (!buffer) {
    const left = render(ctx.sampleRate, seconds, Math.random);
    const right = render(ctx.sampleRate, seconds, Math.random);
    buffer = ctx.createBuffer(2, left.length, ctx.sampleRate);
    buffer.copyToChannel(left as Float32Array<ArrayBuffer>, 0);
    buffer.copyToChannel(right as Float32Array<ArrayBuffer>, 1);
    bufferCache.set(cacheKey, buffer);
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  return src;
}

function noiseSource(ctx: AudioContext, kind: NoiseKind): AudioBufferSourceNode {
  return renderedSource(
    ctx,
    kind,
    (sr, seconds) => {
      const fade = Math.floor(sr);
      const data = new Float32Array(Math.floor(sr * seconds) + fade);
      fillNoise(data, kind);
      return makeLoopable(data, fade);
    },
    8
  );
}

function filter(ctx: AudioContext, type: BiquadFilterType, frequency: number, q = 0.7): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = frequency;
  f.Q.value = q;
  return f;
}

/** A slow oscillator that wobbles a parameter (used for waves and wind gusts). */
function lfo(ctx: AudioContext, rate: number, depth: number, target: AudioParam): OscillatorNode {
  const osc = ctx.createOscillator();
  const amount = ctx.createGain();
  osc.frequency.value = rate;
  amount.gain.value = depth;
  osc.connect(amount).connect(target);
  osc.start();
  return osc;
}

/** Builds one looping sound. Everything is generated on the fly, so nothing is downloaded. */
export function createChannel(ctx: AudioContext, id: SoundId): Channel {
  const out = ctx.createGain();
  const stops: Array<() => void> = [];
  const track = <T extends AudioScheduledSourceNode>(n: T) => {
    stops.push(() => {
      try {
        n.stop();
      } catch {
        /* already stopped */
      }
    });
    return n;
  };

  switch (id) {
    case "white":
    case "pink":
    case "brown": {
      const src = track(noiseSource(ctx, id));
      const g = ctx.createGain();
      g.gain.value = id === "white" ? 0.35 : id === "pink" ? 0.9 : 0.8;
      src.connect(g).connect(out);
      src.start();
      break;
    }
    case "rain": {
      const src = track(renderedSource(ctx, "rain", renderRain, 14));
      const g = ctx.createGain();
      g.gain.value = 0.9;
      src.connect(g).connect(out);
      src.start();
      break;
    }
    case "ocean": {
      const src = track(renderedSource(ctx, "ocean", renderOcean, 30));
      const g = ctx.createGain();
      g.gain.value = 0.9;
      src.connect(g).connect(out);
      src.start();
      break;
    }
    case "wind": {
      const src = track(renderedSource(ctx, "wind", renderWind, 22));
      const g = ctx.createGain();
      g.gain.value = 0.95;
      src.connect(g).connect(out);
      src.start();
      break;
    }
    case "stream": {
      const src = track(renderedSource(ctx, "stream", renderStream, 12));
      const g = ctx.createGain();
      g.gain.value = 0.85;
      src.connect(g).connect(out);
      src.start();
      break;
    }
    case "fire": {
      const src = track(renderedSource(ctx, "fire", renderFire, 24));
      const g = ctx.createGain();
      g.gain.value = 0.95;
      src.connect(g).connect(out);
      src.start();
      break;
    }
    case "fan": {
      // soft airflow plus a faint motor hum with blade flutter
      const air = track(noiseSource(ctx, "brown"));
      const ag = ctx.createGain();
      ag.gain.value = 0.85;
      air.connect(filter(ctx, "lowpass", 380)).connect(ag).connect(out);
      air.start();
      const hiss = track(noiseSource(ctx, "white"));
      const hg = ctx.createGain();
      hg.gain.value = 0.05;
      hiss.connect(filter(ctx, "bandpass", 2400, 0.5)).connect(hg).connect(out);
      hiss.start();
      const hum = track(ctx.createOscillator());
      hum.type = "triangle";
      hum.frequency.value = 96;
      const mg = ctx.createGain();
      mg.gain.value = 0.035;
      hum.connect(mg).connect(out);
      hum.start();
      const flutter = lfo(ctx, 24, 0.012, mg.gain);
      stops.push(() => flutter.stop());
      break;
    }
    case "alpha": {
      // 10 Hz binaural beat (alpha waves): 200 Hz in the left ear, 210 Hz in the right. Best with headphones.
      [200, 210].forEach((freq, i) => {
        const osc = track(ctx.createOscillator());
        osc.frequency.value = freq;
        const pan = ctx.createStereoPanner();
        pan.pan.value = i === 0 ? -1 : 1;
        const g = ctx.createGain();
        g.gain.value = 0.25;
        osc.connect(g).connect(pan).connect(out);
        osc.start();
      });
      break;
    }
  }

  return {
    output: out,
    stop: () => stops.forEach((s) => s()),
  };
}
