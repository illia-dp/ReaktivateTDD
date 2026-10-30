import { autorun, configure } from "mobx";
import { expect, test, vi } from "vitest";
import type { Book } from "./Book";
import { BooksController } from "./Books.controller";
import { BooksStore } from "./Books.store";
import { HeaderController } from "../Header/Header.controller";
import { deferred } from "../test/deferred";

configure({ enforceActions: "always" });
const book: Book = { name: "The Hobbit", author: "Jrr Tolkein" };

function setup(
  getBooks = vi.fn().mockResolvedValue([book]),
  getPrivateBooks = vi.fn().mockResolvedValue([]),
) {
  const store = new BooksStore({ getBooks, getPrivateBooks });
  const controller = new BooksController(store);
  const header = new HeaderController(store);
  return {
    store,
    controller,
    header,
    getBooks,
    getPrivateBooks,
    dispose() {
      controller.dispose();
      header.dispose();
      store.dispose();
    },
  };
}

test("initial state is loading to the view; success preserves duplicates without identifiers", async () => {
  const pending = deferred<Book[]>();
  const { controller, getBooks, dispose } = setup(
    vi.fn().mockReturnValue(pending.promise),
  );
  expect(controller.loadingHidden).toBe(false);
  expect(getBooks).not.toHaveBeenCalled();
  const request = controller.load();
  expect(controller.status).toBe("loading");
  expect(controller.rows).toEqual([]);
  pending.resolve([book, book, book, book]);
  await request;
  expect(controller.status).toBe("success");
  expect(controller.loadingHidden).toBe(true);
  expect(controller.emptyHidden).toBe(true);
  expect(controller.rows.map((row) => row.text)).toEqual(
    Array(4).fill("Jrr Tolkein: The Hobbit"),
  );
  expect(new Set(controller.rows.map((row) => row.key)).size).toBe(4);
  dispose();
});

test("failure supplies error state and retry clears it before succeeding", async () => {
  const retry = deferred<Book[]>();
  const { controller, getBooks, dispose } = setup(
    vi
      .fn()
      .mockRejectedValueOnce(new Error("HTTP 500"))
      .mockReturnValueOnce(retry.promise),
  );
  await controller.load();
  expect(controller.status).toBe("error");
  expect(controller.errorHidden).toBe(false);
  expect(controller.error).toBe("Could not load books. Please try again.");
  const request = controller.load();
  expect(controller.error).toBe("");
  expect(controller.loadingHidden).toBe(false);
  retry.resolve([]);
  await request;
  expect(controller.emptyHidden).toBe(false);
  expect(getBooks).toHaveBeenCalledTimes(2);
  dispose();
});

test.each(["success", "failure"])(
  "late %s cannot overwrite the latest collection",
  async (outcome) => {
    const old = deferred<Book[]>();
    const latest = deferred<Book[]>();
    const { controller, store, getBooks, dispose } = setup(
      vi
        .fn()
        .mockReturnValueOnce(old.promise)
        .mockReturnValueOnce(latest.promise),
    );
    const first = controller.load();
    const signal: AbortSignal = getBooks.mock.calls[0][0];
    const second = controller.load();
    expect(signal.aborted).toBe(true);
    latest.resolve([book]);
    await second;
    const snapshot = store.collections.all;
    if (outcome === "success") old.resolve([]);
    else old.reject(new Error("stale failure"));
    await first;
    expect(store.collections.all).toBe(snapshot);
    expect(controller.status).toBe("success");
    expect(controller.error).toBe("");
    dispose();
  },
);

test("stale completion cannot clear newer loading state or cancellation handle", async () => {
  const old = deferred<Book[]>();
  const latest = deferred<Book[]>();
  const { controller, getBooks, dispose } = setup(
    vi
      .fn()
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(latest.promise),
  );
  const first = controller.load();
  const second = controller.load();
  old.resolve([book]);
  await first;
  expect(controller.status).toBe("loading");
  expect(controller.rows).toEqual([]);
  dispose();
  expect(getBooks.mock.calls[1][0].aborted).toBe(true);
  latest.resolve([book]);
  await second;
});

test.each(["success", "failure"])(
  "owner disposal ignores pending %s and blocks further work",
  async (outcome) => {
    const pending = deferred<Book[]>();
    const privatePending = deferred<Book[]>();
    const { store, controller, header, getBooks, getPrivateBooks, dispose } =
      setup(
        vi.fn().mockReturnValue(pending.promise),
        vi.fn().mockReturnValue(privatePending.promise),
      );
    const states: string[] = [];
    const stop = autorun(() =>
      states.push(
        `${controller.status}:${controller.rows.length}:${header.countLabel}`,
      ),
    );
    const request = controller.load();
    const privateRequest = store.ensureLoaded("private");
    dispose();
    dispose();
    expect(getBooks.mock.calls[0][0].aborted).toBe(true);
    expect(getPrivateBooks.mock.calls[0][0].aborted).toBe(true);
    const before = [...states];
    if (outcome === "success") pending.resolve([book]);
    else pending.reject(new Error("late rejection"));
    privatePending.resolve([book]);
    await Promise.all([request, privateRequest]);
    await controller.load();
    await header.retry();
    await store.ensureLoaded("private");
    controller.selectPrivate();
    expect(controller.mode).toBe("all");
    expect(states).toEqual(before);
    expect(getBooks).toHaveBeenCalledTimes(1);
    expect(getPrivateBooks).toHaveBeenCalledTimes(1);
    stop();
  },
);

test("observable completion updates rows and status atomically", async () => {
  const { controller, dispose } = setup();
  const states: string[] = [];
  const stop = autorun(() =>
    states.push(`${controller.status}:${controller.rows.length}`),
  );
  await controller.load();
  expect(states).toEqual(["idle:0", "loading:0", "success:1"]);
  stop();
  dispose();
});

test("rapid mode changes share pending requests and show only the selected server collection", async () => {
  const all = deferred<Book[]>();
  const mine = deferred<Book[]>();
  const { store, controller, header, getBooks, getPrivateBooks, dispose } =
    setup(
      vi.fn().mockReturnValue(all.promise),
      vi.fn().mockReturnValue(mine.promise),
    );
  const initial = store.ensureLoaded("all");
  const count = store.ensureLoaded("private");
  expect(store.ensureLoaded("private")).toBe(count);
  controller.selectPrivate();
  controller.selectAll();
  controller.selectPrivate();
  expect(controller.allSelected).toBe(false);
  expect(controller.privateSelected).toBe(true);
  expect(header.countLabel).toBe("Your books: loading…");
  all.resolve([book]);
  await initial;
  expect(controller.rows).toEqual([]);
  const privateBook = {
    name: "Private",
    author: "Author",
  };
  mine.resolve([privateBook, privateBook]);
  await count;
  expect(controller.rows.map((row) => row.text)).toEqual([
    "Author: Private",
    "Author: Private",
  ]);
  expect(header.countLabel).toBe("Your books: 2");
  controller.selectAll();
  expect(controller.rows[0].text).toBe("Jrr Tolkein: The Hobbit");
  expect(header.countLabel).toBe("Your books: 2");
  expect(getBooks).toHaveBeenCalledTimes(1);
  expect(getPrivateBooks).toHaveBeenCalledTimes(1);
  dispose();
});

test("private errors do not erase the all collection; header retry shares data with Private mode", async () => {
  const { store, controller, header, getPrivateBooks, dispose } = setup(
    undefined,
    vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce([]),
  );
  await store.refreshAll();
  expect(controller.status).toBe("success");
  expect(header.countLabel).toBe("Your books: unavailable");
  expect(header.retryHidden).toBe(false);
  controller.selectPrivate();
  expect(controller.status).toBe("error");
  await header.retry();
  expect(controller.emptyHidden).toBe(false);
  expect(header.countLabel).toBe("Your books: 0");
  expect(getPrivateBooks).toHaveBeenCalledTimes(2);
  dispose();
});

test("failed refresh keeps last-known data and flags the header count as stale", async () => {
  const { store, header, dispose } = setup(
    undefined,
    vi
      .fn()
      .mockResolvedValueOnce([book])
      .mockRejectedValueOnce(new Error("offline")),
  );
  await store.refreshAll();
  const refresh = store.refresh("private");
  expect(header.countLabel).toBe("Your books: 1 (updating…)");
  await refresh;
  expect(store.collections.private.books).toEqual([book]);
  expect(header.countLabel).toBe("Your books: 1 (last known count)");
  expect(header.retryHidden).toBe(false);
  dispose();
});

test("reloading All does not notify a header observer", async () => {
  const { store, header, dispose } = setup();
  await store.refreshAll();
  const labels: string[] = [];
  const stop = autorun(() => labels.push(header.countLabel));
  await store.refresh("all");
  expect(labels).toEqual(["Your books: 0"]);
  stop();
  dispose();
});
