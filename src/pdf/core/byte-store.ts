const byteStore = new Map<string, Uint8Array>();

let counter = 0;
export function newId(prefix = "id"): string {
  counter += 1;
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}_${random}`;
}

/**
 * In-memory registry for original document bytes. Kept outside React/Zustand
 * state so large buffers are never copied or persisted. Nothing here touches
 * localStorage, IndexedDB, or the network.
 */
export const pdfByteStore = {
  set(id: string, bytes: Uint8Array): void {
    byteStore.set(id, bytes);
  },
  get(id: string): Uint8Array | undefined {
    return byteStore.get(id);
  },
  has(id: string): boolean {
    return byteStore.has(id);
  },
  delete(id: string): void {
    byteStore.delete(id);
  },
  clear(): void {
    byteStore.clear();
  },
  size(): number {
    return byteStore.size;
  },
};
