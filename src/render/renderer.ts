import { BitmapText, Container, Graphics, Sprite, type Application } from 'pixi.js';
import type { Body } from '../game/types';
import { ARENA_H, ARENA_W, type World } from '../game/world';
import { ExplosionFx, particleLook, type FxLayer, type Particle } from './fx';
import { buildTextures, weaponKey, type TextureSet } from './textures';

/** World units visible across the shorter screen axis. */
const VIEW_HEIGHT = 820;

/**
 * Draws a World. It owns sprite pools per layer and re-binds them to the
 * current entity lists every frame, so game logic never touches Pixi objects.
 */
export class GameRenderer {
  private readonly tex: TextureSet;
  private readonly camera = new Container();
  private readonly layers = {
    floor: new Container(),
    decals: new Container(),
    markers: new Container(),
    shadows: new Container(),
    pickups: new Container(),
    enemies: new Container(),
    player: new Container(),
    projectiles: new Container(),
    smoke: new Container(),
    effects: new Container(),
    texts: new Container(),
  };
  private readonly pools = new Map<Container, Sprite[]>();
  private readonly textPool: BitmapText[] = [];
  private readonly playerSprite: Sprite;
  private readonly playerShadow: Sprite;
  private readonly fx: ExplosionFx;
  private readonly fxByLayer: Record<FxLayer, Particle[]> = { decal: [], smoke: [], fire: [] };
  private camX = ARENA_W / 2;
  private camY = ARENA_H / 2;

  constructor(private readonly app: Application) {
    this.tex = buildTextures(app.renderer);
    this.fx = new ExplosionFx(this.tex.fx);
    for (const layer of Object.values(this.layers)) this.camera.addChild(layer);
    app.stage.addChild(this.camera);
    this.layers.floor.addChild(drawArena());
    this.playerSprite = new Sprite(this.tex.player);
    this.playerSprite.anchor.set(0.5);
    this.layers.player.addChild(this.playerSprite);
    this.playerShadow = new Sprite(this.tex.shadow);
    this.playerShadow.anchor.set(0.5);
    this.layers.shadows.addChild(this.playerShadow);
  }

  render(w: World, alpha: number): void {
    const p = w.player;
    const lerp = (b: Body) => ({ x: b.px + (b.x - b.px) * alpha, y: b.py + (b.y - b.py) * alpha });
    const pp = lerp(p);
    const t = w.time;

    // Camera: smooth follow, zoom so ~VIEW_HEIGHT world units fit vertically
    const { width, height } = this.app.screen;
    const zoom = Math.min(height / VIEW_HEIGHT, width / (VIEW_HEIGHT * 1.2));
    this.camX += (pp.x - this.camX) * 0.18;
    this.camY += (pp.y - this.camY) * 0.18;
    this.fx.update(w);
    const shake = this.fx.shakeOffset(t);
    this.camera.scale.set(zoom);
    this.camera.position.set(
      width / 2 - (this.camX + shake.x) * zoom,
      height / 2 - (this.camY + shake.y) * zoom,
    );

    // Player: squash-and-stretch while walking, blink during i-frames
    const ps = this.playerSprite;
    ps.position.set(pp.x, pp.y);
    const bob = p.moving ? Math.sin(t * 18) * 0.06 : Math.sin(t * 3) * 0.02;
    ps.scale.set(p.facing * (1 - bob), 1 + bob);
    ps.alpha = p.iframes > 0 && Math.floor(t * 20) % 2 === 0 ? 0.4 : 1;
    this.playerShadow.position.set(pp.x, pp.y + p.r * 1.15);

    this.sync(this.layers.player, p.weapons, (s, slot) => {
      const art = this.tex.weapons[weaponKey(slot.def.id, slot.tier)];
      s.texture = art.texture;
      s.anchor.set(art.anchor.x, art.anchor.y);
      s.position.set(pp.x + slot.ox, pp.y + slot.oy);
      s.rotation = slot.angle;
      // Keep guns upright when aiming left
      s.scale.y = Math.cos(slot.angle) < 0 ? -1 : 1;
    }, 1);

    this.sync(this.layers.shadows, w.enemies, (s, e) => {
      const ep = lerp(e);
      s.texture = this.tex.shadow;
      s.anchor.set(0.5);
      // Saucers hover, so their shadow sits further below
      s.position.set(ep.x, ep.y + e.r * (e.def.id === 'spitter' ? 1.5 : 1.0));
      s.scale.set(e.r / 18);
    }, 1);

    this.sync(this.layers.enemies, w.enemies, (s, e) => {
      const ep = lerp(e);
      const art = this.tex.enemies[e.def.id];
      s.texture = art.texture;
      s.anchor.set(art.anchor.x, art.anchor.y);
      const face = ep.x < pp.x ? 1 : -1;
      const phase = t + e.px * 0.013; // desync identical enemies
      let sx = 1;
      let sy = 1;
      let dy = 0;
      s.rotation = 0;
      switch (e.def.id) {
        case 'runner': // fast skitter
          s.rotation = Math.sin(phase * 32) * 0.07;
          dy = -Math.abs(Math.sin(phase * 16)) * 2;
          break;
        case 'brute': // heavy stomp
          sy = 1 - Math.abs(Math.sin(phase * 4)) * 0.06;
          sx = 2 - sy;
          break;
        case 'spitter': // hover and tilt
          dy = -8 + Math.sin(phase * 4) * 4;
          s.rotation = Math.sin(phase * 3) * 0.08 * face;
          break;
        default: // jelly squish
          sy = 1 + Math.sin(phase * 9) * 0.07;
          sx = 2 - sy;
      }
      s.position.set(ep.x, ep.y + dy);
      s.scale.set(face * sx, sy);
      s.tint = e.flash > 0 ? 0xff9090 : 0xffffff;
    });

    this.sync(this.layers.markers, w.markers, (s, m) => {
      s.texture = this.tex.marker;
      s.anchor.set(0.5);
      s.position.set(m.x, m.y);
      s.alpha = 0.5 + 0.5 * Math.abs(Math.sin(m.t * 12));
    });

    this.sync(this.layers.pickups, w.pickups, (s, m) => {
      const mp = lerp(m);
      s.texture = this.tex.material;
      s.anchor.set(0.5);
      s.position.set(mp.x, mp.y);
      s.rotation = Math.sin(t * 4 + m.x) * 0.3;
    });

    this.sync(this.layers.projectiles, w.projectiles, (s, pr) => {
      const prp = lerp(pr);
      s.anchor.set(0.5);
      s.position.set(prp.x, prp.y);
      if (pr.kind === 'rocket') {
        s.texture = this.tex.rocket;
        s.rotation = Math.atan2(pr.vy, pr.vx);
        s.scale.set(1.15);
        s.tint = 0xffffff;
      } else {
        s.texture = this.tex.bullet;
        s.rotation = 0;
        s.scale.set(pr.r / 8);
        s.tint = pr.color;
      }
    });

    for (const list of Object.values(this.fxByLayer)) list.length = 0;
    for (const p of this.fx.particles) this.fxByLayer[p.layer].push(p);
    this.syncParticles(this.layers.decals, this.fxByLayer.decal);
    this.syncParticles(this.layers.smoke, this.fxByLayer.smoke);
    this.syncParticles(this.layers.effects, this.fxByLayer.fire);

    this.syncTexts(w);
  }

  private syncParticles(layer: Container, items: readonly Particle[]): void {
    this.sync(layer, items, (s, p) => {
      const look = particleLook(p);
      s.texture = p.tex;
      s.anchor.set(0.5);
      s.position.set(p.x, p.y);
      s.rotation = p.rot;
      s.scale.set(look.sx, look.sy);
      s.alpha = look.alpha;
      s.tint = look.tint;
      s.blendMode = p.additive ? 'add' : 'normal';
    });
  }

  /**
   * Bind one pooled sprite per item; hide the leftovers. `offset` skips
   * children that are not pooled (the player sprite).
   */
  private sync<T>(layer: Container, items: readonly T[], apply: (s: Sprite, item: T) => void, offset = 0): void {
    let pool = this.pools.get(layer);
    if (!pool) {
      pool = [];
      this.pools.set(layer, pool);
    }
    while (pool.length < items.length) {
      const s = new Sprite();
      pool.push(s);
      layer.addChildAt(s, Math.min(layer.children.length, pool.length - 1 + offset));
    }
    for (let i = 0; i < pool.length; i++) {
      const s = pool[i];
      if (i < items.length) {
        s.visible = true;
        apply(s, items[i]);
      } else {
        s.visible = false;
      }
    }
  }

  private syncTexts(w: World): void {
    while (this.textPool.length < w.texts.length) {
      const bt = new BitmapText({
        text: '',
        style: {
          fontFamily: 'Arial Black, "Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif',
          fontSize: 26,
          fontWeight: 'bold',
          fill: 0xffffff,
          stroke: { color: 0x000000, width: 5 },
        },
      });
      bt.anchor.set(0.5);
      this.textPool.push(bt);
      this.layers.texts.addChild(bt);
    }
    this.textPool.forEach((bt, i) => {
      const ft = w.texts[i];
      if (!ft) {
        bt.visible = false;
        return;
      }
      bt.visible = true;
      if (bt.text !== ft.text) bt.text = ft.text;
      bt.tint = ft.color;
      bt.position.set(ft.x, ft.y);
      bt.scale.set(ft.scale * (0.8 + Math.min(ft.t, 0.2)));
      bt.alpha = Math.min(1, ft.t * 3);
    });
  }
}

function drawArena(): Graphics {
  const g = new Graphics();
  const pad = 2000;
  // Dark void around the arena
  g.rect(-pad, -pad, ARENA_W + pad * 2, ARENA_H + pad * 2).fill(0x1d1c24);
  g.rect(0, 0, ARENA_W, ARENA_H).fill(0x5e5866);
  // Scattered pebbles for a sense of motion
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) {
    const x = rand() * ARENA_W;
    const y = rand() * ARENA_H;
    const r = 2 + rand() * 5;
    g.ellipse(x, y, r * 1.4, r).fill({ color: 0x4b4653, alpha: 0.9 });
  }
  for (let i = 0; i < 90; i++) {
    const x = rand() * ARENA_W;
    const y = rand() * ARENA_H;
    g.moveTo(x, y).lineTo(x + 4, y - 9).lineTo(x + 8, y).stroke({ width: 2, color: 0x6f8a5a, alpha: 0.7 });
  }
  g.rect(0, 0, ARENA_W, ARENA_H).stroke({ width: 8, color: 0x2a2833 });
  return g;
}
