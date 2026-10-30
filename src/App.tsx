import React, { useEffect, useState } from "react";
import type { Application } from "./createApplication";
import { BooksView } from "./Books/Books.view";
import { CreateBookView } from "./Books/CreateBook.view";
import { HeaderView } from "./Header/Header.view";

export function App({
  createApplication,
}: {
  createApplication: () => Application;
}) {
  const [application] = useState(createApplication);

  useEffect(() => {
    void application.start();
    return application.dispose;
  }, [application]);

  return (
    <>
      <HeaderView controller={application.header} />
      <main>
        <BooksView controller={application.books} />
        <CreateBookView controller={application.createBook} />
      </main>
    </>
  );
}
