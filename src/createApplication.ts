import { BooksController } from "./Books/Books.controller";
import { BooksRepository } from "./Books/Books.repository";
import { BooksStore } from "./Books/Books.store";
import { CreateBookController } from "./Books/CreateBook.controller";
import { HeaderController } from "./Header/Header.controller";
import ApiGateway from "./Shared/ApiGateway";
import { API_BASE, API_USER } from "./Shared/config";

export interface Application {
  readonly books: BooksController;
  readonly createBook: CreateBookController;
  readonly header: HeaderController;
  start(): Promise<void>;
  dispose(): void;
}

export function createApplication(
  repository: Pick<
    BooksRepository,
    "getBooks" | "getPrivateBooks" | "createBook"
  > = new BooksRepository(new ApiGateway(API_BASE), API_USER),
): Application {
  const store = new BooksStore(repository);
  const books = new BooksController(store);
  const createBook = new CreateBookController(repository, () =>
    store.refreshAll(),
  );
  const header = new HeaderController(store);
  return {
    books,
    createBook,
    header,
    async start() {
      await Promise.all([
        store.ensureLoaded("all"),
        store.ensureLoaded("private"),
      ]);
    },
    dispose() {
      books.dispose();
      createBook.dispose();
      header.dispose();
      store.dispose();
    },
  };
}
