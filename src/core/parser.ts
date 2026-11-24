import { CATALOG, type Sku } from "./catalog.ts";

// Rule-based parser for order messages like:
//   "bhaiya 2 kilo aata, ek amul butter bada wala aur 3 maggi bhej do"
// It runs offline, is fully testable, and handles most everyday orders.
// Anything it isn't sure about is marked low-confidence for a human
// (or the Claude agent) to resolve.

export interface ParsedLine {
  raw: string;
  sku: Sku | null;
  qty: number;
  confidence: "high" | "low" | "none";
  alternatives: Sku[];
  note?: string;
}

const NUMBER_WORDS: Record<string, number> = {
  ek: 1, one: 1, a: 1, an: 1, do: 2, two: 2, teen: 3, three: 3, char: 4, chaar: 4, four: 4,
  paanch: 5, panch: 5, five: 5, chhe: 6, che: 6, six: 6, saat: 7, seven: 7, aath: 8, eight: 8,
  nau: 9, nine: 9, das: 10, ten: 10, dozen: 12, darjan: 12,
  aadha: 0.5, adha: 0.5, half: 0.5, dedh: 1.5, dhai: 2.5, dhaai: 2.5,
};

const UNIT_GRAMS: Record<string, number> = {
  kg: 1000, kilo: 1000, kgs: 1000, kilos: 1000, g: 1, gm: 1, gms: 1, gram: 1, grams: 1,
  l: 1000, litre: 1000, liter: 1000, litres: 1000, ltr: 1000, ml: 1,
};
const PACK_WORDS = new Set(["packet", "packets", "pkt", "pack", "pc", "pcs", "piece", "pieces", "dabba", "dabbe", "bottle", "bottles", "bag", "bags", "box", "tray"]);
const BIG = new Set(["bada", "badi", "bade", "big", "large", "bigger"]);
const SMALL = new Set(["chhota", "chota", "chhoti", "choti", "small"]);
const FILLER = new Set([
  "bhaiya", "bhai", "bhaiyya", "ji", "please", "pls", "plz", "bhej", "bhejo", "bhejna", "do", "dena", "de", "dijiye", "send", "and", "aur",
  "wala", "wali", "wale", "ka", "ki", "ke", "chahiye", "chaiye", "need", "want", "also", "bhi", "order", "hai", "hain", "me", "mujhe", "kal", "aaj",
  "the", "of", "x", "nos",
]);

/** Split a message into item chunks on newlines, commas, "aur", "and", "+", "&". */
export function splitItems(message: string): string[] {
  return message
    .toLowerCase()
    .replace(/[₹]/g, " ")
    .split(/\n|,|;|\+|&|\baur\b|\band\b|\bphir\b/)
    .map((x) => x.trim())
    .filter((x) => /[a-z]/.test(x));
}

export function parseOrder(message: string, catalog: Sku[] = CATALOG): ParsedLine[] {
  return splitItems(message).map((chunk) => parseChunk(chunk, catalog)).filter((l): l is ParsedLine => l !== null);
}

function parseChunk(raw: string, catalog: Sku[]): ParsedLine | null {
  // "2kg" -> "2 kg", "500g" -> "500 g"
  const text = raw.replace(/(\d)([a-z])/g, "$1 $2").replace(/[^a-z0-9.\- ]/g, " ");
  let tokens = text.split(/\s+/).filter(Boolean);

  let count: number | null = null; // how many / how much
  let unitGrams: number | null = null; // if a weight/volume was given
  let pack = false;
  let size: "big" | "small" | null = null;
  const words: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const n = /^\d+(\.\d+)?$/.test(t) ? parseFloat(t) : NUMBER_WORDS[t];
    // "do" is both "two" and "give". Treat it as a number only if something follows that isn't filler.
    if (n !== undefined && !(t === "do" && (i === tokens.length - 1 || FILLER.has(tokens[i + 1] ?? ""))) && !(t === "a" || t === "an") ) {
      if (count === null) { count = n; continue; }
    }
    // Units only count right after a number ("2 kg"), so "parle g" stays a product name.
    const prevIsNumber = i > 0 && (/^\d+(\.\d+)?$/.test(tokens[i - 1]) || tokens[i - 1] in NUMBER_WORDS);
    if (t in UNIT_GRAMS && prevIsNumber) { unitGrams = UNIT_GRAMS[t]; continue; }
    if (PACK_WORDS.has(t)) { pack = true; continue; }
    if (BIG.has(t)) { size = "big"; continue; }
    if (SMALL.has(t)) { size = "small"; continue; }
    if (FILLER.has(t) || t === "a" || t === "an") continue;
    words.push(t);
  }
  if (!words.length) return null;
  const phrase = words.join(" ");

  const ranked = rank(phrase, catalog);
  if (!ranked.length) return { raw, sku: null, qty: count ?? 1, confidence: "none", alternatives: [], note: `Couldn't find "${phrase}" in the catalog.` };

  // Candidates that share the best product (same category + top score band).
  const top = ranked[0].score;
  let pool = ranked.filter((r) => r.score >= top * 0.8).map((r) => r.sku);
  const category = pool[0].category;
  pool = pool.filter((x) => x.category === category);
  // If the customer named a brand, stay with it even when it's out of stock (the cart offers a substitute).
  const named = pool.filter((x) => phraseNamesBrand(phrase, x));
  if (named.length) pool = named;

  // Weight/volume asked for ("2 kilo aata", "500 g butter"): prefer the pack that divides it.
  let qty = count ?? 1;
  const wanted = unitGrams !== null ? (count ?? 1) * unitGrams : null;
  let chosen: Sku;
  let note: string | undefined;
  if (wanted !== null && pool.some((x) => x.grams > 0)) {
    const exact = pool.filter((x) => x.grams > 0 && wanted % x.grams === 0 && wanted >= x.grams).sort((a, b) => b.grams - a.grams);
    if (exact.length) {
      chosen = exact[0];
      qty = wanted / chosen.grams;
    } else {
      const smallest = [...pool].filter((x) => x.grams > 0).sort((a, b) => a.grams - b.grams)[0];
      chosen = smallest;
      qty = Math.max(1, Math.ceil(wanted / smallest.grams));
      note = `${fmtQty(wanted)} ka pack nahi hai; ${qty} × ${smallest.size} chalega?`;
    }
  } else if (size && pool.length > 1) {
    const sorted = [...pool].sort((a, b) => a.grams - b.grams);
    chosen = size === "big" ? sorted[sorted.length - 1] : sorted[0];
  } else {
    // No size given: prefer in-stock, then the most common (smallest) pack.
    chosen = [...pool].sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0) || a.grams - b.grams)[0];
  }

  const ambiguousSize = !wanted && !size && count === null && pool.filter((x) => x.brand === chosen.brand).length > 1;
  const ambiguousBrand = new Set(pool.map((x) => x.brand)).size > 1 && !phraseNamesBrand(phrase, chosen);
  const confidence = ranked[0].score < 0.6 || ambiguousSize || ambiguousBrand ? "low" : "high";
  if (!note && ambiguousSize) note = `${capital(phrase)}: ${pool.filter((x) => x.brand === chosen.brand).map((x) => x.size).join(" ya ")}? (abhi ${chosen.size} daala hai)`;
  if (!note && ambiguousBrand) note = `${capital(phrase)}: ${[chosen.brand, ...new Set(pool.map((x) => x.brand).filter((b) => b !== chosen.brand))].join(" ya ")}? (abhi ${chosen.brand} daala hai)`;

  return { raw, sku: chosen, qty, confidence, alternatives: pool.filter((x) => x !== chosen).slice(0, 3), note };
}

function phraseNamesBrand(phrase: string, sku: Sku): boolean {
  return phrase.includes(sku.brand.toLowerCase().split(" ")[0]);
}

/** Score every SKU against a phrase: alias and name token overlap, with typo tolerance. */
export function rank(phrase: string, catalog: Sku[] = CATALOG): { sku: Sku; score: number }[] {
  const pw = phrase.split(" ");
  return catalog
    .map((sku) => {
      const names = [...sku.aliases, `${sku.brand} ${sku.name}`.toLowerCase(), sku.name.toLowerCase()];
      let best = 0;
      for (const n of names) {
        const nw = n.split(/[\s-]+/);
        // Fraction of alias words found in the phrase (allowing small typos), weighted by length.
        let hit = 0, total = 0;
        for (const w of nw) {
          total += w.length;
          if (pw.some((p) => p === w || (w.length >= 4 && editDistance(p, w) <= (w.length >= 7 ? 2 : 1)))) hit += w.length;
        }
        const cover = hit / total;
        // Bonus when the alias explains most of what the customer typed.
        const used = pw.filter((p) => nw.some((w) => p === w || (w.length >= 4 && editDistance(p, w) <= 1))).length / pw.length;
        best = Math.max(best, cover * (0.7 + 0.3 * used));
      }
      // Naming the brand ("pillsbury atta", "dettol sabun") should win over a generic match.
      if (best > 0 && pw.includes(sku.brand.toLowerCase().split(" ")[0])) best += 0.2;
      return { sku, score: best };
    })
    .filter((r) => r.score >= 0.45)
    .sort((a, b) => b.score - a.score);
}

export function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function fmtQty(g: number) {
  return g >= 1000 ? `${g / 1000} kg` : `${g} g`;
}
