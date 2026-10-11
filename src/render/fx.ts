import type { Texture } from 'pixi.js';
import type { Explosion, Projectile } from '../game/types';
import type { World } from '../game/world';
import { FX_RADIUS, type FxTextures } from './textures';

/** Where a particle is drawn. */
export type FxLayer = 'decal' | 'smoke' | 'fire';

/**
 * One purely visual particle. Lives only in the renderer: the simulation
 * never sees these, so they can use Math.random freely.
 */
export interface Particle {
  layer: FxLayer;
  tex: Texture;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Velocity kept per second (0..1). */
  drag: number;
  rot: number;
  vrot: number;
  /** Scale at birth and at death, eased out in between. */
  s0: number;
  s1: number;
  /** Extra x-stretch per unit of speed (sparks). */
  stretch: number;
  alpha: number;
  /** Tint at birth and at death. */
  c0: number;
  c1: number;
  additive: boolean;
  /** Fraction of life spent fading in (0 = starts fully visible). */
  fadeIn: number;
  t: number;
  life: number;
}

const MAX_PARTICLES = 700;
const TRAIL_INTERVAL = 0.022;
const MAX_SHAKE = 14;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * Turns simulation explosions into a layered blast: flash, fireballs,
 * shockwave, sparks, smoke and a scorch mark, plus a short camera shake.
 * Also leaves a smoke trail behind rockets.
 */
export class ExplosionFx {
  readonly particles: Particle[] = [];
  /** Current camera shake amplitude, in world units. */
  shake = 0;
  private readonly seen = new WeakSet<Explosion>();
  private readonly trailAt = new WeakMap<Projectile, number>();
  private lastTime = 0;
  private wave = 0;

  constructor(private readonly tex: FxTextures) {}

  update(w: World): void {
    // A new run or wave starts from a clean floor
    if (w.time < this.lastTime || w.wave !== this.wave) {
      this.particles.length = 0;
      this.shake = 0;
      this.wave = w.wave;
    }
    const dt = Math.max(0, w.time - this.lastTime);
    this.lastTime = w.time;

    for (const ex of w.explosions) {
      if (this.seen.has(ex)) continue;
      this.seen.add(ex);
      this.burst(ex.x, ex.y, ex.radius);
    }
    for (const pr of w.projectiles) {
      if (pr.kind !== 'rocket') continue;
      const last = this.trailAt.get(pr) ?? -1;
      if (w.time - last < TRAIL_INTERVAL && last <= w.time) continue;
      this.trailAt.set(pr, w.time);
      this.trail(pr);
    }

    if (dt <= 0) return;
    this.shake *= Math.exp(-dt * 10);
    if (this.shake < 0.2) this.shake = 0;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.t += dt;
      if (p.t >= p.life) {
        this.particles.splice(i, 1);
        continue;
      }
      const keep = Math.pow(p.drag, dt);
      p.vx *= keep;
      p.vy *= keep;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;
    }
  }

  /** Camera offset for this frame. Driven by sim time, so it freezes on pause. */
  shakeOffset(time: number): { x: number; y: number } {
    if (this.shake <= 0) return { x: 0, y: 0 };
    return { x: Math.sin(time * 97) * this.shake, y: Math.cos(time * 83) * this.shake };
  }

  private burst(x: number, y: number, radius: number): void {
    const k = radius / FX_RADIUS;
    this.shake = Math.min(MAX_SHAKE, this.shake + 3 + radius * 0.06);

    // Scorch mark first so it sits under everything else
    this.add({
      layer: 'decal', tex: this.tex.scorch, x, y, rot: rand(0, Math.PI * 2),
      s0: k * 0.8, s1: k * 0.9, alpha: 0.85, c0: 0xffffff, c1: 0xffffff, life: 4,
    });
    // White-hot flash
    this.add({
      layer: 'fire', tex: this.tex.glow, x, y, additive: true,
      s0: k * 0.5, s1: k * 1.15, alpha: 1, c0: 0xffffff, c1: 0xffe08a, life: 0.14,
    });
    // Shockwave ring racing out to the damage radius
    this.add({
      layer: 'fire', tex: this.tex.ring, x, y, additive: true,
      s0: k * 0.25, s1: k * 1.05, alpha: 0.9, c0: 0xfff2c0, c1: 0xff9a3a, life: 0.3,
    });
    // Main fireball plus a few lumps around it, cooling from yellow to deep red
    this.add({
      layer: 'fire', tex: this.tex.glow, x, y, additive: true,
      s0: k * 0.35, s1: k * 0.85, alpha: 1, c0: 0xfff3b0, c1: 0xb8321a, life: 0.42,
    });
    const lumps = 4 + Math.round(k * 2);
    for (let i = 0; i < lumps; i++) {
      const a = rand(0, Math.PI * 2);
      const d = rand(0.15, 0.5) * radius;
      const sp = rand(40, 110) * k;
      this.add({
        layer: 'fire', tex: this.tex.glow, additive: true,
        x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.05,
        s0: k * rand(0.15, 0.25), s1: k * rand(0.35, 0.5), alpha: 0.9, c0: 0xffd36b, c1: 0x9a2414,
        life: rand(0.3, 0.5), fadeIn: 0.15,
      });
    }
    // Sparks flung outward, stretched along their motion
    const sparks = 12 + Math.round(k * 6);
    for (let i = 0; i < sparks; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(280, 720) * Math.sqrt(k);
      this.add({
        layer: 'fire', tex: this.tex.spark, additive: true,
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.02, rot: a,
        s0: rand(0.6, 1.1), s1: 0.3, stretch: 1 / 450, alpha: 1, c0: 0xfff6c8, c1: 0xff6a1a,
        life: rand(0.22, 0.45),
      });
    }
    // Smoke rolls out after the fire and drifts upward
    const puffs = 5 + Math.round(k * 2);
    for (let i = 0; i < puffs; i++) {
      const a = rand(0, Math.PI * 2);
      const d = rand(0, 0.45) * radius;
      const sp = rand(20, 60);
      this.add({
        layer: 'smoke', tex: this.tex.smoke,
        x: x + Math.cos(a) * d, y: y + Math.sin(a) * d,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rand(25, 50), drag: 0.25,
        rot: rand(0, Math.PI * 2), vrot: rand(-0.8, 0.8),
        s0: k * rand(0.3, 0.45), s1: k * rand(0.7, 1), alpha: 0.55, c0: 0x4a4048, c1: 0x8a8590,
        life: rand(0.9, 1.4), fadeIn: 0.2,
      });
    }
  }

  private trail(pr: Projectile): void {
    const speed = Math.hypot(pr.vx, pr.vy) || 1;
    // Tail of the rocket sprite
    const x = pr.x - (pr.vx / speed) * 14;
    const y = pr.y - (pr.vy / speed) * 14;
    this.add({
      layer: 'smoke', tex: this.tex.smoke, x: x + rand(-2, 2), y: y + rand(-2, 2),
      vx: rand(-12, 12), vy: rand(-25, -8), drag: 0.3, rot: rand(0, Math.PI * 2), vrot: rand(-1, 1),
      s0: 0.06, s1: rand(0.2, 0.28), alpha: 0.4, c0: 0xc8c0b8, c1: 0x7a7480, life: rand(0.4, 0.6),
    });
    this.add({
      layer: 'fire', tex: this.tex.glow, x, y, additive: true,
      s0: 0.12, s1: 0.04, alpha: 0.8, c0: 0xffe08a, c1: 0xff5a1a, life: 0.1,
    });
  }

  private add(p: Partial<Particle> & Pick<Particle, 'layer' | 'tex' | 'x' | 'y' | 's0' | 's1' | 'c0' | 'c1' | 'life'>): void {
    if (this.particles.length >= MAX_PARTICLES) this.particles.splice(0, 1);
    this.particles.push({
      vx: 0, vy: 0, drag: 1, rot: 0, vrot: 0, stretch: 0, alpha: 1, additive: false, fadeIn: 0, t: 0,
      ...p,
    });
  }
}

/** Per-frame look of a particle: eased scale, faded alpha, blended tint. */
export function particleLook(p: Particle): { sx: number; sy: number; alpha: number; tint: number } {
  const k = p.t / p.life;
  const ease = 1 - (1 - k) * (1 - k);
  const s = p.s0 + (p.s1 - p.s0) * ease;
  const fadeIn = p.fadeIn > 0 ? Math.min(1, k / p.fadeIn) : 1;
  // Decals hold, then fade over their last quarter; everything else fades steadily
  const fadeOut = p.layer === 'decal' ? Math.min(1, (1 - k) * 4) : 1 - k * k;
  const sx = s * (1 + Math.hypot(p.vx, p.vy) * p.stretch);
  return { sx, sy: s, alpha: p.alpha * fadeIn * fadeOut, tint: lerpColor(p.c0, p.c1, k) };
}

function lerpColor(a: number, b: number, k: number): number {
  const ch = (shift: number) => {
    const x = (a >> shift) & 0xff;
    const y = (b >> shift) & 0xff;
    return Math.round(x + (y - x) * k) << shift;
  };
  return ch(16) | ch(8) | ch(0);
}
