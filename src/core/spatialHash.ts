/**
 * Uniform-grid spatial hash for broad-phase collision.
 *
 * Instead of testing every projectile against every enemy (O(n*m)), entities
 * are bucketed into square cells; a query only visits the cells overlapping
 * the search circle. Rebuilt every step because everything moves.
 */
export class SpatialHash<T extends { x: number; y: number }> {
  private readonly cells = new Map<number, T[]>();

  constructor(private readonly cellSize: number) {}

  private key(cx: number, cy: number): number {
    // Offset keeps negative cells (entities pushed outside the arena) unique
    return (cx + 1024) * 4096 + (cy + 1024);
  }

  clear(): void {
    // Reuse bucket arrays to avoid garbage every frame
    for (const bucket of this.cells.values()) bucket.length = 0;
  }

  insert(item: T): void {
    const k = this.key(Math.floor(item.x / this.cellSize), Math.floor(item.y / this.cellSize));
    let bucket = this.cells.get(k);
    if (!bucket) {
      bucket = [];
      this.cells.set(k, bucket);
    }
    bucket.push(item);
  }

  /** Candidates whose cell overlaps the circle; caller does the exact test. */
  query(x: number, y: number, radius: number, out: T[]): T[] {
    out.length = 0;
    const cs = this.cellSize;
    const x0 = Math.floor((x - radius) / cs);
    const x1 = Math.floor((x + radius) / cs);
    const y0 = Math.floor((y - radius) / cs);
    const y1 = Math.floor((y + radius) / cs);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const bucket = this.cells.get(this.key(cx, cy));
        if (bucket) for (const item of bucket) out.push(item);
      }
    }
    return out;
  }
}
