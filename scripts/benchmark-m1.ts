import { mkdir, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { performance } from "node:perf_hooks";
import { JSDOM } from "jsdom";
import { deploymentReferencePacket } from "../src/examples/reference-deployment.js";
import { materializeMeaningPacket, validateMeaningPacket } from "../src/protocol/meaning.js";
import { validatePage } from "../src/schema/page.js";
import { renderPage } from "../src/rendering/renderPage.js";

const runs = process.argv.includes("--smoke") ? 3 : 100;
const page = materializeMeaningPacket(deploymentReferencePacket);
const componentTree = {
  type: "Page",
  props: { title: page.title, intent: page.intent },
  children: page.objects.map((object) => ({
    type: "Card",
    key: object.id,
    props: { name: object.name, status: object.status, tone: object.tone },
    children: [
      ...(object.fields ?? []).map((field) => ({ type: "Field", key: field.key, props: field })),
      ...(page.bindings ?? [])
        .filter((binding) => (binding.target.kind === "object" || binding.target.kind === "field") && binding.target.object === object.id)
        .map((binding) => ({ type: "Control", key: binding.id, props: { binding, affordance: page.affordances?.find((item) => item.id === binding.affordance) } })),
    ],
  })),
};
const naturalLanguage = [
  `Create an adaptive interface titled ${page.title}. Do not expose any interaction unless it is explicitly described.`,
  ...page.objects.map((object) => `Show ${object.type} ${object.name} with status ${object.status ?? "none"}; fields: ${(object.fields ?? []).map((field) => `${field.key}=${String(field.value)}`).join(", ") || "none"}.`),
  ...(page.affordances ?? []).map((affordance) => `Provide semantic affordance ${affordance.id} labeled ${affordance.label} with effect ${affordance.effect.kind} and input ${affordance.input.kind}.`),
  ...(page.bindings ?? []).map((binding) => `Bind affordance ${binding.affordance} to ${JSON.stringify(binding.target)}.`),
].join("\n");

const formats = {
  m1: deploymentReferencePacket,
  juanPage: page,
  componentTree,
  naturalLanguage,
} as const;

function serialized(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function approximateTokens(value: string): number {
  return Math.ceil(new TextEncoder().encode(value).byteLength / 4);
}

function measure(operation: () => void): Readonly<{ meanMs: number; minMs: number; maxMs: number }> {
  const samples: number[] = [];
  for (let index = 0; index < runs; index += 1) {
    const start = performance.now();
    operation();
    samples.push(performance.now() - start);
  }
  return {
    meanMs: samples.reduce((sum, value) => sum + value, 0) / samples.length,
    minMs: Math.min(...samples),
    maxMs: Math.max(...samples),
  };
}

function renderBenchmark(): void {
  const dom = new JSDOM("<!doctype html><main id=app></main>", { url: "https://benchmark.invalid" });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    localStorage: dom.window.localStorage,
    CustomEvent: dom.window.CustomEvent,
    HTMLElement: dom.window.HTMLElement,
  });
  const mount = dom.window.document.querySelector("#app");
  if (!(mount instanceof dom.window.HTMLElement)) throw new Error("benchmark mount missing");
  renderPage(page, mount as unknown as HTMLElement);
  mount.replaceChildren();
  dom.window.close();
}

const validation = {
  m1: measure(() => { validateMeaningPacket(deploymentReferencePacket); }),
  juanPage: measure(() => { validatePage(page); }),
  componentTree: null,
  naturalLanguage: null,
};
const materialization = measure(() => { materializeMeaningPacket(deploymentReferencePacket); });
const rendering = measure(renderBenchmark);

const invalidCases: readonly unknown[] = [
  [1, "pkt:bad", -1, null, [], []],
  [1, "pkt:bad", 0, null, [], [[99]]],
  [1, "pkt:bad", 0, null, [], [[0, [1, "title"]], [2, "missing", "prop:x", true]]],
];
const invalidRejected = invalidCases.filter((value) => {
  try { validateMeaningPacket(value); return false; } catch { return true; }
}).length;
const deterministic = Array.from({ length: 25 }, () => JSON.stringify(materializeMeaningPacket(deploymentReferencePacket))).every((value, _, values) => value === values[0]);

const sizeRows = Object.fromEntries(Object.entries(formats).map(([name, value]) => {
  const text = serialized(value);
  return [name, {
    rawBytes: Buffer.byteLength(text),
    gzipBytes: gzipSync(text, { level: 9 }).byteLength,
    approximateTokens: approximateTokens(text),
  }];
}));

const report = {
  schemaVersion: 2,
  fixture: deploymentReferencePacket[1],
  runs,
  environment: { node: process.version, platform: process.platform, architecture: process.arch },
  sizes: sizeRows,
  timing: { validation, materialization, rendering },
  conformance: { invalidCases: invalidCases.length, invalidRejected, deterministicCrossRun: deterministic },
  limitations: [
    "Natural-language token counts use a documented four-bytes-per-token approximation, not a model-specific tokenizer.",
    "The component tree is a neutral equivalent representation, not an implementation of a named external framework.",
    "M1 pays validation and materialization cost that direct JuanPage JSON does not; JuanPage is therefore faster when the producer already has canonical JuanPage data.",
    "JuanPage 2 encodes explicit affordances and bindings, which costs bytes but prevents inert or ambiguous interaction.",
  ],
};

const rows = Object.entries(sizeRows).map(([name, values]) => `| ${name} | ${values.rawBytes} | ${values.gzipBytes} | ${values.approximateTokens} |`).join("\n");
const markdown = `# JuanPager protocol benchmark\n\nDeterministic fixture: \`${deploymentReferencePacket[1]}\`. Runs per timing measurement: ${runs}.\n\n| Format | Raw bytes | Gzip bytes | Approx. tokens |\n|---|---:|---:|---:|\n${rows}\n\n## Timing\n\n- M1 validation mean: ${validation.m1.meanMs.toFixed(4)} ms\n- JuanPage validation mean: ${validation.juanPage.meanMs.toFixed(4)} ms\n- M1 materialization mean: ${materialization.meanMs.toFixed(4)} ms\n- renderPage mean: ${rendering.meanMs.toFixed(4)} ms\n\n## Conformance\n\n- Invalid M1 outputs rejected: ${invalidRejected}/${invalidCases.length}\n- Deterministic across 25 materializations: ${deterministic}\n\n## Honest limitations\n\n${report.limitations.map((item) => `- ${item}`).join("\n")}\n`;

await mkdir("benchmark/results", { recursive: true });
await writeFile("benchmark/results/latest.json", `${JSON.stringify(report, null, 2)}\n`);
await writeFile("benchmark/results/latest.md", markdown);
console.log(JSON.stringify(report, null, 2));
console.log("\n" + markdown);

if (invalidRejected !== invalidCases.length || !deterministic) process.exit(1);
