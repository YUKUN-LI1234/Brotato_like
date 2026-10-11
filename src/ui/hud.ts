import { xpToNext } from '../data/waves';
import { maxHpOf, type World } from '../game/world';

/** DOM heads-up display. Only touches the DOM when a value changes. */
export class Hud {
  private readonly root: HTMLElement;
  private readonly hpFill: HTMLElement;
  private readonly hpText: HTMLElement;
  private readonly xpFill: HTMLElement;
  private readonly xpText: HTMLElement;
  private readonly materials: HTMLElement;
  private readonly wave: HTMLElement;
  private readonly timer: HTMLElement;
  private readonly cache = new Map<HTMLElement, string>();
  private readonly muteBtn: HTMLButtonElement;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'hud');
    this.root.innerHTML = `
      <div class="hud-left">
        <div class="bar hp"><div class="fill"></div><span></span></div>
        <div class="bar xp"><div class="fill"></div><span></span></div>
        <div class="materials"><i></i><span></span></div>
      </div>
      <div class="hud-center">
        <div class="wave"></div>
        <div class="timer"></div>
      </div>
      <button class="mute" title="Mute (M)"></button>`;
    parent.appendChild(this.root);
    const q = (s: string) => this.root.querySelector(s) as HTMLElement;
    this.hpFill = q('.hp .fill');
    this.hpText = q('.hp span');
    this.xpFill = q('.xp .fill');
    this.xpText = q('.xp span');
    this.materials = q('.materials span');
    this.wave = q('.wave');
    this.timer = q('.timer');
    this.muteBtn = q('.mute') as HTMLButtonElement;
  }

  onToggleMute(handler: () => void): void {
    this.muteBtn.addEventListener('click', () => {
      handler();
      this.muteBtn.blur();
    });
  }

  setMuted(muted: boolean): void {
    this.muteBtn.textContent = muted ? 'Sound: off (M)' : 'Sound: on (M)';
    this.muteBtn.classList.toggle('off', muted);
  }

  show(visible: boolean): void {
    this.root.style.display = visible ? '' : 'none';
  }

  update(w: World): void {
    const p = w.player;
    const max = maxHpOf(p);
    const need = xpToNext(p.level);
    const remaining = Math.max(0, Math.ceil(w.waveDuration - w.waveTime));
    this.set(this.hpText, `${Math.ceil(p.hp)} / ${max}`);
    this.setWidth(this.hpFill, p.hp / max);
    this.set(this.xpText, `LV ${p.level}`);
    this.setWidth(this.xpFill, p.xp / need);
    this.set(this.materials, String(p.materials));
    this.set(this.wave, `WAVE ${w.wave}`);
    this.set(this.timer, String(remaining));
    this.timer.classList.toggle('urgent', remaining <= 5);
  }

  private set(node: HTMLElement, text: string): void {
    if (this.cache.get(node) === text) return;
    this.cache.set(node, text);
    node.textContent = text;
  }

  private setWidth(node: HTMLElement, ratio: number): void {
    const v = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
    if (node.style.width !== v) node.style.width = v;
  }
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text = '',
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
