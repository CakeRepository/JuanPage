export const LIMITS = {
  maxEncodedFragmentBytes: 16 * 1024,
  maxDecodedJsonBytes: 64 * 1024,
  maxComponents: 200,
  maxNestingDepth: 8,
  maxTextLength: 2000,
  maxUrlLength: 2048,
  maxMetadataEntries: 50,
  maxListItems: 100,
  maxBadges: 20,
} as const;

export const LIMITS_HELP =
  "JuanPager version 0.1 is intended for compact shareable pages. Remote-storage mode may be added later for larger documents.";
