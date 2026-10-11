import type { EnemyDef } from '../data/enemies';
import type { Stats } from '../data/stats';
import type { WeaponDef } from '../data/weapons';

/**
 * Anything with a position and a collision circle.
 * `px/py` hold the position at the previous simulation step so the renderer
 * can interpolate between steps.
 */
export interface Body {
  x: number;
  y: number;
  px: number;
  py: number;
  r: number;
}

export interface WeaponSlot {
  def: WeaponDef;
  /** Quality 1..4 (white, blue, purple, red). */
  tier: number;
  cooldown: number;
  /** Current aim angle in radians. */
  angle: number;
  /** Offset from the player center. */
  ox: number;
  oy: number;
}

export interface Player extends Body {
  hp: number;
  stats: Stats;
  weapons: WeaponSlot[];
  items: string[];
  level: number;
  xp: number;
  /** Level-ups earned this wave, resolved at wave end. */
  pendingLevels: number;
  materials: number;
  iframes: number;
  regenTimer: number;
  facing: 1 | -1;
  moving: boolean;
}

export interface Enemy extends Body {
  def: EnemyDef;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  /** Knockback velocity, decays every step. */
  kbx: number;
  kby: number;
  flash: number;
  attackTimer: number;
  dead: boolean;
}

export interface Projectile extends Body {
  vx: number;
  vy: number;
  life: number;
  damage: number;
  pierce: number;
  knockback: number;
  crit: boolean;
  /** Fired by an enemy (hits the player) instead of by the player. */
  hostile: boolean;
  color: number;
  /** Explosion radius on impact (0 = plain bullet). */
  explosion: number;
  kind: 'bullet' | 'rocket';
  /** Enemies already hit, so a piercing shot never hits the same one twice. */
  hits: Enemy[];
}

export interface Pickup extends Body {
  value: number;
  magnet: boolean;
  speed: number;
}

/** Telegraphs where an enemy is about to appear. */
export interface SpawnMarker {
  x: number;
  y: number;
  t: number;
  def: EnemyDef;
}

export interface Explosion {
  x: number;
  y: number;
  radius: number;
  t: number;
  life: number;
}

/** A blast waiting to go off (aftershocks from "explode chance"). */
export interface PendingBlast {
  x: number;
  y: number;
  /** Base radius/damage, before explosion stats. */
  radius: number;
  damage: number;
  knockback: number;
  crit: boolean;
  delay: number;
}

export interface FloatText {
  x: number;
  y: number;
  text: string;
  color: number;
  t: number;
  scale: number;
}

/**
 * Things that happened during a simulation step. Systems push events; the
 * game drains them for audio (and later VFX) so systems stay side-effect free.
 */
export type GameEvent =
  | { type: 'fire'; weapon: string }
  | { type: 'enemyHit'; crit: boolean; killed: boolean }
  | { type: 'explosion' };
