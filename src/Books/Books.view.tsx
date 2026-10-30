import React from "react";
import { observer } from "mobx-react";
import type { BooksController } from "./Books.controller";

export const BooksView = observer(function BooksView({
  controller,
}: {
  controller: BooksController;
}) {
  return (
    <section aria-labelledby="books-heading">
      <h2 id="books-heading">Books</h2>
      <div className="book-modes" role="group" aria-label="Book collection">
        <button
          type="button"
          aria-pressed={controller.allSelected}
          onClick={controller.selectAll}
        >
          All books
        </button>
        <button
          type="button"
          aria-pressed={controller.privateSelected}
          onClick={controller.selectPrivate}
        >
          Private books
        </button>
      </div>
      <p role="status" hidden={controller.loadingHidden}>
        Loading books…
      </p>
      <div role="alert" hidden={controller.errorHidden}>
        <p>{controller.error}</p>
        <button type="button" onClick={controller.load}>
          Retry books
        </button>
      </div>
      <p role="status" hidden={controller.emptyHidden}>
        No books found.
      </p>
      <div className="book-list">
        {controller.rows.map((row) => (
          <div className="book-row" key={row.key}>
            {row.text}
          </div>
        ))}
      </div>
    </section>
  );
});
