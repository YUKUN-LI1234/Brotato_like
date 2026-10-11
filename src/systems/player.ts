import type { Input } from '../core/input';
import { BASE_MOVE_SPEED, regenInterval } from '../data/stats';
import { ARENA_H, ARENA_W, maxHpOf, type World } from '../game/world';
import { healPlayer } from './combat';

export function updatePlayer(w: World, input: Input, dt: number): void {
  const p = w.player;
  const dir = input.moveVector();
  const speed = BASE_MOVE_SPEED * Math.max(0.2, 1 + p.stats.speed / 100);

  p.x = clamp(p.x + dir.x * speed * dt, p.r, ARENA_W - p.r);
  p.y = clamp(p.y + dir.y * speed * dt, p.r, ARENA_H - p.r);
  p.moving = dir.x !== 0 || dir.y !== 0;
  if (dir.x !== 0) p.facing = dir.x > 0 ? 1 : -1;

  if (p.iframes > 0) p.iframes -= dt;

  // HP regen: heal 1 HP every `interval` seconds while hurt
  const interval = regenInterval(p.stats.hpRegen);
  if (p.hp < maxHpOf(p) && Number.isFinite(interval)) {
    p.regenTimer += dt;
    if (p.regenTimer >= interval) {
      p.regenTimer -= interval;
      healPlayer(w, 1);
    }
  } else {
    p.regenTimer = 0;
  }
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
