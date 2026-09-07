# Proposed agent-hook specification

This folder is reserved for the normative, cross-agent hook specification. It must not copy a single runtime's contract wholesale.

## Planned deliverables

- `spec.md` — lifecycle, transport, compatibility, and decision semantics.
- `schema/` — normative JSON Schema documents for event requests and responses.
- `examples/` — portable hook examples and conformance fixtures.
- `compatibility.md` — mapping from current agent implementations to the proposed model.

## Drafting principles

1. Every normative field must have a portable interoperability purpose.
2. Agent-specific data belongs in a namespaced extension object.
3. Events must state whether they are observational, pre-action, post-action, or controlling.
4. A schema alone is insufficient: timing, failure behavior, and decision precedence must be specified.
