import { Pool } from '../core/pool';
import { Rng } from '../core/rng';
import { SpatialHash } from '../core/spatialHash';
import { BASE_STATS } from '../data/stats';
import { STARTING_WEAPON, type WeaponDef } from '../data/weapons';
import type { Enemy, FloatText, Pickup, Player, Projectile, SpawnMarker, WeaponSlot } from './types';

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

export function addWeapon(player: Player, def: WeaponDef): void {
  const slot: WeaponSlot = { def, cooldown: 0, angle: 0, ox: 0, oy: 0 };
  player.weapons.push(slot);
  layoutWeapons(player);
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
