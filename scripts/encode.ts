#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildPageShareUrl, measurePageSizes, type PagePayloadEncoding } from "../src/encoding/pagePipeline.js";
import { validatePage } from "../src/schema/page.js";

const USAGE = `Usage: npm run encode -- <juanpage.json> [--raw|--gz]\n\nJuanPager 1.0 accepts one JSON schema.\nBase URL: JUANPAGER_BASE_URL (alias ONEPAGER_BASE_URL).`;

async function main(): Promise<void> {
  const path = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  if (!path) { console.error(USAGE); process.exit(1); }
  const encoding: PagePayloadEncoding = process.argv.includes("--raw") ? "raw" : "gz";
  const page = validatePage(JSON.parse(await readFile(resolve(path), "utf8")));
  const base = process.env.JUANPAGER_BASE_URL ?? process.env.ONEPAGER_BASE_URL ?? "http://localhost:5173/";
  const url = await buildPageShareUrl(page, base, encoding);
  const payload = new URL(url).hash.split("data=")[1] ?? "";
  const sizes = measurePageSizes(payload, JSON.stringify(page));
  console.error(`JuanPage 1.0 · ${encoding} · ${sizes.encodedBytes} encoded bytes · ${sizes.decodedBytes} JSON bytes`);
  console.log(url);
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.stack ?? error.message : error); process.exit(1); });
