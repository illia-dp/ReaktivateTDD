# Reaktivate Books

A small React application for the Reaktivate Fast-Test Homework. The starter was refactored to separate presentation from application logic using MVP/MVVM, MobX, and TypeScript.

## Getting started

**Requirements:** Node.js 24.18+ (Node 24) and npm.

```bash
npm ci
npm start
```

Open [http://localhost:5173](http://localhost:5173).

The API URL and username are defined in `src/Shared/config.ts`. Set `API_USER` to a unique nickname before adding books, so your data is kept separate from other demo users.

**API certificate:** The homework notes that the API may use a self-signed certificate. If your browser blocks requests to the API, open an API endpoint such as `https://tdd.demo.reaktivate.com/v1/books/YOUR_NICKNAME/` in the browser and follow its certificate warning instructions before reloading the app. Do not disable certificate verification globally.

## Features

- Browse all books or switch to private books.
- Add a book using its name and author.
- View the private-book count in a sticky header.
- Handle loading, empty states, errors, and retries.
- Refresh the collections after a successful creation without automatically resubmitting the POST request.

## Project structure

```text
src/
  Books/              Book model, repository, shared store, controllers and views
  Header/             Header controller and view
  Shared/             API gateway and configuration
  App.tsx             Application layout and lifecycle
  createApplication.ts  Dependency wiring and disposal
  styles.css          Application styles
```

Views are functional React components observed with `mobx-react`. They render state and forward user actions; controllers handle UI behavior, while `BooksRepository` and `ApiGateway` handle communication with the API.

`BooksStore` holds the collections shared by the list and the header. Each application mount creates its own controllers and store, and disposes them on unmount. This also prevents stale requests from updating an unmounted screen.

## API

The application uses the endpoints documented in the [API Swagger UI](https://tdd.demo.reaktivate.com/api-docs/):

| Method | Endpoint                   | Purpose                        |
| ------ | -------------------------- | ------------------------------ |
| GET    | `/v1/books/{user}/`        | All books                      |
| GET    | `/v1/books/{user}/private` | Private books and header count |
| POST   | `/v1/books/{user}/`        | Create a book                  |

Book creation sends JSON containing `name` and `author`. A successful request returns HTTP 200 with `{ "status": "ok" }` (verified against the demo API). After creation, the app reloads both collections. Private membership is determined by the private endpoint, not by `ownerId`.

## Testing and build

```bash
npm run typecheck
npm test
npm run build
npm run preview
```

Tests use Vitest with mocked API dependencies, plus jsdom for React integration tests. They cover request failures, concurrent loads, disposal, creation, switching between collections, and the shared private-book count. The test suite does not modify live API data.

The project uses Vite instead of the starter's Create React App setup because the original Webpack toolchain was incompatible with the Node.js version used during development. React, MobX, and `mobx-react` remain on the starter's versions.
