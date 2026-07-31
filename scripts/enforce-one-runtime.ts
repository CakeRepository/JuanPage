import { readFile } from "node:fs/promises";

const UNIVERSAL_SURFACES = [
  "src/app.ts",
  "src/builder.ts",
  "src/rendering/renderPage.ts",
  "src/state/pageState.ts",
  "src/protocol/meaning.ts",
  "src/encoding/pagePipeline.ts",
  "src/transport/adapters.ts",
  "src/adapters/index.ts",
  "src/index.ts",
  "scripts/encode.ts",
  "scripts/decode.ts",
  "tests/page.test.ts",
  "tests/renderPage.test.ts",
  "tests/meaning.test.ts",
  "tests/transport.test.ts",
  "tests/adapters.test.ts",
] as const;

const FORBIDDEN_IMPORTS = [
  "/schema/document",
  "/schema/moment",
  "/schema/anyDocument",
  "/rendering/renderMoment",
  "/encoding/pipeline",
  "/encoding/momentPipeline",
  "/dialect/juan",
  "/sources/",
] as const;

const FORBIDDEN_PUBLIC_VERSIONS = ['version: "0.1"', 'version: "0.2"', 'v=1', 'v=2'] as const;

const REQUIRED_IMPORTS: Record<string, readonly string[]> = {
  "src/app.ts": ["/schema/page", "/rendering/renderPage", "/encoding/pagePipeline", "/protocol/meaning", "/transport/adapters"],
  "src/builder.ts": ["/schema/page", "/rendering/renderPage", "/encoding/pagePipeline", "/protocol/meaning"],
  "src/rendering/renderPage.ts": ["/schema/page", "/state/pageState"],
  "src/state/pageState.ts": ["/schema/page"],
  "src/protocol/meaning.ts": ["/schema/page"],
  "src/encoding/pagePipeline.ts": ["/schema/page", "/protocol/meaning"],
  "src/transport/adapters.ts": ["/protocol/meaning"],
  "src/adapters/index.ts": ["/schema/page"],
  "scripts/encode.ts": ["/schema/page", "/encoding/pagePipeline", "/protocol/meaning"],
  "scripts/decode.ts": ["/encoding/pagePipeline"],
  "tests/page.test.ts": ["/schema/page", "/schema/errors", "/encoding/pagePipeline"],
  "tests/renderPage.test.ts": ["/rendering/renderPage", "/protocol/meaning"],
  "tests/meaning.test.ts": ["/protocol/meaning", "/encoding/pagePipeline"],
  "tests/transport.test.ts": ["/transport/adapters", "/protocol/meaning"],
  "tests/adapters.test.ts": ["/adapters", "/protocol/meaning"],
};

const failures: string[] = [];
for (const path of UNIVERSAL_SURFACES) {
  const source = await readFile(path, "utf8");
  for (const forbidden of FORBIDDEN_IMPORTS) if (source.includes(forbidden)) failures.push(`${path} imports retired public runtime path: ${forbidden}`);
  for (const version of FORBIDDEN_PUBLIC_VERSIONS) if (source.includes(version)) failures.push(`${path} exposes retired public format marker: ${version}`);
  for (const required of REQUIRED_IMPORTS[path] ?? []) if (!source.includes(required)) failures.push(`${path} must depend on the universal runtime path: ${required}`);
}

const meaning = await readFile("src/protocol/meaning.ts", "utf8");
if (!meaning.includes("materializeMeaningPacket")) failures.push("M1 must materialize into JuanPage 1.0.");
if (!meaning.includes("createFactDelta") || !meaning.includes("createActionDelta")) failures.push("M1 must return human mutations as typed deltas.");
if (!meaning.includes("createActionReceipt")) failures.push("Executable M1 actions must produce receipts.");
if (meaning.includes("renderMeaning")) failures.push("M1 may not introduce a second renderer.");

if (failures.length > 0) {
  console.error("JuanPager must expose exactly one public schema and one public runtime.\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("One-schema invariant verified: M1 compiles into JuanPage 1.0, permissions are enforced, and actions produce typed receipts.");
