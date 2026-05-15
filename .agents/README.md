# O-Control Parallel Agent Workspace

This folder contains task briefs for running multiple Claude Code agents in parallel.

The original goal was to let each agent work on a bounded slice of O-Control, then return a patch/branch that can be reviewed and merged once at the end.

Current status: MVP is implemented, committed, and verified against a real CR-N775. Use this folder now as a handoff and follow-up planning area.

Verified baseline:

- `6579f7c` — Initial O-Control implementation
- `0e8d89e` — Document real receiver verification
- Latest local update: Code-track hardening tests and N100 runbook
- Latest local update: Tauri shell source, web debug UI, visual QA screenshots, and Docker smoke validation
- Real receiver: CR-N775 at `192.168.1.104`, eISCP TCP `60128`
- Verified controls: state readback, volume set/restore, mute on/off, input readback, playback readback, desktop UI WebSocket updates
- Automated verification: `npm run build`, `npm run lint`, `npm run test:all` with 133 passing tests, and `npm audit --audit-level=high`
- Docker Compose smoke: mock-mode image built and `/health` passed on host port `18787`
- Native Tauri build is environment-blocked until Rust/Cargo is installed

## Project Repository

```text
https://github.com/maxsaigon/o-controller.git
```

The repo is no longer empty. New agents should branch from the latest `main`.

## How To Use

1. Clone `https://github.com/maxsaigon/o-controller.git`.
2. Pull latest `main`.
3. Read `.agents/task-index.md` first.
4. Assign only remaining follow-up work from `.agents/task-index.md` or the per-task files.
5. Use a focused branch for each follow-up task.
6. Tell every agent:
   - You are not alone in the codebase.
   - Do not revert edits made by others.
   - Only edit files listed in your task ownership section.
   - If you need to touch another area, stop and report the need instead of changing it.
   - Return changed file paths, commands run, tests run, and unresolved risks.
7. Keep Codex-owned UI/UX work in `.agents/codex-uiux-tasks.md`.
8. Use `merge-review-checklist.md` for final review and integration.

## Recommended Next Batch

The initial parallel batch is done. Recommended next work:

- Native build validation: install Rust/Cargo, run `npm run tauri:build -w @o-control/desktop`, then verify macOS tray sizing/focus behavior.
- Target deployment validation: rerun the Docker compose smoke flow on the actual N100 host and record host-specific notes.
- Distribution polish: add publish-ready icon/metadata for Raycast/native app if distributing.

Defer:

- NAS/USB browser production work until more real CR-N775 logs exist.

The older per-agent task files in `.agents/tasks/` are retained as granular references, but the two-track split above is the source of truth for avoiding overwrite conflicts.

## Merge Strategy

For new follow-up work:

1. Review ownership before editing.
2. Preserve the working service API and shared types unless there is a tested migration.
3. Run `npm run build`, `npm run lint`, `npm run test:all`, and `npm audit --audit-level=high`.
4. If touching UI, test against `MOCK_MODE=true` and, when available, the real CR-N775 service.

Do not merge feature branches blindly. The protocol/service boundary is the main risk.
