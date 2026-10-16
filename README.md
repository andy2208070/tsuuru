# tsuuru

A pnpm monorepo for three React applications, shared UI, and a FastAPI text-to-speech (TTS) API.

## Prerequisites

- Node.js 20.19 or newer
- Corepack-enabled pnpm 10
- Python 3.11 or newer and uv

## Install

```powershell
corepack enable
pnpm install
uv sync --project services/tts-api --all-groups
```

## Run

```powershell
# Portal at http://localhost:5173
pnpm dev

# Run all three frontends in parallel (ports 5173, 5174, and 5175)
pnpm dev:all

# TTS API at http://localhost:8000
pnpm tts:dev
```

## Build and test

```powershell
pnpm build
pnpm typecheck
pnpm --filter @tsuuru/web-a build
pnpm tts:test
```

`web-a` and `web-b` can be built independently using their pnpm filters. Build the containerized `web-b` from the repository root with `docker build -f apps/web-b/Dockerfile -t tsuuru-web-b .`, then run it with `docker run --rm -p 8080:8080 tsuuru-web-b`. Build the TTS API container with `docker build -f services/tts-api/Dockerfile -t tsuuru-tts-api services/tts-api`.

## Workspace layout

- `apps/portal`: main entry portal
- `apps/web-a`: independently buildable sub-project
- `apps/web-b`: containerized sub-project
- `packages/shared-ui`: shared React components
- `services/tts-api`: FastAPI TTS service scaffold with `GET /health`