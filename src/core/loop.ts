/**
 * Fixed-timestep game loop.
 *
 * Simulation always advances in constant `step` increments so gameplay is
 * deterministic and frame-rate independent. Rendering happens once per
 * animation frame and receives `alpha` (0..1) = how far we are between the
 * previous and the next simulation step, used for interpolation.
 */
export class FixedLoop {
  private acc = 0;
  private last = 0;
  private rafId = 0;
  private running = false;

  constructor(
    private readonly step: number,
    private readonly update: (dt: number) => void,
    private readonly render: (alpha: number) => void,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      // Clamp long frames (tab switch, breakpoint) to avoid a "spiral of death"
      const frame = Math.min((now - this.last) / 1000, 0.25);
      this.last = now;
      this.acc += frame;
      while (this.acc >= this.step) {
        this.update(this.step);
        this.acc -= this.step;
      }
      this.render(this.acc / this.step);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }
}
