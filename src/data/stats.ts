/**
 * Player stats. Percentage stats are stored as percentage points
 * (damage: 10 means +10%), mirroring how the genre presents them.
 */
export interface Stats {
  maxHp: number;
  hpRegen: number;
  armor: number;
  dodge: number;
  speed: number;
  /** Flat damage added to melee weapons' base damage. */
  meleeDamage: number;
  /** Flat damage added to ranged (projectile and explosive) weapons' base damage. */
  rangedDamage: number;
  /** % multiplier on all weapon damage, applied after the flat bonuses. */
  damage: number;
  attackSpeed: number;
  critChance: number;
  range: number;
  harvesting: number;
  pickupRange: number;
  luck: number;
  /** Explosion radius, % */
  explosionSize: number;
  /** Explosion damage, % */
  explosionDamage: number;
}

export type StatKey = keyof Stats;

export const BASE_STATS: Readonly<Stats> = {
  maxHp: 15,
  hpRegen: 0,
  armor: 0,
  dodge: 0,
  speed: 0,
  meleeDamage: 0,
  rangedDamage: 0,
  damage: 0,
  attackSpeed: 0,
  critChance: 0,
  range: 0,
  harvesting: 0,
  pickupRange: 0,
  luck: 0,
  explosionSize: 0,
  explosionDamage: 0,
};

export const STAT_LABELS: Record<StatKey, string> = {
  maxHp: '最大生命',
  hpRegen: '生命再生',
  armor: '护甲',
  dodge: '闪避',
  speed: '移动速度',
  meleeDamage: '近战伤害',
  rangedDamage: '远程伤害',
  damage: '伤害',
  attackSpeed: '攻击速度',
  critChance: '暴击率',
  range: '射程',
  harvesting: '收获',
  pickupRange: '拾取范围',
  luck: '幸运',
  explosionSize: '爆炸范围',
  explosionDamage: '爆炸伤害',
};

const PERCENT_STATS = new Set<StatKey>([
  'dodge',
  'speed',
  'damage',
  'attackSpeed',
  'critChance',
  'pickupRange',
  'luck',
  'explosionSize',
  'explosionDamage',
]);

export const STAT_ORDER = Object.keys(STAT_LABELS) as StatKey[];

export const MAX_DODGE = 60;
export const BASE_MOVE_SPEED = 300;

export function formatStatValue(key: StatKey, value: number): string {
  return `${value}${PERCENT_STATS.has(key) ? '%' : ''}`;
}

export function formatStatMod(key: StatKey, value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${STAT_LABELS[key]} ${sign}${formatStatValue(key, value)}`;
}

/** Damage multiplier from armor: 15 armor halves incoming damage. */
export function armorMultiplier(armor: number): number {
  return armor >= 0 ? 15 / (15 + armor) : (15 - armor) / 15;
}

/** Seconds between 1-HP heals for a given regen stat. */
export function regenInterval(regen: number): number {
  return regen <= 0 ? Infinity : 5 / (1 + (regen - 1) / 2.25);
}

export function addStats(target: Stats, mods: Partial<Stats>): void {
  for (const key of STAT_ORDER) {
    const v = mods[key];
    if (v) target[key] += v;
  }
}
