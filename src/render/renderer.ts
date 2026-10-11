import { BitmapText, Container, Graphics, Sprite, type Application } from 'pixi.js';
import type { Body } from '../game/types';
import { ARENA_H, ARENA_W, type World } from '../game/world';
import { buildTextures, type TextureSet } from './textures';

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
    markers: new Container(),
    pickups: new Container(),
    enemies: new Container(),
    player: new Container(),
    projectiles: new Container(),
    texts: new Container(),
  };
  private readonly pools = new Map<Container, Sprite[]>();
  private readonly textPool: BitmapText[] = [];
  private readonly playerSprite: Sprite;
  private camX = ARENA_W / 2;
  private camY = ARENA_H / 2;

  constructor(private readonly app: Application) {
    this.tex = buildTextures(app.renderer);
    for (const layer of Object.values(this.layers)) this.camera.addChild(layer);
    app.stage.addChild(this.camera);
    this.layers.floor.addChild(drawArena());
    this.playerSprite = new Sprite(this.tex.player);
    this.playerSprite.anchor.set(0.5);
    this.layers.player.addChild(this.playerSprite);
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
    this.camera.scale.set(zoom);
    this.camera.position.set(width / 2 - this.camX * zoom, height / 2 - this.camY * zoom);

    // Player: squash-and-stretch while walking, blink during i-frames
    const ps = this.playerSprite;
    ps.position.set(pp.x, pp.y);
    const bob = p.moving ? Math.sin(t * 18) * 0.06 : Math.sin(t * 3) * 0.02;
    ps.scale.set(p.facing * (1 - bob), 1 + bob);
    ps.alpha = p.iframes > 0 && Math.floor(t * 20) % 2 === 0 ? 0.4 : 1;

    this.sync(this.layers.player, p.weapons, (s, slot) => {
      s.texture = this.tex.weapons[slot.def.id];
      s.anchor.set(0.15, 0.5);
      s.position.set(pp.x + slot.ox, pp.y + slot.oy);
      s.rotation = slot.angle;
      // Keep guns upright when aiming left
      s.scale.y = Math.cos(slot.angle) < 0 ? -1 : 1;
    }, 1);

    this.sync(this.layers.enemies, w.enemies, (s, e) => {
      const ep = lerp(e);
      s.texture = this.tex.enemies[e.def.id];
      s.anchor.set(0.5);
      s.position.set(ep.x, ep.y);
      const wobble = Math.sin(t * 10 + e.x * 0.05) * 0.06;
      s.scale.set((ep.x < pp.x ? 1 : -1) * (1 + wobble), 1 - wobble);
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
      s.texture = this.tex.bullet;
      s.anchor.set(0.5);
      s.position.set(prp.x, prp.y);
      s.scale.set(pr.r / 8);
      s.tint = pr.color;
    });

    this.syncTexts(w);
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
          fontFamily: 'Arial Black, Arial, sans-serif',
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
