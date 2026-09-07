# Agent hook specification

This repository separates observed agent implementations from the proposed portable hook specification.

- [Why a specification is needed](docs/why-a-spec.md)
- [Current implementations](current/README.md)
- [Proposed specification](proposed/README.md)

The Claude Code material is a derived, implementation-specific contract—not an upstream official schema.

## Runtime examples

- [Claude Code HTTP hook logger](examples/claude-code-http-logger/README.md): a
  fail-open FastAPI receiver and complete hook-settings fragment for collecting
  observed payloads as NDJSON while developing the schema.
