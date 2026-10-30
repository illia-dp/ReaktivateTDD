import { action, computed, makeObservable } from "mobx";
import type { BooksStore } from "../Books/Books.store";

export class HeaderController {
  private disposed = false;

  constructor(private readonly store: BooksStore) {
    makeObservable(this, {
      countLabel: computed,
      retryHidden: computed,
      retry: action.bound,
    });
  }

  get countLabel(): string {
    const count = this.store.privateCount;
    const status = this.store.collections.private.status;
    if (status === "error") {
      return count === null
        ? "Your books: unavailable"
        : `Your books: ${count} (last known count)`;
    }
    if (status === "idle" || status === "loading") {
      return count === null
        ? "Your books: loading…"
        : `Your books: ${count} (updating…)`;
    }
    return `Your books: ${count}`;
  }
  get retryHidden(): boolean {
    return this.store.collections.private.status !== "error";
  }

  async retry(): Promise<void> {
    if (!this.disposed) await this.store.refresh("private");
  }

  dispose(): void {
    this.disposed = true;
  }
}
