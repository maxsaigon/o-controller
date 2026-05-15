# Task 08: Docker And Homelab Deployment

Status: Mostly complete.

Completed:

- Service Dockerfile.
- Docker Compose config.
- `.env.example`.
- Healthcheck and restart policy.
- README documents env-driven receiver host/port and verified local receiver command.

Not completed:

- Actual Docker build/compose smoke test has not been recorded in this workspace.
- N100-specific deployment runbook can be more detailed.

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

## Follow-Up Work

- Run `docker compose build` and `docker compose up` on the target host or a local Docker environment.
- Document exact Ubuntu 24.04/N100 deployment steps, including service update/restart workflow.

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
