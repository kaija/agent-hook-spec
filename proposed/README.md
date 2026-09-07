# Proposed agent-hook specification

This folder contains a Claude Code–based extension proposal. It keeps the current runtime contract
separate from fields added for portable tracing, content identity, and receiver metadata.

## Contents

- [Extension rationale and JSON diffs](spec.md)
- [Proposed JSON Schema](schema/hooks.schema.json)
- [Examples](examples/)
- [Compatibility mapping](compatibility.md)

## Drafting principles

1. Every normative field must have a portable interoperability purpose.
2. Agent-specific data belongs in a namespaced extension object.
3. Events must state whether they are observational, pre-action, post-action, or controlling.
4. A schema alone is insufficient: timing, failure behavior, and decision precedence must be specified.
