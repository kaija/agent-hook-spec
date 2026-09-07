# Agent hook specification

This repository separates observed agent implementations from proposed portable hook extensions.

- [Why a specification is needed](docs/why-a-spec.md)
- [Current implementations](current/README.md)
- [Proposed specification](proposed/README.md)
- [Cross-agent event comparison](docs/comparisons/event-comparison.md)
- [Cross-agent tool-name comparison](docs/comparisons/tool-name-comparison.md)

The Claude Code material is a derived, implementation-specific contract, not an upstream official
schema. The proposal composes that baseline and adds only `trace_id`, `content_hash`, and response
`metadata`.

## Validation

```sh
npm ci
npm test
```
