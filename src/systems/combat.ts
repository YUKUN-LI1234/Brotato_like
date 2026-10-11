import { armorMultiplier, MAX_DODGE } from '../data/stats';
import { xpToNext } from '../data/waves';
import type { Enemy } from '../game/types';
import { maxHpOf, type World } from '../game/world';

const MAX_TEXTS = 60;
const PLAYER_IFRAMES = 0.4;

export function addText(w: World, x: number, y: number, text: string, color: number, scale = 1): void {
  if (w.texts.length >= MAX_TEXTS) w.texts.shift();
  w.texts.push({ x, y, text, color, t: 0.7, scale });
}

export function damageEnemy(
  w: World,
  e: Enemy,
  amount: number,
  crit: boolean,
  dirX: number,
  dirY: number,
  knockback: number,
): void {
  if (e.dead) return;
  e.hp -= amount;
  e.flash = 0.08;
  // Heavier enemies get pushed less
  const kb = (knockback * 20 * 18) / e.r;
  e.kbx += dirX * kb;
  e.kby += dirY * kb;
  addText(w, e.x, e.y - e.r, String(Math.round(amount)), crit ? 0xffd84a : 0xffffff, crit ? 1.35 : 1);
  const killed = e.hp <= 0;
  w.events.push({ type: 'enemyHit', crit, killed });
  if (killed) killEnemy(w, e);
}

const blastTargets: Enemy[] = [];

/** An aftershock goes off this long after the blast that triggered it. */
const AFTERSHOCK_DELAY = 0.16;

/**
 * Area damage around (x, y). Radius and damage scale with the explosion
 * stats; enemies are pushed away from the center. Only explosive weapons
 * call this, and each blast rolls "explode chance" for one aftershock.
 */
export function explode(
  w: World,
  x: number,
  y: number,
  baseRadius: number,
  baseDamage: number,
  knockback: number,
  crit: boolean,
  aftershock = false,
): void {
  const s = w.player.stats;
  const radius = baseRadius * Math.max(0.2, 1 + s.explosionSize / 100);
  const damage = Math.max(1, Math.round(baseDamage * Math.max(0.1, 1 + s.explosionDamage / 100)));
  w.enemyHash.query(x, y, radius + 40, blastTargets);
  for (const e of blastTargets) {
    if (e.dead) continue;
    const dx = e.x - x;
    const dy = e.y - y;
    const d = Math.hypot(dx, dy);
    if (d > radius + e.r) continue;
    damageEnemy(w, e, damage, crit, d > 0 ? dx / d : 0, d > 0 ? dy / d : 0, knockback);
  }
  w.explosions.push({ x, y, radius, t: 0, life: 0.35 });
  w.events.push({ type: 'explosion' });

  // Aftershocks never chain, so one rocket blows up at most twice
  if (!aftershock && w.rng.next() * 100 < s.explodeChance) {
    const a = w.rng.range(0, Math.PI * 2);
    const off = baseRadius * 0.45;
    w.pendingBlasts.push({
      x: x + Math.cos(a) * off,
      y: y + Math.sin(a) * off,
      radius: baseRadius * 0.75,
      damage: baseDamage * 0.6,
      knockback: knockback * 0.6,
      crit,
      delay: AFTERSHOCK_DELAY,
    });
  }
}

/** Detonate queued aftershocks whose delay has run out. */
export function updateBlasts(w: World, dt: number): void {
  if (w.pendingBlasts.length === 0) return;
  w.rebuildEnemyHash();
  for (let i = w.pendingBlasts.length - 1; i >= 0; i--) {
    const b = w.pendingBlasts[i];
    b.delay -= dt;
    if (b.delay > 0) continue;
    w.pendingBlasts.splice(i, 1);
    explode(w, b.x, b.y, b.radius, b.damage, b.knockback, b.crit, true);
  }
}

export function killEnemy(w: World, e: Enemy): void {
  e.dead = true;
  w.kills++;
  let drops = e.def.materials;
  // Luck gives a chance at one bonus material
  if (w.rng.chance(0.08 * (1 + w.player.stats.luck / 100))) drops++;
  for (let i = 0; i < drops; i++) {
    spawnPickup(w, e.x + w.rng.range(-12, 12), e.y + w.rng.range(-12, 12), 1);
  }
}

export function spawnPickup(w: World, x: number, y: number, value: number): void {
  // Too many on the ground: bank it directly instead of spawning more objects
  if (w.pickups.length >= 400) {
    collectMaterial(w, value);
    return;
  }
  const p = w.pickupPool.acquire();
  p.x = p.px = x;
  p.y = p.py = y;
  p.value = value;
  p.magnet = false;
  p.speed = 0;
  w.pickups.push(p);
}

export function collectMaterial(w: World, value: number): void {
  w.player.materials += value;
  gainXp(w, value);
}

export function gainXp(w: World, amount: number): void {
  const p = w.player;
  p.xp += amount;
  while (p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level);
    p.level++;
    p.pendingLevels++;
    // Every level grants +1 max HP, like the genre staple
    p.stats.maxHp += 1;
    p.hp += 1;
    addText(w, p.x, p.y - 40, '升级!', 0x7dff8a, 1.4);
  }
}

export function damagePlayer(w: World, raw: number): void {
  const p = w.player;
  if (p.iframes > 0 || w.god) return;
  if (w.rng.next() * 100 < Math.min(p.stats.dodge, MAX_DODGE)) {
    addText(w, p.x, p.y - 30, '闪避', 0x9ad0ff);
    p.iframes = 0.2;
    return;
  }
  const dmg = Math.max(1, Math.round(raw * armorMultiplier(p.stats.armor)));
  p.hp -= dmg;
  p.iframes = PLAYER_IFRAMES;
  addText(w, p.x, p.y - 30, `-${dmg}`, 0xff5555, 1.2);
  if (p.hp <= 0) {
    p.hp = 0;
    w.playerDead = true;
  }
}

export function healPlayer(w: World, amount: number): void {
  const p = w.player;
  const before = p.hp;
  p.hp = Math.min(maxHpOf(p), p.hp + amount);
  if (p.hp > before) addText(w, p.x, p.y - 30, `+${p.hp - before}`, 0x6dff7a);
}
