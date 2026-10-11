/** Weapon definitions. Pure data: systems read these, nothing mutates them. */
export interface WeaponDef {
  id: string;
  name: string;
  price: number;
  damage: number;
  /** Seconds between shots before attack-speed modifiers. */
  cooldown: number;
  range: number;
  projectileSpeed: number;
  /** Extra enemies a projectile passes through; each pierce halves damage. */
  pierce: number;
  knockback: number;
  /** Total spread angle in radians. */
  spread: number;
  projectiles: number;
  critMult: number;
  color: number;
  length: number;
  /** Drawing style of the gun sprite. */
  style: 'gun' | 'tube' | 'gatling';
  /** Projectile look. */
  projectile: 'bullet' | 'rocket';
  /** If set, the shot explodes on impact/at max range with this base radius. */
  explosionRadius?: number;
}

export const WEAPONS: Record<string, WeaponDef> = {
  pistol: {
    id: 'pistol',
    name: '豌豆枪',
    price: 15,
    damage: 12,
    cooldown: 1.1,
    range: 420,
    projectileSpeed: 950,
    pierce: 1,
    knockback: 18,
    spread: 0,
    projectiles: 1,
    critMult: 2,
    color: 0x9aa4b1,
    length: 22,
    style: 'gun',
    projectile: 'bullet',
  },
  smg: {
    id: 'smg',
    name: '冲锋枪',
    price: 25,
    damage: 4,
    cooldown: 0.18,
    range: 360,
    projectileSpeed: 1050,
    pierce: 0,
    knockback: 4,
    spread: 0.2,
    projectiles: 1,
    critMult: 1.5,
    color: 0x6f8f6a,
    length: 26,
    style: 'gun',
    projectile: 'bullet',
  },
  shotgun: {
    id: 'shotgun',
    name: '霰弹枪',
    price: 30,
    damage: 5,
    cooldown: 1.3,
    range: 300,
    projectileSpeed: 850,
    pierce: 1,
    knockback: 30,
    spread: 0.55,
    projectiles: 5,
    critMult: 2,
    color: 0x8b5a3c,
    length: 28,
    style: 'gun',
    projectile: 'bullet',
  },
  rifle: {
    id: 'rifle',
    name: '狙击枪',
    price: 35,
    damage: 30,
    cooldown: 1.6,
    range: 650,
    projectileSpeed: 1500,
    pierce: 3,
    knockback: 25,
    spread: 0,
    projectiles: 1,
    critMult: 3,
    color: 0x4a5a7a,
    length: 34,
    style: 'gun',
    projectile: 'bullet',
  },
  rocket: {
    id: 'rocket',
    name: '火箭筒',
    price: 40,
    // Damage is dealt by the explosion, to everything in the radius
    damage: 20,
    cooldown: 1.9,
    range: 480,
    projectileSpeed: 620,
    pierce: 0,
    knockback: 30,
    spread: 0,
    projectiles: 1,
    critMult: 2,
    color: 0x5d7a3a,
    length: 38,
    style: 'tube',
    projectile: 'rocket',
    explosionRadius: 90,
  },
  gatling: {
    id: 'gatling',
    name: '加特林',
    price: 45,
    damage: 3,
    cooldown: 0.08,
    range: 380,
    projectileSpeed: 1150,
    pierce: 0,
    knockback: 3,
    spread: 0.16,
    projectiles: 1,
    critMult: 1.5,
    color: 0x7a7f88,
    length: 34,
    style: 'gatling',
    projectile: 'bullet',
  },
};

export const STARTING_WEAPON = WEAPONS.pistol;
export const MAX_WEAPONS = 6;

/**
 * Weapon tiers (quality). Three weapons of the same kind and tier merge into
 * one of the next tier. Each tier scales the base stats in steps.
 */
export interface TierDef {
  name: string;
  color: number;
  damage: number;
  cooldown: number;
  range: number;
  knockback: number;
  critBonus: number;
  price: number;
}

export const TIERS: readonly TierDef[] = [
  { name: '普通', color: 0xe8e8e8, damage: 1, cooldown: 1, range: 0, knockback: 1, critBonus: 0, price: 1 },
  { name: '稀有', color: 0x4aa3ff, damage: 1.8, cooldown: 0.9, range: 25, knockback: 1.2, critBonus: 3, price: 2.2 },
  { name: '史诗', color: 0xb26bff, damage: 3, cooldown: 0.8, range: 50, knockback: 1.4, critBonus: 6, price: 4.5 },
  { name: '传说', color: 0xff4d4d, damage: 5, cooldown: 0.7, range: 100, knockback: 1.6, critBonus: 10, price: 9 },
];

export const MAX_TIER = TIERS.length;
export const MERGE_COUNT = 3;

export function tierOf(tier: number): TierDef {
  return TIERS[Math.min(Math.max(tier, 1), MAX_TIER) - 1];
}

/** Final stats of a weapon at a given tier, before player stat modifiers. */
export interface WeaponStats {
  damage: number;
  cooldown: number;
  range: number;
  knockback: number;
  critBonus: number;
}

export function weaponStats(def: WeaponDef, tier: number): WeaponStats {
  const t = tierOf(tier);
  return {
    damage: Math.round(def.damage * t.damage),
    cooldown: Math.round(def.cooldown * t.cooldown * 100) / 100,
    range: def.range + t.range,
    knockback: def.knockback * t.knockback,
    critBonus: t.critBonus,
  };
}

/** Higher tiers start appearing in the shop as the run goes on. */
export function rollShopTier(roll: number, wave: number): number {
  const p4 = wave >= 10 ? Math.min(0.06, (wave - 9) * 0.01) : 0;
  const p3 = wave >= 6 ? Math.min(0.15, (wave - 5) * 0.025) : 0;
  const p2 = wave >= 3 ? Math.min(0.3, (wave - 2) * 0.04) : 0;
  if (roll < p4) return 4;
  if (roll < p4 + p3) return 3;
  if (roll < p4 + p3 + p2) return 2;
  return 1;
}
