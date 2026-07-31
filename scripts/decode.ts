#!/usr/bin/env node
import { parseFragment } from "../src/encoding/fragment.js";
import { decodePage, type PagePayloadEncoding } from "../src/encoding/pagePipeline.js";

async function main(): Promise<void> {
  const input = process.argv[2];
  if (!input) { console.error('Usage: npm run decode -- "https://example/#v=3&enc=gz&data=..."'); process.exit(1); }
  let hash = input;
  try { hash = new URL(input).hash || input; } catch { /* raw fragment */ }
  const { data, version, encoding } = parseFragment(hash);
  if (!data) throw new Error("No data payload found");
  if (version && version !== "3") throw new Error(`Unsupported fragment version v=${version}; expected v=3.`);
  const page = await decodePage(data, encoding as PagePayloadEncoding | undefined);
  console.error("Decoded JuanPage 1.0.");
  console.log(JSON.stringify(page, null, 2));
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.stack ?? error.message : error); process.exit(1); });
