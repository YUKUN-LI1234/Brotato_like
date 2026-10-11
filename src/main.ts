import { Application } from 'pixi.js';
import { Game } from './game/game';
import './style.css';

async function main(): Promise<void> {
  const app = new Application();
  await app.init({
    background: 0x1d1c24,
    resizeTo: window,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
  });
  document.getElementById('stage')!.appendChild(app.canvas);
  const game = new Game(app, document.getElementById('ui')!);
  // Handy in the console: __game.debug.spawn(200), __game.debug.god()
  (window as unknown as { __game: Game }).__game = game;
}

main();
