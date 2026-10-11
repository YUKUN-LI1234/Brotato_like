/**
 * Procedural sound effects. Each sound is a small function of time that is
 * rendered once into an AudioBuffer at startup; playback is then just a
 * cheap buffer source, which matters when an SMG fires 6 times a second.
 */
export type SfxName =
  | 'fire_pistol'
  | 'fire_smg'
  | 'fire_shotgun'
  | 'fire_rifle'
  | 'fire_rocket'
  | 'fire_gatling'
  | 'explosion'
  | 'swing'
  | 'thud'
  | 'hit'
  | 'hit_crit'
  | 'kill';

type Voice = (t: number, s: SynthState) => number;

interface SynthState {
  noise: () => number;
  /** Running phase per oscillator id, so pitch sweeps stay click-free. */
  phase: Float64Array;
  lp: Float64Array;
  dt: number;
}

const TAU = Math.PI * 2;

/** Exponential pitch sweep from `a` to `b` Hz over `dur` seconds. */
const sweep = (t: number, a: number, b: number, dur: number) => a * Math.pow(b / a, Math.min(t / dur, 1));

function osc(s: SynthState, id: number, freq: number): number {
  s.phase[id] = (s.phase[id] + freq * s.dt) % 1;
  return s.phase[id];
}

const sine = (s: SynthState, id: number, f: number) => Math.sin(osc(s, id, f) * TAU);
const square = (s: SynthState, id: number, f: number) => (osc(s, id, f) < 0.5 ? 1 : -1);

/** One-pole low-pass; `k` near 0 = darker, near 1 = brighter. */
function lowpass(s: SynthState, id: number, x: number, k: number): number {
  s.lp[id] += (x - s.lp[id]) * k;
  return s.lp[id];
}

const RECIPES: Record<SfxName, { dur: number; gain: number; voice: Voice }> = {
  // Snappy "pew": falling square plus a click of noise
  fire_pistol: {
    dur: 0.14,
    gain: 0.55,
    voice: (t, s) =>
      square(s, 0, sweep(t, 950, 180, 0.12)) * Math.exp(-t * 28) * 0.45 +
      s.noise() * Math.exp(-t * 90) * 0.5,
  },
  // Short, light rattle so rapid fire doesn't fatigue the ear
  fire_smg: {
    dur: 0.07,
    gain: 0.35,
    voice: (t, s) =>
      (s.noise() - lowpass(s, 0, s.noise(), 0.3)) * Math.exp(-t * 70) * 0.8 +
      sine(s, 0, sweep(t, 1500, 500, 0.06)) * Math.exp(-t * 60) * 0.3,
  },
  // Wide boom: dark noise burst plus a low thump
  fire_shotgun: {
    dur: 0.35,
    gain: 0.7,
    voice: (t, s) =>
      lowpass(s, 0, s.noise(), 0.18) * Math.exp(-t * 11) * 1.6 +
      sine(s, 0, sweep(t, 140, 45, 0.2)) * Math.exp(-t * 16) * 0.7,
  },
  // Sharp crack with a rolling tail
  fire_rifle: {
    dur: 0.45,
    gain: 0.6,
    voice: (t, s) =>
      s.noise() * Math.exp(-t * 85) * 0.9 +
      sine(s, 0, sweep(t, 320, 55, 0.25)) * Math.exp(-t * 9) * 0.6 +
      lowpass(s, 0, s.noise(), 0.08) * Math.exp(-t * 7) * 0.9,
  },
  // Rocket launch: rising airy whoosh over a soft pop
  fire_rocket: {
    dur: 0.4,
    gain: 0.55,
    voice: (t, s) => {
      const n = s.noise();
      const k = 0.05 + Math.min(t / 0.35, 1) * 0.35; // filter opens = rising pitch
      const air = lowpass(s, 0, n, k) - lowpass(s, 1, n, 0.03);
      return air * Math.sin(Math.min(t / 0.4, 1) * Math.PI) * 1.8 + sine(s, 0, sweep(t, 180, 90, 0.1)) * Math.exp(-t * 30) * 0.5;
    },
  },
  // Gatling: very short, low, dry tick so 12 shots/s stay readable
  fire_gatling: {
    dur: 0.05,
    gain: 0.32,
    voice: (t, s) =>
      lowpass(s, 0, s.noise(), 0.35) * Math.exp(-t * 90) * 1.4 + square(s, 0, sweep(t, 420, 200, 0.04)) * Math.exp(-t * 80) * 0.25,
  },
  // Explosion: deep thump, crackle, long rumbling tail
  explosion: {
    dur: 0.9,
    gain: 0.85,
    voice: (t, s) => {
      const n = s.noise();
      return (
        sine(s, 0, sweep(t, 110, 32, 0.35)) * Math.exp(-t * 7) * 1.1 +
        lowpass(s, 0, n, 0.12) * Math.exp(-t * 4.5) * 1.6 +
        n * Math.exp(-t * 35) * 0.5
      );
    },
  },
  // Melee whoosh: high-passed noise that swells and fades
  swing: {
    dur: 0.2,
    gain: 0.5,
    voice: (t, s) => {
      const n = s.noise();
      return (n - lowpass(s, 0, n, 0.12)) * Math.sin(Math.PI * Math.min(t / 0.18, 1)) * 0.8;
    },
  },
  // Punching-bag thud: dull low body, muffled cloth slap, no ring
  thud: {
    dur: 0.24,
    gain: 0.9,
    voice: (t, s) => {
      const n = s.noise();
      return (
        sine(s, 0, sweep(t, 150, 55, 0.1)) * Math.exp(-t * 20) * 1.1 +
        lowpass(s, 0, n, 0.06) * Math.exp(-t * 22) * 2.2 +
        lowpass(s, 1, n, 0.35) * Math.exp(-t * 90) * 0.35
      );
    },
  },
  // Fleshy "thwack": band-limited noise and a dropping blip
  hit: {
    dur: 0.1,
    gain: 0.45,
    voice: (t, s) => {
      const n = s.noise();
      const band = lowpass(s, 0, n, 0.45) - lowpass(s, 1, n, 0.06);
      return band * Math.exp(-t * 45) * 1.6 + sine(s, 0, sweep(t, 280, 110, 0.08)) * Math.exp(-t * 38) * 0.6;
    },
  },
  // Crit: the hit plus a bright metallic ping
  hit_crit: {
    dur: 0.22,
    gain: 0.5,
    voice: (t, s) => {
      const n = s.noise();
      const band = lowpass(s, 0, n, 0.5) - lowpass(s, 1, n, 0.08);
      return (
        band * Math.exp(-t * 40) * 1.4 +
        sine(s, 0, sweep(t, 340, 140, 0.08)) * Math.exp(-t * 35) * 0.5 +
        (sine(s, 1, 1760) + sine(s, 2, 2637) * 0.5) * Math.exp(-t * 18) * 0.25
      );
    },
  },
  // Squishy pop when an enemy dies
  kill: {
    dur: 0.2,
    gain: 0.5,
    voice: (t, s) =>
      sine(s, 0, sweep(t, 520, 70, 0.16) * (1 + 0.15 * Math.sin(t * 180))) * Math.exp(-t * 18) * 0.8 +
      lowpass(s, 0, s.noise(), 0.25) * Math.exp(-t * 40) * 0.8,
  },
};

export function renderSfx(ctx: BaseAudioContext): Record<SfxName, AudioBuffer> {
  const out = {} as Record<SfxName, AudioBuffer>;
  const rate = ctx.sampleRate;
  // Deterministic noise so every page load sounds the same
  let seed = 1234567;
  const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x3fffffff) - 1;

  for (const name of Object.keys(RECIPES) as SfxName[]) {
    const { dur, gain, voice } = RECIPES[name];
    const len = Math.ceil(dur * rate);
    const buf = ctx.createBuffer(1, len, rate);
    const data = buf.getChannelData(0);
    const state: SynthState = { noise, phase: new Float64Array(4), lp: new Float64Array(4), dt: 1 / rate };
    for (let i = 0; i < len; i++) {
      const t = i / rate;
      // Short fade-in/out avoids clicks at the buffer edges
      const edge = Math.min(1, i / 64, (len - i) / 256);
      data[i] = Math.tanh(voice(t, state) * gain * 1.5) * edge;
    }
    out[name] = buf;
  }
  return out;
}
