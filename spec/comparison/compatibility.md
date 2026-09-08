# Compatibility mapping (draft)

This document will map each current implementation to the proposed event and control model. It should distinguish exact mappings, lossy mappings, and unsupported capabilities.

| Current implementation | Status |
| --- | --- |
| Claude Code | Direct baseline; adds `trace_id` and `content_hash` to requests, and `metadata` to responses. |

See the [event comparison](event-comparison.md) and
[tool-name comparison](tool-name-comparison.md) for cross-agent mappings.
