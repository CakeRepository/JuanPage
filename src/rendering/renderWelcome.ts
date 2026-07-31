import { append, el, externalLink } from "./dom.js";

export type WelcomeOptions = {
  onDemo: () => void;
  docsHref: string;
};

const MOMENTS = [
  ["Confirm", "A checkout, approval, or final review surface."],
  ["Track", "A live checklist with progress that persists locally."],
  ["Choose", "Clear options a person can compare and select."],
  ["Inspect", "A focused detail view for one important thing."],
  ["Compare", "Side-by-side facts without agent-authored layout."],
  ["Collect", "Notes and links organized into a useful handoff."],
] as const;

function actionLink(href: string, label: string, variant: "primary" | "secondary"): HTMLAnchorElement {
  return el("a", {
    className: `jp-btn jp-btn-${variant}`,
    text: label,
    attrs: { href },
  });
}

export function renderWelcome(mount: HTMLElement, options: WelcomeOptions): void {
  document.title = "JuanPager · Human surfaces for AI handoffs";

  const page = el("div", { className: "jp-welcome" });
  const nav = el("nav", {
    className: "jp-welcome-nav",
    attrs: { "aria-label": "JuanPager navigation" },
  });
  const brand = el("a", {
    className: "jp-welcome-brand",
    text: "JuanPager",
    attrs: { href: "./", "aria-label": "JuanPager home" },
  });
  const navActions = el("div", { className: "jp-welcome-nav-actions" });
  append(
    navActions,
    actionLink("builder.html", "Open builder", "secondary"),
    externalLink(options.docsHref, "Read the guide", "jp-btn jp-btn-ghost"),
  );
  append(nav, brand, navActions);

  const hero = el("main", { className: "jp-welcome-main" });
  const heroCopy = el("section", { className: "jp-welcome-copy" });
  append(
    heroCopy,
    el("p", { className: "jp-welcome-kicker", text: "AI generates the moment. JuanPager renders the interface." }),
    el("h1", {
      className: "jp-welcome-title",
      text: "The human surface at the end of an agent conversation.",
    }),
    el("p", {
      className: "jp-welcome-lede",
      text: "Turn structured agent output into a trusted, shareable page people can review, check off, adjust, print, and send back — without a backend or agent-authored HTML.",
    }),
  );

  const heroActions = el("div", { className: "jp-welcome-actions" });
  const demoButton = el("button", {
    className: "jp-btn jp-btn-primary jp-welcome-demo",
    text: "Launch interactive demo",
    attrs: { type: "button" },
  });
  demoButton.addEventListener("click", options.onDemo);
  append(
    heroActions,
    demoButton,
    actionLink("builder.html", "Build a JuanPager", "secondary"),
  );
  append(heroCopy, heroActions);

  const proof = el("div", { className: "jp-welcome-proof", attrs: { "aria-label": "Product properties" } });
  for (const item of ["No backend", "No auth", "Data-only payloads", "Local state", "GitHub Pages ready"]) {
    append(proof, el("span", { text: item }));
  }
  append(heroCopy, proof);

  const visual = el("section", {
    className: "jp-welcome-visual",
    attrs: { "aria-label": "Example JuanPager handoff flow" },
  });
  const conversation = el("div", { className: "jp-demo-conversation" });
  append(
    conversation,
    el("p", { className: "jp-demo-label", text: "Agent conversation" }),
    el("div", { className: "jp-demo-message jp-demo-message-user", text: "Make me a four-day high-protein grocery plan." }),
    el("div", { className: "jp-demo-message jp-demo-message-agent", text: "I organized the plan by store and made the quantities adjustable." }),
  );

  const arrow = el("div", { className: "jp-demo-arrow", text: "→", attrs: { "aria-hidden": "true" } });
  const surface = el("div", { className: "jp-demo-surface" });
  const surfaceTop = el("div", { className: "jp-demo-surface-top" });
  append(
    surfaceTop,
    el("span", { className: "jp-demo-chip", text: "Confirm" }),
    el("span", { className: "jp-demo-total", text: "$63.40" }),
  );
  append(
    surface,
    surfaceTop,
    el("h2", { text: "Four-Day Grocery Checkout" }),
    el("p", { className: "jp-demo-muted", text: "3 stores · 9 products · quantities stay on this device" }),
  );
  const demoRows = el("div", { className: "jp-demo-rows" });
  for (const [name, meta, price] of [
    ["Chicken Breast", "ALDI · 3 lb tray", "$11.42"],
    ["Greek Yogurt", "Costco · qty 2", "$11.98"],
    ["Baby Spinach", "Trader Joe’s · qty 2", "$4.98"],
  ]) {
    const row = el("div", { className: "jp-demo-row" });
    const rowCopy = el("div");
    append(rowCopy, el("strong", { text: name }), el("span", { text: meta }));
    append(row, el("span", { className: "jp-demo-check", text: "✓" }), rowCopy, el("strong", { text: price }));
    append(demoRows, row);
  }
  append(surface, demoRows, el("button", { className: "jp-demo-copy", text: "Copy list", attrs: { type: "button", tabindex: "-1" } }));
  append(visual, conversation, arrow, surface);
  append(hero, heroCopy, visual);

  const explanation = el("section", { className: "jp-welcome-section" });
  append(
    explanation,
    el("p", { className: "jp-welcome-kicker", text: "One runtime. Many human moments." }),
    el("h2", { className: "jp-welcome-section-title", text: "Agents describe intent and facts. JuanPager owns the experience." }),
  );
  const momentGrid = el("div", { className: "jp-moment-grid" });
  for (const [title, description] of MOMENTS) {
    const card = el("article", { className: "jp-moment-card" });
    append(card, el("h3", { text: title }), el("p", { text: description }));
    append(momentGrid, card);
  }
  append(explanation, momentGrid);

  const architecture = el("section", { className: "jp-welcome-architecture" });
  append(
    architecture,
    el("div", { className: "jp-architecture-step", text: "1 · Agent emits a moment" }),
    el("span", { text: "→", attrs: { "aria-hidden": "true" } }),
    el("div", { className: "jp-architecture-step", text: "2 · Data lives in the URL fragment" }),
    el("span", { text: "→", attrs: { "aria-hidden": "true" } }),
    el("div", { className: "jp-architecture-step", text: "3 · Trusted runtime renders the page" }),
  );

  const finalCta = el("section", { className: "jp-welcome-cta" });
  const finalCopy = el("div");
  append(
    finalCopy,
    el("p", { className: "jp-welcome-kicker", text: "See the proving story" }),
    el("h2", { text: "Open the grocery checkout and use it like a real person would." }),
    el("p", { text: "Adjust quantities, check items off, copy the list, switch themes, and generate a return receipt." }),
  );
  const finalDemo = el("button", {
    className: "jp-btn jp-btn-primary",
    text: "Try the demo",
    attrs: { type: "button" },
  });
  finalDemo.addEventListener("click", options.onDemo);
  append(finalCta, finalCopy, finalDemo);

  const footer = el("footer", { className: "jp-welcome-footer" });
  append(
    footer,
    el("span", { text: "JuanPager · AI Generate & Use, Humans Generate & Use" }),
    externalLink("https://github.com/CakeRepository/juanpager", "View source", "jp-link"),
  );

  append(page, nav, hero, explanation, architecture, finalCta, footer);
  mount.replaceChildren(page);
}
