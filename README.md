# thesis-workbench

The Workbench: the web UI of the thesis Evidence QA project (Vite + React + TypeScript, TanStack Query,
shadcn components). It opens on `/workbench` and talks to the backend only over HTTP (`/api/evqa/*`).
It is a git submodule at `frontend/` of the thesis repo, whose FastAPI app (`webapp serve`) serves the
built `dist/`.

## Run

```bash
npm ci
npm run dev        # Vite dev server; proxies /api to the backend
```

The dev server expects the backend API at `http://127.0.0.1:8080` (in the thesis repo:
`uv run webapp serve --port 8080`). Set `WEBAPP_API` to point the proxy elsewhere (see `vite.config.ts`).

| Command | Does |
|---|---|
| `npm run typecheck` | `tsc -b` |
| `npm test` | Vitest (jsdom; each test sets its `/api` answers with MSW) |
| `npm run lint` | ESLint |
| `npm run build` | `tsc -b` + `dist/` (not committed; build it before `webapp serve`) |

In the thesis repo, Node can come from the `frontend` uv group: `uv run --group frontend npm ci`.
The server reads `dist/` from `WEBAPP_DIST` (default `<thesis repo>/frontend/dist`).
