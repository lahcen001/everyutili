import { fillNoise, type NoiseKind } from "@/lib/focus/noise";
import { makeLoopable, renderBirds, renderCafe, renderClock, renderCrickets, renderFire, renderHeartbeat, renderKeyboard, renderOcean, renderRain, renderStream, renderThunder, renderTrain, renderUnderwater, renderWaterfall, renderWind, type Rand } from "@/lib/focus/soundscapeRender";

export type SoundId =
  | "white" | "pink" | "brown"
  | "rain" | "thunder" | "ocean" | "wind" | "stream" | "waterfall" | "fire" | "birds" | "crickets" | "underwater"
  | "cafe" | "train" | "fan" | "clock" | "keyboard" | "heartbeat" | "drone"
  | "delta" | "theta" | "alpha" | "beta" | "gamma";

/** Beat frequency (Hz) of each binaural-beat sound. */
export const BEATS: Partial<Record<SoundId, number>> = { delta: 2, theta: 6, alpha: 10, beta: 18, gamma: 40 };

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
    case "thunder":
    case "birds":
    case "crickets":
    case "cafe":
    case "train":
    case "clock":
    case "heartbeat":
    case "keyboard":
    case "waterfall":
    case "underwater": {
      const spec = {
        thunder: [renderThunder, 40, 0.95],
        birds: [renderBirds, 24, 0.8],
        crickets: [renderCrickets, 10, 0.7],
        cafe: [renderCafe, 14, 0.9],
        train: [renderTrain, 12, 0.9],
        clock: [renderClock, 8, 0.8],
        heartbeat: [renderHeartbeat, 6, 0.9],
        keyboard: [renderKeyboard, 16, 0.8],
        waterfall: [renderWaterfall, 10, 0.85],
        underwater: [renderUnderwater, 14, 0.9],
      }[id] as [(sr: number, s: number, r: Rand) => Float32Array, number, number];
      const src = track(renderedSource(ctx, id, spec[0], spec[1]));
      const g = ctx.createGain();
      g.gain.value = spec[2];
      src.connect(g).connect(out);
      src.start();
      break;
    }
    case "drone": {
      // a warm singing-bowl style hum: a low note with slightly detuned overtones that slowly beat against each other
      [[136.1, 0.5], [136.1 * 1.004, 0.4], [272.2, 0.18], [408.3, 0.08], [68.05, 0.3]].forEach(([freq, amp]) => {
        const osc = track(ctx.createOscillator());
        osc.type = "sine";
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.value = amp * 0.35;
        osc.connect(g).connect(out);
        osc.start();
        const wobble = lfo(ctx, 0.05 + amp * 0.1, amp * 0.12, g.gain);
        stops.push(() => wobble.stop());
      });
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
    case "delta":
    case "theta":
    case "alpha":
    case "beta":
    case "gamma": {
      // binaural beat: slightly different tones in each ear (headphones needed). Left 200 Hz, right 200 Hz + beat.
      const beat = BEATS[id] ?? 10;
      [200, 200 + beat].forEach((freq, i) => {
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
