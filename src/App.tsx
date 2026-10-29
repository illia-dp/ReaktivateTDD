import React, { useEffect, useState } from "react";
import type { BooksController } from "./Books/Books.controller";
import { BooksView } from "./Books/Books.view";

export function App({ createController }: { createController: () => BooksController }) {
  const [controller] = useState(createController);

  useEffect(() => {
    void controller.load();
    return controller.dispose;
  }, [controller]);

  return <BooksView controller={controller} />;
}
