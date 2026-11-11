# tsuuru workspace guidance

## Language policy

- Use English exclusively for all project-authored content, including source code, identifiers, comments, UI text, documentation, tests, and configuration text. Do not add non-English text to the project.

## Project architecture

- Treat tsuuru as a monorepo containing a portal, independently buildable frontend sub-projects, shared frontend packages, and a text-to-speech (TTS) API service.
- Keep frontend applications under `apps/`, reusable packages under `packages/`, and backend services under `services/`.
- Keep all frontend apps and packages in the pnpm workspace. The workspace should include `apps/*` and `packages/*`.
- Use the root `tsconfig.base.json` for shared TypeScript compiler options, and have each frontend app's `tsconfig.json` extend it.
- Keep the root `.gitignore` configured for Node.js, Python, and common editor artifacts.

## Required technology stack

### Frontend

- **Framework**: React
- **Language**: TypeScript
- **Build tool**: Vite
- **Routing**: React Router
- **Styling**: Tailwind CSS
- **Package manager**: pnpm with pnpm workspaces
- Initialize frontend apps with the Vite React + TypeScript setup and configure Tailwind CSS and React Router.

### Backend

- **Language**: Python
- **Framework**: FastAPI
- **Dependency management**: `uv`, using `pyproject.toml` and a committed `uv.lock`
- Provide a basic health-check endpoint at `GET /health` in the TTS API app.

## Workspace conventions

- Prefer `workspace:*` when referencing internal packages.
- Put reusable React components in `packages/shared-ui` and use them from the apps.
- Manage the TTS API dependencies with uv; commit `services/tts-api/uv.lock` and never commit virtual environments.
- Include a `Dockerfile` for services that require containerized deployment.
- Run `pnpm typecheck` and `pnpm build` after frontend changes; run `pnpm tts:test` after API changes.