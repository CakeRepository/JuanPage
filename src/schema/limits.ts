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
  // Moment (0.2) focus-set limits.
  maxEntities: 100,
  maxGroups: 25,
  maxSummaryItems: 12,
} as const;

export const LIMITS_HELP =
  "JuanPager is intended for compact shareable focus sets that fit in a URL fragment. Split large results across several pages, or wait for remote-storage mode.";
