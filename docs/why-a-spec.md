# Why define an agent-hook specification?

Agent hooks let a host expose lifecycle events—such as a user submitting a prompt, an agent requesting permission, or a tool completing—to external policy and automation code. Today, each agent runtime chooses its own event names, payload shape, decision vocabulary, delivery mechanism, and lifecycle guarantees.

That fragmentation makes a hook portable only in appearance. A policy written for one runtime can silently fail in another because the target runtime may omit a field, use a different meaning for a similar event, treat an exit code differently, or expose the event only after the action has already occurred.

## Goals

- Define a stable event vocabulary and lifecycle model.
- Define transport-neutral request and response envelopes.
- Make control semantics explicit: observe, enrich, transform, allow, deny, defer, and stop.
- Support tool-specific and vendor-specific extensions without breaking portable hooks.
- Make compatibility and version negotiation testable.

## Non-goals

- Replace an agent's native configuration format or permission model.
- Standardize every built-in tool's argument and result schema.
- Require agents to implement every event.
- Hide meaningful behavioral differences behind a falsely identical schema.

## Approach

The `current/` directory preserves implementation-specific evidence. The `proposed/` directory is deliberately separate so the cross-agent design can be reviewed on its own merits, with every proposed field traced to an interoperability need rather than mistaken for existing behavior.
