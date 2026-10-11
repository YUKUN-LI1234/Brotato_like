import type { Enemy, WeaponSlot } from '../game/types';
import type { World } from '../game/world';

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
}

export function updateWeapons(w: World, dt: number): void {
  const p = w.player;
  const attackSpeed = Math.max(0.2, 1 + p.stats.attackSpeed / 100);

  for (const slot of p.weapons) {
    const wx = p.x + slot.ox;
    const wy = p.y + slot.oy;
    const range = Math.max(50, slot.def.range + p.stats.range);
    if (slot.cooldown > 0) slot.cooldown -= dt;

    const target = nearestEnemy(w, wx, wy, range);
    if (!target) continue;
    slot.angle = Math.atan2(target.y - wy, target.x - wx);

    if (slot.cooldown <= 0) {
      slot.cooldown = slot.def.cooldown / attackSpeed;
      fireWeapon(w, slot, wx, wy, range);
    }
  }
}

function fireWeapon(w: World, slot: WeaponSlot, x: number, y: number, range: number): void {
  const def = slot.def;
  const s = w.player.stats;
  const n = def.projectiles;
  // Start the shot at the muzzle, not the grip
  const mx = x + Math.cos(slot.angle) * def.length;
  const my = y + Math.sin(slot.angle) * def.length;

  for (let i = 0; i < n; i++) {
    const offset =
      n > 1 ? -def.spread / 2 + (def.spread * i) / (n - 1) : w.rng.range(-def.spread / 2, def.spread / 2);
    const crit = w.rng.next() * 100 < s.critChance;
    const base = def.damage * Math.max(0.1, 1 + s.damage / 100);
    fireProjectile(w, {
      x: mx,
      y: my,
      angle: slot.angle + offset,
      speed: def.projectileSpeed,
      life: range / def.projectileSpeed,
      damage: Math.max(1, Math.round(base * (crit ? def.critMult : 1))),
      pierce: def.pierce,
      knockback: def.knockback,
      crit,
      hostile: false,
      color: crit ? 0xffd84a : 0xfff4c2,
      r: 6,
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
