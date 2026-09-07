#!/usr/bin/env python3
"""Forward command-only Claude Code hook input to the local HTTP logger.

Claude Code does not offer HTTP handlers for SessionStart and Setup.  This
adapter lets those events share the same NDJSON log while intentionally
discarding the server response: neither event has a useful control response.
"""

from __future__ import annotations

import os
import sys
from urllib.error import URLError
from urllib.request import Request, urlopen


endpoint = os.getenv("CLAUDE_HOOK_LOGGER_URL", "http://127.0.0.1:8765/hooks")
payload = sys.stdin.buffer.read()

try:
    request = Request(
        endpoint,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(request, timeout=5):
        pass
except (OSError, URLError):
    # Logging must never disrupt Claude Code startup or setup.
    pass
