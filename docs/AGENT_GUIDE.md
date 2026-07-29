# JuanPager agent guide

You are generating a **JuanPager moment**: the shareable human surface at the end of a conversation.

You never write HTML, CSS, or JavaScript. You describe **what this is for** (the moment), **what it is about** (entities), and **what the reader may do** (affordances). A trusted static app synthesizes the interface at runtime.

Two formats are accepted:

| Format | Version | When to use |
| --- | --- | --- |
| Moment | `0.2` | Preferred. Intent + facts + affordances. |
| Document | `0.1` | Legacy component tree. Still rendered, still valid. |

## The moment model

```json
{
  "version": "0.2",
  "title": "Justin's Four-Day Grocery Checkout",
  "description": "Optional context line",
  "theme": "system",
  "moment": "confirm",
  "goal": "Review and shop this high-protein plan",
  "summary": [{ "label": "Estimated total", "value": "$63.40 (sample)" }],
  "entities": [],
  "groups": [{ "id": "aldi", "label": "ALDI", "entityIds": ["chicken-breast"] }],
  "affordances": ["check", "adjust-qty", "copy-list", "print", "reset"],
  "continuation": { "kind": "note", "text": "Nothing is ordered from this page." },
  "metadata": { "priceNote": "sample" }
}
```

### Choose the moment

The moment is the reader's intent. It selects the composition; it is not a style.

| Moment | Use it when the reader needs to | Rendered as |
| --- | --- | --- |
| `confirm` | Review a decision before acting on it | Checkout-style line items plus an order summary |
| `track` | Work through a list in the real world | Compact checklist grouped by section, with progress |
| `choose` | Pick between options | Selectable cards |
| `inspect` | Understand one thing deeply | Hero detail with an attribute table |
| `compare` | Weigh options against each other | Side-by-side columns |
| `collect` | Gather notes, links, and items | Notes-and-links panel |
| `browse` | Scan many things quickly | Dense rows with open links |

### Entities are facts, not layout

```json
{ "type": "product", "id": "greek-yogurt", "name": "Plain Greek Yogurt", "store": "Costco",
  "imageUrl": "https://…", "displayPrice": "$5.99", "price": 5.99, "currency": "USD",
  "unitPrice": "$0.19 / oz", "packageSize": "32 oz tub", "quantity": 2,
  "availability": "in-stock", "productUrl": "https://…",
  "reason": "Why this is here", "badges": ["Breakfast"], "checked": false }

{ "type": "note", "id": "prep", "text": "Batch-cook the chicken on day one." }

{ "type": "link", "id": "plan", "label": "Open the full meal plan", "href": "https://…" }
```

Rules:

1. Every entity needs a unique `id`. Local state (checkboxes, quantities) is keyed by it.
2. Use numeric `price` **and** `quantity` whenever totals should add up. `displayPrice` is the human string.
3. `imageUrl` and any href must be **HTTPS**. `data:`, `javascript:`, `blob:`, and protocol-relative URLs are rejected.
4. `reason` is the most valuable field you can write: it is why *this* item is in *this* plan.
5. Keep the focus set small. The limit is 100 entities; a good moment is usually under 20.

### Groups

`groups` order and label the entities. Reference entities by id; every id must exist. If you omit `groups` and every product has a `store`, the app groups by store automatically.

### Affordances

Affordances are the only interactive capabilities. All are local to the reader's device.

| Affordance | Effect |
| --- | --- |
| `check` | Per-item checkboxes with progress |
| `adjust-qty` | Per-item quantity steppers that recompute totals |
| `copy-list` | Copy a plain-text version of the list |
| `print` | Print the page |
| `reset` | Clear local changes |
| `open-links` | Open every link in new tabs |
| `copy-page` | Copy the page URL |

Do not invent affordances, actions, event names, or URLs-as-actions. There is no remote effect available: nothing on the page can order, purchase, submit, or notify.

### Continuation

`{ "kind": "none" }` or `{ "kind": "note", "text": "…" }`. Use the note to set expectations about what happens after the page. Remote continuations are reserved for a future version.

## The Juan dialect

If emitting JSON is awkward, emit the dialect instead. It compiles to a moment and nothing else.

```text
# Justin's Four-Day Grocery Checkout
moment: confirm
goal: Review and shop this high-protein plan
theme: system

summary:
- Estimated total | $63.40 (sample)
- Daily protein | 160g+
- Stores | ALDI · Costco · Trader Joe's

## ALDI
- [ ] Greek Yogurt · $4.29 · qty 2 · why: breakfast protein · https://example.com/aldi-yogurt
- [ ] Eggs · $2.89 · qty 1

## Costco
- [ ] Chicken Thighs · $12.99 · qty 1 · why: dinners

affordances: check, adjust-qty, copy-list, print, reset, open-links
```

Line grammar:

| Line | Meaning |
| --- | --- |
| `# Text` | Title (exactly one) |
| `## Text` | Group heading; following items belong to it |
| `key: value` | Document field |
| `summary:` | Starts a summary block of `- Label \| Value` rows |
| `- Item …` | An entity |
| `// text` | Comment |

Document fields: `title`, `moment`, `goal`, `description`, `theme`, `currency`, `store`, `continuation`, `affordances`, `summary`.

Item segments are separated by `·` (or ` | `). The first segment is the name; the rest are recognised by shape:

| Segment | Becomes |
| --- | --- |
| `[ ]` / `[x]` prefix | `checked` (and implies the `check` affordance) |
| `$4.29` | `displayPrice` + numeric `price` |
| `qty 2` | `quantity` |
| `https://…` | `productUrl` |
| `why: …` | `reason` |
| `store: …`, `unit: …`, `size: …`, `img: …`, `badge: …`, `avail: …`, `id: …` | the matching field |
| `note: …` | a note entity |
| `link: Label \| https://…` | a link entity |

Unrecognised text becomes `reason` if it is not already set; anything else is a compile error naming the line. If `affordances` is omitted, they are inferred from what the items contain.

## Encoding

```bash
npm run encode -- examples/grocery-checkout.json          # gzip, shortest link
npm run encode -- examples/grocery-checkout.json --raw    # readable JSON payload
npm run encode -- examples/grocery-checkout.juan          # dialect input
npm run decode -- "http://localhost:5173/#v=2&enc=gz&data=..."
```

Fragment shapes:

```text
#v=2&enc=gz&data=BASE64URL(gzip(compact JSON))   moments, default
#v=2&enc=raw&data=BASE64URL(utf8 JSON)           moments, inspectable
#v=1&data=BASE64URL(gzip(compact JSON))          0.1 documents
```

Set the production base URL:

```bash
# PowerShell
$env:JUANPAGER_BASE_URL="https://CakeRepository.github.io/juanpager/"
npm run encode -- path/to/moment.json
```

`ONEPAGER_BASE_URL` is also accepted as an alias.

## Limits

| Limit | Value |
| --- | --- |
| Encoded fragment | 16 KB |
| Decoded JSON | 64 KB |
| Entities | 100 |
| Summary rows | 12 |
| Groups | 25 |
| Text field | 2,000 chars |
| URL field | 2,048 chars |

## Reusable prompt: grocery checkout

```text
Create a JuanPager moment (version "0.2") for a four-day high-protein grocery plan.

Requirements:
- moment: "confirm"; goal: a one-line statement of what the reader is deciding
- title uses the shopper's name if provided
- summary rows for estimated total, daily protein, and stores
- 8-12 product entities with unique ids, store, https imageUrl where available,
  displayPrice, numeric price, currency USD, unitPrice, packageSize, quantity,
  availability, productUrl, a one-sentence reason, and badges
- one note entity with prep advice, one link entity to the full plan
- groups keyed by store, referencing entity ids
- affordances: check, adjust-qty, copy-list, print, reset, open-links
- continuation note making clear nothing is ordered from the page
- label sample prices clearly; never claim live store pricing
- never emit HTML, CSS, or JavaScript; never include secrets

Return ONLY valid JSON for a JuanPagerMomentDoc.
```

## Legacy 0.1 documents

The component-tree format still validates and renders:

```json
{ "version": "0.1", "title": "Example", "components": [] }
```

Components: `heading`, `text`, `image`, `section`, `grid`, `card`, `product`, `price`, `badge`, `summary`, `list`, `checklist`, `divider`, `link`, `button`. Button actions: `copy-page`, `copy-list`, `print-page`, `reset-state`, `open-all-links`.

Prefer 0.2 for new work: you describe intent, and the renderer can improve the surface without you changing anything.
