/**
 * Procedural background music: a small step sequencer driven by the Web
 * Audio clock. A timer wakes up every 25 ms and schedules notes slightly
 * ahead of time ("lookahead scheduling"), so timing stays sample-accurate
 * even when the main thread is busy.
 */
export type MusicMode = 'off' | 'calm' | 'wave';

const BPM = 126;
const STEP = 60 / BPM / 4; // 16th note
const LOOKAHEAD = 0.12;
const TICK_MS = 25;

// A-minor progression, one bar each: Am – F – C – G (MIDI root notes)
const ROOTS = [45, 41, 48, 43];
const CHORDS = [
  [57, 60, 64],
  [53, 57, 60],
  [55, 60, 64],
  [55, 59, 62],
];
// Bass rhythm over 16 steps: semitone offset from root, null = rest
const BASS = [0, null, 0, 12, null, 0, null, 7, 0, null, 0, 12, null, 7, 10, null];
// Arpeggio: index into the current chord (+3 = up an octave)
const ARP = [0, 1, 2, 3, 2, 1, 0, 1, 0, 2, 1, 3, 4, 3, 2, 1];

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class Music {
  private mode: MusicMode = 'off';
  private step = 0;
  private nextTime = 0;
  private timer = 0;
  private readonly bus: GainNode;
  private readonly filter: BiquadFilterNode;
  private readonly noise: AudioBuffer;

  constructor(
    private readonly ctx: AudioContext,
    output: AudioNode,
  ) {
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 900;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    this.bus.connect(this.filter).connect(output);

    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  setMode(mode: MusicMode): void {
    if (mode === this.mode) return;
    const now = this.ctx.currentTime;
    const wasOff = this.mode === 'off';
    this.mode = mode;

    // Calm mode (menus, shop) is the same loop, quieter and muffled
    const level = mode === 'wave' ? 1 : mode === 'calm' ? 0.55 : 0;
    const cutoff = mode === 'wave' ? 12000 : 900;
    this.bus.gain.setTargetAtTime(level, now, mode === 'off' ? 0.15 : 0.4);
    this.filter.frequency.setTargetAtTime(cutoff, now, 0.3);

    if (wasOff && mode !== 'off') {
      this.step = 0;
      this.nextTime = now + 0.05;
      clearInterval(this.timer);
      this.timer = window.setInterval(() => this.schedule(), TICK_MS);
    } else if (mode === 'off') {
      // Let the fade-out finish before stopping the scheduler
      window.setTimeout(() => {
        if (this.mode === 'off') clearInterval(this.timer);
      }, 800);
    }
  }

  private schedule(): void {
    while (this.nextTime < this.ctx.currentTime + LOOKAHEAD) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += STEP;
      this.step = (this.step + 1) % (16 * ROOTS.length);
    }
  }

  private playStep(step: number, t: number): void {
    const bar = Math.floor(step / 16);
    const s = step % 16;
    const root = ROOTS[bar];
    const chord = CHORDS[bar];
    const full = this.mode === 'wave';

    const b = BASS[s];
    if (b !== null) this.bass(midiHz(root + b), t);
    if (s % 4 === 0) this.kick(t, full ? 0.9 : 0.5);
    if (full && (s === 4 || s === 12)) this.snare(t);
    if (s % 4 === 2) this.hat(t, full ? 0.18 : 0.08);
    if (full && s % 2 === 1) this.hat(t, 0.06);

    if (s % 2 === 0) {
      const idx = ARP[s];
      const note = chord[idx % 3] + 12 * Math.floor(idx / 3) + 12;
      this.lead(midiHz(note), t, full ? 0.07 : 0.05);
    }
    // Sustained pad at the start of every bar
    if (s === 0) for (const n of chord) this.pad(midiHz(n), t, STEP * 16);
  }

  private env(t: number, peak: number, attack: number, decay: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(this.bus);
    return g;
  }

  private tone(type: OscillatorType, freq: number, t: number, dur: number, dest: AudioNode): OscillatorNode {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  private bass(freq: number, t: number): void {
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1400, t);
    f.frequency.exponentialRampToValueAtTime(250, t + 0.15);
    f.connect(this.env(t, 0.22, 0.005, 0.2));
    this.tone('sawtooth', freq, t, 0.22, f);
  }

  private kick(t: number, vol: number): void {
    const o = this.tone('sine', 150, t, 0.3, this.env(t, vol * 0.8, 0.002, 0.28));
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  }

  private snare(t: number): void {
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    f.connect(this.env(t, 0.35, 0.002, 0.15));
    this.noiseHit(t, 0.2, f);
  }

  private hat(t: number, vol: number): void {
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    f.connect(this.env(t, vol, 0.001, 0.05));
    this.noiseHit(t, 0.08, f);
  }

  private noiseHit(t: number, dur: number, dest: AudioNode): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.connect(dest);
    // Random offset so consecutive hits don't sound identical
    src.start(t, Math.random() * 0.8, dur);
  }

  private lead(freq: number, t: number, vol: number): void {
    this.tone('square', freq, t, 0.14, this.env(t, vol, 0.005, 0.13));
  }

  private pad(freq: number, t: number, dur: number): void {
    const g = this.env(t, 0.035, 0.4, dur);
    this.tone('triangle', freq, t, dur, g);
    this.tone('triangle', freq * 1.005, t, dur, g); // slight detune for width
  }
}
