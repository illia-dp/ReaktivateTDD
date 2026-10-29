import { expect, test, vi } from "vitest";
import ApiGateway from "../Shared/ApiGateway";
import { BooksRepository } from "./Books.repository";

const baseUrl = "https://example.test/v1/books";
const book = { name: "The Hobbit", author: "Jrr Tolkein" };

function setup(payload: unknown) {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(payload));
  const repository = new BooksRepository(new ApiGateway(baseUrl, fetcher), "reader/name ?");
  return { fetcher, repository };
}

test("requests all books using an encoded user path segment", async () => {
  const { fetcher, repository } = setup([]);
  await expect(repository.getBooks()).resolves.toEqual([]);
  expect(fetcher).toHaveBeenCalledExactlyOnceWith(
    `${baseUrl}/reader%2Fname%20%3F/`,
    { method: "GET", signal: undefined },
  );
});

test("uses the private endpoint without filtering by ownerId", async () => {
  const books = [book, { ...book, ownerId: "another-owner" }];
  const { fetcher, repository } = setup(books);
  const controller = new AbortController();
  await expect(repository.getPrivateBooks(controller.signal)).resolves.toEqual(books);
  expect(fetcher).toHaveBeenCalledExactlyOnceWith(
    `${baseUrl}/reader%2Fname%20%3F/private`,
    { method: "GET", signal: controller.signal },
  );
});

test("parses verified fields, accepts missing metadata, and preserves duplicates and order", async () => {
  const books = [
    { ...book, id: 111, ownerId: "reader" },
    { ...book, id: "111" },
    book,
    book,
    { ...book, id: 111, ownerId: "reader" },
  ];
  const { repository } = setup(books);
  await expect(repository.getBooks()).resolves.toEqual(books);
});

test("does not expose unverified extra fields in the Book model", async () => {
  const { repository } = setup([{ ...book, extra: true }]);
  await expect(repository.getBooks()).resolves.toEqual([book]);
});

test.each([null, {}, { books: [] }, "books", 1])("rejects a non-array response: %j", async (payload) => {
  const { repository } = setup(payload);
  await expect(repository.getBooks()).rejects.toThrow("Books API response must be an array.");
});

test.each([
  null, [], "book", {}, { name: "Book" }, { name: 1, author: "Author" },
  { ...book, author: null }, { ...book, id: null }, { ...book, id: true },
  { ...book, ownerId: null }, { ...book, ownerId: 123 },
])("rejects an invalid record instead of silently dropping it: %j", async (record) => {
  const { repository } = setup([book, record]);
  await expect(repository.getBooks()).rejects.toThrow("Books API record 1");
});

test("validates private responses through the same parser", async () => {
  const { repository } = setup([{ name: "Missing author" }]);
  await expect(repository.getPrivateBooks()).rejects.toThrow("string name and author");
});

test("propagates HTTP failures from private reads", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 }));
  const repository = new BooksRepository(new ApiGateway(baseUrl, fetcher), "reader");
  await expect(repository.getPrivateBooks()).rejects.toMatchObject({ status: 503 });
});
