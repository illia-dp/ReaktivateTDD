import { BooksController } from "./Books/Books.controller";
import { BooksRepository } from "./Books/Books.repository";
import ApiGateway from "./Shared/ApiGateway";
import { API_BASE, API_USER } from "./Shared/config";

export function createApplication(): BooksController {
  return new BooksController(new BooksRepository(new ApiGateway(API_BASE), API_USER));
}
