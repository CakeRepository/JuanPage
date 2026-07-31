#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildMeaningSessionShareUrl,
  buildMeaningShareUrl,
  buildPageShareUrl,
  createMeaningSession,
  measurePageSizes,
  type PagePayloadEncoding,
} from "../src/encoding/pagePipeline.js";
import { validateMeaningPacket } from "../src/protocol/meaning.js";
import { validatePage } from "../src/schema/page.js";

const USAGE = `Usage: npm run encode -- <juanpage-or-m1.json> [--session] [--raw|--gz]\n\nAccepts JuanPage 2.0 or an M1 packet.\n--session creates a record-only round-trip URL for an M1 packet.\nGenerated links use fragment version v=5.\nBase URL: JUANPAGER_BASE_URL (alias ONEPAGER_BASE_URL).`;

async function main(): Promise<void> {
  const path = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
  if (!path) {
    console.error(USAGE);
    process.exit(1);
  }
  const encoding: PagePayloadEncoding = process.argv.includes("--raw") ? "raw" : "gz";
  const roundTrip = process.argv.includes("--session");
  const rawText = await readFile(resolve(path), "utf8");
  const raw = JSON.parse(rawText) as unknown;
  const base = process.env.JUANPAGER_BASE_URL ?? process.env.ONEPAGER_BASE_URL ?? "http://localhost:5173/";
  const m1 = Array.isArray(raw) && raw[0] === 1;
  if (roundTrip && !m1) throw new Error("--session requires an M1 packet.");

  const url = m1
    ? roundTrip
      ? await buildMeaningSessionShareUrl(createMeaningSession(validateMeaningPacket(raw)), base, encoding)
      : await buildMeaningShareUrl(validateMeaningPacket(raw), base, encoding)
    : await buildPageShareUrl(validatePage(raw), base, encoding);
  const payload = new URL(url).hash.split("data=")[1] ?? "";
  const sizes = measurePageSizes(payload, rawText);
  const label = m1 ? roundTrip ? "M1 URL session" : "M1 packet" : "JuanPage 2.0";
  console.error(`${label} · v5 · ${encoding} · ${sizes.encodedBytes} encoded bytes · ${sizes.decodedBytes} source bytes`);
  console.log(url);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
