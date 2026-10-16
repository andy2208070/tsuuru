# tsuuru workspace guidance

- Keep the frontend apps in the pnpm workspace and prefer `workspace:*` for internal packages.
- Put reusable React components in `packages/shared-ui` and use them from the apps.
- Manage the TTS API dependencies with uv; commit `services/tts-api/uv.lock` and never commit virtual environments.
- Run `pnpm typecheck` and `pnpm build` after frontend changes; run `pnpm tts:test` after API changes.