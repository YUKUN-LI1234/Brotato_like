import type { Application } from 'pixi.js';
import { AudioEngine } from '../audio/audio';
import type { SfxName } from '../audio/sfx';
import { Input } from '../core/input';
import { FixedLoop } from '../core/loop';
import { ITEMS } from '../data/items';
import { addStats, formatStatMod, STAT_ORDER } from '../data/stats';
import { UPGRADES, type Upgrade } from '../data/upgrades';
import { MAX_WAVE, priceForWave, rerollCost, waveConfig } from '../data/waves';
import { MAX_TIER, MERGE_COUNT, rollShopTier, tierOf, weaponStats, WEAPONS, type WeaponDef } from '../data/weapons';
import { GameRenderer } from '../render/renderer';
import { cleanup, clearWave } from '../systems/cleanup';
import { collectMaterial, gainXp } from '../systems/combat';
import { updateEnemies } from '../systems/enemies';
import { collectAllPickups, updatePickups } from '../systems/pickups';
import { updatePlayer } from '../systems/player';
import { updateProjectiles } from '../systems/projectiles';
import { spawnEnemy, updateSpawns } from '../systems/spawn';
import { updateWeapons } from '../systems/weapons';
import { Hud } from '../ui/hud';
import { Screens, type ShopOffer } from '../ui/screens';
import { VolumeControl } from '../ui/volume';
import { ENEMIES } from '../data/enemies';
import type { GameEvent } from './types';
import type { WeaponSlot } from './types';
import { addWeapon, ARENA_H, ARENA_W, canAcquire, maxHpOf, mergeProgress, removeWeapon, World, type MergeResult } from './world';

export type GameState = 'menu' | 'wave' | 'paused' | 'levelup' | 'shop' | 'gameover';

const STEP = 1 / 60;
const BEST_KEY = 'brotato_like.bestWave';

const FIRE_SOUND: Record<string, SfxName> = {
  pistol: 'fire_pistol',
  smg: 'fire_smg',
  shotgun: 'fire_shotgun',
  rifle: 'fire_rifle',
  rocket: 'fire_rocket',
  gatling: 'fire_gatling',
};

/** Owns the loop and moves between states: menu → wave → level-up → shop → wave … */
export class Game {
  state: GameState = 'menu';
  world: World;
  private readonly input = new Input();
  readonly audio = new AudioEngine();
  private readonly renderer: GameRenderer;
  private readonly hud: Hud;
  private readonly screens: Screens;
  private readonly volume: VolumeControl;
  private readonly loop: FixedLoop;
  private offers: ShopOffer[] = [];
  private rerolls = 0;
  private notices: string[] = [];

  constructor(app: Application, uiRoot: HTMLElement) {
    this.world = new World(1);
    this.renderer = new GameRenderer(app);
    this.hud = new Hud(uiRoot);
    this.screens = new Screens(uiRoot);
    this.loop = new FixedLoop(STEP, (dt) => this.update(dt), (a) => this.render(a));
    this.volume = new VolumeControl(uiRoot, this.audio);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') this.toggleMute();
    });
    this.hud.onPause(() => this.togglePause());
    window.addEventListener('keydown', (e) => {
      if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) this.togglePause();
    });
    // Switching tabs mid-wave pauses instead of letting the player die off-screen
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'wave') this.pause();
    });
    this.showMenu();
    this.loop.start();
  }

  newRun(seed = Date.now() >>> 0): void {
    // Called from a click/keypress, so the browser lets audio start here
    this.audio.unlock();
    this.world = new World(seed);
    this.startWave();
  }

  private startWave(): void {
    const w = this.world;
    const p = w.player;
    clearWave(w);
    w.waveTime = 0;
    w.waveDuration = waveConfig(w.wave).duration;
    w.spawnTimer = 0.6;
    w.playerDead = false;
    p.x = p.px = ARENA_W / 2;
    p.y = p.py = ARENA_H / 2;
    p.hp = maxHpOf(p);
    p.iframes = 0;
    for (const slot of p.weapons) slot.cooldown = 0;
    this.state = 'wave';
    this.audio.setMusic('wave');
    this.screens.hide();
    this.hud.show(true);
  }

  private update(dt: number): void {
    if (this.state !== 'wave') return;
    const w = this.world;
    w.snapshot();
    w.time += dt;
    w.waveTime += dt;

    updatePlayer(w, this.input, dt);
    updateSpawns(w, dt);
    updateEnemies(w, dt);
    updateWeapons(w, dt);
    updateProjectiles(w, dt);
    updatePickups(w, dt);
    cleanup(w, dt);
    this.playEvents(w.events);
    w.events.length = 0;

    if (w.playerDead) this.endRun(false);
    else if (w.waveTime >= w.waveDuration) this.endWave();
  }

  togglePause(): void {
    if (this.state === 'wave') this.pause();
    else if (this.state === 'paused') this.resume();
  }

  pause(): void {
    if (this.state !== 'wave') return;
    const w = this.world;
    this.state = 'paused';
    this.audio.setMusic('calm');
    this.screens.pause(
      w.wave,
      Math.max(0, Math.ceil(w.waveDuration - w.waveTime)),
      () => this.resume(),
      () => this.newRun(),
      () => this.showMenu(),
    );
  }

  resume(): void {
    if (this.state !== 'paused') return;
    this.state = 'wave';
    this.audio.setMusic('wave');
    this.screens.hide();
  }

  private playEvents(events: readonly GameEvent[]): void {
    for (const ev of events) {
      if (ev.type === 'fire') {
        const name = FIRE_SOUND[ev.weapon];
        if (name) this.audio.play(name);
      } else if (ev.type === 'explosion') {
        this.audio.play('explosion');
      } else if (ev.killed) {
        this.audio.play('kill');
      } else {
        this.audio.play(ev.crit ? 'hit_crit' : 'hit');
      }
    }
  }

  private toggleMute(): void {
    this.audio.toggleMute();
    this.volume.refresh();
  }

  private render(alpha: number): void {
    this.renderer.render(this.world, this.state === 'wave' ? alpha : 1);
    if (this.state !== 'menu') this.hud.update(this.world);
  }

  private endWave(): void {
    const w = this.world;
    const p = w.player;
    collectAllPickups(w);
    // Harvesting pays out materials and XP at the end of every wave
    if (p.stats.harvesting > 0) collectMaterial(w, p.stats.harvesting);
    clearWave(w);
    this.saveBest(w.wave);

    if (w.wave >= MAX_WAVE) {
      this.endRun(true);
      return;
    }
    this.nextAfterWave();
  }

  /** Spend pending level-ups one at a time, then open the shop. */
  private nextAfterWave(): void {
    this.audio.setMusic('calm');
    const p = this.world.player;
    if (p.pendingLevels > 0) {
      this.state = 'levelup';
      const options = this.world.rng.shuffled(UPGRADES).slice(0, 4);
      const levelShown = p.level - p.pendingLevels + 1;
      this.screens.levelUp(levelShown, p.pendingLevels, options, (u) => this.pickUpgrade(u));
      return;
    }
    this.rerolls = 0;
    this.notices = [];
    this.offers = this.rollOffers();
    this.openShop();
  }

  private pickUpgrade(u: Upgrade): void {
    const p = this.world.player;
    p.stats[u.stat] += u.amount;
    p.pendingLevels--;
    this.nextAfterWave();
  }

  private rollOffers(): ShopOffer[] {
    const w = this.world;
    const offers: ShopOffer[] = [];
    for (let i = 0; i < 4; i++) {
      if (w.rng.chance(0.35)) {
        const def = w.rng.pick(Object.values(WEAPONS));
        const tier = rollShopTier(w.rng.next(), w.wave);
        offers.push(this.weaponOffer(def, tier));
      } else {
        const item = w.rng.pick(ITEMS);
        offers.push({
          kind: 'item',
          id: item.id,
          name: item.name,
          price: priceForWave(item.price, w.wave),
          tier: 0,
          lines: STAT_ORDER.filter((k) => item.mods[k]).map((k) => formatStatMod(k, item.mods[k]!)),
          color: item.color,
          sold: false,
          canBuy: true,
          needsRecycle: false,
          mergeHint: null,
        });
      }
    }
    return offers;
  }

  private weaponOffer(def: WeaponDef, tier: number): ShopOffer {
    const ws = weaponStats(def, tier);
    const lines = [
      `伤害 ${ws.damage}${def.projectiles > 1 ? ` ×${def.projectiles}` : ''}`,
      `冷却 ${ws.cooldown} 秒`,
      `射程 ${ws.range}`,
    ];
    if (def.explosionRadius) lines.push(`爆炸范围 ${def.explosionRadius}`);
    if (ws.critBonus > 0) lines.push(`暴击率 +${ws.critBonus}%`);
    return {
      kind: 'weapon',
      id: def.id,
      name: def.name,
      tier,
      price: priceForWave(def.price * tierOf(tier).price, this.world.wave),
      lines,
      color: def.color,
      sold: false,
      canBuy: true,
      needsRecycle: false,
      mergeHint: null,
    };
  }

  /** Recompute per-offer merge info against the current loadout. */
  private refreshOffers(): void {
    const p = this.world.player;
    const bestRefund = Math.max(0, ...p.weapons.map((s) => this.recycleValue(s)));
    for (const o of this.offers) {
      o.canBuy = o.price <= p.materials;
      if (o.kind !== 'weapon') continue;
      const def = WEAPONS[o.id];
      o.needsRecycle = !canAcquire(p, def, o.tier);
      if (o.needsRecycle) o.canBuy = o.price <= p.materials + bestRefund;
      const owned = mergeProgress(p, def, o.tier);
      o.mergeHint =
        o.tier >= MAX_TIER || owned === 0
          ? null
          : owned >= MERGE_COUNT - 1
            ? `购买后合成 → ${tierOf(o.tier + 1).name}`
            : `已有 ${owned}/${MERGE_COUNT}`;
    }
  }

  private openShop(): void {
    this.refreshOffers();
    const w = this.world;
    const p = w.player;
    this.state = 'shop';
    this.screens.shop(
      {
        wave: w.wave,
        materials: p.materials,
        offers: this.offers,
        rerollCost: rerollCost(w.wave, this.rerolls),
        weapons: p.weapons.map((s) => ({ name: s.def.name, tier: s.tier })),
        stats: p.stats,
        notices: this.notices,
      },
      (i) => this.buy(i),
      () => this.reroll(),
      () => {
        this.notices = [];
        w.wave++;
        this.startWave();
      },
    );
  }

  /** Recycling returns 1/3 of the weapon's current shop price. */
  private recycleValue(slot: WeaponSlot): number {
    return Math.max(1, Math.floor(priceForWave(slot.def.price * tierOf(slot.tier).price, this.world.wave) / 3));
  }

  private buy(i: number): void {
    const p = this.world.player;
    const offer = this.offers[i];
    if (!offer || offer.sold) return;
    if (offer.kind === 'weapon' && !canAcquire(p, WEAPONS[offer.id], offer.tier)) {
      this.askRecycle(i);
      return;
    }
    if (offer.price > p.materials) return;
    this.notices = [];
    if (offer.kind === 'weapon') {
      this.announceMerges(addWeapon(p, WEAPONS[offer.id], offer.tier));
    } else {
      const item = ITEMS.find((it) => it.id === offer.id)!;
      addStats(p.stats, item.mods);
      p.items.push(item.id);
      p.hp = Math.min(p.hp, maxHpOf(p));
    }
    p.materials -= offer.price;
    offer.sold = true;
    this.openShop();
  }

  private askRecycle(offerIndex: number): void {
    const p = this.world.player;
    const offer = this.offers[offerIndex];
    this.screens.recycleDialog(
      {
        offer,
        materials: p.materials,
        options: p.weapons.map((s) => {
          const refund = this.recycleValue(s);
          return { name: s.def.name, tier: s.tier, refund, disabled: p.materials + refund < offer.price };
        }),
      },
      (slotIndex) => this.recycleAndBuy(offerIndex, slotIndex),
      () => this.openShop(),
    );
  }

  private recycleAndBuy(offerIndex: number, slotIndex: number): void {
    const p = this.world.player;
    const offer = this.offers[offerIndex];
    const slot = p.weapons[slotIndex];
    if (!offer || offer.sold || !slot) return;
    const refund = this.recycleValue(slot);
    if (p.materials + refund < offer.price) return;

    removeWeapon(p, slotIndex);
    p.materials += refund - offer.price;
    offer.sold = true;
    this.notices = [`回收 ${tierOf(slot.tier).name}${slot.def.name}，返还 ${refund} 材料`];
    this.announceMerges(addWeapon(p, WEAPONS[offer.id], offer.tier));
    this.openShop();
  }

  private announceMerges(merges: MergeResult[]): void {
    for (const m of merges) {
      this.notices.push(`合成成功！${MERGE_COUNT} 把${tierOf(m.tier - 1).name}${m.def.name} → ${tierOf(m.tier).name}${m.def.name}`);
      this.audio.play('hit_crit');
    }
  }

  private reroll(): void {
    const p = this.world.player;
    const cost = rerollCost(this.world.wave, this.rerolls);
    if (cost > p.materials) return;
    p.materials -= cost;
    this.rerolls++;
    this.notices = [];
    this.offers = this.rollOffers();
    this.openShop();
  }

  private endRun(won: boolean): void {
    this.state = 'gameover';
    this.audio.setMusic('calm');
    this.saveBest(won ? MAX_WAVE : this.world.wave - 1);
    this.screens.gameOver(won, this.world.wave, this.world.kills, () => this.newRun());
  }

  private showMenu(): void {
    this.state = 'menu';
    this.hud.show(false);
    this.screens.menu(this.loadBest(), () => this.newRun());
  }

  // localStorage can throw in private mode or sandboxed frames; best score is optional
  private loadBest(): number {
    try {
      return Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch {
      return 0;
    }
  }

  private saveBest(wave: number): void {
    try {
      if (wave > this.loadBest()) localStorage.setItem(BEST_KEY, String(wave));
    } catch {
      /* ignore */
    }
  }

  /** Hooks for the browser console and automated tests. */
  readonly debug = {
    spawn: (count: number, id = 'blob') => {
      const def = ENEMIES.find((e) => e.id === id) ?? ENEMIES[0];
      const w = this.world;
      for (let i = 0; i < count; i++) spawnEnemy(w, def, w.rng.range(50, ARENA_W - 50), w.rng.range(50, ARENA_H - 50));
    },
    god: (on = true) => {
      this.world.god = on;
    },
    give: (materials: number) => {
      this.world.player.materials += materials;
    },
    xp: (amount: number) => gainXp(this.world, amount),
    weapon: (id: string, tier = 1) => {
      const def = WEAPONS[id];
      if (def && canAcquire(this.world.player, def, tier)) return addWeapon(this.world.player, def, tier);
      return [];
    },
    skipWave: () => {
      if (this.state === 'wave') this.world.waveTime = this.world.waveDuration;
    },
  };
}
