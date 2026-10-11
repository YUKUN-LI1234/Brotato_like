import type { StatKey } from './stats';

/** Level-up choices: one stat bump each. */
export interface Upgrade {
  stat: StatKey;
  amount: number;
}

export const UPGRADES: Upgrade[] = [
  { stat: 'maxHp', amount: 3 },
  { stat: 'hpRegen', amount: 2 },
  { stat: 'damage', amount: 8 },
  { stat: 'attackSpeed', amount: 8 },
  { stat: 'critChance', amount: 5 },
  { stat: 'range', amount: 30 },
  { stat: 'armor', amount: 1 },
  { stat: 'dodge', amount: 4 },
  { stat: 'speed', amount: 5 },
  { stat: 'harvesting', amount: 6 },
  { stat: 'luck', amount: 8 },
  { stat: 'pickupRange', amount: 25 },
  { stat: 'explosionSize', amount: 12 },
];
