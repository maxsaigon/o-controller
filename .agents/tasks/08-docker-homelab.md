# Task 08: Docker And Homelab Deployment

Status: Completed for docs and repo packaging. Deployment smoke validation remains.

Completed:

- Service Dockerfile.
- Docker Compose config.
- `.env.example`.
- Healthcheck and restart policy.
- README documents env-driven receiver host/port and verified local receiver command.
- N100 deployment runbook at `docs/deployment-n100.md`.

Not completed:

- Actual Docker build/compose smoke test has not been recorded in this workspace.

## Goal

Package the service for Ubuntu/N100 homelab deployment.

## Ownership

You own:

- `infra/docker/**`
- Root Docker-related files if needed
- Deployment docs

Do not edit service logic except for minimal healthcheck support, and coordinate if needed.

## Work Items

- [x] Add service Dockerfile.
- [x] Add docker-compose.yml.
- [x] Add `.env.example`.
- [x] Add healthcheck.
- [x] Add restart policy.
- [x] Document LAN/Tailscale deployment.
- [x] Document static IP requirement for CR-N775.
- [x] Document why discovery is optional and IP config is preferred.
- [x] Document Ubuntu 24.04/N100 deployment, update, monitoring, and troubleshooting workflow.

## Follow-Up Work

- Run `docker compose build` and `docker compose up` on the target host or a local Docker environment.
- Record a Docker build/compose smoke test on local Docker or the target N100 host.

## Acceptance Criteria

- Service can be built as Docker image.
- Compose config uses env vars for receiver host/port.
- No secrets are committed.
- Docs include Ubuntu 24.04/N100 deployment notes.

## Return Format

Return:

- Files changed
- Build/run commands
- Tests or smoke checks run
- Deployment risks
