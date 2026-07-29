# JuanPager agent guide

You are generating a **JuanPager** document: a compact JSON page description that will be compressed into a URL fragment and rendered by a trusted static app.

## Rules

1. Produce **only** valid JuanPager JSON (`version: "0.1"`).
2. Use the predefined component catalog only.
3. Keep descriptions concise.
4. Reference images by **HTTPS** URL.
5. Never embed image data (`data:` URLs are rejected).
6. Avoid repeating shared information already in the title/summary.
7. Use numeric `price` and `quantity` when totals should be calculated.
8. Use `displayPrice` when a price cannot be represented numerically.
9. Keep the page below the encoded payload limit (16 KB encoded / 64 KB decoded JSON).
10. Never include secrets or private information.
11. Never generate HTML, JavaScript, or CSS.

## Supported components

`heading`, `text`, `image`, `section`, `grid`, `card`, `product`, `price`, `badge`, `summary`, `list`, `checklist`, `divider`, `link`, `button`

### Buttons

Buttons may only use these local actions:

- `copy-page`
- `copy-list`
- `print-page`
- `reset-state`
- `open-all-links`

Do not invent actions, event names, or URLs-as-actions.

### URLs

Allowed: `https:` and, during local development only, `http://localhost` / `http://127.0.0.1`.

Rejected: `javascript:`, `data:`, `file:`, `blob:`, protocol-relative URLs.

## Document shape

```json
{
  "version": "0.1",
  "title": "Example page",
  "description": "Optional short summary",
  "theme": "system",
  "components": [],
  "metadata": {}
}
```

## Reusable prompt: grocery plan

```text
Create a JuanPager JSON document (version "0.1") for a four-day high-protein grocery plan.

Requirements:
- title: use the shopper's name if provided, otherwise "Four-Day Grocery Plan"
- include a short description noting that prices are samples unless live prices are supplied
- include a summary with estimated total, daily protein target, and stores
- group products into collapsible store/category sections
- include at least 6 product components with name, store, https imageUrl, displayPrice, numeric price, currency USD, unitPrice, packageSize, quantity, availability, productUrl, reason, and badges
- include buttons for copy-list, print-page, and reset-state
- use only JuanPager components; never emit HTML, CSS, or JavaScript
- keep the document compact enough for a 16KB encoded URL fragment
- never include secrets or sensitive personal data

Return ONLY valid JSON for a JuanPagerDocument.
```

## Encoding

After generating JSON:

```bash
npm run encode -- path/to/document.json
```

Set production base URL:

```bash
# PowerShell
$env:JUANPAGER_BASE_URL="https://CakeRepository.github.io/juanpager/"
npm run encode -- path/to/document.json
```

`ONEPAGER_BASE_URL` is also accepted as an alias.
