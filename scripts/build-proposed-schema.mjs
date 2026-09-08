import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = path.join(root, "spec/schema/claude-code-hook.schema.json");
const proposedPath = path.join(root, "spec/schema/proposed-hook.schema.json");

const proposed = JSON.parse(await readFile(baselinePath, "utf8"));

async function readExample(name) {
  const examplePath = path.join(root, "spec/examples/proposed", name);
  return JSON.parse(await readFile(examplePath, "utf8"));
}

proposed.$id =
  "https://raw.githubusercontent.com/kaija/agent-hook-spec/main/spec/schema/proposed-hook.schema.json";
proposed.title = "Proposed Claude Code–Based Hook Schema";
proposed.$comment =
  "Self-contained Claude Code hook schema extended with trace_id, content_hash, and response metadata.";
proposed.description =
  "Complete Claude Code request and event-specific response schemas plus optional fields for " +
  "distributed tracing, content identity, and receiver processing metadata.";

const request = proposed.$defs.CommonRequest;
request.properties.trace_id = {
  type: "string",
  description: "Distributed trace identifier propagated across hook deliveries.",
  examples: ["tr-9b8c-1234-5678"]
};
request.properties.content_hash = {
  type: "string",
  pattern: "^[a-fA-F0-9]{64}$",
  description:
    "SHA-256 digest of the RFC 8785 canonicalized request object after removing content_hash.",
  examples: ["091beb03976dfcbfda17a51cc63db073353b2e971531c63f974aba155b3388f5"]
};
request.not = { required: ["metadata"] };

const response = proposed.$defs.ResponseBase;
response.properties.metadata = {
  $ref: "#/$defs/ResponseMetadata",
  examples: [
    {
      auditId: "aud-7788-9900-1122",
      latencyMs: 1.25,
      triggeredRules: ["rule_network_egress"]
    }
  ]
};
response.not = {
  anyOf: [{ required: ["trace_id"] }, { required: ["content_hash"] }]
};

proposed.$defs.ResponseMetadata = {
  type: "object",
  description: "Supplemental receiver processing information with no decision semantics.",
  additionalProperties: true,
  properties: {
    latencyMs: {
      type: "number",
      minimum: 0,
      description: "Receiver processing time in milliseconds.",
      examples: [1.25]
    },
    triggeredRules: {
      type: "array",
      description: "Security or governance rules matched while processing the event.",
      items: { type: "string" },
      examples: [["rule_network_egress"]]
    },
    auditId: {
      type: "string",
      description: "Receiver-side audit record identifier.",
      examples: ["aud-7788-9900-1122"]
    }
  }
};

proposed.$defs.requestsByEvent.SessionStart.examples = [
  await readExample("session-start-with-trace.json")
];
proposed.$defs.requestsByEvent.PreToolUse.examples = [
  await readExample("pre-tool-use-with-trace.json"),
  await readExample("pre-tool-use-with-content-hash.json")
];
proposed.$defs.responsesByEvent.PreToolUse.examples = [
  await readExample("pre-tool-use-response-with-metadata.json")
];
proposed.$defs.responsesByEvent.PostToolUse.examples = [
  await readExample("post-tool-use-response-with-metadata.json")
];

const output = `${JSON.stringify(proposed, null, 2)}\n`;

if (process.argv.includes("--check")) {
  const committed = await readFile(proposedPath, "utf8");
  assert.equal(committed, output, "proposed schema is stale; run npm run build:schema");
} else {
  await writeFile(proposedPath, output);
}
