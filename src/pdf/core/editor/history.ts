export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export class History<T> {
  private past: T[] = [];
  private present: T;
  private future: T[] = [];
  private readonly limit: number;

  constructor(initial: T, limit = 100) {
    this.present = initial;
    this.limit = limit;
  }

  get current(): T {
    return this.present;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  reset(value: T): void {
    this.past = [];
    this.future = [];
    this.present = value;
  }

  commit(value: T): void {
    if (value === this.present) return;
    this.past.push(this.present);
    if (this.past.length > this.limit) this.past.shift();
    this.present = value;
    this.future = [];
  }

  undo(): T {
    const previous = this.past.pop();
    if (previous === undefined) return this.present;
    this.future.unshift(this.present);
    this.present = previous;
    return this.present;
  }

  redo(): T {
    const next = this.future.shift();
    if (next === undefined) return this.present;
    this.past.push(this.present);
    this.present = next;
    return this.present;
  }

  snapshot(): HistoryState<T> {
    return { past: [...this.past], present: this.present, future: [...this.future] };
  }
}
