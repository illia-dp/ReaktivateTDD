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
The original JSX entry was renamed to `src/index.jsx`; application behavior is
unchanged. Production output goes to `dist/`.

TypeScript checking is strict for `.ts` and `.tsx` files, including the tooling
configuration and MobX smoke test. Existing JavaScript is admitted with
`allowJs`, but `checkJs` is disabled until the application refactor. Dependency
declaration checking is skipped with `skipLibCheck`; application TypeScript
still receives strict checks. Vite transpiles code; the build script runs the
separate TypeScript check first.

Vitest runs in its default Node environment. The smoke test makes no network
requests and checks MobX action batching and reaction disposal.

The starter loads books from the API configured in `src/Shared/config.ts`.
Set `API_USER` there to select the user namespace. The Add button remains a
placeholder.

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
