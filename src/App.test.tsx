// @vitest-environment jsdom
import React from "react";
import ReactDOM from "react-dom";
import { act, Simulate } from "react-dom/test-utils";
import { configure } from "mobx";
import { expect, test, vi } from "vitest";
import { App } from "./App";
import type { Book } from "./Books/Book";
import type { BooksRepository } from "./Books/Books.repository";
import { createApplication } from "./createApplication";
import { deferred } from "./test/deferred";

configure({ enforceActions: "always" });
function repository() {
  return {
    getBooks: vi.fn<BooksRepository["getBooks"]>().mockResolvedValue([]),
    getPrivateBooks: vi
      .fn<BooksRepository["getPrivateBooks"]>()
      .mockResolvedValue([]),
    createBook: vi
      .fn<BooksRepository["createBook"]>()
      .mockResolvedValue(undefined),
  };
}
function element<T extends Element>(
  container: HTMLElement,
  selector: string,
): T {
  const result = container.querySelector<T>(selector);
  if (!result) throw new Error(`Missing ${selector}`);
  return result;
}
function button(container: HTMLElement, text: string): HTMLButtonElement {
  const result = [...container.querySelectorAll("button")].find(
    (item) => item.textContent === text,
  );
  if (!result) throw new Error(`Missing button ${text}`);
  return result;
}

test("mount loads, list errors render, Retry updates the view, rerender retains ownership, and unmount disposes", async () => {
  const first = deferred<Book[]>();
  const second = deferred<Book[]>();
  const api = repository();
  api.getBooks
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const app = createApplication(api);
  const container = document.createElement("div");
  document.body.appendChild(container);
  try {
    act(() => {
      ReactDOM.render(<App createApplication={() => app} />, container);
    });
    const list = element<HTMLElement>(
      container,
      'section[aria-labelledby="books-heading"]',
    );
    expect(element<HTMLElement>(list, '[role="status"]').hidden).toBe(false);
    act(() => {
      ReactDOM.render(<App createApplication={() => app} />, container);
    });
    expect(api.getBooks).toHaveBeenCalledTimes(1);
    act(() => {
      first.reject(new Error("offline"));
    });
    await app.start();
    expect(element<HTMLElement>(list, '[role="alert"]').hidden).toBe(false);
    expect(list.textContent).toContain("Could not load books.");
    act(() => {
      Simulate.click(button(container, "Retry books"));
    });
    expect(api.getBooks).toHaveBeenCalledTimes(2);
    act(() => {
      second.resolve([{ name: "The Hobbit", author: "Jrr Tolkein" }]);
    });
    await app.start();
    expect(list.textContent).toContain("Jrr Tolkein: The Hobbit");
    expect(element<HTMLElement>(list, '[role="alert"]').hidden).toBe(true);
    act(() => {
      ReactDOM.unmountComponentAtNode(container);
    });
    await app.books.load();
    expect(api.getBooks).toHaveBeenCalledTimes(2);
  } finally {
    act(() => {
      ReactDOM.unmountComponentAtNode(container);
    });
    container.remove();
  }
});

test("unmount aborts both collection requests started on mount", () => {
  const api = repository();
  api.getBooks.mockReturnValue(new Promise<Book[]>(() => undefined));
  api.getPrivateBooks.mockReturnValue(new Promise<Book[]>(() => undefined));
  const app = createApplication(api);
  const container = document.createElement("div");
  act(() => {
    ReactDOM.render(<App createApplication={() => app} />, container);
  });
  act(() => {
    ReactDOM.unmountComponentAtNode(container);
  });
  expect(api.getBooks.mock.calls[0][0]?.aborted).toBe(true);
  expect(api.getPrivateBooks.mock.calls[0][0]?.aborted).toBe(true);
});

test("each mount owns fresh Controllers and store; the old mount's late result cannot replace the new screen", async () => {
  const first = deferred<Book[]>();
  const second = deferred<Book[]>();
  const api = repository();
  api.getBooks
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const factory = vi.fn(() => createApplication(api));
  const container = document.createElement("div");
  document.body.appendChild(container);
  try {
    act(() => {
      ReactDOM.render(<App createApplication={factory} />, container);
    });
    expect(factory).toHaveBeenCalledTimes(1);
    const firstApp = factory.mock.results[0].value;
    const initial = firstApp.start();
    const signal = api.getBooks.mock.calls[0][0];
    act(() => {
      ReactDOM.render(<App createApplication={() => factory()} />, container);
    });
    expect(factory).toHaveBeenCalledTimes(1);
    expect(api.getBooks).toHaveBeenCalledTimes(1);
    expect(signal?.aborted).toBe(false);
    act(() => {
      ReactDOM.unmountComponentAtNode(container);
    });
    expect(signal?.aborted).toBe(true);
    await firstApp.books.load();
    expect(api.getBooks).toHaveBeenCalledTimes(1);
    act(() => {
      ReactDOM.render(<App createApplication={factory} />, container);
    });
    expect(factory).toHaveBeenCalledTimes(2);
    const secondApp = factory.mock.results[1].value;
    expect(secondApp.books).not.toBe(firstApp.books);
    expect(secondApp.header).not.toBe(firstApp.header);
    expect(secondApp.createBook).not.toBe(firstApp.createBook);
    expect(api.getBooks).toHaveBeenCalledTimes(2);
    act(() => {
      second.resolve([{ name: "Current book", author: "Current author" }]);
    });
    await secondApp.start();
    expect(container.textContent).toContain("Current author: Current book");
    act(() => {
      first.resolve([{ name: "Stale book", author: "Old author" }]);
    });
    await initial;
    expect(firstApp.books.rows).toEqual([]);
    expect(container.textContent).toContain("Current author: Current book");
    expect(container.textContent).not.toContain("Old author: Stale book");
  } finally {
    act(() => {
      ReactDOM.unmountComponentAtNode(container);
    });
    container.remove();
  }
});

test("form validates, submits once, and refreshes the list and shared header across mode switches", async () => {
  const api = repository();
  const publicBook = { name: "Public book", author: "Public author" };
  const created = { name: "Clean Code", author: "Robert C. Martin" };
  const saved = deferred<void>();
  api.getBooks
    .mockResolvedValueOnce([publicBook])
    .mockResolvedValueOnce([publicBook, created]);
  api.getPrivateBooks
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([created]);
  api.createBook.mockReturnValue(saved.promise);
  const app = createApplication(api);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const warnings = vi.spyOn(console, "warn");
  try {
    act(() => {
      ReactDOM.render(<App createApplication={() => app} />, container);
    });
    await app.start();
    const header = element<HTMLElement>(container, "header.app-header");
    expect(header.textContent).toContain("Your books: 0");
    const all = button(container, "All books");
    const mine = button(container, "Private books");
    expect(all.getAttribute("aria-pressed")).toBe("true");
    act(() => {
      Simulate.click(mine);
    });
    expect(mine.getAttribute("aria-pressed")).toBe("true");
    expect(all.getAttribute("aria-pressed")).toBe("false");
    expect(container.textContent).not.toContain("Public author: Public book");
    expect(header.textContent).toContain("Your books: 0");
    const form = element<HTMLFormElement>(container, "form");
    act(() => {
      Simulate.submit(form);
    });
    expect(element<HTMLElement>(form, '[role="alert"]').textContent).toContain(
      "Enter both",
    );
    expect(api.createBook).not.toHaveBeenCalled();
    const name = element<HTMLInputElement>(form, '[name="name"]');
    const author = element<HTMLInputElement>(form, '[name="author"]');
    act(() => {
      name.value = " Clean Code ";
      Simulate.change(name);
      author.value = " Robert C. Martin ";
      Simulate.change(author);
    });
    act(() => {
      Simulate.submit(form);
      Simulate.submit(form);
    });
    expect(api.createBook).toHaveBeenCalledTimes(1);
    expect(api.createBook.mock.calls[0][0]).toEqual(created);
    expect(element<HTMLFieldSetElement>(form, "fieldset").disabled).toBe(true);
    act(() => {
      Simulate.click(all);
      Simulate.click(mine);
    });
    act(() => {
      saved.resolve();
    });
    await vi.waitFor(() => expect(app.createBook.pending).toBe(false));
    expect(header.textContent).toContain("Your books: 1");
    expect(element<HTMLElement>(container, ".book-list").textContent).toBe(
      "Robert C. Martin: Clean Code",
    );
    expect(name.value).toBe("");
    expect(author.value).toBe("");
    expect(form.textContent).toContain("Book created.");
    expect(element<HTMLFieldSetElement>(form, "fieldset").disabled).toBe(false);
    act(() => {
      Simulate.click(all);
    });
    expect(container.textContent).toContain("Public author: Public book");
    expect(container.textContent).toContain("Robert C. Martin: Clean Code");
    expect(api.getBooks).toHaveBeenCalledTimes(2);
    expect(api.getPrivateBooks).toHaveBeenCalledTimes(2);
    expect(warnings).not.toHaveBeenCalled();
  } finally {
    warnings.mockRestore();
    act(() => {
      ReactDOM.unmountComponentAtNode(container);
    });
    container.remove();
  }
});

test("form errors preserve inputs and unmount cancels a subsequent pending creation", async () => {
  const api = repository();
  const pending = deferred<void>();
  api.createBook
    .mockRejectedValueOnce(new TypeError("offline"))
    .mockReturnValueOnce(pending.promise);
  const app = createApplication(api);
  const container = document.createElement("div");
  try {
    act(() => {
      ReactDOM.render(<App createApplication={() => app} />, container);
    });
    await app.start();
    const form = element<HTMLFormElement>(container, "form");
    const name = element<HTMLInputElement>(form, '[name="name"]');
    const author = element<HTMLInputElement>(form, '[name="author"]');
    act(() => {
      name.value = "Book";
      Simulate.change(name);
      author.value = "Author";
      Simulate.change(author);
      Simulate.submit(form);
    });
    await vi.waitFor(() => expect(app.createBook.pending).toBe(false));
    expect(element<HTMLElement>(form, '[role="alert"]').hidden).toBe(false);
    expect(name.value).toBe("Book");
    expect(author.value).toBe("Author");
    act(() => {
      Simulate.submit(form);
    });
    act(() => {
      ReactDOM.unmountComponentAtNode(container);
    });
    expect(api.createBook.mock.calls[1][1]?.aborted).toBe(true);
    pending.resolve();
    await pending.promise;
    expect(api.getBooks).toHaveBeenCalledTimes(1);
    expect(api.getPrivateBooks).toHaveBeenCalledTimes(1);
    expect(app.createBook.success).toBe("");
  } finally {
    act(() => {
      ReactDOM.unmountComponentAtNode(container);
    });
  }
});
