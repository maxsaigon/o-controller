# Task 08: Docker And Homelab Deployment

## Goal

Package the service for Ubuntu/N100 homelab deployment.

## Ownership

You own:

- `infra/docker/**`
- Root Docker-related files if needed
- Deployment docs

Do not edit service logic except for minimal healthcheck support, and coordinate if needed.

## Work Items

- [ ] Add service Dockerfile.
- [ ] Add docker-compose.yml.
- [ ] Add `.env.example`.
- [ ] Add healthcheck.
- [ ] Add restart policy.
- [ ] Document LAN/Tailscale deployment.
- [ ] Document static IP requirement for CR-N775.
- [ ] Document why discovery is optional and IP config is preferred.

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

