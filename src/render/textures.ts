import { Graphics, type Renderer, type Texture } from 'pixi.js';
import { ENEMIES } from '../data/enemies';
import { WEAPONS } from '../data/weapons';

/**
 * All art is drawn procedurally with Graphics and baked into textures once,
 * so the project ships with zero external image assets.
 */
export interface TextureSet {
  player: Texture;
  enemies: Record<string, Texture>;
  weapons: Record<string, Texture>;
  bullet: Texture;
  material: Texture;
  marker: Texture;
}

const OUTLINE = 0x1b1a22;

export function buildTextures(renderer: Renderer): TextureSet {
  const bake = (g: Graphics) => {
    const tex = renderer.generateTexture({ target: g, resolution: 2 });
    g.destroy();
    return tex;
  };

  const enemies: Record<string, Texture> = {};
  for (const def of ENEMIES) enemies[def.id] = bake(drawEnemy(def.radius, def.color, def.behavior === 'ranged'));

  const weapons: Record<string, Texture> = {};
  for (const def of Object.values(WEAPONS)) weapons[def.id] = bake(drawWeapon(def.length, def.color));

  return {
    player: bake(drawPotato()),
    enemies,
    weapons,
    bullet: bake(new Graphics().circle(0, 0, 8).fill(0xffffff)),
    material: bake(
      new Graphics()
        .poly([0, -9, 8, 0, 0, 9, -8, 0])
        .fill(0x5fd35f)
        .stroke({ width: 2, color: 0x1f5a1f }),
    ),
    marker: bake(
      new Graphics()
        .moveTo(-12, -12)
        .lineTo(12, 12)
        .moveTo(12, -12)
        .lineTo(-12, 12)
        .stroke({ width: 6, color: 0xe23b3b, cap: 'round' }),
    ),
  };
}

function drawPotato(): Graphics {
  const g = new Graphics();
  // Body
  g.ellipse(0, 0, 22, 26).fill(0xe9d3a1).stroke({ width: 3, color: OUTLINE });
  // Freckles
  g.circle(-9, 10, 2).fill(0xc9ae78);
  g.circle(8, 13, 1.6).fill(0xc9ae78);
  g.circle(11, -12, 1.8).fill(0xc9ae78);
  // Determined eyes, looking right; the sprite is flipped when facing left
  g.ellipse(2, -6, 4, 5).fill(0xffffff).stroke({ width: 2, color: OUTLINE });
  g.ellipse(13, -6, 4, 5).fill(0xffffff).stroke({ width: 2, color: OUTLINE });
  g.circle(3.5, -5, 2).fill(OUTLINE);
  g.circle(14.5, -5, 2).fill(OUTLINE);
  g.moveTo(-1, -13).lineTo(7, -11).stroke({ width: 2.5, color: OUTLINE, cap: 'round' });
  g.moveTo(10, -11).lineTo(18, -13).stroke({ width: 2.5, color: OUTLINE, cap: 'round' });
  // Mouth
  g.moveTo(5, 6).lineTo(13, 5).stroke({ width: 2.5, color: OUTLINE, cap: 'round' });
  return g;
}

function drawEnemy(r: number, color: number, ranged: boolean): Graphics {
  const g = new Graphics();
  const dark = shade(color, 0.6);
  // Blobby body with little feet
  g.ellipse(-r * 0.45, r * 0.8, r * 0.3, r * 0.2).fill(dark).stroke({ width: 2, color: OUTLINE });
  g.ellipse(r * 0.45, r * 0.8, r * 0.3, r * 0.2).fill(dark).stroke({ width: 2, color: OUTLINE });
  g.circle(0, 0, r).fill(color).stroke({ width: 3, color: OUTLINE });
  g.ellipse(-r * 0.35, -r * 0.4, r * 0.25, r * 0.15).fill({ color: 0xffffff, alpha: 0.25 });
  // One big eye
  const eyeR = r * 0.38;
  g.circle(0, -r * 0.1, eyeR).fill(0xffffff).stroke({ width: 2, color: OUTLINE });
  g.circle(0, -r * 0.05, eyeR * 0.5).fill(ranged ? 0xc86bff : 0xd83030);
  g.circle(0, -r * 0.05, eyeR * 0.22).fill(OUTLINE);
  // Teeth
  g.poly([-r * 0.35, r * 0.4, -r * 0.2, r * 0.6, -r * 0.05, r * 0.4]).fill(0xffffff);
  g.poly([r * 0.05, r * 0.4, r * 0.2, r * 0.6, r * 0.35, r * 0.4]).fill(0xffffff);
  return g;
}

function drawWeapon(length: number, color: number): Graphics {
  const g = new Graphics();
  // Grip at the origin, barrel pointing to +x
  g.roundRect(-4, -2, 10, 12, 3).fill(shade(color, 0.6)).stroke({ width: 2, color: OUTLINE });
  g.roundRect(-6, -6, length, 10, 3).fill(color).stroke({ width: 2, color: OUTLINE });
  g.rect(length - 10, -4, 4, 6).fill(shade(color, 1.3));
  return g;
}

function shade(color: number, f: number): number {
  const r = Math.min(255, ((color >> 16) & 0xff) * f);
  const g = Math.min(255, ((color >> 8) & 0xff) * f);
  const b = Math.min(255, (color & 0xff) * f);
  return (r << 16) | (g << 8) | b;
}
