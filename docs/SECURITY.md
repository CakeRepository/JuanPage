# Security model

JuanPager treats every decoded document as **untrusted input**.

## Trust boundary

- The static app (HTML/CSS/JS on GitHub Pages) is trusted.
- The URL fragment payload is not trusted.
- Agents may supply data values only — never code.

## Hard restrictions

Rendering never uses:

- `innerHTML`, `outerHTML`, `insertAdjacentHTML`
- `eval` / `new Function`
- inline event-handler strings
- agent-provided CSS or class names
- raw SVG from the document
- `iframe`, `object`, `embed`, `script`, `style`

All UI is created with `document.createElement` and a fixed component registry.

## URL policy

Allowed:

- `https:`
- `http://localhost` and `http://127.0.0.1` in development

Rejected:

- `javascript:`, `data:`, `file:`, `blob:`
- protocol-relative URLs (`//...`)

External links use `target="_blank"` and `rel="noopener noreferrer"`.

## Privacy

URL fragments may appear in browser history, bookmarks, screenshots, chat messages, and shared documents. Do not embed passwords, tokens, medical data, or other sensitive information.
