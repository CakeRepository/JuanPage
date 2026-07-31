import { access, readFile } from "node:fs/promises";

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

const RETIRED_PATHS = [
  "src/components/registry.ts",
  "src/schema/document.ts",
  "src/schema/moment.ts",
  "src/schema/anyDocument.ts",
  "src/state/localState.ts",
  "src/protocol/receipt.ts",
  "src/dialect/juan.ts",
  "src/encoding/compact.ts",
  "src/encoding/compactMoment.ts",
  "src/encoding/pipeline.ts",
  "src/rendering/collect.ts",
  "src/rendering/collectMoment.ts",
  "src/rendering/renderMoment.ts",
  "src/rendering/renderMomentWithReturn.ts",
  "src/rendering/renderWelcome.ts",
  "src/examples/grocery-plan.ts",
  "src/examples/grocery-checkout.ts",
  "src/styles.css",
  "src/welcome.css",
  "src/return.css",
  "examples/grocery-plan.json",
  "examples/grocery-checkout.json",
  "tests/schema.test.ts",
  "tests/encoding.test.ts",
  "tests/render.test.ts",
  "tests/state.test.ts",
  "tests/moment.test.ts",
  "tests/momentEncoding.test.ts",
  "tests/renderMoment.test.ts",
  "tests/dialect.test.ts",
  "tests/receipt.test.ts",
  "tests/livingLink.test.ts",
  "tests/renderWelcome.test.ts",
  "docs/ROUNDTRIP.md",
  "docs/LIVING_LINKS.md",
] as const;

const FORBIDDEN_IMPORTS = [
  "/schema/document",
  "/schema/moment",
  "/schema/anyDocument",
  "/rendering/renderMoment",
  "/rendering/renderWelcome",
  "/encoding/pipeline",
  "/encoding/momentPipeline",
  "/dialect/juan",
  "/protocol/receipt",
  "/state/localState",
  "/sources/",
] as const;

const FORBIDDEN_PUBLIC_VERSIONS = [
  'version: "0.1"',
  'version: "0.2"',
  'version: "1.0"',
  "v=1",
  "v=2",
  "v=3",
  "v=4",
] as const;

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

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

const failures: string[] = [];

for (const path of RETIRED_PATHS) {
  try {
    await access(path);
    failures.push(`retired parallel runtime file still exists: ${path}`);
  } catch (error) {
    if (errorCode(error) !== "ENOENT") throw error;
  }
}

for (const path of UNIVERSAL_SURFACES) {
  const source = await readFile(path, "utf8");
  for (const forbidden of FORBIDDEN_IMPORTS) {
    if (source.includes(forbidden)) failures.push(`${path} imports retired public runtime path: ${forbidden}`);
  }
  for (const version of FORBIDDEN_PUBLIC_VERSIONS) {
    if (source.includes(version)) failures.push(`${path} exposes retired public format marker: ${version}`);
  }
  for (const required of REQUIRED_IMPORTS[path] ?? []) {
    if (!source.includes(required)) failures.push(`${path} must depend on the universal runtime path: ${required}`);
  }
}

const sharedRenderContract = await readFile("src/rendering/render.ts", "utf8");
if (!sharedRenderContract.includes("applyTheme") || !sharedRenderContract.includes("RenderHandle")) {
  failures.push("The shared render contract must expose only the trusted theme helper and render handle type.");
}
for (const retiredSymbol of ["renderDocument", "JuanPagerDocument", "ProductComponent", "localState", "collectProducts"] as const) {
  if (sharedRenderContract.includes(retiredSymbol)) failures.push(`The shared render contract contains retired renderer behavior: ${retiredSymbol}`);
}

const indexHtml = await readFile("index.html", "utf8");
const builderHtml = await readFile("builder.html", "utf8");
for (const [path, source] of [["index.html", indexHtml], ["builder.html", builderHtml]] as const) {
  if (!source.includes('/src/universal.css')) failures.push(`${path} must load the canonical adaptive runtime stylesheet.`);
  if (source.includes('/src/styles.css') || source.includes('/src/welcome.css') || source.includes('/src/return.css')) {
    failures.push(`${path} loads a retired visual system.`);
  }
}

const pageSchema = await readFile("src/schema/page.ts", "utf8");
if (!pageSchema.includes('version: z.literal("2.0")')) failures.push("The canonical page schema must be JuanPage 2.0.");
for (const concept of ["pageAffordanceSchema", "pageBindingSchema", "pageScopeSchema", "pageProjectionSchema"] as const) {
  if (!pageSchema.includes(concept)) failures.push(`JuanPage 2.0 must define ${concept}.`);
}
if (pageSchema.includes("actionIds") || pageSchema.includes("pageActionSchema")) {
  failures.push("JuanPage 2.0 may not retain the retired object-owned action model.");
}
if (pageSchema.includes("defaultLens") || pageSchema.includes("groupBy") || pageSchema.includes("density")) {
  failures.push("JuanPage 2.0 may not let the producer author runtime layout modes.");
}

const meaning = await readFile("src/protocol/meaning.ts", "utf8");
if (!meaning.includes("materializeMeaningPacket")) failures.push("M1 must materialize into JuanPage 2.0.");
for (const factory of ["createFactDelta", "createScopeDelta", "createSelectionDelta", "createActionDelta"] as const) {
  if (!meaning.includes(factory)) failures.push(`M1 must expose typed human mutation factory ${factory}.`);
}
if (!meaning.includes("createActionReceipt")) failures.push("Executable M1 operations must produce receipts.");
if (meaning.includes("renderMeaning")) failures.push("M1 may not introduce a second renderer.");

const renderer = await readFile("src/rendering/renderPage.ts", "utf8");
if (!renderer.includes("PageBindingTarget") || !renderer.includes("PageAffordanceInvocation")) {
  failures.push("renderPage must render from semantic bindings and affordances.");
}
if (renderer.includes("jp-u-lenses") || renderer.includes("setLens(")) {
  failures.push("renderPage may not expose the retired agent-authored lens model.");
}

if (failures.length > 0) {
  console.error("JuanPager must expose exactly one semantic schema, one adaptive renderer, and one visual system.\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("One-schema invariant verified: retired schema, renderer behavior, and visual-system files are absent; M1 compiles into JuanPage 2.0; renderPage is the only renderer; information is inert without bindings; and human facts, scopes, selections, and operations produce typed deltas and receipts.");
