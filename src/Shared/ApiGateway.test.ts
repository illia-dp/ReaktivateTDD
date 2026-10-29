import { expect, test, vi } from "vitest";
import ApiGateway, { HttpError } from "./ApiGateway";

const baseUrl = "https://example.test/v1/books";

test("GET forwards its URL and abort signal and returns parsed JSON", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json([{ name: "Book" }]));
  const gateway = new ApiGateway(baseUrl, fetcher);
  const controller = new AbortController();

  await expect(gateway.get("/reader/", controller.signal)).resolves.toEqual([{ name: "Book" }]);
  expect(fetcher).toHaveBeenCalledExactlyOnceWith(`${baseUrl}/reader/`, {
    method: "GET",
    signal: controller.signal,
  });
});

test.each([404, 500])("reports HTTP %s before trying to parse the error body", async (status) => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("not JSON", { status }));
  const request = new ApiGateway(baseUrl, fetcher).get("/reader/");

  await expect(request).rejects.toBeInstanceOf(HttpError);
  await expect(request).rejects.toMatchObject({ status });
});

test("reports malformed successful JSON", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("{"));
  await expect(new ApiGateway(baseUrl, fetcher).get("/reader/")).rejects.toThrow(
    "Books API returned malformed JSON.",
  );
});

test.each([new TypeError("Network unavailable"), new DOMException("Cancelled", "AbortError")])(
  "preserves transport failure: $name",
  async (error) => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(error);
    await expect(new ApiGateway(baseUrl, fetcher).get("/reader/")).rejects.toBe(error);
  },
);
