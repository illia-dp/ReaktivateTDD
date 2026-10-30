import { autorun, configure } from "mobx";
import { expect, test, vi } from "vitest";
import { CreateBookController } from "./CreateBook.controller";
import { createApplication } from "../createApplication";
import type { Book } from "./Book";
import { deferred } from "../test/deferred";

configure({ enforceActions: "always" });

function setup(
  createBook = vi.fn().mockResolvedValue(undefined),
  refresh = vi.fn().mockResolvedValue(true),
) {
  const controller = new CreateBookController({ createBook }, refresh);
  return { controller, createBook, refresh };
}

test.each([
  ["", ""],
  ["   ", "Author"],
  ["Book", "\t"],
])("requires trimmed nonempty input: %j", async (name, author) => {
  const { controller, createBook, refresh } = setup();
  controller.setName(name);
  controller.setAuthor(author);
  const preventDefault = vi.fn();
  await controller.submit({ preventDefault });
  expect(preventDefault).toHaveBeenCalledTimes(1);
  expect(controller.errorHidden).toBe(false);
  expect(controller.error).toBe("Enter both a book name and an author.");
  expect(controller.pending).toBe(false);
  expect(controller.name).toBe(name);
  expect(createBook).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
  controller.dispose();
});

test("trims submission, prevents duplicate submits and edits while pending, then clears inputs and refreshes", async () => {
  const pending = deferred<void>();
  const refreshed = deferred<boolean>();
  const { controller, createBook, refresh } = setup(
    vi.fn().mockReturnValue(pending.promise),
    vi.fn().mockReturnValue(refreshed.promise),
  );
  controller.setName("  Clean Code  ");
  controller.setAuthor(" Robert C. Martin ");
  const observed: string[] = [];
  const stop = autorun(() =>
    observed.push(
      `${controller.pending}:${controller.name}:${controller.success}`,
    ),
  );
  const request = controller.submit();
  expect(controller.pending).toBe(true);
  expect(controller.submitLabel).toBe("Saving…");
  await controller.submit();
  controller.setName("Cannot overwrite");
  expect(controller.name).toBe("  Clean Code  ");
  expect(createBook).toHaveBeenCalledTimes(1);
  expect(createBook.mock.calls[0][0]).toEqual({
    name: "Clean Code",
    author: "Robert C. Martin",
  });
  expect(createBook.mock.calls[0][1]).toBeInstanceOf(AbortSignal);
  pending.resolve();
  await pending.promise;
  expect(controller.name).toBe("");
  expect(controller.author).toBe("");
  expect(controller.success).toBe("Book created.");
  expect(refresh).toHaveBeenCalledTimes(1);
  await controller.submit();
  expect(createBook).toHaveBeenCalledTimes(1);
  refreshed.resolve(true);
  await request;
  expect(controller.pending).toBe(false);
  expect(controller.errorHidden).toBe(true);
  expect(controller.successHidden).toBe(false);
  expect(observed).toContain("true::Book created.");
  stop();
  controller.dispose();
});

test("preserves exact input after failure and allows an explicit subsequent submit", async () => {
  const { controller, createBook, refresh } = setup(
    vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined),
  );
  controller.setName(" Book ");
  controller.setAuthor(" Author ");
  await controller.submit();
  expect(controller.pending).toBe(false);
  expect(controller.name).toBe(" Book ");
  expect(controller.author).toBe(" Author ");
  expect(controller.error).toContain("Creation was not confirmed");
  expect(controller.successHidden).toBe(true);
  expect(refresh).not.toHaveBeenCalled();
  await controller.submit();
  expect(createBook).toHaveBeenCalledTimes(2);
  expect(controller.error).toBe("");
  expect(controller.name).toBe("");
  controller.dispose();
});

test.each([false, "reject"])(
  "refresh failure (%s) keeps creation confirmed without resubmitting",
  async (outcome) => {
    const refresh =
      outcome === false
        ? vi.fn().mockResolvedValue(false)
        : vi.fn().mockRejectedValue(new Error("refresh"));
    const { controller, createBook } = setup(undefined, refresh);
    controller.setName("Book");
    controller.setAuthor("Author");
    await controller.submit();
    expect(controller.success).toContain(
      "Book created. Some books could not be refreshed",
    );
    expect(controller.error).toBe("");
    expect(controller.name).toBe("");
    expect(controller.pending).toBe(false);
    expect(createBook).toHaveBeenCalledTimes(1);
    controller.dispose();
  },
);

test.each(["success", "failure"])(
  "disposal aborts pending POST and ignores late %s",
  async (outcome) => {
    const pending = deferred<void>();
    const { controller, createBook, refresh } = setup(
      vi.fn().mockReturnValue(pending.promise),
    );
    controller.setName("Book");
    controller.setAuthor("Author");
    const states: string[] = [];
    const stop = autorun(() =>
      states.push(
        `${controller.pending}:${controller.name}:${controller.error}:${controller.success}`,
      ),
    );
    const request = controller.submit();
    controller.dispose();
    controller.dispose();
    const before = [...states];
    expect(createBook.mock.calls[0][1].aborted).toBe(true);
    if (outcome === "success") pending.resolve();
    else pending.reject(new Error("late failure"));
    await request;
    await controller.submit();
    controller.setName("ignored");
    expect(states).toEqual(before);
    expect(refresh).not.toHaveBeenCalled();
    expect(createBook).toHaveBeenCalledTimes(1);
    stop();
  },
);

test("disposal during refresh prevents late form updates", async () => {
  const refreshed = deferred<boolean>();
  const { controller } = setup(
    undefined,
    vi.fn().mockReturnValue(refreshed.promise),
  );
  controller.setName("Book");
  controller.setAuthor("Author");
  const request = controller.submit();
  await Promise.resolve();
  expect(controller.success).toBe("Book created.");
  controller.dispose();
  refreshed.resolve(false);
  await request;
  expect(controller.success).toBe("Book created.");
});

test("confirmed creation replaces pre-creation requests and synchronizes both collections and count", async () => {
  const oldAll = deferred<Book[]>();
  const oldPrivate = deferred<Book[]>();
  const newBook = { name: "Clean Code", author: "Robert C. Martin" };
  const repository = {
    getBooks: vi
      .fn()
      .mockReturnValueOnce(oldAll.promise)
      .mockResolvedValueOnce([newBook, newBook]),
    getPrivateBooks: vi
      .fn()
      .mockReturnValueOnce(oldPrivate.promise)
      .mockResolvedValueOnce([newBook]),
    createBook: vi.fn().mockResolvedValue(undefined),
  };
  const app = createApplication(repository);
  const initial = app.start();
  app.createBook.setName(newBook.name);
  app.createBook.setAuthor(newBook.author);
  await app.createBook.submit();
  expect(repository.getBooks.mock.calls[0][0].aborted).toBe(true);
  expect(repository.getPrivateBooks.mock.calls[0][0].aborted).toBe(true);
  expect(app.books.rows).toHaveLength(2);
  expect(app.header.countLabel).toBe("Your books: 1");
  app.books.selectPrivate();
  expect(app.books.rows).toHaveLength(1);
  oldAll.resolve([]);
  oldPrivate.resolve([]);
  await initial;
  expect(app.books.rows).toHaveLength(1);
  expect(app.header.countLabel).toBe("Your books: 1");
  expect(repository.getPrivateBooks).toHaveBeenCalledTimes(2);
  app.dispose();
});

test("a saved book with failed private refresh keeps a stale count until a GET-only retry succeeds", async () => {
  const book = { name: "Book", author: "Author" };
  const repository = {
    getBooks: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([book]),
    getPrivateBooks: vi
      .fn()
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("private unavailable"))
      .mockResolvedValueOnce([book]),
    createBook: vi.fn().mockResolvedValue(undefined),
  };
  const app = createApplication(repository);
  await app.start();
  app.createBook.setName(book.name);
  app.createBook.setAuthor(book.author);
  await app.createBook.submit();
  expect(app.createBook.success).toContain(
    "Book created. Some books could not be refreshed",
  );
  expect(app.createBook.name).toBe("");
  expect(app.books.rows).toHaveLength(1);
  expect(app.header.countLabel).toBe("Your books: 0 (last known count)");
  app.books.selectPrivate();
  expect(app.books.status).toBe("error");
  await app.header.retry();
  expect(app.books.status).toBe("success");
  expect(app.books.rows).toHaveLength(1);
  expect(app.header.countLabel).toBe("Your books: 1");
  expect(repository.createBook).toHaveBeenCalledTimes(1);
  expect(repository.getBooks).toHaveBeenCalledTimes(2);
  expect(repository.getPrivateBooks).toHaveBeenCalledTimes(3);
  app.dispose();
});
