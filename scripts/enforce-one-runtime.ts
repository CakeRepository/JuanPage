import { readFile } from "node:fs/promises";

const UNIVERSAL_SURFACES = [
  "src/app.ts",
  "src/builder.ts",
  "src/rendering/renderPage.ts",
  "src/state/pageState.ts",
  "scripts/encode.ts",
  "scripts/decode.ts",
  "tests/page.test.ts",
  "tests/renderPage.test.ts",
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

const FORBIDDEN_PUBLIC_VERSIONS = [
  'version: "0.1"',
  'version: "0.2"',
  'v=1',
  'v=2',
] as const;

const REQUIRED_IMPORTS: Record<string, readonly string[]> = {
  "src/app.ts": ["/schema/page", "/rendering/renderPage", "/encoding/pagePipeline"],
  "src/builder.ts": ["/schema/page", "/rendering/renderPage", "/encoding/pagePipeline"],
  "src/rendering/renderPage.ts": ["/schema/page", "/state/pageState"],
  "src/state/pageState.ts": ["/schema/page"],
  "scripts/encode.ts": ["/schema/page", "/encoding/pagePipeline"],
  "scripts/decode.ts": ["/encoding/pagePipeline"],
  "tests/page.test.ts": ["/schema/page", "/schema/errors", "/encoding/pagePipeline"],
  "tests/renderPage.test.ts": ["/rendering/renderPage"],
};

const failures: string[] = [];

for (const path of UNIVERSAL_SURFACES) {
  const source = await readFile(path, "utf8");

  for (const forbidden of FORBIDDEN_IMPORTS) {
    if (source.includes(forbidden)) {
      failures.push(`${path} imports retired public runtime path: ${forbidden}`);
    }
  }

  for (const version of FORBIDDEN_PUBLIC_VERSIONS) {
    if (source.includes(version)) {
      failures.push(`${path} exposes retired public format marker: ${version}`);
    }
  }

  for (const required of REQUIRED_IMPORTS[path] ?? []) {
    if (!source.includes(required)) {
      failures.push(`${path} must depend on the universal runtime path: ${required}`);
    }
  }
}

if (failures.length > 0) {
  console.error("JuanPager must expose exactly one public schema and one public runtime.\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("One-schema invariant verified across runtime, state, CLI, and tests.");
