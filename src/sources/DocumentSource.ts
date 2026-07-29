import type { LoadedDocument } from "../schema/anyDocument.js";

/**
 * Abstracts where a JuanPager document comes from.
 * Rendering must not care whether the future source is a fragment, remote API, MCP, or file.
 */
export interface DocumentSource {
  load(): Promise<LoadedDocument>;
}

/**
 * Reserved for a future remote-storage / API mode. Not implemented while
 * JuanPager stays serverless.
 */
export class RemoteDocumentSource implements DocumentSource {
  constructor(private readonly _url: string) {}

  async load(): Promise<LoadedDocument> {
    throw new Error(
      "RemoteDocumentSource is not implemented yet. Documents must be embedded in the URL fragment.",
    );
  }
}
