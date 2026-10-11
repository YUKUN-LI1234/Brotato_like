/** Weapon definitions. Pure data: systems read these, nothing mutates them. */

/** Weapon class tags. Some stats only apply to weapons with a given tag. */
export type WeaponTag = 'projectile' | 'explosive' | 'melee';

export const TAG_LABELS: Record<WeaponTag, string> = {
  projectile: '投射物',
  explosive: '爆炸物',
  melee: '近战',
};

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
  /** Drawing style of the weapon sprite. */
  style: 'gun' | 'tube' | 'gatling' | 'club' | 'knife';
  /** Projectile look; melee weapons fire nothing. */
  projectile: 'bullet' | 'rocket' | 'none';
  /**
   * Melee only. `arc` is the hit cone in radians (wide = sweep, narrow =
   * thrust); `swing` is the attack animation length in seconds. For melee,
   * `range` is the reach from the weapon's grip.
   */
  melee?: { arc: number; swing: number };
  tags: readonly WeaponTag[];
  /** If set, the shot explodes on impact/at max range with this base radius. */
  explosionRadius?: number;
}

export const WEAPONS: Record<string, WeaponDef> = {
  club: {
    id: 'club',
    name: '木棒',
    price: 12,
    damage: 12,
    cooldown: 1.05,
    range: 160,
    projectileSpeed: 0,
    pierce: 0,
    knockback: 45,
    spread: 0,
    projectiles: 1,
    critMult: 1.5,
    color: 0x8a5a32,
    length: 36,
    style: 'club',
    projectile: 'none',
    tags: ['melee'],
    // Slow, wide sweep that hits everything in front
    melee: { arc: 2.2, swing: 0.34 },
  },
  knife: {
    id: 'knife',
    name: '短刀',
    price: 15,
    damage: 6,
    cooldown: 0.42,
    range: 120,
    projectileSpeed: 0,
    pierce: 0,
    knockback: 6,
    spread: 0,
    projectiles: 1,
    critMult: 2.5,
    color: 0xb8c0cc,
    length: 24,
    style: 'knife',
    projectile: 'none',
    tags: ['melee'],
    // Quick, narrow stab with a big crit multiplier
    melee: { arc: 0.7, swing: 0.16 },
  },
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
    tags: ['projectile'],
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
    tags: ['projectile'],
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
    tags: ['projectile'],
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
    tags: ['projectile'],
  },
  rocket: {
    id: 'rocket',
    name: '火箭筒',
    price: 40,
    // Damage is dealt by the explosion, to everything in the radius
    damage: 20,
    cooldown: 1.9,
    range: 480,
    projectileSpeed: 1000,
    pierce: 0,
    knockback: 30,
    spread: 0,
    projectiles: 1,
    critMult: 2,
    color: 0x5d7a3a,
    length: 38,
    style: 'tube',
    projectile: 'rocket',
    tags: ['explosive'],
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
    tags: ['projectile'],
  },
};

/**
 * Melee motion at attack progress k (0..1), shared by hit detection and
 * rendering so hits land exactly where the weapon is drawn. Angles are
 * relative to the locked aim.
 * - `aim`: where the weapon points now
 * - `from`..`to`: angular window that can be hit so far
 * - `extend`: 0 = at the grip, 1 = tip at full reach
 */
export function meleePose(def: WeaponDef, k: number): { aim: number; from: number; to: number; extend: number } {
  const arc = def.melee!.arc;
  if (arc <= 1) {
    // Thrust: straight out and back, the whole narrow cone is live
    return { aim: 0, from: -arc / 2, to: arc / 2, extend: Math.sin(Math.PI * Math.min(1, k)) };
  }
  // Sweep: shoot out, carve across the arc (eased), pull back at the end
  const t = Math.min(1, k / 0.75);
  const swept = -arc / 2 + arc * (1 - (1 - t) * (1 - t));
  const extend = k < 0.15 ? k / 0.15 : k > 0.85 ? Math.max(0, (1 - k) / 0.15) : 1;
  return { aim: swept, from: -arc / 2, to: swept, extend };
}

export function hasTag(def: WeaponDef, tag: WeaponTag): boolean {
  return def.tags.includes(tag);
}

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
    // Melee reach grows much less per tier than gun range
    range: def.range + (def.melee ? Math.round(t.range * 0.3) : t.range),
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
