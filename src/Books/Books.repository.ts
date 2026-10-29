import ApiGateway from "../Shared/ApiGateway";
import { API_BASE, API_USER } from "../Shared/config";
import type { Book } from "./Book";

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
      throw new Error(`Books API record ${index} must contain string name and author fields.`);
    }

    const book: Book = { name: item.name, author: item.author };
    if ("id" in item) {
      if (typeof item.id !== "string" && typeof item.id !== "number") {
        throw new Error(`Books API record ${index} has an invalid id.`);
      }
      book.id = item.id;
    }
    if ("ownerId" in item) {
      if (typeof item.ownerId !== "string") {
        throw new Error(`Books API record ${index} has an invalid ownerId.`);
      }
      book.ownerId = item.ownerId;
    }
    return book;
  });
}

export class BooksRepository {
  private readonly collectionPath: string;

  constructor(
    private readonly httpGateway: Pick<ApiGateway, "get">,
    user: string = API_USER,
  ) {
    this.collectionPath = `/${encodeURIComponent(user)}/`;
  }

  async getBooks(signal?: AbortSignal): Promise<Book[]> {
    return parseBooks(await this.httpGateway.get(this.collectionPath, signal));
  }

  async getPrivateBooks(signal?: AbortSignal): Promise<Book[]> {
    return parseBooks(await this.httpGateway.get(`${this.collectionPath}private`, signal));
  }
}

// Keep the starter's default import working; tests inject their own gateway.
const booksRepository = new BooksRepository(new ApiGateway(API_BASE));
export default booksRepository;
