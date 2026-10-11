import { swapRemove } from '../core/pool';
import type { Enemy } from '../game/types';
import { ARENA_H, ARENA_W, type World } from '../game/world';
import { damageEnemy, damagePlayer } from './combat';

const candidates: Enemy[] = [];

export function updateProjectiles(w: World, dt: number): void {
  const p = w.player;
  // Enemies moved this step; refresh the grid before hit tests
  w.rebuildEnemyHash();

  for (let i = w.projectiles.length - 1; i >= 0; i--) {
    const pr = w.projectiles[i];
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    pr.life -= dt;

    let remove = pr.life <= 0 || pr.x < -50 || pr.y < -50 || pr.x > ARENA_W + 50 || pr.y > ARENA_H + 50;

    if (!remove && pr.hostile) {
      if (Math.hypot(p.x - pr.x, p.y - pr.y) < p.r + pr.r && p.iframes <= 0) {
        damagePlayer(w, pr.damage);
        remove = true;
      }
    } else if (!remove) {
      remove = hitEnemies(w, pr);
    }

    if (remove) w.projectilePool.release(swapRemove(w.projectiles, i));
  }
}

/** Returns true when the projectile is used up. */
function hitEnemies(w: World, pr: World['projectiles'][number]): boolean {
  w.enemyHash.query(pr.x, pr.y, pr.r + 40, candidates);
  const speed = Math.hypot(pr.vx, pr.vy) || 1;
  for (const e of candidates) {
    if (e.dead || pr.hits.includes(e)) continue;
    if (Math.hypot(e.x - pr.x, e.y - pr.y) >= e.r + pr.r) continue;

    damageEnemy(w, e, pr.damage, pr.crit, pr.vx / speed, pr.vy / speed, pr.knockback);
    pr.hits.push(e);
    if (pr.pierce <= 0) return true;
    pr.pierce--;
    pr.damage = Math.max(1, Math.round(pr.damage * 0.5));
  }
  return false;
}
