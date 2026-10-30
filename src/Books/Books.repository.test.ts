import { expect, test, vi } from "vitest";
import ApiGateway from "../Shared/ApiGateway";
import { BooksRepository } from "./Books.repository";

const baseUrl = "https://example.test/v1/books";
const book = { name: "The Hobbit", author: "Jrr Tolkein" };

function setup(payload: unknown) {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json(payload));
  const repository = new BooksRepository(
    new ApiGateway(baseUrl, fetcher),
    "reader/name ?",
  );
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
  await expect(repository.getPrivateBooks(controller.signal)).resolves.toEqual(
    [book, book],
  );
  expect(fetcher).toHaveBeenCalledExactlyOnceWith(
    `${baseUrl}/reader%2Fname%20%3F/private`,
    { method: "GET", signal: controller.signal },
  );
});

test("parses name and author, ignores metadata, and preserves duplicates and order", async () => {
  const otherBook = { name: "I, Robot", author: "Isaac Asimov" };
  const books = [
    { ...book, id: 111, ownerId: "reader" },
    { ...otherBook, id: "111" },
    book,
    book,
    { ...book, id: 111, ownerId: "reader" },
  ];
  const { repository } = setup(books);
  await expect(repository.getBooks()).resolves.toEqual([
    book,
    otherBook,
    book,
    book,
    book,
  ]);
});

test.each([
  { extra: true },
  { id: null },
  { id: true },
  { ownerId: null },
  { ownerId: 123 },
])("ignores unused fields without exposing them: %j", async (metadata) => {
  const { repository } = setup([{ ...book, ...metadata }]);
  await expect(repository.getBooks()).resolves.toEqual([book]);
});

test.each([null, {}, { books: [] }, "books", 1])(
  "rejects a non-array response: %j",
  async (payload) => {
    const { repository } = setup(payload);
    await expect(repository.getBooks()).rejects.toThrow(
      "Books API response must be an array.",
    );
  },
);

test.each([
  null,
  [],
  "book",
  {},
  { name: "Book" },
  { name: 1, author: "Author" },
  { ...book, author: null },
])(
  "rejects an invalid record instead of silently dropping it: %j",
  async (record) => {
    const { repository } = setup([book, record]);
    await expect(repository.getBooks()).rejects.toThrow("Books API record 1");
  },
);

test("validates private responses through the same parser", async () => {
  const { repository } = setup([{ name: "Missing author" }]);
  await expect(repository.getPrivateBooks()).rejects.toThrow(
    "string name and author",
  );
});

test("propagates HTTP failures from private reads", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(null, { status: 503 }));
  const repository = new BooksRepository(
    new ApiGateway(baseUrl, fetcher),
    "reader",
  );
  await expect(repository.getPrivateBooks()).rejects.toMatchObject({
    status: 503,
  });
});

test("creates at the collection endpoint with only the verified JSON fields and signal", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ status: "ok" }));
  const repository = new BooksRepository(
    new ApiGateway(baseUrl, fetcher),
    "reader/name ?",
  );
  const controller = new AbortController();
  await expect(
    repository.createBook(book, controller.signal),
  ).resolves.toBeUndefined();
  expect(fetcher).toHaveBeenCalledExactlyOnceWith(
    `${baseUrl}/reader%2Fname%20%3F/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(book),
      signal: controller.signal,
    },
  );
});

test.each([
  null,
  {},
  [],
  { status: "error" },
  { status: true },
  { name: "Book" },
])("rejects an unconfirmed HTTP 200 creation body: %j", async (body) => {
  const { repository } = setup(body);
  await expect(repository.createBook(book)).rejects.toThrow(
    "did not confirm creation",
  );
});

test("creation propagates HTTP errors before interpreting the body", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ status: "ok" }, { status: 400 }));
  const repository = new BooksRepository(
    new ApiGateway(baseUrl, fetcher),
    "reader",
  );
  await expect(repository.createBook(book)).rejects.toMatchObject({
    status: 400,
  });
});

test("creation preserves network failures and never retries the POST", async () => {
  const failure = new TypeError("Network unavailable");
  const fetcher = vi.fn<typeof fetch>().mockRejectedValue(failure);
  const repository = new BooksRepository(
    new ApiGateway(baseUrl, fetcher),
    "reader",
  );
  await expect(repository.createBook(book)).rejects.toBe(failure);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test("creation rejects malformed JSON", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("{"));
  const repository = new BooksRepository(
    new ApiGateway(baseUrl, fetcher),
    "reader",
  );
  await expect(repository.createBook(book)).rejects.toThrow("malformed JSON");
});
