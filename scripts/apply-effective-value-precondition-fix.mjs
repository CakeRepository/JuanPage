import { readFile, writeFile } from "node:fs/promises";

const path = "src/state/pageState.ts";
let source = await readFile(path, "utf8");

function replaceOnce(before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing migration anchor: ${label}`);
  source = source.replace(before, after);
}

replaceOnce(
  `function patchValue(state: PageState, patch: PageStatePatch): unknown {\n  if (patch.domain === "value") return state.values[patch.target]?.[patch.field];`,
  `function currentScalarValue(state: PageState, target: string, field: string): PageScalar | undefined {\n  const fields = state.values[target];\n  if (fields && Object.prototype.hasOwnProperty.call(fields, field)) return fields[field];\n  return state.baseValues[target]?.[field];\n}\n\nfunction patchValue(state: PageState, patch: PageStatePatch): unknown {\n  if (patch.domain === "value") return currentScalarValue(state, patch.target, patch.field);`,
  "effective patch precondition",
);

replaceOnce(
  `  const before = state.values[target]?.[field] ?? state.baseValues[target]?.[field];`,
  `  const before = currentScalarValue(state, target, field);`,
  "effective set value baseline",
);

await writeFile(path, source);
console.log("Effective value precondition migration applied.");
