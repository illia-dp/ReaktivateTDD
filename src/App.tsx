import React, { useEffect } from "react";
import type { BooksController } from "./Books/Books.controller";
import { BooksView } from "./Books/Books.view";

export function App({ controller }: { controller: BooksController }) {
  useEffect(() => {
    void controller.load();
    return controller.dispose;
  }, [controller]);

  return <BooksView controller={controller} />;
}
