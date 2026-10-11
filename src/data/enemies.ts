export type Behavior = 'chase' | 'ranged' | 'boss';

export interface EnemyDef {
  id: string;
  hp: number;
  hpPerWave: number;
  speed: number;
  damage: number;
  damagePerWave: number;
  radius: number;
  color: number;
  behavior: Behavior;
  /** Materials dropped on death. */
  materials: number;
  /** First wave this enemy can spawn in. */
  firstWave: number;
  /** Relative spawn weight once unlocked. */
  weight: number;
}

export const ENEMIES: EnemyDef[] = [
  {
    id: 'blob',
    hp: 4,
    hpPerWave: 2.5,
    speed: 130,
    damage: 1,
    damagePerWave: 0.6,
    radius: 18,
    color: 0x8e6bbf,
    behavior: 'chase',
    materials: 1,
    firstWave: 1,
    weight: 10,
  },
  {
    id: 'runner',
    hp: 3,
    hpPerWave: 1.5,
    speed: 220,
    damage: 1,
    damagePerWave: 0.5,
    radius: 14,
    color: 0xd9734e,
    behavior: 'chase',
    materials: 1,
    firstWave: 3,
    weight: 4,
  },
  {
    id: 'brute',
    hp: 25,
    hpPerWave: 8,
    speed: 85,
    damage: 3,
    damagePerWave: 1,
    radius: 30,
    color: 0x5b7d4f,
    behavior: 'chase',
    materials: 3,
    firstWave: 4,
    weight: 2,
  },
  {
    id: 'spitter',
    hp: 8,
    hpPerWave: 3,
    speed: 110,
    damage: 2,
    damagePerWave: 0.6,
    radius: 20,
    color: 0x3f8fa8,
    behavior: 'ranged',
    materials: 2,
    firstWave: 5,
    weight: 2,
  },
];

/**
 * Mini-boss of wave BOSS_WAVE. Not in ENEMIES, so it never spawns randomly.
 * Alternates between a radial bullet burst and a telegraphed charge.
 */
export const BOSS: EnemyDef = {
  id: 'boss',
  hp: 1500,
  hpPerWave: 0,
  speed: 70,
  damage: 6,
  damagePerWave: 0,
  radius: 54,
  color: 0xb03a48,
  behavior: 'boss',
  materials: 40,
  firstWave: 99,
  weight: 0,
};
