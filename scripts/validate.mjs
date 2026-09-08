import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { canonicalize } from "json-canonicalize";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

async function readCapturedHookPayloads(relativePath) {
  let source;
  try {
    source = await readFile(path.join(root, relativePath), "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }

  return source
    .split("\n")
    .filter((line) => line.trim())
    .map((line, index) => {
      const record = JSON.parse(line);
      assert(
        record.request?.payload && typeof record.request.payload === "object",
        `${relativePath}:${index + 1} does not contain request.payload`
      );
      return { line: index + 1, eventName: record.event_name, payload: record.request.payload };
    });
}

function collectRefs(value, refs = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectRefs(item, refs);
  } else if (value && typeof value === "object") {
    if (typeof value.$ref === "string") refs.push(value.$ref);
    for (const item of Object.values(value)) collectRefs(item, refs);
  }
  return refs;
}

const baselineSchema = await readJson("spec/schema/claude-code-hook.schema.json");
const proposedSchema = await readJson("spec/schema/proposed-hook.schema.json");

assert.deepEqual(
  Object.keys(proposedSchema.$defs.requestsByEvent).sort(),
  Object.keys(baselineSchema.$defs.requestsByEvent).sort(),
  "proposed schema must include every baseline request event"
);
assert.deepEqual(
  Object.keys(proposedSchema.$defs.responsesByEvent).sort(),
  Object.keys(baselineSchema.$defs.responsesByEvent).sort(),
  "proposed schema must include every baseline response event"
);
assert(
  collectRefs(proposedSchema).every((ref) => ref.startsWith("#")),
  "proposed schema must be self-contained"
);

const requestProperties = proposedSchema.$defs.CommonRequest.properties;
const responseProperties = proposedSchema.$defs.ResponseBase.properties;
assert(requestProperties.trace_id?.examples?.length, "trace_id must include an inline example");
assert(requestProperties.content_hash?.examples?.length, "content_hash must include an inline example");
assert.equal(
  requestProperties.scratchpad_dir?.type,
  "string",
  "scratchpad_dir must be modeled as a common request field"
);
assert(responseProperties.metadata?.examples?.length, "metadata must include an inline example");
assert(
  proposedSchema.$defs.requestsByEvent.SessionStart.examples?.length,
  "SessionStart request must include a complete example"
);
assert(
  proposedSchema.$defs.requestsByEvent.PreToolUse.examples?.length >= 2,
  "PreToolUse request must include trace and content-hash examples"
);
assert(
  proposedSchema.$defs.responsesByEvent.PreToolUse.examples?.length,
  "PreToolUse response must include a metadata example"
);
assert(
  proposedSchema.$defs.responsesByEvent.PostToolUse.examples?.length,
  "PostToolUse response must include a metadata example"
);

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
ajv.addSchema(baselineSchema);
ajv.addSchema(proposedSchema);

const validators = {
  baselineRequest: ajv.getSchema(baselineSchema.$id),
  baselinePreToolResponse: ajv.getSchema(
    `${baselineSchema.$id}#/$defs/responsesByEvent/PreToolUse`
  ),
  proposedRequest: ajv.getSchema(proposedSchema.$id),
  proposedPreToolResponse: ajv.getSchema(
    `${proposedSchema.$id}#/$defs/responsesByEvent/PreToolUse`
  ),
  proposedPostToolResponse: ajv.getSchema(
    `${proposedSchema.$id}#/$defs/responsesByEvent/PostToolUse`
  )
};

const examples = [
  [validators.baselineRequest, "spec/examples/claude-code/pre-tool-use.json"],
  [validators.baselinePreToolResponse, "spec/examples/claude-code/pre-tool-use-response.json"],
  [validators.proposedRequest, "spec/examples/proposed/pre-tool-use-with-trace.json"],
  [validators.proposedRequest, "spec/examples/proposed/pre-tool-use-with-content-hash.json"],
  [validators.proposedRequest, "spec/examples/proposed/session-start-with-trace.json"],
  [validators.proposedPreToolResponse, "spec/examples/proposed/pre-tool-use-response-with-metadata.json"],
  [validators.proposedPostToolResponse, "spec/examples/proposed/post-tool-use-response-with-metadata.json"]
];

for (const [validate, relativePath] of examples) {
  assert(validate, `validator not found for ${relativePath}`);
  const value = await readJson(relativePath);
  assert(validate(value), `${relativePath}: ${ajv.errorsText(validate.errors)}`);
}

const capturedPayloads = await readCapturedHookPayloads(
  "examples/claude-code-http-logger/hook-logs/claude-code-hooks.ndjson"
);
for (const { line, eventName, payload } of capturedPayloads) {
  assert(
    validators.baselineRequest(payload),
    `captured ${eventName} payload at line ${line}: ${ajv.errorsText(
      validators.baselineRequest.errors
    )}`
  );
  assert(
    validators.proposedRequest(payload),
    `captured ${eventName} payload at line ${line} is invalid for the proposed schema: ${ajv.errorsText(
      validators.proposedRequest.errors
    )}`
  );
}

const baselineRequest = await readJson("spec/examples/claude-code/pre-tool-use.json");
const baselineResponse = await readJson("spec/examples/claude-code/pre-tool-use-response.json");
const invalidSchemaCases = [
  { ...baselineRequest, metadata: { auditId: "wrong-direction" } },
  { ...baselineResponse, trace_id: "wrong-direction" },
  { ...baselineResponse, content_hash: "0".repeat(64) },
  { ...baselineRequest, content_hash: "not-a-sha256-digest" },
  { ...baselineResponse, metadata: { latencyMs: -1 } },
  { ...baselineResponse, metadata: { triggeredRules: [42] } }
];

for (const value of invalidSchemaCases) {
  if (value.hook_event_name) {
    assert(!validators.proposedRequest(value), "request schema accepted an invalid extension value");
  } else {
    assert(
      !validators.proposedPreToolResponse(value),
      "response schema accepted an invalid extension value"
    );
  }
}

const hashedRequest = await readJson("spec/examples/proposed/pre-tool-use-with-content-hash.json");
const expectedHash = hashedRequest.content_hash;
const canonicalRequest = { ...hashedRequest };
delete canonicalRequest.content_hash;
const actualHash = createHash("sha256").update(canonicalize(canonicalRequest)).digest("hex");
assert.equal(actualHash, expectedHash, "content_hash example does not match its canonical request");

const tamperedRequest = structuredClone(hashedRequest);
tamperedRequest.tool_input.command = "curl https://unapproved.example";
delete tamperedRequest.content_hash;
const tamperedHash = createHash("sha256").update(canonicalize(tamperedRequest)).digest("hex");
assert.notEqual(tamperedHash, expectedHash, "content_hash failed to detect a mutated request");

for (const relativePath of [
  "spec/schema/claude-code-hook.schema.json",
  "spec/schema/proposed-hook.schema.json"
]) {
  const source = await readFile(path.join(root, relativePath), "utf8");
  assert(!/"escalation"\s*:/.test(source), `${relativePath} defines the removed escalation field`);
}

// --- Canonical cross-agent schema (spec/proposal.md) -------------------------

const canonicalSchema = await readJson("spec/schema/agent-hook.schema.json");

assert(
  collectRefs(canonicalSchema).every((ref) => ref.startsWith("#")),
  "canonical schema must be self-contained"
);

const coreEvents = canonicalSchema.$defs.CoreEventName.enum;
assert.equal(coreEvents.length, 13, "proposal.md section 3.1 defines thirteen Core events");
assert.deepEqual(
  Object.keys(canonicalSchema.$defs.requestsByEvent).sort(),
  [...coreEvents].sort(),
  "canonical schema must define a request for every Core event"
);
assert.deepEqual(
  Object.keys(canonicalSchema.$defs.verdictsByEvent)
    .filter((key) => !key.startsWith("$"))
    .sort(),
  [...coreEvents].sort(),
  "canonical schema must define a verdict for every Core event"
);
assert.deepEqual(
  [...canonicalSchema.$defs.ConformanceDeclaration.properties.core_events.required].sort(),
  [...coreEvents].sort(),
  "a declaration must list every Core event (proposal.md section 13.1)"
);

// proposal.md section 5.5: six events declare a $target, seven forbid transform.
const transformAllowed = Object.entries(canonicalSchema.$defs.verdictsByEvent)
  .filter(([key, value]) => !key.startsWith("$") && value.$ref === "#/$defs/Verdict")
  .map(([key]) => key);
assert.deepEqual(
  transformAllowed.sort(),
  [
    "AfterModelResponse",
    "BeforeModelRequest",
    "PostToolUse",
    "PostToolUseFailure",
    "PreToolUse",
    "UserPromptSubmit"
  ],
  "the $target table in proposal.md section 5.5 must match verdictsByEvent"
);

ajv.addSchema(canonicalSchema);

const canonical = {
  request: ajv.getSchema(canonicalSchema.$id),
  verdict: ajv.getSchema(`${canonicalSchema.$id}#/$defs/Verdict`),
  declaration: ajv.getSchema(`${canonicalSchema.$id}#/$defs/ConformanceDeclaration`),
  synthesized: ajv.getSchema(`${canonicalSchema.$id}#/$defs/SynthesizedVerdict`),
  verdictFor: (event) =>
    ajv.getSchema(`${canonicalSchema.$id}#/$defs/verdictsByEvent/${event}`),
  requestFor: (event) =>
    ajv.getSchema(`${canonicalSchema.$id}#/$defs/requestsByEvent/${event}`)
};

const canonicalRequestVectors = {
  SessionStart: "session-start.json",
  UserPromptSubmit: "user-prompt-submit.json",
  BeforeModelRequest: "before-model-request.json",
  AfterModelResponse: "after-model-response.json",
  PreToolUse: "pre-tool-use.json",
  PostToolUse: "post-tool-use.json",
  PostToolUseFailure: "post-tool-use-failure.json",
  PermissionRequest: "permission-request.json",
  PermissionDenied: "permission-denied.json",
  SubagentStart: "subagent-start.json",
  SubagentStop: "subagent-stop.json",
  Stop: "stop.json",
  SessionEnd: "session-end.json"
};

assert.deepEqual(
  Object.keys(canonicalRequestVectors).sort(),
  [...coreEvents].sort(),
  "every Core event must have a reference vector (proposal.md section 13.2)"
);

let canonicalChecks = 0;
for (const [event, file] of Object.entries(canonicalRequestVectors)) {
  const value = await readJson(`spec/examples/agent-hook/${file}`);
  const eventValidator = canonical.requestFor(event);
  assert(eventValidator, `no request validator for ${event}`);
  assert(eventValidator(value), `${file}: ${ajv.errorsText(eventValidator.errors)}`);
  assert(canonical.request(value), `${file} (root): ${ajv.errorsText(canonical.request.errors)}`);
  canonicalChecks += 2;
}

for (const [file, validator] of [
  ["verdict-observe.json", canonical.verdict],
  ["verdict-deny.json", canonical.verdictFor("PreToolUse")],
  ["verdict-ask.json", canonical.verdictFor("PermissionRequest")],
  ["verdict-transform-redact.json", canonical.verdictFor("PostToolUse")],
  ["verdict-transform-whole-target.json", canonical.verdictFor("PreToolUse")],
  ["conformance-declaration.json", canonical.declaration],
  ["synthesized-verdict-timeout.json", canonical.synthesized],
  ["pre-tool-use-with-content-hash.json", canonical.request]
]) {
  const value = await readJson(`spec/examples/agent-hook/${file}`);
  assert(validator(value), `${file}: ${ajv.errorsText(validator.errors)}`);
  canonicalChecks += 1;
}

const canonicalPreToolUse = await readJson("spec/examples/agent-hook/pre-tool-use.json");
const canonicalDeclaration = await readJson("spec/examples/agent-hook/conformance-declaration.json");

function without(value, key) {
  const copy = structuredClone(value);
  delete copy[key];
  return copy;
}

const canonicalNegativeCases = [
  [canonical.request, without(canonicalPreToolUse, "spec"), "request without spec"],
  [canonical.request, { ...canonicalPreToolUse, sequence: -1 }, "negative sequence"],
  [canonical.request, { ...canonicalPreToolUse, hook_event_name: "NotAnEvent" }, "unregistered event name"],
  [
    canonical.request,
    { ...canonicalPreToolUse, trace: { trace_id: "0".repeat(32), span_id: "00f067aa0ba902b7" } },
    "all-zero trace_id"
  ],
  [
    canonical.requestFor("PermissionDenied"),
    without(await readJson("spec/examples/agent-hook/permission-denied.json"), "denied_by"),
    "PermissionDenied without denied_by"
  ],
  [canonical.verdict, { decision: "block" }, "decision outside the closed vocabulary"],
  [canonical.verdict, { decision: "deny", reason: "host_error:hook_failed" }, "hook emitting a reserved reason"],
  [
    canonical.verdict,
    { decision: "allow", transform: [{ path: "$target.command", value: "x" }] },
    "transform path that is not an RFC 6901 pointer"
  ],
  [
    canonical.verdictFor("SessionStart"),
    { decision: "allow", transform: [{ path: "", value: {} }] },
    "transform on an event with no $target"
  ],
  [
    canonical.declaration,
    {
      ...canonicalDeclaration,
      core_events: without(canonicalDeclaration.core_events, "PreToolUse")
    },
    "declaration omitting a Core event"
  ],
  [
    canonical.declaration,
    { ...canonicalDeclaration, enforcement_modes: ["evaluate_only"] },
    "declaration without enforce mode"
  ]
];

for (const [validate, value, label] of canonicalNegativeCases) {
  assert(!validate(value), `canonical schema accepted an invalid case: ${label}`);
}

// proposal.md section 5.4.1: overlap is token-wise, never string prefix.
function pointerTokens(pointer) {
  return pointer === "" ? [] : pointer.slice(1).split("/");
}

function pointersOverlap(a, b) {
  const left = pointerTokens(a);
  const right = pointerTokens(b);
  const shorter = left.length <= right.length ? left : right;
  const longer = left.length <= right.length ? right : left;
  return shorter.every((token, index) => token === longer[index]);
}

const overlapCases = [
  ["/stdout", "/stderr", false],
  ["", "/stdout", true],
  ["/stdout", "/stdout/0", true],
  ["/foo", "/foobar", false],
  ["/a/b", "/a/b", true]
];

for (const [a, b, expected] of overlapCases) {
  assert.equal(pointersOverlap(a, b), expected, `overlap(${a}, ${b}) should be ${expected}`);
  assert.equal(pointersOverlap(b, a), expected, `overlap must be symmetric: ${b}, ${a}`);
}

// The shipped multi-op verdict must not self-overlap (proposal.md section 5.4).
const redactOps = (await readJson("spec/examples/agent-hook/verdict-transform-redact.json")).transform;
for (let i = 0; i < redactOps.length; i += 1) {
  for (let j = i + 1; j < redactOps.length; j += 1) {
    assert(
      !pointersOverlap(redactOps[i].path, redactOps[j].path),
      "verdict-transform-redact.json contains overlapping operations"
    );
  }
}

const canonicalHashed = await readJson("spec/examples/agent-hook/pre-tool-use-with-content-hash.json");
const canonicalExpectedHash = canonicalHashed.content_hash;
const canonicalUnhashed = { ...canonicalHashed };
delete canonicalUnhashed.content_hash;
assert.equal(
  createHash("sha256").update(canonicalize(canonicalUnhashed)).digest("hex"),
  canonicalExpectedHash,
  "canonical content_hash example does not match its canonical request"
);

console.log(
  `Validated ${examples.length} examples, ${invalidSchemaCases.length + 1} negative cases, ` +
    `${capturedPayloads.length} captured payloads, complete event parity, and 2 self-contained schemas.`
);
console.log(
  `Validated ${canonicalChecks} canonical vectors, ${canonicalNegativeCases.length} negative cases, ` +
    `${overlapCases.length} pointer-overlap cases, and 13 Core events against the canonical schema.`
);

// --- Registry consistency (proposal.md, comparison tables, canonical schema) --

async function readText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function sectionBetween(source, startPattern, endPattern) {
  const start = source.search(startPattern);
  assert(start >= 0, `section start not found: ${startPattern}`);
  const rest = source.slice(start);
  const end = endPattern ? rest.slice(1).search(endPattern) : -1;
  return end >= 0 ? rest.slice(0, end + 1) : rest;
}

function eventNamesInTableRows(section) {
  return section
    .split("\n")
    .map((line) => line.match(/^\| `([A-Z][A-Za-z]*)` \|/))
    .filter(Boolean)
    .map((match) => match[1]);
}

const proposal = await readText("spec/proposal.md");
const eventComparison = await readText("spec/comparison/event-comparison.md");

// The comparison table is the registry (proposal.md section 3.2); its Tier column is normative.
const comparisonRows = eventComparison
  .split("\n")
  .map((line) => line.match(/^\| `([A-Z][A-Za-z]*)` \| (\*\*Core\*\*|Extended) \|/))
  .filter(Boolean)
  .map((match) => ({ name: match[1], tier: match[2] === "**Core**" ? "Core" : "Extended" }));

const comparisonCore = comparisonRows.filter((row) => row.tier === "Core").map((row) => row.name);
const comparisonExtended = comparisonRows
  .filter((row) => row.tier === "Extended")
  .map((row) => row.name);

assert.equal(
  comparisonRows.length,
  coreEvents.length + canonicalSchema.$defs.ExtendedEventName.enum.length,
  "every row of the event comparison table must carry a Tier annotation"
);

const proposalCore = eventNamesInTableRows(
  sectionBetween(proposal, /^### 3\.1 Core events/m, /^### 3\.2 /m)
);

const proposalExtended = [
  ...sectionBetween(proposal, /^### 3\.2 Extended events/m, /^### 3\.3 /m).matchAll(
    /`([A-Z][A-Za-z]*)`/g
  )
].map((match) => match[1]);

const annexBCore = eventNamesInTableRows(sectionBetween(proposal, /^## Annex B/m, null));

const sorted = (values) => [...values].sort();
const schemaCore = sorted(coreEvents);
const schemaExtended = sorted(canonicalSchema.$defs.ExtendedEventName.enum);

for (const [label, actual] of [
  ["comparison table Tier column", sorted(comparisonCore)],
  ["proposal.md section 3.1 table", sorted(proposalCore)],
  ["proposal.md Annex B table", sorted(annexBCore)]
]) {
  assert.deepEqual(actual, schemaCore, `${label} must list exactly the 13 Core events`);
}

for (const [label, actual] of [
  ["comparison table Tier column", sorted(comparisonExtended)],
  ["proposal.md section 3.2 prose", sorted(proposalExtended)]
]) {
  assert.deepEqual(actual, schemaExtended, `${label} must list exactly the Extended registry`);
}

// The tool comparison classifies retrieval tools, which section 3.1 defers to tool naming
// because AI Data Retrieval (OCSF 6005) has no lifecycle event of its own.
const toolComparison = await readText("spec/comparison/tool-name-comparison.md");
const retrievalRows = [...toolComparison.matchAll(/^\| ([^|]+?) \| \*\*Data Retrieval \(6005\)\*\* \|/gm)].map(
  (match) => match[1]
);
assert.deepEqual(
  retrievalRows.sort(),
  ["File glob", "Read file", "Text search", "Web fetch", "Web search"],
  "the tool comparison must classify exactly the retrieval capabilities as OCSF 6005"
);

console.log(
  `Validated the event registry across 5 sources (${schemaCore.length} Core, ` +
    `${schemaExtended.length} Extended) and ${retrievalRows.length} retrieval tool classifications.`
);
