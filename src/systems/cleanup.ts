import { swapRemove } from '../core/pool';
import type { World } from '../game/world';

/** Return dead enemies to the pool and age floating texts. */
export function cleanup(w: World, dt: number): void {
  for (let i = w.enemies.length - 1; i >= 0; i--) {
    if (w.enemies[i].dead) w.enemyPool.release(swapRemove(w.enemies, i));
  }
  for (let i = w.texts.length - 1; i >= 0; i--) {
    const t = w.texts[i];
    t.t -= dt;
    t.y -= 45 * dt;
    if (t.t <= 0) w.texts.splice(i, 1);
  }
}

export function clearWave(w: World): void {
  for (const e of w.enemies) w.enemyPool.release(e);
  for (const pr of w.projectiles) w.projectilePool.release(pr);
  w.enemies.length = 0;
  w.projectiles.length = 0;
  w.markers.length = 0;
  w.texts.length = 0;
}
