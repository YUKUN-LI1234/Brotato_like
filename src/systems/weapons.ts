import type { Stats } from '../data/stats';
import type { Enemy, WeaponSlot } from '../game/types';
import { meleePose, tierOf, weaponStats, type WeaponDef } from '../data/weapons';
import type { World } from '../game/world';
import { damageEnemy } from './combat';

export interface ShotSpec {
  x: number;
  y: number;
  angle: number;
  speed: number;
  life: number;
  damage: number;
  pierce: number;
  knockback: number;
  crit: boolean;
  hostile: boolean;
  color: number;
  r: number;
  explosion?: number;
  kind?: 'bullet' | 'rocket';
}

const meleeTargets: Enemy[] = [];

/**
 * Damage before crits: the flat melee/ranged bonus is added to the weapon's
 * base damage, then the % damage stat multiplies the sum.
 */
export function weaponDamage(def: WeaponDef, tierDamage: number, s: Stats): number {
  const flat = def.melee ? s.meleeDamage : s.rangedDamage;
  return Math.max(1, (tierDamage + flat) * Math.max(0.1, 1 + s.damage / 100));
}

export function updateWeapons(w: World, dt: number): void {
  const p = w.player;
  const attackSpeed = Math.max(0.2, 1 + p.stats.attackSpeed / 100);

  for (const slot of p.weapons) {
    const wx = p.x + slot.ox;
    const wy = p.y + slot.oy;
    const ws = weaponStats(slot.def, slot.tier);
    // Melee reach only gets half of the range stat
    const range = slot.def.melee
      ? Math.max(40, ws.range + p.stats.range * 0.5)
      : Math.max(50, ws.range + p.stats.range);
    if (slot.cooldown > 0) slot.cooldown -= dt;
    if (slot.swing > 0) {
      // Mid-swing: keep the locked aim and keep hitting along the motion
      slot.swing = Math.max(0, slot.swing - dt);
      meleeHits(w, slot, wx, wy);
      continue;
    }

    const target = nearestEnemy(w, wx, wy, range);
    if (!target) continue;
    slot.angle = Math.atan2(target.y - wy, target.x - wx);

    if (slot.cooldown <= 0) {
      slot.cooldown = ws.cooldown / attackSpeed;
      if (slot.def.melee) meleeAttack(w, slot, wx, wy, range);
      else fireWeapon(w, slot, wx, wy, range);
    }
  }
}

/** Start a melee attack: lock aim, roll damage/crit, then hit along the motion. */
function meleeAttack(w: World, slot: WeaponSlot, x: number, y: number, reach: number): void {
  const def = slot.def;
  const ws = weaponStats(def, slot.tier);
  const s = w.player.stats;
  slot.swing = def.melee!.swing;
  slot.swingAngle = slot.angle;
  slot.swingReach = reach;
  slot.swingCrit = w.rng.next() * 100 < s.critChance + ws.critBonus;
  slot.swingDamage = Math.max(1, Math.round(weaponDamage(def, ws.damage, s) * (slot.swingCrit ? def.critMult : 1)));
  slot.swingHits.length = 0;
  w.events.push({ type: 'fire', weapon: def.id });
  meleeHits(w, slot, x, y);
}

/**
 * Hit enemies the weapon reaches at this point of its motion: inside the
 * angular window swept so far and within the current tip distance. Each
 * enemy is hit at most once per attack.
 */
function meleeHits(w: World, slot: WeaponSlot, x: number, y: number): void {
  const def = slot.def;
  const k = 1 - slot.swing / def.melee!.swing;
  const pose = meleePose(def, k);
  const tip = def.length + Math.max(0, slot.swingReach - def.length) * pose.extend;
  const ws = weaponStats(def, slot.tier);
  w.rebuildEnemyHash();
  w.enemyHash.query(x, y, tip + 60, meleeTargets);
  for (const e of meleeTargets) {
    if (e.dead || slot.swingHits.includes(e)) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const d = Math.hypot(dx, dy);
    if (d - e.r > tip) continue;
    // Widen the window by the enemy's angular size so big bodies are easier to clip
    let rel = Math.atan2(dy, dx) - slot.swingAngle;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    const slack = d > e.r ? Math.asin(e.r / d) : Math.PI;
    if (rel < pose.from - slack || rel > pose.to + slack) continue;
    slot.swingHits.push(e);
    damageEnemy(w, e, slot.swingDamage, slot.swingCrit, d > 0 ? dx / d : 0, d > 0 ? dy / d : 0, ws.knockback, def.id);
  }
}

function fireWeapon(w: World, slot: WeaponSlot, x: number, y: number, range: number): void {
  const def = slot.def;
  const ws = weaponStats(def, slot.tier);
  const s = w.player.stats;
  const tierColor = slot.tier > 1 ? tierOf(slot.tier).color : 0xfff4c2;
  const n = def.projectiles;
  w.events.push({ type: 'fire', weapon: def.id });
  // Start the shot at the muzzle, not the grip
  const mx = x + Math.cos(slot.angle) * def.length;
  const my = y + Math.sin(slot.angle) * def.length;

  for (let i = 0; i < n; i++) {
    const offset =
      n > 1 ? -def.spread / 2 + (def.spread * i) / (n - 1) : w.rng.range(-def.spread / 2, def.spread / 2);
    const crit = w.rng.next() * 100 < s.critChance + ws.critBonus;
    const base = weaponDamage(def, ws.damage, s);
    fireProjectile(w, {
      x: mx,
      y: my,
      angle: slot.angle + offset,
      speed: def.projectileSpeed,
      life: range / def.projectileSpeed,
      damage: Math.max(1, Math.round(base * (crit ? def.critMult : 1))),
      pierce: def.pierce,
      knockback: ws.knockback,
      crit,
      hostile: false,
      color: crit ? 0xffd84a : tierColor,
      r: def.projectile === 'rocket' ? 9 : 6,
      explosion: def.explosionRadius ?? 0,
      kind: def.projectile === 'rocket' ? 'rocket' : 'bullet',
    });
  }
}

export function fireProjectile(w: World, s: ShotSpec): void {
  const pr = w.projectilePool.acquire();
  pr.x = pr.px = s.x;
  pr.y = pr.py = s.y;
  pr.vx = Math.cos(s.angle) * s.speed;
  pr.vy = Math.sin(s.angle) * s.speed;
  pr.life = s.life;
  pr.damage = s.damage;
  pr.pierce = s.pierce;
  pr.knockback = s.knockback;
  pr.crit = s.crit;
  pr.hostile = s.hostile;
  pr.color = s.color;
  pr.r = s.r;
  pr.explosion = s.explosion ?? 0;
  pr.kind = s.kind ?? 'bullet';
  pr.hits.length = 0;
  w.projectiles.push(pr);
}

/** Linear scan is fine here: a few weapons x a few hundred enemies per step. */
function nearestEnemy(w: World, x: number, y: number, range: number): Enemy | null {
  let best: Enemy | null = null;
  let bestD = range * range;
  for (const e of w.enemies) {
    if (e.dead) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const d = dx * dx + dy * dy - e.r * e.r;
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}
