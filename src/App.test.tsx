// @vitest-environment jsdom
import React from "react";
import ReactDOM from "react-dom";
import { act, Simulate } from "react-dom/test-utils";
import { expect, test, vi } from "vitest";
import { App } from "./App";
import type { Book } from "./Books/Book";
import { BooksController } from "./Books/Books.controller";

test("mount loads, errors render, Retry updates the view, rerender preserves the request, and unmount disposes", async () => {
  let resolve!: (books: Book[]) => void;
  let reject!: (error: Error) => void;
  const first = new Promise<Book[]>((_, no) => { reject = no; });
  const second = new Promise<Book[]>(yes => { resolve = yes; });
  const getBooks = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
  const controller = new BooksController({ getBooks });
  const container = document.createElement("div");
  document.body.appendChild(container);
  try {
    act(() => { ReactDOM.render(<App controller={controller} />, container); });
    expect(container.querySelector<HTMLElement>('[role="status"]')?.hidden).toBe(false);
    act(() => { ReactDOM.render(<App controller={controller} />, container); });
    expect(getBooks).toHaveBeenCalledTimes(1);
    // React 16.8 supports synchronous act only. Await the controlled promise separately.
    act(() => { reject(new Error("offline")); });
    await first.catch(() => undefined);
    expect(container.querySelector<HTMLElement>('[role="alert"]')?.hidden).toBe(false);
    expect(container.textContent).toContain("Could not load books.");
    const retry = container.querySelector("button");
    if (!retry) throw new Error("Retry button missing");
    act(() => { Simulate.click(retry); });
    expect(getBooks).toHaveBeenCalledTimes(2);
    act(() => { resolve([{ name: "The Hobbit", author: "Jrr Tolkein" }]); });
    await second;
    expect(container.textContent).toContain("Jrr Tolkein: The Hobbit");
    expect(container.querySelector<HTMLElement>('[role="alert"]')?.hidden).toBe(true);
    act(() => { ReactDOM.unmountComponentAtNode(container); });
    await controller.load();
    expect(getBooks).toHaveBeenCalledTimes(2);
  } finally {
    act(() => { ReactDOM.unmountComponentAtNode(container); });
    container.remove();
  }
});

test("unmount aborts the request started on mount", async () => {
  const getBooks = vi.fn().mockReturnValue(new Promise<Book[]>(() => undefined));
  const controller = new BooksController({ getBooks });
  const container = document.createElement("div");
  act(() => { ReactDOM.render(<App controller={controller} />, container); });
  const signal: AbortSignal = getBooks.mock.calls[0][0];
  act(() => { ReactDOM.unmountComponentAtNode(container); });
  expect(signal.aborted).toBe(true);
});
