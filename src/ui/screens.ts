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
  /** Weapon class labels, e.g. "爆炸物". */
  tags: string[];
  lines: string[];
  color: number;
  sold: boolean;
  /** Affordable right now (counting the best recycle refund when needed). */
  canBuy: boolean;
  /** Weapon only: slots are full and it won't merge, so one must be recycled. */
  needsRecycle: boolean;
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

export interface RecycleOption {
  name: string;
  tier: number;
  refund: number;
  /** Not enough materials even with this refund. */
  disabled: boolean;
}

export interface RecycleView {
  offer: ShopOffer;
  materials: number;
  options: RecycleOption[];
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
    view.offers.forEach((o, i) => row.append(this.offerCard(o, () => onBuy(i))));
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

  private offerCard(o: ShopOffer, onBuy: () => void): HTMLButtonElement {
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
    if (o.tags.length > 0) {
      const tags = el('div', 'card-tags');
      for (const tag of o.tags) tags.append(el('span', 'tag-chip', tag));
      card.append(tags);
    }
    for (const line of o.lines) card.append(el('div', `card-line ${line.includes('-') ? 'bad' : 'good'}`, line));
    if (o.mergeHint && !o.sold) card.append(el('div', 'merge-hint', o.mergeHint));

    if (o.needsRecycle && !o.sold) card.append(el('div', 'recycle-hint', '武器栏已满 · 需回收一把'));

    const blocked = o.sold || !o.canBuy;
    card.append(el('div', 'price', o.sold ? '已售出' : `${o.price}`));
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

  /**
   * Modal over the shop: pick which owned weapon to recycle for 1/3 of its
   * price so the new one fits. Escape or "取消" closes it.
   */
  recycleDialog(view: RecycleView, onPick: (i: number) => void, onCancel: () => void): void {
    const backdrop = el('div', 'modal-backdrop');
    const modal = el('div', 'panel modal');
    const t = TIERS[view.offer.tier - 1];
    const title = el('h2', '', '武器栏已满');
    const sub = el('p', 'sub');
    sub.append('选择一把武器回收（按当前价格的 1/3 返还材料），以购买 ');
    const name = el('b', '', `${t.name}${view.offer.name}`);
    name.style.color = cssColor(t.color);
    sub.append(name, `（${view.offer.price}）。当前材料：${view.materials}`);
    modal.append(title, sub);

    const list = el('div', 'recycle-list');
    view.options.forEach((o, i) => {
      const tier = TIERS[o.tier - 1];
      const row = el('button', 'recycle-row');
      row.style.borderColor = cssColor(tier.color);
      const label = el('span', 'recycle-name', `${o.name} · ${tier.name}`);
      label.style.color = cssColor(tier.color);
      row.append(label, el('span', 'recycle-refund', `+${o.refund}`));
      row.disabled = o.disabled;
      if (!o.disabled) row.addEventListener('click', () => onPick(i));
      list.append(row);
    });
    modal.append(list);

    const cancel = button('取消', onCancel);
    const footer = el('div', 'shop-footer');
    footer.append(cancel);
    modal.append(footer);
    backdrop.append(modal);
    this.root.append(backdrop);
    cancel.focus();
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape') onCancel();
      },
      { signal: this.keys.signal },
    );
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

  pause(wave: number, secondsLeft: number, onResume: () => void, onRestart: () => void, onMenu: () => void): void {
    const panel = el('div', 'panel menu');
    panel.append(el('h1', '', '已暂停'), el('p', 'sub', `第 ${wave} 波 · 剩余 ${secondsLeft} 秒`));
    const resume = button('继续游戏', onResume, 'primary');
    const actions = el('div', 'pause-actions');
    actions.append(resume, button('重新开始', onRestart), button('返回主菜单', onMenu));
    panel.append(actions, el('p', 'hint', 'Esc / P 继续'));
    this.open(panel);
    resume.focus();
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
