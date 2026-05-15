# Project Repository

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

All agents should start from the same baseline commit. If the repo is empty, make an initial commit containing:

- `README.md`
- `o-control-desktop-companion-plan.md`
- `.agents/**`
- root `package.json`
- root `.gitignore`
- initial workspace folders

