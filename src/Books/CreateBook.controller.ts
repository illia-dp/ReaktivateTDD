import {
  action,
  computed,
  makeObservable,
  observable,
  runInAction,
} from "mobx";
import type { BooksRepository } from "./Books.repository";

export class CreateBookController {
  name = "";
  author = "";
  pending = false;
  error = "";
  success = "";
  private disposed = false;
  private request?: AbortController;

  constructor(
    private readonly repository: Pick<BooksRepository, "createBook">,
    private readonly refreshBooks: () => Promise<boolean>,
  ) {
    makeObservable(this, {
      name: observable,
      author: observable,
      pending: observable,
      error: observable,
      success: observable,
      errorHidden: computed,
      successHidden: computed,
      submitLabel: computed,
      setName: action.bound,
      setAuthor: action.bound,
      submit: action.bound,
    });
  }

  get errorHidden(): boolean {
    return this.error === "";
  }
  get successHidden(): boolean {
    return this.success === "";
  }
  get submitLabel(): string {
    return this.pending ? "Saving…" : "Add book";
  }

  setName(value: string): void {
    if (this.disposed || this.pending) return;
    this.name = value;
    this.error = "";
    this.success = "";
  }
  setAuthor(value: string): void {
    if (this.disposed || this.pending) return;
    this.author = value;
    this.error = "";
    this.success = "";
  }

  async submit(event?: { preventDefault(): void }): Promise<void> {
    event?.preventDefault();
    if (this.disposed || this.pending) return;
    const input = { name: this.name.trim(), author: this.author.trim() };
    this.error = "";
    this.success = "";
    if (!input.name || !input.author) {
      this.error = "Enter both a book name and an author.";
      return;
    }
    this.pending = true;
    const request = new AbortController();
    this.request = request;
    try {
      await this.repository.createBook(input, request.signal);
      if (this.disposed) return;
      runInAction(() => {
        this.name = "";
        this.author = "";
        this.success = "Book created.";
      });

      const refreshed = await this.refreshBooks().catch(() => false);
      if (this.disposed) return;
      if (!refreshed) {
        runInAction(() => {
          this.success =
            "Book created. Some books could not be refreshed; use Retry to reload them.";
        });
      }
    } catch {
      if (this.disposed) return;
      runInAction(() => {
        this.error =
          "Creation was not confirmed. Your input is unchanged. Check the books before trying again.";
      });
    } finally {
      this.request = undefined;
      if (!this.disposed) {
        runInAction(() => {
          this.pending = false;
        });
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    this.request?.abort();
    this.request = undefined;
  }
}
