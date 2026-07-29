import { parseFragment } from "../encoding/fragment.js";
import { decodePayload } from "../encoding/pipeline.js";
import type { LoadedDocument } from "../schema/anyDocument.js";
import type { DocumentSource } from "./DocumentSource.js";

export class FragmentDocumentSource implements DocumentSource {
  constructor(private readonly hash: string = typeof window !== "undefined" ? window.location.hash : "") {}

  async load(): Promise<LoadedDocument> {
    const { data, version, encoding } = parseFragment(this.hash);
    if (!data) {
      throw new Error(
        "No page data found in the URL fragment. Open a JuanPager link that includes #data=..., or load the demo from the builder.",
      );
    }
    return decodePayload(data, { version, encoding });
  }
}
