import { swapRemove } from '../core/pool';
import type { World } from '../game/world';
import { collectMaterial } from './combat';

const BASE_PICKUP_RANGE = 90;

export function updatePickups(w: World, dt: number): void {
  const p = w.player;
  const magnetRange = BASE_PICKUP_RANGE * Math.max(0.2, 1 + p.stats.pickupRange / 100);

  for (let i = w.pickups.length - 1; i >= 0; i--) {
    const m = w.pickups[i];
    const dx = p.x - m.x;
    const dy = p.y - m.y;
    const d = Math.hypot(dx, dy);

    if (!m.magnet && d < magnetRange) m.magnet = true;
    if (m.magnet) {
      // Accelerate toward the player so it never orbits forever
      m.speed = Math.min(m.speed + 2400 * dt, 1400);
      const step = Math.min(d, m.speed * dt);
      m.x += (dx / (d || 1)) * step;
      m.y += (dy / (d || 1)) * step;
    }

    if (d < p.r + m.r) {
      collectMaterial(w, m.value);
      w.pickupPool.release(swapRemove(w.pickups, i));
    }
  }
}

/** Wave end: everything still on the ground goes straight to the bag. */
export function collectAllPickups(w: World): void {
  for (const m of w.pickups) {
    collectMaterial(w, m.value);
    w.pickupPool.release(m);
  }
  w.pickups.length = 0;
}
