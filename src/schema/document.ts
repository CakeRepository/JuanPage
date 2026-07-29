import { z } from "zod";
import { LIMITS, LIMITS_HELP } from "./limits.js";
import { isAllowedUrl } from "./url.js";

const text = (max: number = LIMITS.maxTextLength) =>
  z.string().min(1).max(max);

const optionalText = (max: number = LIMITS.maxTextLength) =>
  z.string().max(max).optional();

const safeUrl = z
  .string()
  .max(LIMITS.maxUrlLength)
  .refine((value) => isAllowedUrl(value), {
    message: "URL must be https (or http://localhost / http://127.0.0.1 in development)",
  });

const optionalSafeUrl = safeUrl.optional();

const idField = z.string().max(64).optional();

const headingComponent = z
  .object({
    type: z.literal("heading"),
    id: idField,
    text: text(200),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  })
  .strict();

const textComponent = z
  .object({
    type: z.literal("text"),
    id: idField,
    text: text(),
  })
  .strict();

const imageComponent = z
  .object({
    type: z.literal("image"),
    id: idField,
    src: safeUrl,
    alt: text(300),
    caption: optionalText(300),
  })
  .strict();

const priceComponent = z
  .object({
    type: z.literal("price"),
    id: idField,
    amount: z.number().finite(),
    currency: z.string().min(1).max(8).optional(),
    label: optionalText(100),
  })
  .strict();

const badgeComponent = z
  .object({
    type: z.literal("badge"),
    id: idField,
    text: text(80),
    tone: z.enum(["neutral", "success", "warning", "danger", "info"]).optional(),
  })
  .strict();

const summaryComponent = z
  .object({
    type: z.literal("summary"),
    id: idField,
    items: z
      .array(
        z
          .object({
            label: text(100),
            value: text(200),
          })
          .strict(),
      )
      .min(1)
      .max(LIMITS.maxListItems),
  })
  .strict();

const listComponent = z
  .object({
    type: z.literal("list"),
    id: idField,
    ordered: z.boolean().optional(),
    items: z.array(text(300)).min(1).max(LIMITS.maxListItems),
  })
  .strict();

const checklistComponent = z
  .object({
    type: z.literal("checklist"),
    id: idField,
    items: z
      .array(
        z
          .object({
            id: z.string().min(1).max(64),
            label: text(300),
            checked: z.boolean().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(LIMITS.maxListItems),
  })
  .strict();

const dividerComponent = z
  .object({
    type: z.literal("divider"),
    id: idField,
  })
  .strict();

const linkComponent = z
  .object({
    type: z.literal("link"),
    id: idField,
    href: safeUrl,
    label: text(200),
  })
  .strict();

const buttonComponent = z
  .object({
    type: z.literal("button"),
    id: idField,
    label: text(80),
    action: z.enum([
      "copy-page",
      "copy-list",
      "print-page",
      "reset-state",
      "open-all-links",
    ]),
    variant: z.enum(["primary", "secondary", "danger"]).optional(),
  })
  .strict();

const productComponent = z
  .object({
    type: z.literal("product"),
    id: idField,
    name: text(200),
    description: optionalText(),
    store: optionalText(100),
    imageUrl: optionalSafeUrl,
    displayPrice: optionalText(40),
    price: z.number().finite().nonnegative().optional(),
    currency: z.string().min(1).max(8).optional(),
    unitPrice: optionalText(80),
    packageSize: optionalText(80),
    quantity: z.number().int().min(0).max(9999).optional(),
    availability: z
      .enum(["in-stock", "limited", "out-of-stock", "unknown"])
      .optional(),
    productUrl: optionalSafeUrl,
    reason: optionalText(),
    badges: z.array(text(40)).max(LIMITS.maxBadges).optional(),
    checked: z.boolean().optional(),
  })
  .strict();

type LeafComponent =
  | z.infer<typeof headingComponent>
  | z.infer<typeof textComponent>
  | z.infer<typeof imageComponent>
  | z.infer<typeof priceComponent>
  | z.infer<typeof badgeComponent>
  | z.infer<typeof summaryComponent>
  | z.infer<typeof listComponent>
  | z.infer<typeof checklistComponent>
  | z.infer<typeof dividerComponent>
  | z.infer<typeof linkComponent>
  | z.infer<typeof buttonComponent>
  | z.infer<typeof productComponent>;

export type JuanPagerComponent =
  | LeafComponent
  | {
      type: "section";
      id?: string;
      title?: string;
      collapsible?: boolean;
      collapsed?: boolean;
      components: JuanPagerComponent[];
    }
  | {
      type: "grid";
      id?: string;
      columns?: 1 | 2 | 3;
      components: JuanPagerComponent[];
    }
  | {
      type: "card";
      id?: string;
      title?: string;
      components: JuanPagerComponent[];
    };

const leafComponents = z.discriminatedUnion("type", [
  headingComponent,
  textComponent,
  imageComponent,
  priceComponent,
  badgeComponent,
  summaryComponent,
  listComponent,
  checklistComponent,
  dividerComponent,
  linkComponent,
  buttonComponent,
  productComponent,
]);

export const juanPagerComponentSchema: z.ZodType<JuanPagerComponent> = z.lazy(() =>
  z.union([
    leafComponents,
    z
      .object({
        type: z.literal("section"),
        id: idField,
        title: optionalText(200),
        collapsible: z.boolean().optional(),
        collapsed: z.boolean().optional(),
        components: z.array(juanPagerComponentSchema).max(LIMITS.maxComponents),
      })
      .strict(),
    z
      .object({
        type: z.literal("grid"),
        id: idField,
        columns: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
        components: z.array(juanPagerComponentSchema).max(LIMITS.maxComponents),
      })
      .strict(),
    z
      .object({
        type: z.literal("card"),
        id: idField,
        title: optionalText(200),
        components: z.array(juanPagerComponentSchema).max(LIMITS.maxComponents),
      })
      .strict(),
  ]),
);

export const juanPagerDocumentSchema = z
  .object({
    version: z.literal("0.1"),
    title: text(200),
    description: optionalText(),
    theme: z.enum(["system", "light", "dark"]).optional(),
    components: z.array(juanPagerComponentSchema).min(1).max(LIMITS.maxComponents),
    metadata: z
      .record(z.union([z.string().max(LIMITS.maxTextLength), z.number(), z.boolean()]))
      .optional()
      .refine(
        (value) => !value || Object.keys(value).length <= LIMITS.maxMetadataEntries,
        { message: `metadata may have at most ${LIMITS.maxMetadataEntries} entries` },
      ),
  })
  .strict();

export type JuanPagerDocument = z.infer<typeof juanPagerDocumentSchema>;
export type ProductComponent = z.infer<typeof productComponent>;
export type ButtonComponent = z.infer<typeof buttonComponent>;

export class DocumentValidationError extends Error {
  readonly details: string;

  constructor(message: string, details: string) {
    super(message);
    this.name = "DocumentValidationError";
    this.details = details;
  }
}

function countComponents(components: JuanPagerComponent[]): number {
  let total = 0;
  for (const component of components) {
    total += 1;
    if (
      component.type === "section" ||
      component.type === "grid" ||
      component.type === "card"
    ) {
      total += countComponents(component.components);
    }
  }
  return total;
}

function maxDepth(components: JuanPagerComponent[], depth = 1): number {
  let deepest = depth;
  for (const component of components) {
    if (
      component.type === "section" ||
      component.type === "grid" ||
      component.type === "card"
    ) {
      deepest = Math.max(deepest, maxDepth(component.components, depth + 1));
    }
  }
  return deepest;
}

export function validateDocument(input: unknown): JuanPagerDocument {
  const parsed = juanPagerDocumentSchema.safeParse(input);
  if (!parsed.success) {
    throw new DocumentValidationError(
      "This JuanPager document is invalid.",
      parsed.error.issues
        .slice(0, 20)
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("\n"),
    );
  }

  const document = parsed.data;
  const total = countComponents(document.components);
  if (total > LIMITS.maxComponents) {
    throw new DocumentValidationError(
      "This JuanPager document exceeds size limits.",
      `Component count ${total} exceeds maximum ${LIMITS.maxComponents}.\n${LIMITS_HELP}`,
    );
  }

  const depth = maxDepth(document.components);
  if (depth > LIMITS.maxNestingDepth) {
    throw new DocumentValidationError(
      "This JuanPager document exceeds size limits.",
      `Nesting depth ${depth} exceeds maximum ${LIMITS.maxNestingDepth}.\n${LIMITS_HELP}`,
    );
  }

  return document;
}
