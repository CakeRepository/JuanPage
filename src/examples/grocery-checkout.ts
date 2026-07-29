import type { JuanPagerMomentDoc } from "../schema/moment.js";

/**
 * The proving story: a meal-plan conversation ends in a shareable checkout
 * surface. Prices are labeled samples — not live store prices.
 */
export const groceryCheckout: JuanPagerMomentDoc = {
  version: "0.2",
  title: "Justin’s Four-Day Grocery Checkout",
  description:
    "Everything the plan needs, grouped by the store you walk into. Sample prices only — not current store pricing.",
  theme: "system",
  moment: "confirm",
  goal: "Review and shop this high-protein plan",
  summary: [
    { label: "Estimated total", value: "$63.40 (sample)" },
    { label: "Daily protein", value: "160g+" },
    { label: "Stores", value: "ALDI · Costco · Trader Joe’s" },
    { label: "Days covered", value: "4" },
  ],
  entities: [
    {
      type: "product",
      id: "chicken-breast",
      name: "Chicken Breast",
      store: "ALDI",
      imageUrl: "https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=640&q=80",
      displayPrice: "$11.42",
      price: 11.42,
      currency: "USD",
      unitPrice: "$3.81 / lb",
      packageSize: "3 lb tray",
      quantity: 1,
      availability: "in-stock",
      productUrl: "https://www.aldi.us/",
      reason: "Lean protein base for lunches and dinners across four days.",
      badges: ["High protein", "Sample price"],
    },
    {
      type: "product",
      id: "eggs",
      name: "Large Eggs",
      store: "ALDI",
      imageUrl: "https://images.unsplash.com/photo-1518569656558-1f25e69d93d7?w=640&q=80",
      displayPrice: "$3.48",
      price: 3.48,
      currency: "USD",
      unitPrice: "$0.29 / egg",
      packageSize: "12 count",
      quantity: 1,
      availability: "limited",
      productUrl: "https://www.aldi.us/",
      reason: "Cheap complete protein for breakfast and snacks.",
      badges: ["Staple"],
    },
    {
      type: "product",
      id: "bananas",
      name: "Bananas",
      store: "ALDI",
      imageUrl: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=640&q=80",
      displayPrice: "$1.39",
      price: 1.39,
      currency: "USD",
      unitPrice: "$0.55 / lb",
      packageSize: "bunch (~2.5 lb)",
      quantity: 1,
      availability: "in-stock",
      productUrl: "https://www.aldi.us/",
      reason: "Portable carbs to pair with yogurt after workouts.",
    },
    {
      type: "product",
      id: "greek-yogurt",
      name: "Plain Greek Yogurt",
      store: "Costco",
      imageUrl: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=640&q=80",
      displayPrice: "$5.99",
      price: 5.99,
      currency: "USD",
      unitPrice: "$0.19 / oz",
      packageSize: "32 oz tub",
      quantity: 2,
      availability: "in-stock",
      productUrl: "https://www.costco.com/",
      reason: "Two tubs cover breakfast every morning of the plan.",
      badges: ["Breakfast"],
    },
    {
      type: "product",
      id: "cottage-cheese",
      name: "Cottage Cheese",
      store: "Costco",
      displayPrice: "$4.19",
      price: 4.19,
      currency: "USD",
      unitPrice: "$0.17 / oz",
      packageSize: "24 oz tub",
      quantity: 1,
      availability: "in-stock",
      productUrl: "https://www.costco.com/",
      reason: "Late-evening protein without cooking anything.",
    },
    {
      type: "product",
      id: "rice",
      name: "Jasmine Rice",
      store: "Costco",
      imageUrl: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=640&q=80",
      displayPrice: "$12.99",
      price: 12.99,
      currency: "USD",
      unitPrice: "$0.54 / lb",
      packageSize: "25 lb bag",
      quantity: 1,
      availability: "in-stock",
      productUrl: "https://www.costco.com/",
      reason: "Bulk carb base; the leftover bag covers future weeks.",
      badges: ["Bulk"],
    },
    {
      type: "product",
      id: "spinach",
      name: "Baby Spinach",
      store: "Trader Joe’s",
      imageUrl: "https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=640&q=80",
      displayPrice: "$2.49",
      price: 2.49,
      currency: "USD",
      unitPrice: "$0.42 / oz",
      packageSize: "6 oz bag",
      quantity: 2,
      availability: "in-stock",
      productUrl: "https://www.traderjoes.com/",
      reason: "Volume vegetable for omelets, bowls, and sides.",
      badges: ["Produce"],
    },
    {
      type: "product",
      id: "frozen-broccoli",
      name: "Frozen Broccoli Florets",
      store: "Trader Joe’s",
      displayPrice: "$1.99",
      price: 1.99,
      currency: "USD",
      packageSize: "16 oz bag",
      quantity: 2,
      availability: "in-stock",
      productUrl: "https://www.traderjoes.com/",
      reason: "Zero-prep side that survives the whole week.",
    },
    {
      type: "product",
      id: "olive-oil",
      name: "Extra Virgin Olive Oil",
      store: "Trader Joe’s",
      imageUrl: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=640&q=80",
      displayPrice: "$8.99",
      price: 8.99,
      currency: "USD",
      unitPrice: "$0.53 / fl oz",
      packageSize: "16.9 fl oz",
      quantity: 1,
      availability: "unknown",
      productUrl: "https://www.traderjoes.com/",
      reason: "Cooking fat for the chicken and every roasted vegetable.",
      badges: ["Pantry"],
    },
    {
      type: "note",
      id: "prep-note",
      text: "Batch-cook the chicken and rice on day one; everything else is assembly.",
    },
    {
      type: "link",
      id: "plan-source",
      label: "Open the full meal plan",
      href: "https://example.com/meal-plan",
    },
  ],
  groups: [
    {
      id: "aldi",
      label: "ALDI",
      entityIds: ["chicken-breast", "eggs", "bananas"],
    },
    {
      id: "costco",
      label: "Costco",
      entityIds: ["greek-yogurt", "cottage-cheese", "rice"],
    },
    {
      id: "trader-joes",
      label: "Trader Joe’s",
      entityIds: ["spinach", "frozen-broccoli", "olive-oil"],
    },
    {
      id: "before-you-go",
      label: "Before you go",
      entityIds: ["prep-note", "plan-source"],
    },
  ],
  affordances: [
    "check",
    "adjust-qty",
    "copy-list",
    "print",
    "reset",
    "open-links",
    "copy-page",
  ],
  continuation: {
    kind: "note",
    text: "Nothing is ordered from this page. Check items off as you shop; changes stay on this device.",
  },
  metadata: {
    days: 4,
    audience: "demo",
    priceNote: "sample",
  },
};

/** The same moment written in the Juan dialect (mirrors examples/grocery-checkout.juan). */
export const groceryCheckoutDialect = `# Justin's Four-Day Grocery Checkout
moment: confirm
goal: Review and shop this high-protein plan
theme: system
description: Everything the plan needs, grouped by the store you walk into. Sample prices only.

summary:
- Estimated total | $63.40 (sample)
- Daily protein | 160g+
- Stores | ALDI · Costco · Trader Joe's

## ALDI
- [ ] Chicken Breast · $11.42 · qty 1 · why: lean protein base for lunches and dinners · https://www.aldi.us/
- [ ] Large Eggs · $3.48 · qty 1 · why: cheap complete protein
- [ ] Bananas · $1.39 · qty 1 · why: portable carbs after workouts

## Costco
- [ ] Plain Greek Yogurt · $5.99 · qty 2 · why: breakfast protein every morning · https://www.costco.com/
- [ ] Cottage Cheese · $4.19 · qty 1 · why: late-evening protein
- [ ] Jasmine Rice · $12.99 · qty 1 · why: bulk carb base · badge: Bulk

## Trader Joe's
- [ ] Baby Spinach · $2.49 · qty 2 · why: volume vegetable for bowls
- [ ] Frozen Broccoli Florets · $1.99 · qty 2 · why: zero-prep side
- [ ] Extra Virgin Olive Oil · $8.99 · qty 1 · why: cooking fat for everything

## Before you go
- note: Batch-cook the chicken and rice on day one; everything else is assembly.
- link: Open the full meal plan | https://example.com/meal-plan

affordances: check, adjust-qty, copy-list, print, reset, open-links, copy-page
continuation: Nothing is ordered from this page. Check items off as you shop.
`;

export default groceryCheckout;
