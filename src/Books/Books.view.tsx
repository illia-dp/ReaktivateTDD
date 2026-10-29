import React from "react";
import { observer } from "mobx-react";
import type { BooksController } from "./Books.controller";

export const BooksView = observer(function BooksView({ controller }: { controller: BooksController }) {
  return (
    <div>
      <p role="status" hidden={controller.loadingHidden}>Loading books…</p>
      <div role="alert" hidden={controller.errorHidden}>
        <p>{controller.error}</p>
        <button onClick={controller.load}>Retry</button>
      </div>
      <p role="status" hidden={controller.emptyHidden}>No books found.</p>
      {controller.rows.map((row) => <div key={row.key}>{row.text}</div>)}
    </div>
  );
});
