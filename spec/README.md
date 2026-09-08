# Specification layout

```text
spec/
├── proposal.md    # The cross-agent specification (normative)
├── claude-code.md # Claude Code contract notes (descriptive)
├── extensions.md  # Claude Code extension rationale
├── schema/        # Baseline, proposed, and canonical JSON Schemas
├── examples/      # Valid payloads for all three schemas
└── comparison/    # Human-readable event and tool-name crosswalks
```

Start with [the proposal](proposal.md) for the canonical contract. See
[Claude Code contract notes](claude-code.md) for what one runtime does today, and the
[extension rationale](extensions.md) for the Claude Code-specific fields.
