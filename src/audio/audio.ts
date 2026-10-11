import { Music, type MusicMode } from './music';
import { renderSfx, type SfxName } from './sfx';

const SETTINGS_KEY = 'brotato_like.audio';

/** Full-scale bus gains; the user's sliders scale these. */
const MUSIC_GAIN = 0.45;
const SFX_GAIN = 0.7;
const MASTER_GAIN = 0.8;

export type VolumeKind = 'music' | 'sfx';

export interface AudioSettings {
  music: number;
  sfx: number;
  muted: boolean;
}
const MAX_VOICES = 24;

/** Minimum seconds between two plays of the same sound, to avoid a wall of noise. */
const THROTTLE: Partial<Record<SfxName, number>> = {
  fire_smg: 0.05,
  fire_pistol: 0.03,
  fire_shotgun: 0.05,
  fire_rifle: 0.05,
  fire_rocket: 0.08,
  fire_gatling: 0.06,
  explosion: 0.06,
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
  private musicBus!: GainNode;
  private buffers!: Record<SfxName, AudioBuffer>;
  private music!: Music;
  private readonly lastPlayed = new Map<SfxName, number>();
  private voices = 0;
  private pendingMode: MusicMode = 'off';
  readonly settings: AudioSettings = readSettings();

  get muted(): boolean {
    return this.settings.muted;
  }

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
    this.master.gain.value = this.muted ? 0 : MASTER_GAIN;
    this.master.connect(comp);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = SFX_GAIN * this.settings.sfx;
    this.sfxBus.connect(this.master);

    const musicBus = ctx.createGain();
    musicBus.gain.value = MUSIC_GAIN * this.settings.music;
    musicBus.connect(this.master);
    this.musicBus = musicBus;

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

  /** `value` in 0..1. */
  setVolume(kind: VolumeKind, value: number): void {
    const v = Math.min(1, Math.max(0, value));
    this.settings[kind] = v;
    if (this.ctx) {
      const bus = kind === 'music' ? this.musicBus : this.sfxBus;
      bus.gain.setTargetAtTime((kind === 'music' ? MUSIC_GAIN : SFX_GAIN) * v, this.ctx.currentTime, 0.03);
    }
    this.save();
  }

  toggleMute(): boolean {
    this.settings.muted = !this.settings.muted;
    if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : MASTER_GAIN, this.ctx.currentTime, 0.05);
    this.save();
    return this.muted;
  }

  private save(): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      /* storage unavailable: settings just won't persist */
    }
  }
}

function readSettings(): AudioSettings {
  const defaults: AudioSettings = { music: 0.7, sfx: 0.8, muted: false };
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<AudioSettings>;
    return {
      music: typeof raw.music === 'number' ? raw.music : defaults.music,
      sfx: typeof raw.sfx === 'number' ? raw.sfx : defaults.sfx,
      muted: typeof raw.muted === 'boolean' ? raw.muted : defaults.muted,
    };
  } catch {
    return defaults;
  }
}
