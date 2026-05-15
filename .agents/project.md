# Project Repository

Status updated: 2026-05-15.

The MVP implementation is committed on `main` and verified against a real CR-N775.

Current baseline commits:

- `6579f7c` — Initial O-Control implementation
- `0e8d89e` — Document real receiver verification

New agents should branch from the latest `main` and use `.agents/task-index.md` to pick follow-up work.

Canonical repository:

```text
https://github.com/maxsaigon/o-controller.git
```

## Branching Convention

Use one branch per agent task:

```text
agent/01-reference-audit
agent/02-eiscp-protocol-package
agent/03-service-api
agent/04-desktop-ui-shell
agent/05-test-harness
agent/06-presets-shortcuts
agent/07-web-debug-ui
agent/08-docker-homelab
agent/09-raycast-extension
agent/10-now-playing
agent/11-nas-usb-browser-spike
```

Final integration branch:

```text
codex/integration-review
```

## Agent Baseline Rule

All agents should start from the latest clean `main`.

Historical note: if rebuilding from an empty repo, make an initial commit containing:

- `README.md`
- `o-control-desktop-companion-plan.md`
- `.agents/**`
- root `package.json`
- root `.gitignore`
- initial workspace folders
