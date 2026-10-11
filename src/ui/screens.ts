import { formatStatMod, formatStatValue, STAT_LABELS, STAT_ORDER, type Stats } from '../data/stats';
import type { Upgrade } from '../data/upgrades';
import { MAX_WEAPONS, MERGE_COUNT, TIERS } from '../data/weapons';
import { el } from './hud';

export interface ShopOffer {
  kind: 'weapon' | 'item';
  id: string;
  name: string;
  /** Weapon quality 1..4; items use 0. */
  tier: number;
  price: number;
  lines: string[];
  color: number;
  sold: boolean;
  /** Weapon only: false when all slots are full and it would not merge. */
  fits: boolean;
  /** e.g. "购买后合成：稀有" — shown as a badge on the card. */
  mergeHint: string | null;
}

export interface OwnedWeapon {
  name: string;
  tier: number;
}

export interface ShopView {
  wave: number;
  materials: number;
  offers: ShopOffer[];
  rerollCost: number;
  weapons: OwnedWeapon[];
  stats: Stats;
  /** Messages from merges that just happened. */
  notices: string[];
}

export const cssColor = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/**
 * Full-screen overlays (menu, level-up, shop, game over). One overlay at a
 * time; callers pass callbacks, screens hold no game state of their own.
 */
export class Screens {
  private readonly root: HTMLElement;
  /** Aborted whenever the overlay changes, dropping its key listeners. */
  private keys = new AbortController();

  constructor(parent: HTMLElement) {
    this.root = el('div', 'overlay');
    parent.appendChild(this.root);
  }

  hide(): void {
    this.keys.abort();
    this.root.replaceChildren();
    this.root.classList.remove('open');
  }

  private open(panel: HTMLElement): void {
    this.keys.abort();
    this.keys = new AbortController();
    this.root.replaceChildren(panel);
    this.root.classList.add('open');
  }

  menu(bestWave: number, onStart: () => void): void {
    const panel = el('div', 'panel menu');
    panel.append(el('h1', '', 'Brotato_Like'), el('p', 'sub', '小小竞技场射击游戏。武器自动开火，你只管走位。'));
    if (bestWave > 0) panel.append(el('p', 'best', `最佳纪录：第 ${bestWave} 波`));
    const start = button('开始游戏', onStart, 'primary');
    panel.append(start, el('p', 'hint', 'WASD / 方向键移动 · M 静音 · 回车开始'));
    this.open(panel);
    start.focus();
  }

  levelUp(level: number, remaining: number, options: Upgrade[], onPick: (u: Upgrade) => void): void {
    const panel = el('div', 'panel');
    panel.append(el('h2', '', `升到 ${level} 级！选择一项强化`));
    if (remaining > 1) panel.append(el('p', 'sub', `还有 ${remaining} 次升级待选`));
    const row = el('div', 'cards');
    options.forEach((u, i) => {
      const card = el('button', 'card');
      card.append(el('div', 'card-title', STAT_LABELS[u.stat]), el('div', 'card-line good', formatStatMod(u.stat, u.amount)));
      card.append(el('div', 'key', String(i + 1)));
      card.addEventListener('click', () => onPick(u));
      row.append(card);
    });
    panel.append(row, el('p', 'hint', '按数字键 1–4 快速选择'));
    this.open(panel);
    this.onNumberKey(options.length, (i) => onPick(options[i]));
  }

  shop(view: ShopView, onBuy: (i: number) => void, onReroll: () => void, onNext: () => void): void {
    const panel = el('div', 'panel shop');
    const header = el('div', 'shop-header');
    header.append(el('h2', '', `商店 · 第 ${view.wave + 1} 波之前`), el('div', 'materials big', `${view.materials}`));
    panel.append(header);

    for (const msg of view.notices) panel.append(el('div', 'notice', msg));

    const body = el('div', 'shop-body');
    const row = el('div', 'cards');
    view.offers.forEach((o, i) => row.append(this.offerCard(o, view.materials, () => onBuy(i))));
    body.append(row);
    body.append(this.sidePanel(view));
    panel.append(body);

    const footer = el('div', 'shop-footer');
    footer.append(el('p', 'hint merge-rule', `${MERGE_COUNT} 把同种同品质武器自动合成为更高品质`));
    const reroll = button(`刷新 (${view.rerollCost})`, onReroll);
    reroll.disabled = view.rerollCost > view.materials;
    const next = button('下一波', onNext, 'primary');
    footer.append(reroll, next);
    panel.append(footer);
    this.open(panel);
    next.focus();
  }

  private offerCard(o: ShopOffer, materials: number, onBuy: () => void): HTMLButtonElement {
    const card = el('button', `card ${o.kind}`);
    if (o.kind === 'weapon') {
      const tier = TIERS[o.tier - 1];
      card.style.borderColor = cssColor(tier.color);
      card.append(tierBadge(o.tier));
    } else {
      card.append(el('div', 'card-kind', '道具'));
    }
    const swatch = el('div', 'swatch');
    swatch.style.background = cssColor(o.color);
    const title = el('div', 'card-title', o.name);
    if (o.kind === 'weapon') title.style.color = cssColor(TIERS[o.tier - 1].color);
    card.prepend(swatch);
    card.append(title);
    for (const line of o.lines) card.append(el('div', `card-line ${line.includes('-') ? 'bad' : 'good'}`, line));
    if (o.mergeHint && !o.sold) card.append(el('div', 'merge-hint', o.mergeHint));

    const blocked = o.sold || o.price > materials || (o.kind === 'weapon' && !o.fits);
    const priceText = o.sold ? '已售出' : o.kind === 'weapon' && !o.fits ? '武器栏已满' : `${o.price}`;
    card.append(el('div', 'price', priceText));
    card.disabled = blocked;
    if (!blocked) card.addEventListener('click', onBuy);
    return card;
  }

  private sidePanel(view: ShopView): HTMLElement {
    const side = el('div', 'stats');
    side.append(el('h3', '', '属性'));
    for (const key of STAT_ORDER) {
      const line = el('div', 'stat');
      line.append(el('span', '', STAT_LABELS[key]), el('b', '', formatStatValue(key, view.stats[key])));
      side.append(line);
    }
    side.append(el('h3', '', `武器 (${view.weapons.length}/${MAX_WEAPONS})`));
    const list = el('div', 'weapon-list');
    for (const wpn of view.weapons) {
      const chip = el('span', 'weapon-chip', `${wpn.name} · ${TIERS[wpn.tier - 1].name}`);
      chip.style.borderColor = chip.style.color = cssColor(TIERS[wpn.tier - 1].color);
      list.append(chip);
    }
    side.append(list);
    return side;
  }

  /** Number keys 1..n pick the matching card while this overlay is open. */
  private onNumberKey(n: number, pick: (i: number) => void): void {
    window.addEventListener(
      'keydown',
      (e) => {
        const i = Number(e.key) - 1;
        if (i >= 0 && i < n) pick(i);
      },
      { signal: this.keys.signal },
    );
  }

  gameOver(won: boolean, wave: number, kills: number, onRestart: () => void): void {
    const panel = el('div', 'panel menu');
    panel.append(
      el('h1', won ? 'win' : 'lose', won ? '你活下来了！' : '游戏结束'),
      el('p', 'sub', `到达第 ${wave} 波 · 击杀 ${kills}`),
    );
    const again = button('再来一局', onRestart, 'primary');
    panel.append(again);
    this.open(panel);
    again.focus();
  }
}

function tierBadge(tier: number): HTMLElement {
  const t = TIERS[tier - 1];
  const badge = el('div', 'card-kind tier', `武器 · ${t.name}`);
  badge.style.color = cssColor(t.color);
  return badge;
}

function button(label: string, onClick: () => void, extra = ''): HTMLButtonElement {
  const b = el('button', `btn ${extra}`, label);
  b.addEventListener('click', onClick);
  return b;
}
