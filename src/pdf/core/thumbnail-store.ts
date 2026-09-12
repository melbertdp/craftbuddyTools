interface ThumbnailEntry {
  url: string;
  lastUsed: number;
}

/**
 * LRU cache for thumbnail object URLs. Evicted entries have their blob URL
 * revoked so browsers can release the underlying memory.
 */
class ThumbnailStore {
  private entries = new Map<string, ThumbnailEntry>();
  private inflight = new Map<string, Promise<string>>();
  private readonly max: number;

  constructor(max = 300) {
    this.max = max;
  }

  async get(key: string, loader: () => Promise<Blob>): Promise<string> {
    const cached = this.entries.get(key);
    if (cached) {
      cached.lastUsed = Date.now();
      return cached.url;
    }
    const pending = this.inflight.get(key);
    if (pending) return pending;

    const promise = (async () => {
      const blob = await loader();
      const url = URL.createObjectURL(blob);
      this.entries.set(key, { url, lastUsed: Date.now() });
      this.inflight.delete(key);
      this.evict();
      return url;
    })();
    this.inflight.set(key, promise);
    try {
      return await promise;
    } catch (error) {
      this.inflight.delete(key);
      throw error;
    }
  }

  peek(key: string): string | undefined {
    const entry = this.entries.get(key);
    if (entry) entry.lastUsed = Date.now();
    return entry?.url;
  }

  private evict(): void {
    if (this.entries.size <= this.max) return;
    const sorted = [...this.entries.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    const removeCount = this.entries.size - this.max;
    for (let index = 0; index < removeCount; index += 1) {
      const [key, entry] = sorted[index];
      URL.revokeObjectURL(entry.url);
      this.entries.delete(key);
    }
  }

  dispose(key: string): void {
    const entry = this.entries.get(key);
    if (entry) {
      URL.revokeObjectURL(entry.url);
      this.entries.delete(key);
    }
  }

  clear(): void {
    for (const entry of this.entries.values()) URL.revokeObjectURL(entry.url);
    this.entries.clear();
    this.inflight.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}

export const thumbnailStore = new ThumbnailStore();

export function createObjectUrlTracker() {
  const urls = new Set<string>();
  return {
    create(blob: Blob): string {
      const url = URL.createObjectURL(blob);
      urls.add(url);
      return url;
    },
    revoke(url: string): void {
      if (urls.has(url)) {
        URL.revokeObjectURL(url);
        urls.delete(url);
      }
    },
    revokeAll(): void {
      for (const url of urls) URL.revokeObjectURL(url);
      urls.clear();
    },
  };
}
