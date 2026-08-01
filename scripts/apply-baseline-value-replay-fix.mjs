import { readFile, writeFile } from "node:fs/promises";

const path = "src/state/pageState.ts";
let source = await readFile(path, "utf8");

function replaceOnce(before, after, label) {
  if (!source.includes(before)) throw new Error(`Missing migration anchor: ${label}`);
  source = source.replace(before, after);
}

replaceOnce(
  `export type PageState = {\n  values: Record<string, Record<string, PageScalar>>;`,
  `export type PageState = {\n  values: Record<string, Record<string, PageScalar>>;\n  baseValues: Record<string, Record<string, PageScalar>>;`,
  "base values state",
);

replaceOnce(
  `function cloneStrings(values: readonly string[] | undefined): string[] {\n  return values ? [...values] : [];\n}\n\nfunction initialState(page: JuanPageDocument): PageState {`,
  `function cloneStrings(values: readonly string[] | undefined): string[] {\n  return values ? [...values] : [];\n}\n\nfunction scalar(value: PageValue | undefined): value is PageScalar {\n  return value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number";\n}\n\nfunction originalScalarValues(page: JuanPageDocument): Record<string, Record<string, PageScalar>> {\n  const result: Record<string, Record<string, PageScalar>> = {};\n  for (const object of page.objects) {\n    const fields: Record<string, PageScalar> = {};\n    for (const field of object.fields ?? []) if (scalar(field.value)) fields[field.key] = field.value;\n    if (Object.keys(fields).length) result[object.id] = fields;\n  }\n  return result;\n}\n\nfunction initialState(page: JuanPageDocument): PageState {`,
  "original scalar values",
);

replaceOnce(
  `  return {\n    values: {},\n    scopes,`,
  `  return {\n    values: {},\n    baseValues: originalScalarValues(page),\n    scopes,`,
  "initial base values",
);

replaceOnce(
  `    return {\n      values: parsed.values && typeof parsed.values === "object" ? parsed.values : {},\n      scopes:`,
  `    return {\n      values: parsed.values && typeof parsed.values === "object" ? parsed.values : {},\n      baseValues: fallback.baseValues,\n      scopes:`,
  "restored base values",
);

replaceOnce(
  `  const before = state.values[target]?.[field];\n  if (equal(before, value)) return;`,
  `  const before = state.values[target]?.[field] ?? state.baseValues[target]?.[field];\n  if (equal(before, value)) return;`,
  "set baseline value",
);

replaceOnce(
  `      patches.push({ domain: "value", target: objectId, field, before, after: undefined });`,
  `      patches.push({ domain: "value", target: objectId, field, before, after: target.baseValues[objectId]?.[field] });`,
  "reset baseline value",
);

await writeFile(path, source);
console.log("Baseline value replay migration applied.");
