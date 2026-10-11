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
  if (e.hp <= 0) killEnemy(w, e);
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
    addText(w, p.x, p.y - 40, 'LEVEL UP!', 0x7dff8a, 1.4);
  }
}

export function damagePlayer(w: World, raw: number): void {
  const p = w.player;
  if (p.iframes > 0 || w.god) return;
  if (w.rng.next() * 100 < Math.min(p.stats.dodge, MAX_DODGE)) {
    addText(w, p.x, p.y - 30, 'Dodge', 0x9ad0ff);
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
