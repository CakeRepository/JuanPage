import { readFile } from "node:fs/promises";

const PUBLIC_ENTRYPOINTS = [
  "src/app.ts",
  "src/builder.ts",
  "scripts/encode.ts",
  "scripts/decode.ts",
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
  "scripts/encode.ts": ["/schema/page", "/encoding/pagePipeline"],
  "scripts/decode.ts": ["/encoding/pagePipeline"],
};

const failures: string[] = [];

for (const path of PUBLIC_ENTRYPOINTS) {
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

console.log("One-schema invariant verified: JuanPage 1.0 + universal runtime only.");
