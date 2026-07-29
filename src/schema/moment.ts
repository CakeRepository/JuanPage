import { z } from "zod";
import { AFFORDANCES, MOMENT_TYPES } from "../components/registry.js";
import { DocumentValidationError } from "./document.js";
import { LIMITS, LIMITS_HELP } from "./limits.js";
import { isAllowedUrl } from "./url.js";

const text = (max: number = LIMITS.maxTextLength) => z.string().min(1).max(max);

const optionalText = (max: number = LIMITS.maxTextLength) =>
  z.string().max(max).optional();

const safeUrl = z
  .string()
  .max(LIMITS.maxUrlLength)
  .refine((value) => isAllowedUrl(value), {
    message: "URL must be https (or http://localhost / http://127.0.0.1 in development)",
  });

const optionalSafeUrl = safeUrl.optional();

const entityId = z.string().min(1).max(64);

const productEntity = z
  .object({
    type: z.literal("product"),
    id: entityId,
    name: text(200),
    store: optionalText(100),
    imageUrl: optionalSafeUrl,
    displayPrice: optionalText(40),
    price: z.number().finite().nonnegative().optional(),
    currency: z.string().min(1).max(8).optional(),
    unitPrice: optionalText(80),
    packageSize: optionalText(80),
    quantity: z.number().int().min(0).max(9999).optional(),
    availability: optionalText(40),
    productUrl: optionalSafeUrl,
    reason: optionalText(),
    badges: z.array(text(40)).max(LIMITS.maxBadges).optional(),
    checked: z.boolean().optional(),
  })
  .strict();

const noteEntity = z
  .object({
    type: z.literal("note"),
    id: entityId,
    text: text(),
  })
  .strict();

const linkEntity = z
  .object({
    type: z.literal("link"),
    id: entityId,
    label: text(200),
    href: safeUrl,
  })
  .strict();

const entitySchema = z.discriminatedUnion("type", [
  productEntity,
  noteEntity,
  linkEntity,
]);

const summaryItemSchema = z
  .object({
    label: text(100),
    value: text(200),
  })
  .strict();

const groupSchema = z
  .object({
    id: entityId,
    label: text(120),
    entityIds: z.array(entityId).min(1).max(LIMITS.maxEntities),
  })
  .strict();

const continuationSchema = z.union([
  z.object({ kind: z.literal("none") }).strict(),
  z.object({ kind: z.literal("note"), text: text(500) }).strict(),
]);

export const juanPagerMomentSchema = z
  .object({
    version: z.literal("0.2"),
    title: text(200),
    description: optionalText(),
    theme: z.enum(["system", "light", "dark"]).optional(),
    moment: z.enum(MOMENT_TYPES),
    goal: optionalText(300),
    summary: z.array(summaryItemSchema).max(LIMITS.maxSummaryItems).optional(),
    entities: z.array(entitySchema).min(1).max(LIMITS.maxEntities),
    groups: z.array(groupSchema).max(LIMITS.maxGroups).optional(),
    affordances: z.array(z.enum(AFFORDANCES)).max(AFFORDANCES.length),
    continuation: continuationSchema.optional(),
    metadata: z
      .record(z.union([z.string().max(LIMITS.maxTextLength), z.number(), z.boolean()]))
      .optional()
      .refine(
        (value) => !value || Object.keys(value).length <= LIMITS.maxMetadataEntries,
        { message: `metadata may have at most ${LIMITS.maxMetadataEntries} entries` },
      ),
  })
  .strict();

export type JuanPagerMomentDoc = z.infer<typeof juanPagerMomentSchema>;
export type MomentEntity = z.infer<typeof entitySchema>;
export type ProductEntity = z.infer<typeof productEntity>;
export type NoteEntity = z.infer<typeof noteEntity>;
export type LinkEntity = z.infer<typeof linkEntity>;
export type MomentGroup = z.infer<typeof groupSchema>;
export type MomentSummaryItem = z.infer<typeof summaryItemSchema>;

export function validateMoment(input: unknown): JuanPagerMomentDoc {
  const parsed = juanPagerMomentSchema.safeParse(input);
  if (!parsed.success) {
    throw new DocumentValidationError(
      "This JuanPager moment is invalid.",
      parsed.error.issues
        .slice(0, 20)
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("\n"),
    );
  }

  const moment = parsed.data;

  if (moment.entities.length > LIMITS.maxEntities) {
    throw new DocumentValidationError(
      "This JuanPager moment exceeds size limits.",
      `Entity count ${moment.entities.length} exceeds maximum ${LIMITS.maxEntities}.\n${LIMITS_HELP}`,
    );
  }

  const seen = new Set<string>();
  for (const entity of moment.entities) {
    if (seen.has(entity.id)) {
      throw new DocumentValidationError(
        "This JuanPager moment is invalid.",
        `Duplicate entity id "${entity.id}". Entity ids must be unique so local state stays stable.`,
      );
    }
    seen.add(entity.id);
  }

  if (moment.groups) {
    const groupIds = new Set<string>();
    for (const group of moment.groups) {
      if (groupIds.has(group.id)) {
        throw new DocumentValidationError(
          "This JuanPager moment is invalid.",
          `Duplicate group id "${group.id}".`,
        );
      }
      groupIds.add(group.id);

      for (const entityRef of group.entityIds) {
        if (!seen.has(entityRef)) {
          throw new DocumentValidationError(
            "This JuanPager moment is invalid.",
            `Group "${group.id}" references unknown entity id "${entityRef}".`,
          );
        }
      }
    }
  }

  const affordances = new Set(moment.affordances);
  if (affordances.size !== moment.affordances.length) {
    throw new DocumentValidationError(
      "This JuanPager moment is invalid.",
      "Affordances must be unique.",
    );
  }

  return moment;
}

export function momentProducts(moment: JuanPagerMomentDoc): ProductEntity[] {
  return moment.entities.filter(
    (entity): entity is ProductEntity => entity.type === "product",
  );
}

export function hasAffordance(
  moment: JuanPagerMomentDoc,
  affordance: JuanPagerMomentDoc["affordances"][number],
): boolean {
  return moment.affordances.includes(affordance);
}
