import React from "react";
import { observer } from "mobx-react";
import type { CreateBookController } from "./CreateBook.controller";

export const CreateBookView = observer(function CreateBookView({
  controller,
}: {
  controller: CreateBookController;
}) {
  return (
    <section aria-labelledby="create-heading">
      <h2 id="create-heading">Add a book</h2>
      <form
        onSubmit={controller.submit}
        noValidate
        aria-busy={controller.pending}
      >
        <fieldset disabled={controller.pending}>
          <legend>Book details</legend>
          <label htmlFor="book-name">Name</label>
          <input
            id="book-name"
            name="name"
            value={controller.name}
            onChange={(event) => controller.setName(event.currentTarget.value)}
          />
          <label htmlFor="book-author">Author</label>
          <input
            id="book-author"
            name="author"
            value={controller.author}
            onChange={(event) =>
              controller.setAuthor(event.currentTarget.value)
            }
          />
          <button type="submit">{controller.submitLabel}</button>
        </fieldset>
        <p role="alert" hidden={controller.errorHidden}>
          {controller.error}
        </p>
        <p role="status" hidden={controller.successHidden}>
          {controller.success}
        </p>
      </form>
    </section>
  );
});
