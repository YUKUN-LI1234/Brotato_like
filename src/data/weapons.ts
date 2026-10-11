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
}

export const WEAPONS: Record<string, WeaponDef> = {
  pistol: {
    id: 'pistol',
    name: 'Pea Shooter',
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
  },
  smg: {
    id: 'smg',
    name: 'Rattler',
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
  },
  shotgun: {
    id: 'shotgun',
    name: 'Scattergun',
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
  },
  rifle: {
    id: 'rifle',
    name: 'Longshot',
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
  },
};

export const STARTING_WEAPON = WEAPONS.pistol;
export const MAX_WEAPONS = 6;
