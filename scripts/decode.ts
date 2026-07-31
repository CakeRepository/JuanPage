#!/usr/bin/env node
import { parseFragment } from "../src/encoding/fragment.js";
import { decodePagePayload, type PagePayloadEncoding } from "../src/encoding/pagePipeline.js";

async function main(): Promise<void> {
  const input = process.argv[2];
  if (!input) { console.error('Usage: npm run decode -- "https://example/#v=4&enc=gz&data=..."'); process.exit(1); }
  let hash = input;
  try { hash = new URL(input).hash || input; } catch { /* raw fragment */ }
  const { data, version, encoding } = parseFragment(hash);
  if (!data) throw new Error("No data payload found");
  if (version && version !== "3" && version !== "4") throw new Error(`Unsupported fragment version v=${version}; expected v=3 or v=4.`);
  const decoded = await decodePagePayload(data, encoding as PagePayloadEncoding | undefined);
  if (decoded.kind === "m1-session") {
    console.error(`Decoded M1 URL session · ${decoded.session.deltas.length} deltas · ${decoded.session.receipts.length} receipts.`);
    console.log(JSON.stringify(decoded.session, null, 2));
    return;
  }
  console.error(decoded.kind === "m1" ? "Decoded untrusted M1 packet." : "Decoded JuanPage 1.0.");
  console.log(JSON.stringify(decoded.page, null, 2));
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.stack ?? error.message : error); process.exit(1); });