#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { compileJuanDialect } from "../src/dialect/juan.js";
import {
  buildShareUrl,
  measureSizes,
  type PayloadEncoding,
} from "../src/encoding/pipeline.js";
import { validateAnyDocument, type LoadedDocument } from "../src/schema/anyDocument.js";
import { encodeMoment, compressDocument } from "../src/encoding/pipeline.js";

const USAGE = `Usage: npm run encode -- <path-to-document.json|.juan> [--raw|--gz]

  .json   JuanPager 0.2 moment or 0.1 document
  .juan   Juan dialect text (compiled to a 0.2 moment)
  --raw   Encode moments as readable JSON (larger link, clearer failures)
  --gz    Encode moments with gzip (default)

Base URL comes from JUANPAGER_BASE_URL (alias: ONEPAGER_BASE_URL).`;

async function loadSource(file: string): Promise<LoadedDocument> {
  const absolute = resolve(process.cwd(), file);
  const text = await readFile(absolute, "utf8");

  if (extname(absolute).toLowerCase() === ".juan") {
    return { kind: "moment", document: compileJuanDialect(text) };
  }

  return validateAnyDocument(JSON.parse(text) as unknown);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const file = args.find((arg) => !arg.startsWith("--"));
  if (!file) {
    console.error(USAGE);
    process.exit(1);
  }

  // npm consumes flags after `--` into npm_config_*, so honour both spellings.
  const wantsRaw =
    args.includes("--raw") ||
    process.env.npm_config_raw === "true" ||
    process.env.JUANPAGER_ENCODING === "raw";
  const wantsGz = args.includes("--gz") || process.env.npm_config_gz === "true";
  const encoding: PayloadEncoding = wantsRaw && !wantsGz ? "raw" : "gz";
  const loaded = await loadSource(file);
  const baseUrl =
    process.env.JUANPAGER_BASE_URL ??
    process.env.ONEPAGER_BASE_URL ??
    "http://localhost:5173/";

  const url = await buildShareUrl(loaded.document, baseUrl, { encoding });
  const payload =
    loaded.kind === "moment"
      ? await encodeMoment(loaded.document, encoding)
      : await compressDocument(loaded.document);
  const { encodedBytes, decodedBytes } = measureSizes(
    payload,
    JSON.stringify(loaded.document),
  );

  console.error(
    `${loaded.kind === "moment" ? `moment:${loaded.document.moment}` : "document:0.1"} · enc=${
      loaded.kind === "moment" ? encoding : "gz"
    } · encoded ${encodedBytes} B / 16384 B · decoded ${decodedBytes} B / 65536 B`,
  );
  console.log(url);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  if (error && typeof error === "object" && "details" in error) {
    console.error(String((error as { details: unknown }).details));
  }
  process.exit(1);
});
