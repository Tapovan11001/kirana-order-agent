import { test } from "node:test";
import assert from "node:assert/strict";
import { parseOrder, splitItems } from "../src/core/parser.ts";
import { buildCart, confirmationMessage, lowStock } from "../src/core/cart.ts";

const ids = (msg: string) => parseOrder(msg).map((l) => `${l.qty}x${l.sku?.id ?? "?"}`);

test("splits on commas, newlines, aur, and, +", () => {
  assert.deepEqual(splitItems("aata, cheeni\ndoodh aur dahi and maggi + jeera"), ["aata", "cheeni", "doodh", "dahi", "maggi", "jeera"]);
});

test("Hinglish quantities and units", () => {
  assert.deepEqual(ids("do kilo pyaaz aur teen kilo aloo"), ["2xonion-1", "3xpotato-1"]);
  assert.deepEqual(ids("2 kg cheeni"), ["2xsugar-1"]);
  assert.deepEqual(ids("1 litre sarson ka tel"), ["1xoil-mustard-1"]);
  assert.deepEqual(ids("10 kilo aata"), ["1xatta-ash-10"]);
});

test("'parle g' is a biscuit, not grams", () => {
  assert.deepEqual(ids("parle g 4 packet"), ["4xparleg-250"]);
});

test("'do' means two only when it's followed by a product", () => {
  assert.deepEqual(ids("3 maggi bhej do"), ["3xmaggi-70"]);
  assert.deepEqual(ids("do maggi"), ["2xmaggi-70"]);
});

test("size words pick the bigger or smaller pack", () => {
  assert.deepEqual(ids("ek amul butter bada wala"), ["1xbutter-amul-500"]);
  assert.deepEqual(ids("chhota butter"), ["1xbutter-amul-100"]);
});

test("named brand wins, even out of stock; cart then offers a substitute", () => {
  const parsed = parseOrder("pillsbury atta 5kg");
  assert.equal(parsed[0].sku?.id, "atta-pil-5");
  const cart = buildCart(parsed);
  assert.equal(cart.lines[0].substitute?.id, "atta-ash-5");
  assert.match(cart.questions[0], /stock mein nahi.*Aashirvaad.*chalega/);
});

test("typos and spelling variants", () => {
  assert.deepEqual(ids("tuvar dal 2 kg"), ["2xdal-toor-1"]);
  assert.deepEqual(ids("2 maggie"), ["2xmaggi-70"]);
  assert.deepEqual(ids("chawal"), ["1xrice-ig-5"]);
});

test("unknown items are reported, not guessed", () => {
  const p = parseOrder("1 coca cola");
  assert.equal(p[0].sku, null);
  assert.equal(p[0].confidence, "none");
  const msg = confirmationMessage(buildCart(p));
  assert.match(msg, /samajh nahi aaya: "1 coca cola"/);
});

test("ambiguous brand is flagged low confidence with a question", () => {
  const p = parseOrder("chai patti");
  assert.equal(p[0].confidence, "low");
  assert.ok(buildCart(p).questions.length === 1);
});

test("cart totals and confirmation text", () => {
  const cart = buildCart(parseOrder("2 kg cheeni, 3 maggi, 6 ande"));
  assert.equal(cart.total, 2 * 48 + 3 * 14 + 6 * 48);
  assert.match(confirmationMessage(cart, "english"), /Total: ₹426/);
});

test("low stock list for the shopkeeper's reorder", () => {
  const low = lowStock(10).map((x) => x.sku.id);
  assert.ok(low.includes("atta-pil-5") && low.includes("soap-dettol-3"));
  assert.ok(!low.includes("maggi-70"));
});
