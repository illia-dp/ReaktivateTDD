import type ApiGateway from "../Shared/ApiGateway";
import { API_USER } from "../Shared/config";
import type { Book, CreateBookInput } from "./Book";

function parseBooks(value: unknown): Book[] {
  if (!Array.isArray(value)) {
    throw new Error("Books API response must be an array.");
  }

  return value.map((item: unknown, index): Book => {
    if (
      typeof item !== "object" ||
      item === null ||
      Array.isArray(item) ||
      !("name" in item) ||
      typeof item.name !== "string" ||
      !("author" in item) ||
      typeof item.author !== "string"
    ) {
      throw new Error(
        `Books API record ${index} must contain string name and author fields.`,
      );
    }

    return { name: item.name, author: item.author };
  });
}

export class BooksRepository {
  private readonly collectionPath: string;

  constructor(
    private readonly httpGateway: Pick<ApiGateway, "get" | "post">,
    user: string = API_USER,
  ) {
    this.collectionPath = `/${encodeURIComponent(user)}/`;
  }

  async getBooks(signal?: AbortSignal): Promise<Book[]> {
    return parseBooks(await this.httpGateway.get(this.collectionPath, signal));
  }

  async getPrivateBooks(signal?: AbortSignal): Promise<Book[]> {
    return parseBooks(
      await this.httpGateway.get(`${this.collectionPath}private`, signal),
    );
  }

  async createBook(
    input: CreateBookInput,
    signal?: AbortSignal,
  ): Promise<void> {
    const response = await this.httpGateway.post(
      this.collectionPath,
      { name: input.name, author: input.author },
      signal,
    );
    if (
      typeof response !== "object" ||
      response === null ||
      Array.isArray(response) ||
      !("status" in response) ||
      response.status !== "ok"
    ) {
      throw new Error("Books API did not confirm creation.");
    }
  }
}
