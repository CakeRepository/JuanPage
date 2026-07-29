import {
  DocumentValidationError,
  validateDocument,
  type JuanPagerDocument,
} from "./document.js";
import { validateMoment, type JuanPagerMomentDoc } from "./moment.js";

/**
 * JuanPager loads two document families:
 *  - 0.1 "components": an explicit component tree the agent laid out.
 *  - 0.2 "moment": intent + facts + affordances; the app composes the UI.
 * Everything downstream of the loader branches on `kind`, never on raw shape.
 */
export type LoadedDocument =
  | { kind: "components"; document: JuanPagerDocument }
  | { kind: "moment"; document: JuanPagerMomentDoc };

export type DocumentKind = LoadedDocument["kind"];

export function detectDocumentKind(input: unknown): DocumentKind | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;

  if (record.version === "0.2") return "moment";
  if (record.version === "0.1") return "components";

  if (typeof record.moment === "string" && Array.isArray(record.entities)) {
    return "moment";
  }
  if (Array.isArray(record.components)) return "components";

  return null;
}

export function validateAnyDocument(input: unknown): LoadedDocument {
  const kind = detectDocumentKind(input);

  if (kind === "moment") {
    return { kind, document: validateMoment(input) };
  }
  if (kind === "components") {
    return { kind, document: validateDocument(input) };
  }

  throw new DocumentValidationError(
    "This JuanPager document is invalid.",
    'Unrecognised document format. Expected version "0.2" with a "moment" and "entities", or version "0.1" with "components".',
  );
}

export function documentTitle(loaded: LoadedDocument): string {
  return loaded.document.title;
}
