import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const packageJson = JSON.parse(await readFile(resolve("package.json"), "utf8")) as { exports?: Record<string, unknown> };
const current = Object.keys(packageJson.exports ?? {}).sort();
const baselinePath = resolve("spec/public-api.json");
const baseline = JSON.parse(await readFile(baselinePath, "utf8")) as { exports: string[] };
const removed = baseline.exports.filter((entry) => !current.includes(entry));
if (removed.length) {
  console.error(`Public API compatibility failure. Removed exports: ${removed.join(", ")}`);
  process.exit(1);
}
if (process.argv.includes("--update")) await writeFile(baselinePath, `${JSON.stringify({ exports: current }, null, 2)}\n`);
console.log(`Public API compatible: ${current.length} package exports.`);
