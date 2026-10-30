import {
  action,
  computed,
  makeObservable,
  observable,
  runInAction,
} from "mobx";
import type { Book } from "./Book";
import type { BooksRepository } from "./Books.repository";

export type BooksMode = "all" | "private";

interface Collection {
  readonly books: readonly Book[];
  readonly status: "idle" | "loading" | "success" | "error";
  readonly loaded: boolean;
  readonly error: string;
}

interface Request {
  readonly abort: AbortController;
  promise: Promise<boolean>;
}

function emptyCollection(): Collection {
  return { books: [], status: "idle", loaded: false, error: "" };
}

export class BooksStore {
  readonly collections: Record<BooksMode, Collection> = {
    all: emptyCollection(),
    private: emptyCollection(),
  };
  private readonly requests: Partial<Record<BooksMode, Request>> = {};
  private disposed = false;

  constructor(
    private readonly repository: Pick<
      BooksRepository,
      "getBooks" | "getPrivateBooks"
    >,
  ) {
    makeObservable(this, {
      collections: observable.shallow,
      privateCount: computed,
      refresh: action.bound,
      dispose: action.bound,
    });
  }

  get privateCount(): number | null {
    const collection = this.collections.private;
    return collection.loaded ? collection.books.length : null;
  }

  ensureLoaded(mode: BooksMode): Promise<boolean> {
    if (this.disposed) return Promise.resolve(false);
    const pending = this.requests[mode];
    if (pending) return pending.promise;
    if (this.collections[mode].status === "idle") return this.refresh(mode);
    return Promise.resolve(this.collections[mode].status === "success");
  }

  refresh(mode: BooksMode): Promise<boolean> {
    if (this.disposed) return Promise.resolve(false);
    this.requests[mode]?.abort.abort();
    const request: Request = {
      abort: new AbortController(),
      promise: Promise.resolve(false),
    };
    this.requests[mode] = request;
    this.collections[mode] = {
      ...this.collections[mode],
      status: "loading",
      error: "",
    };
    request.promise = this.fetchCollection(mode, request);
    return request.promise;
  }

  async refreshAll(): Promise<boolean> {
    const results = await Promise.all([
      this.refresh("all"),
      this.refresh("private"),
    ]);
    return results.every(Boolean);
  }

  private async fetchCollection(
    mode: BooksMode,
    request: Request,
  ): Promise<boolean> {
    try {
      const books = await (mode === "all"
        ? this.repository.getBooks(request.abort.signal)
        : this.repository.getPrivateBooks(request.abort.signal));
      if (this.disposed || this.requests[mode] !== request) return false;
      runInAction(() => {
        this.collections[mode] = {
          books,
          status: "success",
          loaded: true,
          error: "",
        };
      });
      return true;
    } catch {
      if (this.disposed || this.requests[mode] !== request) return false;
      runInAction(() => {
        this.collections[mode] = {
          ...this.collections[mode],
          status: "error",
          error: "Could not load books. Please try again.",
        };
      });
      return false;
    } finally {
      if (this.requests[mode] === request) delete this.requests[mode];
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.requests.all?.abort.abort();
    this.requests.private?.abort.abort();
    delete this.requests.all;
    delete this.requests.private;
  }
}
