# ReaktivateTDD

The original CodeSandbox starter, using Vite with React 16.8.6 and MobX 6.3.10.

Use Node.js 24.18.0 or a newer Node 24 release and install from the lockfile:

```sh
npm ci
npm start
```

Validation and production commands:

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

Vite uses classic JSX transformation without a React plugin or Fast Refresh.
The application entry is `src/index.tsx`. Production output goes to `dist/`.

TypeScript checking is strict across the application, tests, and tooling
configuration. Dependency declaration checking is skipped with `skipLibCheck`.
Vite transpiles code; the build script runs the separate TypeScript check first.

Vitest uses Node for logic tests and jsdom for the App integration tests.
All tests use mocked dependencies and make no live network requests.

The starter loads books from the API configured in `src/Shared/config.ts`.
Set `API_USER` there to select the user namespace.

`createApplication.ts` supplies the factory that constructs the gateway,
repository, and BooksController. `App` lazily calls that factory once per mount,
retains its owned Controller across rerenders, starts loading on mount, and
disposes it on unmount. Remounting creates a fresh Controller; disposed instances
are never revived. Changing the factory prop does not replace a mounted Controller.

`BooksController` owns observable read-side state; no shared store is needed.
It prepares display rows and visibility flags for the functional, observed
`BooksView`. Async updates use MobX actions. New loads abort earlier requests,
and request identities prevent stale completions from changing the screen.
Disposal aborts pending work and ignores all later results and load attempts.

The screen preserves `author: name` display order and duplicates. It now shows
loading, empty, and retryable error states. Retrying clears the prior error and
list. Row keys are local to each response and do not rely on server IDs.
The nonfunctional Add placeholder was removed; creation is outside this phase.

The typed API foundation exposes `getBooks(signal?)` and
`getPrivateBooks(signal?)`, both returning `Promise<Book[]>`. The gateway accepts
an injected fetch function, checks HTTP status before parsing JSON, and forwards
optional abort signals. The repository validates response arrays and records.
Names and authors must be strings; IDs may be strings or numbers and owner IDs
may be strings. Both metadata fields may be absent. Null or wrongly typed fields
are rejected, extra fields are ignored, and duplicates and ordering are preserved.

Private membership comes from the private endpoint, never from owner IDs.
Creation is intentionally absent until the POST payload and response contract
are verified. API tests use mocked responses and never contact the live service.
