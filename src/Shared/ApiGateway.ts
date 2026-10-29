export class HttpError extends Error {
  constructor(public readonly status: number) {
    super(`Books API request failed with HTTP ${status}.`);
    this.name = "HttpError";
  }
}

export default class ApiGateway {
  constructor(
    private readonly baseUrl: string,
    private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  async get(path: string, signal?: AbortSignal): Promise<unknown> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method: "GET",
      signal,
    });

    if (!response.ok) {
      throw new HttpError(response.status);
    }

    try {
      return await response.json();
    } catch (cause) {
      // Preserve cancellation and body-read failures as transport errors.
      if (!(cause instanceof SyntaxError)) throw cause;
      throw new Error("Books API returned malformed JSON.", { cause });
    }
  }
}
