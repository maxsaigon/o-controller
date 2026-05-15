# NAS/USB Browser Spike

## Purpose

Evaluate whether implementing a NAS/USB file browser is worthwhile for O-Control, given the UX cost and protocol complexity.

## Background

The Onkyo CR-N775 supports browsing NAS shares and USB storage through the `NLS` (Net/USB List Info) and `NLA` (Net/USB List Activity) commands. These are used by apps like `onpc` to provide a file/folder navigation UI.

## eISCP Commands Involved

| Command | Direction | Description |
|---------|-----------|-------------|
| `NLS` | Receiver → Client | List info (line of text with metadata) |
| `NLA` | Client → Receiver | List action (select item, navigate, etc.) |
| `NLT` | Receiver → Client | List title info |

### NLS Format (observed from `onpc`)

```
NLS<type><cursor_position><line_info><text>
```

- `type`: 'C' (cursor), 'U' (Unicode), etc.
- The protocol is stateful: navigation requires tracking cursor position and page state.

### Navigation Model

1. Send `NLA` to enter a directory or select a service
2. Receiver responds with a sequence of `NLS` messages (one per list item)
3. Client must assemble the full list from individual messages
4. Send `NLA` with item index to navigate deeper or play

## Key Observations

- **Stateful protocol:** Unlike simple command/response, the list browser maintains server-side cursor state
- **Pagination:** Large directories are paginated; client must request more pages
- **Asynchronous:** List items arrive as individual messages, not as a single response
- **Model-dependent:** Behavior varies across firmware versions
- **Loading states:** Can be slow for large NAS directories

## UX Cost Assessment

| Factor | Impact |
|--------|--------|
| Implementation complexity | High — stateful navigation, async list assembly |
| Protocol documentation | Low — must reverse-engineer from `onpc` and real device |
| Testing | Requires real CR-N775 with NAS/USB attached |
| User value | Medium — most users use streaming services via NET |
| Maintenance | High — firmware-dependent behavior |

## Recommendation

**Postpone.** The NAS/USB browser adds significant complexity for a use case that most users can handle through the receiver's front panel or existing apps. O-Control should focus on its core value: fast, keyboard-driven control from macOS.

If demand emerges later:
1. Capture raw `NLS`/`NLA` logs from a real CR-N775 session
2. Implement a minimal list view (flat, no deep nesting)
3. Consider it a "power user" feature behind a feature flag

## Required Before Implementation

- [ ] Real CR-N775 `NLS`/`NLA` log capture
- [ ] Confirm pagination behavior
- [ ] Confirm Unicode handling in list items
- [ ] Test with various NAS configurations (SMB, DLNA)
- [ ] Determine if the feature justifies the engineering cost
