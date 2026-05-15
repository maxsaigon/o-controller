# O-Control Parallel Agent Workspace

This folder contains task briefs for running multiple Claude Code agents in parallel.

The goal is to let each agent work on a bounded slice of O-Control, then return a patch/branch that can be reviewed and merged once at the end.

## Project Repository

```text
https://github.com/maxsaigon/o-controller.git
```

If this repo is still empty, create and commit the initial skeleton before assigning tasks to agents. Parallel agents should work from the same baseline commit.

## How To Use

1. Clone `https://github.com/maxsaigon/o-controller.git`.
2. Create the initial repo structure from `../o-control-desktop-companion-plan.md` if it does not exist yet.
3. Copy this `.agents` folder into the repo root.
4. Commit the initial skeleton.
5. Assign implementation work from `.agents/claude-code-tasks.md` to Claude Code agents.
6. Tell every agent:
   - You are not alone in the codebase.
   - Do not revert edits made by others.
   - Only edit files listed in your task ownership section.
   - If you need to touch another area, stop and report the need instead of changing it.
   - Return changed file paths, commands run, tests run, and unresolved risks.
7. Keep Codex-owned UI/UX work in `.agents/codex-uiux-tasks.md`.
8. After all tasks return, use `merge-review-checklist.md` for final review and integration.

## Recommended Parallel Batch

The task plan is split into two non-overlapping tracks:

- `claude-code-tasks.md`: code, protocol, service, tests, deployment, Raycast, backend metadata.
- `codex-uiux-tasks.md`: desktop UI/UX, visual design, interaction behavior, UI QA.

Start Claude Code with:

- Code Task 01: Reference Audit
- Code Task 02: eISCP Protocol Package
- Code Task 03: Core Service API
- Code Task 04: Mock Receiver And Integration Tests

Codex should own the UI/UX track from `codex-uiux-tasks.md`.

The older per-agent task files in `.agents/tasks/` are retained as granular references, but the two-track split above is the source of truth for avoiding overwrite conflicts.

## Merge Strategy

Use a single integration pass after agents finish:

1. Review protocol package first.
2. Integrate service API against protocol package.
3. Integrate desktop UI against service contract.
4. Integrate tests and mock receiver.
5. Integrate Docker/dev scripts.
6. Add Raycast/Web UI/Now Playing only after the core service is green.

Do not merge feature branches blindly. The protocol/service boundary is the main risk.
