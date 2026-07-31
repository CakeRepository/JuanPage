import { gzipSync } from "node:zlib";
import { futureMeaningPacket } from "../src/examples/meaning-workspace.js";
import { materializeMeaningPacket } from "../src/protocol/meaning.js";

const page = materializeMeaningPacket(futureMeaningPacket);
const packetJson = JSON.stringify(futureMeaningPacket);
const pageJson = JSON.stringify(page);
const report = {
  packetBytes: Buffer.byteLength(packetJson),
  pageBytes: Buffer.byteLength(pageJson),
  packetGzipBytes: gzipSync(packetJson).byteLength,
  pageGzipBytes: gzipSync(pageJson).byteLength,
  semanticRecords: futureMeaningPacket[5].length,
  renderedObjects: page.objects.length,
};

console.log(JSON.stringify(report, null, 2));
