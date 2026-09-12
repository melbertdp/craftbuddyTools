export class Semaphore {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly max: number) {
    if (max < 1) throw new Error("Semaphore requires a positive limit.");
  }

  private acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active += 1;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.queue.push(() => {
        this.active += 1;
        resolve();
      });
    });
  }

  private release(): void {
    this.active -= 1;
    const next = this.queue.shift();
    if (next) next();
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  get activeCount(): number {
    return this.active;
  }

  get pendingCount(): number {
    return this.queue.length;
  }
}

/** Chunk an array into batches, yielding to the event loop between batches. */
export async function processInChunks<T, R>(
  items: readonly T[],
  size: number,
  handler: (item: T, index: number) => Promise<R> | R,
  onProgress?: (completed: number, total: number) => void,
): Promise<R[]> {
  const results: R[] = [];
  for (let start = 0; start < items.length; start += size) {
    const slice = items.slice(start, start + size);
    const batch = await Promise.all(slice.map((item, offset) => handler(item, start + offset)));
    results.push(...batch);
    onProgress?.(Math.min(start + size, items.length), items.length);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return results;
}
