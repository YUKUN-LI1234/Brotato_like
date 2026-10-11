import { Music, type MusicMode } from './music';
import { renderSfx, type SfxName } from './sfx';

const MUTE_KEY = 'brotato_like.muted';
const MAX_VOICES = 24;

/** Minimum seconds between two plays of the same sound, to avoid a wall of noise. */
const THROTTLE: Partial<Record<SfxName, number>> = {
  fire_smg: 0.05,
  fire_pistol: 0.03,
  fire_shotgun: 0.05,
  fire_rifle: 0.05,
  hit: 0.035,
  hit_crit: 0.05,
  kill: 0.04,
};

/**
 * Owns the AudioContext. Browsers only allow audio after a user gesture,
 * so nothing is created until `unlock()` is called from a click/keypress.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private buffers!: Record<SfxName, AudioBuffer>;
  private music!: Music;
  private readonly lastPlayed = new Map<SfxName, number>();
  private voices = 0;
  private pendingMode: MusicMode = 'off';
  muted = readMuted();

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;

    // master → compressor keeps stacked shots from clipping
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    comp.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(comp);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.7;
    this.sfxBus.connect(this.master);

    const musicBus = ctx.createGain();
    musicBus.gain.value = 0.45;
    musicBus.connect(this.master);

    this.buffers = renderSfx(ctx);
    this.music = new Music(ctx, musicBus);
    this.music.setMode(this.pendingMode);
  }

  play(name: SfxName, volume = 1): void {
    const ctx = this.ctx;
    if (!ctx || this.muted || this.voices >= MAX_VOICES) return;
    const now = ctx.currentTime;
    const gap = THROTTLE[name] ?? 0;
    if (now - (this.lastPlayed.get(name) ?? -1) < gap) return;
    this.lastPlayed.set(name, now);

    const src = ctx.createBufferSource();
    src.buffer = this.buffers[name];
    // Small random pitch shift so repeats don't sound robotic
    src.playbackRate.value = 0.92 + Math.random() * 0.16;
    const g = ctx.createGain();
    g.gain.value = volume;
    src.connect(g).connect(this.sfxBus);
    this.voices++;
    src.onended = () => {
      this.voices--;
      g.disconnect();
    };
    src.start(now);
  }

  setMusic(mode: MusicMode): void {
    this.pendingMode = mode;
    this.music?.setMode(mode);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      /* storage unavailable: mute just won't persist */
    }
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.05);
    return this.muted;
  }
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}
