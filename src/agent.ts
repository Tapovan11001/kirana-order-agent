import { Agent, defineTool, type ModelClient, type TraceEvent } from "./harness/index.ts";
import { CATALOG, byId, label } from "./core/catalog.ts";
import { parseOrder, rank } from "./core/parser.ts";
import { buildCart, type Cart } from "./core/cart.ts";

export const SYSTEM = `You take grocery orders for a neighbourhood kirana store over WhatsApp. Customers write in Hindi, English or a mix, with typos and local names (aata, cheeni, doodh, sarson ka tel, double roti).

How to work:
1. Call parse_order on the customer's message. It's a fast rule-based first pass; trust its high-confidence lines.
2. For low-confidence or unmatched lines, use search_catalog to find the right product. Never pick a product that isn't in the catalog.
3. Call set_cart once with the final list of sku ids and quantities. It checks stock and suggests substitutes.
4. Reply to the customer as the shop would on WhatsApp: in the same language and style they used, list each item with quantity and price, the total, and ask about anything that's out of stock, ambiguous or not found. Keep it short and friendly. End by asking them to confirm.

Never invent prices, stock or products. If something isn't sold here, say so.`;

export function makeKiranaAgent(model: ModelClient, onEvent?: (e: TraceEvent) => void) {
  const state: { cart: Cart | null } = { cart: null };

  const parse = defineTool<{ message: string }>({
    name: "parse_order",
    description: "Rule-based first pass over a customer's order message. Returns one line per item with the matched product, quantity and a confidence level.",
    input: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
    run: ({ message }) =>
      parseOrder(message).map((l) => ({
        text: l.raw,
        sku_id: l.sku?.id ?? null,
        product: l.sku ? label(l.sku) : null,
        qty: l.qty,
        confidence: l.confidence,
        note: l.note,
        alternatives: l.alternatives.map((a) => ({ sku_id: a.id, product: label(a) })),
      })),
  });

  const search = defineTool<{ query: string }>({
    name: "search_catalog",
    description: "Search the store catalog by product name, brand or local name. Returns up to 6 matches with sku id, price (₹) and stock.",
    input: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    run: ({ query }) => {
      const hits = rank(query.toLowerCase(), CATALOG).slice(0, 6);
      if (!hits.length) return `Nothing in the catalog matches "${query}".`;
      return hits.map(({ sku }) => ({ sku_id: sku.id, product: label(sku), price: sku.price, stock: sku.stock }));
    },
  });

  const setCart = defineTool<{ lines: { sku_id: string; qty: number }[]; not_found?: string[] }>({
    name: "set_cart",
    description: "Set the customer's cart. Checks stock, computes totals and suggests substitutes for anything short. Call once with every item.",
    input: {
      type: "object",
      properties: {
        lines: {
          type: "array",
          items: {
            type: "object",
            properties: { sku_id: { type: "string" }, qty: { type: "number", minimum: 0.5 } },
            required: ["sku_id", "qty"],
          },
        },
        not_found: { type: "array", items: { type: "string" }, description: "Items the customer asked for that the store doesn't sell" },
      },
      required: ["lines"],
    },
    run: ({ lines, not_found }) => {
      const unknown = lines.filter((l) => !byId(l.sku_id)).map((l) => l.sku_id);
      if (unknown.length) throw new Error(`Unknown sku_id: ${unknown.join(", ")}. Use search_catalog to find real ids.`);
      const cart = buildCart(
        [
          ...lines.map((l) => ({ raw: l.sku_id, sku: byId(l.sku_id)!, qty: l.qty, confidence: "high" as const, alternatives: [] })),
          ...(not_found ?? []).map((raw) => ({ raw, sku: null, qty: 1, confidence: "none" as const, alternatives: [] })),
        ],
        CATALOG,
      );
      state.cart = cart;
      return {
        lines: cart.lines.map((l) => ({ product: label(l.sku), qty: l.qty, price: l.sku.price, line_total: l.lineTotal, stock_note: l.stockNote, substitute: l.substitute ? `${label(l.substitute)} (₹${l.substitute.price})` : undefined })),
        total: cart.total,
        questions_for_customer: cart.questions,
        not_found: cart.notFound,
      };
    },
  });

  const agent = new Agent({ model, system: SYSTEM, tools: [parse, search, setCart], limits: { maxSteps: 8 }, onEvent });
  return { agent, state };
}
