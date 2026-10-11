/**
 * Object pool. Hundreds of projectiles/enemies are created and destroyed per
 * second; recycling objects keeps the garbage collector from causing stutter.
 */
export class Pool<T> {
  private readonly free: T[] = [];

  constructor(private readonly create: () => T) {}

  acquire(): T {
    return this.free.pop() ?? this.create();
  }

  release(item: T): void {
    this.free.push(item);
  }
}

/** O(1) unordered removal: move the last element into slot `i`. */
export function swapRemove<T>(list: T[], i: number): T {
  const item = list[i];
  const last = list.pop()!;
  if (i < list.length) list[i] = last;
  return item;
}
