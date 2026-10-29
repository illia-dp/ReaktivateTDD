import { autorun } from "mobx";
import { expect, test, vi } from "vitest";
import type { Book } from "./Book";
import { BooksController } from "./Books.controller";

function deferred() {
  let resolve!: (books: Book[]) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Book[]>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const book: Book = { name: "The Hobbit", author: "Jrr Tolkein" };

test("starts in loading state and loads duplicate and unidentified books", async () => {
  const pending = deferred();
  const getBooks = vi.fn().mockReturnValue(pending.promise);
  const controller = new BooksController({ getBooks });
  expect(controller.status).toBe("loading");
  expect(controller.loadingHidden).toBe(false);
  expect(getBooks).not.toHaveBeenCalled();
  const request = controller.load();
  expect(controller.rows).toEqual([]);
  pending.resolve([book, book, { ...book, id: 1 }, { ...book, id: 1 }]);
  await request;
  expect(controller.status).toBe("success");
  expect(controller.loadingHidden).toBe(true);
  expect(controller.emptyHidden).toBe(true);
  expect(controller.rows.map(row => row.text)).toEqual(Array(4).fill("Jrr Tolkein: The Hobbit"));
  expect(new Set(controller.rows.map(row => row.key)).size).toBe(4);
  controller.dispose();
});

test("failure supplies display state and retry clears it before succeeding", async () => {
  const retry = deferred();
  const getBooks = vi.fn().mockRejectedValueOnce(new Error("HTTP 500"))
    .mockReturnValueOnce(retry.promise);
  const controller = new BooksController({ getBooks });
  await controller.load();
  expect(controller.status).toBe("error");
  expect(controller.errorHidden).toBe(false);
  expect(controller.error).toBe("Could not load books. Please try again.");
  const request = controller.load();
  expect(controller.status).toBe("loading");
  expect(controller.error).toBe("");
  expect(controller.errorHidden).toBe(true);
  retry.resolve([]);
  await request;
  expect(controller.emptyHidden).toBe(false);
  expect(getBooks).toHaveBeenCalledTimes(2);
  controller.dispose();
});

test.each(["success", "failure"])("late %s cannot overwrite the latest result", async (outcome) => {
  const old = deferred();
  const latest = deferred();
  const getBooks = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
  const controller = new BooksController({ getBooks });
  const first = controller.load();
  const signal: AbortSignal = getBooks.mock.calls[0][0];
  const second = controller.load();
  expect(signal.aborted).toBe(true);
  latest.resolve([book]);
  await second;
  const rows = controller.rows;
  if (outcome === "success") old.resolve([]);
  else old.reject(new Error("stale failure"));
  await first;
  expect(controller.status).toBe("success");
  expect(controller.rows).toBe(rows);
  expect(controller.error).toBe("");
  controller.dispose();
});

test("stale completion does not clear a newer loading state or its cancellation handle", async () => {
  const old = deferred();
  const latest = deferred();
  const getBooks = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
  const controller = new BooksController({ getBooks });
  const first = controller.load();
  const second = controller.load();
  old.resolve([book]);
  await first;
  expect(controller.status).toBe("loading");
  expect(controller.rows).toEqual([]);
  controller.dispose();
  expect(getBooks.mock.calls[1][0].aborted).toBe(true);
  latest.resolve([book]);
  await second;
});

test.each(["success", "failure"])("disposal ignores pending %s and prevents further requests", async (outcome) => {
  const pending = deferred();
  const getBooks = vi.fn().mockReturnValue(pending.promise);
  const controller = new BooksController({ getBooks });
  const states: string[] = [];
  const stop = autorun(() => states.push(`${controller.status}:${controller.rows.length}:${controller.error}`));
  const request = controller.load();
  controller.dispose();
  controller.dispose();
  expect(getBooks.mock.calls[0][0].aborted).toBe(true);
  const before = [...states];
  if (outcome === "success") pending.resolve([book]);
  else pending.reject(new Error("late rejection"));
  await request;
  await controller.load();
  expect(states).toEqual(before);
  expect(getBooks).toHaveBeenCalledTimes(1);
  stop();
});

test("observable success updates rows and status atomically", async () => {
  const controller = new BooksController({ getBooks: vi.fn().mockResolvedValue([book]) });
  const states: string[] = [];
  const stop = autorun(() => states.push(`${controller.status}:${controller.rows.length}`));
  await controller.load();
  expect(states).toEqual(["loading:0", "success:1"]);
  stop();
  controller.dispose();
});
