import { formatStatMod, formatStatValue, STAT_LABELS, STAT_ORDER, type Stats } from '../data/stats';
import type { Upgrade } from '../data/upgrades';
import { el } from './hud';

export interface ShopOffer {
  kind: 'weapon' | 'item';
  id: string;
  name: string;
  price: number;
  lines: string[];
  color: number;
  sold: boolean;
}

export interface ShopView {
  wave: number;
  materials: number;
  offers: ShopOffer[];
  rerollCost: number;
  weapons: string[];
  weaponSlotsFull: boolean;
  stats: Stats;
}

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
    panel.append(
      el('h1', '', 'Brotato_Like'),
      el('p', 'sub', 'A tiny arena shooter. Weapons fire on their own — you just move.'),
    );
    if (bestWave > 0) panel.append(el('p', 'best', `Best: wave ${bestWave}`));
    const start = button('Start', onStart, 'primary');
    panel.append(start, el('p', 'hint', 'WASD / Arrow keys to move · Enter to start'));
    this.open(panel);
    start.focus();
  }

  levelUp(level: number, remaining: number, options: Upgrade[], onPick: (u: Upgrade) => void): void {
    const panel = el('div', 'panel');
    panel.append(el('h2', '', `Level ${level}!`));
    if (remaining > 1) panel.append(el('p', 'sub', `${remaining} level-ups to spend`));
    const row = el('div', 'cards');
    options.forEach((u, i) => {
      const card = el('button', 'card');
      card.append(el('div', 'card-title', STAT_LABELS[u.stat]), el('div', 'card-line good', formatStatMod(u.stat, u.amount)));
      card.append(el('div', 'key', String(i + 1)));
      card.addEventListener('click', () => onPick(u));
      row.append(card);
    });
    panel.append(row);
    this.open(panel);
    this.onNumberKey(options.length, (i) => onPick(options[i]));
  }

  shop(view: ShopView, onBuy: (i: number) => void, onReroll: () => void, onNext: () => void): void {
    const panel = el('div', 'panel shop');
    const header = el('div', 'shop-header');
    header.append(el('h2', '', `Shop · before wave ${view.wave + 1}`), el('div', 'materials big', `${view.materials}`));
    panel.append(header);

    const body = el('div', 'shop-body');
    const row = el('div', 'cards');
    view.offers.forEach((o, i) => {
      const card = el('button', `card ${o.kind}`);
      const swatch = el('div', 'swatch');
      swatch.style.background = `#${o.color.toString(16).padStart(6, '0')}`;
      card.append(swatch, el('div', 'card-kind', o.kind === 'weapon' ? 'Weapon' : 'Item'), el('div', 'card-title', o.name));
      for (const line of o.lines) card.append(el('div', `card-line ${line.startsWith('-') ? 'bad' : 'good'}`, line));
      const blocked = o.sold || o.price > view.materials || (o.kind === 'weapon' && view.weaponSlotsFull);
      card.append(el('div', 'price', o.sold ? 'Sold' : `${o.price}`));
      card.disabled = blocked;
      if (!blocked) card.addEventListener('click', () => onBuy(i));
      row.append(card);
    });
    body.append(row);

    const side = el('div', 'stats');
    side.append(el('h3', '', 'Stats'));
    for (const key of STAT_ORDER) {
      const line = el('div', 'stat');
      line.append(el('span', '', STAT_LABELS[key]), el('b', '', formatStatValue(key, view.stats[key])));
      side.append(line);
    }
    side.append(el('h3', '', `Weapons (${view.weapons.length}/6)`), el('div', 'weapons', view.weapons.join(', ')));
    body.append(side);
    panel.append(body);

    const footer = el('div', 'shop-footer');
    const reroll = button(`Reroll (${view.rerollCost})`, onReroll);
    reroll.disabled = view.rerollCost > view.materials;
    const next = button('Next wave', onNext, 'primary');
    footer.append(reroll, next);
    panel.append(footer);
    this.open(panel);
    next.focus();
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
      el('h1', won ? 'win' : 'lose', won ? 'You survived!' : 'Run over'),
      el('p', 'sub', `Reached wave ${wave} · ${kills} kills`),
    );
    const again = button('Play again', onRestart, 'primary');
    panel.append(again);
    this.open(panel);
    again.focus();
  }
}

function button(label: string, onClick: () => void, extra = ''): HTMLButtonElement {
  const b = el('button', `btn ${extra}`, label);
  b.addEventListener('click', onClick);
  return b;
}
