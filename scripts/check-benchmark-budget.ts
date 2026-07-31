import { readFile } from "node:fs/promises";

type SizeMeasurement = Readonly<{
  rawBytes: number;
  gzipBytes: number;
  approximateTokens: number;
}>;

type TimingMeasurement = Readonly<{
  meanMs: number;
  minMs: number;
  maxMs: number;
}>;

type BenchmarkReport = Readonly<{
  sizes: Readonly<Record<string, SizeMeasurement>>;
  timing: Readonly<{
    materialization: TimingMeasurement;
    rendering: TimingMeasurement;
  }>;
  conformance: Readonly<{
    invalidCases: number;
    invalidRejected: number;
    deterministicCrossRun: boolean;
  }>;
}>;

const report = JSON.parse(await readFile("benchmark/results/latest.json", "utf8")) as BenchmarkReport;
const failures: string[] = [];

function maximum(label: string, actual: number | undefined, limit: number, unit: string): void {
  if (actual === undefined || !Number.isFinite(actual)) failures.push(`${label} is missing or non-finite.`);
  else if (actual > limit) failures.push(`${label} ${actual.toFixed(2)} ${unit} exceeds ${limit} ${unit}.`);
}

maximum("M1 raw size", report.sizes.m1?.rawBytes, 64 * 1024, "bytes");
maximum("M1 gzip size", report.sizes.m1?.gzipBytes, 24 * 1024, "bytes");
maximum("JuanPage raw size", report.sizes.juanPage?.rawBytes, 128 * 1024, "bytes");
maximum("M1 materialization mean", report.timing.materialization?.meanMs, 50, "ms");
maximum("renderPage mean", report.timing.rendering?.meanMs, 100, "ms");

if (!report.conformance.deterministicCrossRun) failures.push("Materialization was not deterministic across repeated runs.");
if (report.conformance.invalidRejected !== report.conformance.invalidCases) {
  failures.push(`Only ${report.conformance.invalidRejected}/${report.conformance.invalidCases} invalid fixtures were rejected.`);
}

if (failures.length > 0) {
  console.error("JuanPager benchmark budget failed.\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Benchmark budget passed: bounded size, deterministic materialization, complete invalid-fixture rejection, and responsive runtime timing.");
