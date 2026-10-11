import type { Enemy } from '../game/types';
import { ARENA_H, ARENA_W, type World } from '../game/world';
import { damagePlayer } from './combat';
import { clamp } from './player';
import { fireProjectile } from './weapons';

const neighbors: Enemy[] = [];

export function updateEnemies(w: World, dt: number): void {
  const p = w.player;
  w.rebuildEnemyHash();
  const kbDecay = Math.max(0, 1 - dt * 9);

  for (const e of w.enemies) {
    if (e.dead) continue;

    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    let mx = dx / dist;
    let my = dy / dist;

    if (e.def.behavior === 'ranged') {
      // Keep a comfortable distance and shoot from there
      if (dist < 280) {
        mx = -mx;
        my = -my;
      } else if (dist < 400) {
        mx = 0;
        my = 0;
      }
      e.attackTimer -= dt;
      if (e.attackTimer <= 0 && dist < 560) {
        e.attackTimer = 2.4;
        fireProjectile(w, {
          x: e.x,
          y: e.y,
          angle: Math.atan2(dy, dx),
          speed: 320,
          life: 2.2,
          damage: e.damage,
          pierce: 0,
          knockback: 0,
          crit: false,
          hostile: true,
          color: 0xc86bff,
          r: 9,
        });
      }
    }

    // Separation: push overlapping enemies apart so crowds spread out
    let sx = 0;
    let sy = 0;
    w.enemyHash.query(e.x, e.y, e.r * 2, neighbors);
    for (const o of neighbors) {
      if (o === e) continue;
      const ox = e.x - o.x;
      const oy = e.y - o.y;
      const d = Math.hypot(ox, oy);
      const overlap = e.r + o.r - d;
      if (overlap > 0 && d > 0.001) {
        sx += (ox / d) * overlap;
        sy += (oy / d) * overlap;
      }
    }

    e.x += (mx * e.speed + e.kbx) * dt + sx * 0.35;
    e.y += (my * e.speed + e.kby) * dt + sy * 0.35;
    e.x = clamp(e.x, e.r, ARENA_W - e.r);
    e.y = clamp(e.y, e.r, ARENA_H - e.r);
    e.kbx *= kbDecay;
    e.kby *= kbDecay;
    if (e.flash > 0) e.flash -= dt;

    if (dist < e.r + p.r) damagePlayer(w, e.damage);
  }
}
