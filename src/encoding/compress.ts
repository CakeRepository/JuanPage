import { gunzipSync, gzipSync } from "fflate";

function hasNativeCompression(): boolean {
  return (
    typeof CompressionStream !== "undefined" &&
    typeof DecompressionStream !== "undefined" &&
    typeof Blob !== "undefined" &&
    typeof Blob.prototype.stream === "function"
  );
}

async function compressNative(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

async function decompressNative(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

export async function gzipCompress(bytes: Uint8Array): Promise<Uint8Array> {
  if (hasNativeCompression()) {
    try {
      return await compressNative(bytes);
    } catch {
      // Fall through to fflate when the host CompressionStream is incomplete (e.g. jsdom).
    }
  }
  return gzipSync(bytes);
}

export async function gzipDecompress(bytes: Uint8Array): Promise<Uint8Array> {
  if (hasNativeCompression()) {
    try {
      return await decompressNative(bytes);
    } catch {
      // Fall through to fflate.
    }
  }
  return gunzipSync(bytes);
}
