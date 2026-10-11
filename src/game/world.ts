import { Pool } from '../core/pool';
import { Rng } from '../core/rng';
import { SpatialHash } from '../core/spatialHash';
import { BASE_STATS } from '../data/stats';
import { MAX_TIER, MAX_WEAPONS, MERGE_COUNT, STARTING_WEAPON, type WeaponDef } from '../data/weapons';
import type { Enemy, FloatText, GameEvent, Pickup, Player, Projectile, SpawnMarker, WeaponSlot } from './types';

export const ARENA_W = 1800;
export const ARENA_H = 1400;

/**
 * All simulation state for one run. Systems are plain functions that read
 * and mutate a World; nothing in here knows about rendering or the DOM.
 */
export class World {
  readonly rng: Rng;
  readonly player: Player;

  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  pickups: Pickup[] = [];
  markers: SpawnMarker[] = [];
  texts: FloatText[] = [];
  /** Drained by Game after every step. */
  events: GameEvent[] = [];

  readonly enemyHash = new SpatialHash<Enemy>(64);
  readonly enemyPool = new Pool<Enemy>(createEnemy);
  readonly projectilePool = new Pool<Projectile>(createProjectile);
  readonly pickupPool = new Pool<Pickup>(createPickup);

  wave = 1;
  waveTime = 0;
  waveDuration = 20;
  spawnTimer = 0;
  time = 0;
  kills = 0;
  playerDead = false;
  /** Debug: player takes no damage. */
  god = false;

  constructor(readonly seed: number) {
    this.rng = new Rng(seed);
    this.player = createPlayer();
  }

  /** Copy current positions to px/py before a step, for render interpolation. */
  snapshot(): void {
    const snap = (b: { x: number; y: number; px: number; py: number }) => {
      b.px = b.x;
      b.py = b.y;
    };
    snap(this.player);
    this.enemies.forEach(snap);
    this.projectiles.forEach(snap);
    this.pickups.forEach(snap);
  }

  rebuildEnemyHash(): void {
    this.enemyHash.clear();
    for (const e of this.enemies) if (!e.dead) this.enemyHash.insert(e);
  }
}

export function createPlayer(): Player {
  const player: Player = {
    x: ARENA_W / 2,
    y: ARENA_H / 2,
    px: ARENA_W / 2,
    py: ARENA_H / 2,
    r: 20,
    hp: BASE_STATS.maxHp,
    stats: { ...BASE_STATS },
    weapons: [],
    items: [],
    level: 0,
    xp: 0,
    pendingLevels: 0,
    materials: 0,
    iframes: 0,
    regenTimer: 0,
    facing: 1,
    moving: false,
  };
  addWeapon(player, STARTING_WEAPON);
  return player;
}

export interface MergeResult {
  def: WeaponDef;
  /** Tier of the newly created weapon. */
  tier: number;
}

/** Add a weapon, then merge any trio of same kind + tier (chains allowed). */
export function addWeapon(player: Player, def: WeaponDef, tier = 1): MergeResult[] {
  player.weapons.push(makeSlot(def, tier));
  const merges = mergeWeapons(player);
  layoutWeapons(player);
  return merges;
}

export function mergeWeapons(player: Player): MergeResult[] {
  const results: MergeResult[] = [];
  for (;;) {
    const group = findMergeGroup(player.weapons);
    if (!group) return results;
    const { def, tier } = group[0];
    const used = new Set(group);
    // The new weapon takes the place of the first merged one
    const at = player.weapons.indexOf(group[0]);
    player.weapons = player.weapons.filter((s) => !used.has(s));
    player.weapons.splice(Math.min(at, player.weapons.length), 0, makeSlot(def, tier + 1));
    results.push({ def, tier: tier + 1 });
  }
}

function findMergeGroup(slots: readonly WeaponSlot[]): WeaponSlot[] | null {
  for (const slot of slots) {
    if (slot.tier >= MAX_TIER) continue;
    const same = slots.filter((s) => s.def.id === slot.def.id && s.tier === slot.tier);
    if (same.length >= MERGE_COUNT) return same.slice(0, MERGE_COUNT);
  }
  return null;
}

/** A weapon fits if there is a free slot, or if it would complete a merge. */
export function canAcquire(player: Player, def: WeaponDef, tier: number): boolean {
  if (player.weapons.length < MAX_WEAPONS) return true;
  if (tier >= MAX_TIER) return false;
  const same = player.weapons.filter((s) => s.def.id === def.id && s.tier === tier).length;
  return same >= MERGE_COUNT - 1;
}

/** Remove the weapon at `index` (recycling). */
export function removeWeapon(player: Player, index: number): WeaponSlot | null {
  const [slot] = player.weapons.splice(index, 1);
  layoutWeapons(player);
  return slot ?? null;
}

/** How many more copies of this weapon/tier would trigger a merge (0 = not close). */
export function mergeProgress(player: Player, def: WeaponDef, tier: number): number {
  if (tier >= MAX_TIER) return 0;
  return player.weapons.filter((s) => s.def.id === def.id && s.tier === tier).length;
}

function makeSlot(def: WeaponDef, tier: number): WeaponSlot {
  return { def, tier, cooldown: 0, angle: 0, ox: 0, oy: 0 };
}

/** Spread weapons evenly on a ring around the player. */
export function layoutWeapons(player: Player): void {
  const n = player.weapons.length;
  const ring = n === 1 ? 26 : 34;
  player.weapons.forEach((slot, i) => {
    const a = n === 1 ? 0 : (i / n) * Math.PI * 2 - Math.PI / 2;
    slot.ox = Math.cos(a) * ring;
    slot.oy = Math.sin(a) * ring + 6;
  });
}

export function maxHpOf(player: Player): number {
  return Math.max(1, player.stats.maxHp);
}

function createEnemy(): Enemy {
  return {
    x: 0, y: 0, px: 0, py: 0, r: 0,
    def: undefined as unknown as Enemy['def'],
    hp: 0, maxHp: 0, speed: 0, damage: 0,
    kbx: 0, kby: 0, flash: 0, attackTimer: 0, dead: false,
  };
}

function createProjectile(): Projectile {
  return {
    x: 0, y: 0, px: 0, py: 0, r: 0,
    vx: 0, vy: 0, life: 0, damage: 0, pierce: 0, knockback: 0,
    crit: false, hostile: false, color: 0xffffff, hits: [],
  };
}

function createPickup(): Pickup {
  return { x: 0, y: 0, px: 0, py: 0, r: 8, value: 1, magnet: false, speed: 0 };
}
