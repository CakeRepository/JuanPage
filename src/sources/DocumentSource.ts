import type { JuanPagerDocument } from "../schema/document.js";

/**
 * Abstracts where a JuanPager document comes from.
 * Rendering must not care whether the future source is a fragment, remote API, MCP, or file.
 */
export interface DocumentSource {
  load(): Promise<JuanPagerDocument>;
}

/**
 * Reserved for a future remote-storage / API mode. Not implemented in 0.1.
 */
export class RemoteDocumentSource implements DocumentSource {
  constructor(private readonly _url: string) {}

  async load(): Promise<JuanPagerDocument> {
    throw new Error(
      "RemoteDocumentSource is not implemented in JuanPager 0.1. Documents must be embedded in the URL fragment.",
    );
  }
}
