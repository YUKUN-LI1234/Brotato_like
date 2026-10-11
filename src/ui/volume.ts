import type { AudioEngine, VolumeKind } from '../audio/audio';
import { el } from './hud';

/**
 * Speaker button in the top-right corner. Clicking it opens a small panel
 * with music / sound-effect sliders and a mute switch. It lives above the
 * overlays so it works in menus and the shop too.
 */
export class VolumeControl {
  private readonly root: HTMLElement;
  private readonly icon: HTMLButtonElement;
  private readonly panel: HTMLElement;
  private readonly muteBox: HTMLInputElement;
  private readonly sliders = new Map<VolumeKind, { input: HTMLInputElement; value: HTMLElement }>();

  constructor(
    parent: HTMLElement,
    private readonly audio: AudioEngine,
  ) {
    this.root = el('div', 'volume');
    this.icon = el('button', 'volume-icon');
    this.icon.title = '音量';
    this.icon.addEventListener('click', () => this.toggleOpen());

    this.panel = el('div', 'volume-panel');
    this.panel.append(this.slider('music', '音乐'), this.slider('sfx', '音效'));

    const muteRow = el('label', 'volume-row mute-row');
    this.muteBox = el('input');
    this.muteBox.type = 'checkbox';
    this.muteBox.addEventListener('change', () => {
      if (this.muteBox.checked !== this.audio.muted) this.audio.toggleMute();
      this.refresh();
    });
    muteRow.append(this.muteBox, el('span', '', '静音 (M)'));
    this.panel.append(muteRow);

    this.root.append(this.icon, this.panel);
    parent.appendChild(this.root);

    // Close when clicking anywhere else
    document.addEventListener('pointerdown', (e) => {
      if (!this.root.contains(e.target as Node)) this.root.classList.remove('open');
    });
    this.refresh();
  }

  /** Call after the mute state changes elsewhere (M key). */
  refresh(): void {
    const s = this.audio.settings;
    const silent = s.muted || (s.music === 0 && s.sfx === 0);
    this.icon.textContent = silent ? '🔇' : s.music + s.sfx < 0.8 ? '🔉' : '🔊';
    this.icon.classList.toggle('off', silent);
    this.muteBox.checked = s.muted;
    for (const [kind, { input, value }] of this.sliders) {
      const pct = Math.round(s[kind] * 100);
      input.value = String(pct);
      input.style.setProperty('--pct', `${pct}%`);
      value.textContent = String(pct);
    }
  }

  private toggleOpen(): void {
    this.root.classList.toggle('open');
    this.icon.blur();
  }

  private slider(kind: VolumeKind, label: string): HTMLElement {
    const row = el('label', 'volume-row');
    const input = el('input');
    input.type = 'range';
    input.min = '0';
    input.max = '100';
    input.step = '1';
    const value = el('span', 'volume-value');
    input.addEventListener('input', () => {
      this.audio.setVolume(kind, Number(input.value) / 100);
      this.refresh();
    });
    // Arrow keys also move the player; give focus back to the game
    input.addEventListener('change', () => input.blur());
    this.sliders.set(kind, { input, value });
    row.append(el('span', 'volume-label', label), input, value);
    return row;
  }
}
