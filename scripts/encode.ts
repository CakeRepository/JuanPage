#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildShareUrl } from "../src/encoding/pipeline.js";
import { validateDocument } from "../src/schema/document.js";

async function main(): Promise<void> {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: npm run encode -- <path-to-document.json>");
    process.exit(1);
  }

  const absolute = resolve(process.cwd(), file);
  const raw = JSON.parse(await readFile(absolute, "utf8")) as unknown;
  const document = validateDocument(raw);
  const baseUrl = process.env.JUANPAGER_BASE_URL ?? process.env.ONEPAGER_BASE_URL ?? "http://localhost:5173/";
  const url = await buildShareUrl(document, baseUrl);
  console.log(url);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
