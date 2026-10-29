import { action, computed, makeObservable, observable, runInAction } from "mobx";
import type { BooksRepository } from "./Books.repository";

interface BookRow {
  readonly key: string;
  readonly text: string;
}

export class BooksController {
  rows: readonly BookRow[] = [];
  status: "loading" | "success" | "error" = "loading";
  error = "";
  private requestId = 0;
  private pending?: AbortController;
  private disposed = false;

  constructor(private readonly repository: Pick<BooksRepository, "getBooks">) {
    makeObservable(this, {
      rows: observable.ref,
      status: observable,
      error: observable,
      loadingHidden: computed,
      errorHidden: computed,
      emptyHidden: computed,
      load: action.bound,
      dispose: action.bound,
    });
  }

  get loadingHidden(): boolean { return this.status !== "loading"; }
  get errorHidden(): boolean { return this.status !== "error"; }
  get emptyHidden(): boolean { return this.status !== "success" || this.rows.length !== 0; }

  async load(): Promise<void> {
    if (this.disposed) return;
    const requestId = ++this.requestId;
    this.pending?.abort();
    const pending = new AbortController();
    this.pending = pending;
    this.status = "loading";
    this.error = "";
    if (this.rows.length > 0) this.rows = [];

    try {
      const books = await this.repository.getBooks(pending.signal);
      if (this.disposed || requestId !== this.requestId) return;
      runInAction(() => {
        // Identity is local to this response: server IDs can be absent or duplicated.
        this.rows = books.map((book, index) => ({
          key: `${requestId}:${index}`,
          text: `${book.author}: ${book.name}`,
        }));
        this.status = "success";
      });
    } catch {
      if (this.disposed || requestId !== this.requestId) return;
      runInAction(() => {
        this.status = "error";
        this.error = "Could not load books. Please try again.";
      });
    } finally {
      if (requestId === this.requestId) this.pending = undefined;
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    ++this.requestId;
    this.pending?.abort();
    this.pending = undefined;
  }
}
