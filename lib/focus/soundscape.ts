import { fillNoise, type NoiseKind } from "@/lib/focus/noise";

export type SoundId = "white" | "pink" | "brown" | "rain" | "ocean" | "wind" | "fan" | "alpha";

export interface Channel {
  /** Connect this to the master gain. */
  output: GainNode;
  stop: () => void;
}

function noiseSource(ctx: AudioContext, kind: NoiseKind): AudioBufferSourceNode {
  const seconds = 6;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  fillNoise(buffer.getChannelData(0), kind);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  return src;
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
      const hiss = track(noiseSource(ctx, "white"));
      const hp = filter(ctx, "highpass", 900);
      const lp = filter(ctx, "lowpass", 9000);
      const g = ctx.createGain();
      g.gain.value = 0.28;
      hiss.connect(hp).connect(lp).connect(g).connect(out);
      hiss.start();
      const rumble = track(noiseSource(ctx, "brown"));
      const rg = ctx.createGain();
      rg.gain.value = 0.35;
      rumble.connect(filter(ctx, "lowpass", 400)).connect(rg).connect(out);
      rumble.start();
      break;
    }
    case "ocean": {
      const src = track(noiseSource(ctx, "brown"));
      const g = ctx.createGain();
      g.gain.value = 0.55;
      src.connect(filter(ctx, "lowpass", 700)).connect(g).connect(out);
      src.start();
      stops.push(() => lfo(ctx, 0.11, 0.35, g.gain).stop());
      break;
    }
    case "wind": {
      const src = track(noiseSource(ctx, "pink"));
      const bp = filter(ctx, "bandpass", 500, 0.8);
      const g = ctx.createGain();
      g.gain.value = 0.9;
      src.connect(bp).connect(g).connect(out);
      src.start();
      const l = lfo(ctx, 0.07, 280, bp.frequency);
      stops.push(() => l.stop());
      break;
    }
    case "fan": {
      const src = track(noiseSource(ctx, "brown"));
      const g = ctx.createGain();
      g.gain.value = 0.9;
      src.connect(filter(ctx, "lowpass", 320)).connect(g).connect(out);
      src.start();
      const air = track(noiseSource(ctx, "white"));
      const ag = ctx.createGain();
      ag.gain.value = 0.04;
      air.connect(filter(ctx, "bandpass", 2200, 0.5)).connect(ag).connect(out);
      air.start();
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
