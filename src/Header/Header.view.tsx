import React from "react";
import { observer } from "mobx-react";
import type { HeaderController } from "./Header.controller";

export const HeaderView = observer(function HeaderView({
  controller,
}: {
  controller: HeaderController;
}) {
  return (
    <header className="app-header">
      <h1>Book collection</h1>
      <div>
        <span role="status">{controller.countLabel}</span>
        <button
          type="button"
          hidden={controller.retryHidden}
          onClick={controller.retry}
        >
          Retry private books
        </button>
      </div>
    </header>
  );
});
