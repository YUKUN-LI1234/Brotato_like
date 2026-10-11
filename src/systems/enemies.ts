import type { Enemy } from '../game/types';
import { ARENA_H, ARENA_W, type World } from '../game/world';
import { damagePlayer } from './combat';
import { clamp } from './player';
import { fireProjectile } from './weapons';

const neighbors: Enemy[] = [];

const BOSS_BURST_SHOTS = 16;
const BOSS_ATTACK_GAP = 2.2;
const BOSS_WINDUP = 0.75;
const BOSS_DASH_TIME = 0.55;
const BOSS_DASH_SPEED = 560;

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
    let speed = e.speed;

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
    } else if (e.def.behavior === 'boss') {
      const move = updateBoss(w, e, mx, my, dt);
      mx = move.x;
      my = move.y;
      speed = move.speed;
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

    e.x += (mx * speed + e.kbx) * dt + sx * 0.35;
    e.y += (my * speed + e.kby) * dt + sy * 0.35;
    e.x = clamp(e.x, e.r, ARENA_W - e.r);
    e.y = clamp(e.y, e.r, ARENA_H - e.r);
    e.kbx *= kbDecay;
    e.kby *= kbDecay;
    if (e.flash > 0) e.flash -= dt;

    if (dist < e.r + p.r) damagePlayer(w, e.damage);
  }
}

/**
 * Boss pattern: walk toward the player, and every few seconds either fire a
 * ring of bullets or stop, shake (windup) and charge in a locked direction.
 * Returns the movement for this step.
 */
function updateBoss(w: World, e: Enemy, ux: number, uy: number, dt: number): { x: number; y: number; speed: number } {
  if (e.mode === 'windup') {
    e.modeTimer -= dt;
    if (e.modeTimer <= 0) {
      e.mode = 'dash';
      e.modeTimer = BOSS_DASH_TIME;
    }
    return { x: 0, y: 0, speed: 0 };
  }
  if (e.mode === 'dash') {
    e.modeTimer -= dt;
    if (e.modeTimer <= 0) {
      e.mode = 'move';
      e.attackTimer = BOSS_ATTACK_GAP;
    }
    return { x: e.dirX, y: e.dirY, speed: BOSS_DASH_SPEED };
  }

  e.attackTimer -= dt;
  if (e.attackTimer <= 0) {
    e.attacks++;
    if (e.attacks % 2 === 1) {
      const start = w.rng.range(0, Math.PI * 2);
      for (let i = 0; i < BOSS_BURST_SHOTS; i++) {
        fireProjectile(w, {
          x: e.x,
          y: e.y,
          angle: start + (i / BOSS_BURST_SHOTS) * Math.PI * 2,
          speed: 260,
          life: 3,
          damage: Math.round(e.damage * 0.7),
          pierce: 0,
          knockback: 0,
          crit: false,
          hostile: true,
          color: 0xff5a5a,
          r: 10,
        });
      }
      e.attackTimer = BOSS_ATTACK_GAP;
    } else {
      // Direction is locked at the start of the windup, so the charge can be dodged
      e.mode = 'windup';
      e.modeTimer = BOSS_WINDUP;
      e.dirX = ux;
      e.dirY = uy;
    }
  }
  return { x: ux, y: uy, speed: e.speed };
}
