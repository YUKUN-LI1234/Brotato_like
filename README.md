# Brotato_Like

A small arena shooter inspired by *Brotato*, written from scratch in **TypeScript** with **Pixi.js v8**. A potato with guns survives 20 waves of monsters; weapons fire on their own, you just move. Between waves you level up and visit a shop.

All code and art are original: every sprite is drawn procedurally with Pixi `Graphics`, and the repo contains no game assets.

## Play

```bash
npm install
npm run dev        # http://localhost:5173
```

Controls: **WASD / arrow keys** to move, **Esc / P** or the ❚❚ button to pause, **M** to mute, **1–4** to pick a level-up, **Enter** on focused buttons. Switching browser tabs pauses automatically.

`npm run build` writes a static site to `dist/`. Pushing to `main` deploys it to GitHub Pages (see `.github/workflows/deploy.yml`; enable *Settings → Pages → Source: GitHub Actions* once).

## Features

- 20 waves with a rising difficulty curve; telegraphed spawns
- 4 alien enemy types, each with its own look and idle animation: jelly blob, insectoid runner, armored brute, UFO spitter
- 6 weapons with auto-aim, crits, pierce, spread and knockback (pistol, SMG, shotgun, rifle, rocket launcher with area explosions, gatling); up to 6 at once
- Weapon tiers: Common (white) → Rare (blue) → Epic (purple) → Legendary (red). Three of the same weapon and tier merge into one of the next tier automatically (chain merges included); each tier steps up damage, fire rate, range, knockback and crit. Higher tiers show up in the shop in later waves
- Full weapon slots: buying a weapon that won't merge opens a dialog to recycle one owned weapon for 1/3 of its current price
- Chinese UI (简体中文)
- Procedural music and sound effects (Web Audio, no audio files), with music/SFX volume sliders and mute (saved)
- 15 stats (HP, regen, armor, dodge, damage, attack speed, crit, range, harvesting, explosion size/damage/chance, …)
- Explosion items: bigger blasts, stronger blasts, and a chance for any bullet to explode
- XP and level-ups, materials, shop with items, weapons and rerolls
- Best wave saved in `localStorage`

## Architecture

```
src/
  core/      loop.ts (fixed timestep), input.ts, rng.ts (seeded), spatialHash.ts, pool.ts
  data/      weapons, items, enemies, waves, stats, upgrades  — pure data, no logic
  game/      world.ts (all simulation state), types.ts, game.ts (state machine)
  systems/   player, spawn, enemies, weapons, projectiles, pickups, combat, cleanup
  render/    textures.ts (procedural art), renderer.ts (Pixi sprite pools)
  ui/        hud.ts, screens.ts (DOM overlays)
```

Design choices worth reading:

- **Simulation and rendering are separate.** `World` is plain data; systems are functions `(world, dt) => void`. The renderer reads the world each frame and never writes to it, so the game logic can run headless (the perf test below calls `update()` with no rendering).
- **Fixed timestep + interpolation** (`core/loop.ts`). The simulation always advances 1/60 s per step regardless of frame rate. Entities keep their previous position (`px/py`), and the renderer interpolates between steps so motion stays smooth on 120/144 Hz screens.
- **Spatial hash** (`core/spatialHash.ts`) for projectile hits and enemy separation, instead of O(n²) pair checks.
- **Object pools** (`core/pool.ts`) for enemies, projectiles and pickups, plus swap-remove, to avoid garbage-collection stutter.
- **Seeded RNG** (`core/rng.ts`), so a run is reproducible from its seed.
- **Data-driven content.** Adding a weapon or an item is one entry in `src/data/`.

Measured in headless Chromium with 320 live enemies: ~0.5 ms per simulation step and ~0.4 ms per render sync.

## Debugging

The game instance is exposed as `__game` in the browser console:

```js
__game.debug.spawn(200)          // spawn enemies ('blob' | 'runner' | 'brute' | 'spitter')
__game.debug.god()               // invincible
__game.debug.give(100)           // materials
__game.debug.weapon('rocket', 2)  // id: 'pistol' | 'smg' | 'shotgun' | 'rifle' | 'rocket' | 'gatling', tier 1-4
__game.debug.skipWave()
```

## Roadmap

- [x] Weapon tiers and merging
- [ ] Melee weapons
- [ ] Characters with starting bonuses
- [ ] Elite and boss waves
- [x] Sound effects and music
- [ ] English/Chinese language switch
- [ ] Touch controls (virtual joystick)
- [ ] Unit tests for systems with Vitest

## Disclaimer

This is an independent fan project made for learning. It is not affiliated with or endorsed by Blobfish Games, the makers of *Brotato*. No code or assets from the original game are used.

## License

MIT
