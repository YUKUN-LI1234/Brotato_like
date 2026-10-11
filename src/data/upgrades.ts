import type { Rng } from '../core/rng';
import type { StatKey } from './stats';

/** Level-up rarity: 1 = white, 2 = blue, 3 = purple (colors from weapon TIERS). */
export type UpgradeRarity = 1 | 2 | 3;

/** Level-up choice template: one stat, with an amount per rarity. */
export interface UpgradeDef {
  stat: StatKey;
  /** Amount at white / blue / purple. */
  amounts: readonly [number, number, number];
}

/** A rolled level-up choice. */
export interface Upgrade {
  stat: StatKey;
  amount: number;
  rarity: UpgradeRarity;
}

export const UPGRADES: UpgradeDef[] = [
  { stat: 'maxHp', amounts: [3, 6, 9] },
  { stat: 'hpRegen', amounts: [2, 3, 5] },
  { stat: 'meleeDamage', amounts: [1, 2, 3] },
  { stat: 'rangedDamage', amounts: [1, 2, 3] },
  { stat: 'damage', amounts: [5, 8, 12] },
  { stat: 'attackSpeed', amounts: [5, 8, 12] },
  { stat: 'critChance', amounts: [3, 5, 8] },
  { stat: 'range', amounts: [20, 35, 55] },
  { stat: 'armor', amounts: [1, 2, 3] },
  { stat: 'dodge', amounts: [3, 5, 8] },
  { stat: 'speed', amounts: [3, 5, 8] },
  { stat: 'harvesting', amounts: [5, 8, 12] },
  { stat: 'luck', amounts: [5, 8, 12] },
  { stat: 'pickupRange', amounts: [20, 35, 50] },
  { stat: 'explosionSize', amounts: [8, 12, 18] },
  { stat: 'explosionDamage', amounts: [8, 12, 18] },
];

/**
 * Blue and purple get likelier as the run goes on; luck scales both.
 * At wave 1: ~14% blue, ~1% purple. From wave 20 on: 40% blue, 20% purple.
 */
export function rollRarity(roll: number, wave: number, luck: number): UpgradeRarity {
  const luckMult = Math.max(0, 1 + luck / 100);
  const p3 = Math.min(0.2, 0.01 * wave) * luckMult;
  const p2 = Math.min(0.4, 0.12 + 0.014 * wave) * luckMult;
  if (roll < p3) return 3;
  if (roll < p3 + p2) return 2;
  return 1;
}

/** `count` different stats, each with its own rarity roll. */
export function rollUpgrades(rng: Rng, wave: number, luck: number, count: number): Upgrade[] {
  return rng
    .shuffled(UPGRADES)
    .slice(0, count)
    .map((def) => {
      const rarity = rollRarity(rng.next(), wave, luck);
      return { stat: def.stat, amount: def.amounts[rarity - 1], rarity };
    });
}
