#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildMeaningShareUrl,
  buildPageShareUrl,
  measurePageSizes,
  type PagePayloadEncoding,
} from "../src/encoding/pagePipeline.js";
import { validateMeaningPacket } from "../src/protocol/meaning.js";
import { validatePage } from "../src/schema/page.js";

const USAGE = `Usage: npm run encode -- <juanpage-or-m1.json> [--raw|--gz]\n\nAccepts JuanPage 1.0 or an M1 packet.\nBase URL: JUANPAGER_BASE_URL (alias ONEPAGER_BASE_URL).`;

async function main(): Promise<void> {
  const path = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  if (!path) { console.error(USAGE); process.exit(1); }
  const encoding: PagePayloadEncoding = process.argv.includes("--raw") ? "raw" : "gz";
  const rawText = await readFile(resolve(path), "utf8");
  const raw = JSON.parse(rawText) as unknown;
  const base = process.env.JUANPAGER_BASE_URL ?? process.env.ONEPAGER_BASE_URL ?? "http://localhost:5173/";
  const m1 = Array.isArray(raw) && raw[0] === 1;
  const url = m1
    ? await buildMeaningShareUrl(validateMeaningPacket(raw), base, encoding)
    : await buildPageShareUrl(validatePage(raw), base, encoding);
  const payload = new URL(url).hash.split("data=")[1] ?? "";
  const sizes = measurePageSizes(payload, rawText);
  console.error(`${m1 ? "M1 packet" : "JuanPage 1.0"} · ${encoding} · ${sizes.encodedBytes} encoded bytes · ${sizes.decodedBytes} source bytes`);
  console.log(url);
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.stack ?? error.message : error); process.exit(1); });
