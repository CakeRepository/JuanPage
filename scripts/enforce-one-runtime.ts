import { access, readFile } from "node:fs/promises";

const UNIVERSAL_SURFACES = [
  "src/app.ts",
  "src/builder.ts",
  "src/rendering/renderPage.ts",
  "src/rendering/renderSemanticProjection.ts",
  "src/state/pageState.ts",
  "src/schema/value.ts",
  "src/schema/interaction.ts",
  "src/projection/universal.ts",
  "src/protocol/meaning.ts",
  "src/protocol/interaction.ts",
  "src/encoding/pagePipeline.ts",
  "src/transport/adapters.ts",
  "src/adapters/index.ts",
  "src/index.ts",
  "scripts/encode.ts",
  "scripts/decode.ts",
  "tests/page.test.ts",
  "tests/renderPage.test.ts",
  "tests/universal-value.test.ts",
  "tests/universal-projection.test.ts",
  "tests/universal-interaction.test.ts",
  "tests/meaning.test.ts",
  "tests/transport.test.ts",
  "tests/adapters.test.ts",
] as const;

const RETIRED_PATHS = [
  "src/components/registry.ts",
  "src/schema/document.ts",
  "src/schema/moment.ts",
  "src/schema/anyDocument.ts",
  "src/sources/DocumentSource.ts",
  "src/sources/FragmentDocumentSource.ts",
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

const FORBIDDEN_PUBLIC_VERSIONS = ['version: "0.1"', 'version: "0.2"', 'version: "1.0"', "v=1", "v=2", "v=3", "v=4"] as const;

const REQUIRED_IMPORTS: Record<string, readonly string[]> = {
  "src/app.ts": ["/schema/page", "/rendering/renderPage", "/encoding/pagePipeline", "/protocol/meaning", "/protocol/interaction", "/transport/adapters"],
  "src/builder.ts": ["/schema/page", "/rendering/renderPage", "/encoding/pagePipeline", "/protocol/meaning"],
  "src/rendering/renderPage.ts": ["/schema/page", "/state/pageState", "renderSemanticProjection"],
  "src/rendering/renderSemanticProjection.ts": ["/schema/page", "/schema/interaction", "/state/pageState"],
  "src/state/pageState.ts": ["/schema/page", "/schema/interaction"],
  "src/schema/value.ts": ["./limits", "./url"],
  "src/schema/interaction.ts": ["./value"],
  "src/projection/universal.ts": ["/schema/page", "/schema/value"],
  "src/protocol/meaning.ts": ["/schema/page"],
  "src/protocol/interaction.ts": ["./meaning", "/schema/interaction", "/state/pageState"],
  "src/encoding/pagePipeline.ts": ["/schema/page", "/protocol/meaning", "/protocol/interaction"],
  "src/transport/adapters.ts": ["/protocol/meaning"],
  "src/adapters/index.ts": ["/schema/page"],
  "scripts/encode.ts": ["/schema/page", "/encoding/pagePipeline", "/protocol/meaning"],
  "scripts/decode.ts": ["/encoding/pagePipeline"],
  "tests/page.test.ts": ["/schema/page", "/schema/errors", "/encoding/pagePipeline"],
  "tests/renderPage.test.ts": ["/rendering/renderPage", "/protocol/meaning"],
  "tests/universal-value.test.ts": ["/schema/page", "/protocol/meaning", "/rendering/renderPage"],
  "tests/universal-projection.test.ts": ["/projection/universal", "/schema/page"],
  "tests/universal-interaction.test.ts": ["/protocol/interaction", "/rendering/renderPage", "/state/pageState"],
  "tests/meaning.test.ts": ["/protocol/meaning", "/encoding/pagePipeline"],
  "tests/transport.test.ts": ["/transport/adapters", "/protocol/meaning"],
  "tests/adapters.test.ts": ["/adapters", "/protocol/meaning"],
};

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : undefined;
}

const failures: string[] = [];
for (const path of RETIRED_PATHS) {
  try { await access(path); failures.push(`retired parallel runtime file still exists: ${path}`); }
  catch (error) { if (errorCode(error) !== "ENOENT") throw error; }
}
for (const path of UNIVERSAL_SURFACES) {
  const source = await readFile(path, "utf8");
  for (const forbidden of FORBIDDEN_IMPORTS) if (source.includes(forbidden)) failures.push(`${path} imports retired public runtime path: ${forbidden}`);
  for (const version of FORBIDDEN_PUBLIC_VERSIONS) if (source.includes(version)) failures.push(`${path} exposes retired public format marker: ${version}`);
  for (const required of REQUIRED_IMPORTS[path] ?? []) if (!source.includes(required)) failures.push(`${path} must depend on the universal runtime path: ${required}`);
}

const sharedRenderContract = await readFile("src/rendering/render.ts", "utf8");
if (!sharedRenderContract.includes("applyTheme") || !sharedRenderContract.includes("RenderHandle")) failures.push("The shared render contract must expose only the trusted theme helper and render handle type.");
for (const retiredSymbol of ["renderDocument", "JuanPagerDocument", "ProductComponent", "localState", "collectProducts"] as const) if (sharedRenderContract.includes(retiredSymbol)) failures.push(`The shared render contract contains retired renderer behavior: ${retiredSymbol}`);

const indexHtml = await readFile("index.html", "utf8");
const builderHtml = await readFile("builder.html", "utf8");
for (const [path, source] of [["index.html", indexHtml], ["builder.html", builderHtml]] as const) {
  if (!source.includes('/src/universal.css')) failures.push(`${path} must load the canonical adaptive runtime stylesheet.`);
  if (source.includes('/src/styles.css') || source.includes('/src/welcome.css') || source.includes('/src/return.css')) failures.push(`${path} loads a retired visual system.`);
}

const pageSchema = await readFile("src/schema/page.ts", "utf8");
if (!pageSchema.includes('version: z.literal("2.0")')) failures.push("The canonical page schema must be JuanPage 2.0.");
for (const concept of ["pageAffordanceSchema", "pageBindingSchema", "pageScopeSchema", "pageProjectionSchema", "pageValueSchema", "pageInteractionStateSchema", "semanticProjectionSchema"] as const) if (!pageSchema.includes(concept)) failures.push(`JuanPage 2.0 must define or import ${concept}.`);
if (!pageSchema.includes('/value.js') || !pageSchema.includes('/interaction.js')) failures.push("JuanPage 2.0 must use the universal value and interaction algebras.");
if (pageSchema.includes("actionIds") || pageSchema.includes("pageActionSchema")) failures.push("JuanPage 2.0 may not retain the retired object-owned action model.");
if (pageSchema.includes("defaultLens") || pageSchema.includes("groupBy") || pageSchema.includes("density")) failures.push("JuanPage 2.0 may not let the producer author runtime layout modes.");

const valueSchema = await readFile("src/schema/value.ts", "utf8");
for (const tag of ["instant", "interval", "duration", "recurrence", "coordinate", "bounds", "path", "geometry", "content", "content-range", "media", "time-range", "quantity", "uncertainty", "distribution", "matrix"] as const) if (!valueSchema.includes(`z.literal("${tag}")`)) failures.push(`The universal value algebra is missing ${tag}.`);
if (valueSchema.includes("innerHTML") || valueSchema.includes("componentType") || valueSchema.includes("render:")) failures.push("Universal values must remain data-only and may not carry executable or component rendering instructions.");

const interactionSchema = await readFile("src/schema/interaction.ts", "utf8");
for (const domain of ["expansions", "paths", "viewports", "ranges", "playheads", "ordering", "groupings", "queries", "filters", "panels", "focus", "clocks"] as const) if (!interactionSchema.includes(`"${domain}"`)) failures.push(`The universal interaction state is missing ${domain}.`);

const projectionKernel = await readFile("src/projection/universal.ts", "utf8");
for (const family of ["categorical", "temporal", "matrix", "hierarchy", "network", "spatial", "document", "stream"] as const) if (!projectionKernel.includes(`z.literal("${family}")`)) failures.push(`The generalized projection algebra is missing ${family}.`);
for (const componentName of ["calendarComponent", "mapComponent", "chartComponent", "treeComponent", "chatComponent"] as const) if (projectionKernel.includes(componentName)) failures.push(`Projection semantics may not introduce component instruction ${componentName}.`);
if (!projectionKernel.includes("evaluateSemanticProjection")) failures.push("The generalized projection algebra must expose deterministic evaluation.");

const meaning = await readFile("src/protocol/meaning.ts", "utf8");
if (!meaning.includes("materializeMeaningPacket")) failures.push("M1 must materialize into JuanPage 2.0.");
for (const factory of ["createFactDelta", "createScopeDelta", "createSelectionDelta", "createActionDelta"] as const) if (!meaning.includes(factory)) failures.push(`M1 must expose typed human mutation factory ${factory}.`);
if (!meaning.includes("createActionReceipt")) failures.push("Executable M1 operations must produce receipts.");
if (meaning.includes("renderMeaning")) failures.push("M1 may not introduce a second renderer.");

const interactionProtocol = await readFile("src/protocol/interaction.ts", "utf8");
for (const factory of ["createInteractionStateDelta", "createPageTransactionDelta", "interactionStateFromPageDeltas"] as const) if (!interactionProtocol.includes(factory)) failures.push(`M1 interaction protocol must expose ${factory}.`);
if (!interactionProtocol.includes("createActionDelta") || !interactionProtocol.includes("validateMeaningDelta")) failures.push("Universal interaction state must travel through ordinary typed M1 action deltas.");

const stateEngine = await readFile("src/state/pageState.ts", "utf8");
for (const behavior of ["commitPageTransaction", "cancelPageTransaction", "undoPageTransaction", "redoPageTransaction", "PageTransactionConflictError"] as const) if (!stateEngine.includes(behavior)) failures.push(`The reversible state engine is missing ${behavior}.`);

const renderer = await readFile("src/rendering/renderPage.ts", "utf8");
if (!renderer.includes("PageBindingTarget") || !renderer.includes("PageAffordanceInvocation")) failures.push("renderPage must render from semantic bindings and affordances.");
if (!renderer.includes("renderSemanticProjection") || !renderer.includes("undoPageTransaction") || !renderer.includes("simulationClocks")) failures.push("renderPage must adapt generalized projections and reversible simulation state.");
if (renderer.includes("jp-u-lenses") || renderer.includes("setLens(")) failures.push("renderPage may not expose the retired agent-authored lens model.");

const semanticRenderer = await readFile("src/rendering/renderSemanticProjection.ts", "utf8");
for (const family of ["renderCategorical", "renderTemporal", "renderMatrix", "renderHierarchy", "renderNetwork", "renderSpatial", "renderDocument", "renderStream"] as const) if (!semanticRenderer.includes(family)) failures.push(`Adaptive projection rendering is missing ${family}.`);
if (semanticRenderer.includes("innerHTML") || semanticRenderer.includes("insertAdjacentHTML")) failures.push("Adaptive projection rendering must use the trusted DOM builder only.");

const universalCss = await readFile("src/universal.css", "utf8");
if (!universalCss.includes("prefers-reduced-motion") || !universalCss.includes("prefers-contrast")) failures.push("The universal visual system must preserve reduced-motion and high-contrast behavior.");

if (failures.length > 0) {
  console.error("JuanPager must expose exactly one semantic schema, one adaptive renderer, one reversible interaction engine, and one visual system.\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("One-schema invariant verified: M1 compiles into JuanPage 2.0; universal values and interaction state remain data-only; generalized projections adapt through renderPage; viewports, paths, ranges, playheads, ordering, focus, clocks, commit, cancel, undo, redo, conflicts, deltas, and receipts share one runtime; retired parallel systems remain absent.");
