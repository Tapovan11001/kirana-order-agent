import { CATALOG, label, type Sku } from "./catalog.ts";
import type { ParsedLine } from "./parser.ts";

export interface CartLine {
  sku: Sku;
  qty: number;
  lineTotal: number;
  /** Set when the requested SKU is out of stock or short. */
  stockNote?: string;
  substitute?: Sku;
}

export interface Cart {
  lines: CartLine[];
  total: number;
  /** Things to ask the customer before confirming. */
  questions: string[];
  notFound: string[];
}

export function buildCart(parsed: ParsedLine[], catalog: Sku[] = CATALOG): Cart {
  const lines: CartLine[] = [];
  const questions: string[] = [];
  const notFound: string[] = [];

  for (const p of parsed) {
    if (!p.sku) {
      notFound.push(p.raw);
      continue;
    }
    const line: CartLine = { sku: p.sku, qty: p.qty, lineTotal: round(p.sku.price * p.qty) };
    if (p.sku.stock < p.qty) {
      // Not billable until the customer picks the substitute or a smaller quantity.
      line.lineTotal = 0;
      const sub = substituteFor(p.sku, p.qty, catalog);
      line.stockNote = p.sku.stock === 0 ? `${label(p.sku)} abhi stock mein nahi hai.` : `${label(p.sku)} sirf ${p.sku.stock} bache hain.`;
      if (sub) {
        line.substitute = sub;
        questions.push(`${line.stockNote} ${label(sub)} (₹${sub.price}) chalega?`);
      } else {
        questions.push(line.stockNote);
      }
    } else if (p.confidence === "low" && p.note) {
      questions.push(p.note);
    }
    lines.push(line);
  }
  return { lines, total: round(lines.reduce((s, l) => s + l.lineTotal, 0)), questions, notFound };
}

/** Same category, same pack size if possible, in stock, closest price. */
export function substituteFor(sku: Sku, qty: number, catalog: Sku[] = CATALOG): Sku | undefined {
  return catalog
    .filter((x) => x.id !== sku.id && x.category === sku.category && x.stock >= qty)
    .sort((a, b) => Math.abs(a.grams - sku.grams) - Math.abs(b.grams - sku.grams) || Math.abs(a.price - sku.price) - Math.abs(b.price - sku.price))[0];
}

/** The WhatsApp reply a shop would send back. Hinglish by default, like the customer. */
export function confirmationMessage(cart: Cart, lang: "hinglish" | "english" = "hinglish"): string {
  const h = lang === "hinglish";
  const rows = cart.lines.map((l) => (l.stockNote ? `• ${l.qty} × ${label(l.sku)} — ${h ? "stock mein nahi" : "out of stock"}` : `• ${l.qty} × ${label(l.sku)} — ₹${l.lineTotal}`));
  const parts = [
    h ? "Namaste! Aapka order:" : "Hi! Here's your order:",
    ...rows,
    `${h ? "Total" : "Total"}: ₹${cart.total}`,
  ];
  if (cart.questions.length) parts.push("", h ? "Ek do cheezein confirm karni hain:" : "A couple of things to confirm:", ...cart.questions.map((q) => `– ${q}`));
  if (cart.notFound.length) parts.push("", h ? `Ye samajh nahi aaya: "${cart.notFound.join('", "')}". Thoda detail mein bata dijiye?` : `I couldn't find: "${cart.notFound.join('", "')}". Could you describe it a bit more?`);
  parts.push("", h ? "Sab theek hai toh 'OK' bhej dijiye, 30 min mein delivery." : "Reply OK to confirm. Delivery in 30 minutes.");
  return parts.join("\n");
}

/** For the shopkeeper: what to reorder from the distributor. */
export function lowStock(threshold = 10, catalog: Sku[] = CATALOG): { sku: Sku; suggestQty: number }[] {
  return catalog
    .filter((x) => x.stock < threshold)
    .map((sku) => ({ sku, suggestQty: Math.max(threshold * 2 - sku.stock, 6) }))
    .sort((a, b) => a.sku.stock - b.sku.stock);
}

const round = (n: number) => Math.round(n * 100) / 100;
