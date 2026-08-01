#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { formatReturnedUrlInspection, inspectReturnedUrl } from "../src/inspection/returnedUrl.js";
import { validatePage, type JuanPageDocument } from "../src/schema/page.js";

function valueAfter(args: readonly string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const input = args.find((argument, index) => !argument.startsWith("--") && args[index - 1] !== "--against");
  if (!input) {
    console.error('Usage: npm run inspect -- "<juanpage-url>" [--against page.json] [--json]');
    process.exit(1);
  }
  const baselinePath = valueAfter(args, "--against");
  let baseline: JuanPageDocument | undefined;
  if (baselinePath) {
    const raw = JSON.parse(await readFile(resolve(baselinePath), "utf8")) as unknown;
    baseline = validatePage(raw);
  }
  const report = await inspectReturnedUrl(input, baseline);
  console.log(args.includes("--json") ? JSON.stringify(report, null, 2) : formatReturnedUrlInspection(report));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
