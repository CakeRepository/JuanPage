/** Safe DOM helpers — never use innerHTML / outerHTML / insertAdjacentHTML. */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options?: {
    className?: string;
    text?: string;
    attrs?: Record<string, string | number | boolean | undefined | null>;
  },
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options?.className) node.className = options.className;
  if (options?.text !== undefined) node.textContent = options.text;
  if (options?.attrs) {
    for (const [key, value] of Object.entries(options.attrs)) {
      if (value === undefined || value === null) continue;
      if (typeof value === "boolean" && key.startsWith("aria-")) {
        node.setAttribute(key, String(value));
      } else if (value === true) {
        node.setAttribute(key, "");
      } else if (value !== false) {
        node.setAttribute(key, String(value));
      }
    }
  }
  return node;
}

export function append(parent: Node, ...children: Array<Node | null | undefined>): void {
  for (const child of children) {
    if (child) parent.appendChild(child);
  }
}

export function externalLink(href: string, label: string, className?: string): HTMLAnchorElement {
  return el("a", {
    className,
    text: label,
    attrs: {
      href,
      target: "_blank",
      rel: "noopener noreferrer",
    },
  });
}

/** Remote images may fail or be blocked; never leave a broken box behind. */
export function imageWithFallback(src: string, alt: string, className: string): HTMLElement {
  const wrap = el("div", { className: `${className}-wrap` });
  const img = el("img", {
    className,
    attrs: {
      src,
      alt,
      loading: "lazy",
      decoding: "async",
      referrerpolicy: "no-referrer",
    },
  });
  const fallback = el("div", {
    className: `${className}-fallback`,
    text: "Image unavailable",
    attrs: { hidden: true, role: "img", "aria-label": alt },
  });
  img.addEventListener("error", () => {
    img.hidden = true;
    fallback.hidden = false;
  });
  append(wrap, img, fallback);
  return wrap;
}

export function announce(host: HTMLElement, message: string): void {
  const note = el("span", {
    className: "jp-sr-only",
    text: message,
    attrs: { role: "status", "aria-live": "polite" },
  });
  append(host, note);
  window.setTimeout(() => note.remove(), 2000);
}

export function assertNoHtmlApisUsed(root: ParentNode): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node = walker.currentNode as Element | null;
  while (node) {
    const tag = node.tagName.toLowerCase();
    if (tag === "script" || tag === "iframe" || tag === "object" || tag === "embed" || tag === "style") {
      throw new Error(`Forbidden element rendered: <${tag}>`);
    }
    node = walker.nextNode() as Element | null;
  }
}
