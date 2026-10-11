export interface WaveConfig {
  /** Seconds the wave lasts. */
  duration: number;
  /** Seconds between spawn groups. */
  spawnInterval: number;
  /** Enemies per spawn group. */
  groupSize: number;
}

export const MAX_WAVE = 20;
export const MAX_ENEMIES = 300;

/** Difficulty curve: longer, denser waves as the run goes on. */
export function waveConfig(wave: number): WaveConfig {
  return {
    duration: Math.min(20 + (wave - 1) * 5, 60),
    spawnInterval: Math.max(0.35, 1.4 - wave * 0.08),
    groupSize: 1 + Math.floor(wave / 2),
  };
}

/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  return (level + 3) ** 2;
}

/** Shop prices inflate each wave. */
export function priceForWave(basePrice: number, wave: number): number {
  return Math.round(basePrice * (1 + 0.12 * (wave - 1)));
}

export function rerollCost(wave: number, rerolls: number): number {
  return Math.max(1, Math.floor(wave / 2)) + rerolls * 2;
}
