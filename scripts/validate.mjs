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

console.log(
  `Validated ${examples.length} examples, ${invalidSchemaCases.length + 1} negative cases, ` +
    `${capturedPayloads.length} captured payloads, complete event parity, and 2 self-contained schemas.`
);
