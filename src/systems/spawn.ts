import { swapRemove } from '../core/pool';
import { BOSS, ENEMIES, type EnemyDef } from '../data/enemies';
import { BOSS_DELAY, BOSS_WAVE, enemyHpScale, MAX_ENEMIES, waveConfig } from '../data/waves';
import { addText } from './combat';
import { ARENA_H, ARENA_W, type World } from '../game/world';

const MARKER_TIME = 0.9;
const MIN_PLAYER_DISTANCE = 320;

export function updateSpawns(w: World, dt: number): void {
  const cfg = waveConfig(w.wave);

  // Stop spawning shortly before the wave ends
  if (w.waveTime < w.waveDuration - 1.5) {
    w.spawnTimer -= dt;
    while (w.spawnTimer <= 0) {
      w.spawnTimer += cfg.spawnInterval;
      spawnGroup(w, cfg.groupSize);
    }
  }

  if (w.wave === BOSS_WAVE && !w.bossSpawned && w.waveTime >= BOSS_DELAY) {
    w.bossSpawned = true;
    spawnBoss(w);
  }

  for (let i = w.markers.length - 1; i >= 0; i--) {
    const m = w.markers[i];
    m.t -= dt;
    if (m.t <= 0) {
      spawnEnemy(w, m.def, m.x, m.y);
      swapRemove(w.markers, i);
    }
  }
}

function spawnGroup(w: World, size: number): void {
  if (w.enemies.length + w.markers.length >= MAX_ENEMIES) return;
  const def = pickEnemy(w);
  const { x, y } = randomSpawnPoint(w);
  for (let i = 0; i < size; i++) {
    w.markers.push({
      x: clampArena(x + w.rng.range(-70, 70), ARENA_W),
      y: clampArena(y + w.rng.range(-70, 70), ARENA_H),
      t: MARKER_TIME,
      def,
    });
  }
}

/** Long warning marker on the far side of the arena, then the boss lands. */
function spawnBoss(w: World): void {
  const p = w.player;
  const x = p.x < ARENA_W / 2 ? ARENA_W * 0.78 : ARENA_W * 0.22;
  const y = p.y < ARENA_H / 2 ? ARENA_H * 0.72 : ARENA_H * 0.28;
  w.markers.push({ x, y, t: 2, def: BOSS });
  addText(w, p.x, p.y - 60, 'BOSS 来袭！', 0xff5a5a, 2);
}

function pickEnemy(w: World): EnemyDef {
  const unlocked = ENEMIES.filter((e) => e.firstWave <= w.wave);
  return w.rng.weighted(unlocked, (e) => e.weight);
}

function randomSpawnPoint(w: World): { x: number; y: number } {
  const p = w.player;
  for (let attempt = 0; attempt < 12; attempt++) {
    const x = w.rng.range(60, ARENA_W - 60);
    const y = w.rng.range(60, ARENA_H - 60);
    if (Math.hypot(x - p.x, y - p.y) >= MIN_PLAYER_DISTANCE) return { x, y };
  }
  // Fallback: opposite corner from the player
  return { x: p.x < ARENA_W / 2 ? ARENA_W - 80 : 80, y: p.y < ARENA_H / 2 ? ARENA_H - 80 : 80 };
}

export function spawnEnemy(w: World, def: EnemyDef, x: number, y: number): void {
  const e = w.enemyPool.acquire();
  const scale = w.wave - 1;
  e.def = def;
  e.x = e.px = x;
  e.y = e.py = y;
  e.r = def.radius;
  e.maxHp = e.hp = Math.round((def.hp + def.hpPerWave * scale) * enemyHpScale(w.wave));
  e.damage = def.damage + def.damagePerWave * scale;
  // Slight speed variance keeps crowds from moving in lockstep
  e.speed = def.speed * w.rng.range(0.9, 1.1);
  e.kbx = e.kby = 0;
  e.flash = 0;
  e.attackTimer = w.rng.range(1, 2.5);
  e.mode = 'move';
  e.modeTimer = 0;
  e.attacks = 0;
  e.dead = false;
  w.enemies.push(e);
}

function clampArena(v: number, max: number): number {
  return Math.min(max - 40, Math.max(40, v));
}
