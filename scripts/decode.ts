#!/usr/bin/env node
import { parseFragment } from "../src/encoding/fragment.js";
import { decodePayload } from "../src/encoding/pipeline.js";

async function main(): Promise<void> {
  const input = process.argv[2];
  if (!input) {
    console.error('Usage: npm run decode -- "https://example.com/juanpager/#v=2&enc=gz&data=..."');
    process.exit(1);
  }

  let hash = input;
  try {
    const url = new URL(input);
    hash = url.hash || input;
  } catch {
    // treat as raw fragment
  }

  const { data, version, encoding } = parseFragment(hash);
  if (!data) {
    throw new Error("No data payload found in URL/fragment");
  }

  const loaded = await decodePayload(data, { version, encoding });
  console.error(`Decoded a ${loaded.kind === "moment" ? "0.2 moment" : "0.1 document"}.`);
  console.log(JSON.stringify(loaded.document, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
