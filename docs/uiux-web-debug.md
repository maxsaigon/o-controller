# O-Control Web Debug UI

The optional web debug UI lives in `apps/web`. It is a secondary service console for LAN debugging, not the primary desktop companion.

## Run

```bash
npm run dev -w @o-control/web
```

Open `http://127.0.0.1:5174`.

The UI defaults to `http://localhost:8787` for the service URL and stores edits in local storage under `o-control.debugServiceUrl`.

Visual QA screenshot: `docs/uiux-review/web-debug.png`.

## Scope

- State panel mirrors `GET /state`.
- Core controls call the existing `/commands/*` and `/presets/:id/run` endpoints.
- Raw event panel subscribes to `/events` and keeps the latest 80 state events.
- The layout is optimized for desktop and tablet debugging.

## Non-Goals

- It does not parse eISCP packets.
- It does not connect directly to the receiver.
- It does not replace the compact desktop companion UI.
