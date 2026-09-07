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

const baselineSchema = await readJson("current/claude-code/hooks.schema.json");
const proposedSchema = await readJson("proposed/schema/hooks.schema.json");

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
ajv.addSchema(baselineSchema);

const validateBaselineRequest = ajv.getSchema(baselineSchema.$id);
const validateBaselineResponse = ajv.compile({
  $ref: `${baselineSchema.$id}#/$defs/responsesByEvent/PreToolUse`
});
const validateProposed = ajv.compile(proposedSchema);

const examples = [
  [validateBaselineRequest, "current/claude-code/examples/pre-tool-use.json"],
  [validateBaselineResponse, "current/claude-code/examples/pre-tool-use-response.json"],
  [validateProposed, "proposed/examples/pre-tool-use-with-trace.json"],
  [validateProposed, "proposed/examples/pre-tool-use-with-content-hash.json"],
  [validateProposed, "proposed/examples/pre-tool-use-response-with-metadata.json"]
];

for (const [validate, relativePath] of examples) {
  const value = await readJson(relativePath);
  assert(validate(value), `${relativePath}: ${ajv.errorsText(validate.errors)}`);
}

const baselineRequest = await readJson("current/claude-code/examples/pre-tool-use.json");
const baselineResponse = await readJson("current/claude-code/examples/pre-tool-use-response.json");
const invalidDirectionCases = [
  { ...baselineRequest, metadata: { auditId: "wrong-direction" } },
  { ...baselineResponse, trace_id: "wrong-direction" },
  { ...baselineResponse, content_hash: "0".repeat(64) }
];

for (const value of invalidDirectionCases) {
  assert(!validateProposed(value), "proposed schema accepted an extension field in the wrong direction");
}

const hashedRequest = await readJson("proposed/examples/pre-tool-use-with-content-hash.json");
const expectedHash = hashedRequest.content_hash;
delete hashedRequest.content_hash;
const actualHash = createHash("sha256").update(canonicalize(hashedRequest)).digest("hex");
assert.equal(actualHash, expectedHash, "content_hash example does not match its canonical request");

for (const relativePath of [
  "current/claude-code/hooks.schema.json",
  "proposed/schema/hooks.schema.json"
]) {
  const source = await readFile(path.join(root, relativePath), "utf8");
  assert(!/"escalation"\s*:/.test(source), `${relativePath} defines the removed escalation field`);
}

console.log(`Validated ${examples.length} examples, ${invalidDirectionCases.length} negative cases, and 2 schemas.`);
