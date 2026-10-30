import { action, computed, makeObservable, observable } from "mobx";
import { BooksStore, type BooksMode } from "./Books.store";

export class BooksController {
  mode: BooksMode = "all";
  private disposed = false;

  constructor(private readonly store: BooksStore) {
    makeObservable(this, {
      mode: observable,
      rows: computed,
      status: computed,
      error: computed,
      loadingHidden: computed,
      errorHidden: computed,
      emptyHidden: computed,
      allSelected: computed,
      privateSelected: computed,
      selectAll: action.bound,
      selectPrivate: action.bound,
      load: action.bound,
    });
  }

  get rows() {
    const collection = this.store.collections[this.mode];
    return collection.books.map((book, index) => ({
      key: `${this.mode}:${index}`,
      text: `${book.author}: ${book.name}`,
    }));
  }
  get status() {
    return this.store.collections[this.mode].status;
  }
  get error(): string {
    return this.store.collections[this.mode].error;
  }
  get loadingHidden(): boolean {
    return this.status !== "idle" && this.status !== "loading";
  }
  get errorHidden(): boolean {
    return this.status !== "error";
  }
  get emptyHidden(): boolean {
    return this.status !== "success" || this.rows.length !== 0;
  }
  get allSelected(): boolean {
    return this.mode === "all";
  }
  get privateSelected(): boolean {
    return this.mode === "private";
  }

  selectAll(): void {
    this.selectMode("all");
  }
  selectPrivate(): void {
    this.selectMode("private");
  }

  private selectMode(mode: BooksMode): void {
    if (this.disposed) return;
    this.mode = mode;
    void this.store.ensureLoaded(mode);
  }

  async load(): Promise<void> {
    if (!this.disposed) await this.store.refresh(this.mode);
  }

  dispose(): void {
    this.disposed = true;
  }
}
