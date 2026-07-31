import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const atlasPath = fileURLToPath(new URL("../spec/interface-capabilities.json", import.meta.url));
const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

const requiredDomains = [
  "records",
  "actions",
  "quantitative",
  "hierarchy",
  "network",
  "temporal",
  "spatial",
  "documents",
  "media",
  "communication",
  "simulation",
  "sensory-access",
  "authority-trust",
] as const;

const requiredOutputs = [
  "fact delta",
  "scope delta",
  "selection delta",
  "operation delta",
  "receipt",
] as const;

const allowedStatuses = new Set(["implemented", "partial", "missing", "external"]);

type Domain = {
  id?: unknown;
  examples?: unknown;
  semanticPrimitives?: unknown;
  status?: unknown;
  evidence?: unknown;
  missing?: unknown;
};

type Atlas = {
  version?: unknown;
  principle?: unknown;
  canonicalModel?: {
    transport?: unknown;
    surface?: unknown;
    renderer?: unknown;
    humanOutput?: unknown;
  };
  domains?: unknown;
  universalityRule?: {
    allowedStatuses?: unknown;
    requirements?: unknown;
  };
};

function fail(message: string): never {
  throw new Error(`Interface capability atlas invalid: ${message}`);
}

function strings(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((entry) => typeof entry !== "string" || !entry.trim())) {
    fail(`${label} must be a non-empty string array`);
  }
  return value as string[];
}

const atlas = JSON.parse(readFileSync(atlasPath, "utf8")) as Atlas;
if (atlas.version !== 1) fail("version must be 1");
if (typeof atlas.principle !== "string" || atlas.principle.length < 40) fail("principle must state the universal semantic model");
if (atlas.canonicalModel?.transport !== "M1") fail("M1 must remain the transport");
if (atlas.canonicalModel?.surface !== "JuanPage 2.0") fail("JuanPage 2.0 must remain the canonical public surface");
if (atlas.canonicalModel?.renderer !== "renderPage") fail("renderPage must remain the canonical renderer");

const humanOutputs = strings(atlas.canonicalModel?.humanOutput, "canonicalModel.humanOutput");
for (const output of requiredOutputs) if (!humanOutputs.includes(output)) fail(`missing typed human output: ${output}`);

if (!Array.isArray(atlas.domains)) fail("domains must be an array");
const domains = atlas.domains as Domain[];
const ids = new Set<string>();
const counts = { implemented: 0, partial: 0, missing: 0, external: 0 };

for (const [index, domain] of domains.entries()) {
  if (typeof domain.id !== "string" || !domain.id) fail(`domains[${index}].id must be a string`);
  if (ids.has(domain.id)) fail(`duplicate domain id: ${domain.id}`);
  ids.add(domain.id);
  strings(domain.examples, `${domain.id}.examples`);
  strings(domain.semanticPrimitives, `${domain.id}.semanticPrimitives`);
  if (typeof domain.status !== "string" || !allowedStatuses.has(domain.status)) fail(`${domain.id}.status is unsupported`);
  counts[domain.status as keyof typeof counts] += 1;

  if (domain.status === "implemented") {
    for (const evidence of strings(domain.evidence, `${domain.id}.evidence`)) {
      if (!existsSync(`${repositoryRoot}${evidence}`)) fail(`${domain.id} evidence does not exist: ${evidence}`);
    }
  }
  if (domain.status === "partial" || domain.status === "missing") strings(domain.missing, `${domain.id}.missing`);
  if (Array.isArray(domain.evidence)) {
    for (const evidence of domain.evidence) {
      if (typeof evidence !== "string" || !existsSync(`${repositoryRoot}${evidence}`)) fail(`${domain.id} evidence does not exist: ${String(evidence)}`);
    }
  }
}

for (const domain of requiredDomains) if (!ids.has(domain)) fail(`required domain is unaccounted for: ${domain}`);
if (ids.size !== requiredDomains.length) fail("additions to the domain taxonomy require an explicit requiredDomains update");

const declaredStatuses = new Set(strings(atlas.universalityRule?.allowedStatuses, "universalityRule.allowedStatuses"));
for (const status of allowedStatuses) if (!declaredStatuses.has(status)) fail(`universalityRule omits status: ${status}`);
strings(atlas.universalityRule?.requirements, "universalityRule.requirements");

const accounted = counts.implemented + counts.partial + counts.missing + counts.external;
if (accounted !== requiredDomains.length) fail("every required domain must have exactly one status");

console.log(
  `Universal interface atlas: ${accounted}/${requiredDomains.length} domains accounted for; `
  + `${counts.implemented} implemented, ${counts.partial} partial, ${counts.missing} missing, ${counts.external} external.`,
);
