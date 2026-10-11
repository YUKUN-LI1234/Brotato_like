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
/** Wave that brings the mini-boss. */
export const BOSS_WAVE = 10;
/** Seconds into the boss wave before the boss lands. */
export const BOSS_DELAY = 3;

/** Difficulty curve: longer, denser waves as the run goes on. */
export function waveConfig(wave: number): WaveConfig {
  return {
    duration: Math.min(20 + (wave - 1) * 5, 60),
    spawnInterval: Math.max(0.35, 1.4 - wave * 0.08),
    groupSize: 1 + Math.floor(wave / 2),
  };
}

/**
 * Extra HP multiplier on top of each enemy's per-wave HP growth, so later
 * waves stay tough as the player's weapons scale up.
 */
export function enemyHpScale(wave: number): number {
  return 1 + 0.06 * (wave - 1);
}

/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  return (level + 3) ** 2;
}

/**
 * How strongly the shop leans toward cheap (negative) or expensive (positive)
 * goods after finishing `wave`. The first three shops strongly favor cheap
 * ones; later shops drift toward expensive ones.
 */
export function shopPriceBias(wave: number): number {
  if (wave <= 3) return -3;
  return Math.min(1.5, -2 + 0.35 * (wave - 4));
}

/**
 * Shop weight for a good of `price` among goods priced `min`..`max`:
 * exp(bias * n), where n is 0 for the cheapest and 1 for the priciest.
 */
export function shopPriceWeight(price: number, min: number, max: number, wave: number): number {
  const n = max > min ? (price - min) / (max - min) : 0;
  return Math.exp(shopPriceBias(wave) * n);
}

/** Shop prices inflate each wave. */
export function priceForWave(basePrice: number, wave: number): number {
  return Math.round(basePrice * (1 + 0.12 * (wave - 1)));
}

export function rerollCost(wave: number, rerolls: number): number {
  return Math.max(1, Math.floor(wave / 2)) + rerolls * 2;
}
