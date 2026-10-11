import { Graphics, type Renderer, type Texture } from 'pixi.js';
import { ENEMIES, type EnemyDef } from '../data/enemies';
import { TIERS, WEAPONS, type WeaponDef } from '../data/weapons';

/**
 * All art is drawn procedurally with Graphics and baked into textures once,
 * so the project ships with zero external image assets.
 */
export interface Anchored {
  texture: Texture;
  /** Normalized anchor that puts the drawing's local origin at the sprite position. */
  anchor: { x: number; y: number };
}

export interface TextureSet {
  player: Texture;
  /** Keyed by enemy id; origin = body center (antennae/legs may stick out). */
  enemies: Record<string, Anchored>;
  /** Keyed by `${weaponId}_${tier}`; origin = grip. */
  weapons: Record<string, Anchored>;
  bullet: Texture;
  rocket: Texture;
  blast: Texture;
  shadow: Texture;
  material: Texture;
  marker: Texture;
}

const OUTLINE = 0x1b1a22;
export const BLAST_RADIUS = 64;

export function buildTextures(renderer: Renderer): TextureSet {
  const bake = (g: Graphics) => {
    const tex = renderer.generateTexture({ target: g, resolution: 2 });
    g.destroy();
    return tex;
  };
  const bakeAnchored = (g: Graphics): Anchored => {
    const b = g.getLocalBounds();
    const anchor = { x: -b.x / b.width, y: -b.y / b.height };
    return { texture: bake(g), anchor };
  };

  const enemies: Record<string, Anchored> = {};
  for (const def of ENEMIES) enemies[def.id] = bakeAnchored(drawEnemy(def));

  const weapons: Record<string, Anchored> = {};
  for (const def of Object.values(WEAPONS)) {
    TIERS.forEach((tier, i) => {
      weapons[weaponKey(def.id, i + 1)] = bakeAnchored(drawWeapon(def, tier.color, i + 1));
    });
  }

  return {
    player: bake(drawPotato()),
    enemies,
    weapons,
    bullet: bake(new Graphics().circle(0, 0, 8).fill(0xffffff)),
    rocket: bake(drawRocket()),
    blast: bake(drawBlast()),
    shadow: bake(new Graphics().ellipse(0, 0, 20, 7).fill({ color: 0x000000, alpha: 0.28 })),
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

// ---------------------------------------------------------------------------
// Aliens. All face right; the renderer mirrors them toward the player.
// ---------------------------------------------------------------------------

function drawEnemy(def: EnemyDef): Graphics {
  switch (def.id) {
    case 'runner':
      return drawSkitter(def.radius, def.color);
    case 'brute':
      return drawBrute(def.radius, def.color);
    case 'spitter':
      return drawSaucer(def.radius, def.color);
    default:
      return drawJelly(def.radius, def.color);
  }
}

/** Eye with white, colored iris and a pupil looking to the right. */
function eye(g: Graphics, x: number, y: number, r: number, iris: number, slit = false): void {
  g.circle(x, y, r).fill(0xffffff).stroke({ width: 2, color: OUTLINE });
  g.circle(x + r * 0.25, y + r * 0.05, r * 0.6).fill(iris);
  if (slit) g.ellipse(x + r * 0.3, y, r * 0.14, r * 0.5).fill(OUTLINE);
  else g.circle(x + r * 0.3, y, r * 0.3).fill(OUTLINE);
  g.circle(x - r * 0.15, y - r * 0.35, r * 0.18).fill(0xffffff);
}

/** Purple jelly blob: wobbly skirt, two glowing antennae, three eyes. */
function drawJelly(r: number, color: number): Graphics {
  const g = new Graphics();
  const dark = shade(color, 0.6);
  // Antennae behind the body
  for (const side of [-1, 1]) {
    g.moveTo(side * r * 0.3, -r * 0.6)
      .quadraticCurveTo(side * r * 0.35, -r * 1.25, side * r * 0.7, -r * 1.35)
      .stroke({ width: 3, color: OUTLINE, cap: 'round' });
    g.circle(side * r * 0.72, -r * 1.38, r * 0.2).fill(0xc6ff5e).stroke({ width: 2, color: OUTLINE });
  }
  // Silhouette: dome + three drips, outline pass then fill pass
  const shape = (pad: number, fill: number) => {
    g.ellipse(0, -r * 0.05, r + pad, r * 0.9 + pad).fill(fill);
    for (const x of [-0.62, 0, 0.62]) g.circle(x * r, r * 0.68, r * 0.34 + pad).fill(fill);
  };
  shape(3, OUTLINE);
  shape(0, color);
  // Belly shading and gloss
  g.ellipse(0, r * 0.45, r * 0.75, r * 0.3).fill({ color: dark, alpha: 0.5 });
  g.ellipse(-r * 0.45, -r * 0.5, r * 0.28, r * 0.16).fill({ color: 0xffffff, alpha: 0.35 });
  // Spots
  g.circle(-r * 0.7, r * 0.05, r * 0.1).fill(dark);
  g.circle(-r * 0.5, r * 0.3, r * 0.07).fill(dark);
  // Three eyes
  eye(g, r * 0.2, -r * 0.2, r * 0.34, 0xd83030);
  eye(g, -r * 0.4, -r * 0.42, r * 0.17, 0xd83030);
  eye(g, r * 0.72, -r * 0.5, r * 0.15, 0xd83030);
  // Grin with one fang
  g.moveTo(r * 0.0, r * 0.3).quadraticCurveTo(r * 0.35, r * 0.48, r * 0.7, r * 0.25).stroke({ width: 2.5, color: OUTLINE, cap: 'round' });
  g.poly([r * 0.4, r * 0.36, r * 0.5, r * 0.58, r * 0.58, r * 0.34]).fill(0xffffff).stroke({ width: 1.5, color: OUTLINE });
  return g;
}

/** Orange insectoid: low segmented body, six jointed legs, mandibles, slit eye. */
function drawSkitter(r: number, color: number): Graphics {
  const g = new Graphics();
  const dark = shade(color, 0.55);
  // Legs (behind the body): hip -> raised knee -> foot
  for (const [hx, kx, fx] of [
    [-0.8, -1.2, -1.45],
    [-0.15, -0.45, -0.6],
    [0.5, 0.35, 0.25],
  ]) {
    g.moveTo(hx * r, r * 0.15)
      .lineTo(kx * r, -r * 0.55)
      .lineTo(fx * r, r * 1.0)
      .stroke({ width: 3.5, color: OUTLINE, cap: 'round', join: 'round' });
    g.moveTo(hx * r, r * 0.15)
      .lineTo(kx * r, -r * 0.55)
      .lineTo(fx * r, r * 1.0)
      .stroke({ width: 1.5, color: dark, cap: 'round', join: 'round' });
  }
  // Abdomen and thorax
  g.ellipse(-r * 0.55, r * 0.1, r * 0.85, r * 0.6).fill(color).stroke({ width: 3, color: OUTLINE });
  g.ellipse(r * 0.45, 0, r * 0.6, r * 0.5).fill(color).stroke({ width: 3, color: OUTLINE });
  // Stripes on the abdomen
  for (const x of [-0.95, -0.6, -0.25]) {
    g.moveTo(x * r, -r * 0.4).quadraticCurveTo((x - 0.1) * r, r * 0.1, x * r, r * 0.6).stroke({ width: 2, color: dark });
  }
  // Back spikes
  for (const x of [-0.9, -0.5, -0.1]) {
    g.poly([(x - 0.12) * r, -r * 0.42, x * r, -r * 0.85, (x + 0.12) * r, -r * 0.45]).fill(0xfff1c9).stroke({ width: 2, color: OUTLINE });
  }
  // Mandibles
  g.moveTo(r * 0.95, r * 0.05).quadraticCurveTo(r * 1.45, r * 0.0, r * 1.35, r * 0.4).stroke({ width: 3, color: OUTLINE, cap: 'round' });
  g.moveTo(r * 0.9, r * 0.25).quadraticCurveTo(r * 1.3, r * 0.45, r * 1.05, r * 0.7).stroke({ width: 3, color: OUTLINE, cap: 'round' });
  // One big slit eye + a tiny one
  eye(g, r * 0.55, -r * 0.12, r * 0.3, 0xffd23a, true);
  g.circle(r * 0.95, -r * 0.3, r * 0.1).fill(OUTLINE);
  return g;
}

/** Green armored tank: plated hump, curved horns, tusked underbite, tiny glowing eyes. */
function drawBrute(r: number, color: number): Graphics {
  const g = new Graphics();
  const dark = shade(color, 0.55);
  const light = shade(color, 1.35);
  // Fists
  for (const x of [-1, 1]) {
    g.roundRect(x * r * 1.0 - r * 0.18, r * 0.05, r * 0.36, r * 0.5, r * 0.15).fill(dark).stroke({ width: 3, color: OUTLINE });
    g.circle(x * r * 1.02, r * 0.62, r * 0.27).fill(dark).stroke({ width: 3, color: OUTLINE });
  }
  // Horns
  for (const side of [-1, 1]) {
    g.moveTo(side * r * 0.45, -r * 0.7)
      .quadraticCurveTo(side * r * 1.05, -r * 0.95, side * r * 0.95, -r * 1.45)
      .quadraticCurveTo(side * r * 0.75, -r * 1.05, side * r * 0.2, -r * 0.82)
      .closePath()
      .fill(0xeadfc4)
      .stroke({ width: 2.5, color: OUTLINE, join: 'round' });
  }
  // Body
  g.roundRect(-r, -r * 0.85, r * 2, r * 1.75, r * 0.55).fill(color).stroke({ width: 3.5, color: OUTLINE });
  // Belly
  g.ellipse(r * 0.1, r * 0.45, r * 0.7, r * 0.38).fill(light);
  // Armor plates across the back
  for (const [y, w] of [
    [-0.7, 1.5],
    [-0.42, 1.75],
  ]) {
    g.roundRect(-w * r * 0.5, y * r, w * r, r * 0.26, r * 0.12).fill(dark).stroke({ width: 2, color: OUTLINE });
  }
  // Angry brow and small glowing eyes
  g.moveTo(r * 0.0, -r * 0.18).lineTo(r * 0.75, -r * 0.05).stroke({ width: 4, color: OUTLINE, cap: 'round' });
  g.circle(r * 0.2, 0, r * 0.11).fill(0xffe14a).stroke({ width: 2, color: OUTLINE });
  g.circle(r * 0.58, r * 0.05, r * 0.11).fill(0xffe14a).stroke({ width: 2, color: OUTLINE });
  // Underbite with tusks
  g.roundRect(r * 0.0, r * 0.3, r * 0.85, r * 0.3, r * 0.1).fill(0x3a1320).stroke({ width: 2.5, color: OUTLINE });
  g.poly([r * 0.12, r * 0.32, r * 0.2, r * 0.0, r * 0.3, r * 0.32]).fill(0xffffff).stroke({ width: 1.5, color: OUTLINE });
  g.poly([r * 0.6, r * 0.32, r * 0.7, r * 0.02, r * 0.78, r * 0.32]).fill(0xffffff).stroke({ width: 1.5, color: OUTLINE });
  return g;
}

/** Cyan flying saucer piloted by a little green alien. */
function drawSaucer(r: number, color: number): Graphics {
  const g = new Graphics();
  const dark = shade(color, 0.6);
  // Tractor glow under the hull
  g.ellipse(0, r * 0.85, r * 0.7, r * 0.22).fill({ color: 0x9df7ff, alpha: 0.35 });
  // Antenna on the dome
  g.moveTo(0, -r * 0.95).lineTo(r * 0.15, -r * 1.35).stroke({ width: 2.5, color: OUTLINE });
  g.circle(r * 0.15, -r * 1.38, r * 0.12).fill(0xff4d4d).stroke({ width: 2, color: OUTLINE });
  // Glass dome (back), the pilot, then a glass highlight
  g.ellipse(0, -r * 0.3, r * 0.68, r * 0.68).fill({ color: 0xbfeaff, alpha: 0.35 }).stroke({ width: 3, color: OUTLINE });
  g.ellipse(r * 0.05, -r * 0.42, r * 0.36, r * 0.42).fill(0x7ed957).stroke({ width: 2, color: OUTLINE });
  // Big almond alien eyes
  g.ellipse(-r * 0.04, -r * 0.48, r * 0.11, r * 0.16).fill(OUTLINE);
  g.ellipse(r * 0.24, -r * 0.48, r * 0.11, r * 0.16).fill(OUTLINE);
  g.circle(-r * 0.02, -r * 0.55, r * 0.04).fill(0xffffff);
  g.circle(r * 0.26, -r * 0.55, r * 0.04).fill(0xffffff);
  g.ellipse(-r * 0.32, -r * 0.62, r * 0.12, r * 0.2).fill({ color: 0xffffff, alpha: 0.45 });
  // Hull
  g.ellipse(0, r * 0.32, r * 1.3, r * 0.45).fill(color).stroke({ width: 3, color: OUTLINE });
  g.ellipse(0, r * 0.2, r * 1.1, r * 0.18).fill({ color: 0xffffff, alpha: 0.18 });
  g.ellipse(0, r * 0.55, r * 0.75, r * 0.15).fill(dark);
  // Rim lights
  for (const x of [-0.95, -0.48, 0, 0.48, 0.95]) {
    g.circle(x * r, r * 0.38, r * 0.09).fill(0xffe14a).stroke({ width: 1.5, color: OUTLINE });
  }
  return g;
}

// ---------------------------------------------------------------------------
// Weapons and projectiles
// ---------------------------------------------------------------------------

export function weaponKey(id: string, tier: number): string {
  return `${id}_${tier}`;
}

/** The outline uses the tier color; higher tiers also get a soft glow. */
function drawWeapon(def: WeaponDef, tierColor: number, tier: number): Graphics {
  const g = new Graphics();
  const { length, color } = def;
  const stroke = { width: 3, color: tierColor };
  if (tier >= 2) {
    const glow = 4 + tier * 2;
    g.roundRect(-8 - glow, -9 - glow, length + 4 + glow * 2, 18 + glow * 2, 9).fill({ color: tierColor, alpha: 0.12 + tier * 0.04 });
  }
  // Grip at the origin, barrel pointing to +x
  g.roundRect(-4, -2, 10, 12, 3).fill(shade(color, 0.6)).stroke(stroke);

  if (def.style === 'tube') {
    // Rocket launcher: fat tube, flared muzzle, warhead peeking out
    g.roundRect(-10, -7, length, 13, 4).fill(color).stroke(stroke);
    g.rect(length - 16, -9, 8, 17).fill(shade(color, 0.7)).stroke(stroke);
    g.poly([length - 8, -4, length + 2, -0.5, length - 8, 3]).fill(0xd94a3a).stroke({ width: 2, color: OUTLINE });
    g.rect(4, -11, 6, 4).fill(shade(color, 0.6)).stroke({ width: 2, color: tierColor });
  } else if (def.style === 'gatling') {
    // Gatling: drum housing and a bundle of three barrels
    g.roundRect(-9, -9, 16, 18, 4).fill(shade(color, 0.8)).stroke(stroke);
    for (const y of [-6, -1.5, 3]) g.rect(6, y, length - 6, 3.5).fill(color).stroke({ width: 1.5, color: OUTLINE });
    g.rect(10, -8, 4, 16).fill(shade(color, 0.6)).stroke({ width: 2, color: tierColor });
    g.rect(length - 6, -8, 4, 16).fill(shade(color, 0.6)).stroke({ width: 2, color: tierColor });
  } else {
    g.roundRect(-6, -6, length, 10, 3).fill(color).stroke(stroke);
    g.rect(length - 10, -4, 4, 6).fill(shade(color, 1.3));
  }
  return g;
}

/** Rocket pointing right, with fins and a flame. */
function drawRocket(): Graphics {
  const g = new Graphics();
  g.ellipse(-14, 0, 7, 4).fill({ color: 0xffb23a, alpha: 0.9 });
  g.ellipse(-12, 0, 4, 2.5).fill(0xfff3b0);
  g.poly([-8, -4, -12, -8, -4, -4]).fill(0x4a5a3a).stroke({ width: 1.5, color: OUTLINE });
  g.poly([-8, 4, -12, 8, -4, 4]).fill(0x4a5a3a).stroke({ width: 1.5, color: OUTLINE });
  g.roundRect(-9, -4, 16, 8, 3).fill(0xd8d8d0).stroke({ width: 2, color: OUTLINE });
  g.poly([7, -4, 14, 0, 7, 4]).fill(0xd94a3a).stroke({ width: 2, color: OUTLINE });
  return g;
}

/** Explosion flash; the renderer scales and fades it. */
function drawBlast(): Graphics {
  const g = new Graphics();
  const R = BLAST_RADIUS;
  g.circle(0, 0, R).fill({ color: 0xff7a2a, alpha: 0.35 });
  g.circle(0, 0, R * 0.72).fill({ color: 0xffa23a, alpha: 0.55 });
  g.circle(0, 0, R * 0.42).fill({ color: 0xfff0a0, alpha: 0.85 });
  g.circle(0, 0, R - 3).stroke({ width: 6, color: 0xffd36b });
  return g;
}

function shade(color: number, f: number): number {
  const r = Math.min(255, ((color >> 16) & 0xff) * f);
  const g = Math.min(255, ((color >> 8) & 0xff) * f);
  const b = Math.min(255, (color & 0xff) * f);
  return (r << 16) | (g << 8) | b;
}
